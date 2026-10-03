import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { vi } from 'vitest';

import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { SIN_AUDITORIA, auditoriaInterceptor } from './auditoria.interceptor';
import { AUDITORIA_OPCIONES, AuditoriaService } from './auditoria.service';

/** URL real del endpoint, tal y como la compone `environment.seguridadApiUrl`. */
const URL_AUDITORIA = `${environment.seguridadApiUrl}/auditoria/registrar`;
/** Clave de `sessionStorage` donde `AuthService` persiste la sesión. */
const CLAVE_SESION = 'gmsi_sesion_geovisor';
/** GeoServer de desarrollo, tal y como lo resuelve el proxy de `ng serve`. */
const URL_GEOSERVER = '/geoserver/ows';

/**
 * Pruebas del registro de auditoría.
 *
 * Se fija el contrato real del API (`POST /api/seguridad/auditoria/registrar`):
 *  - el cuerpo viaja como JSON con los nueve campos de `BeAuditoriaRegistrarEntrada`;
 *  - el front completa los de contexto que el API no envía (aplicación, usuario,
 *    equipo y nodo) y los ajusta a las columnas de `sicu_logmensajes`;
 *  - el éxito se valida en el body (`codigoRespuesta: "00"`), igual que en el
 *    login, porque el API responde HTTP 200 incluso ante errores;
 *  - un fallo de la auditoría NUNCA se propaga: resolver `false` es lo que evita
 *    que un problema de auditoría rompa una acción del visor.
 */
