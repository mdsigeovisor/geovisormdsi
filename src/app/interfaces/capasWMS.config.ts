import { WmsLayerConfig } from './geoLayers';
import { environment } from '../../environments/environment';

const workspacePrefix = environment.geoserver.workspacePrefix;

/**
 * Configuración centralizada para las capas WMS que se cargarán inicialmente en el mapa.
 * Mover esta configuración a un archivo dedicado facilita el mantenimiento y la adición
 * de nuevas capas WMS sin modificar la lógica del `MapService`.
 */
export const INITIAL_WMS_LAYERS: WmsLayerConfig[] = [
  //* Etiquetas
  { id: 'lote_urbano', layerName: `${workspacePrefix}vw_tg_lote_urbano`, zIndex: 2, title: 'Lote Urbano' },
  { id: 'etiquetas_catastrales', layerName: `${workspacePrefix}gc_mz_lote_catastral_etiqueta`, zIndex: 2, title: 'Etiquetas Catastrales' },
  { id: 'denominacion_predio', layerName: `${workspacePrefix}denominacion_predio`, zIndex: 2, title: 'Denominación del Predio' },
  { id: 'lote-no-delimitado', layerName: `${workspacePrefix}tg_lote_no_delimitado`, zIndex: 2, title: 'Denominación del Predio' },  
  // Puntos Geodesicos
  { id: 'puntos_geodesicos', layerName: `${workspacePrefix}vw_cu_punto_geodesico`, zIndex: 1, title: 'Puntos Geodésicos' }, 

  // Vias
  { id: 'vias', layerName: `${workspacePrefix}vw_tg_via`, zIndex: 2, title: 'Vias'},
  { id: 'seccion_vial', layerName: `${workspacePrefix}gc_seccion_vial`, zIndex: 2, title: 'Sección de Vias'},
  
  // Numeracion
  { id: 'num_municipal_2024', layerName: `${workspacePrefix}vw_numeracion_campo_2024`, zIndex: 2, title: 'Numeración Municipal 2024' },
  { id: 'num_municipal_2022', layerName: `${workspacePrefix}vw_numeracion_campo_2022`, zIndex: 2, title: 'Numeración Municipal 2022' },

  // Arbolado Urbano
  { id: 'arbolado_urbano_2024', layerName: `${workspacePrefix}vw_arboles_2024`, zIndex: 3, title: 'Arboldes 2024'},
  { id: 'arbolado_urbano', layerName: `${workspacePrefix}vw_arboles_2015`, zIndex: 3, title: 'Arboldes 2015'},
  //* Capas Catastrales
  
  { id: 'construcciones', layerName: `${workspacePrefix}vw_tg_construcciones`, zIndex: 1, title: 'Construcciones' },
  { id: 'lote', layerName: `${workspacePrefix}vw_tg_lote`, zIndex: 0, title: 'Lote Catastral' },
  { id: 'manzana', layerName: `${workspacePrefix}vw_tg_manzana`, zIndex: 0, title: 'Manzana Catastral' },
  { id: 'veredas', layerName: `${workspacePrefix}vw_tg_comp_via`, zIndex: 0, title: 'Veredas' },
  { id: 'arearecreativa', layerName: `${workspacePrefix}gc_area_verde`, zIndex: 0, title: 'Área Recreativa' },
  
  { id: 'num_cuadra', layerName: `${workspacePrefix}vw_tg_cuadra`, zIndex: 2, title: 'Número de Cuadras' },
  { id: 'puertas', layerName: `${workspacePrefix}vw_tg_puertas`, zIndex: 2, title: 'Puertas' },

  //* Trama Externa
  { id: 'mz_colindantes', layerName: `${workspacePrefix}tg_manzana_colindante,tg_oceano,tg_distrito_colin_nombres,tg_limiteDistrital`, zIndex: 0, title: 'Cartografia otros distritos' },
  //* Sectores
  { id: 'hab_urbana', layerName: `${workspacePrefix}gc_habilitacion_urbana`, zIndex: 1, title: 'Habilitación Urbana' },
  
 
  // Sectores y Subsectores
  { id: 'sec_subvecinal', layerName: `${workspacePrefix}gc_subsector_vecinal`, zIndex: 1, title: 'Subsectores Vecinales' },
  { id: 'sec_vecinal', layerName: `${workspacePrefix}gc_sector_vecinal`, zIndex: 1, title: 'Sectores Vecinales' },
  { id: 'sec_catastrales', layerName: `${workspacePrefix}gc_sector_catastral`, zIndex: 1, title: 'Sectores Catastrales' },  
  
  //* Vuelos y otros  
  { id: 'fotos_sin_2018', layerName: `${workspacePrefix}vw_tg_fotosSinProcesar_2018`, zIndex: 1, title: 'Fotos sin Procesar - 2018' },
  { id: 'fotos_sin_2024', layerName: `${workspacePrefix}vw_tg_fotosSinProcesar_2024`, zIndex: 1, title: 'Fotos sin Procesar - 2024' },


  //Normativa Urbana
  { id: 'etiq_zonificacion', layerName: `${workspacePrefix}vw_nor_zonificacion_poligono_puntos`, zIndex: 2, title: 'Etiqueta Zonificación' },
  { id: 'zonificacion', layerName: `${workspacePrefix}vw_nor_zonificacion_poligono`, zIndex: 1, title: 'Zonificación' },  
  { id: 'amUrbHomogeneo', layerName: `${workspacePrefix}vw_nor_ambitos_urbanos_homogeneos`, zIndex: 1, title: 'Ambito Urbano Homogéneo'},
];