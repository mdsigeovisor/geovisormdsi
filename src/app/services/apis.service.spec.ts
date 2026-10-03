import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom, Observable } from 'rxjs';
import { vi } from 'vitest';

import { environment } from '../../environments/environment';
import { ApisService, GEOVISOR_ENDPOINTS } from './apis.service';

/**
 * Pruebas del punto único de acceso al API del Geovisor.
 *
 * Se fija el contrato real del API (`/WSGEOVISOR/api/geovisor/<endpoint>`):
 *  - cada búsqueda viaja como GET con su parámetro nombrado (`txtcuc`,
 *    `txtcodpredial`, `pvcCODVIA`, ...) y con la respuesta envuelta en `{ data }`;
 *  - las búsquedas con reintentos recorren la ruta relativa -> host de pruebas ->
 *    host de producción, y solo pasan al siguiente cuando el anterior falla;
 *  - si los tres fallan, el error se propaga para que la UI distinga
 *    "sin resultados" (array vacío) de "sin conexión" (error);
 *  - el hover (`listarDatosLote`) es la excepción: no reintenta y resuelve
 *    `null` ante cualquier fallo, porque un hover no debe romper el mapa.
 */

/** Hosts de respaldo, en el mismo orden que usa el servicio. */
const HOST_TEST = 'https://test.munisanisidro.gob.pe';
const HOST_PROD = 'https://www.munisanisidro.gob.pe';

/** URL relativa (proxy) de un endpoint del catálogo. */
const relativa = (endpoint: string) => `${environment.geovisorApiUrl}/${endpoint}`;

/** Un registro cualquiera, para comprobar el desempaquetado de `data`. */
const REGISTRO = { codlote: 'LOTE-1', txttitular: 'PEREZ, JUAN' };

/**
 * Matcher por URL: `HttpTestingController` compara la URL completa,params
 * incluidos, así que un `expectOne('/ruta')` no encuentra una petición que lleva
 * query string. Este matcher compara solo el camino, y los parámetros se
 * validan aparte con `peticion.request.params`.
 */
const porUrl = (url: string) => (req: { url: string }) => req.url === url;

