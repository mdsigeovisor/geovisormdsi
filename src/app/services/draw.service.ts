import { Injectable } from '@angular/core';
import Map from 'ol/Map';
import Draw from 'ol/interaction/Draw';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Overlay from 'ol/Overlay';
import { getArea, getLength } from 'ol/sphere';
import { LineString, Polygon } from 'ol/geom';
import { Style, Stroke, Fill, Circle as CircleStyle } from 'ol/style';
import { unByKey } from 'ol/Observable';

type TipoHerramienta = 'Point' | 'LineString' | 'Polygon' | 'Circle';

@Injectable({
  providedIn: 'root',
})
export class DrawMeasureService {
  private map?: Map;
  private draw?: Draw;
  private readonly source = new VectorSource();
  private overlays: Overlay[] = [];

  private readonly layer = new VectorLayer({
    source: this.source,
    style: new Style({
      stroke: new Stroke({
        color: '#2b78e4',
        width: 3,
      }),
      fill: new Fill({
        color: 'rgba(43, 120, 228, 0.20)',
      }),
      image: new CircleStyle({
        radius: 6,
        fill: new Fill({ color: '#2b78e4' }),
        stroke: new Stroke({ color: '#ffffff', width: 2 }),
      }),
    }),
  });

  inicializar(map: Map): void {
    this.map = map;

    if (!this.map.getLayers().getArray().includes(this.layer)) {
      this.map.addLayer(this.layer);
    }
  }

  dibujarPunto(): void {
    this.activarDibujo('Point', false);
  }

  medirDistancia(): void {
    this.activarDibujo('LineString', true);
  }

  medirArea(): void {
    this.activarDibujo('Polygon', true);
  }

  limpiar(): void {
    this.source.clear();

    this.overlays.forEach((overlay) => {
      this.map?.removeOverlay(overlay);
    });

    this.overlays = [];
    this.desactivarHerramienta();
  }

  desactivarHerramienta(): void {
    if (this.map && this.draw) {
      this.map.removeInteraction(this.draw);
      this.draw = undefined;
    }

    this.map?.getTargetElement().style.setProperty('cursor', '');
  }

  private activarDibujo(tipo: TipoHerramienta, medir: boolean): void {
    if (!this.map) {
      return;
    }

    console.log('Mapa en servicio:', this.map);
    console.log('Tipo dibujo:', tipo);

    this.desactivarHerramienta();

    this.map.getTargetElement().style.cursor = 'crosshair';

    this.draw = new Draw({
      source: this.source,
      type: tipo,
    });

    this.map.addInteraction(this.draw);

    let listener: any;
    let measureOverlay: Overlay | undefined;

    this.draw.on('drawstart', (event) => {
      if (!medir) {
        return;
      }

      measureOverlay = this.crearOverlayMedicion();
      this.map?.addOverlay(measureOverlay);
      this.overlays.push(measureOverlay);

      const geometry = event.feature.getGeometry();

      listener = geometry?.on('change', (evt) => {
        const geom = evt.target;
        const resultado = this.formatearMedicion(geom);
        const coordenada = this.obtenerCoordenadaTooltip(geom);

        const element = measureOverlay?.getElement();
        if (element) {
          element.innerHTML = resultado;
        }

        if (coordenada) {
          measureOverlay?.setPosition(coordenada);
        }
      });
    });

    this.draw.on('drawend', (event) => {
      if (listener) {
        unByKey(listener);
      }

      const geometry = event.feature.getGeometry();

      if (medir && geometry && measureOverlay) {
        const element = measureOverlay.getElement();

        if (element) {
          element.innerHTML = this.formatearMedicion(geometry);
        }
        measureOverlay.setPosition(this.obtenerCoordenadaTooltip(geometry));
      }

      this.map?.getTargetElement().style.setProperty('cursor', '');
      this.desactivarHerramienta();
    });
  }

  private formatearMedicion(geometry: any): string {
    const projection = this.map?.getView().getProjection();

    if (geometry instanceof LineString) {
      const longitud = getLength(geometry, { projection });

      return longitud > 1000 ? `${(longitud / 1000).toFixed(2)} km` : `${longitud.toFixed(2)} m`;
    }

    if (geometry instanceof Polygon) {
      const area = getArea(geometry, { projection });

      return area > 10000 ? `${(area / 10000).toFixed(2)} ha` : `${area.toFixed(2)} m²`;
    }

    return '';
  }

  private obtenerCoordenadaTooltip(geometry: any): any {
    if (geometry instanceof Polygon) {
      return geometry.getInteriorPoint().getCoordinates();
    }

    if (geometry instanceof LineString) {
      return geometry.getLastCoordinate();
    }

    return undefined;
  }

  private crearOverlayMedicion(): Overlay {
    const element = document.createElement('div');
    element.className = 'ol-measure-tooltip';
    element.innerHTML = '0 m';

    return new Overlay({
      element,
      offset: [0, -15],
      positioning: 'bottom-center',
      stopEvent: false,
    });
  }

  dibujarLinea(): void {
    this.activarDibujo('LineString', false);
  }

  dibujarPoligono(): void {
    this.activarDibujo('Polygon', false);
  }

  dibujarCirculo(): void {
    this.activarDibujo('Circle', false);
  }

  finalizarMedicion(): void {
    if (!this.map) {
      return;
    }

    try {
      this.draw?.finishDrawing();
    } catch {
      // Si no hay geometría suficiente para finalizar, solo desactiva la herramienta.
    }

    this.desactivarHerramienta();
  }
}