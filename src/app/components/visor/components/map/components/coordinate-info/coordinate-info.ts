import { Component, effect, inject, NgZone, OnDestroy } from '@angular/core';
import { EventsKey } from 'ol/events';
import { CommonModule } from '@angular/common';
import { MapService } from '@app/services/map.service';
import { unByKey } from 'ol/Observable';
import { toLonLat, transform } from 'ol/proj';

@Component({
  selector: 'app-coordinate-info',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './coordinate-info.html',
  styleUrl: './coordinate-info.css',
})
export class CoordinateInfo implements OnDestroy {
  private readonly mapService = inject(MapService);
  private readonly ngZone = inject(NgZone);
  
  public lat: number = -12.0459403;
  public lon: number = -77.0305623;
  public este: number = 278950.35;
  public norte: number = 8667546.05;
  public zona: string = '18S';
  public hemisferio: 'N' | 'S' = 'S';
  public sistemaCoord: 'GEOGRAFICA' | 'UTM' = 'UTM';
  
  private pointerMoveKey: EventsKey | undefined;

  constructor() {
    effect((onCleanup) => {
      const map = this.mapService.map();
      if (!map) return;

      this.pointerMoveKey = map.on('pointermove', this.handlePointerMove.bind(this));

      onCleanup(() => {
        if (this.pointerMoveKey) {
          unByKey(this.pointerMoveKey);
        }
      });
    });
  }

  private handlePointerMove(evt: any): void {
    const [lon, lat] = toLonLat(evt.coordinate);
    const { zona, hemisferio } = this.calcularZonaUTM(lon, lat);
    
    this.updateUTMCoordinates(evt.coordinate, zona, hemisferio);
    this.updateCoordinates(lon, lat, zona, hemisferio);
  }

  private updateUTMCoordinates(coordinate: number[], zona: string, hemisferio: 'N' | 'S'): void {
    const proyeccionUTM = this.obtenerProyeccionUTM(zona, hemisferio);
    const [este, norte] = transform(coordinate, 'EPSG:3857', proyeccionUTM);

    this.ngZone.run(() => {
      this.este = este;
      this.norte = norte;
    });
  }

  private updateCoordinates(lon: number, lat: number, zona: string, hemisferio: 'N' | 'S'): void {
    this.ngZone.run(() => {
      this.lon = lon;
      this.lat = lat;
      this.zona = zona;
      this.hemisferio = hemisferio;
    });
  }

  ngOnDestroy(): void {
    if (this.pointerMoveKey) {
      unByKey(this.pointerMoveKey);
    }
  }

  cambiarSistemaCoordenadas() {
    this.sistemaCoord = this.sistemaCoord === 'GEOGRAFICA' ? 'UTM' : 'GEOGRAFICA';
  }

  calcularZonaUTM(longitud: number, latitud: number): { zona: string, hemisferio: 'N' | 'S' } {
    let zona = Math.floor((longitud + 180) / 6) + 1;

    let hemisferio: 'N' | 'S' = latitud >= 0 ? 'N' : 'S';

    if (latitud >= 56 && latitud < 64 && longitud >= 3 && longitud < 12) {
      zona = 32;
    }

    return { zona: String(zona), hemisferio };
  }

  obtenerProyeccionUTM(zona: string, hemisferio: string): string {
    let epsg;
    if (hemisferio === 'N') {
      epsg = 32600 + Number.parseInt(zona);
    } else {
      epsg = 32700 + Number.parseInt(zona);
    }
    return `EPSG:${epsg}`;
  }

}

