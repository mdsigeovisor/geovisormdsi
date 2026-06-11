import { Injectable, signal, inject, NgZone, effect } from '@angular/core';
import { OtrosService } from './otros.service';
import { environment } from '../../environments/environment';
import { easeOut } from 'ol/easing';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import {
  fromLonLat,
  OlMap,
  TileLayer,
  TileWMS,
  View,
  XYZ
  , transform,
  transformExtent
} from '../modules/openlayers.module';

/** Coordenadas iniciales del centro del mapa (longitud, latitud) */
export const INITIAL_CENTER = [-75.0152, -9.19];
/** Nivel de zoom inicial del mapa */
export const INITIAL_ZOOM = 6;
/** URL del servicio de mapas satelitales de Google */
const GOOGLE_SATELLITE_URL = 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}';
/** URL del servicio de mapas de calles (OpenStreetMap) */
export const OSM_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
/** URL del servidor WMS de INEI para departamentos */
const TRAMA_WMS_URL = 'https://geoespacial.inei.gob.pe/geoserver/Interoperabilidad/wms';
/** Duración de las animaciones del mapa en milisegundos */
export const ANIMATION_DURATION = 1000;
/** Nivel de zoom al que se acerca el mapa al obtener la ubicación del usuario */
export const ZOOM_LEVEL_LOCATION = 14;

/** Extensión geográfica aproximada de San Isidro [oeste, sur, este, norte] en LonLat */
// Coordenadas actualizadas para Jirón Augusto Tamayo (lon, lat)
export const SAN_ISIDRO_CENTER: [number, number] = [-77.0295427, -12.0972444];
export const SAN_ISIDRO_ZOOM = 17;

export interface LayerItem {
  id: string;
  label: string;
  visible: boolean;
  opacity: number;
  olLayer?: TileLayer;
  legendUrl?: string; // Añadimos la propiedad legendUrl
}

export interface Section {
  id: string;
  title: string;
  expanded: boolean;
  layers: LayerItem[];
}

/**
 * Servicio de Angular para la gestión del mapa OpenLayers.
 * Encapsula toda la lógica relacionada con la inicialización, manipulación
 * y gestión de elementos del mapa, como capas, controles y overlays.
 */
@Injectable({
  providedIn: 'root'
})
export class MapService {
  private readonly http = inject(HttpClient);
  /** Instancia del mapa OpenLayers */
  private readonly _map = signal<OlMap | undefined>(undefined);
  /** Exposición del mapa como Signal de solo lectura */
  private readonly zone = inject(NgZone);
  public readonly map = this._map.asReadonly();

  /** Servicio para fuentes de datos externas */
  private readonly otrosService = inject(OtrosService);
  /** Capa de imágenes satelitales (Google) */
  public satelliteLayer?: TileLayer;
  /** Capa de calles (OSM) */
  public streetsLayer?: TileLayer;

