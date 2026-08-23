import { Component, HostListener, signal, inject, effect, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { jsPDF } from 'jspdf';
import { firstValueFrom } from 'rxjs';
import { GeoJSON, getCenter } from '@app/modules/openlayers.module';
import { MapService } from '../../../../../../../../services/map.service';
import { GeoJSONFeature } from '@app/interfaces/geoLayers';

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
  readonly mapService = inject(MapService);

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

  // --- Selección e información del lote ---
  /** Escala del plano: fija (1/500, 1/250) o automática según la vista */
  escala = signal<'auto' | '500' | '250'>('auto');
  /** Propiedades cualitativas del lote seleccionado (WFS vw_tg_lote) */
  datosLote = signal<Record<string, unknown> | null>(null);
  /** Filas [etiqueta, valor] de la tabla cualitativa para el PDF */
  filasTabla = signal<[string, string][]>([]);
  /** Fotografía del lote obtenida de la ficha en línea (DataURL) o null */
  fotoLote = signal<string | null>(null);
  /** Indica si se están cargando los datos del lote */
  cargandoDatos = signal(false);
  /** URL de la ficha completa del lote (enlace en PDF/impresión) */
  fichaUrl = signal<string | null>(null);

  /** Feature crudo del lote seleccionado (para centrar/ajustar la vista) */
  private featureLote: GeoJSONFeature | null = null;

  constructor() {
    // Cuando cambia el lote seleccionado en el mapa, cargamos sus datos
    effect(() => {
      const codigo = this.mapService.loteSeleccionadoCodigo();
      if (codigo) {
        void this.cargarDatosLote(codigo);
      } else {
        this.featureLote = null;
        this.datosLote.set(null);
        this.filasTabla.set([]);
        this.fotoLote.set(null);
        this.fichaUrl.set(null);
      }
    });
  }

  /**
   * Carga los atributos cualitativos del lote (WFS) y su fotografía.
   */
  private async cargarDatosLote(codigo: string): Promise<void> {
    this.cargandoDatos.set(true);
    this.error.set(null);
    try {
      const feature = await firstValueFrom(this.mapService.searchLoteByCodigoCatastral(codigo));
      this.featureLote = feature ?? null;
      const props = (feature?.properties ?? {}) as Record<string, unknown>;
      this.datosLote.set(feature ? props : null);
      this.filasTabla.set(feature ? this.construirFilas(props, codigo) : [['Código Catastral', codigo], ['Estado', 'Sin datos cualitativos disponibles']]);
      this.fichaUrl.set(`http://192.168.41.160/DataGIS_WGS84/WEBFILES/informacion.asp?codigo_i=${codigo}`);
      // La fotografía es opcional: si falla (p. ej. CORS), se usa un enlace en el PDF
      this.fotoLote.set(await this.obtenerFotoLote(codigo));
    } catch {
      this.error.set('No se pudieron cargar los datos del lote.');
    } finally {
      this.cargandoDatos.set(false);
    }
  }

  /**
   * Construye las filas cualitativas de la tabla a partir de los
   * atributos del feature WFS (con fallbacks defensivos).
   */
  private construirFilas(p: Record<string, unknown>, codigo: string): [string, string][] {
    const texto = (clave: string): string => String(p[clave] ?? '').trim();
    const filas: [string, string][] = [
      ['Código Catastral', texto('id_lote') || codigo],
      ['Dirección', texto('direccion') || texto('ubicacion')],
      ['Titular / Propietario', texto('propietario') || 'Información reservada'],
      ['Área de terreno', p['area_lote'] != null && p['area_lote'] !== '' ? `${p['area_lote']} m²` : ''],
      ['Zonificación', texto('zonificacion')],
      ['N° de pisos', p['pisos'] != null && p['pisos'] !== '' ? String(p['pisos']) : ''],
      ['Urb. / Habilitación', texto('urbanizaci') || texto('habilitacion')],
      ['Manzana - Lote urb.', [texto('mzaurb'), texto('loteurb')].filter(Boolean).join(' - ')],
    ];
    return filas.filter(fila => fila[1].length > 0);
  }

  /**
   * Intenta obtener la fotografía del lote desde la ficha ASP.
   * Devuelve null si no está disponible (CORS, red o sin imágenes),
   * en cuyo caso el PDF incluirá un enlace a la ficha en línea.
   */
  private async obtenerFotoLote(codigo: string): Promise<string | null> {
    const urlFicha = this.fichaUrl() ?? `http://192.168.41.160/DataGIS_WGS84/WEBFILES/informacion.asp?codigo_i=${codigo}`;
    try {
      const controlador = new AbortController();
      const timeout = setTimeout(() => controlador.abort(), 6000);
      const respuesta = await fetch(urlFicha, { signal: controlador.signal });
      clearTimeout(timeout);
      if (!respuesta.ok) return null;
      const html = await respuesta.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const imagenes = Array.from(doc.querySelectorAll('img'))
        .map(img => img.getAttribute('src') || '')
        .filter(src => src.length > 0);
      if (imagenes.length === 0) return null;
      // Priorizamos imágenes que parezcan fotografías del predio
      const candidata = imagenes.find(src => /foto|frontis|fachada|\.(jpe?g|png)/i.test(src)) || imagenes[0];
      const urlAbsoluta = new URL(candidata, urlFicha).href;
      const img = await this.cargarImagen(urlAbsoluta);
      this.fotoProporcion = img.naturalWidth / Math.max(img.naturalHeight, 1);
      // Convertimos a DataURL para poder incrustarla en el PDF
      const lienzo = document.createElement('canvas');
      lienzo.width = img.naturalWidth;
      lienzo.height = img.naturalHeight;
      lienzo.getContext('2d')?.drawImage(img, 0, 0);
      return lienzo.toDataURL('image/jpeg', 0.9);
    } catch {
      return null; // CORS/red/sin imagen: el PDF usará el enlace a la ficha
    }
  }

  /**
   * Ajusta la vista antes de capturar:
   * - "Automática": encuadra el lote completo.
   * - Escala fija (1/500 o 1/250): centra el lote y calcula la resolución
   *   equivalente a esa escala de impresión según el ancho del papel.
   */
  private async prepararVista(): Promise<void> {
    const olMap = this.mapService.map();
    if (!olMap || !this.featureLote) return;
    const view = olMap.getView();
    const geometria = new GeoJSON().readGeometry(this.featureLote.geometry, {
      dataProjection: 'EPSG:32718',
      featureProjection: view.getProjection(),
    });
    if (!geometria) return;
    const centro = getCenter(geometria.getExtent());

    const eleccion = this.escala();
    if (eleccion !== 'auto') {
      const horizontal = this.orientacion() === 'horizontal';
      const base = this.formato() === 'a3'
        ? { v: 297, h: 420 }
        : { v: 210, h: 297 };
      const anchoPapelMm = horizontal ? base.h : base.v;
      const anchoMapaMm = anchoPapelMm - 22; // márgenes + marco
      const cssWidth = olMap.getSize()?.[0] ?? 1;
      // denominadorEscala = metrosRealesRepresentados / metrosEnPapel
      const resolucion = (Number(eleccion) * (anchoMapaMm / 1000)) / cssWidth;
      view.setCenter(centro as number[]);
      view.setResolution(resolucion);
    } else {
      view.fit(geometria.getExtent(), { padding: [80, 80, 80, 80], duration: 0 });
    }
    // Esperamos al repintado tras el cambio de vista/resolución
    await new Promise(res => setTimeout(res, 450));
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
      // Ajustamos la vista según la escala elegida antes de capturar
      if (this.mapService.loteSeleccionadoCodigo()) {
        await this.prepararVista();
      }
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
      try {
        const logo = await this.cargarImagen(LOGO_SRC);
        const logoAlto = 16;
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
      pdf.text(`Fecha de impresión: ${this.fechaHora()}   ·   Escala: ${this.etiquetaEscala()}`, ancho / 2, margen + 13, { align: 'center' });

      // --- Línea separadora ---
      const yLinea = margen + 16;
      pdf.setDrawColor(...COLOR_VERDE);
      pdf.setLineWidth(0.6);
      pdf.line(margen, yLinea, ancho - margen, yLinea);

      // --- Distribución del cuerpo ---
      const areaY = yLinea + 4;
      const altoPie = 9;
      const areaW = ancho - margen * 2;
      const areaH = alto - areaY - altoPie;

      const filas = this.filasTabla();
      const tieneTabla = filas.length > 0 && !!this.mapService.loteSeleccionadoCodigo();
      const foto = this.fotoLote();

      if (tieneTabla) {
        // Con lote seleccionado: mapa arriba (62%) y bloque inferior con la
        // tabla cualitativa a la izquierda y la fotografía a la derecha.
        const gapBloques = 4;
        const altoInferior = Math.min(areaH * 0.42, filas.length * 6.2 + 10);
        const mapaH = areaH - altoInferior - gapBloques;

        this.dibujarMapa(pdf, imagenMapa, margen, areaY, areaW, mapaH);
        this.dibujarTabla(pdf, filas, margen, areaY + mapaH + gapBloques, foto ? areaW - 36 : areaW, altoInferior);
        this.dibujarFoto(pdf, foto, margen + areaW - 34, areaY + mapaH + gapBloques, 34, altoInferior);
      } else {
        // Sin lote: el mapa ocupa todo el cuerpo
        this.dibujarMapa(pdf, imagenMapa, margen, areaY, areaW, areaH);
      }

      // --- Pie de página ---
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.5);
      pdf.setTextColor(80, 80, 80);
      pdf.text('Subgerencia de Planeamiento Urbano y Catastro', margen, alto - 5);
      pdf.text(`Impreso: ${this.fechaHora()}`, ancho - margen, alto - 5, { align: 'right' });

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
      // Ajustamos la vista según la escala elegida antes de capturar
      if (this.mapService.loteSeleccionadoCodigo()) {
        await this.prepararVista();
      }
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

  /** Etiqueta legible de la escala elegida */
  private etiquetaEscala(): string {
    switch (this.escala()) {
      case '500': return '1/500';
      case '250': return '1/250';
      default: return 'Automática';
    }
  }

  /** Proporción (ancho/alto) de la última fotografía cargada */
  private fotoProporcion = 4 / 3;

  /**
   * Dibuja la imagen del mapa ajustada (contain) dentro del área dada,
   * centrada y con marco institucional.
   */
  private dibujarMapa(pdf: jsPDF, imagen: string, x: number, y: number, w: number, h: number): void {
    const escala = Math.min(w / this.mapaAnchoPx, h / this.mapaAltoPx);
    const mapaW = this.mapaAnchoPx * escala;
    const mapaH = this.mapaAltoPx * escala;
    const mapaX = x + (w - mapaW) / 2;
    const mapaY = y + (h - mapaH) / 2;
    pdf.addImage(imagen, 'JPEG', mapaX, mapaY, mapaW, mapaH);
    pdf.setDrawColor(...COLOR_INSTITUCIONAL);
    pdf.setLineWidth(0.35);
    pdf.rect(mapaX - 1, mapaY - 1, mapaW + 2, mapaH + 2);
  }

  /**
   * Dibuja la tabla cualitativa del lote con filas alternadas y bordes sutiles.
   */
  private dibujarTabla(pdf: jsPDF, filas: [string, string][], x: number, y: number, w: number, h: number): void {
    const rowH = Math.min(7, Math.max((h - 6) / filas.length, 4.5));
    const colClave = w * 0.36;
    let cursorY = y + 5; // espacio para el título del bloque

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    pdf.setTextColor(...COLOR_INSTITUCIONAL);
    pdf.text('Datos cualitativos del lote', x, y + 2.5);

    filas.forEach((fila, i) => {
      if (i % 2 === 0) {
        pdf.setFillColor(243, 244, 246); // gris muy claro
        pdf.rect(x, cursorY, w, rowH, 'F');
      }
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7);
      pdf.setTextColor(70, 70, 70);
      pdf.text(fila[0], x + 1.5, cursorY + rowH - 1.8);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(20, 20, 20);
      pdf.text(this.truncarTexto(pdf, fila[1], w - colClave - 4), x + colClave, cursorY + rowH - 1.8);
      pdf.setDrawColor(215, 215, 215);
      pdf.setLineWidth(0.12);
      pdf.line(x, cursorY + rowH, x + w, cursorY + rowH);
      cursorY += rowH;
    });
  }

  /** Recorta un texto con elipsis para que quepa en el ancho indicado (mm) */
  private truncarTexto(pdf: jsPDF, texto: string, anchoMm: number): string {
    if (pdf.getTextWidth(texto) <= anchoMm) return texto;
    let t = texto;
    while (t.length > 1 && pdf.getTextWidth(t + '…') > anchoMm) {
      t = t.slice(0, -1);
    }
    return t.trimEnd() + '…';
  }

  /**
   * Dibuja la fotografía del lote (si está disponible) o el enlace a la
   * ficha en línea cuando no lo está.
   */
  private dibujarFoto(pdf: jsPDF, foto: string | null, x: number, y: number, w: number, h: number): void {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    pdf.setTextColor(...COLOR_INSTITUCIONAL);
    pdf.text('Registro fotográfico', x, y + 2.5);

    const fotoY = y + 5;
    const fotoH = h - 5 - (this.fichaUrl() ? 4 : 0);
    if (foto) {
      try {
        const fw = Math.min(w, fotoH * this.fotoProporcion);
        const fh = fw / this.fotoProporcion;
        const fx = x + (w - fw) / 2;
        const fy = fotoY + (fotoH - fh) / 2;
        pdf.addImage(foto, 'JPEG', fx, fy, fw, fh);
        pdf.setDrawColor(...COLOR_INSTITUCIONAL);
        pdf.setLineWidth(0.25);
        pdf.rect(fx, fy, fw, fh);
      } catch {
        // Si falla la incrustación continuamos con el enlace
      }
    } else {
      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(6.8);
      pdf.setTextColor(100, 100, 100);
      pdf.text('Sin fotografía disponible.', x, fotoY + 4);
    }

    if (this.fichaUrl()) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(6.8);
      pdf.setTextColor(20, 60, 160);
      pdf.textWithLink('Ver ficha completa en línea', x, y + h - 1, { url: this.fichaUrl()! });
    }
  }
}
