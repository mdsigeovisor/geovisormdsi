/** Coordenadas iniciales del centro del mapa (longitud, latitud) */
export const INITIAL_CENTER = [-75.0152, -9.19];
/** Nivel de zoom inicial del mapa */
export const INITIAL_ZOOM = 6;
/** URL del servicio de mapas satelitales de Google */
export const GOOGLE_SATELLITE_URL = 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}';
/** URL del servicio de mapas de calles (OpenStreetMap) */
export const OSM_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
/** URL del servidor WMS de INEI para departamentos */
export const TRAMA_WMS_URL = 'https://geoespacial.inei.gob.pe/geoserver/Interoperabilidad/wms';
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