  /**
   * Signal que gestiona las secciones y capas del visor.
   */
  sections = signal<Section[]>([
    {
      id: "tematica",
      title: "Información Temática",
      expanded: false,
      layers: [
        { id: "zonificacion", label: "ZONIFICACIÓN", visible: true, opacity: 1 },
        { id: "equipamiento", label: "EQUIPAMIENTO URBANO", visible: true, opacity: 1 },
        { id: "clasificacion", label: "CLASIFICACIÓN DEL PREDIO (TEMÁTICO)", visible: true, opacity: 1 },
      ],
    },
    {
      id: "catastral",
      title: "Información Catastral",
      expanded: true,
      layers: [
        { id: "sector", label: "SECTOR CATASTRAL", visible: true, opacity: 1 },
        { id: "manzana", label: "MANZANA CATASTRAL", visible: true, opacity: 1 },
        { id: "lote", label: "LOTE CATASTRAL", visible: true, opacity: 1 },
        { id: "parques", label: "PARQUES", visible: true, opacity: 1 },
        { id: "vias", label: "VIAS", visible: true, opacity: 1 },
        { id: "edificaciones", label: "EDIFICACIONES", visible: true, opacity: 1 },
        { id: "construcciones", label: "CONSTRUCCIONES", visible: true, opacity: 1 },
        { id: "puerta", label: "PUERTA (NUMERO MUNICIPAL / TIPO)", visible: true, opacity: 1 },
      ],
    },
    {
      id: "habilitacion",
      title: "Habilitación Urbana",
      expanded: false,
      layers: [
        { id: "limite", label: "LIMITE DE HABILITACION URBANA (NUCLEO)", visible: true, opacity: 1 },
        { id: "manzana-urbana", label: "MANZANA URBANA", visible: true, opacity: 1 },
        { id: "lote-urbano", label: "LOTE URBANO", visible: true, opacity: 1 },
      ],
    },
    {
      id: "nacional",
      title: "Información Nacional",
      expanded: false,
      layers: [
        { id: "ig_departamento", label: "IG DEPARTAMENTO", visible: true, opacity: 1 },
      ],
    },
  ]);

  constructor() {
    // Efecto para sincronizar la visibilidad del mapa cuando cambia el signal de secciones
    effect(() => {
      // Iteramos sobre las secciones y capas
      this.sections().forEach((section: Section) => {
        section.layers.forEach((layerData: LayerItem) => {
          // Si la capa de OpenLayers ya está instanciada, sincronizamos su estado
          if (layerData.olLayer) {
            layerData.olLayer.setVisible(layerData.visible);
            layerData.olLayer.setOpacity(layerData.opacity);
          }
        });
      });
    });
  }

  /**
   * Signal que indica si el mapa ha sido inicializado y está listo para su uso.
   * @type {Signal<boolean>}
   */
  isReady = signal(false);

  /**
   * Signal que almacena las coordenadas actuales del usuario (longitud, latitud).
   * Es `null` si la ubicación no ha sido obtenida o ha sido limpiada.
   * @type {Signal<{ lon: number, lat: number } | null>}
   */
  userCoords = signal<{ lon: number, lat: number } | null>(null);

  /**
   * Signal que almacena el tipo de mapa base actual.
   * @type {WritableSignal<'satellite' | 'streets'>}
   */
  baseLayerType = signal<'satellite' | 'streets'>('streets');

  /**
   * Signal que rastrea qué herramientas del sidebar están activas.
   * @type {WritableSignal<Set<string>>}
   */
  activeSidebarTools = signal<Set<string>>(new Set());

