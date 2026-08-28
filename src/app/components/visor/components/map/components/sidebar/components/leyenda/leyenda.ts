import { Component, inject, computed, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MapService } from '@app/services/map.service';

@Component({
  selector: 'app-leyenda',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './leyenda.html',
  styleUrl: './leyenda.css',
})
export class Leyenda {
  onClose = output<void>();

  private mapService = inject(MapService);
  /** Posición de la ventana flotante (px desde la esquina superior izquierda) */
  x = signal(16);
  y = signal(76);
  /** Estado interno del arrastre de la ventana */
  private dragState: { startX: number; startY: number; originX: number; originY: number } | null = null;

  constructor() {
    // Posición inicial: anclada al borde derecho, bajo la barra superior (w-80 = 320px + 16px de margen)
    this.x.set(Math.max(16, window.innerWidth - 336));
    this.y.set(76);
  }

  closePanel() {
    this.onClose.emit();
  }

  /** Inicia el arrastre de la ventana desde su barra de título. */
  startDrag(event: PointerEvent): void {
    if (event.button !== 0) return;
    event.preventDefault(); // Evita seleccionar texto durante el arrastre
    this.dragState = { startX: event.clientX, startY: event.clientY, originX: this.x(), originY: this.y() };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  /** Arrastra la ventana siguiendo el puntero, sin salir del viewport. */
  drag(event: PointerEvent): void {
    if (!this.dragState) return;
    const nx = this.dragState.originX + (event.clientX - this.dragState.startX);
    const ny = this.dragState.originY + (event.clientY - this.dragState.startY);
    this.x.set(Math.max(0, Math.min(nx, window.innerWidth - 80)));
    this.y.set(Math.max(0, Math.min(ny, window.innerHeight - 60)));
  }

  /** Finaliza el arrastre de la ventana. */
  endDrag(): void {
    this.dragState = null;
  }
  isMinimized = signal(false);  

  toggleMinimize() {
    this.isMinimized.update(v => !v);
  }
  activeLegends = computed(() => {
    const sections = this.mapService.panelSections();
    const uniqueLegends = new Map<string, { label: string; url: string }>();

    sections.forEach(section => {
      section.items.forEach(item => {
        // Usamos 'layers' in item para identificar SubSections
        const layers = 'layers' in item ? item.layers : (item.type === 'layer' ? [item] : []);

        for (const layer of layers) {
          // La capa debe ser visible, tener URL de leyenda y la propiedad showInLegend no debe ser 'false'
          if (layer.visible && layer.legendUrl && layer.showInLegend !== false) {
            // Usamos la URL como clave para asegurar que cada leyenda sea única.
            // Esto evita duplicados si varias capas comparten la misma URL de leyenda.
            if (!uniqueLegends.has(layer.legendUrl)) {
              uniqueLegends.set(layer.legendUrl, { label: layer.label, url: layer.legendUrl });
            }
          }
        }
      });
    });
    return Array.from(uniqueLegends.values());
  });
}
