import { crearEnvironment } from './environment.model';

/**
 * Ambiente de PRODUCCIÓN.
 * Se selecciona con `ng build -c production` o `npm run build:prod`
 * (fileReplacements en angular.json sustituye environment.ts por este archivo).
 */
export const environment = crearEnvironment({
  production: true,
  ambiente: 'Producción',
  portalUrl: 'https://munisanisidro.gob.pe',
  // GeoServer unificado para todos los ambientes (puerto 8081).
  geoserverUrl: 'http://192.168.40.58:8081/geoserver'
});
