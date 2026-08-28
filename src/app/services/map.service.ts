import { Injectable, signal, computed, inject, NgZone, effect, untracked, WritableSignal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { DrawMeasureService } from './draw.service';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';
import { easeOut } from 'ol/easing';
import type { Coordinate } from 'ol/coordinate';
import { Observable, map } from 'rxjs';
import { ORTOFOTO_YEARS } from '../interfaces/ortofotos';
import { LAYER_PANEL_SECTIONS } from '../interfaces/controlCapasConfig';
import {
  Section,
  WmsLayerConfig,
  GeoJSONFeature,
  LayerItem,
  WfsResponse,
  GeoJSONGeometry
} from '../interfaces/geoLayers';
import { INITIAL_WMS_LAYERS } from '../interfaces/capasWMS.config';
import {
  INITIAL_CENTER,
  INITIAL_ZOOM,
  GOOGLE_SATELLITE_URL,
  OSM_URL,
  TRAMA_WMS_URL,
  ANIMATION_DURATION,
  SAN_ISIDRO_CENTER,
  SAN_ISIDRO_ZOOM,
  SAN_ISIDRO_EXTENT,
  TERMS_ZOOM_DISTRICTO
} from '../interfaces/mapas.config';
import {
  BaseLayer,
  Feature,
  Fill,
  fromLonLat,
  GeoJSON,
  getCenter,
  getDistance,
  ImageLayer,
  ImageWMS,
  Layer,
  LineString,
  OlMap,
  Overlay,
  Point,
  Stroke,
  Style,
  Text,
  TileLayer,
  transform,
  transformExtent,
  VectorLayer,
  VectorSource,
  View,
  WKT,
  XYZ,
} from '@app/modules/openlayers.module';

export type TipoMapaBase = 'satellite' | 'streets' | 'topo' | 'blanco';
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
/** Configuración de una capa consultable al hacer clic sobre el mapa. */
interface ClickableLayerConfig {
  /** Identificador de la capa en el panel de capas. */
  layerId: string;
  /** Obtiene la capa de OpenLayers asociada. */
  getLayer: () => ImageLayer<ImageWMS> | undefined;
  /** Lógica a ejecutar cuando el clic acierta sobre un feature de esta capa. */
  handler: (feature: GeoJSONFeature) => void;
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
  private readonly zone = inject(NgZone);
  private readonly drawMeasureService = inject(DrawMeasureService);
  private readonly authService = inject(AuthService);
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
  /** Capa para resaltar el lote seleccionado para impresión (borde rojo grueso + medidas) */
  private loteSeleccionLayer: VectorLayer<any> | undefined;
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
  /**
   * Vista del panel de capas filtrada por el estado de sesión: los items
   * marcados con `requiresAuth` (capas, subsecciones o secciones completas)
   * solo aparecen cuando el usuario está autenticado.
   * El estado interno (`sections`) conserva SIEMPRE todas las capas para no
   * alterar la lógica del mapa (olLayer, leyenda, clics, ortofotos, etc.).
   */
  readonly panelSections = computed<Section[]>(() => {
    const isAuthed = this.authService.isAuthenticated();
    return this.sections()
      .map(section => this.filterSectionForPanel(section, isAuthed))
      .filter((section): section is Section => section !== null);
  });
  /**
   * Al cerrar sesión apagamos en el mapa cualquier capa restringida que
   * hubiera quedado visible (el panel ya no la muestra, pero la capa OL existe).
   */
  private readonly hideRestrictedOnLogout = effect(() => {
    if (this.authService.isAuthenticated()) return;
    const hasVisibleRestricted = untracked(() => this.sections()).some(section =>
      section.items.some(item =>
        ('layers' in item && item.requiresAuth && item.layers.some(l => l.visible)) ||
        (item.type === 'layer' && item.requiresAuth && item.visible)
      )
    );
    if (!hasVisibleRestricted) return;
    this.sections.update(sections => sections.map(section => {
      const hideAll = section.requiresAuth;
      return {
        ...section,
        items: section.items.map(item => {
          if ('layers' in item) {
            const hideSub = hideAll || item.requiresAuth;
            const layers = item.layers.map(l => (hideSub || l.requiresAuth) ? { ...l, visible: false } : l);
            return { ...item, layers };
          }
          return (hideAll || item.requiresAuth) ? { ...item, visible: false } : item;
        }),
      };
    }));
  });
  /** Indica si el mapa ha sido inicializado y está listo para su uso. */
  isReady = signal(false);
  /** Coordenadas actuales del usuario (longitud, latitud). */
  userCoords = signal<{ lon: number, lat: number } | null>(null);
  /** Herramientas del sidebar activas. */
  activeSidebarTools = signal<Set<string>>(new Set());
  /** Ventanas flotantes con la información de lotes (varias abiertas, sin bloquear el mapa) */
  loteInfoWindows = signal<LoteInfoWindow[]>([]);
  /** Modo selección: el próximo clic sobre la capa "Lote Catastral" lo asigna al módulo de impresión */
  pickLoteActivo = signal(false);
  /** Código catastral (id_lote) seleccionado en el mapa para imprimir */
  loteSeleccionadoCodigo = signal<string | null>(null);

  /** Activa el modo de selección de lote sobre el mapa */
  activarPickLote(): void {
    this.pickLoteActivo.set(true);
  }
  /** Cancela el modo de selección de lote */
  cancelarPickLote(): void {
    this.pickLoteActivo.set(false);
  }
  /** Quita el lote seleccionado para impresión */
  limpiarLoteSeleccionado(): void {
    this.loteSeleccionadoCodigo.set(null);
    // Retiramos también el resaltado rojo y las medidas eventuales del mapa
    this.limpiarResaltadoLoteSeleccionado();
  }
  /** URL con la información de la foto de dron 2018 para mostrar en un modal. */
  fotoDroneUrl2018 = signal<string | null>(null);
  /** URL con la información de la foto de dron 2024 para mostrar en un modal. */
  fotoDroneUrl2024 = signal<string | null>(null);
  /** URL con la información de un punto geodésico para mostrar en un modal. */
  ptoGeodesicoUrl = signal<string | null>(null);
  /** URL con la información de un arbol (2015) para mostrar en un modal. */
  arboladoUrbano2015Url = signal<string | null>(null);
  /** URL del PDF de levantamiento topográfico (TUSNE) para mostrar en un modal. */
  tusneUrl = signal<string | null>(null);
  /** Parámetros comunes para las consultas GetFeatureInfo. */
  private static readonly FEATURE_INFO_PARAMS = {
    'INFO_FORMAT': 'application/json',
    'FEATURE_COUNT': '1'
  } as const;
  /**
   * Capas consultables al hacer un clic simple sobre el mapa. La prioridad
   * se resuelve en tiempo de consulta por el zIndex de cada capa visible.
   */
  private readonly clickableLayers: ClickableLayerConfig[] = [
    this.infoLayerConfig('fotos_sin_2018', p => p['id'], id => `${environment.dataGis.fotoDrone2018Url}?codigo_i=${id}`, this.fotoDroneUrl2018),
    this.infoLayerConfig('fotos_sin_2024', p => p['id'], id => `${environment.dataGis.fotoDrone2024Url}?codigo_i=${id}`, this.fotoDroneUrl2024),
    this.infoLayerConfig('puntos_geodesicos', p => p['cod_pto_geodesico'], id => `${environment.dataGis.ptoGeodesicoUrl}?codigo_i=${id}`, this.ptoGeodesicoUrl),
    this.infoLayerConfig('arbolado_urbano_2015', p => p['codigo'], id => `${environment.dataGis.catArbolesUrl}?codigo_i=${id}`, this.arboladoUrbano2015Url),
    this.infoLayerConfig('cactus_yucca_2015', p => p['codigo'], id => `${environment.dataGis.catArbolesUrl}?codigo_i=${id}`, this.arboladoUrbano2015Url),
    this.infoLayerConfig('tusne', p => p['id_lote'] ?? p['codigo'] ?? p['id'], id => `${environment.dataGis.tusneUrlBase}/${id}.pdf`, this.tusneUrl),
  ];

  /**
   * Construye la configuración de una capa que, al recibir un clic sobre uno
   * de sus features, asigna la URL construida a la señal indicada.
   * @param layerId Identificador de la capa en el panel de capas.
   * @param getId Extrae el identificador del feature (p. ej. de sus propiedades).
   * @param buildUrl Construye la URL a partir del identificador obtenido.
   * @param target Señal donde se guarda la URL de la capa consultada.
   */
  private infoLayerConfig(
    layerId: string,
    getId: (properties: Record<string, any>) => string | undefined,
    buildUrl: (id: string) => string,
    target: WritableSignal<string | null>
  ): ClickableLayerConfig {
    return {
      layerId,
      getLayer: () => this.getLayerById(layerId),
      handler: (feature) => {
        const id = getId(feature.properties);
        if (id) {
          target.set(buildUrl(id));
        }
      }
    };
  }
  /** Controla la visibilidad del modal global de Términos y Condiciones */
  showTermsModal = signal(false);
  /** Términos aceptados por el usuario durante esta sesión (no vuelve a mostrarse automáticamente) */
  termsAccepted = signal(false);
  /**
   * Bandera interna: el aviso de términos se dispara una vez por cada "entrada"
   * al distrito (zoom >= TERMS_ZOOM_DISTRICTO con vista sobre SAN_ISIDRO_EXTENT).
   * Se rearma al salir del área o bajar del zoom mínimo.
   */
  private termsTriggerArmed = true;
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
      setTimeout(() => this.isReady.set(true), 2000);
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
    this.setupLoteSeleccionLayer();
    this.handleInitialRender(olMap);
    this.setupMapClickHandler(olMap);
    // Detección de zoom sobre el distrito para mostrar Términos y Condiciones
    this.setupTermsOnZoom(olMap);
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
    INITIAL_WMS_LAYERS.forEach(config => this.addWmsLayer(config));
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
      }, 2000);
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
    this.updateLayerProperties(options.id, { olLayer: layer, legendUrl });
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
    this.updateLayerInSectionsSignal(options.id, layer);
  }
  /**
   * Actualiza el `signal` `sections` para asociar una capa de OpenLayers (olLayer)
   * a un `LayerItem` específico dentro de la estructura.
   * @param layerId El ID del `LayerItem` a actualizar.
   * @param olLayer La instancia de `TileLayer` de OpenLayers a asociar.
   */
  private updateLayerInSectionsSignal(layerId: string, olLayer: TileLayer): void {
    this.sections.update(sections => sections.map(section => this.processSectionForLayerUpdate(section, layerId, olLayer)));
  }
  /**
   * Procesa una sección para actualizar la `olLayer` de una capa específica.
   * @param section La sección a procesar.
   * @param layerId El ID de la capa a actualizar.
   * @param olLayer La instancia de la capa de OpenLayers.
   * @returns La sección actualizada.
   */
  private processSectionForLayerUpdate(section: Section, layerId: string, olLayer: TileLayer): Section {
    const updatedItems = section.items.map(item => {
      // Solo procesamos subsecciones, ya que es donde se asocian las capas XYZ
      if ('layers' in item) {
        const updatedLayers = this.updateLayersInSubSection(item.layers, layerId, olLayer);
        return { ...item, layers: updatedLayers };
      }
      return item;
    });
    return { ...section, items: updatedItems };
  }
  /**
   * Actualiza la `olLayer` en un array de capas si encuentra una coincidencia de ID.
   * @param layers El array de `LayerItem` a procesar.
   * @param layerId El ID de la capa a actualizar.
   * @param olLayer La instancia de la capa de OpenLayers.
   * @returns El array de capas actualizado.
   */
  private updateLayersInSubSection(layers: LayerItem[], layerId: string, olLayer: TileLayer): LayerItem[] {
    return layers.map(l => (l.id === layerId ? { ...l, olLayer } : l));
  }
  /**
   * Configura los handlers de clic del mapa: un clic simple para consultar
   * información de las capas y seleccionar lotes para impresión, y un doble
   * clic para abrir la ficha del lote catastral.
   * @param olMap Instancia del mapa de OpenLayers.
   */
  private setupMapClickHandler(olMap: OlMap): void {
    this.setupSingleClickHandler(olMap);
    this.setupDoubleClickHandler(olMap);
  }

  /**
   * Registra el evento de clic simple. Si se está usando una herramienta de
   * dibujo se ignora; en modo "pick lote" se captura el predio clicado y se
   * abandona el modo; en caso contrario se consultan las capas clicables.
   * @param olMap Instancia del mapa de OpenLayers.
   */
  private setupSingleClickHandler(olMap: OlMap): void {
    olMap.on('singleclick', (evt) => {
      // Si se está usando una herramienta de dibujo, no hacemos nada.
      if (this.drawMeasureService.isDrawing()) {
        return;
      }
      // Modo "seleccionar lote para imprimir": capturamos el lote clicado y salimos.
      if (this.pickLoteActivo()) {
        this.handlePickLoteClick(olMap, evt.coordinate);
        return;
      }
      this.queryInfoLayers(olMap, evt.coordinate);
    });
  }

  /**
   * Modo selección de lote para impresión: consulta la capa "Lote Catastral"
   * en el punto indicado y, si existe un predio, lo marca como seleccionado y
   * resalta sus medidas perimetrales.
   * @param olMap Instancia del mapa de OpenLayers.
   * @param coordinate Coordenada del clic en la proyección del mapa.
   */
  private handlePickLoteClick(olMap: OlMap, coordinate: Coordinate): void {
    const loteLayer = this.getLayerById('lote');
    const source = loteLayer?.getSource();
    const view = olMap.getView();
    const infoUrl = loteLayer?.getVisible()
      ? source?.getFeatureInfoUrl(coordinate, view.getResolution()!, view.getProjection(), MapService.FEATURE_INFO_PARAMS)
      : undefined;

    if (infoUrl) {
      this.http.get<WfsResponse>(infoUrl).subscribe(resp => {
        const loteFeature = resp?.features?.[0];
        const codigo = loteFeature?.properties?.['id_lote'];
        this.zone.run(() => {
          if (codigo) {
            this.loteSeleccionadoCodigo.set(String(codigo).trim());
            // Resaltamos el lote en rojo y estampamos sus medidas perimetrales
            this.resaltarLoteSeleccionado(loteFeature);
          }
          this.pickLoteActivo.set(false);
        });
      });
    } else {
      this.zone.run(() => this.pickLoteActivo.set(false));
    }
  }

  /**
   * Consulta las capas clicables visibles (ordenadas de mayor a menor zIndex)
   * hasta encontrar la primera que devuelva un feature y ejecuta su handler.
   * @param olMap Instancia del mapa de OpenLayers.
   * @param coordinate Coordenada del clic en la proyección del mapa.
   */
  private queryInfoLayers(olMap: OlMap, coordinate: Coordinate): void {
    const view = olMap.getView();
    const viewResolution = view.getResolution()!;
    const projection = view.getProjection();

    // Priorizamos la capa visible con el zIndex más alto.
    const visibleLayers = this.clickableLayers
      .map(config => ({ config, layer: config.getLayer() }))
      .filter(item => item.layer?.getVisible())
      .sort((a, b) => (b.layer?.getZIndex() ?? 0) - (a.layer?.getZIndex() ?? 0));

    const queryNext = (pending: typeof visibleLayers): void => {
      if (pending.length === 0) return;
      const { config, layer } = pending[0];
      const source = layer?.getSource();
      if (!source) {
        queryNext(pending.slice(1)); // Sin fuente: intenta con la siguiente
        return;
      }
      const url = source.getFeatureInfoUrl(coordinate, viewResolution, projection, MapService.FEATURE_INFO_PARAMS);
      if (!url) {
        queryNext(pending.slice(1)); // Sin URL: intenta con la siguiente
        return;
      }
      this.http.get<WfsResponse>(url).subscribe(response => {
        if (response?.features?.length > 0) {
          config.handler(response.features[0]); // Encontramos algo: lo manejamos y paramos.
        } else {
          queryNext(pending.slice(1)); // Si no, intentamos con la siguiente capa.
        }
      });
    };

    queryNext(visibleLayers);
  }

  /**
   * Registra el evento de doble clic para abrir la ficha del lote catastral
   * (información de la capa "Lote Catastral") cuando está visible.
   * @param olMap Instancia del mapa de OpenLayers.
   */
  private setupDoubleClickHandler(olMap: OlMap): void {
    olMap.on('dblclick', (evt) => {
      if (this.drawMeasureService.isDrawing()) {
        return;
      }
      const layer = this.getLayerById('lote');
      if (!layer?.getVisible()) {
        return;
      }
      const view = olMap.getView();
      const source = layer.getSource();
      const url = source?.getFeatureInfoUrl(evt.coordinate, view.getResolution()!, view.getProjection(), MapService.FEATURE_INFO_PARAMS);

      if (url) {
        this.http.get<WfsResponse>(url).subscribe(response => {
          if (response?.features?.length > 0) {
            const codigoLote = String(response.features[0].properties['id_lote']);
            if (codigoLote && codigoLote !== 'undefined') {
              this.openLoteInfoWindow(codigoLote);
            }
          }
        });
      }
    });
  }
  /**
   * Configuración por defecto (ficha pública) de las ventanas flotantes de lote.
   * Centralizada aquí para que cualquier ventana se cree con estos valores
   * y el componente pueda sobrescribirlos de forma opcional.
   * `Required` garantiza que estas propiedades se traten como obligatorias
   * (en `LoteInfoWindow` son opcionales) al leerlas, p. ej. al calcular posiciones.
   */
  private static readonly LOTE_WINDOW_PUBLICO: Readonly<Required<Pick<LoteInfoWindow, 'title' | 'width' | 'heightPx' | 'zIndex'>>> = {
    title: 'Información del Lote',
    // La ficha LotePublico.asp se maqueta con una tabla fija de 680px:
    // 700px evita espacios laterales muertos sin cortar el contenido.
    width: 685,
    // El contenido de la ficha mide ≈ 480-500px de alto; un valor fijo en px
    // es predecible en cualquier pantalla (720p: y máx. 232 + 520 = 752 < 768).
    heightPx: 380,
    zIndex: 1040,
  };

  /**
   * Normaliza el identificador del lote: recorta espacios y, si se recibió una
   * URL completa (p. ej. "…/LotePublico.asp?codigo_i=3107007010"), extrae el
   * valor real del parámetro `codigo_i` para evitar URLs anidadas inválidas.
   * @param valor Código catastral o URL que lo contiene.
   */
  private static normalizarCodigoLote(valor: string): string {
    const texto = (valor ?? '').trim();
    const coincidencia = texto.match(/[?&]codigo_i=([^&\s]+)/i);
    return coincidencia ? decodeURIComponent(coincidencia[1]) : texto;
  }

  /**
   * Abre una nueva ventana flotante con la información del lote indicado,
   * o la trae al frente si ya se encuentra abierta. Las ventanas conviven
   * entre sí y no bloquean la interacción con el mapa.
   * @param codigo Código catastral del lote (id_lote). Se acepta también una
   *               URL que contenga `codigo_i`; se extrae el código real.
   * @param opciones Ajustes opcionales que sobrescriben los valores por defecto.
   */
  openLoteInfoWindow(codigo: string, opciones?: Partial<Pick<LoteInfoWindow, 'title' | 'width' | 'heightPx' | 'zIndex'>>): void {
    const codigoLote = MapService.normalizarCodigoLote(codigo);
    if (!codigoLote) return;
    const existente = this.loteInfoWindows().find(w => w.id === codigoLote);
    if (existente) {
      this.bringLoteToFront(codigoLote);
      return;
    }
    const index = this.loteInfoWindows().length;
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
    // Escalonamos cada ventana nueva para que no queden exactamente superpuestas
    const x = Math.min(96 + index * 36, Math.max(vw - MapService.LOTE_WINDOW_PUBLICO.width, 20));
    const y = Math.min(88 + index * 30, Math.max(vh - MapService.LOTE_WINDOW_PUBLICO.heightPx - 16, 20));
    const url = `${environment.dataGis.informacionUrl}?codigo_i=${encodeURIComponent(codigoLote)}`;
    this.loteInfoWindows.update(wins => [...wins, {
      id: codigoLote,
      url,
      x,
      y,
      ...MapService.LOTE_WINDOW_PUBLICO,
      ...opciones,
    }]);
  }
  /**
   * Cierra la ventana flotante del lote indicado.
   */
  closeLoteWindow(id: string): void {
    this.loteInfoWindows.update(wins => wins.filter(w => w.id !== id));
  }
  /**
   * Cierra la última ventana abierta (la superior). Usado por la tecla Escape.
   */
  closeLastLoteWindow(): void {
    this.loteInfoWindows.update(wins => wins.slice(0, -1));
  }
  /**
   * Mueve una ventana flotante a la posición indicada (arrastre).
   */
  moveLoteWindow(id: string, x: number, y: number): void {
    this.loteInfoWindows.update(wins => wins.map(w => (w.id === id ? { ...w, x, y } : w)));
  }
  /**
   * Trae la ventana indicada al frente de las demás (reordenando el arreglo,
   * el último elemento se renderiza encima al compartir z-index).
   */
  bringLoteToFront(id: string): void {
    this.loteInfoWindows.update(wins => {
      const win = wins.find(w => w.id === id);
      if (!win || wins[wins.length - 1].id === id) return wins;
      return [...wins.filter(w => w.id !== id), win];
    });
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
   * Limpia la URL del punto geodésico, para cerrar el modal.
   */
  clearPtoGeodesicoUrl(): void {
    this.ptoGeodesicoUrl.set(null);
  }
  /**
   * Limpia la URL del arbolado urbano 2015, para cerrar el modal.
   */
  clearArboladoUrbano2015Url(): void {
    this.arboladoUrbano2015Url.set(null);
  }
  /**
   * Limpia la URL del levantamiento topográfico (TUSNE), para cerrar el modal.
   */
  clearTusneUrl(): void {
    this.tusneUrl.set(null);
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
    const currentCenter = view.getCenter()!;
    const destination = fromLonLat([lon, lat]);

    // Calculamos la distancia para decidir si hacer un "zoom out" drástico o no.
    // Una distancia mayor a 500km (500000m) justifica el zoom out.
    const distance = getDistance(currentCenter, destination);

    const completeCallback = (complete: boolean) => {
      this.zone.run(() => { // Ensure signal update runs inside Angular zone
        this.isNavigating.set(false);
        if (complete && onComplete) {
          onComplete(complete);
        }
      });
    };

    if (distance > 500000) { // Si estamos lejos, hacemos un zoom out primero
      const peruCenter = fromLonLat([-75, -10]); // Centro aproximado de Perú
      const zoomOutDuration = duration * 0.4; // 40% de la duración total para el zoom out
      const zoomInDuration = duration * 0.6;  // 60% de la duración total para el zoom in

      // Primera animación: zoom out a una vista más amplia centrada en Perú
      view.animate({
        center: peruCenter,
        zoom: 4, // Zoom a nivel continental para mostrar Perú
        duration: zoomOutDuration,
        easing: easeOut
      }, () => {
        // Segunda animación: zoom a la ubicación de destino (San Isidro)
        view.animate({
          center: destination,
          zoom,
          duration: zoomInDuration,
          easing: easeOut
        }, completeCallback);
      });
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
    const transformedExtent = transformExtent(SAN_ISIDRO_EXTENT, 'EPSG:32718', view.getProjection());
    this.cambiarMapaBase('blanco');
    view.fit(transformedExtent, { duration, padding: [20, 20, 20, 20] });
  }
  /**
   * Muestra el modal global de Términos y Condiciones.
   */
  openTermsModal(): void {
    this.showTermsModal.set(true);
  }
  /**
   * Cierra el modal de Términos y Condiciones sin registrar aceptación.
   */
  closeTermsModal(): void {
    this.showTermsModal.set(false);
  }
  /**
   * Registra la aceptación de los términos y cierra el modal.
   * Durante la sesión activa no volverá a mostrarse automáticamente.
   */
  acceptTerms(): void {
    this.termsAccepted.set(true);
    this.showTermsModal.set(false);
  }
  /**
   * Escucha el evento 'moveend' del mapa y muestra el modal de Términos y
   * Condiciones cuando el usuario hace zoom sobre el distrito de San Isidro:
   * zoom >= TERMS_ZOOM_DISTRICTO y la vista intersecta SAN_ISIDRO_EXTENT.
   * El aviso se dispara una vez por cada entrada al área (se rearma al salir).
   * @param olMap Instancia del mapa de OpenLayers.
   */
  private setupTermsOnZoom(olMap: OlMap): void {
    olMap.on('moveend', () => {
      if (this.termsAccepted()) {
        return;
      }
      const view = olMap.getView();
      const zoom = view.getZoom();
      const size = olMap.getSize();
      let sobreDistrito = false;
      if (zoom !== undefined && size && zoom >= TERMS_ZOOM_DISTRICTO) {
        // Extensión visible transformada al sistema UTM oficial del distrito (EPSG:32718)
        const extentUTM = transformExtent(view.calculateExtent(size), view.getProjection(), 'EPSG:32718');
        // Intersección de bounding boxes ([oeste, sur, este, norte])
        sobreDistrito =
          extentUTM[0] <= SAN_ISIDRO_EXTENT[2] &&
          extentUTM[2] >= SAN_ISIDRO_EXTENT[0] &&
          extentUTM[1] <= SAN_ISIDRO_EXTENT[3] &&
          extentUTM[3] >= SAN_ISIDRO_EXTENT[1];
      }
      if (!sobreDistrito) {
        // Al alejarse o salir del área se rearma para el próximo ingreso
        this.termsTriggerArmed = true;
        return;
      }
      if (this.termsTriggerArmed) {
        this.termsTriggerArmed = false;
        // Los callbacks de OpenLayers corren fuera de Angular: restauramos la zona
        this.zone.run(() => this.showTermsModal.set(true));
      }
    });
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
      this.updateLayerProperties(layerId, (layer) => ({ visible: !layer.visible }));
    }
  }
  setLayerVisibility(sectionId: string, layerId: string, visible: boolean) {
    this.updateLayerProperties(layerId, { visible });
  }
  setLayerOpacity(sectionId: string, layerId: string, opacity: number) {
    this.updateLayerProperties(layerId, { opacity });
  }
  /**
   * Actualiza las propiedades de una capa específica por su ID.
   * @param layerId El ID de la capa a actualizar.
   * @param newProps Un objeto con las nuevas propiedades o una función que devuelve las nuevas propiedades.
   */
  private updateLayerProperties(layerId: string, newProps: Partial<LayerItem> | ((layer: LayerItem) => Partial<LayerItem>)): void {
    this.sections.update(sections => sections.map(section => this.updateSectionItems(section, layerId, newProps)));
  }
  /**
   * Itera sobre los items de una sección para actualizar una capa.
   */
  private updateSectionItems(section: Section, layerId: string, newProps: Partial<LayerItem> | ((layer: LayerItem) => Partial<LayerItem>)): Section {
    return {
      ...section,
      items: section.items.map(item => this.updateItem(item, layerId, newProps))
    };
  }
  /**
   * Procesa un item (LayerItem o SubSection) para actualizar una capa.
   */
  private updateItem(item: LayerItem | any, layerId: string, newProps: Partial<LayerItem> | ((layer: LayerItem) => Partial<LayerItem>)): LayerItem | any {
    if ('layers' in item) { // Es una SubSection
      return {
        ...item,
        layers: item.layers.map((l: LayerItem) => this.applyLayerUpdate(l, layerId, newProps))
      };
    } else if (item.type === 'layer') { // Es un LayerItem
      return this.applyLayerUpdate(item, layerId, newProps);
    }
    return item;
  }
  /**
   * Aplica la actualización a una capa si su ID coincide.
   */
  private applyLayerUpdate(layer: LayerItem, layerId: string, newProps: Partial<LayerItem> | ((layer: LayerItem) => Partial<LayerItem>)): LayerItem {
    if (layer.id !== layerId) {
      return layer;
    }
    const propsToApply = typeof newProps === 'function' ? newProps(layer) : newProps;
    return { ...layer, ...propsToApply };
  }
  /**
   * Enciende/apaga todas las capas de una sección. Respeta la restricción
   * `requiresAuth`: en modo público esas capas permanecen apagadas.
   */
  toggleAllLayersInSection(sectionId: string, visible: boolean) {
    const isAuthed = this.authService.isAuthenticated();
    this.sections.update(s => s.map(sec => {
      if (sec.id !== sectionId) return sec;
      const sectionAllowed = !sec.requiresAuth || isAuthed;
      return {
        ...sec,
        items: sec.items.map(item => {
          if ('layers' in item) {
            // Subsección restringida sin sesión: no se toca.
            if (!sectionAllowed || (item.requiresAuth && !isAuthed)) return item;
            return {
              ...item,
              layers: item.layers.map(l => ({ ...l, visible: (l.requiresAuth && !isAuthed) ? false : visible })),
            };
          }
          if (item.type === 'layer') {
            return { ...item, visible: (item.requiresAuth && !isAuthed) ? false : visible };
          }
          return item;
        }),
      };
    }));
  }

  /**
   * Devuelve la sección filtrada para el panel según la sesión, o `null` si
   * debe ocultarse por completo (secciones/subsecciones/capas con `requiresAuth`).
   */
  private filterSectionForPanel(section: Section, isAuthed: boolean): Section | null {
    if (section.requiresAuth && !isAuthed) return null;
    const items = section.items
      .map(item => {
        if ('layers' in item) {
          if (item.requiresAuth && !isAuthed) return null;
          const layers = item.layers.filter(l => !l.requiresAuth || isAuthed);
          return layers.length > 0 ? { ...item, layers } : null;
        }
        return (item.requiresAuth && !isAuthed) ? null : item;
      })
      .filter((item): item is Section['items'][number] => item !== null);
    return items.length > 0 ? { ...section, items } : null;
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
   * Busca un lote urbano por habilitación, manzana y lote.
   * @param habilitacion Nombre de la habilitación urbana.
   * @param manzana Manzana urbana.
   * @param lote Lote urbano.
   * @returns Un Observable con el feature encontrado o null.
   */
  searchLoteByHabilitacion(habilitacion: string, manzana: string, lote: string): Observable<GeoJSONFeature | null> {
    const url = environment.geoserver.owsUrl;
    const workspacePrefix = environment.geoserver.workspacePrefix;

    // Construimos un filtro CQL que busca coincidencias en los tres campos.
    // Usamos ILIKE para la habilitación para ser flexible con mayúsculas/minúsculas.
    const cqlFilter = `urbanizaci ILIKE '%${habilitacion.trim()}%' AND mzaurb = '${manzana.trim()}' AND loteurb = '${lote.trim()}'`;

    const params = new HttpParams()
      .set('service', 'WFS')
      .set('version', '1.1.0')
      .set('request', 'GetFeature')
      .set('typeName', `${workspacePrefix}vw_tg_lote_urbano`)
      .set('outputFormat', 'application/json')
      .set('srsName', 'EPSG:32718')
      .set('cql_filter', cqlFilter);

    return this.http.get<WfsResponse>(url, { params }).pipe(
      map(response => {
        if (response?.features?.length > 0) {
          return response.features[0]; // Devolvemos el primer resultado
        }
        return null;
      })
    );
  }
  /**
   * Busca nombres de habilitaciones urbanas que coincidan parcialmente.
   * @param partialName El nombre parcial de la habilitación.
   * @returns Un Observable con un array de nombres de habilitaciones únicos.
   */
  searchHabilitaciones(partialName: string): Observable<GeoJSONFeature[] | null> {
    const url = environment.geoserver.owsUrl;
    const workspacePrefix = environment.geoserver.workspacePrefix;
    const params = new HttpParams()
      .set('service', 'WFS')
      .set('version', '1.1.0')
      .set('request', 'GetFeature')
      .set('typeName', `${workspacePrefix}vw_tg_lote_urbano`)
      .set('outputFormat', 'application/json')
      .set('srsName', 'EPSG:32718')
      .set('cql_filter', `urbanizaci ILIKE '%${partialName.trim().toUpperCase()}%'`);

    return this.http.get<WfsResponse>(url, { params }).pipe(
      map(response => {
        if (response?.features?.length > 0) {
          // Para evitar duplicados, creamos un mapa de habilitaciones únicas
          const uniqueHabilitaciones = new Map<string, GeoJSONFeature>();
          response.features.forEach(feature => {
            const nombreHabilitacion = feature.properties['urbanizaci'];
            if (!uniqueHabilitaciones.has(nombreHabilitacion)) {
              uniqueHabilitaciones.set(nombreHabilitacion, feature);
            }
          });
          return Array.from(uniqueHabilitaciones.values());
        }
        return null;
      })
    );
  }
  /**
   * Busca manzanas urbanas basadas en una habilitación y un nombre parcial de manzana.
   * @param habilitacion El nombre exacto de la habilitación.
   * @param partialManzana El nombre parcial de la manzana.
   * @returns Un Observable con un array de nombres de manzanas únicos.
   */
  searchManzanasByHabilitacion(habilitacion: string, partialManzana: string): Observable<string[]> {
    if (!habilitacion) {
      return new Observable(subscriber => subscriber.next([]));
    }
    const url = environment.geoserver.owsUrl;
    const workspacePrefix = environment.geoserver.workspacePrefix;
    let cqlFilter = `urbanizaci = '${habilitacion}'`;
    if (partialManzana && partialManzana.trim().length > 0) {
      cqlFilter += ` AND mzaurb ILIKE '%${partialManzana.trim()}%'`;
    }
    const params = new HttpParams()
      .set('service', 'WFS')
      .set('version', '1.1.0')
      .set('request', 'GetFeature')
      .set('typeName', `${workspacePrefix}vw_tg_lote_urbano`)
      .set('outputFormat', 'application/json')
      .set('propertyName', 'mzaurb')
      .set('cql_filter', cqlFilter);

    return this.http.get<WfsResponse>(url, { params }).pipe(
      map(response => {
        if (!response?.features) return [];
        const manzanas = response.features.map(f => f.properties['mzaurb']);
        return [...new Set(manzanas)];
      })
    );
  }
  /**
   * Busca lotes urbanos basados en una habilitación, una manzana y un número de lote parcial.
   * @param habilitacion El nombre exacto de la habilitación.
   * @param manzana El nombre exacto de la manzana.
   * @param partialLote El número parcial del lote.
   * @returns Un Observable con un array de números de lote únicos.
   */
  searchLotesByHabilitacionManzana(habilitacion: string, manzana: string, partialLote: string): Observable<string[]> {
    if (!habilitacion || !manzana) {
      return new Observable(subscriber => subscriber.next([]));
    }
    const url = environment.geoserver.owsUrl;
    const workspacePrefix = environment.geoserver.workspacePrefix;
    let cqlFilter = `urbanizaci = '${habilitacion}' AND mzaurb = '${manzana}'`;
    if (partialLote && partialLote.trim().length > 0) {
      cqlFilter += ` AND loteurb ILIKE '%${partialLote.trim()}%'`;
    }
    const params = new HttpParams()
      .set('service', 'WFS')
      .set('version', '1.1.0')
      .set('request', 'GetFeature')
      .set('typeName', `${workspacePrefix}vw_tg_lote_urbano`)
      .set('outputFormat', 'application/json')
      .set('propertyName', 'loteurb')
      .set('cql_filter', cqlFilter);

    return this.http.get<WfsResponse>(url, { params }).pipe(
      map(response => {
        if (!response?.features) return [];
        const lotes = response.features.map(f => f.properties['loteurb']);
        return [...new Set(lotes)];
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
      .set('typeName', `${environment.geoserver.workspacePrefix}vw_tg_via`)
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
      // Estilo según el tipo de geometría:
      // - Líneas (vías): trazo ámbar sólido sobre un halo translúcido más ancho,
      //   para que la vía encontrada destaque claramente sobre la cartografía.
      // - Polígonos (lotes, habilitaciones): borde y relleno verdes institucionales.
      style: feature => {
        const geometryType = feature.getGeometry()?.getType();
        if (geometryType === 'LineString' || geometryType === 'MultiLineString') {
          return [
            new Style({ stroke: new Stroke({ color: 'rgba(255, 193, 7, 0.45)', width: 12 }) }),
            new Style({ stroke: new Stroke({ color: '#ff8f00', width: 5 }) }),
          ];
        }
        return new Style({
          stroke: new Stroke({
            color: '#46570f', // Borde verde oscuro
            width: 3,
          }),
          fill: new Fill({
            color: 'rgba(70, 87, 15, 0.2)', // Relleno verde semi-transparente
          }),
        });
      },
      zIndex: 1000, // Asegura que esté por encima de otras capas
    });
    map.addLayer(this.highlightLayer);
  }

  /**
   * Configura la capa dedicada al lote seleccionado para impresión:
   * borde rojo grueso (con halo blanco para contraste sobre ortofotos)
   * y etiquetas eventuales con la medida en metros de cada arista.
   * Se dibuja sobre la capa de resaltado de búsquedas (zIndex superior).
   */
  private setupLoteSeleccionLayer(): void {
    const map = this._map();
    if (!map) return;
    this.loteSeleccionLayer = new VectorLayer({
      source: new VectorSource(),
      // Estilo según el tipo de geometría:
      // - Puntos: etiquetas de texto con la medida de cada arista del lote.
      // - Polígonos: línea roja gruesa + relleno rojo muy tenue.
      style: feature => {
        // Features sin geometría válida nunca deben dibujarse
        if (!feature?.getGeometry()) return [];
        const geometryType = feature.getGeometry()!.getType();
        if (geometryType === 'Point') {
          return new Style({
            text: new Text({
              text: (feature.get('etiqueta') as string) ?? '',
              font: 'bold 11px Helvetica, Arial, sans-serif',
              fill: new Fill({ color: '#b71c1c' }),
              stroke: new Stroke({ color: 'rgba(255, 255, 255, 0.9)', width: 3 }),
              overflow: true,
            }),
          });
        }
        return [
          // Halo blanco bajo la línea roja para que destaque sobre cualquier fondo
          new Style({ stroke: new Stroke({ color: 'rgba(255, 255, 255, 0.85)', width: 9 }) }),
          new Style({
            stroke: new Stroke({ color: '#e00b0b', width: 5 }),
            fill: new Fill({ color: 'rgba(224, 11, 11, 0.07)' }),
          }),
        ];
      },
      zIndex: 1001,
    });
    map.addLayer(this.loteSeleccionLayer);
  }

  /** Limpia el resaltado rojo y las medidas eventuales del lote seleccionado. */
  private limpiarResaltadoLoteSeleccionado(): void {
    this.loteSeleccionLayer?.getSource()?.clear();
  }

  /** Capa de cuadrícula UTM-18S (eventual: visible solo durante la captura del plano) */
  private cuadriculaUtm?: VectorLayer<any>;

  /** Opciones de espaciado (orientadas al papel) de la última activación */
  private opcionesCuadricula?: { mmEntreLineas?: number; dpi?: number };

  /**
   * Activa la cuadrícula de coordenadas UTM zona 18S sobre el mapa.
   * Las líneas se generan a múltiplos "agradables" de metros (1/2/5 × 10ⁿ)
   * con etiquetas Este/Norte. Debe invocarse cuando la vista ya tiene el
   * tamaño y la resolución DEFINITIVOS de la impresión, y desactivarse tras
   * la captura.
   * @param opciones Espaciado orientado al PAPEL impreso:
   *  - `mmEntreLineas`: separación objetivo entre líneas en mm de papel.
   *  - `dpi`: resolución de la captura (px por pulgada de papel).
   * Si se omite, se usa un espaciado pensado para pantalla (~130 px).
   */
  activarCuadriculaUtm(opciones?: { mmEntreLineas?: number; dpi?: number }): void {
    const map = this._map();
    if (!map) return;
    if (!this.cuadriculaUtm) {
      this.cuadriculaUtm = new VectorLayer({
        source: new VectorSource(),
        zIndex: 998,
        style: this.estiloCuadriculaUtm(),
      });
      map.addLayer(this.cuadriculaUtm);
    }
    this.opcionesCuadricula = opciones;
    this.cuadriculaUtm.setVisible(true);
    this.actualizarCuadriculaUtm();
  }

  /** Desactiva la cuadrícula UTM-18S tras la captura del plano. */
  desactivarCuadriculaUtm(): void {
    this.cuadriculaUtm?.setVisible(false);
  }

  /** Estilo de la cuadrícula: líneas punteadas finas + etiquetas Este/Norte. */
  private estiloCuadriculaUtm(): (feature: any) => Style[] {
    const estiloLinea = new Style({
      stroke: new Stroke({ color: 'rgba(27, 42, 78, 0.35)', width: 0.8, lineDash: [5, 4] }),
    });
    return feature => {
      // Features sin geometría válida nunca deben dibujarse (evita errores en
      // el pipeline de renderizado de OpenLayers)
      if (!feature?.getGeometry()) return [];
      if (feature.getGeometry()!.getType() === 'Point') {
        return [new Style({
          text: new Text({
            text: (feature.get('etiqueta') as string) ?? '',
            font: 'bold 9px Helvetica, Arial, sans-serif',
            fill: new Fill({ color: '#1b2a4e' }),
            stroke: new Stroke({ color: 'rgba(255, 255, 255, 0.85)', width: 2.5 }),
            overflow: true,
          }),
        })];
      }
      return [estiloLinea];
    };
  }

  /** Redondea un valor positivo al "número agradable" (1/2/5 × 10ⁿ) inmediato superior. */
  private numeroAgradableSuperior(valor: number): number {
    if (valor <= 0) return 1;
    const base = Math.pow(10, Math.floor(Math.log10(valor)));
    for (const factor of [1, 2, 5, 10]) {
      const candidato = factor * base;
      if (candidato >= valor) return candidato;
    }
    return 10 * base;
  }

  /**
   * Reconstruye las líneas de la cuadrícula UTM-18S para la extensión actual
   * de la vista: convierte los límites del viewport a metros UTM, elige un
   * paso de cuadrilla legible y traza las verticales (Este) y horizontales
   * (Norte) muestreadas para respetar su leve curvatura en la vista web.
   */
  private actualizarCuadriculaUtm(): void {
    const layer = this.cuadriculaUtm;
    const map = this._map();
    if (!layer || !map || !layer.getVisible()) return;
    const source = layer.getSource();
    const size = map.getSize();
    if (!source || !size || size[0] < 2 || size[1] < 2) return;

    const vista = map.getView();
    const proyeccionVista = vista.getProjection()?.getCode() ?? 'EPSG:3857';
    const extension = vista.calculateExtent(size);

    // Límites del viewport en metros UTM-18S
    const esquinaMin = transform([extension[0], extension[1]], proyeccionVista, 'EPSG:32718');
    const esquinaMax = transform([extension[2], extension[3]], proyeccionVista, 'EPSG:32718');
    const xMin = Math.min(esquinaMin[0], esquinaMax[0]);
    const xMax = Math.max(esquinaMin[0], esquinaMax[0]);
    const yMin = Math.min(esquinaMin[1], esquinaMax[1]);
    const yMax = Math.max(esquinaMin[1], esquinaMax[1]);
    if (![xMin, xMax, yMin, yMax].every(Number.isFinite)) return;

    // Paso de cuadrilla orientado al PAPEL: con opciones de impresión, la
    // separación objetivo son milímetros de papel convertidos a píxeles de
    // captura; así, a cualquier escala (1/250…1/2000), las líneas quedan a un
    // intervalo legible, siempre en metros redondos y coherentes con la barra
    // de escala. Sin opciones se conserva el criterio de pantalla (~130 px).
    const resolucion = vista.getResolution() ?? 1;
    const mmEntreLineas = this.opcionesCuadricula?.mmEntreLineas;
    const dpi = this.opcionesCuadricula?.dpi ?? 150;
    const pixelesObjetivo = mmEntreLineas ? (mmEntreLineas * dpi) / 25.4 : 130;
    let paso = this.numeroAgradableSuperior(resolucion * pixelesObjetivo);
    // Seguridad #1: valores patológicos (NaN/Infinity) de la resolución o de
    // la extensión durante la impresión invalidan la cuadrícula completa y
    // derivaban en "RangeError: Invalid array length".
    if (!Number.isFinite(paso) || paso <= 0) return;
    // Seguridad #2: nunca más de ~120 líneas por eje (evita bucles pesados y
    // arrays gigantes si la resolución o la extensión toman valores extremos)
    while ((yMax - yMin) / paso > 120 || (xMax - xMin) / paso > 120) {
      paso *= 2;
      if (!Number.isFinite(paso) || paso <= 0) return;
    }
    const muestras = 9; // puntos por línea para seguir la curvatura

    const aVista = (coordenadaUtm: number[]): number[] =>
      transform(coordenadaUtm, 'EPSG:32718', proyeccionVista);

    const desplazamientoX = (xMax - xMin) * 0.012;
    const desplazamientoY = (yMax - yMin) * 0.018;

    // Regeneramos la cuadrícula desde cero en cada activación
    source.clear();

    // Verticales: Este constante, el Norte recorre [yMin..yMax].
    // Tope defensivo de líneas: aunque el cálculo de `paso` falle, jamás se
    // intentará crear un array de coordenadas gigante/inválido.
    let verticales = 0;
    for (
      let este = Math.ceil(xMin / paso) * paso;
      este <= xMax + 1e-6 && verticales < 160;
      este += paso
    ) {
      verticales++;
      const coordenadas: number[][] = [];
      for (let i = 0; i < muestras; i++) {
        const norte = yMin + ((yMax - yMin) * i) / (muestras - 1);
        const punto = aVista([este, norte]);
        if (!Number.isFinite(punto[0]) || !Number.isFinite(punto[1])) break;
        // IMPORTANTE: LineString espera PARES [[x,y],...]. Pasar un array
        // plano [x,y,x,y…] hacía que OpenLayers detectara stride=undefined,
        // vaciaba las flatCoordinates y provocaba
        // "RangeError: Invalid array length" en douglasPeucker al renderizar.
        coordenadas.push([punto[0], punto[1]]);
      }
      if (coordenadas.length < muestras) continue;
      source.addFeature(new Feature(new LineString(coordenadas)));

      const etiqueta = new Feature(
        new Point(aVista([este + desplazamientoX, yMax - desplazamientoY])),
      );
      etiqueta.set('etiqueta', `${Math.round(este)} E`);
      source.addFeature(etiqueta);
    }

    // Horizontales: Norte constante, el Este recorre [xMin..xMax]
    // (mismos blindajes que las verticales)
    let horizontales = 0;
    for (
      let norte = Math.ceil(yMin / paso) * paso;
      norte <= yMax + 1e-6 && horizontales < 160;
      norte += paso
    ) {
      horizontales++;
      const coordenadas: number[][] = [];
      for (let i = 0; i < muestras; i++) {
        const este = xMin + ((xMax - xMin) * i) / (muestras - 1);
        const punto = aVista([este, norte]);
        if (!Number.isFinite(punto[0]) || !Number.isFinite(punto[1])) break;
        coordenadas.push([punto[0], punto[1]]);
      }
      if (coordenadas.length < muestras) continue;
      source.addFeature(new Feature(new LineString(coordenadas)));

      const etiqueta = new Feature(
        new Point(aVista([xMin + desplazamientoX, norte + desplazamientoY])),
      );
      etiqueta.set('etiqueta', `${Math.round(norte)} N`);
      source.addFeature(etiqueta);
    }
  }

  /**
   * Resalta el lote seleccionado con una línea roja gruesa y estampa sobre
   * el mapa la medida (distancia en metros) de cada arista real de su
   * polígono. Las etiquetas son eventuales: permanecen solo mientras el
   * lote siga seleccionado y quedan incluidas en la captura del PDF/impresión.
   *
   * Importante: el GetFeatureInfo se solicita en la proyección de la vista
   * (EPSG:3857), así que las coordenadas del feature llegan en ese SRS; se
   * detecta el SRS real (miembro `crs` del GeoJSON o la vista) y las medidas
   * se calculan siempre sobre coordenadas UTM 18S (metros verdaderos).
   * @param feature Feature GeoJSON del lote devuelto por GetFeatureInfo.
   */
  resaltarLoteSeleccionado(feature: GeoJSONFeature | null): void {
    const map = this._map();
    if (!map || !feature) return;
    // Por defecto asumimos el SRS en que se solicitó el GetFeatureInfo: la vista
    this.aplicarResaltadoLote(feature, map.getView().getProjection()?.getCode());
  }

  /**
   * Red de seguridad para la generación del PDF/impresión: si hay un lote
   * seleccionado pero su resaltado rojo no está dibujado (p. ej. porque el
   * GetFeatureInfo no devolvió geometría), lo recupera vía WFS (siempre en
   * EPSG:32718) y lo dibuja antes de capturar el mapa.
   */
  asegurarResaltadoLoteSeleccionado(): void {
    const codigo = this.loteSeleccionadoCodigo();
    const capaSinDibujo = !this.loteSeleccionLayer?.getSource()?.getFeatures().length;
    if (!codigo || !capaSinDibujo) return;
    this.searchLoteByCodigoCatastral(codigo).subscribe({
      next: feature => {
        if (feature && this.loteSeleccionadoCodigo()) {
          this.aplicarResaltadoLote(feature, 'EPSG:32718');
        }
      },
      error: err => console.error('No se pudo recuperar la geometría del lote:', err),
    });
  }

  /**
   * Dibuja el polígono del lote (línea roja gruesa) y sus medidas por arista.
   * @param feature Feature GeoJSON del lote.
   * @param srsPorDefecto SRS asumido cuando el GeoJSON no declara `crs`.
   */
  private aplicarResaltadoLote(feature: GeoJSONFeature, srsPorDefecto?: string): void {
    const map = this._map();
    if (!map) return;
    if (!feature?.geometry) {
      // Sin geometría (respuesta incompleta): la recuperamos vía WFS en UTM 18S
      const codigo = feature?.properties?.['id_lote'] ?? this.loteSeleccionadoCodigo();
      if (codigo) {
        this.searchLoteByCodigoCatastral(String(codigo)).subscribe({
          next: f => { if (f) this.aplicarResaltadoLote(f, 'EPSG:32718'); },
          error: err => console.error('No se pudo resaltar el lote seleccionado:', err),
        });
      }
      return;
    }
    this.limpiarResaltadoLoteSeleccionado();

    const source = this.loteSeleccionLayer?.getSource();
    const proyeccionVista = map.getView().getProjection();
    if (!source || !proyeccionVista) return;

    try {
      const formato = new GeoJSON();
      const srsOrigen = this.detectarSrsOrigen(feature)
        ?? srsPorDefecto
        ?? proyeccionVista.getCode();

      // Geometría reproyectada a la vista del mapa (para dibujar)
      const geometria = formato.readGeometry(feature.geometry, {
        dataProjection: srsOrigen,
        featureProjection: proyeccionVista,
      });
      if (!geometria) return;
      source.addFeature(new Feature({ geometry: geometria }));

      // Anillos del polígono convertidos a UTM 18S (metros reales) para medir
      const geometriaUtm = formato.readGeometry(feature.geometry, {
        dataProjection: srsOrigen,
        featureProjection: 'EPSG:32718',
      });
      if (!geometriaUtm) return;
      let anillosUtm: number[][][] = [];
      if (geometriaUtm.getType() === 'Polygon') {
        anillosUtm = (geometriaUtm as unknown as { getCoordinates(): number[][][] }).getCoordinates();
      } else if (geometriaUtm.getType() === 'MultiPolygon') {
        const poligonos = (geometriaUtm as unknown as { getCoordinates(): number[][][][] }).getCoordinates();
        anillosUtm = poligonos.flat();
      }

      // Medidas por arista -> etiquetas en el punto medio (proyectadas a la vista)
      this.calcularMedidasDeAnillos(anillosUtm).forEach(medida => {
        const puntoVista = transform(medida.punto as [number, number], 'EPSG:32718', proyeccionVista);
        const etiqueta = new Feature(new Point(puntoVista));
        etiqueta.set('etiqueta', medida.texto);
        source.addFeature(etiqueta);
      });
    } catch (err) {
      console.error('No se pudo resaltar el lote seleccionado:', err);
    }
  }

  /** Extrae el código EPSG declarado en el miembro `crs` del GeoJSON (si existe). */
  private detectarSrsOrigen(feature: GeoJSONFeature): string | undefined {
    const nombre = feature.crs?.properties?.name?.trim() ?? '';
    const coincidencia = /(\d{4,5})$/.exec(nombre);
    return coincidencia ? `EPSG:${coincidencia[1]}` : undefined;
  }

  /**
   * Calcula las aristas reales de un conjunto de anillos de polígono y su
   * longitud en metros (coordenadas UTM). Los vértices casi colineales se
   * fusionan para que cada etiqueta corresponda a un lado verdadero del
   * lote y no a segmentos intermedios de la digitalización.
   */
  private calcularMedidasDeAnillos(anillos: number[][][]): { punto: number[]; texto: string }[] {
    const umbralAnguloRad = (8 * Math.PI) / 180;
    const medidas: { punto: number[]; texto: string }[] = [];

    anillos.forEach(anillo => {
      // Eliminamos vértices consecutivos duplicados
      const limpio: number[][] = [];
      for (const coord of anillo) {
        const previa = limpio[limpio.length - 1];
        if (!previa || Math.hypot(coord[0] - previa[0], coord[1] - previa[1]) > 1e-4) {
          limpio.push([coord[0], coord[1]]);
        }
      }
      // Eliminamos el punto de cierre duplicado
      if (limpio.length > 2) {
        const primera = limpio[0];
        const ultima = limpio[limpio.length - 1];
        if (Math.hypot(primera[0] - ultima[0], primera[1] - ultima[1]) < 1e-4) limpio.pop();
      }
      if (limpio.length < 3) return;

      // Esquinas: vértices donde la dirección cambia más que el umbral
      const total = limpio.length;
      const esquinas: number[][] = [];
      for (let i = 0; i < total; i++) {
        const anterior = limpio[(i - 1 + total) % total];
        const actual = limpio[i];
        const siguiente = limpio[(i + 1) % total];
        const v1x = actual[0] - anterior[0];
        const v1y = actual[1] - anterior[1];
        const v2x = siguiente[0] - actual[0];
        const v2y = siguiente[1] - actual[1];
        const angulo = Math.atan2(v1x * v2y - v1y * v2x, v1x * v2x + v1y * v2y);
        if (Math.abs(angulo) >= umbralAnguloRad) esquinas.push(actual);
      }
      // Fallback: sin esquinas claras (polígono curvo) usamos todos los vértices
      const referencia = esquinas.length >= 3 ? esquinas : limpio;

      // Medimos cada arista entre esquinas consecutivas
      for (let i = 0; i < referencia.length; i++) {
        const a = referencia[i];
        const b = referencia[(i + 1) % referencia.length];
        const distancia = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (distancia < 0.05) continue; // Aristas despreciables
        medidas.push({
          punto: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
          texto: `${distancia.toFixed(2).replace('.', ',')} m`,
        });
      }
    });

    return medidas;
  }
  /**
   * Desplaza el centro del mapa para compensar la apertura o cierre del sidebar.
   * @param sidebarOpen `true` si el sidebar se está abriendo, `false` si se está cerrando.
   * @param sidebarWidth Ancho en píxeles del sidebar.
   */
  panMapForSidebar(sidebarOpen: boolean, sidebarWidth: number): void {
    const map = this._map();
    if (!map) return;

    const view = map.getView();
    const currentCenter = view.getCenter();
    if (!currentCenter) return;

    const resolution = view.getResolution()!;
    // El desplazamiento es la mitad del ancho del sidebar para mantener el foco en el centro del área visible.
    const offset = (sidebarOpen ? -sidebarWidth / 2 : sidebarWidth / 2) * resolution;

    const newCenter = [currentCenter[0] + offset, currentCenter[1]];

    view.animate({
      center: newCenter,
      duration: 300, // Coincide con la duración de la animación del sidebar
      easing: easeOut,
    });
  }

  /**
   * Compone todos los canvas de las capas del mapa en un único lienzo
   * (con fondo blanco), respetando el orden visual. Usado para exportar
   * el mapa a imágenes/PDF sin dependencias externas de rasterizado.
   * @returns Lienzo compuesto o `null` si el mapa no está inicializado.
   */
  getMapCanvas(): HTMLCanvasElement | null {
    const map = this._map();
    if (!map) return null;
    // Forzamos un render síncrono para que los tiles pendientes se pinten
    map.renderSync();
    const size = map.getSize() ?? [0, 0];
    const target = document.createElement('canvas');
    target.width = size[0];
    target.height = size[1];
    const ctx = target.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, target.width, target.height);
    // Dibujamos cada canvas de capa en orden (el orden DOM refleja el apilado)
    const canvases = map.getViewport().querySelectorAll('canvas');
    canvases.forEach(canvas => {
      const cssW = parseFloat((canvas as HTMLCanvasElement).style.width) || canvas.width;
      const cssH = parseFloat((canvas as HTMLCanvasElement).style.height) || canvas.height;
      ctx.drawImage(canvas, 0, 0, cssW, cssH);
    });
    return target;
  }

  /**
   * Genera y descarga un PDF del mapa utilizando el servicio de impresión de GeoServer.
   * @param options Opciones de impresión como formato, resolución y decoraciones.
   */
  async printMap(options: {
    format: 'A4' | 'A3' | 'A2';
    resolution: 72 | 150 | 300;
    includeGrid: boolean;
    includeFrame: boolean;
  }): Promise<void> {
    const map = this._map();
    if (!map) {
      throw new Error('El mapa no está inicializado.');
    }

    const view = map.getView();
    const projection = view.getProjection()?.getCode() ?? 'EPSG:3857';
    const extent = view.calculateExtent(map.getSize());
    const center = getCenter(extent);

    // Construye la lista de capas visibles para la impresión.
    const layers: ({ type: 'WMS', layers: any[], baseURL: string, format: string } | { type: 'XYZ' })[] = [];
    map.getLayers().forEach((layer: BaseLayer) => {
      // Usamos 'instanceof Layer' para asegurar que la capa tiene el método getSource()
      if (layer.getVisible() && layer instanceof Layer) {
        const source = layer.getSource();
        if (source instanceof ImageWMS) {
          const url = source.getUrl();
          if (!url) {
            return;
          }

          const params = source.getParams();
          layers.push({
            type: 'WMS',
            layers: [params.LAYERS],
            baseURL: url,
            format: 'image/png',
          });
        } else if (source instanceof XYZ) {
          // El módulo de impresión de GeoServer puede no soportar XYZ directamente.
          // Una alternativa es usar un WMS equivalente o una capa base soportada.
          // Aquí asumimos que el servicio de impresión tiene una capa base configurada.
        }
      }
    });

    // Define las decoraciones basadas en las opciones del usuario.
    const decorations = [];
    if (options.includeFrame) {
      decorations.push({
        type: 'mapgrid',
        label: true, // Muestra las coordenadas
      });
    }
    if (options.includeGrid) {
      decorations.push({
        type: 'grid',
        numberOfLines: [5, 5],
        style: {
          stroke: 'black',
          strokeWidth: 0.5,
          strokeDashstyle: 'dot',
        },
      });
    }

    // Cuerpo de la solicitud para el servicio de impresión de GeoServer.
    const printSpec = {
      layout: options.format,
      srs: projection,
      units: 'm',
      dpi: options.resolution,
      layers: layers,
      pages: [{
        center: center,
        scale: map.getView().getResolution()! * 72 * 39.37, // Aproximación de escala
        decorations: decorations,
      }],
    };

    // URL del servicio de impresión (ajustar según tu configuración)
    const printUrl = `${environment.geoserver.serverImpresionLocal}/pdf/print.pdf`;

    const response = await fetch(printUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(printSpec),
    });

    if (!response.ok) {
      throw new Error(`Error del servidor de impresión: ${response.statusText}`);
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `mapa-san-isidro-${new Date().toISOString().slice(0, 10)}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  }
}

