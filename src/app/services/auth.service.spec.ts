import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { AuthService } from './auth.service';

/** Minuto en milisegundos, para avanzar el reloj simulado. */
const MINUTO = 60_000;
/** Minutos que dura el JWT que emite el API de Seguridad (verificado). */
const MINUTOS_TOKEN_API = 60;
/** Minutos de cortesía que aplica el front cuando el API no acota la sesión. */
const MINUTOS_POR_DEFECTO = 30;
/** Clave de `sessionStorage` usada por el servicio para persistir la sesión. */
const CLAVE_SESION = 'gmsi_sesion_geovisor';

/** Usuario autenticado y permisos que devuelve el API (`BeLoginSalida`). */
const INFORMACION_USUARIO = {
  codigoUsuario: 'ADMIN',
  nombres: 'ADMINISTRADOR EQDS EQDS',
  correoElectronico: '@munisanisidro@gob.pe',
  codigoRol: 'COORDINADOR INSPECCION',
};
const PAGINAS = [{ codigoPagina: 'PAG260', url: '0', nombre: 'Distritos' }];
const CONTROLES = [{ codigoControl: 'PAG232', idComponente: 'PAGE', comando: '', visible: true }];

/**
 * JWT de prueba: la app solo consume el `exp` del payload para saber cuándo
 * caduca la sesión (el API firma con HS256 y `exp` = emisión + 60 minutos).
 */
