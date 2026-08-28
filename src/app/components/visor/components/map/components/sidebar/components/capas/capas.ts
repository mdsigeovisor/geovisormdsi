import { Component, signal, output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MapService } from '../../../.././../../../../services/map.service';
import { LayerItemComponent } from './layer-item.component';


@Component({
  selector: 'app-capas',
  standalone: true,
  imports: [CommonModule, LayerItemComponent],
  templateUrl: './capas.html',
  styleUrl: './capas.css',
})
export class CapasComponent {
  onClose = output<void>();
  private readonly mapService = inject(MapService);
  /** Estado de minimización del panel */
  isMinimized = signal(false);
  /** Vista del panel filtrada por sesión (oculta capas con `requiresAuth` si no hay sesión) */
  sections = this.mapService.panelSections;
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

  toggleSubSectionExpanded(sectionId: string, subSectionId: string) {
    // Actualizamos el estado interno completo (panelSections se recalcula solo).
    this.mapService.sections.update(sections =>
      sections.map(section => {
        if (section.id !== sectionId) return section;
        return {
          ...section,
          items: section.items.map(item => {
            if (item.id === subSectionId && item.type === 'subsection') {
              return { ...item, expanded: !item.expanded };
            }
            return item;
          })
        };
      })
    );
  }

  onOpacityChange(sectionId: string, layerId: string, event: Event): void {
    const target = event.target as HTMLInputElement;
    const newOpacity = Number(target.value) / 100;
    this.mapService.setLayerOpacity(sectionId, layerId, newOpacity);
  }
}
