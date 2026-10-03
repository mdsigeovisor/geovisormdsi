import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import Map from 'ol/Map';
import View from 'ol/View';
import Draw from 'ol/interaction/Draw';
import VectorLayer from 'ol/layer/Vector';
import Feature from 'ol/Feature';
import { LineString, Polygon } from 'ol/geom';

import { DrawMeasureService } from './draw.service';

/**
 * Pruebas de las herramientas de dibujo y medición del mapa.
 *
 * Se usa un mapa OpenLayers real (funciona en jsdom) porque el comportamiento
 * que importa es la interacción entre el servicio y las primitivas de OL:
 *  - se agrega UNA capa propia de las geometrías del usuario y no se duplica;
 *  - `isDrawing` se enciende al activar una herramienta y se apaga al
 *    terminar, para que el visor vuelva a atender los clics y el hover;
 *  - el trazo se cierra con Enter o con el botón "Finalizar" sin generar
 *    eventos de clic (que abrirían el popup del lote);
 *  - `Enter` se ignora si viene de un control de la interfaz (input, botón...),
 *    para no robarle la tecla al buscador;
 *  - `limpiar()` vacía geometrías, overlays y desactiva la herramienta.
 */

/**
 * Doble de `ResizeObserver`: jsdom no lo implementa y OpenLayers lo usa para
 * observar el tamaño del contenedor del mapa. No hace nada, porque el mapa no
 * necesita `updateSize()` en estas pruebas.
 */
beforeAll(() => {
  (globalThis as any).ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
});

/** Número de capas vectoriales del mapa (la del servicio debe ser la única). */
function numeroCapasVectoriales(map: Map): number {
  return map.getLayers().getArray().filter(capa => capa instanceof VectorLayer).length;
}

/**
 * Capa propia del servicio: es la única `VectorLayer` del mapa en estas
 * pruebas (las geometrías trazadas por el usuario).
 */
function capaDeGeometrias(map: Map): VectorLayer<any> {
  return map.getLayers().getArray().find((capa): capa is VectorLayer<any> => capa instanceof VectorLayer)!;
}

/** Número de interacciones `Draw` activas en el mapa. */
function drawsActivos(map: Map): number {
  return map.getInteractions().getArray().filter(i => i instanceof Draw).length;
}

/** Interacción `Draw` activa en el mapa (la que registró el servicio). */
function drawActivo(map: Map): Draw {
  return map.getInteractions().getArray().find((i): i is Draw => i instanceof Draw)!;
}

/**
 * Agrega vértices al trazo en curso de la interacción, como lo haría cada clic
 * del usuario. El sketch es el primer feature del overlay propio de `Draw`.
 */
function agregarVertices(map: Map, coordenadas: number[][]): void {
  const geometria = new LineString(coordenadas);
  drawActivo(map).getOverlay().getSource()!.addFeature(new Feature({ geometry: geometria }));
  geometria.setCoordinates(coordenadas);
}

describe('DrawMeasureService', () => {
  let service: DrawMeasureService;
  let map: Map;
  let target: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DrawMeasureService);

    // El mapa necesita un elemento objetivo con tamaño para que OL lo mida.
    target = document.createElement('div');
    target.style.width = '400px';
    target.style.height = '400px';
    document.body.appendChild(target);

    map = new Map({
      target,
      view: new View({ center: [0, 0], zoom: 10 }),
    });
  });

  afterEach(() => {
    service.limpiar();
    map.setTarget(undefined);
    map.dispose();
    target.remove();
    TestBed.resetTestingModule();
  });

  describe('inicializar', () => {
    it('agrega la capa propia de las geometrías del usuario', () => {
      service.inicializar(map);

      expect(numeroCapasVectoriales(map)).toBe(1);
    });

    it('no duplica la capa si se inicializa dos veces', () => {
      service.inicializar(map);
      service.inicializar(map);

      expect(numeroCapasVectoriales(map)).toBe(1);
    });

    it('no hace nada visible mientras no hay mapa inicializado', () => {
      // Sin `inicializar()` ninguna herramienta puede activarse.
      service.dibujarPunto();

      expect(service.isDrawing()).toBe(false);
    });
  });
