import { LayerItem, Section, SubSection } from './geoLayers';
import { ORTOFOTO_YEARS } from './ortofotos';

/* ------------------------------------------------------------------------- */
/*  Fábricas declarativas                                                     */
/* ------------------------------------------------------------------------- */

/** Propiedades opcionales al declarar una capa (lo omitido toma el valor por defecto). */
type CapaOpciones = Partial<Pick<LayerItem, 'visible' | 'opacity' | 'showInLegend'>>;

/**
 * Crea una capa del panel aplicando los valores por defecto
 * (`visible: false`, `opacity: 1`, `showInLegend: false`), de modo que cada
 * entrada solo declara aquello que se desvía del estándar.
 */
const capa = (id: string, label: string, opciones: CapaOpciones = {}): LayerItem => ({
  type: 'layer',
  id,
  label,
  visible: false,
  opacity: 1,
  showInLegend: false,
  ...opciones,
});

/** Crea una subsección plegable con sus capas. */
const subseccion = (id: string, title: string, layers: LayerItem[], expanded = false): SubSection => ({
  type: 'subsection',
  id,
  title,
  expanded,
  layers,
});

/* ------------------------------------------------------------------------- */
/*  Política de acceso (integración con AuthService)                          */
/* ------------------------------------------------------------------------- */

/**
 * Por defecto, TODAS las secciones del panel requieren sesión iniciada
 * (`requiresAuth`; ver `MapService.panelSections`). Si una sección debe verse
 * también sin autenticar, añade su `id` aquí y quedará exenta automáticamente.
 * Para casos finos (una capa o subsección concreta) usa `requiresAuth` en el item.
 */
const SECCIONES_PUBLICAS: ReadonlySet<string> = new Set<string>([
  // Cartografía base: todas sus capas son visibles por defecto y deben poder
  // controlarse desde el panel también en modo público (sin sesión iniciada).
  'catastral',
  'sectorizacion',
  'lotizacion',
  'nomenclatura_vial',
  'numeracion_campo',
  'arbolado_urbano',
  'imaAereas',
  'normativaUrbana'
]);

/** Marca como restringidas todas las secciones que no estén exentas en `SECCIONES_PUBLICAS`. */
const aplicarPoliticaAcceso = (secciones: Section[]): Section[] =>
  secciones.map(s => (SECCIONES_PUBLICAS.has(s.id) ? s : { ...s, requiresAuth: true }));

/* ------------------------------------------------------------------------- */
/*  Estructura del panel (sin política de acceso; se aplica al final)          */
/* ------------------------------------------------------------------------- */

const PANEL_BASE: Section[] = [
  {
    id: 'catastral',
    title: 'Información Catastral',
    expanded: false,
    items: [
      subseccion('catastro', 'CARTOGRAFIA', [
        capa('num_cuadra', 'Cuadra', { visible: true }),
        capa('construcciones', 'Construcciones', { visible: true, showInLegend: true }),
        capa('lote', 'Lote', { visible: true, showInLegend: true }),
        capa('manzana', 'Manzana', { visible: true, showInLegend: true }),
        capa('veredas', 'Veredas', { visible: true }),
        capa('arearecreativa', 'Área Recreativa', { visible: true }),
      ]),
    ],
  },
  {
    id: 'sectorizacion',
    title: 'Sectorización',
    expanded: false,
    items: [
      capa('sec_catastrales', 'Sectores Catastrales'),
      capa('sec_vecinal', 'Sectores Vecinales'),
      capa('hab_urbana', 'Urbanizaciones'),
      capa('sec_subvecinal', 'Sub Sectores - Junta Vecinales'),
    ],
  },
  {
    id: 'lotizacion',
    title: 'Lotización',
    expanded: false,
    items: [
      capa('lote_urbano', 'Lote Urbano'),
      capa('etiquetas_catastrales', 'Código Catastral'),
      capa('denominacion_predio', 'Denominación del Predio'),
    ],
  },
  {
    id: 'puntosGeodesicos',
    title: 'Puntos Geodésicos',
    expanded: false,
    items: [capa('puntos_geodesicos', 'Puntos Geodésicos', { showInLegend: true })],
  },
  {
    id: 'nomenclatura_vial',
    title: 'Nomenclatura Vial',
    expanded: false,
    items: [
      capa('vias', 'Nomenclatura de Vías', { visible: true }),
      // Se conserva el label original tal cual (incluye typo y espacio final).
      capa('seccion_vial', 'Sección vias (Inf. referewncial de campo) '),
    ],
  },
  {
    id: 'numeracion_campo',
    title: 'Numeración de Campo',
    expanded: false,
    items: [
      capa('num_municipal_2024', 'Numeración de campo 2024', { showInLegend: true }),
      capa('num_municipal_2022', 'Numeración de campo 2022', { showInLegend: true }),
      capa('puertas2024', 'Puertas 2024', { showInLegend: true }),
    ],
  },
  {
    id: 'arbolado_urbano',
    title: 'Arbolado Urbano',
    expanded: false,
    items: [
      capa('arbolado_urbano_2024', 'Arboles 2024', { showInLegend: true }),
      capa('arbolado_urbano_2015', 'Arboles 2015', { showInLegend: true }),
      capa('cactus_yucca_2015', 'Cactus - Yucca 2015', { showInLegend: true }),
    ],
  },
  {
    id: 'imaAereas',
    title: 'Fotográfias Áereas',
    expanded: false,
    items: [
      // Capas generadas dinámicamente a partir de la configuración de años.
      // Van como capas directas (sin subsección), igual que 'arbolado_urbano';
      // la regla "solo una ortofoto visible" vive en MapService.toggleLayerVisibility.
      ...ORTOFOTO_YEARS.map(year => capa(`ortofoto_${year}`, `${year}`)),
    ],
  },
  {
    id: 'ortoAereas',
    title: 'Fotográfias sin procesar',
    expanded: false,
    items: [
      // Capas directas (sin subsección), igual que el resto del panel.
      capa('fotos_sin_2018', 'Fotos sin Procesar - 2018'),
      capa('fotos_sin_2024', 'Fotos sin Procesar - 2024'),
    ],
  },
  {
    id: 'normativaUrbana',
    title: 'Normativa Urbana',
    expanded: false,
    items: [
      capa('etiq_zonificacion', 'Etiqueta Zonificación', { showInLegend: true }),
      capa('zonificacion', 'Zonificación', { showInLegend: true }),
      capa('amUrbHomogeneo', 'Ambito Urbano Homogéneo'),
    ],
  },
  {
    id: 'tusne',
    title: 'TUSNE',
    expanded: false,
    items: [capa('tusne', 'Levantamiento Topográfico', { showInLegend: true })],
  },
];

/**
 * Configuración centralizada para las secciones y capas del panel lateral.
 * Este array define la estructura completa del panel de capas, facilitando
 * su mantenimiento y modificación sin alterar la lógica del `MapService`.
 */
export const LAYER_PANEL_SECTIONS: Section[] = aplicarPoliticaAcceso(PANEL_BASE);
