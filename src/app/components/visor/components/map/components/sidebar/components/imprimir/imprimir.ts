import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MapService } from '@app/services/map.service';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

@Component({
  selector: 'app-imprimir',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './imprimir.html',
  styleUrl: './imprimir.css',
})
export class Imprimir {
  private readonly mapService = inject(MapService);

  // Señales para gestionar el estado de la UI de impresión
  formato = signal<'A4' | 'A3' | 'A2'>('A4');
  resolucion = signal<72 | 150 | 300>(150);
  imprimiendo = signal(false);

  /**
   * Actualiza la señal de resolución, asegurando la conversión de tipo correcta.
   */
  setResolucion(value: string): void {
    this.resolucion.set(Number(value) as 72 | 150 | 300);
  }

  /**
   * Inicia el proceso de impresión del mapa.
   */
  async imprimirMapa(): Promise<void> {
    const map = this.mapService.map();
    if (!map || this.imprimiendo()) return;

    this.imprimiendo.set(true);
    const format = this.formato();
    const dpi = this.resolucion();

    const dims: { [key: string]: { w: number; h: number } } = {
      A4: { w: 297, h: 210 },
      A3: { w: 420, h: 297 },
      A2: { w: 594, h: 420 },
    };

    const dim = dims[format];
    const targetWidth = Math.max(1, Math.round((dim.w / 25.4) * dpi));
    const targetHeight = Math.max(1, Math.round((dim.h / 25.4) * dpi));

    try {
      const viewResolution = map.getView().getResolution();
      if (!viewResolution) {
        return;
      }

      map.updateSize();
      map.renderSync();

      await new Promise<void>((resolve) => {
        const handleRender = () => {
          map.un('rendercomplete', handleRender);
          requestAnimationFrame(() => resolve());
        };

        map.once('rendercomplete', handleRender);
        setTimeout(() => {
          map.un('rendercomplete', handleRender);
          resolve();
        }, 1000);
      });

      const sourceElement = map.getTargetElement() as HTMLElement | null;
      const captureTarget = sourceElement?.querySelector('.ol-viewport') as HTMLElement | null;

      if (!captureTarget) {
        return;
      }

      const canvas = await html2canvas(captureTarget, {
        useCORS: true,
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: format.toLowerCase(),
      });

      const exportWidth = Math.min(canvas.width, targetWidth);
      const exportHeight = Math.min(canvas.height, targetHeight);
      const ratio = Math.min(dim.w / exportWidth, dim.h / exportHeight);
      const widthMm = exportWidth * ratio;
      const heightMm = exportHeight * ratio;

      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, widthMm, heightMm);
      pdf.save(`mapa_${format}.pdf`);
    } catch (error) {
      console.error('No se pudo generar el PDF del mapa', error);
    } finally {
      map.updateSize();
      this.imprimiendo.set(false);
    }
  }
}
