export const environment = {
  production: false,
  version: 'V. 1.0.0',
  ambiente: 'Desarrollo',

  // --- CONFIGURACIÓN DE GEOSERVER ---
  geoserver: {
    // Servidor MSI proporcionado
    serverUrl: 'http://192.168.40.58:8081/geoserver',
    serverImpresionLocal: 'http://172.16.16.67:8080/geoserver',
    // Aquí puedes centralizar parámetros comunes de OGC
    workspace: 'mdsibde', 
    formatWMS: 'image/png',
    srs: 'EPSG:32718', // Sistema de referencia UTM 18S detectado en el servicio
    transparent: true
  },

};