describe('AuditoriaService', () => {
  let service: AuditoriaService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuditoriaService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    // El reset va en un `finally`: si `verify()` lanza por una petición sin
    // responder, el TestBed quedaría instanciado y el test siguiente fallaría
    // al reconfigurarlo, enmascarando el fallo real.
    try {
      httpMock.verify();
    } finally {
      TestBed.resetTestingModule();
    }
  });

  /**
   * Registra el evento y devuelve su petición para inspeccionarla. Solo debe
   * llamarse una vez por prueba: `expectOne` consume la petición de la cola.
   */
  function registrar(entrada: Parameters<AuditoriaService['registrar']>[0]) {
    let resultado: boolean | undefined;
    service.registrar(entrada).subscribe(valor => (resultado = valor));
    const peticion = httpMock.expectOne(URL_AUDITORIA);
    return {
      peticion,
      cuerpo: peticion.request.body,
      /** Responde `ok` y devuelve el valor emitido por `registrar()`. */
      confirmar: (codigoRespuesta = '00') => {
        peticion.flush({ codigoRespuesta, mensajeRespuesta: 'ok' });
        return resultado;
      },
      /** Responde con un fallo HTTP y devuelve el valor emitido. */
      fallar: (status = 500) => {
        peticion.flush('sin conexión', { status, statusText: 'Server Error' });
        return resultado;
      },
    };
  }

  it('envía el evento al endpoint de auditoría en JSON', () => {
    const { peticion, confirmar } = registrar({
      opcion: AUDITORIA_OPCIONES.BUSQUEDA,
      mensaje: 'por CUC',
    });

    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.headers.get('Content-Type')).toBe('application/json');
    expect(confirmar()).toBe(true);
  });

  it('completa los campos de contexto que el front conoce', () => {
    const { cuerpo, confirmar } = registrar({
      opcion: AUDITORIA_OPCIONES.IMPRESION_FICHA,
      mensaje: 'lote 31-01',
    });

    expect(cuerpo.aplicacion).toBe('GEOVISOR_MDSI');
    expect(cuerpo.opcion).toBe(AUDITORIA_OPCIONES.IMPRESION_FICHA);
    expect(cuerpo.mensaje).toBe('lote 31-01');
    expect(typeof cuerpo.equipo).toBe('string');
    expect(cuerpo.nodo).not.toBe('');
    // Sin sesión abierta el usuario va vacío, no `null`.
    expect(cuerpo.codigoUsuario).toBe('');
    // El API espera `tiempoMs` numérico.
    expect(typeof cuerpo.tiempoMs).toBe('number');
    expect(confirmar()).toBe(true);
  });

  it('respeta los valores informados por el llamante', () => {
    const { cuerpo, confirmar } = registrar({
      aplicacion: 'OTRA_APP',
      opcion: AUDITORIA_OPCIONES.CONSULTA_GEOVISOR,
      conexionNombre: 'ORACLE',
      tiempoMs: 1234.6,
      codigoUsuario: 'ADMIN',
      equipo: 'Chrome/120',
      nodo: 'NODO-TEST',
    });

    expect(cuerpo.aplicacion).toBe('OTRA_APP');
    expect(cuerpo.conexionNombre).toBe('ORACLE');
    // `dectiempo numeric(12,2)`: conserva un decimal, no redondea a entero.
    expect(cuerpo.tiempoMs).toBe(1234.6);
    expect(cuerpo.codigoUsuario).toBe('ADMIN');
    expect(cuerpo.equipo).toBe('Chrome/120');
    expect(cuerpo.nodo).toBe('NODO-TEST');
    expect(confirmar()).toBe(true);
  });

  it('devuelve false si el API responde con un código distinto de 00', () => {
    // El API responde HTTP 200 incluso ante errores: el fallo va en el body.
    const { confirmar } = registrar({ opcion: AUDITORIA_OPCIONES.SESION });
    expect(confirmar('99')).toBe(false);
  });

  it('no propaga el fallo de la auditoría (resuelve false y avisa)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { fallar } = registrar({ opcion: AUDITORIA_OPCIONES.CONSULTA_GEOVISOR });

    expect(fallar()).toBe(false);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
// --- Encaje con mdsisicu.sicu_logmensajes -----------------------------
  // Cada columna es varchar(n) y `dectiempo` es numeric(12,2): si el valor
  // viaja más largo de lo que admite la columna, el INSERT falla entero y se
  // pierde el evento. Estas pruebas fijan el recorte y el formato.

  it('envía dectiempo con los dos decimales de numeric(12,2)', () => {
    const { cuerpo, confirmar } = registrar({ opcion: 'X', tiempoMs: 1234.567 });

    expect(cuerpo.tiempoMs).toBe(1234.57);
    expect(confirmar()).toBe(true);
  });

  it('envía dectiempo = 0 cuando el tiempo no es un número', () => {
    // Un NaN en el cuerpo haría fallar el INSERT de la fila completa.
    const { cuerpo, confirmar } = registrar({ opcion: 'X', tiempoMs: Number.NaN });

    expect(cuerpo.tiempoMs).toBe(0);
    expect(confirmar()).toBe(true);
  });

  it('recorta cada texto a la longitud de su columna', () => {
    const largo = (n: number) => 'X'.repeat(n);
    const { cuerpo, confirmar } = registrar({
      aplicacion: largo(30),
      opcion: largo(150),
      conexionNombre: largo(150),
      codigoMensaje: largo(20),
      mensaje: largo(5200),
      codigoUsuario: largo(80),
      equipo: largo(80),
      nodo: largo(80),
    });

    // Longitudes de vchaplicacion(20), vchopcion(100), vchconnombre(100),
    // vchcodmensaje(12), vchmensaje(5000), vchcodusuario(50), vchequipo(50)
    // y vchnodo(50).
    expect(cuerpo.aplicacion.length).toBe(20);
    expect(cuerpo.opcion.length).toBe(100);
    expect(cuerpo.conexionNombre.length).toBe(100);
    expect(cuerpo.codigoMensaje.length).toBe(12);
    expect(cuerpo.mensaje.length).toBe(5000);
    expect(cuerpo.codigoUsuario.length).toBe(50);
    expect(cuerpo.equipo.length).toBe(50);
    expect(cuerpo.nodo.length).toBe(50);
    expect(confirmar()).toBe(true);
  });

  it('recorta el userAgent a los 50 caracteres de vchequipo', () => {
    // El navegador real envía un userAgent de más de 50 caracteres: sin recorte
    // la columna vchequipo rechazaría la fila.
    const { cuerpo, confirmar } = registrar({ opcion: 'X' });

    expect(cuerpo.equipo.length).toBeLessThanOrEqual(50);
    expect(confirmar()).toBe(true);
  });

  it('registra una acción de éxito con código 00 y origen NAVEGADOR', () => {
    service.accion(AUDITORIA_OPCIONES.CAPA_VISIBILIDAD, 'Capa hidrografía activada');
    const peticion = httpMock.expectOne(URL_AUDITORIA);

    expect(peticion.request.body.opcion).toBe(AUDITORIA_OPCIONES.CAPA_VISIBILIDAD);
    expect(peticion.request.body.codigoMensaje).toBe('00');
    expect(peticion.request.body.mensaje).toBe('Capa hidrografía activada');
    expect(peticion.request.body.conexionNombre).toBe('NAVEGADOR');

    peticion.flush({ codigoRespuesta: '00', mensajeRespuesta: 'ok' });
  });

  it('registra un fallo con código de error por defecto', () => {
    service.error(AUDITORIA_OPCIONES.BUSQUEDA, 'Error de conexión con el servicio catastral');
    const peticion = httpMock.expectOne(URL_AUDITORIA);

    expect(peticion.request.body.codigoMensaje).toBe('ERR-GENERICO');
    expect(peticion.request.body.mensaje).toBe('Error de conexión con el servicio catastral');

    peticion.flush({ codigoRespuesta: '00', mensajeRespuesta: 'ok' });
  });
});

