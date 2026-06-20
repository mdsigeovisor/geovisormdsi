import { Component, signal, output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MapService } from '../../../.././../../../../services/map.service';

@Component({
  selector: 'app-capas',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './capas.html',
  styleUrl: './capas.css',
})
export class CapasComponent {
  onClose = output<void>();
  private readonly mapService = inject(MapService);
  /** Estado de minimización del panel */
  isMinimized = signal(false);
  /** Referencia al signal de secciones centralizado en el servicio */
  sections = this.mapService.sections;
  toggleMinimize() {
    this.isMinimized.update(v => !v);
  }

  toggleSectionExpanded(sectionId: string) {
    this.mapService.toggleSectionExpanded(sectionId);
  }

  toggleLayerVisibility(sectionId: string, layerId: string) {
    this.mapService.toggleLayerVisibility(sectionId, layerId);
  }

  toggleAllLayersInSection(sectionId: string, visible: boolean) {
    this.mapService.toggleAllLayersInSection(sectionId, visible);
  }

  onOpacityChange(sectionId: string, layerId: string, event: Event): void {
    const target = event.target as HTMLInputElement;
    const newOpacity = Number(target.value) / 100;
    this.sections.update(currentSections =>
      currentSections.map(section =>
        section.id === sectionId ? {
          ...section,
          layers: section.layers.map(layer =>
            layer.id === layerId ? { ...layer, opacity: newOpacity } : layer
          )
        } : section
      )
    );
  }
}