  /**
   * Inicializa el mapa OpenLayers en el elemento HTML proporcionado.
   * Configura las capas base, controles y vista inicial.
   */
  initMap(target: HTMLElement): OlMap {
    this.isReady.set(false);
    if (this._map()) {
      this._map()!.setTarget(target);
      // Retardo de 10 segundos para mostrar el spinner si el mapa ya existe
      setTimeout(() => this.isReady.set(true), 5000);
      return this._map()!;
    }

    // Inicialización de fuentes
    const satelliteSource = new XYZ({
      url: GOOGLE_SATELLITE_URL,
      crossOrigin: 'anonymous',
      transition: 1000, // 1 segundo de fade-in para una aparición muy elegante
      interpolate: true // Evita que se vean cuadrados pixelados al hacer zoom
    });
    const streetsSource = new XYZ({
      url: OSM_URL,
      crossOrigin: 'anonymous',
      transition: 1000,
      interpolate: true
    });

    // Creación de capas base usando método auxiliar
    this.satelliteLayer = this.createBaseLayer(satelliteSource, 'Satélite', 'satellite');
    this.streetsLayer = this.createBaseLayer(streetsSource, 'Calles', 'streets');

    const olMap = new OlMap({
      target,
      layers: [this.streetsLayer, this.satelliteLayer],
      view: new View({
        center: fromLonLat(INITIAL_CENTER),
        zoom: INITIAL_ZOOM,
        maxZoom: 22,
      })
    });
    this._map.set(olMap);

    // Cambiar el cursor a mano (pointer) al estar sobre el mapa
    olMap.getViewport().style.cursor = 'pointer';

    // Inicialización de la capa WMS de departamentos de INEI
    this.addWmsLayer({
      id: 'ig_departamento',
      url: TRAMA_WMS_URL,
      version: '1.1.0',
      layerName: 'Interoperabilidad:ig_departamento',
      zIndex: 5, // zIndex para posicionarse sobre el mapa base
      title: 'IG Departamento'
    });

        // Inicialización de la capa WMS de Lotes (mdsibde:vw_tg_lote)
    this.addWmsLayer({
      id: 'lote',
      url: `${environment.geoserver.serverUrl}/${environment.geoserver.workspace}/wms`,
      version: '1.1.0',
      layerName: 'mdsibde:vw_tg_lote',
      zIndex: 10,
      title: 'Lote Catastral'
    });
    // Inicialización de la capa WMS de Lotes (mdsibde:vw_tg_lote_puntos)
    this.addWmsLayer({
      id: 'lote',
      // Agregamos ?tiled=true al final de la URL del servidor
      url: `${environment.geoserver.serverUrl}/${environment.geoserver.workspace}/wms?tiled=true`,
      version: '1.1.0',
      layerName: 'mdsibde:vw_tg_lote_puntos',
      zIndex: 10,
      title: 'Lote Catastral'
    });
    // Inicialización de la capa WMS de Lotes (mdsibde:vw_tg_manzana)
    this.addWmsLayer({
      id: 'lote',
      url: `${environment.geoserver.serverUrl}/${environment.geoserver.workspace}/wms`,
      version: '1.1.0',
      layerName: 'mdsibde:vw_tg_manzana',
      zIndex: 0,
      title: 'Manzana Catastral'
    });
    this.addWmsLayer({
      id: 'lote',
      url: `${environment.geoserver.serverUrl}/${environment.geoserver.workspace}/wms`,
      version: '1.1.0',
      layerName: 'mdsibde:vw_tg_manzana_puntos',
      zIndex: 10,
      title: 'Manzana Catastral'
    });

    // Ejecutamos fuera de la zona de Angular para no bloquear la UI ni disparar CD
    // Usamos requestAnimationFrame para sincronizar con el refresco de pantalla
    this.zone.runOutsideAngular(() => {
      requestAnimationFrame(() => {
        olMap.updateSize();
      });
    });

    // Esperamos a que el mapa termine de renderizar su primera vista
    olMap.once('rendercomplete', () => {
      // Retardo de 10 segundos una vez que el mapa está técnicamente listo
      setTimeout(() => {
        this.isReady.set(true);
      }, 10000);
    });

    return olMap;
  }

  /**
   * Método auxiliar para estandarizar la creación de capas base.
   * @private
   */
  private createBaseLayer(source: XYZ, title: string, type: 'streets' | 'satellite'): TileLayer {
    return new TileLayer({
      source,
      properties: { title },
      preload: 0, // 0 es el valor por defecto y el más eficiente para el arranque
      visible: this.baseLayerType() === type
    });
  }