describe('activación de herramientas', () => {
    it.each([
      ['dibujarPunto', (s: DrawMeasureService) => s.dibujarPunto()],
      ['dibujarLinea', (s: DrawMeasureService) => s.dibujarLinea()],
      ['dibujarPoligono', (s: DrawMeasureService) => s.dibujarPoligono()],
      ['dibujarCirculo', (s: DrawMeasureService) => s.dibujarCirculo()],
      ['medirDistancia', (s: DrawMeasureService) => s.medirDistancia()],
      ['medirArea', (s: DrawMeasureService) => s.medirArea()],
    ])('%s enciende `isDrawing` y añade una interacción al mapa', (_nombre, activar) => {
      service.inicializar(map);

      activar(service);

      expect(service.isDrawing()).toBe(true);
      expect(drawsActivos(map)).toBe(1);
      // El cursor de cruz indica que el mapa está esperando la geometría.
      expect(target.style.cursor).toBe('crosshair');
    });

    it('cambiar de herramienta sustituye la anterior sin dejar dos activas', () => {
      service.inicializar(map);

      service.medirArea();
      service.medirDistancia();

      // Una sola interacción: mientras se dibuja, el visor no vuelve a
      // atender los clics (por eso `isDrawing` no debe parpadear).
      expect(drawsActivos(map)).toBe(1);
      expect(service.isDrawing()).toBe(true);
    });
  });

  describe('desactivarHerramienta', () => {
    it('retira la interacción y devuelve el cursor', () => {
      service.inicializar(map);
      service.dibujarPunto();
      service.desactivarHerramienta();

      expect(drawsActivos(map)).toBe(0);
      expect(service.isDrawing()).toBe(false);
      expect(target.style.cursor).not.toBe('crosshair');
    });

    it('es idempotente: llamarla sin herramienta no falla', () => {
      service.inicializar(map);

      service.desactivarHerramienta();
      service.desactivarHerramienta();

      expect(service.isDrawing()).toBe(false);
    });
  });

  describe('medición', () => {
    /** Etiqueta de longitud/ área que el servicio superpone al mapa. */
    function etiquetaMedicion(): HTMLElement | null {
      return document.querySelector('.ol-measure-tooltip');
    }

    it('la medición de distancia etiqueta la longitud del trazo', () => {
      service.inicializar(map);
      service.medirDistancia();

      // Se dispara el inicio del trazo como lo haría el primer clic: el
      // servicio crea el overlay y lo enlaza al cambio de la geometría.
      const geometria = new LineString([
        [0, 0],
        [300, 0],
      ]);
      drawActivo(map).dispatchEvent({
        type: 'drawstart',
        feature: new Feature({ geometry: geometria }),
      } as any);

      expect(etiquetaMedicion()).not.toBeNull();
      // 300 m en la proyección de la vista (EPSG:3857).
      expect(etiquetaMedicion()?.innerHTML).toMatch(/^[\d.,]+ (m|km)$/);
    });

    it('el área se expresa en metros cuadrados o hectáreas', () => {
      service.inicializar(map);
      service.medirArea();

      const geometria = new Polygon([
        [
          [0, 0],
          [100, 0],
          [100, 100],
          [0, 100],
          [0, 0],
        ],
      ]);
      drawActivo(map).dispatchEvent({
        type: 'drawstart',
        feature: new Feature({ geometry: geometria }),
      } as any);
      // El tooltip se refresca en el evento `change` de la geometría, que es
      // lo que dispara cada vértice nuevo mientras el usuario dibuja.
      geometria.setCoordinates([
        [
          [0, 0],
          [300, 0],
          [300, 300],
          [0, 300],
          [0, 0],
        ],
      ]);

      expect(etiquetaMedicion()?.innerHTML).toMatch(/^[\d.,]+ (m²|ha)$/);
    });

    it('las distancias de más de 1 km se expresan en kilómetros', () => {
      service.inicializar(map);
      service.medirDistancia();

      // 2000 m en EPSG:3857 supera el umbral de 1000 m: debe sair en km.
      const geometria = new LineString([
        [0, 0],
        [2000, 0],
      ]);
      drawActivo(map).dispatchEvent({
        type: 'drawstart',
        feature: new Feature({ geometry: geometria }),
      } as any);
      geometria.setCoordinates([
        [0, 0],
        [2000, 0],
        [4000, 0],
      ]);

      expect(etiquetaMedicion()?.innerHTML).toMatch(/ km$/);
    });

    it('las distancias cortas se expresan en metros', () => {
      service.inicializar(map);
      service.medirDistancia();

      const geometria = new LineString([
        [0, 0],
        [300, 0],
        [600, 0],
      ]);
      drawActivo(map).dispatchEvent({
        type: 'drawstart',
        feature: new Feature({ geometry: geometria }),
      } as any);

      // 600 m no llega al umbral: la etiqueta va en metros, no en km.
      expect(etiquetaMedicion()?.innerHTML).toMatch(/ m$/);
    });

    it('las áreas de más de 1 ha se expresan en hectáreas', () => {
      service.inicializar(map);
      service.medirArea();

      // Cuadrado de 400x400 m = 16 ha: supera el umbral de 10 000 m².
      const geometria = new Polygon([
        [
          [0, 0],
          [400, 0],
          [400, 400],
          [0, 400],
          [0, 0],
        ],
      ]);
      drawActivo(map).dispatchEvent({
        type: 'drawstart',
        feature: new Feature({ geometry: geometria }),
      } as any);
      geometria.setCoordinates([
        [
          [0, 0],
          [400, 0],
          [400, 400],
          [0, 400],
          [0, 0],
        ],
      ]);

      expect(etiquetaMedicion()?.innerHTML).toMatch(/ ha$/);
    });

    it('las áreas pequeñas se expresan en metros cuadrados', () => {
      service.inicializar(map);
      service.medirArea();

      // 50x50 m = 2 500 m²: por debajo del umbral de 10 000 m².
      const geometria = new Polygon([
        [
          [0, 0],
          [50, 0],
          [50, 50],
          [0, 50],
          [0, 0],
        ],
      ]);
      drawActivo(map).dispatchEvent({
        type: 'drawstart',
        feature: new Feature({ geometry: geometria }),
      } as any);
      geometria.setCoordinates([
        [
          [0, 0],
          [50, 0],
          [50, 50],
          [0, 50],
          [0, 0],
        ],
      ]);

      expect(etiquetaMedicion()?.innerHTML).toMatch(/ m²$/);
    });

    it('descartar el trazo retira su etiqueta para no dejarla huérfana', () => {
      service.inicializar(map);
      service.medirDistancia();

      const geometria = new LineString([
        [0, 0],
        [300, 0],
      ]);
      drawActivo(map).dispatchEvent({
        type: 'drawstart',
        feature: new Feature({ geometry: geometria }),
      } as any);
      expect(etiquetaMedicion()).not.toBeNull();

      drawActivo(map).dispatchEvent({ type: 'drawabort' } as any);

      expect(etiquetaMedicion()).toBeNull();
    });

    it('el dibujo de un punto no crea etiqueta de medición', () => {
      service.inicializar(map);
      service.dibujarPunto();

      drawActivo(map).dispatchEvent({
        type: 'drawstart',
        feature: new Feature({ geometry: new LineString([[0, 0], [10, 0]]) }),
      } as any);

      // Sin medir no hay tooltip: solo se dibuja la geometría.
      expect(etiquetaMedicion()).toBeNull();
    });
  });

  describe('atajo de teclado', () => {
    /** Lanza un `keydown` de Enter sobre el objetivo indicado. */
    function pulsarEnter(targeto: EventTarget): KeyboardEvent {
      const evento = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true });
      targeto.dispatchEvent(evento);
      return evento;
    }

    it('Enter cierra el trazo en curso', async () => {
      service.inicializar(map);
      service.medirDistancia();
      pulsarEnter(document);

      await new Promise(resolve => setTimeout(resolve, 0));

      // El trazo se cierra y la herramienta se retira sola.
      expect(service.isDrawing()).toBe(false);
      expect(drawsActivos(map)).toBe(0);
    });

    it.each([['input'], ['textarea'], ['select'], ['button'], ['a']])(
      'ignora el Enter que viene de un <%s>',
      tag => {
        service.inicializar(map);
        service.medirDistancia();

        const control = document.createElement(tag);
        document.body.appendChild(control);
        const evento = pulsarEnter(control);
        control.remove();

        // La tecla es del control, no del mapa: el tour sigue dibujando.
        expect(evento.defaultPrevented).toBe(false);
        expect(service.isDrawing()).toBe(true);
      }
    );

    it('ignora el Enter con modificadores (evita conflictos con atajos)', () => {
      service.inicializar(map);
      service.medirDistancia();

      const evento = new KeyboardEvent('keydown', {
        key: 'Enter',
        shiftKey: true,
        cancelable: true,
        bubbles: true,
      });
      document.dispatchEvent(evento);

      expect(evento.defaultPrevented).toBe(false);
      expect(service.isDrawing()).toBe(true);
    });

    it('ignora otras teclas', () => {
      service.inicializar(map);
      service.dibujarPunto();

      pulsarEnter; // el resto de teclas no debe cerrar nada
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true }));

      expect(service.isDrawing()).toBe(true);
    });

    it('deja de escuchar el atajo al desactivar la herramienta', () => {
      service.inicializar(map);
      service.dibujarPunto();
      service.desactivarHerramienta();

      const evento = pulsarEnter(document);

      // Sin herramienta activa el Enter no se intercepta.
      expect(evento.defaultPrevented).toBe(false);
    });
  });

  describe('finalizarMedicion', () => {
    it('no hace nada si el mapa no está inicializado', () => {
      // Sin mapa no hay trazo que cerrar: el método debe ser inocuo.
      service.finalizarMedicion();

      expect(service.isDrawing()).toBe(false);
    });

    it('descarta el trazo si no hay vértices suficientes', () => {
      service.inicializar(map);
      service.medirDistancia();

      // Una línea necesita 2 vértices y un polígono 3: con el sketch vacío,
      // cerrar el trazo dejaría una medición inválida sobre el mapa.
      service.finalizarMedicion();

      expect(service.isDrawing()).toBe(false);
      expect(drawsActivos(map)).toBe(0);
    });

    it('cierra el trazo de una línea con 2 vértices', () => {
      service.inicializar(map);
      service.medirDistancia();
      agregarVertices(map, [
        [0, 0],
        [100, 0],
        [200, 0],
      ]);
      const cerrar = vi.spyOn(drawActivo(map), 'finishDrawing');

      // Con los 2 vértices exigidos se CIERRA el trazo, no se aborta.
      service.finalizarMedicion();

      expect(cerrar).toHaveBeenCalled();
      expect(service.isDrawing()).toBe(false);
    });

    it('descarta el trazo de una línea con un solo vértice', () => {
      service.inicializar(map);
      service.medirDistancia();
      agregarVertices(map, [[0, 0]]);
      const abortar = vi.spyOn(drawActivo(map), 'abortDrawing');
      const cerrar = vi.spyOn(drawActivo(map), 'finishDrawing');

      // Un solo vértice no cierra una línea: se aborta, para no dejar una
      // medición inválida sobre el mapa.
      service.finalizarMedicion();

      expect(abortar).toHaveBeenCalled();
      expect(cerrar).not.toHaveBeenCalled();
      expect(service.isDrawing()).toBe(false);
    });
it('descarta una línea con un solo vértice marcado', () => {
      service.inicializar(map);
      service.medirDistancia();
      // El sketch de OpenLayers reserva una coordenada "fantasma" que sigue al
      // cursor, así que 2 coordenadas en el sketch son 1 vértice real: para una
      // línea hacen falta 2, de modo que el trazo se descarta.
      agregarVertices(map, [
        [0, 0],
        [100, 0],
      ]);
      const abortar = vi.spyOn(drawActivo(map), 'abortDrawing');
      const cerrar = vi.spyOn(drawActivo(map), 'finishDrawing');

      service.finalizarMedicion();

      expect(abortar).toHaveBeenCalled();
      expect(cerrar).not.toHaveBeenCalled();
    });

    it('cierra el trazo y apaga `isDrawing`', () => {
      service.inicializar(map);
      service.medirArea();
      service.finalizarMedicion();

      // Tras finalizar, el visor vuelve a atender los clics y el hover.
      expect(service.isDrawing()).toBe(false);
      expect(target.style.cursor).not.toBe('crosshair');
    });
  });

  describe('limpiar', () => {
    it('vacía las geometrías dibujadas', () => {
      service.inicializar(map);
      service.dibujarPunto();
      const capa = capaDeGeometrias(map);

      service.limpiar();

      expect(capa.getSource()?.getFeatures()).toHaveLength(0);
    });

    it('desactiva la herramienta activa', () => {
      service.inicializar(map);
      service.medirArea();

      service.limpiar();

      expect(service.isDrawing()).toBe(false);
      expect(drawsActivos(map)).toBe(0);
    });

    it('es idempotente: limpiar sin nada trazado no falla', () => {
      service.inicializar(map);

      service.limpiar();
      service.limpiar();

      expect(service.isDrawing()).toBe(false);
    });

    it('permite volver a dibujar después de limpiar', () => {
      service.inicializar(map);
      service.dibujarPunto();
      service.limpiar();

      service.medirArea();

      expect(service.isDrawing()).toBe(true);
      expect(drawsActivos(map)).toBe(1);
    });
  });
});
