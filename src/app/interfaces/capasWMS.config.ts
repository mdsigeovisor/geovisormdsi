import { WmsLayerConfig } from './geoLayers';
import { environment } from '../../environments/environment';

const workspacePrefix = environment.geoserver.workspacePrefix;

/**
 * Configuración centralizada para las capas WMS que se cargarán inicialmente en el mapa.
 * Mover esta configuración a un archivo dedicado facilita el mantenimiento y la adición
 * de nuevas capas WMS sin modificar la lógica del `MapService`.
 */
export const INITIAL_WMS_LAYERS: WmsLayerConfig[] = [
  //* Trama Externa
  { id: 'mz_colindantes', layerName: `${workspacePrefix}tg_manzana_colindante,tg_oceano,tg_distrito_colin_nombres,tg_limiteDistrital`, zIndex: 0, title: 'Cartografia otros distritos' },
  //* Sectores
  { id: 'hab_urbana', layerName: `${workspacePrefix}gc_habilitacion_urbana`, zIndex: 0, title: 'Habilitación Urbana' },
  { id: 'lote_urbano', layerName: `${workspacePrefix}vw_tg_lote_urbano`, zIndex: 0, title: 'Lote Urbano' },
  // Puntos Geodesicos
  { id: 'puntos_geodesicos', layerName: `${workspacePrefix}vw_cu_punto_geodesico`, zIndex: 1, title: 'Puntos Geodésicos' },
  // Sectores y Subsectores
  { id: 'sec_subvecinal', layerName: `${workspacePrefix}gc_subsector_vecinal`, zIndex: 0, title: 'Subsectores Vecinales' },
  { id: 'sec_vecinal', layerName: `${workspacePrefix}gc_sector_vecinal`, zIndex: 0, title: 'Sectores Vecinales' },
  { id: 'sec_catastrales', layerName: `${workspacePrefix}gc_sector_catastral`, zIndex: 0, title: 'Sectores Catastrales' },
  //* Capas Catastrales
  { id: 'construcciones', layerName: `${workspacePrefix}vw_tg_construcciones`, zIndex: 1, title: 'Construcciones' },
  { id: 'lote', layerName: `${workspacePrefix}gc_lote_catastral`, zIndex: 0, title: 'Lote Catastral' },
  { id: 'manzana', layerName: `${workspacePrefix}gc_manzana_catastral`, zIndex: 0, title: 'Manzana Catastral' },
  { id: 'veredas', layerName: `${workspacePrefix}vw_tg_comp_via`, zIndex: 0, title: 'Veredas' },
  { id: 'arearecreativa', layerName: `${workspacePrefix}gc_area_verde`, zIndex: 0, title: 'Área Recreativa' },
  { id: 'vias', layerName: `${workspacePrefix}vw_tg_via`, zIndex: 0, title: 'Vias' },
  { id: 'num_cuadra', layerName: `${workspacePrefix}vw_tg_cuadra`, zIndex: 0, title: 'Número de Cuadras' },
  { id: 'puertas', layerName: `${workspacePrefix}vw_tg_puertas`, zIndex: 0, title: 'Puertas' },
  
  //* Vuelos y otros  
  { id: 'fotos_sin_2018', layerName: `${workspacePrefix}vw_tg_fotosSinProcesar_2018`, zIndex: 0, title: 'Fotos sin Procesar - 2018' },
  { id: 'fotos_sin_2024', layerName: `${workspacePrefix}vw_tg_fotosSinProcesar_2024`, zIndex: 0, title: 'Fotos sin Procesar - 2024' },


  //Normativa Urbana
  { id: 'zonificacion', layerName: `${workspacePrefix}vw_nor_zonificacion_poligono`, zIndex: 1, title: 'Zonificación' },
  { id: 'etiq_zonificacion', layerName: `${workspacePrefix}vw_nor_zonificacion_poligono_puntos`, zIndex: 2, title: 'Etiqueta Zonificación' },
];