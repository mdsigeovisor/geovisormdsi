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

  closePanel() {
    console.log('Leyenda: Emitiendo evento onClose');
    this.onClose.emit();
  }

  private mapService = inject(MapService);
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
