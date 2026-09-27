/** Coordenadas iniciales del centro del mapa (longitud, latitud) */
import { environment } from '../../environments/environment';

export const INITIAL_CENTER = [-75.0152, -9.19];
/** Nivel de zoom inicial del mapa */
export const INITIAL_ZOOM = 6;
/**
 * Nivel de zoom máximo permitido al hacer scroll o zoom-in.
 * Por encima del `maxZoom` nativo de cada fuente de teselas (ortofotos: 22,
 * mapas base: 19) OpenLayers amplía ("overzoom") la tesela disponible con
 * interpolación, por lo que subir este valor no genera peticiones 404.
 */
export const MAP_MAX_ZOOM = 30;
/** URL del servicio de mapas satelitales de Google */
export const GOOGLE_SATELLITE_URL = 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}';
/** URL del servicio de mapas de calles (OpenStreetMap) */
export const OSM_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}';
/** URL del servidor WMS de INEI para departamentos (sigue el GeoServer del ambiente activo) */
export const TRAMA_WMS_URL = environment.geoserver.wmsUrl;
/** Duración de las animaciones del mapa en milisegundos */
export const ANIMATION_DURATION = 1000;
/** Nivel de zoom al que se acerca el mapa al obtener la ubicación del usuario */
export const ZOOM_LEVEL_LOCATION = 14;
/** 
 * Extensión geográfica aproximada de San Isidro [oeste, sur, este, norte] en LonLat 
 * Coordenadas actualizadas para Jirón Augusto Tamayo (lon, lat)
 */
export const SAN_ISIDRO_CENTER: [number, number] = [-77.0295427, -12.0972444];
/** Zoom específico para la vista del distrito */
export const SAN_ISIDRO_ZOOM = 17;
/** Extensión geográfica del distrito de San Isidro en EPSG:32718 */
export const SAN_ISIDRO_EXTENT = [275224.08, 8660213.79, 281557.72, 8663299.55];
/** Zoom mínimo para considerar que el usuario está viendo el distrito (dispara el aviso de Términos y Condiciones) */
export const TERMS_ZOOM_DISTRICTO = 14;
/**
 * Convención de apilado (zIndex) de las capas del visor, de menor a mayor:
 * - `0 – 15`: capas WMS temáticas y ortofotos (las imágenes aéreas usan 5).
 * - `998`: cuadrícula UTM-18S de la captura de planos.
 * - `1000`: resaltado de geometrías de búsqueda.
 * - `1001`: lote seleccionado para impresión (borde rojo).
 * - `1002`: geometrías creadas por el usuario (herramientas de dibujo y
 *   marcador del buscador de coordenadas). Deben quedar SIEMPRE por encima de
 *   las imágenes aéreas y de las capas WMS, para que no queden ocultas al
 *   activar una ortofoto.
 */
export const ZINDEX_GEOMETRIAS_USUARIO = 1002;
