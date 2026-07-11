export const environment = {
  production: false,
  version: 'v. 1.0.0',
  ambiente: 'Desarrollo',

  // --- CONFIGURACIÓN DE GEOSERVER ---
  geoserver: {
    // Servidor MSI proporcionado
    serverUrl: 'http://192.168.40.58:8081/geoserver',
    serverUrlViejo: 'http://192.168.41.147:8080/geoserver',
    serverImpresionLocal: 'http://172.16.16.67:8080/geoserver',
    // Workspace compartido para todas las capas y consultas OGC

    workspace: 'SIDES_GIS',
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

  // --- CONFIGURACIÓN DE GEOSERVER DE PRUEBA (ORTOFOTOGRAFÍAS) ---
  geoserverOrtofotografias: {
    serverUrl: 'https://192.168.41.147:8080/geoserver',
    workspace: 'ide_ortofotografias',
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
    srs: 'EPSG:32718',
    transparent: true
  }
};
