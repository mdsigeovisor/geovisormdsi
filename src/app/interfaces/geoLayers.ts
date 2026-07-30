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
  expanded: boolean;
  layers: LayerItem[];
}
export interface Section {
  id: string;
  title: string;
  subtitle?: string;
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
