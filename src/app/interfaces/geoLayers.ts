import {
  TileLayer,
} from '../modules/openlayers.module';
import ImageLayer from 'ol/layer/Image';
import ImageWMS from 'ol/source/ImageWMS';

/** Estructura básica de una geometría GeoJSON, incluyendo GeometryCollection */
export interface GeoJSONGeometry {
  type: 'Point' | 'LineString' | 'Polygon' | 'MultiPolygon' | 'MultiLineString' | 'GeometryCollection';
  coordinates?: any[]; // Coordenadas para geometrías simples
  geometries?: GeoJSONGeometry[]; // Array de geometrías para GeometryCollection
}

/** Estructura de un Feature devuelto por GeoServer */
export interface GeoJSONFeature {
  type: 'Feature';
  id?: string;
  /** Sistema de referencia declarado por GeoServer (p. ej. en respuestas GetFeatureInfo) */
  crs?: { type: string; properties: { name: string } };
  geometry: GeoJSONGeometry;
  properties: Record<string, any>;
}

export interface WfsResponse {
  features: GeoJSONFeature[];
  totalFeatures: number;
  type: 'FeatureCollection';
}

/** Configuración para la inicialización de capas WMS */
export interface LayerItem {
  showInLegend: boolean;
  /** Si es true, la capa solo se muestra en el panel cuando el usuario está autenticado. */
  requiresAuth?: boolean;
  /**
   * Si es true, la capa se muestra "bloqueada" en el panel: checkbox atenuado,
   * candado y sin posibilidad de activarla. Se usa para capas en desarrollo
   * (sin servicio WMS asociado).
   */
  disabled?: boolean;
  type: 'layer';
  id: string;
  label: string;
  visible: boolean;
  opacity: number;
  olLayer?: TileLayer | ImageLayer<ImageWMS>;
  legendUrl?: string; // Añadimos la propiedad legendUrl
}
export interface WmsLayerConfig {
  id: string;
  layerName: string;
  zIndex: number;
  title: string;
  url?: string;
  version?: string;
  tiled?: boolean;
  minZoom?: number;
  maxZoom?: number;
  className?: string;
}
export interface SubSection {
  type: 'subsection';
  id: string;
  title: string;
  subtitle?: string;
  /** Si es true, la subsección completa solo se muestra con sesión iniciada. */
  requiresAuth?: boolean;
  expanded: boolean;
  layers: LayerItem[];
}
export interface Section {
  id: string;
  title: string;
  subtitle?: string;
  /** Si es true, toda la sección solo se muestra con sesión iniciada. */
  requiresAuth?: boolean;
  expanded: boolean;
  items: (LayerItem | SubSection)[];
}

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
