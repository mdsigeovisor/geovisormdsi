import { crearEnvironment } from './environment.model';

/**
 * Ambiente de DESARROLLO (máquina del programador).
 * El proxy de desarrollo (proxy.conf.json) resuelve los backends.
 */
export const environment = crearEnvironment({
  production: false,
  ambiente: 'Desarrollo',
  portalUrl: 'https://test.munisanisidro.gob.pe'
});
