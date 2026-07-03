import { Component, inject, computed, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MapService } from '../../../../../../../../services/map.service';

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
    const sections = this.mapService.sections();
    const legends: { label: string; url: string }[] = [];

    sections.forEach(section => {
      section.items.forEach(item => {
        // Usamos 'layers' in item para identificar SubSections
        const layers = 'layers' in item ? item.layers : (item.type === 'layer' ? [item] : []);
        
        for (const layer of layers) {
          if (layer.visible && layer.legendUrl) {
            legends.push({ label: layer.label, url: layer.legendUrl });
          }
        }
      });
    });

    return legends;
  });
}