describe('ApisService', () => {
  let service: ApisService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    // Sin interceptores: el de auditoría dispara peticiones propias que
    // ensuciarían la cola del `HttpTestingController` de cada prueba.
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ApisService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    try {
      httpMock.verify();
    } finally {
      TestBed.resetTestingModule();
    }
  });

  /** Silencia los `console.warn`/`console.error` del propio servicio. */
  function silenciarConsola() {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  }

  describe('validación de la entrada', () => {
    it.each([
      ['buscarPorCuc', (s: ApisService) => s.buscarPorCuc('')],
      ['buscarPorCodPredial', (s: ApisService) => s.buscarPorCodPredial('   ')],
      ['listarVias', (s: ApisService) => s.listarVias('')],
      ['buscarTitularCatastral', (s: ApisService) => s.buscarTitularCatastral('')],
      ['buscarDenominacionLote', (s: ApisService) => s.buscarDenominacionLote('')],
    ])('%s resuelve un array vacío y no consume ancho de banda si no hay texto', async (_nombre, invocar) => {
      // Los cinco métodos comparten la forma `Observable<T[]>`; el cast solo
      // unifica la unión de tipos que produce el `it.each`.
      const resultado = await firstValueFrom(invocar(service) as Observable<unknown[]>);

      // Sin texto no hay nada que buscar: la UI lista vacía, sin ir al API.
      expect(resultado).toEqual([]);
      httpMock.expectNone(() => true);
    });

    it('listarDatosLote resuelve `null` y no llama al API sin código de lote', async () => {
      const resultado = await firstValueFrom(service.listarDatosLote('  '));

      expect(resultado).toBeNull();
      httpMock.expectNone(() => true);
    });

    it('listarViaNumeros sí consulta aunque el código de vía venga vacío', async () => {
      // `listarViaNumeros` no valida la entrada: siempre se consulta, porque el
      // API es quien decide si el código existe.
      const promesa = firstValueFrom(service.listarViaNumeros(''));
      const peticion = httpMock.expectOne(porUrl(relativa(GEOVISOR_ENDPOINTS.listarViaNumeros)));

      expect(peticion.request.params.get('pvcCODVIA')).toBe('');
      peticion.flush({ data: [] });
      await expect(promesa).resolves.toEqual([]);
    });
  });

  describe('catálogo de endpoints', () => {
    it('mantiene los nombres de endpoint que espera el API', () => {
      expect(GEOVISOR_ENDPOINTS.listarDatosLote).toBe('listar-datos-lote');
      expect(GEOVISOR_ENDPOINTS.buscarPorCuc).toBe('busqueda-cuc');
      expect(GEOVISOR_ENDPOINTS.buscarPorCodPredial).toBe('busqueda-codpredial');
      expect(GEOVISOR_ENDPOINTS.listarViaNumeros).toBe('listar-via-numero');
      expect(GEOVISOR_ENDPOINTS.listarVias).toBe('listar-vias');
      expect(GEOVISOR_ENDPOINTS.buscarTitularCatastral).toBe('busqueda-titular-catastral');
      expect(GEOVISOR_ENDPOINTS.buscarDenominacionLote).toBe('busqueda-denominacion-lote');
    });
  });

  describe('consultas con reintentos entre hosts', () => {
    it('busca por CUC en la ruta relativa y desempaqueta `data`', async () => {
      const promesa = firstValueFrom(service.buscarPorCuc(' 12345678 '));
      const peticion = httpMock.expectOne(porUrl(relativa(GEOVISOR_ENDPOINTS.buscarPorCuc)));

      expect(peticion.request.method).toBe('GET');
      expect(peticion.request.params.get('txtcuc')).toBe('12345678');

      peticion.flush({ status: 200, data: [REGISTRO] });
      await expect(promesa).resolves.toEqual([REGISTRO]);
    });

    it('busca por código predial', async () => {
      const promesa = firstValueFrom(service.buscarPorCodPredial('270543112'));
      const peticion = httpMock.expectOne(porUrl(relativa(GEOVISOR_ENDPOINTS.buscarPorCodPredial)));

      expect(peticion.request.params.get('txtcodpredial')).toBe('270543112');
      peticion.flush({ data: [REGISTRO] });
      await expect(promesa).resolves.toEqual([REGISTRO]);
    });

    it('busca por razón social', async () => {
      const promesa = firstValueFrom(service.buscarTitularCatastral(' PEREZ '));
      const peticion = httpMock.expectOne(porUrl(relativa(GEOVISOR_ENDPOINTS.buscarTitularCatastral)));

      expect(peticion.request.params.get('pvcTXTRAZONSOCIAL')).toBe('PEREZ');
      peticion.flush({ data: [REGISTRO] });
      await expect(promesa).resolves.toEqual([REGISTRO]);
    });

    it('busca por denominación de predio', async () => {
      const promesa = firstValueFrom(service.buscarDenominacionLote('MZ-A'));
      const peticion = httpMock.expectOne(porUrl(relativa(GEOVISOR_ENDPOINTS.buscarDenominacionLote)));

      expect(peticion.request.params.get('pvcDENOMINACIONCAT')).toBe('MZ-A');
      peticion.flush({ data: [REGISTRO] });
      await expect(promesa).resolves.toEqual([REGISTRO]);
    });

    it('acepta un solo carácter como búsqueda de vías', async () => {
      // A diferencia del WFS (que exige 3 caracteres), el API responde bien con
      // uno: por eso las coincidencias se muestran desde la primera tecla.
      const promesa = firstValueFrom(service.listarVias('A'));
      const peticion = httpMock.expectOne(porUrl(relativa(GEOVISOR_ENDPOINTS.listarVias)));

      expect(peticion.request.params.get('pvcTXTNOMBREVIA')).toBe('A');
      peticion.flush({ data: [{ codviaequ: 'L1', txtnomvia: 'AVENIDA A' }] });
      await expect(promesa).resolves.toEqual([{ codviaequ: 'L1', txtnomvia: 'AVENIDA A' }]);
    });

    it('devuelve TODOS los registros, no solo el primero', async () => {
      // El visor lista todas las coincidencias (varias vías, varios lotes), así
      // que el desempaquetado no puede truncarse al primer elemento.
      const promesa = firstValueFrom(service.listarVias('AV'));
      const peticion = httpMock.expectOne(porUrl(relativa(GEOVISOR_ENDPOINTS.listarVias)));

      peticion.flush({
        data: [
          { codviaequ: 'L1', txtnomvia: 'AVENIDA PRIMERO' },
          { codviaequ: 'L2', txtnomvia: 'AVENIDA SEGUNDO' },
          { codviaequ: 'L3', txtnomvia: 'AVENIDA TERCERO' },
        ],
      });

      await expect(promesa).resolves.toHaveLength(3);
    });

    it('reintenta en el host de pruebas y luego en producción', async () => {
      silenciarConsola();

      const promesa = firstValueFrom(service.buscarPorCuc('12345678'));

      httpMock
        .expectOne(porUrl(relativa(GEOVISOR_ENDPOINTS.buscarPorCuc)))
        .flush('sin conexión', { status: 502, statusText: 'Bad Gateway' });
      httpMock
        .expectOne(porUrl(`${HOST_TEST}${relativa(GEOVISOR_ENDPOINTS.buscarPorCuc)}`))
        .flush('sin conexión', { status: 502, statusText: 'Bad Gateway' });

      const definitiva = httpMock.expectOne(porUrl(`${HOST_PROD}${relativa(GEOVISOR_ENDPOINTS.buscarPorCuc)}`));
      definitiva.flush({ data: [REGISTRO] });

      await expect(promesa).resolves.toEqual([REGISTRO]);
    });

    it('propaga el error cuando fallan los tres hosts', async () => {
      silenciarConsola();

      const promesa = firstValueFrom(service.buscarPorCuc('12345678'));
      promesa.catch(() => undefined); // el rechazo se comprueba con `rejects`

      for (const url of [
        relativa(GEOVISOR_ENDPOINTS.buscarPorCuc),
        `${HOST_TEST}${relativa(GEOVISOR_ENDPOINTS.buscarPorCuc)}`,
        `${HOST_PROD}${relativa(GEOVISOR_ENDPOINTS.buscarPorCuc)}`,
      ]) {
        httpMock.expectOne(porUrl(url)).flush('sin conexión', { status: 503, statusText: 'Service Unavailable' });
      }

      await expect(promesa).rejects.toBeTruthy();
    });

    it('devuelve un array vacío si la respuesta no trae `data`', async () => {
      const promesa = firstValueFrom(service.buscarPorCuc('12345678'));
      httpMock.expectOne(porUrl(relativa(GEOVISOR_ENDPOINTS.buscarPorCuc))).flush({ status: 200 });

      await expect(promesa).resolves.toEqual([]);
    });
  });