/**
 * El interceptor audita automáticamente las consultas del visor: las del API
 * del Geovisor y las de los servicios cartográficos de GeoServer (WMS / WFS).
 */
describe('auditoriaInterceptor', () => {
  let service: AuditoriaService;
  let httpMock: HttpTestingController;
  let http: HttpClient;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([auditoriaInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(AuditoriaService);
    httpMock = TestBed.inject(HttpTestingController);
    http = TestBed.inject(HttpClient);
  });

  afterEach(() => {
    try {
      httpMock.verify();
    } finally {
      TestBed.resetTestingModule();
    }
  });

  /**
   * Resuelve TODAS las peticiones de auditoría pendientes que dejó el
   * interceptor y devuelve el cuerpo de la última. Resolver todas (y no solo la
   * última) es lo que deja el mock limpio: una petición sin responder hace fallar
   * `httpMock.verify()` y arrastra al test siguiente.
   */
  function auditoriaPemitida(): Record<string, unknown> {
    const peticiones = httpMock.match(URL_AUDITORIA);
    const ultima = peticiones[peticiones.length - 1];
    for (const peticion of peticiones) {
      peticion.flush({ codigoRespuesta: '00', mensajeRespuesta: 'ok' });
    }
    return ultima.request.body as Record<string, unknown>;
  }

  it('registra una consulta correcta con su duración', () => {
    const inicio = performance.now();
    let fallo: unknown = null;
    http.get(`${environment.geovisorApiUrl}/listar-vias`).subscribe({
      error: (e: unknown) => {
        fallo = e;
      },
    });

    httpMock
      .expectOne(r => r.url.includes('/listar-vias'))
      .flush({ status: 'ok', data: [] });
    // Auditar no debe alterar el resultado de la consulta original.
    expect(fallo).toBeNull();

    const cuerpo = auditoriaPemitida();
    expect(cuerpo['opcion']).toBe(AUDITORIA_OPCIONES.CONSULTA_GEOVISOR);
    expect(cuerpo['codigoMensaje']).toBe('00');
    // El detalle lleva método y endpoint: es lo que permite saber después qué
    // consulta se hizo y con qué criterio.
    expect(cuerpo['mensaje']).toContain('GET');
    expect(cuerpo['mensaje']).toContain('geovisor/listar-vias');
    expect(cuerpo['conexionNombre']).toBe('REST');
    expect(cuerpo['tiempoMs']).toBeGreaterThanOrEqual(0);
    // `dectiempo` no puede medir más que el propio elapsed de la prueba.
    expect(cuerpo['tiempoMs']).toBeLessThanOrEqual(performance.now() - inicio + 50);
  });

  it('registra los parámetros de la consulta en el mensaje', () => {
    http.get(`${environment.geovisorApiUrl}/listar-vias`, {
      params: { pvcTXTNOMBREVIA: 'av' },
    }).subscribe();

    httpMock.expectOne(r => r.url.includes('/listar-vias')).flush({ status: 'ok', data: [] });

    expect(auditoriaPemitida()['mensaje']).toContain('pvcTXTNOMBREVIA=av');
  });

  it('registra un error HTTP con su código de status y propaga el error', () => {
    let fallo: unknown = null;
    http.get(`${environment.geovisorApiUrl}/listar-vias`).subscribe({
      error: (e: unknown) => {
        fallo = e;
      },
    });

    httpMock
      .expectOne(r => r.url.includes('/listar-vias'))
      .flush('fallo', { status: 500, statusText: 'Server Error' });
    // El error se propaga intacto a quien pidió los datos.
    expect(fallo).not.toBeNull();

    const cuerpo = auditoriaPemitida();
    expect(cuerpo['codigoMensaje']).toBe('ERR-500');
    expect(cuerpo['opcion']).toBe(AUDITORIA_OPCIONES.CONSULTA_GEOVISOR);
  });

  it('registra un fallo de red sin respuesta (status 0)', () => {
    http.get(`${environment.geovisorApiUrl}/listar-vias`).subscribe({
      error: () => undefined,
    });

    httpMock
      .expectOne(r => r.url.includes('/listar-vias'))
      .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

    // status 0 = no hubo respuesta: se distingue de un error del servidor.
    expect(auditoriaPemitida()['codigoMensaje']).toBe('ERR-RED');
  });

  it('NO audita el autocompletado, solo la búsqueda definitiva', () => {
    // El usuario va escribiendo el nombre del parque: el `debounceTime` lanza una
    // consulta por cada pausa de 300 ms. Esas son texto a medio teclear, no
    // búsquedas reales, y no deben llenar la tabla de auditoría.
    http
      .get(environment.geoserver.owsUrl, {
        params: { service: 'WFS', request: 'GetFeature', typeName: 'WEB_GIS:vw_tg_area_rec_nombres' },
        context: new HttpContext().set(SIN_AUDITORIA, true),
      })
      .subscribe();

    httpMock
      .expectOne(r => r.url.startsWith(environment.geoserver.owsUrl))
      .flush({ features: [] });

    // Ni una sola auditoría por la sugerencia.
    httpMock.expectNone(URL_AUDITORIA);
  });

  it('ignora los backends ajenos al visor (DataGIS, TUSNE)', () => {
    http.get('/DataGIS_WGS84/LotePublico.asp?codigo_i=31').subscribe();

    httpMock.expectOne(r => r.url.includes('LotePublico')).flush('ok');
    // Ni una sola auditoría: el interceptor cubre `/WSGEOVISOR/api/` y el OWS de
    // GeoServer, que son los dos backends que consulta el visor.
    // Las teselas WMS NO pasan por HttpClient (las pide OpenLayers con el
    // `Image` del navegador) y se auditan en `MapService.addWmsLayer`.
    httpMock.expectNone(URL_AUDITORIA);
  });

  // --- Búsquedas cartográficas contra GeoServer (WFS por OWS) --------------
  // La búsqueda por código catastral, por parque, por habilitación urbana y por
  // manzana/lote NO va al API del WSGEOVISOR: consulta el OWS de GeoServer con
  // un `GetFeature` y un filtro CQL. Como `MapService` las lanza por
  // `HttpClient`, las captura este interceptor.

  it('registra la búsqueda por código catastral (WFS GetFeature)', () => {
    http
      .get(environment.geoserver.owsUrl, {
        params: {
          service: 'WFS',
          version: '1.1.0',
          request: 'GetFeature',
          typeName: 'WEB_GIS:vw_tg_lote',
          outputFormat: 'application/json',
          cql_filter: "id_lote = '3112065002'",
        },
      })
      .subscribe();

    httpMock.expectOne(r => r.url.startsWith(environment.geoserver.owsUrl)).flush({ features: [] });

    const cuerpo = auditoriaPemitida();
    expect(cuerpo['opcion']).toBe(AUDITORIA_OPCIONES.CONSULTA_GEOSERVER);
    expect(cuerpo['conexionNombre']).toBe('GEOSERVER');
    // La capa y el filtro son lo que identifica qué se buscó.
    expect(cuerpo['mensaje']).toContain('vw_tg_lote');
    expect(cuerpo['mensaje']).toContain('3112065002');
  });

  it('registra la búsqueda por parque (WFS) y un fallo de GeoServer', () => {
    http
      .get(environment.geoserver.owsUrl, {
        params: { service: 'WFS', request: 'GetFeature', typeName: 'WEB_GIS:parques' },
      })
      .subscribe({ error: () => undefined });

    httpMock
      .expectOne(r => r.url.startsWith(environment.geoserver.owsUrl))
      .flush('error', { status: 500, statusText: 'Server Error' });

    const cuerpo = auditoriaPemitida();
    expect(cuerpo['opcion']).toBe(AUDITORIA_OPCIONES.CONSULTA_GEOSERVER);
    expect(cuerpo['codigoMensaje']).toBe('ERR-500');
    expect(cuerpo['mensaje']).toContain('parques');
  });
});

