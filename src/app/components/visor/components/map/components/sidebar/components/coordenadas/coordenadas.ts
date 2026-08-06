import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, OnInit, ViewChild, ElementRef, Output, EventEmitter, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Feature, Fill, fromLonLat, Overlay, Point, Stroke, Style, transform, VectorLayer, VectorSource } from '@app/modules/openlayers.module';
import { Coordinate } from 'ol/coordinate';
import CircleStyle from 'ol/style/Circle';
import { MapService } from '@app/services/map.service';
import { ANIMATION_DURATION, ZOOM_LEVEL_LOCATION } from '@app/interfaces/mapas.config';




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
  public zona: '17S' | '18S' | '19S' | null = '18S';
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
      this.errorMensaje = 'Por favor, ingrese valores numéricos para Latitud y Longitud.';
      return;
    }

    if (this.latitud < -19 || this.latitud > 0) {
      this.errorMensaje = 'La Latitud para Perú debe estar entre 0 y -19.';
      return;
    }

    if (this.longitud < -82 || this.longitud > -68) {
      this.errorMensaje = 'La Longitud para Perú debe estar entre -82 y -68.';
      return;
    }

    const coordDestino = fromLonLat([this.longitud, this.latitud])
    this.irACoordenada(coordDestino);
  }

  buscarPorCoordUTM() {
    if (this.este === null || this.norte === null || this.zona === null ||
      typeof this.este !== 'number' || typeof this.norte !== 'number') {
      this.errorMensaje = 'Por favor, ingrese valores numéricos para Este, Norte y seleccione una Zona.';
      return;
    }

    if (this.este < 100000 || this.este > 1000000) {
      this.errorMensaje = 'El valor "Este" parece estar fuera del rango típico para Perú (100,000 - 1,000,000).';
      return;
    }

    if (this.norte < 8000000 || this.norte > 10000000) {
      this.errorMensaje = 'El valor "Norte" parece estar fuera del rango típico para Perú (8,000,000 - 10,000,000).';
      return;
    }

    const coordDestino = transform([this.este, this.norte], this.obtenerSistemaCoordUtm(this.zona), 'EPSG:3857')
    this.irACoordenada(coordDestino);
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

  obtenerSistemaCoordUtm(zona: string): string {
    switch (zona) {
      case '17S':
        return 'EPSG:32717';
      case '19S':
        return 'EPSG:32719';
      default:
        return 'EPSG:32718';
    }
  }

  limpiarUbicacion(): void {
    this.latitud = null;
    this.longitud = null;

    this.este = null;
    this.norte = null;
    this.zona = '18S';

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