describe('listarViaNumeros', () => {
    const endpoint = GEOVISOR_ENDPOINTS.listarViaNumeros;

    it('consulta por el código de vía y desempaqueta `data`', async () => {
      const promesa = firstValueFrom(service.listarViaNumeros(' L271170 '));
      const peticion = httpMock.expectOne(porUrl(relativa(endpoint)));

      expect(peticion.request.params.get('pvcCODVIA')).toBe('L271170');
      peticion.flush({ data: [{ numero: '100', codlote: 'L1' }] });
      await expect(promesa).resolves.toEqual([{ numero: '100', codlote: 'L1' }]);
    });

    it('tolera la respuesta sin envolver en `data`', async () => {
      const promesa = firstValueFrom(service.listarViaNumeros('L271170'));
      httpMock.expectOne(porUrl(relativa(endpoint))).flush([{ numero: '100', codlote: 'L1' }]);

      await expect(promesa).resolves.toEqual([{ numero: '100', codlote: 'L1' }]);
    });

    it('tolera la envoltura `result`', async () => {
      const promesa = firstValueFrom(service.listarViaNumeros('L271170'));
      httpMock.expectOne(porUrl(relativa(endpoint))).flush({ result: [{ numero: '100' }] });

      await expect(promesa).resolves.toEqual([{ numero: '100' }]);
    });

    it('envuelve un objeto suelto en un array', async () => {
      const promesa = firstValueFrom(service.listarViaNumeros('L271170'));
      httpMock.expectOne(porUrl(relativa(endpoint))).flush({ numero: '100', codlote: 'L1' });

      await expect(promesa).resolves.toEqual([{ numero: '100', codlote: 'L1' }]);
    });
  });

  describe('listarDatosLote (hover)', () => {
    const endpoint = GEOVISOR_ENDPOINTS.listarDatosLote;

    it('devuelve el primer registro con su código catastral', async () => {
      const promesa = firstValueFrom(service.listarDatosLote('LOTE-1'));
      const peticion = httpMock.expectOne(porUrl(relativa(endpoint)));

      expect(peticion.request.params.get('pvcCODLOTE')).toBe('LOTE-1');
      peticion.flush({ status: 200, data: [REGISTRO] });
      await expect(promesa).resolves.toEqual(REGISTRO);
    });

    it('usa `codlotecatastral` cuando el registro no trae `codlote`', async () => {
      const promesa = firstValueFrom(service.listarDatosLote('LOTE-1'));
      httpMock
        .expectOne(porUrl(relativa(endpoint)))
        .flush({ data: [{ codlotecatastral: 'LOTE-99', txttitular: 'PEREZ, JUAN' }] });

      await expect(promesa).resolves.toEqual({
        codlotecatastral: 'LOTE-99',
        codlote: 'LOTE-99',
        txttitular: 'PEREZ, JUAN',
      });
    });

    it('resuelve `null` si el registro no identifica ningún lote', async () => {
      const promesa = firstValueFrom(service.listarDatosLote('LOTE-1'));
      httpMock.expectOne(porUrl(relativa(endpoint))).flush({ data: [{ txttitular: 'SIN CODIGO' }] });

      await expect(promesa).resolves.toBeNull();
    });

    it('resuelve `null` ante un fallo de conexión y no reintenta', async () => {
      silenciarConsola();

      const promesa = firstValueFrom(service.listarDatosLote('LOTE-1'));
      httpMock.expectOne(porUrl(relativa(endpoint))).flush('sin conexión', { status: 500, statusText: 'Server Error' });

      await expect(promesa).resolves.toBeNull();
      // El hover solo usa la ruta relativa: no hay peticiones a los hosts de respaldo.
      httpMock.expectNone(req => req.url.includes('munisanisidro.gob.pe'));
    });
  });
});