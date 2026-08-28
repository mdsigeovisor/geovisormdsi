import { Section } from './geoLayers';
import { ORTOFOTO_YEARS } from './ortofotos';
/**
 * Configuración centralizada para las secciones y capas del panel lateral.
 * Este array define la estructura completa del panel de capas, facilitando
 * su mantenimiento y modificación sin alterar la lógica del `MapService`.
 */
export const LAYER_PANEL_SECTIONS: Section[] = [
  {
    id: 'catastral',
    title: 'Información Catastral',    
    expanded: false,
    items: [
      {
        type: 'subsection',
        id: 'catastro',
        title: 'CARTOGRAFIA',
        expanded: false,
        layers: [
          { type: 'layer', id: 'num_cuadra', label: 'Cuadra', visible: true, opacity: 1, showInLegend: false },
          { type: 'layer', id: 'construcciones', label: 'Construcciones', visible: true, opacity: 1, showInLegend: true },
          { type: 'layer', id: 'lote', label: 'Lote', visible: true, opacity: 1, showInLegend: true },
          { type: 'layer', id: 'manzana', label: 'Manzana', visible: true, opacity: 1, showInLegend: true },
          { type: 'layer', id: 'veredas', label: 'Veredas', visible: true, opacity: 1, showInLegend: false },
          { type: 'layer', id: 'arearecreativa', label: 'Área Recreativa', visible: true, opacity: 1, showInLegend: false },
        ],
      },      
    ],
  },
  {
    id: 'sectorizacion',
    title: 'Sectorización',
    expanded: false,
    items: [
      { type: 'layer', id: 'sec_catastrales', label: 'Sectores Catastrales', visible: false, opacity: 1, showInLegend: false },
      { type: 'layer', id: 'sec_vecinal', label: 'Sectores Vecinales', visible: false, opacity: 1, showInLegend: false },
      { type: 'layer', id: 'hab_urbana', label: 'Urbanizaciones', visible: false, opacity: 1, showInLegend: false },
      { type: 'layer', id: 'sec_subvecinal', label: 'Sub Sectores - Junta Vecinales', visible: false, opacity: 1, showInLegend: false },
    ],
  },
  {
    id: 'lotizacion',
    title: 'Lotización',
    expanded: false,
    items: [
      { type: 'layer', id: 'lote_urbano', label: 'Lote Urbano', visible: false, opacity: 1, showInLegend: false },
      { type: 'layer', id: 'etiquetas_catastrales', label: 'Código Catastral', visible: false, opacity: 1, showInLegend: false },
      { type: 'layer', id: 'denominacion_predio', label: 'Denominación del Predio', visible: false, opacity: 1, showInLegend: false },      
    ],
  },
  {
    id: 'puntosGeodesicos',
    title: 'Puntos Geodésicos',
    expanded: false,
    items: [
      { type: 'layer', id: 'puntos_geodesicos', label: 'Puntos Geodésicos', visible: false, opacity: 1, showInLegend: true },
    ],
  },
  {
    id: 'nomenclatura_vial',
    title: 'Nomenclatura Vial',
    expanded: false,
    items: [
      { type: 'layer', id: 'vias', label: 'Nomenclatura de Vías', visible: true, opacity: 1, showInLegend: false },
      { type: 'layer', id: 'seccion_vial', label: 'Sección vias (Inf. referewncial de campo) ', visible: false, opacity: 1, showInLegend: false },
    ],
  },
  {
    id: 'numeracion_campo',
    title: 'Numeración de Campo',
    expanded: false,
    items: [
      { type: 'layer', id: 'num_municipal_2024', label: 'Numeración de campo 2024', visible: false, opacity: 1, showInLegend: true },
      { type: 'layer', id: 'num_municipal_2022', label: 'Numeración de campo 2022', visible: false, opacity: 1, showInLegend: true },
      { type: 'layer', id: 'puertas2024', label: 'Puertas 2024', visible: false, opacity: 1, showInLegend: true },      
    ],
  },
    {
    id: 'arbolado_urbano',
    title: 'Arbolado Urbano',
    expanded: false,
    items: [
      { type: 'layer', id: 'arbolado_urbano_2024', label: 'Arboles 2024', visible: false, opacity: 1, showInLegend: true },
      { type: 'layer', id: 'arbolado_urbano_2015', label: 'Arboles 2015', visible: false, opacity: 1, showInLegend: true },
      { type: 'layer', id: 'cactus_yucca_2015', label: 'Cactus - Yucca 2015', visible: false, opacity: 1, showInLegend: true },
    ],
  },
  {
    id: 'imaAereas',
    title: 'Fotográfias Áereas',    
    expanded: false,
    items: [
      {
        type: 'subsection',
        id: 'ortofotos',
        title: 'Ortofotos',
        expanded: false,
        // Generamos dinámicamente las capas de ortofotos a partir de la configuración de años
        layers: ORTOFOTO_YEARS.map(year => ({
          type: 'layer',
          id: `ortofoto_${year}`,
          label: `${year}`,
          visible: false,
          opacity: 1,
          showInLegend: false,
        })),
      },
      {
        type: 'subsection',
        id: 'ortofotos-sin-procesar',
        title: 'Ortofotos sin procesar',
        expanded: false,
        layers: [
          { type: 'layer', id: 'fotos_sin_2018', label: 'Fotos sin Procesar - 2018', visible: false, opacity: 1, showInLegend: false },
          { type: 'layer', id: 'fotos_sin_2024', label: 'Fotos sin Procesar - 2024', visible: false, opacity: 1, showInLegend: false },
        ],
      },
    ],
  },
  {
    id: 'normativaUrbana',
    title: 'Normativa Urbana',
    expanded: false,
    items: [
      { type: 'layer', id: 'etiq_zonificacion', label: 'Etiqueta Zonificación', visible: false, opacity: 1, showInLegend: true },
      { type: 'layer', id: 'zonificacion', label: 'Zonificación', visible: false, opacity: 1, showInLegend: true },      
      { type: 'layer', id: 'amUrbHomogeneo', label: 'Ambito Urbano Homogéneo', visible: false, opacity: 1, showInLegend: false },
    ],
  },
  {
    id: 'tusne',
    title: 'TUSNE',
    expanded: false,
    items: [
      { type: 'layer', id: 'tusne', label: 'Levantamiento Topográfico', visible: false, opacity: 1, showInLegend: true },
    ],
  },
];