import { Injectable, signal, inject, NgZone, effect } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { easeOut } from 'ol/easing';
import { Observable, map } from 'rxjs';
//* Interfaces
import { ORTOFOTO_YEARS } from '../interfaces/ortofotos';
import { LAYER_PANEL_SECTIONS } from '../interfaces/control_capas';
import {
  Section,
  WmsLayerConfig,
  GeoJSONFeature,
  LayerItem,  
  WfsResponse,
  GeoJSONGeometry
} from '../interfaces/geoLayers';
import {
  INITIAL_CENTER,
  INITIAL_ZOOM,
  GOOGLE_SATELLITE_URL,
  OSM_URL,
  TRAMA_WMS_URL,
  ANIMATION_DURATION,
  SAN_ISIDRO_CENTER,
  SAN_ISIDRO_ZOOM
} from '../interfaces/mapas.config';
//* OpenLayers
import {
  Feature,
  Fill,
  fromLonLat,  
  GeoJSON,
  getCenter,
  getDistance,
  ImageLayer,
  ImageWMS,
  OlMap,
  Overlay,
  Stroke,
  Style,
  TileLayer,
  transform,
  transformExtent,
  VectorLayer,
  VectorSource,
  View,
  WKT,
  XYZ,
} from '../modules/openlayers.module';

export type TipoMapaBase = 'satellite' | 'streets' | 'topo' | 'blanco';
/**
 * Servicio de Angular para la gestión del mapa OpenLayers.
 * Encapsula toda la lógica relacionada con la inicialización, manipulación
 * y gestión de elementos del mapa, como capas, controles y overlays.
 */
@Injectable({
  providedIn: 'root'
})
export class MapService {
  cambiarMapaBase(tipoMapaBase: TipoMapaBase): void {
    this.baseLayerType.set(tipoMapaBase);
    if (!this.satelliteLayer || !this.streetsLayer) {
      return;
    }
    switch (tipoMapaBase) {
      case 'satellite':
        this.satelliteLayer.setVisible(true);
        this.streetsLayer.setVisible(false);
        break;
      case 'streets':
        this.satelliteLayer.setVisible(false);
        this.streetsLayer.setVisible(true);
        break;
      case 'topo':
      case 'blanco':
        this.satelliteLayer.setVisible(false);
        this.streetsLayer.setVisible(false);
        break;
    }
  }

  private readonly http = inject(HttpClient);
  private readonly zone = inject(NgZone);
  baseLayerType = signal<TipoMapaBase>('streets');

  /** Instancia del mapa OpenLayers */
  private readonly _map = signal<OlMap | undefined>(undefined);
  /** Exposición del mapa como Signal de solo lectura */
  public readonly map = this._map.asReadonly();
  // Capas base accesibles para manipulación directa
  /** Capa de imágenes satelitales */
  public satelliteLayer?: TileLayer;
  /** Capa de calles (OSM) */
  public streetsLayer?: TileLayer;
  /** Capa para resaltar geometrías de búsqueda */
  private highlightLayer: VectorLayer<any> | undefined;
  /**
   * Configuración centralizada para las capas de ortofotos.
   * Esta será la única fuente de verdad para generar tanto los
   * controles en el panel de capas como las capas XYZ en el mapa.
   */
  private readonly ortofotoLayerConfigs = [
    // Generamos dinámicamente la configuración a partir de la lista de años importada.
    // Esto facilita la adición de nuevos años de ortofotos.
    ...ORTOFOTO_YEARS.map(year => ({ year, zIndex: 1 }))
  ] as const;
  /**
   * Signal que gestiona las secciones y capas del visor.
   */
  sections = signal<Section[]>(LAYER_PANEL_SECTIONS);
  /** Indica si el mapa ha sido inicializado y está listo para su uso. */
  isReady = signal(false);
  /** Coordenadas actuales del usuario (longitud, latitud). */
  userCoords = signal<{ lon: number, lat: number } | null>(null);
  /** Herramientas del sidebar activas. */
  activeSidebarTools = signal<Set<string>>(new Set());
  /** URL con la información de un lote para mostrar en un modal. */
  loteInfoUrl = signal<string | null>(null);
  /** URL con la información de la foto de dron 2018 para mostrar en un modal. */
  fotoDroneUrl2018 = signal<string | null>(null);
  /** URL con la información de la foto de dron 2024 para mostrar en un modal. */
  fotoDroneUrl2024 = signal<string | null>(null);
  /** Indica si el mapa está en medio de una animación de navegación programática. */
  isNavigating = signal(false);
  /** Overlay para el marcador de búsqueda */
  private searchMarkerOverlay: Overlay | undefined;
  /** Elemento HTML para el marcador de búsqueda, registrado por un componente. */
  private searchMarkerElement: HTMLElement | undefined;
  /**
   * Permite que un componente registre el elemento HTML que se usará para el marcador de búsqueda.
   * @param element El elemento del marcador.
   */
  registerSearchMarkerElement(element: HTMLElement) {
    this.searchMarkerElement = element;
    if (this.searchMarkerOverlay) {
      this.searchMarkerOverlay.setElement(this.searchMarkerElement);
    }
  }
  constructor() {
    this.setupLayerSyncEffect();
  }
  /**
   * Inicializa el mapa OpenLayers.
   */
  initMap(target: HTMLElement): OlMap {
    this.isReady.set(false);
    // Si el mapa ya existe, reasignamos el target
    if (this._map()) {
      const existingMap = this._map()!;
      existingMap.setTarget(target);
      setTimeout(() => this.isReady.set(true), 5000);
      return existingMap;
    }
    this.setupBaseLayers();
    const olMap = new OlMap({
      target,
      layers: [this.streetsLayer!, this.satelliteLayer!],
      view: new View({
        center: fromLonLat(INITIAL_CENTER),
        zoom: INITIAL_ZOOM,
        minZoom: 4,
        maxZoom: 22,
      })
    });
    this._map.set(olMap);
    olMap.getViewport().style.cursor = 'pointer';
    this.setupInitialWmsLayers();
    this.handleMapResizing(olMap);
    this.setupHighlightLayer();
    this.handleInitialRender(olMap);
    this.setupMapClickHandler(olMap);
    return olMap;
  }
  /**
   * Sincroniza la visibilidad y opacidad de las capas de OL con el Signal de secciones.
   */
  private setupLayerSyncEffect(): void {
    effect(() => {
      this.sections().forEach(section => {
        section.items.forEach((item: any) => {
          if ('layers' in item) { // Es una SubSection
            this.processSubSectionLayers(item.layers);
          } else { // Es un LayerItem
            this.processSingleLayerItem(item);
          }
        });
      });
    });
  }

