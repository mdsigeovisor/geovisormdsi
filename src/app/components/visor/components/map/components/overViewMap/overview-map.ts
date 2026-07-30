import { Component, Input, ElementRef, ViewChild, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OlMap, OverviewMap, View, TileLayer, XYZ } from '../../../../../../modules/openlayers.module';
import { OSM_URL } from '../../../../../../interfaces/mapas.config';

/**
 * Componente para integrar el control OverviewMap de OpenLayers.
 * Muestra un pequeño mapa de contexto que indica la extensión actual del mapa principal.
 */
@Component({
  selector: 'app-overview-map',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './overview-map.html',
  styleUrl: './overview-map.css',
})
export class OverviewMapComponent implements OnDestroy, AfterViewInit {
  /**
   * La instancia del mapa principal de OpenLayers a la que se adjuntará el control OverviewMap.
   * Es un input requerido.
   */
  @Input({ required: true }) mainMap!: OlMap;
  /**
   * Referencia al elemento HTML donde se renderizará el mapa de vista general.
   */
  @ViewChild('overviewMapContainer') overviewMapContainer!: ElementRef;

  private overviewMapControl?: OverviewMap;
  /**
   * Se ejecuta después de que la vista del componente ha sido inicializada.
   */
  ngAfterViewInit(): void {
    this.initOverviewMap();
  }

  /**
   * Inicializa el control OverviewMap y lo añade al mapa principal.
   * Utiliza un TileLayer con OpenStreetMap para el mapa de vista general.
   */
  private initOverviewMap(): void {
  if (!this.mainMap || !this.overviewMapContainer) return;

  const overviewTileLayer = new TileLayer({
    source: new XYZ({ url: OSM_URL }),
  });

  const control = new OverviewMap({
    className: 'ol-overviewmap custom-overview',
    layers: [overviewTileLayer],
    view: new View({
      projection: this.mainMap.getView().getProjection(),
      center: this.mainMap.getView().getCenter(),
      zoom: (this.mainMap.getView().getZoom() || 0) - 4,
    }),
    target: this.overviewMapContainer.nativeElement,
    collapsible: true,
    collapsed: false,
    label: '−',
    collapseLabel: '⤢',
  });

  this.overviewMapControl = control;

  // Escuchador para cambios de estado (Colapsar/Expandir)
  control.on('propertychange' as any, (event: any) => {
    if (event.key === 'collapsed') {
      const ovMap = control.getOverviewMap();
      if (ovMap) {
        setTimeout(() => {
          ovMap.updateSize();
          ovMap.getView().changed();
        }, 350); // Tiempo suficiente para la transición CSS
      }
    }
  });

  this.mainMap.addControl(control);

  // --- SOLUCIÓN PARA EL MAPA PERDIDO AL INICIO ---
  // Forzamos el tamaño inmediatamente después de agregarlo
  const internalMap = control.getOverviewMap();
  if (internalMap) {
    internalMap.updateSize();
    setTimeout(() => {
      internalMap.updateSize();
    }, 100);
  }
}

  /**
   * Limpia el control OverviewMap cuando el componente es destruido para evitar fugas de memoria.
   */
  ngOnDestroy(): void {
    if (this.mainMap && this.overviewMapControl) {
      this.mainMap.removeControl(this.overviewMapControl);
    }
  }
}
