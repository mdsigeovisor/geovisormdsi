import { Component, ElementRef, NgZone, ViewChild, afterNextRender, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MapService, TipoMapaBase } from '../../../../../../services/map.service';
import { DrawMeasureService } from '../../../../../../services/draw.service';
import { fromLonLat, Overlay } from '../../../../../../modules/openlayers.module';
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
  private readonly zone = inject(NgZone);

  // Signals para controlar el estado de la UI
  public readonly isReady = this.mapService.isReady;
  public readonly olMap = this.mapService.map;
  public readonly userCoords = this.mapService.userCoords;
  public readonly baseLayerType = this.mapService.baseLayerType;
  public readonly isMapBasePanelOpen = signal(false);
  public readonly herramientasActivas = signal(false);

  private userMarkerOverlay?: Overlay;
  private locationPopupOverlay?: Overlay;
  /** Indica que hay una petición de ubicación en curso (bloquea el botón). */
  public readonly ubicacionCargando = signal(false);
  /** Id del seguimiento continuo de la ubicación (navigator.geolocation.watchPosition). */
  private watchUbicacionId: number | null = null;

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

  /**
   * "Mi Ubicación": solicita la posición al navegador, vuela hasta ella y
   * ancla el marcador azul con su popup de coordenadas.
   *
   * Consideraciones que evitan los fallos silenciosos:
   *  - `getCurrentPosition` solo responde dentro de un contexto seguro
   *    (HTTPS o localhost); en HTTP el navegador deniega siempre, así que se
   *    avisa explícitamente en vez de quedarse esperando.
   *  - `timeout` garantiza respuesta aunque el servicio de ubicación del
   *    equipo esté apagado (antes podía quedarse sin marcador ni mensaje).
   *  - `maximumAge: 0` fuerza una posición reciente (con `maximumAge: 60000`
   *    podía devolver una lectura antigua y ubicar mal al usuario).
   *  - mientras hay una petición en curso el botón queda bloqueado
   *    (`ubicacionCargando`), evitando peticiones simultáneas.
   */
  getCurrentLocation(): void {
    if (!navigator.geolocation) {
      alert('La geolocalización no es compatible con este navegador.');
      return;
    }
    if (!window.isSecureContext) {
      alert('El navegador bloquea la ubicación porque la página no se sirve por HTTPS. Acceda al geovisor mediante https:// (o desde localhost) y vuelva a intentarlo.');
      return;
    }
    if (this.ubicacionCargando()) return; // Ya hay una petición en curso
    this.ubicacionCargando.set(true);
    console.debug('[GPS] Solicitando ubicación al navegador...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { longitude, latitude, accuracy } = position.coords;
        console.debug(`[GPS] Posición obtenida: ${longitude}, ${latitude} (±${Math.round(accuracy)} m)`);
        // Los callbacks de geolocalización no pasan por Angular: entramos a la
        // zona para que los signals y el marcador se pinten de inmediato.
        this.zone.run(() => {
          this.ubicacionCargando.set(false);
          this.mapService.userCoords.set({ lon: longitude, lat: latitude });
          this.mapService.goToCoordinates(latitude, longitude, 18);
          this.showUserMarker(longitude, latitude);
          this.iniciarSeguimientoUbicacion();
        });
      },
      (error) => {
        console.error('[GPS] Error de geolocalización:', error);
        const motivos: Record<number, string> = {
          1: 'Permiso denegado. Habilite la ubicación para este sitio (icono de candado en la barra de direcciones) y vuelva a intentarlo.',
          2: 'Posición no disponible. Verifique que el servicio de ubicación del equipo (Windows) esté activado.',
          3: 'Tiempo de espera agotado (12 s) al intentar obtener la ubicación.',
        };
        this.zone.run(() => {
          this.ubicacionCargando.set(false);
          alert(`No se pudo obtener tu ubicación. ${motivos[error.code] ?? error.message}`);
        });
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  }

  /**
   * Mantiene el marcador sincronizado con la ubicación real. OpenLayers no
   * actualiza el punto por sí solo, por lo que escuchamos `watchPosition`
   * mientras el marcador esté visible (se detiene al eliminarlo). No movemos
   * el mapa en cada lectura: solo se reposiciona el marcador para no pelear
   * con la vista que el usuario eligió.
   */
  private iniciarSeguimientoUbicacion(): void {
    if (this.watchUbicacionId !== null || !navigator.geolocation?.watchPosition) return;
    this.watchUbicacionId = navigator.geolocation.watchPosition(
      (position) => {
        const { longitude, latitude } = position.coords;
        this.zone.run(() => {
          this.mapService.userCoords.set({ lon: longitude, lat: latitude });
          this.showUserMarker(longitude, latitude);
        });
      },
      // Silencioso: el seguimiento no debe interrumpir con alertas repetidas.
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
    );
  }

  /** Detiene el seguimiento continuo de la ubicación. */
  private detenerSeguimientoUbicacion(): void {
    if (this.watchUbicacionId !== null) {
      navigator.geolocation?.clearWatch?.(this.watchUbicacionId);
      this.watchUbicacionId = null;
    }
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

  /**
   * Ancla el marcador y el popup del usuario en el mapa.
   *
   * Aviso importante de proyección: `Overlay.setPosition` espera la coordenada
   * en la proyección de la VISTA (aquí EPSG:3857), no en grados. Antes se le
   * pasaba `offsetLonLat`, que devuelve [lon, lat] en EPSG:4326; esos grados se
   * interpretaban como metros y el marcador quedaba a millones de píxeles del
   * lienzo (por eso "Mi Ubicación" no mostraba nada).
   */
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
    // Coordenada del punto en la proyección del mapa (EPSG:3857 por defecto).
    const posicion = fromLonLat([lon, lat], map.getView().getProjection());

    if (!this.userMarkerOverlay) {
      this.userMarkerOverlay = new Overlay({
        element: this.userMarker.nativeElement,
        positioning: 'center-center',
        stopEvent: false,
      });
      map.addOverlay(this.userMarkerOverlay);
    }
    this.userMarker.nativeElement.style.display = 'flex';
    this.userMarkerOverlay.setPosition(posicion);

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
    this.locationPopupOverlay.setPosition(posicion);
  }

  /** Elimina el marcador de ubicación, su popup y detiene el seguimiento GPS. */
  removeLocationMarker(): void {
    this.detenerSeguimientoUbicacion();
    this.userMarkerOverlay?.setPosition(undefined);
    this.locationPopupOverlay?.setPosition(undefined);
    // OL oculta el overlay al quitar la posición; forzamos también el display
    // inline para dejar el estado inicial consistente.
    if (this.userMarker?.nativeElement) this.userMarker.nativeElement.style.display = 'none';
    if (this.locationPopup?.nativeElement) this.locationPopup.nativeElement.style.display = 'none';
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