  /**
   * Procesa un LayerItem individual para sincronizar su visibilidad y opacidad con OpenLayers.
   * @param layerItem El LayerItem a procesar.
   */
  private processSingleLayerItem(layerItem: LayerItem): void {
    if (layerItem.olLayer) {
      layerItem.olLayer.setVisible(layerItem.visible);
      layerItem.olLayer.setOpacity(layerItem.opacity);
    }
  }

  /**
   * Procesa una lista de LayerItems (típicamente de una SubSection) para sincronizar
   * su visibilidad y opacidad con OpenLayers.
   * @param layerItems La lista de LayerItems a procesar.
   */
  private processSubSectionLayers(layerItems: LayerItem[]): void {
    layerItems.forEach(layerItem => {
      if (layerItem.olLayer) {
        layerItem.olLayer.setVisible(layerItem.visible);
        layerItem.olLayer.setOpacity(layerItem.opacity);
      }
    });
  }
  /**
   * Configura las capas base de Google y OSM.
   */
  private setupBaseLayers(): void {
    const satelliteSource = new XYZ({
      url: GOOGLE_SATELLITE_URL,
      crossOrigin: 'anonymous',
      transition: 1000,
      interpolate: true, // Evita que se vean cuadrados pixelados al hacer zoom
      maxZoom: 19,
      wrapX: true
    });
    const streetsSource = new XYZ({
      url: OSM_URL,
      crossOrigin: 'anonymous',
      transition: 1000,
      interpolate: true,
      maxZoom: 19,
      wrapX: true,
      tileUrlFunction: (tileCoord) => {
        if (!tileCoord) {
          return undefined;
        }
        const [z, x, y] = tileCoord;
        if (z <= 19) {
          return OSM_URL
            .replace('{z}', String(z))
            .replace('{x}', String(x))
            .replace('{y}', String(y));
        }
        const delta = z - 19;
        const fallbackX = Math.floor(x / Math.pow(2, delta));
        const fallbackY = Math.floor(y / Math.pow(2, delta));
        return OSM_URL
          .replace('{z}', '19')
          .replace('{x}', String(fallbackX))
          .replace('{y}', String(fallbackY));
      }
    });
    this.satelliteLayer = this.createBaseLayer(satelliteSource, 'Satélite', 'satellite');
    this.streetsLayer = this.createBaseLayer(streetsSource, 'Calles', 'streets');
  }
  /** Configura la carga inicial de capas WMS. */
  private setupInitialWmsLayers(): void {
    // Inicialización de la capa WMS de departamentos
    this.addWmsLayer({
      id: 'tg_departamentos',
      url: TRAMA_WMS_URL,
      layerName: 'SIDES_GIS:tg_departamentos',
      version: '1.1.0',
      zIndex: 5, // zIndex para posicionarse sobre el mapa base
      title: 'Departamento del Perú',
    });
    // Configuración de capas catastrales municipales
    const workspacePrefix = environment.geoserver.workspacePrefix;
    const catastralLayers: WmsLayerConfig[] = [
      //* Trama Externa
      { id: 'mz_colindantes', layerName: `${workspacePrefix}tg_manzana_colindante,tg_oceano,tg_distrito_colin_nombres,tg_limiteDistrital`, zIndex: 0, title: 'Cartografia otros distritos'},
      //* Sectores
      { id: 'hab_urbana', layerName: `${workspacePrefix}gc_habilitacion_urbana`, zIndex: 2, title: 'Habilitación Urbana'},
      { id: 'sec_subvecinal', layerName: `${workspacePrefix}gc_subsector_vecinal`, zIndex: 2, title: 'Subsectores Vecinales'},
      { id: 'sec_vecinal', layerName: `${workspacePrefix}gc_sector_vecinal`, zIndex: 2, title: 'Sectores Vecinales'},
      { id: 'sec_catastrales', layerName: `${workspacePrefix}gc_sector_catastral`, zIndex: 2, title: 'Sectores Catastrales'},
      //* Capas Catastrales
      { id: 'construcciones', layerName: `${workspacePrefix}vw_tg_construcciones`, zIndex: 0.5, title: 'Construcciones' },
      { id: 'lote', layerName: `${workspacePrefix}gc_lote_catastral`, zIndex: 0, title: 'Lote Catastral' },
      { id: 'manzana', layerName: `${workspacePrefix}gc_manzana_catastral`, zIndex: 0, title: 'Manzana Catastral' },
      { id: 'veredas', layerName: `${workspacePrefix}vw_tg_comp_via`, zIndex: 0, title: 'Veredas' },      
      { id: 'arearecreativa', layerName: `${workspacePrefix}gc_area_verde`, zIndex: 1, title: 'Área Recreativa' },
      
      { id: 'vias', layerName: `${workspacePrefix}vw_tg_via`, zIndex: 2, title: 'Vias'},
      { id: 'num_cuadra', layerName: `${workspacePrefix}vw_tg_cuadra`, zIndex: 1, title: 'Número de Cuadras'},
      { id: 'puertas', layerName: `${workspacePrefix}vw_tg_puertas`, zIndex: 1, title: 'Puertas'},
      //* Vuelos
      { id: 'parques', layerName: `${workspacePrefix}vw_tg_area_rec_nombres`, zIndex: 1, title: 'Parques'},
      { id: 'fotos_sin_2018', layerName: `${workspacePrefix}vw_tg_fotosSinProcesar_2018`, zIndex: 1, title: 'Fotos sin Procesar - 2018'},
      { id: 'fotos_sin_2024', layerName: `${workspacePrefix}vw_tg_fotosSinProcesar_2024`, zIndex: 1, title: 'Fotos sin Procesar - 2024'},      
    ];

    // Añadimos las capas de ortofotos como XYZ usando la configuración centralizada
    this.ortofotoLayerConfigs.forEach(config => {
      this.addXyzLayer({
        id: `ortofoto_${config.year}`,
        url: `${environment.ortofotoServerUrl}/${config.year}/{z}/{x}/{y}.png`,
        maxZoom: 22,
        zIndex: config.zIndex
      });
    });
    // Inicializamos las capas catastrales recorriendo la lista
    catastralLayers.forEach(config => this.addWmsLayer(config));
  }
  
