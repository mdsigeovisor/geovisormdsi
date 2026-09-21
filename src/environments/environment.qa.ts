import { crearEnvironment } from './environment.model';

/**
 * Ambiente de QA / pruebas.
 * Se selecciona con `ng build -c qa` o `npm run build:qa` (fileReplacements
 * en angular.json sustituye environment.ts por este archivo).
 */
export const environment = crearEnvironment({
  production: false,
  ambiente: 'QA',
  portalUrl: 'https://test.munisanisidro.gob.pe'
});
