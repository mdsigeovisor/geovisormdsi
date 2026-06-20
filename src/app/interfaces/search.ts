import { GeoJSONGeometry } from './geoLayers';

/** Interfaz para los resultados de búsqueda de predios */
export interface SearchResult {
  codigoCatastral: string;
  direccion: string;
  propietario?: string;
  area?: string;
  zonificacion?: string;
  fotoFrontis: string;
  numeroPisos?: number;
  materialPredominante?: string;
  estadoConservacion?: string;
  geometry?: GeoJSONGeometry;
}