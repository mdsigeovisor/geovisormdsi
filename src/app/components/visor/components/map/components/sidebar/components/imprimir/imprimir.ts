import { Component, HostListener, signal, inject, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { jsPDF } from 'jspdf';
import { MapService } from '../../../../../../../../services/map.service';

/** Opciones de orientación del plano */
type Orientacion = 'vertical' | 'horizontal';
/** Formatos de papel soportados */
type FormatoPapel = 'a4' | 'a3';

const LOGO_SRC = 'assets/images/logo_visor.png';
const COLOR_INSTITUCIONAL: [number, number, number] = [27, 42, 78]; // #1b2a4e
const COLOR_VERDE: [number, number, number] = [70, 87, 15];         // #46570f

/**
 * Panel de impresión/exportación del visor.
 * Genera un PDF local (jsPDF) o envía a la impresora la vista actual del mapa,
 * incluyendo logo institucional, título editable y fecha/hora de impresión.
 */
@Component({
  selector: 'app-imprimir',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './imprimir.html',
  styleUrl: './imprimir.css',
  // Necesario para que las reglas @media print afecten a todo el documento
  encapsulation: ViewEncapsulation.None,
})
export class Imprimir {
  private readonly mapService = inject(MapService);

  /** Título editable que se estampará en el plano */
  titulo = signal('Plano Catastral - Municipalidad de San Isidro');
  /** Orientación del papel */
  orientacion = signal<Orientacion>('vertical');
  /** Tamaño de papel */
  formato = signal<FormatoPapel>('a4');
  /** Indica si se está generando el PDF o preparando la impresión */
  generando = signal(false);
  /** Mensaje de error para el usuario */
  error = signal<string | null>(null);
  /** Data URL del mapa capturado para la vista de impresora */
  imagenMapa = signal<string | null>(null);
  /** Fecha/hora formateada que se estampará */
  fechaHora = signal(this.formatearFecha(new Date()));

  /** Dimensiones reales (px) del último mapa capturado */
  private mapaAnchoPx = 1;
  private mapaAltoPx = 1;
  private estiloPagina?: HTMLStyleElement;

  /** Formatea una fecha como DD/MM/YYYY HH:mm:ss (es-PE) */
  private formatearFecha(fecha: Date): string {
    const dia = fecha.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const hora = fecha.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    return `${dia} ${hora}`;
  }

  /** Al cerrar el diálogo de impresión limpiamos los recursos temporales */
  @HostListener('window:afterprint')
  onAfterPrint(): void {
    this.imagenMapa.set(null);
    this.estiloPagina?.remove();
    this.estiloPagina = undefined;
    this.generando.set(false);
  }

  /**
   * Captura la vista actual del mapa y la devuelve como DataURL JPEG.
   */
  private async capturarMapa(): Promise<string> {
    // Pequeña espera para que terminen de cargar los tiles en curso
    await new Promise(res => setTimeout(res, 300));
    const canvas = this.mapService.getMapCanvas();
    if (!canvas || !canvas.width) {
      throw new Error('El mapa aún no está listo para exportarse.');
    }
    this.mapaAnchoPx = canvas.width;
    this.mapaAltoPx = canvas.height;
    return canvas.toDataURL('image/jpeg', 0.92);
  }

  /**
   * Carga una imagen y resuelve cuando está disponible.
   */
  private cargarImagen(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`No se pudo cargar la imagen: ${src}`));
      img.src = src;
    });
  }

  /** Normaliza el título para usarlo en el nombre del archivo */
  private slug(texto: string): string {
    const base = texto.trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
    return (base || 'plano').slice(0, 60);
  }
  /**
   * Genera un PDF con el mapa actual: encabezado con logo institucional,
   * título centrado, fecha/hora de impresión, marco del mapa y pie de página.
   */
  async generarPdf(): Promise<void> {
    if (this.generando()) return;
    this.generando.set(true);
    this.error.set(null);
    this.fechaHora.set(this.formatearFecha(new Date()));
    try {
      const imagenMapa = await this.capturarMapa();

      const horizontal = this.orientacion() === 'horizontal';
      const pdf = new jsPDF({
        orientation: horizontal ? 'landscape' : 'portrait',
        unit: 'mm',
        format: this.formato(),
      });
      const ancho = pdf.internal.pageSize.getWidth();
      const alto = pdf.internal.pageSize.getHeight();
      const margen = 10;

      // --- Logo institucional ---
      let logoAlto = 0;
      try {
        const logo = await this.cargarImagen(LOGO_SRC);
        logoAlto = 16;
        const logoAncho = (logo.width / logo.height) * logoAlto;
        pdf.addImage(logo, 'PNG', margen, margen - 4, logoAncho, logoAlto);
      } catch {
        // Si el logo no está disponible continuamos sin él
      }

      // --- Título centrado ---
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.setTextColor(...COLOR_INSTITUCIONAL);
      pdf.text(this.titulo(), ancho / 2, margen + 3, { align: 'center' });

      // --- Subtítulo institucional y fecha/hora ---
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.5);
      pdf.setTextColor(90, 90, 90);
      pdf.text('Municipalidad de San Isidro · Visor Cartográfico Catastral', ancho / 2, margen + 8.5, { align: 'center' });
      pdf.text(`Fecha de impresión: ${this.fechaHora()}`, ancho / 2, margen + 13, { align: 'center' });

      // --- Línea separadora ---
      const yLinea = margen + 16;
      pdf.setDrawColor(...COLOR_VERDE);
      pdf.setLineWidth(0.6);
      pdf.line(margen, yLinea, ancho - margen, yLinea);

      // --- Mapa ajustado al área disponible (contain) ---
      const areaY = yLinea + 5;
      const altoPie = 10;
      const areaW = ancho - margen * 2;
      const areaH = alto - areaY - altoPie;

      const escala = Math.min(areaW / this.mapaAnchoPx, areaH / this.mapaAltoPx);
      const mapaW = this.mapaAnchoPx * escala;
      const mapaH = this.mapaAltoPx * escala;
      const mapaX = margen + (areaW - mapaW) / 2;
      const mapaY = areaY + (areaH - mapaH) / 2;
      pdf.addImage(imagenMapa, 'JPEG', mapaX, mapaY, mapaW, mapaH);

      // Marco alrededor del mapa
      pdf.setDrawColor(...COLOR_INSTITUCIONAL);
      pdf.setLineWidth(0.35);
      pdf.rect(mapaX - 1, mapaY - 1, mapaW + 2, mapaH + 2);

      // --- Pie de página ---
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.5);
      pdf.setTextColor(80, 80, 80);
      pdf.text('Subgerencia de Planeamiento Urbano y Catastro', margen, alto - 6);
      pdf.text(`Impreso: ${this.fechaHora()}`, ancho - margen, alto - 6, { align: 'right' });

      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      pdf.save(`${this.slug(this.titulo())}_${stamp}.pdf`);
    } catch (err) {
      console.error('Error generando PDF:', err);
      this.error.set(err instanceof Error ? err.message : 'No se pudo generar el PDF.');
    } finally {
      this.generando.set(false);
    }
  }

  /**
   * Envía la vista actual a la impresora usando una hoja dedicada
   * (título, logo, fecha/hora y mapa), sin bloquear el resto del visor.
   */
  async enviarAImpresora(): Promise<void> {
    if (this.generando()) return;
    this.generando.set(true);
    this.error.set(null);
    this.fechaHora.set(this.formatearFecha(new Date()));
    try {
      this.imagenMapa.set(await this.capturarMapa());

      // Definimos tamaño/orientación de la hoja de impresión
      this.estiloPagina?.remove();
      this.estiloPagina = document.createElement('style');
      this.estiloPagina.id = 'msi-print-page-style';
      this.estiloPagina.textContent =
        `@page { size: ${this.formato()} ${this.orientacion() === 'horizontal' ? 'landscape' : 'portrait'}; margin: 8mm; }`;
      document.head.appendChild(this.estiloPagina);

      // Esperamos a que la imagen del mapa se pinte antes de abrir el diálogo
      setTimeout(() => window.print(), 250);
    } catch (err) {
      console.error('Error preparando la impresión:', err);
      this.error.set(err instanceof Error ? err.message : 'No se pudo preparar la impresión.');
      this.generando.set(false);
    }
  }
}
