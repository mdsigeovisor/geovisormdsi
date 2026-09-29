import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MapService } from '@app/services/map.service';
import { capasConSimbologiaVisible } from '@interfaces/geoLayers';

/**
 * Ventana flotante de la Leyenda sobre el mapa.
 * A diferencia de antes, el componente SIEMPRE está montado en el DOM: su
 * visibilidad vive en la señal `leyendaVisible` del MapService y se aplica
 * como clase `.abierto` sobre `.panel-flotante` (ver leyenda.css), con la
 * misma transición (fundido + desplazamiento + escala) del panel flotante
 * del sidebar. Así aparece y desaparece con animación en ambos sentidos.
 */
@Component({
  selector: 'app-leyenda',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './leyenda.html',
  styleUrl: './leyenda.css',
})
export class Leyenda {
  public readonly mapService = inject(MapService);
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

  /** Cierra la ventana (botón X): apaga `leyendaVisible` y el CSS anima la salida */
  closePanel(): void {
    this.mapService.closeLeyenda();
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
  /**
   * Simbologías que se muestran en la ventana. El filtro de qué capas cuentan
   * (visible + `showInLegend` + con imagen generada) vive en
   * `capasConSimbologiaVisible`, compartida con el `MapService`: el mismo
   * criterio decide el contenido del panel y si la ventana debe abrirse u
   * ocultarse sola. La URL es la clave, porque una capa compuesta aporta varias
   * imágenes y distintas capas pueden compartir la misma.
   */
  activeLegends = computed(() => {
    const uniqueLegends = new Map<string, { label: string; url: string }>();
    for (const layer of capasConSimbologiaVisible(this.mapService.panelSections())) {
      // Una capa puede aportar varias leyendas (capas compuestas: p. ej. los
      // polígonos de zonificación y sus límites); `legendUrl` es la primera.
      const urls = layer.legendUrls?.length ? layer.legendUrls : layer.legendUrl ? [layer.legendUrl] : [];
      for (const url of urls) {
        // Se usa la URL como clave: evita repetir la misma imagen si varias
        // capas comparten simbología.
        if (!uniqueLegends.has(url)) {
          uniqueLegends.set(url, { label: layer.label, url });
        }
      }
    }
    return Array.from(uniqueLegends.values());
  });
}

