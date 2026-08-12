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
  private readonly locationPopupOverlay?: Overlay;

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
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { longitude, latitude } = position.coords;
          this.mapService.userCoords.set({ lon: longitude, lat: latitude });
          this.mapService.goToCoordinates(latitude, longitude, 18);
          this.showUserMarker(longitude, latitude);
        },
        (error) => {
          console.error('Error al obtener la geolocalización:', error);
          alert('No se pudo obtener tu ubicación. Asegúrate de haber concedido los permisos necesarios.');
        }
      );
    } else {
      alert('La geolocalización no es compatible con este navegador.');
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

  private showUserMarker(lon: number, lat: number): void {
    const map = this.olMap();
    if (!map) return;

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
  }

  removeLocationMarker(): void {
    this.userMarkerOverlay?.setPosition(undefined);
    this.locationPopupOverlay?.setPosition(undefined);
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
