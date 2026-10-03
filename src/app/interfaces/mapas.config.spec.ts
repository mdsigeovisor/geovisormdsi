import {
  ANIMATION_DURATION,
  GOOGLE_SATELLITE_URL,
  INITIAL_CENTER,
  INITIAL_ZOOM,
  MAP_MAX_ZOOM,
  OSM_URL,
  SAN_ISIDRO_CENTER,
  SAN_ISIDRO_EXTENT,
  SAN_ISIDRO_ZOOM,
  TERMS_ZOOM_DISTRICTO,
  TRAMA_WMS_URL,
  ZINDEX_GEOMETRIAS_USUARIO,
  ZOOM_LEVEL_LOCATION,
  ZOOM_MAX_PARQUE,
  ZOOM_MAX_PARQUE_CENTROIDE,
} from './mapas.config';
import { environment } from '../../environments/environment';

/**
 * `mapas.config.ts` concentra los parámetros de la vista del visor (centro,
 * zoom, plantillas de teselas y extensión del distrito). Son valores de negocio
 * —no ajustes técnicos—: cambiarlos altera lo que el usuario ve al entrar, el
 * nivel de detalle al acercarse a un parque o el disparador del aviso de
 * términos, por lo que conviene fijarlos con pruebas junto con sus relaciones de orden.
 */
describe('mapas.config · vista inicial', () => {
  it('centra el mapa en Lima (longitud, latitud) con un zoom de conjunto', () => {
    expect(INITIAL_CENTER).toHaveLength(2);
    expect(INITIAL_CENTER[0]).toBeLessThan(0); // longitud (oeste)
    expect(INITIAL_CENTER[1]).toBeLessThan(0); // latitud (sur)
    expect(INITIAL_ZOOM).toBeGreaterThanOrEqual(4);
    expect(INITIAL_ZOOM).toBeLessThan(SAN_ISIDRO_ZOOM);
  });

  it('ubica al usuario más cerca que la vista inicial, pero sin llegar al tope de la vista del distrito', () => {
    expect(ZOOM_LEVEL_LOCATION).toBeGreaterThan(INITIAL_ZOOM);
    expect(ZOOM_LEVEL_LOCATION).toBeLessThan(MAP_MAX_ZOOM);
  });
});

describe('mapas.config · plantillas de teselas', () => {
  it('expone una URL por tesela para Google Satélite y para el mapa de calles', () => {
    for (const url of [GOOGLE_SATELLITE_URL, OSM_URL]) {
      expect(url).toMatch(/^https:\/\//);
      expect(url).toContain('{z}');
      expect(url).toContain('{x}');
      expect(url).toContain('{y}');
    }
  });

  it('usa el servicio WMS del ambiente activo para la trama catastral', () => {
    expect(TRAMA_WMS_URL).toBe(environment.geoserver.wmsUrl);
  });
});

describe('mapas.config · topes de acercamiento', () => {
  it('permite más zoom que cualquier servicio de teselas (overzoom de OpenLayers)', () => {
    // Ort fotos: 22, mapas base: 19. El visor amplía la tesela interpolada por
    // encima de esos valores, así que `MAP_MAX_ZOOM` debe superarlos.
    expect(MAP_MAX_ZOOM).toBeGreaterThan(22);
    expect(MAP_MAX_ZOOM).toBeGreaterThanOrEqual(ZOOM_MAX_PARQUE);
  });

  it('no acerca más al parque que el nivel de las teselas del mapa base', () => {
    expect(ZOOM_MAX_PARQUE).toBe(19);
  });

  it('acerca menos a un parque identificado solo por su centroide', () => {
    // La vista no debe quedar tan cerca del punto como para perder el contexto.
    expect(ZOOM_MAX_PARQUE_CENTROIDE).toBeLessThan(ZOOM_MAX_PARQUE);
  });
});

describe('mapas.config · distrito de San Isidro', () => {
  it('sitúa el centro del distrito en el Jirón Augusto Tamayo', () => {
    expect(SAN_ISIDRO_CENTER).toHaveLength(2);
    expect(SAN_ISIDRO_CENTER[0]).toBeCloseTo(-77.0295, 3);
    expect(SAN_ISIDRO_CENTER[1]).toBeCloseTo(-12.0972, 3);
  });

  it('declara la extensión en EPSG:32718 como [oeste, sur, este, norte]', () => {
    expect(SAN_ISIDRO_EXTENT).toHaveLength(4);
    const [oeste, sur, este, norte] = SAN_ISIDRO_EXTENT;
    expect(oeste).toBeLessThan(este);
    expect(sur).toBeLessThan(norte);
    // Coordenadas de la zona 18S (millares): ~275-282 km E, ~8660-8663 km N.
    expect(oeste).toBeGreaterThan(0);
    expect(sur).toBeGreaterThan(1_000_000);
  });

  it('abre la vista del distrito más cerca que la vista inicial', () => {
    expect(SAN_ISIDRO_ZOOM).toBeGreaterThan(INITIAL_ZOOM);
    expect(SAN_ISIDRO_ZOOM).toBeLessThanOrEqual(ZOOM_MAX_PARQUE);
  });

  it('exige acercarse al distrito para aceptar los términos', () => {
    expect(TERMS_ZOOM_DISTRICTO).toBeGreaterThan(INITIAL_ZOOM);
    expect(TERMS_ZOOM_DISTRICTO).toBeLessThanOrEqual(SAN_ISIDRO_ZOOM);
  });
});

describe('mapas.config · animación y apilado', () => {
  it('anima el mapa con una duración noticeable y expresada en milisegundos', () => {
    expect(ANIMATION_DURATION).toBeGreaterThanOrEqual(300);
    expect(ANIMATION_DURATION).toBeLessThanOrEqual(3000);
  });

  it('apila las geometrías del usuario por encima de todo lo demás', () => {
    // Por encima de los mapas base, las ortofotos, la cuadrícula UTM (998) y los
    // resaltados de búsqueda e impresión, para que nunca queden ocultas.
    expect(ZINDEX_GEOMETRIAS_USUARIO).toBeGreaterThan(1001);
    expect(ZINDEX_GEOMETRIAS_USUARIO).toBeLessThanOrEqual(1002);
  });
});