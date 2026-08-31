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
  'infraestructuraUrbana',
  'tematica'
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
      subseccion('tusne', 'TUSNE', [
        capa('tusne', 'Levantamiento Topográfico', { visible: false, showInLegend: true }),
      ]),
      subseccion('sectorizacion', 'SECTORIZACION', [
        capa('sec_catastrales', 'Sectores Catastrales', { visible: false, showInLegend: true }),
        capa('sec_vecinal', 'Sectores Vecinales', { visible: false, showInLegend: false }),
        capa('hab_urbana', 'Urbanizaciones', { visible: false, showInLegend: false }),
        capa('sec_subvecinal', 'Sub Sectores - Junta Vecinales', { visible: false, showInLegend: false }),
      ]),
      subseccion('lotizacion', 'LOTIZACIÓN', [
        capa('lote_urbano', 'Lote Urbano', { visible: false, showInLegend: false }),
        capa('etiquetas_catastrales', 'Código Catastral', { visible: false, showInLegend: false }),
        capa('denominacion_predio', 'Denominación del Predio (DESARROLLO)', { visible: false, showInLegend: false }),
      ]),
      subseccion('pto_geodesico', 'PUNTOS GEODESICOS', [
        capa('puntos_geodesicos', 'Puntos Geodésicos', { visible: false, showInLegend: true })
      ]),
      subseccion('vias', 'VIAS', [
        capa('vias', 'Nomenclatura de Vías', { visible: true, showInLegend: false }),
        capa('seccion_vial', 'Sección vias (Inf. referewncial de campo)', { visible: false, showInLegend: false }),
      ]),
      subseccion('num_municipal', 'NÚMERACION MUNICIPAL', [
        capa('', 'Numeración Municipal Oficial (Desarrollo)', { visible: false, showInLegend: false }),
        capa('num_municipal_2024', 'Numeración de campo 2024', { visible: false, showInLegend: false }),
        capa('num_municipal_2022', 'Numeración de campo 2022', { visible: false, showInLegend: false }),
      ]),
      subseccion('arb_urbano', 'ARBOLADO URBANO', [
        capa('arbolado_urbano_2024', 'Arboles 2024', { visible: false, showInLegend: true }),
        capa('arbolado_urbano_2015', 'Arboles 2015', { visible: false, showInLegend: true }),
        capa('cactus_yucca_2015', 'Cactus - Yucca 2015', { visible: false, showInLegend: true }),
        capa('', 'Area verde San Isidro (Desarrollo)', { visible: false, showInLegend: true }),
      ]),
      subseccion('moviliario_urbano', 'MOVILIARIO URBANO', [
        capa('', 'Subsectores vecinales 1-3 y 2-1 (2025)', { visible: false, showInLegend: true }),
        capa('', 'Peticiones de gracia 2024', { visible: false, showInLegend: true }),
        capa('', 'Comercio en vía pública 2022', { visible: false, showInLegend: true }),
        capa('', 'Comercio en vía pública 2021', { visible: false, showInLegend: true }),
        capa('', 'Comercio en vía pública 2017', { visible: false, showInLegend: true }),
        capa('', 'Comercio en vía pública 2015', { visible: false, showInLegend: true }),
        capa('', 'Comercio en vía pública 2012', { visible: false, showInLegend: true }),
        capa('', 'Estacionamientos de bicicletas 2016', { visible: false, showInLegend: true }),
        capa('', 'Juegos para niños 2016', { visible: false, showInLegend: true }),
        capa('', 'Minigimnasios 2016', { visible: false, showInLegend: true }),
        capa('', 'Postes de Iluminación Ornamentales 2016', { visible: false, showInLegend: true }),
        capa('', 'Estacionamientos de motos', { visible: false, showInLegend: true }),
        capa('', 'Bancas 2016', { visible: false, showInLegend: true }),
        capa('', 'Bebederos 2016', { visible: false, showInLegend: true }),
        capa('', 'Papeleras 2016', { visible: false, showInLegend: true }),
        capa('', 'Parklets 2017', { visible: false, showInLegend: true }),
        capa('', 'Parklets 2016', { visible: false, showInLegend: true }),
        capa('', 'Piletas 2016', { visible: false, showInLegend: true }),
        capa('', 'Intersección Semaforizada (2012)', { visible: false, showInLegend: true }),
        capa('', 'Paneles Publicitarios 2018', { visible: false, showInLegend: true }),
        capa('', 'Monumentos, Bustos y Toten 2021', { visible: false, showInLegend: true }),
        capa('', 'Monumentos o esculturas 2016', { visible: false, showInLegend: true }),
      ]),
      subseccion('base_grafica', 'BASE GRÁFICA', [
        capa('num_cuadra', 'Número de Cuadra', { visible: true, showInLegend: false }),
        capa('construcciones', 'Construcciones', { visible: true, showInLegend: true }),
        capa('lote', 'Lote', { visible: true, showInLegend: true }),
        capa('manzana', 'Manzana', { visible: true, showInLegend: true }),
        capa('veredas', 'Veredas', { visible: true, showInLegend: false }),
        capa('arearecreativa', 'Área Recreativa', { visible: true, showInLegend: false }),
      ]),
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
      capa('etiq_zonificacion', 'Etiqueta', { visible: false, showInLegend: false }),
      capa('zonificacion', 'Zonificación usos de suelo', { visible: false, showInLegend: false }),
      capa('', 'Alturas Maximas de Edificacion (Desarrollo)', { visible: false, showInLegend: false }),
      capa('', 'Sectores de Planeamiento Urbano (Desarrollo)', { visible: false, showInLegend: false }),
      capa('', 'Ambitos Urbanos Homogéneos (Desarrollo)', { visible: false, showInLegend: false }),
      capa('', 'Ambitos para promover la sostenibilidad de las zonas residenciales (Desarrollo)', { visible: false, showInLegend: false }),
      capa('', 'Ambito de Normas Excepcionales para Zonas con caracteristicas Urbanas Especiales (Desarrollo)', { visible: false, showInLegend: false }),
      capa('', 'Zonas de Sostenibilidad en locales destinados a estacionamientos de vehiculos (Desarrollo)', { visible: false, showInLegend: false }),
      capa('', 'Retiro Frontales Normativos (Desarrollo)', { visible: false, showInLegend: false }),
      capa('', 'Superficies limitadoras de Obstaculos (Desarrollo)', { visible: false, showInLegend: false }),
      capa('', 'Modulos Comercio en via pública - Puntos aprobados (Desarrollo)', { visible: false, showInLegend: false }),
      subseccion('zre_bosque_olivar', 'ZRE BOSQUE EL OLIVAR', [
        capa('', 'Ambito de la ZRE Bosque El Olivar (Desarrollo)', { visible: false, showInLegend: false }),
        capa('', 'Sectores de la Zona Monumental (Desarrollo)', { visible: false, showInLegend: false }),
        capa('', 'Monumento El Olivar (Desarrollo)', { visible: false, showInLegend: false }),
        capa('', 'Zonificacion de Usos (Desarrollo)', { visible: false, showInLegend: false }),
        capa('', 'Alturas Maximas de Edificación (Desarrollo)', { visible: false, showInLegend: false }),
        capa('', 'Retiro Normativo (Desarrollo)', { visible: false, showInLegend: false }),
      ], false, { requiresAuth: false }),
      subseccion('zre_camino_real', 'ZRE CAMINO REAL', [
        capa('', 'Ambito de la ZRE Camino Real (Desarrollo)', { visible: false, showInLegend: false }),
        capa('', 'Sectores de la Zona Monumental (Desarrollo)', { visible: false, showInLegend: false }),
        capa('', 'Monumento Camino Real (Desarrollo)', { visible: false, showInLegend: false }),
        capa('', 'Zonificación de Usos (Desarrollo)', { visible: false, showInLegend: false }),
        capa('', 'Alturas Maximas de Edificación (Desarrollo)', { visible: false, showInLegend: false }),
        capa('', 'Retiro Normativo (Desarrollo)', { visible: false, showInLegend: false }),
      ], false, { requiresAuth: false }),
      subseccion('zre_costa_verde', 'ZRE COSTA VERDE', [
        capa('', 'Ambito de la Costa Verde (Desarrollo)', { visible: false, showInLegend: false }),
        capa('', 'Zonificación de Usos (Desarrollo)', { visible: false, showInLegend: false }),
        capa('', 'Area Intangible de la Costa Verde (Desarrollo)', { visible: false, showInLegend: false }),
        capa('', 'Linea de mas alta marea (Desarrollo)', { visible: false, showInLegend: false }),
        capa('', 'Area de Intangibilidad (Desarrollo)', { visible: false, showInLegend: false }),
      ], false, { requiresAuth: false })],
  },
  {
    id: 'infraestructuraUrbana',
    title: 'INFRAESTRUCTURA URBANA',
    expanded: false,
    items: [
      subseccion('cruces', 'Cruces', [
        capa('cruces_accesibilidad_1', 'Cruce Sector Vecinal 01', { visible: false, showInLegend: true }),
        capa('cruces_accesibilidad_2', 'Cruce Sector Vecinal 02', { visible: false, showInLegend: true }),
        capa('cruces_accesibilidad_3', 'Cruce Sector Vecinal 03', { visible: false, showInLegend: true }),
        capa('cruces_accesibilidad_4', 'Cruce Sector Vecinal 04', { visible: false, showInLegend: true }),
        capa('cruces_accesibilidad_5', 'Cruce Sector Vecinal 05', { visible: false, showInLegend: true }),
      ], false, { requiresAuth: false }),
      subseccion('manzanas', 'Manzanas', [
        capa('manzanas_cruces_accesibilidad_1', 'Manzana Sector Vecinal 01', { visible: false, showInLegend: true }),
        capa('manzanas_cruces_accesibilidad_2', 'Manzana Sector Vecinal 02', { visible: false, showInLegend: true }),
        capa('manzanas_cruces_accesibilidad_3', 'Manzana Sector Vecinal 03', { visible: false, showInLegend: true }),
        capa('manzanas_cruces_accesibilidad_4', 'Manzana Sector Vecinal 04', { visible: false, showInLegend: true }),
        capa('manzanas_cruces_accesibilidad_5', 'Manzana Sector Vecinal 05', { visible: false, showInLegend: true }),
      ], false, { requiresAuth: false }),
      subseccion('agua_alcantarillado', 'Agua y Alcantarillado', [
        capa('', 'Pozos de SEDAPAL (Desarrollo)', { visible: false, showInLegend: true }),
        capa('', 'Red de agua potable SEDAPAL (Desarrollo)', { visible: false, showInLegend: true }),
        capa('', 'Red de agua alcantarillado SEDAPAL (Desarrollo)', { visible: false, showInLegend: true }),
        capa('', 'Hidrante 2016 (Desarrollo)', { visible: false, showInLegend: true }),
        capa('', 'Hidrante 2024 (Desarrollo)', { visible: false, showInLegend: true }),
      ], false, { requiresAuth: false }),
      subseccion('energia_electrica', 'Energia Electrica', [
        capa('', 'Sub Estaciones Electricas 2017 (Desarrollo)', { visible: false, showInLegend: true }),
        capa('', 'Red de energia electrica (Desarrollo)', { visible: false, showInLegend: true }),
      ], false, { requiresAuth: false }),
      subseccion('telefonia_comunicaciones', 'Telefonica y Comunicaciones', [
        capa('', 'Antena de telefonia (Desarrollo)', { visible: false, showInLegend: true }),
        capa('', 'Red de telefonia (Desarrollo)', { visible: false, showInLegend: true }),
        capa('', 'Fibra optica (Desarrollo)', { visible: false, showInLegend: true }),
      ], false, { requiresAuth: false }),
      subseccion('gas_natural', 'Gas Natural', [
        capa('', 'Red de gas natural CALIDDA (Desarrollo)', { visible: false, showInLegend: true }),
      ], false, { requiresAuth: false }),
      subseccion('vial', 'Vial', [
        capa('', 'Señalitica San Isidro 2026 (Desarrollo)', { visible: false, showInLegend: true }),
        capa('', 'Intersecciones semaforizadas (Desarrollo)', { visible: false, showInLegend: true }),
        capa('', 'Sistema de estacionamiento (Desarrollo)', { visible: false, showInLegend: true }),
        capa('', 'Señalización Vial 2016 (Desarrollo)', { visible: false, showInLegend: true }),
        capa('', 'Reductores de velocidad 2012 (Desarrollo)', { visible: false, showInLegend: true }),
        capa('', 'Superficies Lim. de Obstaculos (Desarrollo)', { visible: false, showInLegend: true }),
      ], false, { requiresAuth: false }),
    ],
  },
  {
    id: 'tematica',
    title: 'INFORMACIÓN TEMÁTICA',
    expanded: false,
    items: [
      subseccion('parametros', 'Tramites atendidos', [
        capa('tem_parametros', 'Parámetros Urbanisticos y Edificatorios', { visible: false }),
        capa('amUrbHomogeneo', 'ORDENAR', { visible: false }),

      ], false, { requiresAuth: false }),
    ],
  },
];
/**
 * Configuración centralizada para las secciones y capas del panel lateral.
 * Este array define la estructura completa del panel de capas, facilitando
 * su mantenimiento y modificación sin alterar la lógica del `MapService`.
 */
export const LAYER_PANEL_SECTIONS: Section[] = aplicarPoliticaAcceso(PANEL_BASE);
