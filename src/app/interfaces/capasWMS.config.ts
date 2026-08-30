import { WmsLayerConfig } from './geoLayers';
import { environment } from '../../environments/environment';

const wp = environment.geoserver.workspacePrefix;
/**
 * Grupos de configuración de capas WMS organizados por temática.
 */
const ETIQUETAS_LAYERS: WmsLayerConfig[] = [
  { id: 'lote_urbano', layerName: `${wp}vw_tg_lote_urbano`, zIndex: 1, title: 'Lote Urbano' },
  { id: 'etiquetas_catastrales', layerName: `${wp}gc_mz_lote_catastral_etiqueta`, zIndex: 1, title: 'Etiquetas Catastrales' },
  { id: 'denominacion_predio', layerName: `${wp}denominacion_predio`, zIndex: 1, title: 'Denominación del Predio' },  
];

const INFRAESTRUCTURA_LAYERS: WmsLayerConfig[] = [
  { id: 'puntos_geodesicos', layerName: `${wp}vw_cu_punto_geodesico`, zIndex: 1, title: 'Puntos Geodésicos' },
  { id: 'vias', layerName: `${wp}vw_tg_via`, zIndex: 1, title: 'Vías' },
  { id: 'seccion_vial', layerName: `${wp}gc_seccion_vial`, zIndex: 1, title: 'Sección de Vías' },
  { id: 'num_cuadra', layerName: `${wp}vw_tg_cuadra`, zIndex: 1, title: 'Número de Cuadras' },
];

const NUMERACION_LAYERS: WmsLayerConfig[] = [
  { id: 'num_municipal_2024', layerName: `${wp}vw_numeracion_campo_2024`, zIndex: 0, title: 'Numeración de campo 2024' },
  { id: 'puertas2024', layerName: `${wp}vw_tg_puertas`, zIndex: 0, title: 'Puertas 2024' },
  { id: 'num_municipal_2022', layerName: `${wp}vw_numeracion_campo_2022`, zIndex: 0, title: 'Numeración de campo 2022' },
];

const AMBIENTAL_LAYERS: WmsLayerConfig[] = [
  { id: 'arbolado_urbano_2024', layerName: `${wp}vw_arboles_2024`, zIndex: 1, title: 'Árboles 2024' },
  { id: 'arbolado_urbano_2015', layerName: `${wp}vw_arboles_2015`, zIndex: 1, title: 'Árboles 2015' },
  { id: 'cactus_yucca_2015', layerName: `${wp}vw_arboles_2015_cactus`, zIndex: 1, title: 'Cactus - Yucca 2015' },
  { id: 'arearecreativa', layerName: `${wp}gc_area_verde`, zIndex: 1, title: 'Área Recreativa' },
];

const CATASTRALES_LAYERS: WmsLayerConfig[] = [
  { id: 'construcciones', layerName: `${wp}vw_tg_construcciones`, zIndex: 0, title: 'Construcciones' },
  { id: 'lote', layerName: `${wp}vw_tg_lote`, zIndex: 0, title: 'Lote Catastral' },
  { id: 'manzana', layerName: `${wp}vw_tg_manzana`, zIndex: 0, title: 'Manzana Catastral' },
  { id: 'veredas', layerName: `${wp}vw_tg_comp_via`, zIndex: 0, title: 'Veredas' },
  { id: 'mz_colindantes', layerName: `${wp}tg_manzana_colindante,tg_oceano,tg_distrito_colin_nombres,tg_limiteDistrital`, zIndex: 0, title: 'Cartografía otros distritos' },
];

const SECTORES_LAYERS: WmsLayerConfig[] = [
  { id: 'hab_urbana', layerName: `${wp}gc_habilitacion_urbana`, zIndex: 0, title: 'Habilitación Urbana' },
  { id: 'sec_subvecinal', layerName: `${wp}gc_subsector_vecinal`, zIndex: 0, title: 'Subsectores Vecinales' },
  { id: 'sec_vecinal', layerName: `${wp}gc_sector_vecinal`, zIndex: 0, title: 'Sectores Vecinales' },
  { id: 'sec_catastrales', layerName: `${wp}gc_sector_catastral`, zIndex: 0, title: 'Sectores Catastrales' },
];