function jwtDePrueba(expiraEnSegundos: number): string {
  const b64 = (valor: object) => btoa(JSON.stringify(valor));
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'ADMIN', exp: expiraEnSegundos })}.firma-de-prueba`;
}

/**
 * Respuesta REAL del API (`POST /WSGEOVISOR/api/seguridad/auth/iniciar-sesion`
 * con `ADMIN` / `123456` y `codigoSistema: "010004"`): `codigoRespuesta: "00"`,
 * JWT de 60 minutos, información del usuario, 56 páginas y 174 controles.
 *
 * @param minutosVigencia Minutos que dura el JWT.
 * @param minutosApi Minutos que informa `tokenExpiraEnMinutos` (por defecto, los del JWT).
 */
function respuestaApi(minutosVigencia = MINUTOS_TOKEN_API, minutosApi = minutosVigencia) {
  return {
    token: jwtDePrueba(Math.floor(Date.now() / 1000) + minutosVigencia * 60),
    tokenExpiraEnMinutos: minutosApi,
    informacionUsuario: INFORMACION_USUARIO,
    paginas: PAGINAS,
    controles: CONTROLES,
    codigoRespuesta: '00',
    mensajeRespuesta: 'Autenticacion exitosa',
  };
}

/** Respuesta sin token: el front calcula la caducidad y la sesión es prorrogable. */
function respuestaSinToken() {
  return {
    tokenExpiraEnMinutos: 0,
    informacionUsuario: INFORMACION_USUARIO,
    paginas: PAGINAS,
    controles: CONTROLES,
    codigoRespuesta: '00',
    mensajeRespuesta: 'Autenticacion exitosa',
  };
}

/**
 * Respuesta del API cuando el `codigoSistema` no está registrado: autentica las
 * credenciales pero devuelve `"99"` sin token, sin usuario y sin permisos.
 */
const RESPUESTA_SIN_SESION = {
  tokenExpiraEnMinutos: 0,
  paginas: [],
  controles: [],
  codigoRespuesta: '99',
  mensajeRespuesta: '',
};

/**
 * La sesión del Geovisor NO caduca por tiempo (`SESION_CADUCA = false` en
 * `auth.service.ts`): el visor nunca envía el JWT del API a un endpoint, así que
 * su `exp` —60 minutos— se conserva solo como dato informativo y no expulsa al
 * usuario. Estas pruebas fijan ese comportamiento (sesión viva tras el
 * vencimiento, sin avisos y sin cierre automático) y el rechazo de la respuesta
 * `"99"` (código de sistema no registrado), que antes abría una sesión vacía.
 */
describe('AuthService · sesión sin caducidad', () => {
  let service: AuthService;

  beforeEach(() => {
    sessionStorage.clear();
    // Reloj simulado desde el inicio de cada prueba: las respuestas con JWT se
    // construyen a partir de "ahora", así el vencimiento es determinista.
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    sessionStorage.clear();
    TestBed.resetTestingModule();
  });

  /**
   * Inyecta el servicio con un cliente HTTP simulado (sin backend) y ejecuta un
   * inicio de sesión contra la respuesta indicada.
   */
  function autenticar(respuesta: object): void {
    TestBed.configureTestingModule({
      providers: [{ provide: HttpClient, useValue: { post: () => of(respuesta) } }],
    });
    service = TestBed.inject(AuthService);
    service.iniciarSesion('ADMIN', '123456').subscribe();
  }

  /**
   * Comprueba el tiempo que le queda a la sesión. La caducidad se toma del `exp`
   * del JWT, que tiene precisión de segundos, así que el instante calculado
   * puede quedar hasta 1 segundo por debajo del plazo nominal.
   *
   * @param minutos Minutos esperados de vigencia.
   */
  function esperarCaducidadDe(minutos: number): void {
    const restante = service.expiraEn()! - Date.now();
    expect(restante).toBeLessThanOrEqual(minutos * MINUTO);
    expect(restante).toBeGreaterThan(minutos * MINUTO - 1000);
  }

  // --- Sesión acotada por el API (JWT de 60 minutos) -----------------------

  it('mantiene la sesión abierta aunque venza el JWT del API', () => {
    autenticar(respuestaApi());

    expect(service.isAuthenticated()).toBe(true);
    expect(service.userName()).toBe('ADMINISTRADOR EQDS EQDS');
    expect(service.tieneControl('PAG232')).toBe(true);
    expect(sessionStorage.getItem(CLAVE_SESION)).not.toBeNull();

    // Pasado el minuto 60 (y de sobra) el visor no cierra la sesión ni avisa.
    vi.advanceTimersByTime((MINUTOS_TOKEN_API + 30) * MINUTO);

    expect(service.isAuthenticated()).toBe(true);
    expect(service.sesionPorExpirar()).toBe(false);
    expect(service.sesionExpirada()).toBe(false);
    expect(service.segundosRestantes()).toBeNull();
    expect(service.cuentaAtras()).toBe('');
    expect(sessionStorage.getItem(CLAVE_SESION)).not.toBeNull();
  });

  it('con el JWT del API el vencimiento queda solo como dato informativo', () => {
    autenticar(respuestaApi());

    expect(service.puedeExtenderSesion()).toBe(false);
    esperarCaducidadDe(MINUTOS_TOKEN_API);
  });

  it('la fecha del JWT manda sobre `tokenExpiraEnMinutos`', () => {
    autenticar(respuestaApi(MINUTOS_TOKEN_API, 5));

    esperarCaducidadDe(MINUTOS_TOKEN_API);
  });

  it('nunca muestra el aviso de caducidad ni cierra la sesión por tiempo', () => {
    autenticar(respuestaApi());

    // Instante en el que antes empezaba el aviso (2 minutos antes del JWT).
    vi.advanceTimersByTime((MINUTOS_TOKEN_API - 2) * MINUTO);
    expect(service.sesionPorExpirar()).toBe(false);
    expect(service.cuentaAtras()).toBe('');
    expect(service.isAuthenticated()).toBe(true);

    // Al vencer el JWT tampoco se cierra ni se explica una caducidad.
    vi.advanceTimersByTime(3 * MINUTO);
    expect(service.isAuthenticated()).toBe(true);
    expect(service.sesionExpirada()).toBe(false);
    expect(sessionStorage.getItem(CLAVE_SESION)).not.toBeNull();
  });

  it('extenderSesion no altera el vencimiento informativo del JWT', () => {
    autenticar(respuestaApi());
    vi.advanceTimersByTime((MINUTOS_TOKEN_API - 1) * MINUTO);
    const expiraEn = service.expiraEn();

    service.extenderSesion();

    expect(service.expiraEn()).toBe(expiraEn);
    expect(service.sesionPorExpirar()).toBe(false);
  });

  // --- Sesión sin token: la caducidad la calcula el front ------------------

  // --- Sesión sin token: caducidad calculada por el front ------------------

  it('sin token del API el plazo local tampoco cierra la sesión', () => {
    autenticar(respuestaSinToken());

    expect(service.isAuthenticated()).toBe(true);
    expect(service.puedeExtenderSesion()).toBe(true);
    // El plazo local se sigue calculando, pero solo como dato informativo.
    expect(service.expiraEn()! - Date.now()).toBe(MINUTOS_POR_DEFECTO * MINUTO);
    expect(sessionStorage.getItem(CLAVE_SESION)).not.toBeNull();

    vi.advanceTimersByTime((MINUTOS_POR_DEFECTO + 10) * MINUTO);

    expect(service.isAuthenticated()).toBe(true);
    expect(service.sesionPorExpirar()).toBe(false);
    expect(service.sesionExpirada()).toBe(false);
  });

  it('extenderSesion es inerte: no hay vencimiento que prorrogar', () => {
    autenticar(respuestaSinToken());
    const expiraEn = service.expiraEn();

    service.extenderSesion();

    expect(service.expiraEn()).toBe(expiraEn);
    expect(service.sesionPorExpirar()).toBe(false);
    expect(service.isAuthenticated()).toBe(true);
  });

  it('descartar el aviso no altera la sesión activa', () => {
    autenticar(respuestaSinToken());

    service.descartarAvisoSesion();

    expect(service.sesionPorExpirar()).toBe(false);
    expect(service.sesionExpirada()).toBe(false);
    expect(service.isAuthenticated()).toBe(true);
  });

  // --- Cierre de sesión y recarga (F5) -------------------------------------

  it('el logout manual es la única forma de cerrar la sesión', () => {
    autenticar(respuestaApi());
    expect(sessionStorage.getItem(CLAVE_SESION)).not.toBeNull();

    service.logout();

    expect(service.isAuthenticated()).toBe(false);
    expect(service.token()).toBeNull();
    expect(service.expiraEn()).toBeNull();
    expect(service.sesionExpirada()).toBe(false);
    expect(service.sesionPorExpirar()).toBe(false);
    expect(sessionStorage.getItem(CLAVE_SESION)).toBeNull();

    // Ni pasado el vencimiento del JWT anterior se reactiva ningún aviso.
    vi.advanceTimersByTime((MINUTOS_TOKEN_API + 1) * MINUTO);
    expect(service.isAuthenticated()).toBe(false);
    expect(service.sesionExpirada()).toBe(false);
  });

  /**
   * Simula una recarga de la página (F5): deja la sesión en `sessionStorage` y
   * arranca el servicio de nuevo con esa sesión guardada.
   *
   * @param sesion Contenido de la sesión persistida.
   */
  function alRecargarLaPagina(sesion: object): void {
    sessionStorage.setItem(CLAVE_SESION, JSON.stringify(sesion));
    TestBed.configureTestingModule({
      providers: [{ provide: HttpClient, useValue: { post: () => of({}) } }],
    });
    service = TestBed.inject(AuthService);
  }

  it('al recargar reanuda una sesión del JWT ya vencida sin pedir credenciales', () => {
    alRecargarLaPagina({
      token: 'jwt-de-prueba',
      expiraEn: Date.now() - MINUTO,
      usuario: INFORMACION_USUARIO,
      codigoUsuario: 'ADMIN',
      paginas: PAGINAS,
      controles: CONTROLES,
      expiraPorApi: true,
    });

    expect(service.isAuthenticated()).toBe(true);
    expect(service.sesionExpirada()).toBe(false);
    expect(service.userName()).toBe('ADMINISTRADOR EQDS EQDS');
    expect(service.tieneControl('PAG232')).toBe(true);
    expect(sessionStorage.getItem(CLAVE_SESION)).not.toBeNull();
  });

  it('al recargar reanuda la sesión guardada aunque no traiga fecha de caducidad', () => {
    alRecargarLaPagina({
      token: '',
      expiraEn: null,
      usuario: INFORMACION_USUARIO,
      codigoUsuario: 'ADMIN',
      paginas: PAGINAS,
      controles: CONTROLES,
    });

    expect(service.isAuthenticated()).toBe(true);
    expect(service.expiraEn()).toBeNull();
    expect(service.sesionExpirada()).toBe(false);
  });

  it('sin sesión guardada el visor arranca en modo público', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: HttpClient, useValue: { post: () => of({}) } }],
    });
    service = TestBed.inject(AuthService);

    expect(service.isAuthenticated()).toBe(false);
    expect(service.sesionExpirada()).toBe(false);
  });

  // --- Respuesta sin sesión (código 99) ------------------------------------

  it('rechaza la respuesta "99" sin token y explica la causa', () => {
    let mensaje = '';
    TestBed.configureTestingModule({
      providers: [{ provide: HttpClient, useValue: { post: () => of(RESPUESTA_SIN_SESION) } }],
    });
    service = TestBed.inject(AuthService);

    service.iniciarSesion('ADMIN', '123456').subscribe({
      error: (error: Error) => { mensaje = error.message; },
    });

    expect(service.isAuthenticated()).toBe(false);
    expect(service.expiraEn()).toBeNull();
    expect(sessionStorage.getItem(CLAVE_SESION)).toBeNull();
    expect(mensaje).toContain('código 99');
  });
});
