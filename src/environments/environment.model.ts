/**
 * Modelo / fábrica del objeto `environment`.
 *
 * Cada archivo de entorno (environment.ts = Desarrollo, environment.qa.ts = QA,
 * environment.prod.ts = Producción) llama a esta fábrica con los valores que
 * corresponden. `angular.json` sustituye `environment.ts` por el archivo del
 * ambiente elegido mediante `fileReplacements` (configuraciones `qa` y
 * `production`; p. ej. `ng build -c qa`).
 */

/** Parámetros que cambian entre ambientes */
export interface ParametrosEnvironment {
  /** ¿Compilación de producción? (activa optimizaciones de Angular) */
  production: boolean;
  /** Etiqueta del ambiente (se muestra en la UI, si aplica) */
  ambiente: 'Desarrollo' | 'QA' | 'Producción';
  /** URL pública del portal municipal donde vive el geovisor y sus APIs */
  portalUrl: string;
  /** Servidores internos (por defecto, los de la red municipal) */
  geoserverUrl?: string;
  ortofotoServerUrl?: string;
  dataGisServerUrl?: string;
  tusneServerUrl?: string;
}

/** Objeto environment (mismo contrato que consumía la app) */
export type Environment = ReturnType<typeof crearEnvironment>;

export function crearEnvironment(cfg: ParametrosEnvironment) {
  const host = cfg.portalUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  return {
    production: cfg.production,
    version: 'v. 1.0.0',
    ambiente: cfg.ambiente,

    /** Host del portal municipal (sin protocolo), usado al comparar orígenes */
    portalHost: host,
    /** URL pública del portal municipal (sin barra final) */
    portalUrl: `https://${host}`,

    // --- API DEL GEOVISOR (WSGEOVISOR) ---
    // Prefijo base de los endpoints del API del Geovisor (p. ej. "listar-datos-lote",
    // "listar-via-numero"), cuya ruta real es /WSGEOVISOR/api/geovisor/<endpoint>.
    // En desarrollo lo resuelve el proxy (proxy.conf) y en QA/Prod el proxy inverso
    // Nginx (same-origin).
    geovisorApiUrl: '/WSGEOVISOR/api/geovisor',

    // --- API DE SEGURIDAD (WSGEOVISOR · módulo MSICAS) ---
    seguridadApiUrl: '/WSGEOVISOR/api/seguridad',
    // Código del sistema con el que el API identifica al Geovisor en la tabla de
    // sistemas del módulo de Seguridad. Se envía en cada inicio de sesión.
    codigoSistema: 'GEOVISOR',

    // --- ENCUESTA DE SALIDA ---
    // Se abre en una pestaña nueva cuando el usuario confirma el cierre de sesión
    // o sale del geovisor.
    encuestaSalidaUrl: 'https://forms.gle/zadpPzpAR6h8Ud2P7',

    // --- OBSERVATORIO URBANO ---
    // Enlace externo al Observatorio Urbano de la comuna (se abre en otra pestaña).
    // Vive en el mismo portal municipal del ambiente.
    observatorioUrl: `https://${host}/WebObservatorioUrbano/`,

    // --- CONFIGURACIÓN DE GEOSERVER ---
    geoserver: {
      // Servidor MSI proporcionado
      serverUrl: cfg.geoserverUrl ?? 'http://192.168.40.58:8081/geoserver',
      // La URL para el servicio de impresión es la misma que la de GeoServer
      get serverImpresionLocal(): string { return this.serverUrl; },
      // Workspace compartido para todas las capas y consultas OGC
      workspace: 'WEB_GIS',
      get workspacePrefix(): string {
        return `${this.workspace}:`;
      },
      get baseUrl(): string {
        return `${this.serverUrl}/${this.workspace}`;
      },
      get wmsUrl(): string {
        return `${this.baseUrl}/wms`;
      },
      get owsUrl(): string {
        return `${this.baseUrl}/ows`;
      },
      formatWMS: 'image/png',
      srs: 'EPSG:32718', // Sistema de referencia UTM 18S detectado en el servicio
      transparent: true
    },

    // --- CONFIGURACIÓN DEL SERVIDOR DE ORTOFOTOS ---
    ortofotoServerUrl: cfg.ortofotoServerUrl ?? 'http://192.168.40.58:8082',

    // --- CONFIGURACIÓN DEL SERVIDOR DE DATOS CATASTRALES (DataGIS) ---
    // Centraliza las URLs de los servidores internos para no exponerlas
    // hardcodeadas en el código fuente de la aplicación.
    dataGis: {
      // Servidor principal de datos catastrales (fichas, fotos, planos, capas)
      serverUrl: cfg.dataGisServerUrl ?? 'http://192.168.41.160',
      // Servidor de levantamientos topográficos (planos TUSNE)
      tusneServerUrl: cfg.tusneServerUrl ?? 'http://192.168.41.61',

      /** Host del servidor principal (sin protocolo), usado al comparar orígenes. */
      get serverHost(): string {
        return this.serverUrl.replace(/^https?:\/\//, '');
      },
      /** Raíz pública de los datos catastrales. */
      get baseUrl(): string {
        return `${this.serverUrl}/DataGIS_WGS84`;
      },
      /** Carpeta "WebFiles" (capas consultables). */
      get webFilesUrl(): string {
        return `${this.baseUrl}/WebFiles`;
      },
      /** Carpeta "WEBFILES" (fichas y fotografía). */
      get webFilesUpperUrl(): string {
        return `${this.baseUrl}/WEBFILES`;
      },
      // --- Endpoints ASP de las capas consultables por clic ---
      get fotoDrone2018Url(): string { return `${this.webFilesUrl}/2018Drone.asp`; },
      get fotoDrone2024Url(): string { return `${this.webFilesUrl}/2024Drone.asp`; },
      get ptoGeodesicoUrl(): string { return `${this.webFilesUrl}/PtoGeodesico.asp`; },
      get catArbolesUrl(): string { return `${this.webFilesUrl}/Cat_Arboles_2014.asp`; },
      get fichaAccCruceUrl(): string { return `${this.webFilesUrl}/Ficha_Acc_Cruce.asp`; },
      get fichaAccManzaUrl(): string { return `${this.webFilesUrl}/Ficha_Acc_Manza.asp`; },
      get bancas2016Url(): string { return `${this.webFilesUrl}/2016_COMPONENTE2.asp`; },
      get hidrante2016Url(): string { return `${this.webFilesUrl}/2016H01.asp`; },
      get monumentos2021Url(): string { return `${this.webFilesUrl}/2021_COMPONENTES.asp`; },
      get esculturas2016Url(): string { return `${this.webFilesUrl}/2016_COMPONENTE3.asp`; },
      get panelesPublicitarios2018Url(): string { return `${this.webFilesUrl}/2018Paneles01.asp`; },
      // --- Endpoints de fichas y fotografía (lote) ---
      get informacionUrl(): string { return `${this.webFilesUpperUrl}/LotePublico.asp`; },
      get informacionPrivadaUrl(): string { return `${this.webFilesUpperUrl}/informacion.asp`; },
      get lotePublicoUrl(): string { return `${this.webFilesUpperUrl}/LotePublico.asp`; },
      // --- Planos de levantamiento topográfico (TUSNE) ---
      get tusneUrlBase(): string {
        return `${this.tusneServerUrl}/DataGIS_WGS84/32_LEVANTAMIENTO_TOPOGRAFICO_(TUSNE)`;
      },
      // --- Fotos de Subsectores Vecinales 1-3 y 2-1 (2025) ---
      get subsectoresVecinalesFotosUrl(): string {
        // Las fotos están en el servidor DataGIS (192.168.41.160), NO en el servidor TUSNE (192.168.41.61).
        return `${this.serverUrl}/DataGIS_WGS84/30_EQUIPAMIENTO%20URBANO%20SUBSECTOR%20VECINAL%202-1%20y%203-1%20(2025)/Fotos`;
      },
      // --- Fotografías de Señaletica San Isidro (2026) ---
      get senaleticaFotosUrl(): string {
        // Las fotos están en el servidor de levantamientos (192.168.41.61).
        // Base 31_SENALETICA: el campo "Foto" de la capa trae la ruta relativa (p. ej. "DCIM/JPEG_xxx.jpg").
        return `${this.tusneServerUrl}/DataGIS_WGS84/31_SENALETICA`;
      },
      // --- Fichas PDF de Áreas Verdes de San Isidro ---
      get areasVerdesUrlBase(): string {
        return `${this.tusneServerUrl}/DataGIS_WGS84/19_AREAS%20VERDES%20DE%20SAN%20ISIDRO`;
      }
    }
  };
}
