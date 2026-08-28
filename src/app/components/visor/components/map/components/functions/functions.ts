import { Component, ElementRef, ViewChild, afterNextRender, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MapService, TipoMapaBase } from '../../../../../../services/map.service';
import { DrawMeasureService } from '../../../../../../services/draw.service';
import { Overlay } from '../../../../../../modules/openlayers.module';
import { OverviewMapComponent } from '../overViewMap/overview-map';

@Component({
  selector: 'app-funciones',
  standalone: true,
  imports: [CommonModule,OverviewMapComponent],
  templateUrl: './functions.html',
  styleUrl: './functions.css'
})
export class Funciones {
  @ViewChild('userMarker') userMarker!: ElementRef;
  @ViewChild('locationPopup') locationPopup!: ElementRef;
  @ViewChild('searchMarker') searchMarker!: ElementRef;

  private readonly mapService = inject(MapService);
  private readonly drawMeasureService = inject(DrawMeasureService);

  // Signals para controlar el estado de la UI
  public readonly isReady = this.mapService.isReady;
  public readonly olMap = this.mapService.map;
  public readonly userCoords = this.mapService.userCoords;
  public readonly baseLayerType = this.mapService.baseLayerType;
  public readonly isMapBasePanelOpen = signal(false);
  public readonly herramientasActivas = signal(false);

  private userMarkerOverlay?: Overlay;
  private locationPopupOverlay?: Overlay;

  constructor() {
    afterNextRender(() => {
      this.mapService.registerSearchMarkerElement(this.searchMarker.nativeElement);
    });
  }

  zoomIn(): void {
    this.olMap()?.getView().animate({
      zoom: this.olMap()!.getView().getZoom()! + 1,
      duration: 250
    });
  }

  zoomOut(): void {
    this.olMap()?.getView().animate({
      zoom: this.olMap()!.getView().getZoom()! - 1,
      duration: 250
    });
  }

  goHome(): void {
    this.mapService.goToDistrito();
  }

  getCurrentLocation(): void {
    if (!navigator.geolocation) {
      alert('La geolocalización no es compatible con este navegador.');
      return;
    }
    console.debug('[GPS] Solicitando ubicación al navegador...');
    // Sin `timeout` el navegador puede esperar indefinidamente (ni marcador,
    // ni popup, ni error) cuando el servicio de ubicación del equipo está
    // apagado. Con 10s garantizamos siempre una respuesta visible.
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { longitude, latitude } = position.coords;
        console.debug('[GPS] Posición obtenida:', longitude, latitude);
        this.mapService.userCoords.set({ lon: longitude, lat: latitude });
        this.mapService.goToCoordinates(latitude, longitude, 18);
        this.showUserMarker(longitude, latitude);
      },
      (error) => {
        console.error('[GPS] Error de geolocalización:', error);
        const motivos: Record<number, string> = {
          1: 'Permiso denegado. Habilite la ubicación para este sitio (icono de candado en la barra de direcciones) y vuelva a intentarlo.',
          2: 'Posición no disponible. Verifique que el servicio de ubicación del equipo (Windows) esté activado.',
          3: 'Tiempo de espera agotado (10 s) al intentar obtener la ubicación.',
        };
        alert(`No se pudo obtener tu ubicación. ${motivos[error.code] ?? error.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  toggleBaseLayer(): void {
    const currentType = this.baseLayerType();
    let nextType: TipoMapaBase;
    if (currentType === 'satellite') {
      nextType = 'streets';
    } else if (currentType === 'streets') {
      nextType = 'blanco';
    } else {
      nextType = 'satellite';
    }
    this.mapService.cambiarMapaBase(nextType);
  }

  private showUserMarker(lon: number, lat: number): void {
    const map = this.olMap();
    if (!map) {
      console.error('[GPS] El mapa aún no está inicializado; no se puede anclar el marcador.');
      return;
    }
    // Guardia defensiva: si el elemento no está en la plantilla, el overlay
    // quedaría huérfano y el popup jamás sería visible (falla silenciosa).
    if (!this.userMarker?.nativeElement || !this.locationPopup?.nativeElement) {
      console.error('[GPS] No se encontraron los elementos #userMarker/#locationPopup en la plantilla.');
      return;
    }

    if (!this.userMarkerOverlay) {
      this.userMarkerOverlay = new Overlay({
        element: this.userMarker.nativeElement,
        positioning: 'center-center',
        stopEvent: false,
      });
      map.addOverlay(this.userMarkerOverlay);
    }
    this.userMarker.nativeElement.style.display = 'flex';
    this.userMarkerOverlay.setPosition(this.mapService.offsetLonLat(lon, lat));

    // Popup informativo anclado sobre el marcador: sin este overlay el div
    // #locationPopup permanece oculto (display:none) para siempre.
    if (!this.locationPopupOverlay) {
      this.locationPopupOverlay = new Overlay({
        element: this.locationPopup.nativeElement,
        // El caret inferior del popup apunta al punto: anclamos su borde inferior.
        positioning: 'bottom-center',
        // Lo elevamos por encima del marcador (h-10 = 40px, centro en la coords).
        offset: [0, -28],
        // Evita que los clicks dentro del popup lleguen al mapa (interacciones/dibujo).
        stopEvent: true,
      });
      map.addOverlay(this.locationPopupOverlay);
    }
    this.locationPopup.nativeElement.style.display = 'block';
    this.locationPopupOverlay.setPosition(this.mapService.offsetLonLat(lon, lat));
  }

  removeLocationMarker(): void {
    this.userMarkerOverlay?.setPosition(undefined);
    this.locationPopupOverlay?.setPosition(undefined);
    // OL oculta el overlay al quitar la posición; forzamos también el display
    // inline para dejar el estado inicial consistente.
    this.locationPopup.nativeElement.style.display = 'none';
    this.mapService.userCoords.set(null);
  }

  // --- Métodos para Dibujo y Medición ---

  
  toggleHerramientas(): void {
    this.herramientasActivas.update(v => !v);
    if (!this.herramientasActivas()) {
      this.drawMeasureService.desactivarHerramienta();
    }
  }

  medirDistancia(): void {
    this.drawMeasureService.medirDistancia();
  }

  medirArea(): void {
    this.drawMeasureService.medirArea();
  }

  dibujarPunto(): void { this.drawMeasureService.dibujarPunto(); }
  dibujarLinea(): void { this.drawMeasureService.dibujarLinea(); }
  dibujarPoligono(): void { this.drawMeasureService.dibujarPoligono(); }

  limpiarDibujo(): void {
    this.drawMeasureService.limpiar();
  }
}
