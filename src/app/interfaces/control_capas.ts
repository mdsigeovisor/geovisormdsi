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
    subtitle: 'INFORMACIÓN GPUC',
    expanded: false,
    items: [
      {
        type: 'subsection',
        id: 'sectores',
        title: 'SECTORIZACIÓN',
        expanded: false,
        layers: [
          { type: 'layer', id: 'hab_urbana', label: 'Habilitación Urbana', visible: false, opacity: 1, showInLegend: false },
          { type: 'layer', id: 'sec_catastrales', label: 'Sectores Catastrales', visible: false, opacity: 1, showInLegend: false },
          { type: 'layer', id: 'sec_vecinal', label: 'Sectores Vecinales', visible: false, opacity: 1, showInLegend: false },
          { type: 'layer', id: 'sec_subvecinal', label: 'Sub Sectores - Junta Vecinal', visible: false, opacity: 1, showInLegend: false },
        ],
      },
      {
        type: 'subsection',
        id: 'catastro',
        title: 'CARTOGRAFIA CATASTRAL',
        expanded: false,
        layers: [
          { type: 'layer', id: 'num_cuadra', label: 'Cuadra', visible: true, opacity: 1, showInLegend: false },
          { type: 'layer', id: 'construcciones', label: 'Construcciones', visible: true, opacity: 1, showInLegend: false },
          { type: 'layer', id: 'lote', label: 'Lote', visible: true, opacity: 1, showInLegend: false },
          { type: 'layer', id: 'manzana', label: 'Manzana', visible: true, opacity: 1, showInLegend: false },
          { type: 'layer', id: 'veredas', label: 'Veredas', visible: true, opacity: 1, showInLegend: false },
          { type: 'layer', id: 'arearecreativa', label: 'Área Recreativa', visible: true, opacity: 1, showInLegend: false },
        ],
      },
      {
        type: 'subsection',
        id: 'nom_vias',
        title: 'VIAS',
        expanded: false,
        layers: [
          { type: 'layer', id: 'vias', label: 'Nomenclatura de Vías', visible: true, opacity: 1, showInLegend: false },
          { type: 'layer', id: 'puertas', label: 'Puertas', visible: false, opacity: 1, showInLegend: true },
        ],
      },
    ],
  },
  {
    id: 'imaAereas',
    title: 'Fotográfias Áereas',
    subtitle: 'INFORMACIÓN DE VUELOS',
    expanded: false,
    items: [
      {
        type: 'subsection',
        id: 'ortofotos',
        title: 'Ortofotos',
        expanded: true,
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
        expanded: true,
        layers: [
          { type: 'layer', id: 'fotos_sin_2018', label: 'Fotos sin Procesar - 2018', visible: false, opacity: 1, showInLegend: false },
          { type: 'layer', id: 'fotos_sin_2024', label: 'Fotos sin Procesar - 2024', visible: false, opacity: 1, showInLegend: false },
        ],
      },
    ],
  },
  {
    id: 'normatividadUrbana',
    title: 'Normatividad Urbana',
    expanded: false,
    items: [{ type: 'subsection', id: 'limites-areas', title: 'Límites y Áreas', expanded: true, layers: [] }],
  },
  {
    id: 'infraestructuraUrbana',
    title: 'Infraestructura Urbana',
    expanded: false,
    items: [{ type: 'subsection', id: 'limites-areas', title: 'Límites y Áreas', expanded: true, layers: [] }],
  },
  {
    id: 'informacionTematica',
    title: 'Información Temática',
    expanded: false,
    items: [{ type: 'subsection', id: 'limites-areas', title: 'Límites y Áreas', expanded: true, layers: [] }],
  },
  {
    id: 'carto_colindantes',
    title: 'Cartografía Colindantes',
    expanded: false,
    items: [
      { type: 'subsection', id: 'manzanas', title: 'Cartografía otros distritos', expanded: true, layers: [{ type: 'layer', id: 'mz_colindantes', label: 'Trama Colindante', visible: true, opacity: 1, showInLegend: false }] },
    ],
  },
];