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
  /**
   * Leyendas de la capa: una imagen por cada capa WMS que compone el servicio
   * (ver `WmsLayerConfig.legendLayerName`). Se generan al cargar la capa en el
   * mapa y el panel de leyenda muestra todas; `legendUrl` conserva la primera
   * por compatibilidad.
   */
  legendUrls?: string[];
}
export interface WmsLayerConfig {
  id: string;
  /**
   * Capa del servicio WMS que se va a publicar.
   *
   * Admite varias capas separadas por comas (`WEB_GIS:capa_a,WEB_GIS:capa_b`)
   * para declarar una capa COMPUESTA: se dibuja con una sola petición GetMap
   * (en el orden indicado, la primera queda debajo) y el panel de capas la
   * controla con un único interruptor, opacidad y leyenda.
   */
  layerName: string;
  /**
   * Capa (o capas separadas por comas) de las que se genera la leyenda
   * (`GetLegendGraphic`). Si se indican varias, se pide UNA imagen de leyenda por
   * capa —así no se depende del soporte de leyendas multi-capa del GeoServer— y el
   * panel de leyenda las muestra todas bajo el mismo título. Solo hace falta
   * cuando `layerName` es una capa compuesta; por defecto se usa `layerName`.
   */
  legendLayerName?: string;
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

/* ------------------------------------------------------------------------- */
/*  Resultados de las consultas/APIs del Geovisor                             */
/* ------------------------------------------------------------------------- */

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

/** Coincidencia de titular catastral devuelta por el API del Geovisor. */
export interface TitularCatastral {
  txttitular: string;
  codlote: string;
  /** Datos de la vía asociada al lote (según respuesta del API) */
  tipvia?: string;
  nomvia?: string;
  numero?: string;
}

/** Registro de búsqueda por denominación de predio devuelto por el API del Geovisor (`busqueda-denominacion-lote`). */
export interface DenominacionLoteResultado {
  codlote: string;
  txtcuc: string;
  txtdenominacion: string;
  txtmzaurbano: string;
  txtloteurbano: string;
  lotecodcatant: string;
  codlotecatastral: string;
  txtdirecprincipal: string;
}

/** Registro de numeración de vía devuelto por el API del Geovisor. */
export interface ViaNumero {
  numero: string;
  codlote: string;
  codlotenumero: string;
}

/** Registro de búsqueda por CUC devuelto por el API del Geovisor (`busqueda-cuc`). */
export interface CucResultado {
  txtcuc: string;
  txtpropietario: string;
  codlote: string;
  codvia: string;
  tipvia: string;
  nomvia: string;
  via: string;
  numero: string;
  txttipint: string;
  codtipint: string;
  numeroint: string;
}

/** Registro de búsqueda por Código Predial devuelto por el API del Geovisor (`busqueda-codpredial`). */
export interface CodPredialResultado {
  txtcodipredrent: string;
  txtcuc: string;
  txttitular: string;
  codlote: string;
  codvia: string;
  tipvia: string;
  nomvia: string;
  via: string;
  numero: string;
  txttipint: string;
  codtipint: string;
  numeroint: string;
}

/** Sugerencia de vía con su código, para el flujo de numeraciones. */
export interface ViaSugerencia {
  etiqueta: string;
  codVia: string;
}

/* ------------------------------------------------------------------------- */
/*  Estado del visor                                                          */
/* ------------------------------------------------------------------------- */

/** Tipos de mapa base disponibles en el visor. */
export type TipoMapaBase = 'satellite' | 'streets' | 'topo' | 'blanco';

/**
 * Datos resumidos de un lote devueltos por el API listar-datos-lote del
 * Geovisor municipal. Se muestran en el popup al pasar el mouse sobre el lote.
 */
export interface LoteDatosHover {
  codlote: string;
  txtcuc: string;
  txtmzaurbano: string;
  txtloteurbano: string;
  lotecodcatant: string;
  codlotecatastral: string;
  txtdirecprincipal: string;
}

/**
 * Ventana flotante con la información de un lote.
 * Varias pueden estar abiertas simultáneamente sin bloquear el mapa.
 */
export interface LoteInfoWindow {
  /** Código catastral del lote (identificador único de la ventana) */
  id: string;
  /** URL de la ficha del lote */
  url: string;
  /** Posición horizontal (px) respecto al viewport */
  x: number;
  /** Posición vertical (px) respecto al viewport */
  y: number;
  /** Título de la ventana. Si no se define, usa "Información del Lote". */
  title?: string;
  /** Ancho de la ventana en px. Por defecto 700. */
  width?: number;
  /** Alto de la ventana en px. Por defecto 520. */
  heightPx?: number;
  /** Prioridad (z-index) de la ventana. Por defecto 1040. */
  zIndex?: number;
}

/**
 * Lámina PDF asociada a una vía de la capa "Sección de Vías Normativas
 * Metropolitanas" (ORD. N° 2343-MML), que se muestra en un modal al hacer clic
 * sobre su eje.
 */
export interface LaminaSeccionVialMetro {
  /** Valor del campo llave `refname` del eje consultado (p. ej. `E16`). */
  refname: string;
  /** Tipo de vía informado por la capa (p. ej. `CORTES EXPRESAS`). */
  tipo: string;
  /** Nombre del PDF en el servidor (p. ej. `E-16.pdf`). */
  archivo: string;
  /** URL de la lámina para el visor; `null` cuando la lámina no está publicada. */
  url: string | null;
}

/** Configuración de una capa consultable al hacer clic sobre el mapa. */
export interface ClickableLayerConfig {
  /** Identificador de la capa en el panel de capas. */
  layerId: string;
  /** Obtiene la capa de OpenLayers asociada. */
  getLayer: () => ImageLayer<ImageWMS> | undefined;
  /** Lógica a ejecutar cuando el clic acierta sobre un feature de esta capa. */
  handler: (feature: GeoJSONFeature) => void;
}
