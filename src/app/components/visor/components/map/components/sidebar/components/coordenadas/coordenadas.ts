import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, OnInit, ViewChild, ElementRef, Output, EventEmitter, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Feature, Fill, fromLonLat, Overlay, Point, Stroke, Style, transform, VectorLayer, VectorSource } from '@app/modules/openlayers.module';
import { Coordinate } from 'ol/coordinate';
import CircleStyle from 'ol/style/Circle';
import { MapService } from '@app/services/map.service';
import { ANIMATION_DURATION, SAN_ISIDRO_EXTENT, ZOOM_LEVEL_LOCATION } from '@app/interfaces/mapas.config';




@Component({
  selector: 'app-coordenadas',
  imports: [FormsModule, CommonModule],
  standalone: true,
  templateUrl: './coordenadas.html',
  styleUrl: './coordenadas.css',
})
export class UbicacionCoordenadas implements OnInit, OnDestroy {
  @Output() onClose = new EventEmitter<void>();

  @ViewChild('markerElement') markerEl!: ElementRef;

  private capaTemporal!: VectorLayer<VectorSource>;
  private sourceTemporal!: VectorSource;
  private markerOverlay?: Overlay;

  private readonly mapService = inject(MapService);

  public coordSystem: 'GEOGRAFICA' | 'UTM' = 'GEOGRAFICA';
  public este: number | null = null;
  public norte: number | null = null;
  /** San Isidro estÃ¡ Ã­ntegramente en la zona UTM 18S: es fija, sin selector. */
  private static readonly ZONA_UTM_SAN_ISIDRO = 'EPSG:32718';
  public latitud: number | null = null;
  public longitud: number | null = null;
  public errorMensaje: string | null = null;

  ngOnInit(): void {
    this.crearCapaTemporal();
  }

  private crearCapaTemporal() {
    this.sourceTemporal = new VectorSource();
    this.capaTemporal = new VectorLayer({
      source: this.sourceTemporal,
      style: this.estiloPunto()
    });
    this.mapService.map()?.addLayer(this.capaTemporal);
  }

  validarCoordenada(): void {
    this.errorMensaje = null;
    if (this.coordSystem === 'GEOGRAFICA') {
      this.buscarPorCoordGeograficas();
    } else {
      this.buscarPorCoordUTM();
    }
  }

  buscarPorCoordGeograficas(): void {
    if (this.latitud === null || this.longitud === null ||
      typeof this.latitud !== 'number' || typeof this.longitud !== 'number') {
      this.errorMensaje = 'Por favor, ingrese valores numÃ©ricos para Latitud y Longitud.';
      return;
    }

    const coordDestino = fromLonLat([this.longitud, this.latitud])
    if (!this.estaEnElDistrito(coordDestino)) {
      this.errorMensaje = 'La coordenada ingresada estÃ¡ fuera del distrito de San Isidro.';
      return;
    }
    this.irACoordenada(coordDestino);
  }

  buscarPorCoordUTM() {
    if (this.este === null || this.norte === null ||
      typeof this.este !== 'number' || typeof this.norte !== 'number') {
      this.errorMensaje = 'Por favor, ingrese valores numÃ©ricos para Este y Norte.';
      return;
    }

    const coordDestino = transform([this.este, this.norte], UbicacionCoordenadas.ZONA_UTM_SAN_ISIDRO, 'EPSG:3857')
    if (!this.estaEnElDistrito(coordDestino)) {
      this.errorMensaje = 'La coordenada ingresada estÃ¡ fuera del distrito de San Isidro.';
      return;
    }
    this.irACoordenada(coordDestino);
  }

  /**
   * Indica si una coordenada (en la proyecciÃ³n del mapa, EPSG:3857) cae dentro
   * del distrito de San Isidro. Se usa `SAN_ISIDRO_EXTENT` (bounding box del
   * distrito en EPSG:32718, la misma referencia del aviso de TÃ©rminos), con un
   * pequeÃ±o margen para no rechazar puntos vÃ¡lidos del borde por el redondeo
   * de la transformaciÃ³n de coordenadas.
   */
  private estaEnElDistrito(coordenada3857: Coordinate): boolean {
    const vista = this.mapService.map()?.getView().getProjection() ?? 'EPSG:3857';
    const utm = transform(coordenada3857, vista, 'EPSG:32718');
    const margen = 50; // metros de tolerancia en el borde del distrito
    return (
      utm[0] >= SAN_ISIDRO_EXTENT[0] - margen &&
      utm[0] <= SAN_ISIDRO_EXTENT[2] + margen &&
      utm[1] >= SAN_ISIDRO_EXTENT[1] - margen &&
      utm[1] <= SAN_ISIDRO_EXTENT[3] + margen
    );
  }

  irACoordenada(coordenada: Coordinate) {
    this.borrarPunto();
    const feature = new Feature({
      geometry: new Point(coordenada)
    });

    this.sourceTemporal.addFeature(feature);

    // Configurar y mostrar el overlay con efecto GPS
    if (!this.markerOverlay && this.markerEl) {
      this.markerOverlay = new Overlay({
        element: this.markerEl.nativeElement,
        positioning: 'center-center',
        stopEvent: false
      });
      this.mapService.map()?.addOverlay(this.markerOverlay);
    }
    this.markerEl.nativeElement.classList.replace('hidden', 'flex');
    this.markerOverlay?.setPosition(coordenada);

    this.mapService.map()?.getView().animate({
      center: coordenada,
      zoom: ZOOM_LEVEL_LOCATION,
      duration: ANIMATION_DURATION
    })
  }

  borrarPunto(): void {
    this.sourceTemporal.clear();
    this.markerOverlay?.setPosition(undefined);
    if (this.markerEl) {
      this.markerEl.nativeElement.classList.replace('flex', 'hidden');
    }
  }


  limpiarUbicacion(): void {
    this.latitud = null;
    this.longitud = null;

    this.este = null;
    this.norte = null;

    this.errorMensaje = null;
    this.borrarPunto();
  }

  private estiloPunto(): Style {
    return new Style({
      image: new CircleStyle({
        radius: 8,
        fill: new Fill({ color: '#2563eb' }), // Azul primario para el punto central
        stroke: new Stroke({ color: '#ffffff', width: 2 })
      })
    });
  }

  ngOnDestroy(): void {
    if (this.capaTemporal) {
      this.mapService.map()?.removeLayer(this.capaTemporal);
    }
    if (this.markerOverlay) {
      this.mapService.map()?.removeOverlay(this.markerOverlay);
    }
  }
}
