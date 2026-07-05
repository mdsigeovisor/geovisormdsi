import { Injectable, signal, inject, NgZone, effect } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { easeOut } from 'ol/easing';
import {
  Section,
  WmsLayerConfig,
  GeoJSONFeature,
  WfsResponse,
  GeoJSONGeometry
} from '../interfaces/geoLayers';
import { Observable, map } from 'rxjs';
import {
  INITIAL_CENTER,
  INITIAL_ZOOM,
  GOOGLE_SATELLITE_URL,
  OSM_URL,
  TRAMA_WMS_URL,
  ANIMATION_DURATION,
  SAN_ISIDRO_CENTER,
  SAN_ISIDRO_ZOOM
} from '../interfaces/map.constants';
import {
  fromLonLat,  OlMap,
  TileLayer,
  View,
  XYZ,
  ImageWMS,
  transform,
  transformExtent,
  GeoJSON,
  Overlay,
  getCenter
} from '../modules/openlayers.module';
import ImageLayer from 'ol/layer/Image';

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
  /**
   * Signal que gestiona las secciones y capas del visor.
   */
  sections = signal<Section[]>([
    {
      id: "catastral",
      title: "Información Catastral",
      subtitle: "INFORMACIÓN GPUC",
      expanded: false,
      items: [       
           {
          type: 'subsection',
          id: 'sectores',
          title: 'SECTORIZACIÓN',
          expanded: false,
          layers: [
          { type: 'layer', id: "hab_urbana", label: "Habilitación Urbana", visible: false, opacity: 1, showInLegend: false },
          { type: 'layer', id: "sec_catastrales", label: "Sectores Catastrales", visible: false, opacity: 1, showInLegend: false },
          { type: 'layer', id: "sec_vecinal", label: "Sectores Vecinales", visible: false, opacity: 1, showInLegend: false },
          { type: 'layer', id: "sec_subvecinal", label: "Sub Sectores - Junta Vecinal", visible: false, opacity: 1, showInLegend: false }

          ]
        },
        {
          type: 'subsection',
          id: 'catastro',
          title: 'CARTOGRAFIA CATASTRAL',
          expanded: false,
          layers: [
            { type: 'layer', id: "num_cuadra", label: "Cuadra", visible: true, opacity: 1, showInLegend: false },
            { type: 'layer', id: "construcciones", label: "Construcciones", visible: true, opacity: 1, showInLegend: false },
            { type: 'layer', id: "lote", label: "Lote", visible: true, opacity: 1, showInLegend: false },
            { type: 'layer', id: "manzana", label: "Manzana", visible: true, opacity: 1, showInLegend: false },
            { type: 'layer', id: "veredas", label: "Veredas", visible: true, opacity: 1, showInLegend: false },
            { type: 'layer', id: "arearecreativa", label: "Área Recreativa", visible: true, opacity: 1, showInLegend: false },



          ]
        },
        {
          type: 'subsection',
          id: 'nom_vias',
          title: 'VIAS',
          expanded: false,
          layers: [
            { type: 'layer', id: "vias", label: "Nomenclatura de Vías", visible: true, opacity: 1, showInLegend: false }
          ]
        }
      ]
    },
    {
      id: "imaAereas",
      title: "Fotográfias Áereas",
      expanded: false,
      items: [
        {
          type: 'subsection',
          id: 'fotos-areas',
          title: 'Fotos sin Procesar',
          expanded: true,
          layers: [
              { type: 'layer', id: "fotos_sin_2018", label: "Fotos sin Procesar - 2018", visible: false, opacity: 1, showInLegend: false }
          ]
        }
      ]
    },
    {
      id: "normatividadUrbana",
      title: "Normatividad Urbana",
      expanded: false,
      items: [
        {
          type: 'subsection',
          id: 'limites-areas',
          title: 'Límites y Áreas',
          expanded: true,
          layers: [

          ]
        },
      ]
    },
    {
      id: "infraestructuraUrbana",
      title: "Infraestructura Urbana",
      expanded: false,
      items: [
        {
          type: 'subsection',
          id: 'limites-areas',
          title: 'Límites y Áreas',
          expanded: true,
          layers: [

          ]
        },
      ]
    },
    {
      id: "informacionTematica",
      title: "Información Temática",
      expanded: false,
      items: [
        {
          type: 'subsection',
          id: 'limites-areas',
          title: 'Límites y Áreas',
          expanded: true,
          layers: [

          ]
        },
      ]
    },
    {
      id: "utilidades",
      title: "Utilidades",
      expanded: false,
      items: [
        {
          type: 'subsection',
          id: 'limites-areas',
          title: 'Límites y Áreas',
          expanded: true,
          layers: [

          ]
        },
      ]
    },
    {
      id: "carto_colindantes",
      title: "Cartografía Colindantes",
      expanded: false,
      items: [
        {
          type: 'subsection',
          id: 'manzanas',
          title: 'Manzanas Colindantes',
          expanded: true,
          layers: [
             { type: 'layer', id: "mz_colindantes", label: "Trama Colindante", visible: true, opacity: 1, showInLegend: false }

          ]
        },
      ]
    }
  ]);

  /** Indica si el mapa ha sido inicializado y está listo para su uso. */
  isReady = signal(false);
  /** Coordenadas actuales del usuario (longitud, latitud). */
  userCoords = signal<{ lon: number, lat: number } | null>(null);
  /** Herramientas del sidebar activas. */
  activeSidebarTools = signal<Set<string>>(new Set());
  /** URL con la información de un lote para mostrar en un modal. */
  loteInfoUrl = signal<string | null>(null);
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
        section.items.forEach(item => {
          if ('layers' in item) { // Es una SubSection
            item.layers.forEach(layerData => {
              if (layerData.olLayer) {
                layerData.olLayer.setVisible(layerData.visible);
                layerData.olLayer.setOpacity(layerData.opacity);
              }
            });
          } else if (item.olLayer) { // Es un LayerItem
            item.olLayer.setVisible(item.visible);
            item.olLayer.setOpacity(item.opacity);
          }
        });
      });
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
    // Inicialización de la capa WMS de departamentos de INEI
    this.addWmsLayer({
      id: 'ig_departamento',
      url: TRAMA_WMS_URL,
      layerName: 'Interoperabilidad:ig_departamento',
      version: '1.1.0',
      zIndex: 5, // zIndex para posicionarse sobre el mapa base
      title: 'IG Departamento'
    });

    // Configuración de capas catastrales municipales
    const workspacePrefix = environment.geoserver.workspacePrefix;
    const catastralLayers: WmsLayerConfig[] = [


      { id: 'construcciones', layerName: `${workspacePrefix}vw_tg_construcciones`, zIndex: 0.5, title: 'Construcciones' },
      { id: 'lote', layerName: `${workspacePrefix}gC_lotesCatastral`, zIndex: 0, title: 'Lote Catastral' },
      { id: 'manzana', layerName: `${workspacePrefix}gC_manzanaCatastral`, zIndex: 0, title: 'Manzana Catastral' },
      { id: 'veredas', layerName: `${workspacePrefix}vw_tg_comp_via`, zIndex: 0, title: 'Veredas' },
      { id: 'arearecreativa', layerName: `${workspacePrefix}vw_area_rec`, zIndex: 1, title: 'Área Recreativa' },

      
      { id: 'hab_urbana', layerName: `${workspacePrefix}gC_HabilitacionUrbana`, zIndex: 2, title: 'Habilitación Urbana'},
      { id: 'sec_subvecinal', layerName: `${workspacePrefix}gC_SubSectorVecinal`, zIndex: 2, title: 'Subsectores Vecinales'},
      { id: 'sec_vecinal', layerName: `${workspacePrefix}gC_SectoresVecinales`, zIndex: 2, title: 'Sectores Vecinales'},
      { id: 'sec_catastrales', layerName: `${workspacePrefix}gC_SectoresCatastrales`, zIndex: 2, title: 'Sectores Catastrales'},

      { id: 'vias', layerName: `${workspacePrefix}vw_tg_via`, zIndex: 2, title: 'Vias'},

      { id: 'num_cuadra', layerName: `${workspacePrefix}vw_tg_cuadra`, zIndex: 1, title: 'Número de Cuadras'},


      { id: 'fotos_sin_2018', layerName: `${workspacePrefix}vw_tg_fotosSinProcesar_2018`, zIndex: 1, title: 'Fotos sin Procesar - 2018'},

      { id: 'mz_colindantes', layerName: `${workspacePrefix}tg_manzana_colindante,tg_oceano,tg_distrito_colin_nombres,tg_limiteDistrital`, zIndex: 0, title: 'Manzanas Colindantes'},
      
    ];

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
   * Configura el manejador de clics en el mapa para obtener información de las capas WMS.
   * @param olMap Instancia del mapa de OpenLayers.
   */
  private setupMapClickHandler(olMap: OlMap): void {
    olMap.on('singleclick', (evt) => {
      const view = olMap.getView();
      const viewResolution = view.getResolution()!;
      const source = this.getLayerById('lote')?.getSource();
      if (!source) return;
      const url = source.getFeatureInfoUrl(
        evt.coordinate,
        viewResolution,
        view.getProjection(),
        { 'INFO_FORMAT': 'application/json', 'FEATURE_COUNT': '1' }
      );
      if (url) {
        this.http.get<WfsResponse>(url).subscribe(response => {
          if (response && response.features && response.features.length > 0) {
            const feature = response.features[0];
            const codigoLote = feature.properties['id_lote'];
            if (codigoLote) {
              const infoUrl = `http://192.168.41.160/DataGIS_WGS84/WEBFILES/informacion.asp?codigo_i=${codigoLote}`;
              this.loteInfoUrl.set(infoUrl);
            }
          }
        });
      }
    });
  }
  /**
   * Limpia la URL de información del lote, para cerrar el modal.
   */
  clearLoteInfo(): void {
    this.loteInfoUrl.set(null);
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

    const format = new GeoJSON();
    const olGeometry = format.readGeometry(geometry, {
      dataProjection: 'EPSG:4326',
      featureProjection: map.getView().getProjection()
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
    const sanIsidroGeometry: GeoJSONGeometry = {
      type: 'Point',
      coordinates: SAN_ISIDRO_CENTER
    };
    this.fitToGeometry(sanIsidroGeometry, true, SAN_ISIDRO_ZOOM);
    if (onComplete) {
      setTimeout(() => onComplete(true), duration);
    }
  }
  /**
   * Métodos para actualizar el estado de las secciones desde la UI
   */
  toggleSectionExpanded(sectionId: string): void {
    this.sections.update(s => s.map(sec =>
      sec.id === sectionId ? { ...sec, expanded: !sec.expanded } : sec
    ));
  }

  toggleLayerVisibility(sectionId: string, layerId: string) {
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
  fitToGeometry(geometry: GeoJSONGeometry, offset = false, zoom?: number): void {
    const map = this._map();
    if (!map || !geometry?.coordinates) return;
    const format = new GeoJSON();
    // Leemos la geometría directamente para evitar la ambigüedad de tipo (Feature vs Feature[])
    const geometryOl = format.readGeometry(geometry);
    if (!geometryOl) return;

    const view = map.getView();
    const extent = geometryOl.getExtent();
    // Detectamos proyección: Si el valor de X es grande, asumimos UTM 18S
    const sourceProjection = Math.abs(extent[0]) > 180 ? 'EPSG:32718' : 'EPSG:4326';
    const transformedExtent = transformExtent(extent, sourceProjection, view.getProjection());

    const options: any = {
      duration: ANIMATION_DURATION,
      padding: [100, 100, 100, 420] // Aumentamos el padding derecho para compensar el sidebar
    };

    if (geometry.type === 'Point' && zoom) {
      options.zoom = zoom;
    }

    view.fit(transformedExtent, options);
  }
  /**
   * Busca un lote por su código catastral (id_lote) consultando el servicio WFS de GeoServer.
   * @param codigo Código catastral en formato XX-XXX-XXX
   * @returns Observable con el feature encontrado o null
   */
  searchLoteByCodigo(codigo: string): Observable<GeoJSONFeature | null> {
    const url = environment.geoserver.owsUrl;
    // Limpiamos guiones y espacios en blanco (ej: '3112065002    ' -> '3112065002')
    const codigoSinGuiones = codigo.replaceAll('-', '').trim();
    // Usamos HttpParams para asegurar la correcta construcción y codificación del cql_filter
    const params = new HttpParams()
      .set('service', 'WFS')
      .set('version', '1.1.0')
      .set('request', 'GetFeature')
      .set('typeName', 'mdsibde2026:vw_tg_lote')
      .set('outputFormat', 'application/json')
      // Forzamos a GeoServer a entregar coordenadas en grados decimales
      .set('srsName', 'EPSG:4326')
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
      .set('srsName', 'EPSG:4326')
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
   * Busca vías por dirección (tipo, nombre, cuadra) consultando el servicio WFS de GeoServer.
   * @param tipoViaId ID numérico del tipo de vía.
   * @param nombreVia Parte del nombre de la vía.
   * @param numeroCuadra Número de la cuadra.
   * @returns Observable con un array de features encontrados o null.
   */
  searchViasByDireccion(tipoViaId: number, nombreVia: string, numeroCuadra: string): Observable<GeoJSONFeature[] | null> {
    const url = environment.geoserver.owsUrl;
    const workspacePrefix = environment.geoserver.workspacePrefix;

    // Construcción del filtro CQL
    let cqlParts: string[] = [];
    if (tipoViaId > 0) {
      cqlParts.push(`tipo_via = ${tipoViaId}`);
    }
    if (nombreVia.trim()) {
      // Usamos ILIKE para búsqueda insensible a mayúsculas/minúsculas
      cqlParts.push(`nomenclatura ILIKE '%${nombreVia.trim().toUpperCase()}%'`);
    }
    if (numeroCuadra.trim()) {
      cqlParts.push(`num_cuadr = '${numeroCuadra.trim()}'`);
    }

    const params = new HttpParams()
      .set('service', 'WFS')
      .set('version', '1.1.0')
      .set('request', 'GetFeature')
      .set('typeName', `${workspacePrefix}vw_tg_via`)
      .set('outputFormat', 'application/json')
      .set('srsName', 'EPSG:4326')
      .set('cql_filter', cqlParts.join(' AND '));

    return this.http.get<WfsResponse>(url, { params }).pipe(
      map(response => response?.features?.length > 0 ? response.features : null)
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
   * Obtiene una lista de nomenclaturas de vías únicas para autocompletado.
   * @param partialName Parte del nombre de la vía a buscar.
   * @returns Un Observable con un array de nomenclaturas de vías únicas.
   */
  getUniqueVias(partialName: string): Observable<string[]> {
    if (!partialName || partialName.trim().length < 3) {
      return new Observable(subscriber => subscriber.next([])); // Devuelve un array vacío si la entrada es muy corta
    }

    const url = environment.geoserver.owsUrl;
    const workspacePrefix = environment.geoserver.workspacePrefix;

    const params = new HttpParams()
      .set('service', 'WFS')
      .set('version', '2.0.0') // Usamos 2.0.0 para soporte de propertyName
      .set('request', 'GetFeature')
      .set('typeName', `${workspacePrefix}vw_tg_via`)
      .set('outputFormat', 'application/json')
      .set('cql_filter', `nomenclatura ILIKE '%${partialName.trim().toUpperCase()}%'`)
      .set('propertyName', 'nomenclatura'); // Pedimos solo la nomenclatura

    return this.http.get<WfsResponse>(url, { params }).pipe(
      map(response => {
        const allNomenclaturas = response?.features?.map(f => f.properties['nomenclatura']) ?? [];
        return [...new Set(allNomenclaturas)]; // Devolvemos solo valores únicos
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
}
