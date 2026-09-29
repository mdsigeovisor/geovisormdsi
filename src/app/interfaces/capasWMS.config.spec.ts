import { INITIAL_WMS_LAYERS } from './capasWMS.config';
import { LAYER_PANEL_SECTIONS } from './controlCapasConfig';

/**
 * La zonificación normativa se publica como una capa COMPUESTA: los polígonos de
 * usos del suelo y sus límites normativos viajan en una sola petición GetMap, y el
 * panel de capas los controla con un único interruptor. Estas pruebas fijan esa
 * unión para que no vuelvan a declararse como dos capas independientes
 * (`zonificacion1` / `zonificacion2`).
 */
const CAPAS_ZONIFICACION = ['vw_nor_zonificacion_poligono', 'vw_nor_zonificacion_limites'] as const;

/** Entradas de la configuración WMS que corresponden a la zonificación. */
const configuracionesZonificacion = INITIAL_WMS_LAYERS.filter(c => c.id === 'zonificacion');

/** Aplana los `LayerItem` del panel de capas (capas directas y de subsecciones). */
const capasDelPanel = () =>
  LAYER_PANEL_SECTIONS.flatMap(seccion =>
    seccion.items.flatMap(item => ('layers' in item ? item.layers : [item]))
  );

describe('NORMATIVA_LAYERS · zonificación como capa compuesta', () => {
  it('declara una única capa WMS para la zonificación', () => {
    expect(configuracionesZonificacion).toHaveLength(1);
  });

  it('agrupa polígonos y límites en una sola petición, con el polígono debajo', () => {
    const [config] = configuracionesZonificacion;
    const nombres = config.layerName.split(',');
    expect(nombres).toHaveLength(2);
    expect(nombres[0]).toContain(CAPAS_ZONIFICACION[0]);
    expect(nombres[1]).toContain(CAPAS_ZONIFICACION[1]);
  });

  it('pide la leyenda de usos del suelo y la de los límites normativos', () => {
    const [config] = configuracionesZonificacion;
    const capasDeLeyenda = (config.legendLayerName ?? '').split(',');
    expect(capasDeLeyenda).toHaveLength(2);
    expect(capasDeLeyenda[0]).toContain(CAPAS_ZONIFICACION[0]);
    expect(capasDeLeyenda[1]).toContain(CAPAS_ZONIFICACION[1]);
  });

  it('ya no existen las capas zonificacion1 y zonificacion2', () => {
    const ids = INITIAL_WMS_LAYERS.map(c => c.id);
    expect(ids).not.toContain('zonificacion1');
    expect(ids).not.toContain('zonificacion2');
  });
});

describe('Panel de capas · zonificación como capa compuesta', () => {
  it('muestra una sola entrada para la zonificación', () => {
    const entradas = capasDelPanel().filter(l => l.id === 'zonificacion');
    expect(entradas).toHaveLength(1);
  });

  it('la entrada coincide con la capa WMS compuesta y sale en la leyenda', () => {
    const [entrada] = capasDelPanel().filter(l => l.id === 'zonificacion');
    expect(entrada.label).toBe('Zonificación usos del suelo');
    expect(entrada.showInLegend).toBe(true);
    expect(entrada.visible).toBe(false);
  });

  it('ya no hay entradas zonificacion1 ni zonificacion2 en el panel', () => {
    const ids = capasDelPanel().map(l => l.id);
    expect(ids).not.toContain('zonificacion1');
    expect(ids).not.toContain('zonificacion2');
  });
});
