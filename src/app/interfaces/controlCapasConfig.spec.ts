import { LAYER_PANEL_SECTIONS } from './controlCapasConfig';
import type { LayerItem, SubSection } from './geoLayers';
import { INITIAL_WMS_LAYERS } from './capasWMS.config';
import { ORTOFOTO_YEARS } from './ortofotos';

/**
 * `controlCapasConfig.ts` declara la estructura completa del panel de capas del
 * visor mediante las fábricas `capa()` y `subseccion()`, y aplica al final la
 * política de acceso que consume `MapService.panelSections`. Estas pruebas fijan
 * las reglas de las que depende el panel:
 *
 *  1. Los valores por defecto de toda capa del panel (apagada, opacidad 1),
 *     de modo que cada entrada solo declara aquello que se desvía.
 *  2. La política de acceso: solo las secciones públicas quedan exentas de
 *     `requiresAuth`; el resto se marcan restringidas automáticamente.
 *  3. La coherencia entre el panel y los servicios del mapa: toda capa
 *     publicable del panel tiene su servicio WMS asociado, salvo la capa en
 *     desarrollo, que se muestra bloqueada.
 */

/** Capas directas y de subsecciones de todas las secciones del panel. */
const capasDelPanel = (): LayerItem[] =>
  LAYER_PANEL_SECTIONS.flatMap(seccion =>
    seccion.items.flatMap(item => ('layers' in item ? item.layers : [item]))
  );

/** Todas las subsecciones del panel. */
const subsecciones = (): SubSection[] =>
  LAYER_PANEL_SECTIONS.flatMap(s => s.items.filter((i): i is SubSection => 'layers' in i));

/** Identificadores de los servicios WMS declarados para el GeoServer. */
const serviciosWms = (): Set<string> => new Set(INITIAL_WMS_LAYERS.map(c => c.id));

describe('controlCapasConfig · valores por defecto', () => {
  it('toda capa nace apagada y con opacidad 1 salvo que se declare lo contrario', () => {
    expect(capasDelPanel().length).toBeGreaterThan(0);
    for (const layer of capasDelPanel()) {
      expect(layer.type).toBe('layer');
      expect(layer.opacity).toBe(1);
      expect(typeof layer.visible).toBe('boolean');
      expect(typeof layer.showInLegend).toBe('boolean');
    }
  });

  it('solo la nomenclatura de vías se enciende por defecto', () => {
    expect(capasDelPanel().filter(l => l.visible).map(l => l.id)).toEqual(['nombre-vias']);
  });

  it('las capas en desarrollo se muestran bloqueadas y sin servicio WMS', () => {
    const bloqueadas = capasDelPanel().filter(l => l.disabled);
    expect(bloqueadas.length).toBeGreaterThan(0);
    for (const layer of bloqueadas) {
      expect(serviciosWms().has(layer.id)).toBe(false);
      expect(layer.visible).toBe(false);
    }
  });

  it('ninguna capa del panel tiene el identificador vacío', () => {
    // La fábrica marca `disabled` cuando el id viene vacío: hoy no debe pasar.
    for (const layer of capasDelPanel()) {
      expect(layer.id).not.toBe('');
      expect(layer.id.trim()).toBe(layer.id);
      expect(layer.label.trim()).not.toBe('');
    }
  });
});
describe('controlCapasConfig · política de acceso', () => {
  it('exime de sesión iniciada solo a las secciones públicas', () => {
    expect(LAYER_PANEL_SECTIONS.filter(s => !s.requiresAuth).map(s => s.id)).toEqual([
      'catastral',
      'imaAereas',
      'normativaUrbana',
    ]);
  });

  it('marca como restringidas las secciones no exentas', () => {
    expect(LAYER_PANEL_SECTIONS.filter(s => s.requiresAuth).map(s => s.id)).toEqual([
      'infraestructuraUrbana',
      'info_tematica',
      'tusne',
    ]);
  });

  it('respeta el requiresAuth propio de una subsección dentro de una sección pública', () => {
    // Caso fino: se declara explícitamente aunque su sección esté exenta.
    const seccionCatastral = LAYER_PANEL_SECTIONS.find(s => s.id === 'catastral')!;
    const sub = seccionCatastral.items.find(
      (i): i is SubSection => 'layers' in i && i.id === 'pto_geodesico'
    )!;
    expect(sub.requiresAuth).toBe(true);
    expect(seccionCatastral.requiresAuth).toBeUndefined();
  });

  it('respeta el requiresAuth propio de una capa dentro de una sección pública', () => {
    expect(capasDelPanel().find(l => l.id === 'amUrbHomogeneo')!.requiresAuth).toBe(true);
  });

  it('exige sesión en "Fotos sin Procesar" aunque su sección sea pública', () => {
    expect(subsecciones().find(s => s.id === 'fotos_sin_procesar')!.requiresAuth).toBe(true);
    expect(LAYER_PANEL_SECTIONS.find(s => s.id === 'imaAereas')!.requiresAuth).toBeUndefined();
  });
});

