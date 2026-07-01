import { Injectable, signal, inject, NgZone, effect } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { easeOut } from 'ol/easing';
import { 
  LayerItem,
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
  fromLonLat,
  OlMap,
  TileLayer,
  TileWMS,
  View,  
  XYZ,
  ImageWMS,
  
  transform,
  transformExtent,
  GeoJSON
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
      expanded: false,
      items: [
        {
          type: 'subsection',
          id: 'tusne',
          title: 'TUSNE',
          expanded: true,
          layers: [
            
          ]
        },
           {
          type: 'subsection',
          id: 'sectores',
          title: 'SECTORES',
          expanded: false,
          layers: [
          { type: 'layer', id: "sec_catastrales", label: "SECTORES CATASTRALES", visible: false, opacity: 1 },
          { type: 'layer', id: "sec_vecinal", label: "SECTORES VECINALES", visible: false, opacity: 1 },
              
          ]
        },  
        {
          type: 'subsection',
          id: 'limites-areas',
          title: 'Límites y Áreas',
          expanded: false,
          layers: [
            { type: 'layer', id: "manzana", label: "MANZANA CATASTRAL", visible: true, opacity: 1 },
            { type: 'layer', id: "lote", label: "LOTE CATASTRAL", visible: true, opacity: 1 },
            { type: 'layer', id: "arearecreativa", label: "ÁREA RECREATIVA", visible: true, opacity: 1 },
            { type: 'layer', id: "veredas", label: "VEREDAS", visible: true, opacity: 1 },
            { type: 'layer', id: "construcciones", label: "CONSTRUCCIONES", visible: true, opacity: 1 },
            
          ]
        },
        {
          type: 'subsection',
          id: 'nom_vias',
          title: 'Nomenclatura de Vías',
          expanded: false,
          layers: [
            { type: 'layer', id: "vias", label: "VÍAS", visible: false, opacity: 1 } 
          ]
        }             
      ]
    },     
    {
      id: "imaAereas",
      title: "Imagenes Aereas",      
      expanded: false,
      items: [
        {
          type: 'subsection',
          id: 'limites-areas',
          title: 'Límites y Áreas',
          expanded: true,
          layers: [
            
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
             { type: 'layer', id: "mz_colindantes", label: "Manzanas", visible: true, opacity: 1 } 
            
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
      { id: 'lote', layerName: `${workspacePrefix}vw_tg_lote`, zIndex: 0, title: 'Lote Catastral' },
      { id: 'manzana', layerName: `${workspacePrefix}vw_tg_manzana`, zIndex: 0, title: 'Manzana Catastral' },
      { id: 'veredas', layerName: `${workspacePrefix}vw_tg_comp_via`, zIndex: 0, title: 'Veredas' },
      { id: 'arearecreativa', layerName: `${workspacePrefix}vw_tg_area_rec,vw_tg_area_privada`, zIndex: 0, title: 'Área Recreativa' },
      { id: 'sec_catastrales', layerName: `${workspacePrefix}vw_tg_sec_catastro,vw_tg_sec_catastro_puntos`, zIndex: 0, title: 'Sectores Catastrales'},
      { id: 'sec_vecinal', layerName: `${workspacePrefix}vw_tg_secvecinales,vw_tg_secvecinales_puntos`, zIndex: 1, title: 'Sectores Vecinales'},
      { id: 'vias', layerName: `${workspacePrefix}vw_tg_via`, zIndex: 0, title: 'Vias'},
      { id: 'mz_colindantes', layerName: `${workspacePrefix}tg_manzana_colindante,tg_oceano`, zIndex: 0, title: 'Manzanas Colindantes' }

      
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
              window.open(infoUrl, '_blank');
            }
          }
        });
      }
    });
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
    this.removeLayerById('ig_departamento');

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
   */
  fitToGeometry(geometry: GeoJSONGeometry): void {
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
          return layerData.olLayer as ImageLayer<ImageWMS>;
        }
      }
    }
    return undefined;
  }
}
