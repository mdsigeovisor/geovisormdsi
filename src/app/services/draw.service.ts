import { Injectable, signal } from '@angular/core';
import Map from 'ol/Map';
import Draw from 'ol/interaction/Draw';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Overlay from 'ol/Overlay';
import { getArea, getLength } from 'ol/sphere';
import { LineString, Polygon } from 'ol/geom';
import { Style, Stroke, Fill, Circle as CircleStyle } from 'ol/style';
import { unByKey } from 'ol/Observable';
import { ZINDEX_GEOMETRIAS_USUARIO } from '../interfaces/mapas.config';

type TipoHerramienta = 'Point' | 'LineString' | 'Polygon' | 'Circle';

@Injectable({
  providedIn: 'root',
})
export class DrawMeasureService {
  private map?: Map;
  private draw?: Draw;
  /** Tipo de geometría de la herramienta activa (para validar el cierre del trazo). */
  private tipoHerramientaActiva?: TipoHerramienta;
  private readonly source = new VectorSource();
  private overlays: Overlay[] = [];
  public readonly isDrawing = signal(false);

  private readonly layer = new VectorLayer({
    source: this.source,
    // Se apila por encima de las ortofotos (zIndex 5) y de las capas WMS
    // (0–15): las geometrías trazadas con las herramientas de dibujo y medición
    // deben verse siempre sobre la imagen aérea activa.
    zIndex: ZINDEX_GEOMETRIAS_USUARIO,
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

  /**
   * Retira la interacción de dibujo activa, deja de escuchar el atajo de
   * finalizado y devuelve el cursor del mapa a su estado normal.
   * `isDrawing()` vuelve a `false` para que el visor responda de nuevo a los
   * clics y al hover (consultas de lotes).
   */
  desactivarHerramienta(): void {
    if (this.map && this.draw) {
      this.map.removeInteraction(this.draw);
      this.draw = undefined;
    }

    this.tipoHerramientaActiva = undefined;
    this.quitarAtajoFinalizar();
    this.isDrawing.set(false);

    this.map?.getTargetElement().style.setProperty('cursor', '');
  }

  private activarDibujo(tipo: TipoHerramienta, medir: boolean): void {
    if (!this.map) {
      return;
    }

    // Se retira la herramienta anterior ANTES de marcar el nuevo estado: si se
    // hiciera después, `desactivarHerramienta()` apagaría `isDrawing()` y el
    // visor volvería a responder a los clics mientras se dibuja.
    this.desactivarHerramienta();

    this.tipoHerramientaActiva = tipo;
    this.isDrawing.set(true);

    this.map.getTargetElement().style.cursor = 'crosshair';

    this.draw = new Draw({
      source: this.source,
      type: tipo,
      // `stopClick` hace que OpenLayers marque con `preventDefault()` el clic con
      // el que se cierra el trazo (incluido el segundo clic de un doble clic).
      // Gracias a ello el mapa NO emite `click`, `singleclick` ni `dblclick` al
      // finalizar, así que el visor no abre el popup/ficha del lote ni aplica el
      // zoom por doble clic justo al terminar una línea o un polígono.
      stopClick: true,
    });

    this.map.addInteraction(this.draw);
    this.registrarAtajoFinalizar();

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

    this.draw.on('drawabort', () => {
      // Trazo descartado (por ejemplo al finalizar sin vértices suficientes): se
      // retira su etiqueta de medición para no dejarla huérfana sobre el mapa.
      if (listener) {
        unByKey(listener);
        listener = undefined;
      }

      if (measureOverlay) {
        this.map?.removeOverlay(measureOverlay);
        this.overlays = this.overlays.filter(overlay => overlay !== measureOverlay);
        measureOverlay = undefined;
      }
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

      // `desactivarHerramienta()` ya devuelve el cursor y apaga `isDrawing()`.
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

  /**
   * Cierra el trazo en curso y desactiva la herramienta. Es la alternativa
   * "limpia" al doble clic: se invoca desde la tecla Enter y desde el botón
   * "Finalizar" del panel de herramientas, sin generar eventos de clic en el
   * mapa (por lo que no abre los popup de consulta del visor).
   */
  finalizarMedicion(): void {
    if (!this.map) {
      return;
    }

    try {
      if (this.hayVerticesSuficientes()) {
        this.draw?.finishDrawing();
      } else {
        // Todavía no hay geometría que cerrar: se descarta el trazo parcial.
        this.draw?.abortDrawing();
      }
    } catch {
      // Trazo no cerrable (por ejemplo una línea de un solo vértice): se
      // descarta en lugar de dejar una medición inválida en el mapa.
      this.draw?.abortDrawing();
    }

    this.desactivarHerramienta();
  }

  /**
   * Activa el atajo de teclado para cerrar el trazo sin doble clic.
   *
   * El listener se registra en el documento porque el contenedor del mapa no es
   * focusable; se ignora cuando la tecla va dirigida a un control de la interfaz
   * (ver `esControlDeInterfaz`) para no robarle el Enter a buscadores o botones.
   */
  private registrarAtajoFinalizar(): void {
    document.removeEventListener('keydown', this.onKeyDownFinalizar);
    document.addEventListener('keydown', this.onKeyDownFinalizar);
  }

  /** Deja de escuchar el atajo de finalizado (al desactivar la herramienta). */
  private quitarAtajoFinalizar(): void {
    document.removeEventListener('keydown', this.onKeyDownFinalizar);
  }

  /** Enter finaliza el trazo en curso (equivalente al doble clic). */
  private readonly onKeyDownFinalizar = (event: KeyboardEvent): void => {
    if (
      event.key !== 'Enter' ||
      event.repeat ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey
    ) {
      return;
    }

    if (this.esControlDeInterfaz(event.target)) {
      return;
    }

    event.preventDefault();
    this.finalizarMedicion();
  };

  /**
   * Indica si el evento de teclado proviene de un control de la interfaz (campo
   * de texto, botón, enlace o elemento editable).
   * @param target Elemento que recibió la tecla.
   * @returns `true` si el Enter debe ser gestionado por el propio control.
   */
  private esControlDeInterfaz(target: EventTarget | null): boolean {
    const elemento = target as HTMLElement | null;

    if (!elemento?.tagName) {
      return false;
    }

    if (elemento.isContentEditable) {
      return true;
    }

    return ['input', 'textarea', 'select', 'button', 'a'].includes(elemento.tagName.toLowerCase());
  }

  /**
   * Comprueba que el trazo en curso ya pueda cerrarse: una línea necesita 2
   * vértices y un polígono 3. Evita finalizar con Enter o con el botón cuando
   * todavía no hay geometría suficiente.
   */
  private hayVerticesSuficientes(): boolean {
    const tipo = this.tipoHerramientaActiva;

    if (!tipo || tipo === 'Point' || tipo === 'Circle') {
      return true; // Un punto o un círculo se cierran con un solo clic.
    }

    const minimo = tipo === 'Polygon' ? 3 : 2;

    return this.contarVerticesTrazo() >= minimo;
  }

  /**
   * Cuenta los vértices que el usuario ya marcó en el trazo en curso.
   *
   * El sketch de OpenLayers reserva una coordenada "fantasma" que sigue al
   * cursor (y una de cierre en los polígonos), por eso se descuentan al contar.
   */
  private contarVerticesTrazo(): number {
    // El sketch es el primer feature del overlay propio de la interacción.
    const geometria = this.draw?.getOverlay().getSource()?.getFeatures()?.[0]?.getGeometry();

    if (geometria instanceof LineString) {
      return Math.max(0, geometria.getCoordinates().length - 1);
    }

    if (geometria instanceof Polygon) {
      return Math.max(0, (geometria.getCoordinates()[0]?.length ?? 0) - 2);
    }

    return 0;
  }
}