/**
 * `vchcodusuario` debe traer el usuario de la sesión. Se comprueba el recorrido
 * completo —iniciar sesión y auditar después— porque el fallo podría estar en
 * cualquiera de los dos servicios.
 */
describe('AuditoriaService · usuario de la sesión', () => {
  let auth: AuthService;
  let auditoria: AuditoriaService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    auth = TestBed.inject(AuthService);
    auditoria = TestBed.inject(AuditoriaService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    try {
      httpMock.verify();
    } finally {
      sessionStorage.clear();
      TestBed.resetTestingModule();
    }
  });

  /** Autentica contra el API con la respuesta de éxito real. */
  function iniciarSesion(): void {
    auth.iniciarSesion('ADMIN', '123456').subscribe();
    httpMock
      .expectOne(`${environment.seguridadApiUrl}/auth/iniciar-sesion`)
      .flush({
        token: 'a.b.c',
        tokenExpiraEnMinutos: 60,
        informacionUsuario: {
          codigoUsuario: 'ADMIN',
          nombres: 'ADMINISTRADOR',
          correoElectronico: 'a@b.gob.pe',
          codigoRol: 'COORDINADOR',
        },
        paginas: [],
        controles: [],
        codigoRespuesta: '00',
        mensajeRespuesta: 'Autenticacion exitosa',
      });
    // El login se audita a sí mismo; se vacía para aislar la prueba siguiente.
    httpMock.expectOne(URL_AUDITORIA).flush({ codigoRespuesta: '00' });
  }

  it('envía el usuario autenticado tras iniciar sesión', () => {
    iniciarSesion();

    auditoria.accion(AUDITORIA_OPCIONES.CAPA_VISIBILIDAD, 'capa');
    const peticion = httpMock.expectOne(URL_AUDITORIA);

    expect(peticion.request.body.codigoUsuario).toBe('ADMIN');
    peticion.flush({ codigoRespuesta: '00' });
  });

  it('envía el JWT de sesión en Authorization para que el API identifique al usuario', () => {
    iniciarSesion();

    auditoria.accion(AUDITORIA_OPCIONES.CONSULTA_GEOVISOR, 'consulta');
    const peticion = httpMock.expectOne(URL_AUDITORIA);

    // Sin este header el servidor no puede atribuir el evento a un usuario y lo
    // guarda como ANONIMO, aunque `codigoUsuario` viaje en el cuerpo.
    expect(peticion.request.headers.get('Authorization')).toBe('Bearer a.b.c');
    peticion.flush({ codigoRespuesta: '00' });
  });

  it('envía vacío (no ANONIMO) cuando no hay sesión', () => {
    auditoria.accion(AUDITORIA_OPCIONES.CONSULTA_GEOVISOR, 'consulta');
    const peticion = httpMock.expectOne(URL_AUDITORIA);

    expect(peticion.request.body.codigoUsuario).toBe('');
    peticion.flush({ codigoRespuesta: '00' });
  });
});