  /**
   * Método genérico para agregar capas WMS al mapa.
   * @private
   */
  private addWmsLayer(options: {
    id: string;
    url: string;
    version: string;
    layerName: string;
    zIndex: number;
    title?: string;
    minZoom?: number;
    maxZoom?: number;
    className?: string;
  }): void {
    const map = this._map();
    if (!map) return;

    const layer = new TileLayer({
      source: new TileWMS({
        url: options.url,
        params: {
          'LAYERS': options.layerName,
          'TILED': true,
          'VERSION': options.version,
          'FORMAT': 'image/png',
          'TRANSPARENT': true
        },
        crossOrigin: 'anonymous',
        serverType: 'geoserver'
      }),
      className: options.className, // Aplicamos la clase CSS a la capa
      zIndex: options.zIndex,
      minZoom: options.minZoom, // Añadimos la propiedad minZoom aquí
      maxZoom: options.maxZoom, // La capa se ocultará si el zoom es igual o mayor a este valor
      properties: { id: options.id, title: options.title }
    });

    map.addLayer(layer);

    const { url, version, layerName, id } = options;

    // IMPORTANTE: Guardamos la instancia de la capa en el Signal para poder manipularla después
    // Generamos la URL de la leyenda para servicios WMS (estándar GetLegendGraphic)
    const legendUrl = `${url}${url.includes('?') ? '' : '?'}` +
      `SERVICE=WMS&VERSION=${version}&REQUEST=GetLegendGraphic&FORMAT=image/png&LAYER=${layerName}&TRANSPARENT=true`;

    this.sections.update(sections => sections.map(section => ({
      ...section,
      layers: section.layers.map(l => l.id === id ? { ...l, olLayer: layer, legendUrl } : l)
    })));
  }

  /**
   * Centra y acerca el mapa al distrito de San Isidro con un vuelo animado.
   */
  goToCoordinates(lat: number, lon: number, zoom = SAN_ISIDRO_ZOOM, duration = 1800, onComplete?: (complete: boolean) => void): void {
    const map = this._map();
    if (!map) return;

    const view = map.getView();
    const currentZoom = view.getZoom() ?? INITIAL_ZOOM;

    view.animate({
      zoom: Math.max(currentZoom - 1, 4),
      duration: 500,
      easing: easeOut
    }, {
      center: fromLonLat([lon, lat]),
      zoom,
      duration,
      easing: easeOut
    }, (complete) => {
      if (complete && onComplete) onComplete(complete);
    });
  }

  /**
   * Desplaza un punto (lon, lat) en metros en coordenadas proyectadas (EPSG:3857)
   * dx: desplazamiento en metros hacia el este (+), dy: hacia el norte (+)
   */
  offsetLonLat(lon: number, lat: number, dx = 0, dy = 0): [number, number] {
    // Transformar a EPSG:3857, aplicar desplazamiento en metros y volver a EPSG:4326
    const p3857 = transform([lon, lat], 'EPSG:4326', 'EPSG:3857') as [number, number];
    const shifted: [number, number] = [p3857[0] + dx, p3857[1] + dy];
    const res = transform(shifted, 'EPSG:3857', 'EPSG:4326') as [number, number];
    return res;
  }

  /**
   * Centra y acerca el mapa al distrito de San Isidro usando la constante
   * `SAN_ISIDRO_CENTER`. Esta función mantiene compatibilidad con llamadas
   * previas que no pasan explícitamente lat/lon.
   */
  goToSanIsidro(duration = 1800, onComplete?: (complete: boolean) => void): void {
    // SAN_ISIDRO_CENTER almacena [lon, lat]
    const lon = SAN_ISIDRO_CENTER[0];
    const lat = SAN_ISIDRO_CENTER[1];
    // Desplazar 200 metros hacia la derecha (este)
    const [shiftedLon, shiftedLat] = this.offsetLonLat(lon, lat, 200, 0);
    this.goToCoordinates(shiftedLat, shiftedLon, SAN_ISIDRO_ZOOM, duration, onComplete);
  }

  /**
   * Métodos para actualizar el estado de las secciones desde la UI
   */
  toggleSectionExpanded(sectionId: string) {
    this.sections.update(s => s.map(sec =>
      sec.id === sectionId ? { ...sec, expanded: !sec.expanded } : sec
    ));
  }

  toggleLayerVisibility(sectionId: string, layerId: string) {
    this.sections.update(s => s.map(sec =>
      sec.id === sectionId ? {
        ...sec,
        layers: sec.layers.map((l: LayerItem) => l.id === layerId ? { ...l, visible: !l.visible } : l)
      } : sec
    ));
  }