describe('controlCapasConfig · estructura del panel', () => {
  it('expone secciones con título, contenido y plegadas por defecto', () => {
    for (const seccion of LAYER_PANEL_SECTIONS) {
      expect(seccion.expanded).toBe(false);
      expect(seccion.title.trim()).not.toBe('');
      expect(seccion.items.length).toBeGreaterThan(0);
    }
  });

  it('mantiene el orden de secciones declarado', () => {
    expect(LAYER_PANEL_SECTIONS.map(s => s.id)).toEqual([
      'catastral',
      'imaAereas',
      'normativaUrbana',
      'infraestructuraUrbana',
      'info_tematica',
      'tusne',
    ]);
  });

  it('no repite identificadores de sección ni de subsección', () => {
    const idsSeccion = LAYER_PANEL_SECTIONS.map(s => s.id);
    expect(new Set(idsSeccion).size).toBe(idsSeccion.length);

    const idsSubseccion = subsecciones().map(s => s.id);
    expect(new Set(idsSubseccion).size).toBe(idsSubseccion.length);
  });

  it('no deja subsecciones vacías', () => {
    for (const sub of subsecciones()) {
      expect(sub.layers.length).toBeGreaterThan(0);
      expect(sub.expanded).toBe(false);
    }
  });
});
describe('controlCapasConfig · coherencia con los servicios del mapa', () => {
  /**
   * Las ortofotos son la excepción: se cargan como teselas XYZ desde el servidor
   * de vuelos (`ortofotoServerUrl`), no desde el GeoServer, por eso sus `id`
   * (`ortofoto_<año>`) no figuran en `INITIAL_WMS_LAYERS`.
   */
  const ortofotos = (): LayerItem[] => capasDelPanel().filter(l => l.id.startsWith('ortofoto_'));
  /** Capa en desarrollo: sin servicio WMS asociado y bloqueada en el panel. */
  const enDesarrollo = (): LayerItem[] => capasDelPanel().filter(l => l.disabled);
  /** Capas del panel que deberían tener un servicio WMS y no lo tienen. */
  const sinServicioWms = (): LayerItem[] =>
    capasDelPanel().filter(
      l => !l.disabled && !l.id.startsWith('ortofoto_') && !serviciosWms().has(l.id)
    );

  it('las únicas capas del panel sin servicio WMS son las ortofotos', () => {
    expect(sinServicioWms()).toEqual([]);
    expect(ortofotos()).toHaveLength(ORTOFOTO_YEARS.length);
  });

  it('solo la capa en desarrollo aparece bloqueada', () => {
    expect(enDesarrollo().map(l => l.id)).toEqual(['denominacion_predio']);
  });

  it('la capa en desarrollo no tiene servicio publicado y sigue apagada', () => {
    const predio = enDesarrollo()[0];
    expect(predio.label).toContain('Denominación del Predio');
    expect(serviciosWms().has('denominacion_predio')).toBe(false);
    // El GeoServer publica la capa con guion bajo, pero el id declarado en el
    // panel es el propio de la versión en desarrollo.
    expect(serviciosWms().has('denominacion-predio')).toBe(true);
  });

  it('las capas base del GeoServer se cargan en el mapa aunque no estén en el panel', () => {
    // `manzana`, `lote`, `edificaciones`… son cartografía base: el `MapService`
    // las añade directamente, por eso no son interruptores del panel.
    const servicios = serviciosWms();
    expect(servicios.has('manzana')).toBe(true);
    expect(servicios.has('lote')).toBe(true);
    expect(servicios.has('edificaciones')).toBe(true);
  });

  it('solo `tem_view_lote_rrpp` se lista en dos subsecciones distintas', () => {
    // Mismo servicio WMS publicado en dos sitios del panel a propósito
    // (edificaciones existentes y trámites atendidos); cualquier otro `id`
    // repetido denotaría una entrada duplicada por error.
    const conteo = new Map<string, number>();
    for (const layer of capasDelPanel()) {
      conteo.set(layer.id, (conteo.get(layer.id) ?? 0) + 1);
    }
    expect([...conteo.entries()].filter(([, n]) => n > 1)).toEqual([['tem_view_lote_rrpp', 2]]);
  });
});