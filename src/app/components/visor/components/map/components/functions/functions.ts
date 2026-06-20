import { Component, computed, inject, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OverviewMapComponent } from '../overViewMap/overview-map';

import { MapService } from '../../../../../../services/map.service';
import { ANIMATION_DURATION, ZOOM_LEVEL_LOCATION, SAN_ISIDRO_ZOOM } from '../../../../../../interfaces/map.constants';
import { fromLonLat, Overlay, OverlayPositioning, transformExtent } from '../../../../../../modules/openlayers.module';

@Component({
  selector: 'app-functions',
  standalone: true,
  imports: [CommonModule, OverviewMapComponent],
  templateUrl: './functions.html',
  styleUrls: ['./functions.css'],
})
export class Funciones {
  private readonly mapService = inject(MapService);

  /**
   * Referencias a los elementos del DOM definidos localmente en functions.html
   */
  @ViewChild('userMarker') userMarkerEl!: ElementRef;
  @ViewChild('locationPopup') locationPopupEl!: ElementRef;
  @ViewChild('sanIsidroMarker') sanIsidroMarkerEl!: ElementRef;
  @ViewChild('sanIsidroPopup') sanIsidroPopupEl!: ElementRef;

  /** Overlay para mostrar la ubicación actual del usuario */
  private locationOverlay?: Overlay;
  /** Overlay para mostrar un popup con información de la ubicación */
  private popupOverlay?: Overlay;
  /** Overlay para mostrar el marcador de San Isidro */
  private sanIsidroOverlay?: Overlay;
  /** Overlay para mostrar el popup de San Isidro */
  private sanIsidroPopupOverlay?: Overlay;

  /** Sincronización con el estado del mapa en el servicio */
  olMap = this.mapService.map;
  isReady = computed(() => !!this.olMap());
  baseLayerType = this.mapService.baseLayerType;
  /** Signal con las coordenadas actuales obtenidas por GPS */
  userCoords = this.mapService.userCoords;

  zoomIn(): void {
    this.adjustZoom(1);
  }
  zoomOut(): void {
    this.adjustZoom(-1);
  }
  goHome(): void {
    const view = this.olMap()?.getView();
    if (view) {
      // BBOX proporcionado de la capa vw_tg_lote en EPSG:32718
      // [minX, minY, maxX, maxY]
      const extent32718 = [275424.08, 8660213.79, 281757.72, 8663299.55];
      
      // Transformamos la extensión al sistema de referencia de la vista (normalmente EPSG:3857)
      const transformedExtent = transformExtent(extent32718, 'EPSG:32718', view.getProjection());
      
      // Ajustamos la vista para encuadrar perfectamente la extensión de los lotes
      // El padding [20, 20, 20, 20] asegura que no toque los bordes del visor
      view.fit(transformedExtent, { duration: ANIMATION_DURATION / 2, padding: [20, 20, 20, 20] });
    }
  }

  goToSanIsidro(): void {
    // Coordenadas solicitadas por el usuario (Jirón Augusto Tamayo): lat, lon
    const lat = -12.09746407;
    const lon = -77.02910466;

    // Eliminamos definitivamente el servicio de departamentos al enfocarnos en el distrito
    this.mapService.removeLayerById('ig_departamento');

    if (!this.sanIsidroMarkerEl?.nativeElement || !this.sanIsidroPopupEl?.nativeElement) {
      console.warn('Los elementos de San Isidro no están inicializados.');
      this.mapService.goToCoordinates(lat, lon, SAN_ISIDRO_ZOOM, 1800);
      return;
    }

    const markerElement = this.sanIsidroMarkerEl.nativeElement;
    const popupElement = this.sanIsidroPopupEl.nativeElement;
    // Calcular la posición desplazada 200m a la derecha usando el servicio
    const [shiftedLon, shiftedLat] = this.mapService.offsetLonLat(lon, lat, 200, 0);
    const transformedCoords = fromLonLat([shiftedLon, shiftedLat]);

    this.updateSanIsidroOverlay(transformedCoords, markerElement);
    this.hideSanIsidroPopup();

    this.mapService.goToCoordinates(shiftedLat, shiftedLon, SAN_ISIDRO_ZOOM, 1800, (complete) => {
      if (complete) this.showSanIsidroPopup(transformedCoords, popupElement);
    });
  }

  /**
   * Realiza una animación de cambio de zoom relativa al valor actual.
   */
  private adjustZoom(delta: number): void {
    const view = this.olMap()?.getView();
    const currentZoom = view?.getZoom();
    if (view && currentZoom !== undefined) {
      view.animate({ zoom: currentZoom + delta, duration: 250 });
    }
  }

  toggleBaseLayer(): void {
    const map = this.olMap();
    const satLayer = this.mapService.satelliteLayer;
    const streetLayer = this.mapService.streetsLayer;
    if (!map || !satLayer || !streetLayer) return;

    const newType = this.baseLayerType() === 'satellite' ? 'streets' : 'satellite';
    this.baseLayerType.set(newType);

    satLayer.setVisible(newType === 'satellite');
    streetLayer.setVisible(newType === 'streets');
  }

