import { LayerItem, Section, SubSection } from './geoLayers';
import { ORTOFOTO_YEARS } from './ortofotos';

/* ------------------------------------------------------------------------- */
/*  Fábricas declarativas                                                     */
/* ------------------------------------------------------------------------- */

/** Propiedades opcionales al declarar una capa (lo omitido toma el valor por defecto). */
type CapaOpciones = Partial<Pick<LayerItem, 'visible' | 'opacity' | 'showInLegend' | 'disabled' | 'requiresAuth'>>;

/**
 * Crea una capa del panel aplicando los valores por defecto
 * (`visible: false`, `opacity: 1`, `showInLegend: false`), de modo que cada
 * entrada solo declara aquello que se desvía del estándar.
 *
 * Las capas sin `id` (sin servicio WMS asociado, típicamente marcadas como
 * "(Desarrollo)") se declaran automáticamente como `disabled`, mostrándose
 * bloqueadas en el panel.
 */
const capa = (id: string, label: string, opciones: CapaOpciones = {}): LayerItem => ({
  type: 'layer',
  id,
  label,
  visible: false,
  opacity: 1,
  showInLegend: false,
  disabled: id === '' ? true : false,
  ...opciones,
});

/** Crea una subsección plegable con sus capas. */
const subseccion = (
  id: string,
  title: string,
  layers: LayerItem[],
  expanded = false,
  opciones: Partial<Pick<SubSection, 'requiresAuth' | 'subtitle'>> = {}
): SubSection => ({
  type: 'subsection',
  id,
  title,
  expanded,
  layers,
  ...opciones,
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
  'imaAereas',
  'normativaUrbana',
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
    title: 'INFORMACION CATASTRAL',
    expanded: false,
    items: [
      /*Capas de la base grafica*/
      subseccion('base_grafica', 'BASE GRÁFICA', [
        capa('num_cuadra', 'Cuadra', { visible: true, showInLegend: false }),
        capa('construcciones', 'Construcciones', { visible: true, showInLegend: false }),
        capa('lote', 'Lote', { visible: true, showInLegend: false }),
        capa('manzana', 'Manzana', { visible: true, showInLegend: false }),
        capa('veredas', 'Veredas', { visible: true, showInLegend: false }),
        capa('arearecreativa', 'Área Recreativa', { visible: true, showInLegend: false }),
      ]),
      /*Capas de Sectores*/
      subseccion('sectorizacion', 'CAPAS SECTORIZACION', [
        capa('sec_catastrales', 'Sectores Catastrales', { visible: false, showInLegend: true }),
        capa('sec_vecinal', 'Sectores Vecinales', { visible: false, showInLegend: false }),
        capa('hab_urbana', 'Urbanizaciones', { visible: false, showInLegend: false }),
        capa('sec_subvecinal', 'Sub Sectores - Junta Vecinales', { visible: false, showInLegend: false }),
      ]),
      /*Etiquetas Sectorización*/
      subseccion('lotizacion', 'LOTIZACIÓN', [
        capa('lote_urbano', 'Lote Urbano', { visible: false, showInLegend: false }),
        capa('etiquetas_catastrales', 'Código Catastral', { visible: false, showInLegend: false }),
        capa('denominacion_predio', 'Denominación del Predio (DESARROLLO)', { visible: false, showInLegend: false, disabled: true }),
      ]),
      /*Puntos Geodesicos*/
      subseccion('pto_geodesico', 'PUNTOS GEODESICOS', [
        capa('puntos_geodesicos', 'Puntos Geodésicos', { visible: false, showInLegend: true })
      ], false, { requiresAuth: true }),
      /*Vias*/
      subseccion('vias', 'VIAS', [
        capa('vias', 'Nomenclatura de Vías', { visible: true, showInLegend: false }),
        capa('seccion_vial', 'Sección vias (Inf. referencial de campo)', { visible: false, showInLegend: false }),
      ]),
      /*Numeracion de campo*/
      subseccion('num_municipal', 'NÚMERACION DE CAMPO', [
        capa('num_municipal_2024', 'Numeración de campo 2024', { visible: false, showInLegend: false }),
        capa('num_municipal_2022', 'Numeración de campo 2022', { visible: false, showInLegend: false }),
        capa('', 'Numeración Municipal Oficial (Desarrollo)', { visible: false, showInLegend: false }),
        capa('puertas2024', 'Puertas 2024', { visible: false, showInLegend: true }),
      ]),
      /*Arbolado Urbano*/
      subseccion('arb_urbano', 'ARBOLADO URBANO', [
        capa('arbolado_urbano_2024', 'Arboles 2024', { visible: false, showInLegend: true }),
        capa('arbolado_urbano_2015', 'Arboles 2015', { visible: false, showInLegend: true }),
        capa('cactus_yucca_2015', 'Cactus - Yucca 2015', { visible: false, showInLegend: true }),
        capa('nom_area_verde', 'Area verde San Isidro', { visible: false, showInLegend: true }),
      ]),
      /*Mobiliario Urbano*/
      subseccion('moviliario_urbano', 'MOBILIARIO URBANO', [
        // capa('', 'Subsectores vecinales 1-3 y 2-1 (2025)', { visible: false, showInLegend: true }),
        // capa('', 'Peticiones de gracia 2024', { visible: false, showInLegend: true }),
        // capa('', 'Comercio en vía pública 2022', { visible: false, showInLegend: true }),
        // capa('', 'Comercio en vía pública 2021', { visible: false, showInLegend: true }),
        // capa('', 'Comercio en vía pública 2017', { visible: false, showInLegend: true }),
        // capa('', 'Comercio en vía pública 2015', { visible: false, showInLegend: true }),
        // capa('', 'Comercio en vía pública 2012', { visible: false, showInLegend: true }),
        capa('mu_estac_bicis_2016', 'Estacionamientos de bicicletas 2016', { visible: false, showInLegend: true }),
        // capa('', 'Juegos para niños 2016', { visible: false, showInLegend: true }),
        // capa('', 'Minigimnasios 2016', { visible: false, showInLegend: true }),
        // capa('', 'Postes de Iluminación Ornamentales 2016', { visible: false, showInLegend: true }),
        // capa('', 'Estacionamientos de motos', { visible: false, showInLegend: true }),
        capa('mu_bancas_2016', 'Bancas 2016', { visible: false, showInLegend: true }),
        // capa('', 'Bebederos 2016', { visible: false, showInLegend: true }),
        // capa('', 'Papeleras 2016', { visible: false, showInLegend: true }),
        // capa('', 'Parklets 2017', { visible: false, showInLegend: true }),
        // capa('', 'Parklets 2016', { visible: false, showInLegend: true }),
        // capa('', 'Piletas 2016', { visible: false, showInLegend: true }),
        // capa('', 'Intersección Semaforizada (2012)', { visible: false, showInLegend: true }),
        // capa('', 'Paneles Publicitarios 2018', { visible: false, showInLegend: true }),
        // capa('', 'Monumentos, Bustos y Toten 2021', { visible: false, showInLegend: true }),
        // capa('', 'Monumentos o esculturas 2016', { visible: false, showInLegend: true }),
      ], false, { requiresAuth: true }),
    ],
  },
  {
    id: 'imaAereas',
    title: 'IMÁGENES AEREAS',
    expanded: false,
    items: [
      // Capas generadas dinámicamente a partir de la configuración de años.
      // La regla "solo una ortofoto visible" vive en MapService.toggleLayerVisibility.
      subseccion('ortofotos_historicas', 'Ortofotos Históricas', [
        ...ORTOFOTO_YEARS.map(year => capa(`ortofoto_${year}`, `${year}`)),
      ], false, { requiresAuth: false }),
      subseccion('fotos_sin_procesar', 'Fotos sin Procesar', [
        capa('fotos_sin_2018', 'Fotos sin Procesar - 2018', { visible: false, showInLegend: false }),
        capa('fotos_sin_2024', 'Fotos sin Procesar - 2024', { visible: false, showInLegend: false }),
      ], false, { requiresAuth: true }),
    ],
  },
  {
    id: 'normativaUrbana',
    title: 'NORMATIVA URBANA',
    expanded: false,
    items: [
      subseccion('normaUrbana', 'NORMATIVA URBANA', [
        capa('etiq_zonificacion', 'Etiqueta Zonificación', { visible: false, showInLegend: false }),
        capa('zonificacion', 'Zonificación usos del suelo', { visible: false, showInLegend: true }),
        capa('amUrbHomogeneo', 'Ambitos Urbanos Homogéneos', { visible: false, showInLegend: false, requiresAuth: true }),
        capa('norm_alt_edific', 'Alturas Maximas de Edificacion', { visible: false, showInLegend: true }),
        capa('', 'Ambitos para promover la sostenibilidad de las zonas residenciales (Desarrollo)', { visible: false, showInLegend: false, requiresAuth: true }),
        capa('', 'Modulos Comercio en via pública - Puntos aprobados (Desarrollo)', { visible: false, showInLegend: false, requiresAuth: true }),
      ]),
      subseccion('sistema_vial', 'SISTEMA VIAL', [
        capa('', 'SISTEMA VIAL METROPOLITANO (ORD. N 341-MML)', { visible: false, showInLegend: true }),
        capa('', 'Seccion de vias Normativas Locales', { visible: false, showInLegend: true, requiresAuth: true }),
        capa('', 'Sección de Vias Normativas Metropolitanas', { visible: false, showInLegend: true }),
      ]),
    ]
  },
  {
    id: 'infraestructuraUrbana',
    title: 'INFRAESTRUCTURA URBANA',
    expanded: false,
    items: [
      subseccion('cruces', 'NIVEL DE ACCESIBILIDAD – CRUCES', [
        capa('cruces_accesibilidad_1', 'Sector Vecinal 01', { visible: false, showInLegend: true }),
        capa('cruces_accesibilidad_2', 'Sector Vecinal 02', { visible: false, showInLegend: true }),
        capa('cruces_accesibilidad_3', 'Sector Vecinal 03', { visible: false, showInLegend: true }),
        capa('cruces_accesibilidad_4', 'Sector Vecinal 04', { visible: false, showInLegend: true }),
        capa('cruces_accesibilidad_5', 'Sector Vecinal 05', { visible: false, showInLegend: true }),
      ]),
      subseccion('manzanas', 'NIVEL DE ACCESIBILIDAD – MANZANAS', [
        capa('manzanas_cruces_accesibilidad_1', 'Sector Vecinal 01', { visible: false, showInLegend: true }),
        capa('manzanas_cruces_accesibilidad_2', 'Sector Vecinal 02', { visible: false, showInLegend: true }),
        capa('manzanas_cruces_accesibilidad_3', 'Sector Vecinal 03', { visible: false, showInLegend: true }),
        capa('manzanas_cruces_accesibilidad_4', 'Sector Vecinal 04', { visible: false, showInLegend: true }),
        capa('manzanas_cruces_accesibilidad_5', 'Sector Vecinal 05', { visible: false, showInLegend: true }),
      ]),
      subseccion('agua_alcantarillado', 'AGUA Y ALCANTARILLADO', [
        capa('', 'Hidrante 2024 (Desarrollo)', { visible: false, showInLegend: true }),
        capa('', 'Hidrante 2016 (Desarrollo)', { visible: false, showInLegend: true }),
        capa('', 'Señaletica San Isidro 2026', { visible: false, showInLegend: true }),
        capa('', 'Intersecciones Semaforizadas', { visible: false, showInLegend: true }),
      ]),
    ],
  },
  {
    id: 'info_tematica',
    title: 'INFORMACIÓN TEMÁTICA',
    expanded: false,
    items: [
      subseccion('zonaLimites', 'ZONA DE LIMITES', [
        capa('', 'Emisión de Cuponeras 2026', { visible: false, showInLegend: true }),
        capa('', 'Emisión de Cuponeras 2025', { visible: false, showInLegend: true }),
        capa('', 'Procesos Judiciales 2025', { visible: false, showInLegend: true }),
        capa('', 'Predios Recuperados', { visible: false, showInLegend: true }),
        capa('', 'Informe Técnico Favorable (ITF) 2026', { visible: false, showInLegend: true }),
      ]),
      subseccion('vivVis', 'VIVIENDA DE INTERES SOCIAL (VIS)', [
        capa('', 'VIS 2026 Proyectos-Anteproyectos', { visible: false, showInLegend: true }),
        capa('', 'VIS 2025 con Proceso Judicial', { visible: false, showInLegend: true }),
      ]),
      subseccion('salud', 'SALUD', [
        capa('', 'Centros de Salud 2024 (RENIPRESS)', { visible: false, showInLegend: true }),
      ]),
      subseccion('educacion', 'EDUCACION', [
        capa('', 'Educación superior 2024 (ESCALE-MINEDU)', { visible: false, showInLegend: true }),
        capa('', 'Instituciones Educativas (ESCALE-MINEDU)', { visible: false, showInLegend: true }),
      ]),
      subseccion('edifiExistentes', 'EDIFICACIONES EXISTENTES', [
        capa('', 'Usos predominantes (Año 2021)', { visible: false, showInLegend: true }),
        capa('', 'Usos Predominantes (Histórico)', { visible: false, showInLegend: true }),
        capa('', 'Alturas de edificación existente (Histórico)', { visible: false, showInLegend: true }),
        capa('', 'Año de Construcción', { visible: false, showInLegend: true }),
        capa('', 'Obras privadas en Ejecución', { visible: false, showInLegend: true }),
        capa('tem_view_lote_rrpp', 'Inmuebles con Informacion Registral', { visible: false, showInLegend: true }),
        capa('tem_view_lote_concarga', 'Cargas', { visible: false, showInLegend: true }),
        capa('tem_view_lote_ley27157a', 'Declatatoria de Fabrica - ley 27157 A', { visible: false, showInLegend: true }),
        capa('tem_view_lote_ley27157b', 'Declatatoria de Fabrica - ley 27157 B', { visible: false, showInLegend: true }),
      ]),
      subseccion('comInternacional', 'COMUNIDAD INTERNACIONAL', [
        capa('', 'Embajadas', { visible: false, showInLegend: true }),
      ]),
      subseccion('localesMunicipales', 'LOCALES MUNICIPALES', [
        capa('', 'Sedes administrativas', { visible: false, showInLegend: true }),
        capa('', 'Centros de Encuentro Vecinal', { visible: false, showInLegend: true }),
      ]),
      subseccion('segCiudadana', 'SEGURIDAD CIUDADANA', [
        capa('', 'Seguridad 2023', { visible: false, showInLegend: true }),
        capa('', 'Centros de Seguridad', { visible: false, showInLegend: true }),
      ]),
      subseccion('grd', 'GESTION DE RIESGOS DE DESASTRE (GRD)', [
        capa('', 'Almacenes', { visible: false, showInLegend: true }),
      ]),
    ],
  },
  {
    id: 'capas_tematica',
    title: 'CAPAS TEMÁTICO',
    expanded: false,
    items: [
      subseccion('', 'TRAMITES ATENDIDOS', [
        capa('tem_parametros', 'Parametros urbanisticos y Edificatorios', { visible: false, showInLegend: true }),
        capa('tem_li_edifica', 'Licencia de edificación', { visible: false, showInLegend: true }),
        capa('tem_conforobra', 'Conformidad de Obra', { visible: false, showInLegend: true }),
        capa('tem_li_funcion', 'Licencia de funcionamiento', { visible: false, showInLegend: true }),
        capa('tem_li_anuncio', 'Licencia de Anuncio', { visible: false, showInLegend: true }),
        capa('tem_view_lote_cnmu', 'Certificados de Numeración municipal', { visible: false, showInLegend: true }),
        capa('tem_view_lote8', 'Visación de Plano', { visible: false, showInLegend: true }),
        capa('tem_view_lote6', 'Planos Catastrales', { visible: false, showInLegend: true }),
        capa('', 'Verificación Catastral a Solicitud', { visible: false, showInLegend: true }),
        capa('', 'Cargas registrales', { visible: false, showInLegend: true }),
        capa('tem_view_lote_rrpp', 'Informacion registral', { visible: false, showInLegend: true }),
      ])
    ]
  },
  {
    id: 'tusne',
    title: 'TUSNE',
    expanded: false,
    items: [
      subseccion('tusne', 'TUSNE', [
        capa('tusne', 'Levantamiento Topográfico', { visible: false, showInLegend: true }),
      ])
    ]
  }
];
/**
 * Configuración centralizada para las secciones y capas del panel lateral.
 * Este array define la estructura completa del panel de capas, facilitando
 * su mantenimiento y modificación sin alterar la lógica del `MapService`.
 */
export const LAYER_PANEL_SECTIONS: Section[] = aplicarPoliticaAcceso(PANEL_BASE);