/**
 * Sesión recuperada de `sessionStorage` (el caso de pulsar F5).
 *
 * Va en un `describe` aparte porque el orden importa: la sesión debe estar en
 * `sessionStorage` ANTES de que se construya el `AuthService`, ya que es su
 * constructor quien la restaura. Reconfigurar el `TestBed` dentro de un test
 * invalidaría el módulo de las pruebas vecinas.
 */
describe('AuditoriaService · usuario tras una recarga (F5)', () => {
  let auth: AuthService;
  let auditoria: AuditoriaService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
    // Simula la pestaña recargada: la sesión quedó guardada en la anterior.
    sessionStorage.setItem(
      CLAVE_SESION,
      JSON.stringify({
        token: 'a.b.c',
        expiraEn: null,
        usuario: null,
        codigoUsuario: 'ADMIN',
        paginas: [],
        controles: [],
      })
    );
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    auth = TestBed.inject(AuthService);
    auditoria = TestBed.inject(AuditoriaService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    try {
      httpMock.verify();
    } finally {
      sessionStorage.clear();
      TestBed.resetTestingModule();
    }
  });

  it('restaura el usuario y lo envía en la auditoría', () => {
    expect(auth.codigoUsuario()).toBe('ADMIN');

    auditoria.accion(AUDITORIA_OPCIONES.BUSQUEDA, 'búsqueda');
    const peticion = httpMock.expectOne(URL_AUDITORIA);

    expect(peticion.request.body.codigoUsuario).toBe('ADMIN');
    peticion.flush({ codigoRespuesta: '00' });
  });
});
