import { ORTOFOTO_YEARS } from './ortofotos';
import type { OrtofotoLayerConfig } from './ortofotos';
import type { SubSection } from './geoLayers';
import { LAYER_PANEL_SECTIONS } from './controlCapasConfig';

/**
 * `ortofotos.ts` es la única fuente de verdad de los años de vuelos con
 * ortofoto publicada. De ella se generan las capas del panel (`imaAereas`), por
 * lo que estas pruebas fijan el contrato que el resto del visor da por hecho:
 * años únicos, ordenados de más reciente a más antiguo y sin years sin
 * fotografía publicada (un año sin vuelo rompería la petición de teselas).
 */
describe('ORTOFOTO_YEARS', () => {
  it('es una lista no vacía de años', () => {
    expect(ORTOFOTO_YEARS.length).toBeGreaterThan(0);
    for (const year of ORTOFOTO_YEARS) {
      expect(Number.isInteger(year)).toBe(true);
      expect(year).toBeGreaterThan(1900);
      expect(year).toBeLessThanOrEqual(new Date().getFullYear());
    }
  });

  it('ordena los vuelos del más reciente al más antiguo', () => {
    expect(ORTOFOTO_YEARS).toEqual([...ORTOFOTO_YEARS].sort((a, b) => b - a));
  });

  it('no repite años', () => {
    expect(ORTOFOTO_YEARS).toHaveLength(new Set(ORTOFOTO_YEARS).size);
  });

  it('conserva el vuelo más reciente y el más antiguo del inventario', () => {
    expect(ORTOFOTO_YEARS[0]).toBe(2025);
    expect(ORTOFOTO_YEARS[ORTOFOTO_YEARS.length - 1]).toBe(1943);
  });
});

describe('OrtofotoLayerConfig', () => {
  it('describe una capa de ortofoto con año y zIndex fijo', () => {
    // Prueba de contrato (solo tipos): el `zIndex` es el literal `10`, para que
    // el compilador rechace cualquier capa de ortofoto con otro apilado.
    const config: OrtofotoLayerConfig = { year: 2025, zIndex: 10 };
    expect(config.year).toBe(2025);
    expect(config.zIndex).toBe(10);
  });
});

describe('Panel de capas · imágenes aéreas', () => {
  /** Subsección de ortofotos históricas declarada en el panel. */
  const subseccionOrtofotos = LAYER_PANEL_SECTIONS.flatMap(s => s.items)
    .find((item): item is SubSection => 'layers' in item && item.id === 'ortofotos_historicas');

  it('declara una capa por cada año de ortofoto, con id y etiquetaderivados del año', () => {
    expect(subseccionOrtofotos).toBeDefined();
    const ids = subseccionOrtofotos!.layers.map(l => l.id);
    const etiquetas = subseccionOrtofotos!.layers.map(l => l.label);
    expect(ids).toEqual(ORTOFOTO_YEARS.map(year => `ortofoto_${year}`));
    expect(etiquetas).toEqual(ORTOFOTO_YEARS.map(year => `${year}`));
  });

  it('mantiene el orden del inventario en el panel', () => {
    const anios = subseccionOrtofotos!.layers
      .map(l => Number(l.id.replace('ortofoto_', '')))
      .filter(anio => !Number.isNaN(anio));
    expect(anios).toEqual(ORTOFOTO_YEARS);
  });

  it('arranca apagada y sin salir en la leyenda (la ortofoto no aporta simbología propia)', () => {
    for (const layer of subseccionOrtofotos!.layers) {
      expect(layer.visible).toBe(false);
      expect(layer.showInLegend).toBe(false);
      expect(layer.opacity).toBe(1);
      expect(layer.disabled).toBe(false);
    }
  });
});