  setLayerVisibility(sectionId: string, layerId: string, visible: boolean) {
    this.sections.update(s => s.map(sec =>
      sec.id === sectionId ? {
        ...sec,
        layers: sec.layers.map((l: LayerItem) => l.id === layerId ? { ...l, visible } : l)
      } : sec
    ));
  }

  toggleAllLayersInSection(sectionId: string, visible: boolean) {
    this.sections.update(s => s.map(sec =>
      sec.id === sectionId ? {
        ...sec,
        layers: sec.layers.map((l: LayerItem) => ({ ...l, visible }))
      } : sec
    ));
  }

  /**
   * Alterna la herramienta activa del sidebar. Si se hace clic en la misma, se cierra.
   * @param toolId Identificador de la herramienta (ej: 'layers')
   */
  toggleSidebarTool(toolId: string): void {
    this.activeSidebarTools.update(tools => {
      const newTools = new Set(tools);
      if (newTools.has(toolId)) {
        newTools.delete(toolId);
      } else {
        newTools.add(toolId);
      }
      return newTools;
    });
  }

  /**
   * Ajusta la vista del mapa para encuadrar una geometría GeoJSON (Polygon, MultiPolygon, etc.)
   * @param geometry Objeto de geometría devuelto por el servicio WFS
   */
  fitToGeometry(geometry: any): void {
    const map = this._map();
    if (!map || !geometry || !geometry.coordinates) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let hasCoords = false;

    // Función recursiva para procesar coordenadas de cualquier profundidad (Polygon o MultiPolygon)
    const processCoords = (arr: any[]) => {
      if (typeof arr[0] === 'number') {
        const [x, y] = arr;
        if (isNaN(x) || Math.abs(x) === Infinity) return;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        hasCoords = true;
      } else {
        arr.forEach(c => processCoords(c));
      }
    };

    processCoords(geometry.coordinates);

    if (!hasCoords) return;

    const view = map.getView();
    const extent = [minX, minY, maxX, maxY];

    // Detectamos si las coordenadas son UTM (proyectadas) o WGS84 (geográficas)
    // Si el valor es mayor a 180, asumimos que es una proyección (UTM)
    const sourceProjection = Math.abs(minX) > 180 ? 'EPSG:32718' : 'EPSG:4326';

    const transformedExtent = transformExtent(extent, sourceProjection, view.getProjection());

    view.fit(transformedExtent, {
      duration: ANIMATION_DURATION,
      padding: [100, 100, 100, 100] // Margen para no quedar pegado a los bordes
    });
  }

  /**
   * Busca un lote por su código catastral (id_lote) consultando el servicio WFS de GeoServer.
   * @param codigo Código catastral en formato XX-XXX-XXX
   * @returns Observable con el feature encontrado o null
   */
  searchLoteByCodigo(codigo: string): Observable<any> {
    const url = `${environment.geoserver.serverUrl}/${environment.geoserver.workspace}/ows`;
    
    // Limpiamos guiones y espacios en blanco (ej: '3112065002    ' -> '3112065002')
    const codigoSinGuiones = codigo.replaceAll('-', '').trim();

    // Usamos HttpParams para asegurar la correcta construcción y codificación del cql_filter
    const params = new HttpParams()
      .set('service', 'WFS')
      .set('version', '1.1.0')
      .set('request', 'GetFeature')
      .set('typeName', 'mdsibde:vw_tg_lote')
      .set('outputFormat', 'application/json')
      // Forzamos a GeoServer a entregar coordenadas en grados decimales
      .set('srsName', 'EPSG:4326')
      // IMPORTANTE: Se añade el operador '=' entre el campo y el valor
      .set('cql_filter', `id_lote = '${codigoSinGuiones}'`);

    return this.http.get(url, { params }).pipe(
      map((response: any) => {
        if (response && response.features && response.features.length > 0) {
          // Devolvemos el primer resultado encontrado
          return response.features[0];
        }
        return null;
      })
    );
  }
}