const VUELOS_LAYERS: WmsLayerConfig[] = [
  { id: 'fotos_sin_2018', layerName: `${wp}vw_tg_fotosSinProcesar_2018`, zIndex: 0, title: 'Fotos sin Procesar - 2018' },
  { id: 'fotos_sin_2024', layerName: `${wp}vw_tg_fotosSinProcesar_2024`, zIndex: 0, title: 'Fotos sin Procesar - 2024' },
];

const NORMATIVA_LAYERS: WmsLayerConfig[] = [
  { id: 'etiq_zonificacion', layerName: `${wp}vw_nor_zonificacion_poligono_puntos`, zIndex: 1, title: 'Etiqueta Zonificación' },
  { id: 'zonificacion', layerName: `${wp}gcZonificacion`, zIndex: 1, title: 'Zonificación' },
  { id: 'amUrbHomogeneo', layerName: `${wp}vw_nor_ambitos_urbanos_homogeneos`, zIndex: 1, title: 'Ámbito Urbano Homogéneo' },
  { id: 'tusne', layerName: `${wp}vw_tg_tusne`, zIndex: 1, title: 'Levantamiento Topográfico' },
];

const ACCESIBILIDAD: WmsLayerConfig[] = [
  { id: 'cruces_accesibilidad_1', layerName: `${wp}vw_cruces_sector_vecinal_01`, zIndex: 1, title: 'Cruce Sector Vecinal 01'},
  { id: 'cruces_accesibilidad_2', layerName: `${wp}vw_cruces_sector_vecinal_02`, zIndex: 1, title: 'Cruce Sector Vecinal 02'},
  { id: 'cruces_accesibilidad_3', layerName: `${wp}vw_cruces_sector_vecinal_03`, zIndex: 1, title: 'Cruce Sector Vecinal 03'},
  { id: 'cruces_accesibilidad_4', layerName: `${wp}vw_cruces_sector_vecinal_04`, zIndex: 1, title: 'Cruce Sector Vecinal 04'},
  { id: 'cruces_accesibilidad_5', layerName: `${wp}vw_cruces_sector_vecinal_05`, zIndex: 1, title: 'Cruce Sector Vecinal 05'},
  { id: 'manzanas_cruces_accesibilidad_1', layerName: `${wp}vw_manzanas_sector_vecinal_01`, zIndex: 1, title: 'Manzana Sector Vecinal 01'},
  { id: 'manzanas_cruces_accesibilidad_2', layerName: `${wp}vw_manzanas_sector_vecinal_02`, zIndex: 1, title: 'Manzana Sector Vecinal 02'},
  { id: 'manzanas_cruces_accesibilidad_3', layerName: `${wp}vw_manzanas_sector_vecinal_03`, zIndex: 1, title: 'Manzana Sector Vecinal 03'},
  { id: 'manzanas_cruces_accesibilidad_4', layerName: `${wp}vw_manzanas_sector_vecinal_04`, zIndex: 1, title: 'Manzana Sector Vecinal 04'},
  { id: 'manzanas_cruces_accesibilidad_5', layerName: `${wp}vw_manzanas_sector_vecinal_05`, zIndex: 1, title: 'Manzana Sector Vecinal 05'},
];

const TEMATICA: WmsLayerConfig[] = [
  { id: 'tem_parametros', layerName: `${wp}view_parametros_urbanisticos`, zIndex: 0, title: 'Parámetros Urbanisticos y Edificatorios' },  
];
/**
 * Configuración centralizada para las capas WMS que se cargarán inicialmente en el mapa.
 * Mover esta configuración a un archivo dedicado facilita el mantenimiento y la adición
 * de nuevas capas WMS sin modificar la lógica del `MapService`.
 */
export const INITIAL_WMS_LAYERS: WmsLayerConfig[] = [
  ...ETIQUETAS_LAYERS,
  ...INFRAESTRUCTURA_LAYERS,
  ...NUMERACION_LAYERS,
  ...AMBIENTAL_LAYERS,
  ...CATASTRALES_LAYERS,
  ...SECTORES_LAYERS,
  ...VUELOS_LAYERS,
  ...NORMATIVA_LAYERS,
  ...ACCESIBILIDAD,
  ...TEMATICA
];