  getCurrentLocation(): void {
    if (!this.userMarkerEl?.nativeElement || !this.locationPopupEl?.nativeElement) {
      console.warn('Los elementos de ubicación no están inicializados.');
      return;
    }

    const markerElement = this.userMarkerEl.nativeElement;
    const popupElement = this.locationPopupEl.nativeElement;

    if (!('geolocation' in navigator)) {
      alert('La geolocalización no está disponible en su navegador.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const result = { lon: position.coords.longitude, lat: position.coords.latitude };
        const transformedCoords = fromLonLat([result.lon, result.lat]);

        // 1. Marcamos el punto azul inmediatamente
        this.updateUserLocationOverlay(transformedCoords, markerElement);
        this.userCoords.set(result);

        // 2. Animamos el mapa
        this.olMap()?.getView().animate({
          center: transformedCoords,
          zoom: ZOOM_LEVEL_LOCATION,
          duration: ANIMATION_DURATION
        }, (complete) => {
          // 3. Mostramos el popup al finalizar el viaje
          if (complete) {
            this.showLocationPopup(transformedCoords, popupElement);
          }
        });
      },
      (error) => {
        console.error('Error al obtener ubicación:', error);
        alert('No se pudo obtener su ubicación actual.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  /**
   * Actualiza la posición del overlay del marcador de usuario.
   */
  private updateUserLocationOverlay(transformedCoords: number[], element: HTMLElement): void {
    this.locationOverlay = this.getOrCreateOverlay(this.locationOverlay, element, {
      positioning: 'center-center'
    });
    element.style.display = 'flex';
    this.locationOverlay.setPosition(transformedCoords);
  }

  /**
   * Muestra un popup en la ubicación especificada.
   */
  private showLocationPopup(transformedCoords: number[], element: HTMLElement): void {
    this.popupOverlay = this.getOrCreateOverlay(this.popupOverlay, element, {
      positioning: 'bottom-center',
      stopEvent: true,
      offset: [0, -32]
    });
    element.style.display = 'block';
    this.popupOverlay.setPosition(transformedCoords);
  }

  private updateSanIsidroOverlay(transformedCoords: number[], element: HTMLElement): void {
    this.sanIsidroOverlay = this.getOrCreateOverlay(this.sanIsidroOverlay, element, {
      positioning: 'center-center'
    });
    element.style.display = 'flex';
    this.sanIsidroOverlay.setPosition(transformedCoords);
  }

  private showSanIsidroPopup(transformedCoords: number[], element: HTMLElement): void {
    this.sanIsidroPopupOverlay = this.getOrCreateOverlay(this.sanIsidroPopupOverlay, element, {
      positioning: 'bottom-center',
      stopEvent: true,
      offset: [0, -32]
    });
    element.style.display = 'block';
    this.sanIsidroPopupOverlay.setPosition(transformedCoords);
  }

  hideSanIsidroPopup(): void {
    this.sanIsidroPopupOverlay?.setPosition(undefined);
    const element = this.sanIsidroPopupOverlay?.getElement();
    if (element instanceof HTMLElement) {
      element.style.display = 'none';
    }
  }

  removeSanIsidroMarker(): void {
    this.sanIsidroOverlay?.setPosition(undefined);
    const element = this.sanIsidroOverlay?.getElement();
    if (element instanceof HTMLElement) {
      element.style.display = 'none';
    }
    this.hideSanIsidroPopup();
  }

  /**
   * Obtiene un overlay existente o crea uno nuevo si no existe.
   */
  private getOrCreateOverlay(
    overlayRef: Overlay | undefined,
    element: HTMLElement,
    options: { positioning: OverlayPositioning; offset?: number[]; stopEvent?: boolean }
  ): Overlay {
    if (overlayRef) {
      overlayRef.setElement(element);
      return overlayRef;
    }
    const map = this.olMap();
    if (!map) throw new Error("Mapa no inicializado");

    const newOverlay = new Overlay({
      element,
      positioning: options.positioning,
      offset: options.offset || [0, 0],
      stopEvent: options.stopEvent ?? false,
    });

    map.addOverlay(newOverlay);
    return newOverlay;
  }

  /**
   * Oculta el marcador y el popup y resetea las coordenadas del usuario.
   */
  removeLocationMarker(): void {
    this.locationOverlay?.setPosition(undefined);
    this.popupOverlay?.setPosition(undefined);
    const marker = this.locationOverlay?.getElement();
    const popup = this.popupOverlay?.getElement();
    if (marker) marker.style.display = 'none';
    if (popup) popup.style.display = 'none';
    this.userCoords.set(null);
  }


    isMapBasePanelOpen(): boolean {
    return this.mapService.activeSidebarTools().has('mapbase');
  }





}