  /**
   * Asegura que el mapa se actualice fuera de la zona de Angular para rendimiento.
   */
  private handleMapResizing(olMap: OlMap): void {
    this.zone.runOutsideAngular(() => {
      requestAnimationFrame(() => {
        olMap.updateSize();
      });
    });
  }
  /**
   * Maneja el estado isReady tras el primer renderizado completo.
   */
  private handleInitialRender(olMap: OlMap): void {
    olMap.once('rendercomplete', () => {
      setTimeout(() => {
        this.isReady.set(true);
      }, 5000);
    });
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
  private addWmsLayer(options: WmsLayerConfig): void {
    const map = this._map();
    if (!map) return;
    const url = options.url ?? environment.geoserver.wmsUrl;
    const version = options.version ?? '1.1.0';
    const separator = url.includes('?') ? '&' : '?';
    const wmsUrl = options.tiled ? `${url}${separator}tiled=true` : url;
    const layer = new ImageLayer({
      source: new ImageWMS({
        url: wmsUrl,
        params: {
          'LAYERS': options.layerName,
          'TILED': true,
          'VERSION': version,
          'FORMAT': 'image/png',
          'TRANSPARENT': true
        },
        crossOrigin: 'anonymous',
        serverType: 'geoserver'
      }),
      className: options.className ?? options.id, // Aplicamos la clase CSS a la capa
      zIndex: options.zIndex,
      minZoom: options.minZoom, // Añadimos la propiedad minZoom aquí
      maxZoom: options.maxZoom, // La capa se ocultará si el zoom es igual o mayor a este valor
      properties: { id: options.id, title: options.title }
    });
    map.addLayer(layer);
    // Generamos la URL de la leyenda para servicios WMS (estándar GetLegendGraphic)
    const legendUrl = `${url}${url.includes('?') ? '&' : '?'}` +
      `SERVICE=WMS&VERSION=${version}&REQUEST=GetLegendGraphic&FORMAT=image/png&LAYER=${options.layerName}&TRANSPARENT=true`;
    this.sections.update(sections => sections.map(section => ({
      ...section,
      items: section.items.map(item => {
        if ('layers' in item) { // Es SubSection
          item.layers = item.layers.map(l => l.id === options.id ? { ...l, olLayer: layer, legendUrl } : l);
        } else if (item.type === 'layer' && item.id === options.id) { // Es LayerItem
          return { ...item, olLayer: layer, legendUrl };
        }
        return item;
      })
    })));
  }  
  /**
   * Método para agregar capas XYZ al mapa.
   * @private
   */
  private addXyzLayer(options: { id: string, url: string, maxZoom?: number, zIndex?: number }): void {
    const map = this._map();
    if (!map) return;

    const xyzSource = new XYZ({
      url: options.url,
      crossOrigin: 'anonymous',
      maxZoom: options.maxZoom,
      interpolate: true
    });

    const layer = new TileLayer({
      source: xyzSource,
      properties: { id: options.id },
      zIndex: options.zIndex,
      visible: false // Por defecto no visible
    });

    map.addLayer(layer);

    this.sections.update(sections => sections.map(section => ({
      ...section,
      items: section.items.map(item => {
        if ('layers' in item) { // Es SubSection
          item.layers = item.layers.map(l => l.id === options.id ? { ...l, olLayer: layer } : l);
        }
        return item;
      })
    })));
  }
  /**
   * Configura el manejador de clics en el mapa para obtener información de las capas WMS.
   * @param olMap Instancia del mapa de OpenLayers.
   */
  private setupMapClickHandler(olMap: OlMap): void {
    // Definimos las capas que queremos consultar en un clic y la lógica para cada una.
    const clickableLayersConfig = [
      {
        layerId: 'lote',
        getLayer: () => this.getLayerById('lote'),
        handler: (feature: GeoJSONFeature) => {
          const codigoLote = feature.properties['id_lote'];
          if (codigoLote) {
            const infoUrl = `http://192.168.41.160/DataGIS_WGS84/WEBFILES/informacion.asp?codigo_i=${codigoLote}`;
            this.loteInfoUrl.set(infoUrl);
          }
        }
      },
      {
        layerId: 'fotos_sin_2018',
        getLayer: () => this.getLayerById('fotos_sin_2018'),
        handler: (feature: GeoJSONFeature) => {
          const fotoId = feature.properties['id'];
          if (fotoId) {
            const droneUrl = `http://192.168.41.160/DataGIS_WGS84/WebFiles/2018Drone.asp?codigo_i=${fotoId}`;
            this.fotoDroneUrl2018.set(droneUrl);
          }
        }
      },
      {
        layerId: 'fotos_sin_2024',
        getLayer: () => this.getLayerById('fotos_sin_2024'),
        handler: (feature: GeoJSONFeature) => {
          const fotoId = feature.properties['id'];
          if (fotoId) {
            const droneUrl = `http://192.168.41.160/DataGIS_WGS84/WebFiles/2024Drone.asp?codigo_i=${fotoId}`;
            this.fotoDroneUrl2024.set(droneUrl);
          }
        }
      }
    ];
    olMap.on('singleclick', (evt) => {
      const view = olMap.getView();
      const viewResolution = view.getResolution()!;
      const projection = view.getProjection();
      // Priorizamos la capa visible con el zIndex más alto.
      const visibleClickableLayers = clickableLayersConfig
        .map(config => ({ config, layer: config.getLayer() }))
        .filter(item => item.layer?.getVisible())
        .sort((a, b) => (b.layer?.getZIndex() ?? 0) - (a.layer?.getZIndex() ?? 0));
      const queryNextLayer = (layers: typeof visibleClickableLayers) => {
        if (layers.length === 0) return;
        const { config, layer } = layers[0];
        const source = layer?.getSource();
        if (!source) {
          queryNextLayer(layers.slice(1)); // Intenta con la siguiente
          return;
        };
        const url = source.getFeatureInfoUrl(evt.coordinate, viewResolution, projection, { 'INFO_FORMAT': 'application/json', 'FEATURE_COUNT': '1' });
        if (url) {
          this.http.get<WfsResponse>(url).subscribe(response => {
            if (response?.features?.length > 0) {
              config.handler(response.features[0]); // Si encontramos algo, lo manejamos y paramos.
            } else {
              queryNextLayer(layers.slice(1)); // Si no, intentamos con la siguiente capa en la lista.
            }
          });
        } else {
          queryNextLayer(layers.slice(1));
        }
      };
      queryNextLayer(visibleClickableLayers);
    });
  }
  /**
   * Limpia la URL de información del lote, para cerrar el modal.
   */
  clearLoteInfo(): void {
    this.loteInfoUrl.set(null);
  }
  /**
   * Limpia la URL de la foto de dron de 2018, para cerrar el modal.
   */
  clearFotoDroneUrl2018(): void {
    this.fotoDroneUrl2018.set(null);
  }
  /**
   * Limpia la URL de la foto de dron de 2024, para cerrar el modal.
   */
  clearFotoDroneUrl2024(): void {
    this.fotoDroneUrl2024.set(null);
  }
  /**
   * Dibuja un marcador en el mapa en la ubicación de la geometría proporcionada.
   * @param geometry La geometría donde se centrará el marcador.
   * @param text Texto opcional para mostrar en el marcador.
   */
  drawSearchMarker(geometry: GeoJSONGeometry, text?: string): void {
    const map = this._map();
    if (!map || !this.searchMarkerElement) {
      console.warn('El marcador de búsqueda no se puede dibujar porque el elemento no ha sido registrado en MapService.');
      return;
    }
    const view = map.getView();
    const format = new GeoJSON();
    // Le indicamos a OL que la data viene en 32718 y la transforme a la proyección del mapa
    const olGeometry = format.readGeometry(geometry, {
      dataProjection: 'EPSG:32718',
      featureProjection: view.getProjection()
    });
    const center = getCenter(olGeometry.getExtent());

    if (!this.searchMarkerOverlay) {
      this.searchMarkerOverlay = new Overlay({
        element: this.searchMarkerElement,
        positioning: 'center-center',
        stopEvent: false,
      });
      map.addOverlay(this.searchMarkerOverlay);
    }
    // Actualizamos el texto si se proporciona
    const textElement = this.searchMarkerElement.querySelector('.search-marker-text');
    if (textElement) {
      textElement.innerHTML = text ?? '';
      // Hacemos visible el contenedor del texto si hay texto
      (textElement as HTMLElement).style.display = text ? 'block' : 'none';
    }
    this.searchMarkerElement.style.display = 'block';
    this.searchMarkerOverlay.setPosition(center);
    this.searchMarkerElement.style.transform = 'scale(2)'; // Duplicamos el tamaño del marcador
  }
  /** Limpia el marcador de búsqueda del mapa. */
  clearSearchMarker(): void {
    this.searchMarkerOverlay?.setPosition(undefined);
    this.highlightLayer?.getSource()?.clear();
  }
  /** Limpia solo la capa de resaltado de geometrías. */
  clearHighlightLayer(): void {
    this.highlightLayer?.getSource()?.clear();
  }
  /**
   * Remueve una capa del mapa definitivamente basándose en su ID.
   */
  removeLayerById(id: string): void {
    const currentMap = this._map();
    if (!currentMap) return;
    const layerToRemove = currentMap.getLayers().getArray()
      .find(layer => layer.get('id') === id);
    if (layerToRemove) currentMap.removeLayer(layerToRemove);
  }
  /**
   * Centra y acerca el mapa al distrito de San Isidro con un vuelo animado.
   */
  goToCoordinates(lat: number, lon: number, zoom = SAN_ISIDRO_ZOOM, duration = 2200, onComplete?: (complete: boolean) => void): void {
    const map = this._map();
    if (!map) return;

    this.isNavigating.set(true);

    const view = map.getView();
    const currentZoom = view.getZoom() ?? INITIAL_ZOOM;
    const currentCenter = view.getCenter()!;
    const destination = fromLonLat([lon, lat]);

    // Calculamos la distancia para decidir si hacer un "zoom out" drástico o no.
    // Una distancia mayor a 500km (500000m) justifica el zoom out.
    const distance = getDistance(currentCenter, destination);

    const completeCallback = (complete: boolean) => {
      this.isNavigating.set(false);
      if (complete && onComplete) {
        onComplete(complete);
      }
    };

    if (distance > 500000) { // Si estamos lejos, hacemos un zoom out primero
      view.animate({
        zoom: 4, // Zoom a nivel continental
        duration: duration / 3,
        easing: easeOut
      }, {
        center: destination,
        zoom,
        duration: duration * 2 / 3,
        easing: easeOut
      }, completeCallback);
    } else { // Si estamos cerca, solo nos movemos
      view.animate({ center: destination, zoom, duration, easing: easeOut }, completeCallback);
    }
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
    // Usamos goToCoordinates para una animación de "vuelo" más suave.
    this.goToCoordinates(SAN_ISIDRO_CENTER[1], SAN_ISIDRO_CENTER[0], SAN_ISIDRO_ZOOM, duration, onComplete);
  }
  /**
   * Centra el mapa en la extensión inicial del distrito sin activar el resaltado.
   * Ideal para el botón "home" o vistas iniciales.
   */
  goToDistrito(duration = ANIMATION_DURATION / 2): void {
    const map = this._map();
    if (!map) return;

    const view = map.getView();
    const extent32718 = [275224.08, 8660213.79, 281557.72, 8663299.55];
    const transformedExtent = transformExtent(extent32718, 'EPSG:32718', view.getProjection());

    view.fit(transformedExtent, { duration, padding: [20, 20, 20, 20] });
  }
  /**
   * Métodos para actualizar el estado de las secciones desde la UI
   */
  toggleSectionExpanded(sectionId: string): void {
    this.sections.update(s => s.map(sec =>
      sec.id === sectionId ? { ...sec, expanded: !sec.expanded } : sec
    ));
  }
  /**
   * Alterna la visibilidad de una capa. Para las ortofotos, se comporta como
   * un grupo de radio-buttons, asegurando que solo una esté visible a la vez.
   * @param sectionId ID de la sección principal (ej: 'imaAereas').
   * @param layerId ID de la capa a cambiar (ej: 'ortofoto_2024').
   */
  toggleLayerVisibility(sectionId: string, layerId: string) {
    // Lógica especial para ortofotos: solo una puede estar activa a la vez.
    if (layerId.startsWith('ortofoto_')) {
      this.sections.update(currentSections => {
        let isTurningOn = true; // Asumimos que vamos a encender una capa.

        // Primero, determinamos si la capa clicada ya está visible.
        const sectionsWithOrtoState = currentSections.map(sec => {
          if (sec.id === 'imaAereas') {
            sec.items.forEach(item => {
              if (item.id === 'ortofotos' && 'layers' in item) {
                const clickedLayer = item.layers.find(l => l.id === layerId);
                if (clickedLayer?.visible) {
                  isTurningOn = false; // Si ya está visible, la vamos a apagar.
                }
              }
            });
          }
          return sec;
        });

        // Ahora aplicamos los cambios.
        return sectionsWithOrtoState.map(sec => {
          if (sec.id !== 'imaAereas') return sec;
          const newItems = sec.items.map(item => {
            if (item.id !== 'ortofotos' || !('layers' in item)) return item;
            // Desactivamos todas las ortofotos y luego activamos solo la clicada si es necesario.
            const newLayers = item.layers.map(l => ({ ...l, visible: l.id === layerId ? isTurningOn : false }));
            return { ...item, layers: newLayers };
          });
          return { ...sec, items: newItems };
        });
      });
    } else {
      // Lógica original para el resto de las capas.
      this.sections.update(s => s.map(sec =>
        sec.id === sectionId ? {
          ...sec,
          items: sec.items.map(item => {
            if ('layers' in item) { // SubSection
              item.layers = item.layers.map(l => l.id === layerId ? { ...l, visible: !l.visible } : l);
            } else if (item.type === 'layer' && item.id === layerId) { // LayerItem
              return { ...item, visible: !item.visible };
            }
            return item;
          })
        } : sec
      ));
    }
  }
  setLayerVisibility(sectionId: string, layerId: string, visible: boolean) {
    this.sections.update(s => s.map(sec =>
      sec.id === sectionId ? {
        ...sec,
        items: sec.items.map(item => {
          if ('layers' in item) { // SubSection
            item.layers = item.layers.map(l => l.id === layerId ? { ...l, visible } : l);
          } else if (item.type === 'layer' && item.id === layerId) { // LayerItem
            return { ...item, visible };
          }
          return item;
        })
      } : sec
    ));
  }
  toggleAllLayersInSection(sectionId: string, visible: boolean) {
    this.sections.update(s => s.map(sec => {
      if (sec.id !== sectionId) return sec;
      return {
        ...sec,
        items: sec.items.map(item => 'layers' in item
          ? { ...item, layers: item.layers.map(l => ({ ...l, visible })) }
          : { ...item, visible: item.type === 'layer' ? visible : (item as any).visible })
      };
    }));
  }
  setLayerOpacity(sectionId: string, layerId: string, opacity: number) {
    this.sections.update(s => s.map(sec =>
      sec.id === sectionId ? {
        ...sec,
        items: sec.items.map(item => {
          if ('layers' in item) { // Es una SubSection
            item.layers = item.layers.map(l => l.id === layerId ? { ...l, opacity } : l);
          } else if (item.type === 'layer' && item.id === layerId) { // Es un LayerItem
            return { ...item, opacity };
          }
          return item;
        })
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
   * @param offset Indica si se debe desplazar el centro para compensar el sidebar
   * @param zoom Nivel de zoom opcional para forzar en geometrías de tipo Point
   */
  fitToGeometry(geometry: GeoJSONGeometry, sourceProjection: 'EPSG:4326' | 'EPSG:32718' = 'EPSG:32718', zoom?: number, offset = false): void {
    const map = this._map();
    // La guarda debe ser más flexible: una geometría es válida si existe y tiene 'coordinates' (para geometrías simples)
    // o 'geometries' (para GeometryCollection).
    if (!map || !geometry || (!geometry.coordinates && !geometry.geometries)) return;
    
    // Limpiamos cualquier resaltado anterior para evitar confusiones
    this.clearHighlightLayer();

    const format = new GeoJSON();
    const view = map.getView();
    // Leemos la geometría directamente para evitar la ambigüedad de tipo (Feature vs Feature[])
    // Le indicamos a OL que la data viene en 32718 y la transforme a la proyección del mapa

    const geometryOl = format.readGeometry(geometry, {
      dataProjection: sourceProjection,
      featureProjection: view.getProjection()
    });
    if (!geometryOl) return;
    const extent = geometryOl.getExtent();
    const options: any = {
      duration: ANIMATION_DURATION,
      // Aplicamos el padding solo si 'offset' es true, para no afectar otras llamadas
      padding: offset ? [100, 100, 100, 420] : [50, 50, 50, 50]
    };
    if (geometry.type === 'Point' && zoom) {
      options.zoom = zoom;
    }
    view.fit(extent, options);

    // Resaltamos la nueva geometría en el mapa
    const featureToHighlight = new Feature({ geometry: geometryOl });
    this.highlightLayer?.getSource()?.addFeature(featureToHighlight);

  }
  /**
   * Busca un lote por su código catastral (id_lote) consultando el servicio WFS de GeoServer.
   * @param codigo Código catastral en formato XX-XXX-XXX
   * @returns Observable con el feature encontrado o null
   */
  searchLoteByCodigoCatastral(codigo: string): Observable<GeoJSONFeature | null> {
    const url = environment.geoserver.owsUrl;
    const workspacePrefix = environment.geoserver.workspacePrefix;
    // Limpiamos guiones y espacios en blanco (ej: '3112065002    ' -> '3112065002')
    const codigoSinGuiones = codigo.replaceAll('-', '').trim();
    // Usamos HttpParams para asegurar la correcta construcción y codificación del cql_filter
    const params = new HttpParams()
      .set('service', 'WFS')
      .set('version', '1.1.0')
      .set('request', 'GetFeature')
      .set('typeName', `${workspacePrefix}vw_tg_lote`)
      .set('outputFormat', 'application/json')
      // Solicitamos las coordenadas en la misma proyección del mapa
      .set('srsName', 'EPSG:32718')
      .set('cql_filter', `id_lote = '${codigoSinGuiones}'`);
    return this.http.get<WfsResponse>(url, { params }).pipe(
      map((response) => {
        if (response?.features?.length > 0) {
          // Devolvemos el primer resultado encontrado
          return response.features[0];
        }
        return null;
      })
    );
  }
  /**
   * Busca un parque por su nombre consultando el servicio WFS de GeoServer.
   * @param nombre_parque Nombre del parque a buscar.
   * @returns Un Observable con un array de features encontrados o null.
   */
  searchParquesByDenominacion(denominacion: string): Observable<GeoJSONFeature[] | null> {
    const url = environment.geoserver.owsUrl;
    const workspacePrefix = environment.geoserver.workspacePrefix;
    const params = new HttpParams()
      .set('service', 'WFS')
      .set('version', '1.1.0')
      .set('request', 'GetFeature')
      .set('typeName', `${workspacePrefix}vw_tg_area_rec_nombres`)
      .set('outputFormat', 'application/json')
      .set('srsName', 'EPSG:32718')
      .set('cql_filter', `denominaci ILIKE '%${denominacion.trim().toUpperCase()}%'`);
    return this.http.get<WfsResponse>(url, { params }).pipe(
      map((response) => {
        if (response?.features?.length > 0) {
          return response.features;
        }
        return null;
      })
    );
  }
  /**
   * Busca un lote por su Código Único Catastral (CUC) consultando el servicio WFS de GeoServer.
   * @param cuc Código Único Catastral
   * @returns Observable con el feature encontrado o null
   */
  searchLoteByCuc(cuc: string): Observable<GeoJSONFeature | null> {
    const url = environment.geoserver.owsUrl;
    const cucLimpio = cuc.trim();
    const params = new HttpParams()
      .set('service', 'WFS')
      .set('version', '1.1.0')
      .set('request', 'GetFeature')
      .set('typeName', 'mdsibde2026:vw_tg_lote')
      .set('outputFormat', 'application/json')
      .set('srsName', 'EPSG:32718')
      .set('cql_filter', `cuc = '${cucLimpio}'`);
    return this.http.get<WfsResponse>(url, { params }).pipe(
      map((response) => {
        if (response?.features?.length > 0) {
          return response.features[0];
        }
        return null;
      })
    );
  }  
  /**
   * Busca y devuelve una capa de OpenLayers por su ID asignado en la configuración.
   * @param id El identificador de la capa.
   * @returns La instancia de la capa de OpenLayers o `undefined` si no se encuentra.
   */
  private getLayerById(id: string): ImageLayer<ImageWMS> | undefined {
    for (const section of this.sections()) {
      for (const item of section.items) {
        const layers = 'layers' in item ? item.layers : (item.type === 'layer' ? [item] : []);
        const layerData = layers.find(l => l.id === id);
        if (layerData && layerData.olLayer instanceof ImageLayer) {
          return layerData.olLayer;
        }
      }
    }
    return undefined;
  }
  /**
   * Busca vías en el servicio WFS. Puede buscar por nombre parcial (para autocompletar)
   * o por nombre exacto (para obtener la geometría).
   * @param query El nombre de la vía a buscar (parcial o completo).
   * @param exactMatch Si es `true`, busca una coincidencia exacta. Por defecto es `false`.
   * @param propertiesOnly Si es `true`, devuelve solo la propiedad 'etiquetado_ext'. Por defecto es `false`.
   */
  searchVias(query: string, exactMatch: boolean, propertiesOnly: true): Observable<string[]>;
  searchVias(query: string, exactMatch: boolean, propertiesOnly: false): Observable<GeoJSONFeature[]>;
  searchVias(query: string, exactMatch = false, propertiesOnly = false): Observable<GeoJSONFeature[] | string[]> {
    if (!query || query.trim().length < 3) {
      return new Observable(subscriber => subscriber.next([]));
    }

    // Normalizamos el query para asegurar que "CA " se convierta en "CA. "
    // Esto soluciona inconsistencias entre el autocompletado y la búsqueda exacta.
    const normalizedQuery = query.trim().toUpperCase().replace(/^CA\s/, 'CA. ').replace(/^CA\./, 'CA.');

    const url = environment.geoserver.owsUrl;
    const filter = exactMatch
      ? `etiquetado_ext = '${normalizedQuery}'`
      : `etiquetado_ext ILIKE '%${normalizedQuery}%'`;

    let params = new HttpParams()
      .set('service', 'WFS')
      .set('version', '1.1.0')
      .set('request', 'GetFeature')
      .set('typeName', 'mdsibde2026:vw_tg_via')
      .set('outputFormat', 'application/json')
      .set('srsName', 'EPSG:32718')
      .set('cql_filter', filter);

    if (propertiesOnly) {
      params = params.set('propertyName', 'etiquetado_ext');
    }

    return this.http.get<WfsResponse>(url, { params }).pipe(
      map(response => {
        if (!response?.features) return [];
        if (propertiesOnly) return [...new Set(response.features.map(f => f.properties['etiquetado_ext']))];
        return response.features;
      })
    );
  }
  /**
   * ENFOQUE A: Busca vías que intersectan una geometría usando un filtro WFS en el servidor.
   * @param geometry La geometría GeoJSON (en EPSG:32718) con la que se buscará la intersección.
   * @returns Un Observable con la colección de features GeoJSON encontradas.
   */
  findIntersectingViasWFS(geometry: GeoJSONGeometry): Observable<WfsResponse | null> {
    const url = environment.geoserver.owsUrl;
    const workspacePrefix = environment.geoserver.workspacePrefix;
    // Convertimos la geometría GeoJSON a formato WKT para usarla en el filtro CQL
    const format = new GeoJSON();
    const olGeometry = format.readGeometry(geometry);
    const wktWriter = new WKT();
    const wktGeometry = wktWriter.writeGeometry(olGeometry);
    const params = new HttpParams()
      .set('service', 'WFS')
      .set('version', '1.1.0')
      .set('request', 'GetFeature')
      .set('typeName', `${workspacePrefix}:vw_tg_via`) // Usamos la capa de vías
      .set('outputFormat', 'application/json')
      .set('srsName', 'EPSG:32718') // Pedimos los resultados en la misma proyección de los datos
      .set('cql_filter', `INTERSECTS(geometry, ${wktGeometry})`); // El filtro espacial
    return this.http.get<WfsResponse>(url, { params }).pipe(
      map(response => {
        // Devuelve la colección completa o null si no hay resultados
        return response?.features?.length > 0 ? response : null;
      })
    );
  }
  /**
   * Busca propiedades por DNI o nombre del ciudadano consultando un servicio WFS.
   * @param searchType Si la búsqueda es por 'dni' o 'nombre'.
   * @param query El valor del DNI o el nombre a buscar.
   * @returns Un Observable con un array de features encontrados.
   */
  searchPropertiesByCitizen(searchType: 'dni' | 'nombre', query: string): Observable<GeoJSONFeature[] | null> {
    const url = environment.geoserver.owsUrl;
    const workspacePrefix = environment.geoserver.workspacePrefix;
    // El typeName y el cql_filter deben ajustarse al servicio real que se implemente en GeoServer.
    // Este es un ejemplo hipotético.
    const filterProperty = searchType === 'dni' ? 'numero_documento' : 'nombre_propietario';
    const cqlFilter = `${filterProperty} ILIKE '%${query.trim()}%'`;
    const params = new HttpParams()
      .set('service', 'WFS')
      .set('version', '1.1.0')
      .set('request', 'GetFeature')
      .set('typeName', `${workspacePrefix}vw_tg_lote_propietarios`) // Vista hipotética que une lotes y propietarios
      .set('outputFormat', 'application/json')
      .set('srsName', 'EPSG:4326')
      .set('cql_filter', cqlFilter);
    return this.http.get<WfsResponse>(url, { params }).pipe(map(response => response?.features ?? null));
  }
  /**
   * Configura la capa de resaltado para las geometrías encontradas del lote.
   */
  private setupHighlightLayer(): void {
    const map = this._map();
    if (!map) return;
    this.highlightLayer = new VectorLayer({
      source: new VectorSource(),
      style: new Style({
        stroke: new Stroke({
          color: '#46570f', // Borde verde oscuro
          width: 3,
        }),
        fill: new Fill({
          color: 'rgba(70, 87, 15, 0.2)', // Relleno verde semi-transparente
        }),
      }),
      zIndex: 1000, // Asegura que esté por encima de otras capas
    });
    map.addLayer(this.highlightLayer);
  }
}
