export const environment = {
  production: false,
  version: 'v. 1.0.0',
  ambiente: 'Desarrollo',

  // --- CONTADOR DE VISITAS ---
  // Fuente centralizada para que el contador sume visitas de TODOS los usuarios
  // (no solo del PC local). Base actual: CounterAPI.dev (servicio gratuito).
  // Para migrar a un ASP propio del municipio, solo se reemplaza apiBase por el
  // endpoint y se ajustan namespace/key (ver environment.prod.ts).
  visitCounter: {
    enabled: true,
    apiBase: 'https://api.counterapi.dev/v1',
    namespace: 'munisanisidro_geovisor_visitas',
    key: 'visitas'
  },

  // --- CONFIGURACIÓN DE GEOSERVER ---
  geoserver: {
    // Servidor MSI proporcionado
    serverUrl: 'http://192.168.40.58:8080/geoserver',
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
  ortofotoServerUrl: 'http://192.168.40.58:8082',

  // --- CONFIGURACIÓN DEL SERVIDOR DE DATOS CATASTRALES (DataGIS) ---
  // Centraliza las URLs de los servidores internos para no exponerlas
  // hardcodeadas en el código fuente de la aplicación.
  dataGis: {
    // Servidor principal de datos catastrales (fichas, fotos, planos, capas)
    serverUrl: 'http://192.168.41.160',
    // Servidor de levantamientos topográficos (planos TUSNE)
    tusneServerUrl: 'http://192.168.41.61',

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
    // --- Endpoints de fichas y fotografía (lote) ---
    get informacionUrl(): string { return `${this.webFilesUpperUrl}/LotePublico.asp`; },
    get informacionPrivadaUrl(): string { return `${this.webFilesUpperUrl}/informacion.asp`; },
    get lotePublicoUrl(): string { return `${this.webFilesUpperUrl}/LotePublico.asp`; },
    // --- Planos de levantamiento topográfico (TUSNE) ---
    get tusneUrlBase(): string {
      return `${this.tusneServerUrl}/DataGIS_WGS84/32_LEVANTAMIENTO_TOPOGRAFICO_(TUSNE)`;
    }
  }
};
