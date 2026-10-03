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
  // GeoServer de PRODUCCIÓN (público, servido por el dominio del municipio).
  // Desarrollo y QA usan el servidor interno por defecto
  // ('http://192.168.40.58:8081/geoserver', definido en environment.model.ts),
  // que solo es accesible desde la red municipal; los usuarios de producción
  // llegan por esta URL pública, así que el build de producción NO debe llevar
  // la IP interna.
  geoserverUrl: 'https://geomapas.munisanisidro.gob.pe/geoserver'
});
