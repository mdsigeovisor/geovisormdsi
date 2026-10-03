import { Injectable, Injector, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, catchError, map, throwError, timeout } from 'rxjs';
import { environment } from '../../environments/environment';
import { AUDITORIA_OPCIONES, AuditoriaService } from './auditoria.service';

/* ---------------------------------------------------------------------------
 * CONTRATOS DEL MÓDULO DE SEGURIDAD (MSICAS) DEL API WSGEOVISOR
 * Fuente: swagger del propio API (`/WSGEOVISOR/swagger/docs/v1`), definiciones
 * BeLoginEntrada / BeLoginSalida / BeUsuarioInformacion / BePaginaAutorizada /
 * BeControlAutorizado del endpoint `POST /api/seguridad/auth/iniciar-sesion`.
 * ------------------------------------------------------------------------- */

/** Información personal del usuario autenticado (`informacionUsuario`). */
export interface UsuarioSesion {
  codigoUsuario: string;
  nombres: string;
  correoElectronico: string;
  codigoRol: string;
}

/** Página/opción de menú autorizada para el usuario (`paginas`). */
export interface PaginaAutorizada {
  codigoPagina: string;
  url: string;
  nombre: string;
}

/** Control (botón/acción) autorizado para el usuario (`controles`). */
export interface ControlAutorizado {
  codigoControl: string;
  idComponente: string;
  comando: string;
  visible: boolean;
}

/** Respuesta de `POST /api/seguridad/auth/iniciar-sesion` (BeLoginSalida). */
export interface LoginRespuesta {
  token?: string;
  tokenExpiraEnMinutos?: number;
  informacionUsuario?: UsuarioSesion;
  paginas?: PaginaAutorizada[];
  controles?: ControlAutorizado[];
  codigoRespuesta?: string;
  mensajeRespuesta?: string;
}

/** Error de autenticación con mensaje ya listo para mostrar al usuario. */
export class ErrorAutenticacion extends Error {
  constructor(public readonly codigo: string, mensaje: string) {
    super(mensaje);
    this.name = 'ErrorAutenticacion';
  }
}

/** Sesión guardada en `sessionStorage` para sobrevivir a una recarga (F5). */
interface SesionPersistida {
  token: string;
  /**
   * Momento (epoch ms) en que el API declara caducada la sesión según
   * `tokenExpiraEnMinutos` / `exp` del JWT; `null` si no se pudo determinar.
   * Con `SESION_CADUCA = false` es informativo: no cierra la sesión.
   */
  expiraEn: number | null;
  usuario: UsuarioSesion | null;
  /**
   * Usuario (login) con el que se abrió la sesión. Se conserva aparte porque
   * hay respuestas del API que no incluyen `informacionUsuario`.
   */
  codigoUsuario: string | null;
  paginas: PaginaAutorizada[];
  controles: ControlAutorizado[];
  /**
   * `true` cuando la caducidad la impuso el API (emitió `token` y
   * `tokenExpiraEnMinutos`). Si no viene (sesiones guardadas antes de este
   * cambio) se deduce del propio token.
   */
  expiraPorApi?: boolean;
}

/** Clave de `sessionStorage` donde se conserva la sesión del Geovisor. */
const CLAVE_SESION = 'gmsi_sesion_geovisor';
/**
 * Minutos de cortesía que aplica el front cuando el API no acota la sesión
 * (respuesta sin `token` ni `tokenExpiraEnMinutos`). Con el API actual este
 * camino no se usa —devuelve un JWT de 60 minutos—, pero mantiene el visor
 * operativo si algún ambiente responde sin token. Al ser una caducidad
 * calculada localmente, el usuario SÍ puede prorrogarla.
 */
const MINUTOS_SESION_POR_DEFECTO = 30;
/** Tiempo máximo de espera de la respuesta del API de seguridad (ms). */
const TIEMPO_MAXIMO_MS = 20000;
/**
 * Antelación (ms) con la que se avisa al usuario antes de cerrar la sesión.
 * Solo aplica cuando `SESION_CADUCA` es `true`.
 */
const AVISO_EXPIRACION_MS = 2 * 60_000;
/** Retardo máximo que admite `setTimeout` (~24,8 días), para no desbordarlo. */
const RETARDO_MAXIMO_MS = 2_147_483_647;

/**
 * ¿La sesión del Geovisor caduca sola por tiempo?
 *
 * `false` (lo que se pidió para el visor): la sesión permanece abierta hasta que
 * el usuario pulse "Cerrar sesión" o cierre la pestaña. El front NO programa
 * ningún cierre automático, no descarta la sesión guardada por tiempo y no
 * muestra el aviso de caducidad, de modo que un F5 tampoco obliga a loguearse.
 *
 * Es seguro porque el `token` que emite el API no viaja a ningún endpoint: las
 * capas, fichas y consultas restringidas se resuelven con peticiones públicas y
 * el front solo usa `isAuthenticated` para mostrarlas, así que el `exp` del JWT
 * (60 minutos) no limita el uso del visor. Si en el futuro se consumen
 * endpoints que validen ese token, habrá que acotar la sesión otra vez (o pedir
 * al API un refresh del token) antes de dejarla sin caducidad.
 *
 * Con `true` se restaura el comportamiento anterior: aviso 2 minutos antes,
 * cierre automático al vencer y sesión prorrogable cuando la caducidad la
 * calcula el front (respuestas sin token).
 */
const SESION_CADUCA = false;

/**
 * Códigos de `codigoRespuesta` con los que el API confirma la autenticación.
 * Verificado contra el API de integración (`ADMIN` / `123456` con
 * `codigoSistema: "010004"`): HTTP 200 con `codigoRespuesta: "00"`,
 * `mensajeRespuesta: "Autenticacion exitosa"`, `token` (JWT HS256 de 60
 * minutos), `informacionUsuario`, 56 páginas y 174 controles.
 * Con credenciales inválidas responde `ERR-999` con el detalle de Oracle
 * ("USUARIO NO EXISTE" / "CONTRASEÑA INCORRECTA").
 */
const CODIGOS_EXITO_SESION = new Set(['00', '0', 'OK']);

/**
 * Código, sin mensaje, que devuelve el API cuando autentica al usuario pero no
 * puede armar la sesión (caso comprobado: `codigoSistema` no registrado): llega
 * sin token, sin usuario y sin permisos, por lo que NO debe abrir sesión.
 */
const CODIGO_SIN_SESION = '99';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly http = inject(HttpClient);

  /**
   * `AuditoriaService` se resuelve de forma **perezosa** (y no con `inject`)
   * porque depende de esta clase para leer el usuario: inyectarlo aquí crearía
   * un ciclo de dependencias. Se pide al `Injector` en el momento de auditar,
   * cuando ambos servicios ya están construidos.
   */
  private readonly injector = inject(Injector);

  /** Servicio de auditoría, resuelto bajo demanda. */
  private get auditoria(): AuditoriaService {
    return this.injector.get(AuditoriaService);
  }

  /**
   * Indica si la caducidad de la sesión la impuso el API (emitió `token`): el
   * vencimiento es el del propio JWT y el front NO puede prorrogarlo. Si es
   * `false` (respuestas sin token), la caducidad la calculó el front con
   * `MINUTOS_SESION_POR_DEFECTO` y el usuario puede extender la sesión.
   */
  private readonly caducidadPorApi = signal(false);

  // --- Estado de sesión expuesto a la aplicación (signals) -----------------

  /** `true` cuando hay una sesión válida (abre las opciones restringidas). */
  public isAuthenticated = signal<boolean>(false);

  /**
   * Nombre a mostrar en la cabecera: `nombres` del usuario autenticado y, si
   * el API no lo informa, su `codigoUsuario` (compatibilidad con la UI actual).
   */
  public userName = signal<string>('');

  /** Código de usuario (login) con el que se inició sesión. */
  public codigoUsuario = signal<string | null>(null);

  /** Token de sesión devuelto por el API (`token`); `null` si no se informó. */
  public token = signal<string | null>(null);

  /** Información personal del usuario autenticado. */
  public usuario = signal<UsuarioSesion | null>(null);

  /** Páginas/opciones de menú autorizadas para el usuario. */
  public paginas = signal<PaginaAutorizada[]>([]);

  /** Controles (acciones) autorizados para el usuario. */
  public controles = signal<ControlAutorizado[]>([]);

  /**
   * Momento (epoch ms) en que el API declara caducada la sesión; `null` si no
   * hay sesión. Con `SESION_CADUCA = false` es informativo: el visor mantiene la
   * sesión abierta hasta el logout o el cierre de la pestaña.
   */
  public expiraEn = signal<number | null>(null);

  /** Rol del usuario autenticado (`codigoRol`). */
  public codigoRol = computed<string | null>(() => this.usuario()?.codigoRol ?? null);

  /**
   * `true` mientras se avisa al usuario de que su sesión está por expirar
   * (últimos `AVISO_EXPIRACION_MS`). El visor muestra entonces la notificación
   * con la cuenta atrás y el botón "Extender sesión".
   *
   * Con `SESION_CADUCA = false` nunca se activa.
   */
  public sesionPorExpirar = signal(false);

  /** Cuenta atrás de la sesión en segundos, mientras el aviso está activo. */
  public segundosRestantes = signal<number | null>(null);

  /**
   * `true` cuando la sesión se cerró sola por caducidad (no por un logout
   * manual). El visor lo usa para explicar al usuario por qué perdió el acceso
   * a las capas, consultas y controles restringidos.
   *
   * Con `SESION_CADUCA = false` nunca se activa: la sesión solo termina cuando
   * el usuario cierra sesión.
   */
  public sesionExpirada = signal(false);

  /** Cuenta atrás formateada (`m:ss`) para la notificación de sesión. */
  public cuentaAtras = computed<string>(() => {
    const segundos = this.segundosRestantes();
    if (segundos === null) return '';
    const minutos = Math.floor(segundos / 60);
    return `${minutos}:${String(segundos % 60).padStart(2, '0')}`;
  });

  /**
   * `true` si el usuario puede prorrogar la sesión. Solo es posible cuando la
   * caducidad la calculó el front (el API no emitió token propio); si el API
   * fijó el vencimiento, hace falta un token nuevo emitido por el API.
   *
   * Con `SESION_CADUCA = false` no se usa: la sesión no vence y
   * `extenderSesion()` no hace nada.
   */
  public puedeExtenderSesion = computed<boolean>(() => !this.caducidadPorApi());

  /** Temporizador que cierra la sesión al cumplirse `expiraEn`. */
  private timerCaducidad: ReturnType<typeof setTimeout> | null = null;
  /** Temporizador que abre el aviso previo a la caducidad. */
  private timerAviso: ReturnType<typeof setTimeout> | null = null;
  /** Intervalo que mantiene al día la cuenta atrás mostrada en el aviso. */
  private intervaloCuentaAtras: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Restaura la sesión de la pestaña actual (recarga con F5) si sigue vigente.
    this.restaurarSesion();
  }

  // --- API pública ---------------------------------------------------------

  /**
   * Inicia sesión contra `POST /api/seguridad/auth/iniciar-sesion` y guarda la
   * sesión (token, usuario, páginas y controles autorizados).
   *
   * Notas del contrato real del API (`BeLoginEntrada` / `BeLoginSalida`):
   *  - el cuerpo va como `application/x-www-form-urlencoded` (el endpoint
   *    también acepta JSON);
   *  - los campos obligatorios son `codigoUsuario`, `contrasena` y
   *    `codigoSistema`, y el código de sistema DEBE estar registrado en el API
   *    (ver `environment.codigoSistema`);
   *  - en caso de error responde HTTP 200 con `codigoRespuesta: "ERR-..."` (o
   *    `"99"` sin sesión) y el detalle en `mensajeRespuesta`, por lo que el
   *    error se valida en el body.
   *
   * @param codigoUsuario Usuario (código) ingresado en el formulario.
   * @param contrasena Contraseña ingresada.
   * @param codigoSistema Código del sistema (por defecto el del Geovisor).
   * @returns Observable con la información del usuario autenticado.
   */
  iniciarSesion(
    codigoUsuario: string,
    contrasena: string,
    codigoSistema: string = environment.codigoSistema
  ): Observable<UsuarioSesion> {
    const url = `${environment.seguridadApiUrl}/auth/iniciar-sesion`;
    const cuerpo = new HttpParams()
      .set('codigoUsuario', codigoUsuario)
      .set('contrasena', contrasena)
      .set('codigoSistema', codigoSistema);
    const cabeceras = new HttpHeaders({ 'Content-Type': 'application/x-www-form-urlencoded' });

    return this.http.post<LoginRespuesta>(url, cuerpo.toString(), { headers: cabeceras }).pipe(
      timeout(TIEMPO_MAXIMO_MS),
      map(respuesta => {
        if (!this.esRespuestaExitosa(respuesta)) {
          throw new ErrorAutenticacion(
            respuesta?.codigoRespuesta ?? '',
            AuthService.mensajeDeError(respuesta)
          );
        }
        // Si el API emite el token pero omite `informacionUsuario`, la sesión se
        // identifica con el usuario que se escribió en el formulario.
        const informacion: UsuarioSesion = respuesta.informacionUsuario ?? {
          codigoUsuario,
          nombres: '',
          correoElectronico: '',
          codigoRol: ''
        };
        this.guardarSesion(respuesta, informacion.codigoUsuario || codigoUsuario);
        this.auditoria.accion(
          AUDITORIA_OPCIONES.SESION,
          `Inicio de sesión de ${informacion.codigoUsuario || codigoUsuario}`,
          { conexionNombre: 'ORACLE' }
        );
        return informacion;
      }),
      catchError(error => {
        const fallo = AuthService.normalizarError(error);
        this.auditoria.error(
          AUDITORIA_OPCIONES.SESION,
          `Fallo al iniciar sesión de ${codigoUsuario}: ${fallo.message}`,
          { conexionNombre: 'ORACLE' },
          fallo.codigo || 'ERR-SESION'
        );
        return throwError(() => fallo);
      })
    );
  }

  /**
   * Cierra la sesión: limpia el estado en memoria y la sesión persistida.
   * Es un cierre voluntario, por eso NO deja activo el aviso de sesión
   * caducada (`sesionExpirada`).
   */
  logout(): void {
    // Se audita antes de limpiar: después, `codigoUsuario()` ya está vacío.
    this.auditoria.accion(AUDITORIA_OPCIONES.SESION, 'Cierre de sesión voluntario', {
      conexionNombre: 'ORACLE',
    });
    this.limpiarSesion();
    this.sesionExpirada.set(false);
  }

  /**
   * Prorroga la sesión actual: reinicia la caducidad local desde este momento
   * (`MINUTOS_SESION_POR_DEFECTO`). Solo aplica cuando la caducidad la calculó
   * el front (`puedeExtenderSesion`); si el vencimiento lo impuso el API, la
   * sesión no se puede extender desde el cliente.
   *
   * Se expone al visor para el botón "Extender sesión" del aviso de caducidad.
   *
   * Con `SESION_CADUCA = false` no hay nada que prorrogar: no hace nada.
   */
  extenderSesion(): void {
    if (!SESION_CADUCA) return;
    if (!this.isAuthenticated() || !this.puedeExtenderSesion()) return;
    const expiraEn = Date.now() + MINUTOS_SESION_POR_DEFECTO * 60_000;
    this.expiraEn.set(expiraEn);
    this.persistirSesion();
    // Rearma la caducidad (y el aviso previo) con el tiempo renovado.
    this.programarCaducidad(expiraEn);
  }

  /**
   * Descarta la notificación de sesión (botón de cierre del aviso). No modifica
   * el estado de la sesión: solo oculta el aviso hasta la próxima caducidad.
   */
  descartarAvisoSesion(): void {
    this.sesionPorExpirar.set(false);
    this.sesionExpirada.set(false);
    this.segundosRestantes.set(null);
  }

  /** Token de sesión actual (para futuras llamadas autenticadas al API). */
  getToken(): string | null {
    return this.token();
  }

  /**
   * Indica si el usuario tiene autorizado un control (acción/botón) del API.
   * @param codigoControl Código del control (`BeControlAutorizado.codigoControl`).
   */
  tieneControl(codigoControl: string): boolean {
    const control = this.controles().find(c => c.codigoControl === codigoControl);
    return !!control && control.visible !== false;
  }

  // --- Persistencia y estado de la sesión ----------------------------------

  /**
   * Guarda la sesión devuelta por el API: estado en memoria (signals) y copia
   * en `sessionStorage` para que un F5 no obligue a loguearse otra vez.
   *
   * Caducidad: manda el `exp` del JWT que emite el API —es lo que valida el
   * servidor— y, si no se puede leer, `tokenExpiraEnMinutos`. Cuando el API no
   * emite token, la caducidad la calcula el front con
   * `MINUTOS_SESION_POR_DEFECTO` y el usuario puede prorrogarla.
   *
   * @param respuesta Cuerpo devuelto por `iniciar-sesion`.
   * @param codigoUsuarioIngresado Usuario escrito en el formulario; se usa
   * cuando el API no devuelve `informacionUsuario`.
   */
  private guardarSesion(respuesta: LoginRespuesta, codigoUsuarioIngresado: string): void {
    // La sesión la acota el API cuando emite token propio (JWT). Sin token, la
    // caducidad la calcula el front (`MINUTOS_SESION_POR_DEFECTO`) y el usuario
    // puede prorrogarla.
    const token = respuesta.token ?? null;
    const minutosApi = respuesta.tokenExpiraEnMinutos ?? 0;
    const caducidadApi = !!token && minutosApi > 0;
    // Caducidad: manda el `exp` del propio JWT —es lo que valida el servidor— y,
    // si no se puede leer, lo informado en `tokenExpiraEnMinutos`. Con
    // `SESION_CADUCA = false` esta fecha es solo informativa (no cierra nada).
    const expiraEn =
      AuthService.expiracionDelToken(token) ??
      Date.now() + (caducidadApi ? minutosApi : MINUTOS_SESION_POR_DEFECTO) * 60_000;
    const usuario = respuesta.informacionUsuario ?? null;
    const paginas = respuesta.paginas ?? [];
    const controles = respuesta.controles ?? [];
    // Usuario de la sesión: el del API o, si no viene, el del formulario.
    const codigoUsuario = (usuario?.codigoUsuario || codigoUsuarioIngresado || '').trim() || null;

    this.token.set(token);
    this.usuario.set(usuario);
    this.paginas.set(paginas);
    this.controles.set(controles);
    this.expiraEn.set(expiraEn);
    this.codigoUsuario.set(codigoUsuario);
    // Nombre a mostrar: `nombres` del API y, si no lo informa, el usuario.
    this.userName.set((usuario?.nombres || codigoUsuario || '').trim());
    this.isAuthenticated.set(true);
    // Una sesión nueva descarta el aviso de caducidad de la sesión anterior.
    this.sesionExpirada.set(false);
    this.caducidadPorApi.set(caducidadApi);

    this.persistirSesion();
    // Cierra la sesión automáticamente al cumplirse el tiempo de la sesión; el
    // aviso previo (con opción de prorrogar) se programa en el mismo método.
    this.programarCaducidad(expiraEn);
  }

  /**
   * Guarda en `sessionStorage` la sesión vigente (token, caducidad, usuario y
   * permisos) para que un F5 no obligue a loguearse otra vez.
   */
  private persistirSesion(): void {
    const expiraEn = this.expiraEn();
    if (!expiraEn) return;
    const sesion: SesionPersistida = {
      token: this.token() ?? '',
      expiraEn,
      usuario: this.usuario(),
      codigoUsuario: this.codigoUsuario(),
      paginas: this.paginas(),
      controles: this.controles(),
      expiraPorApi: this.caducidadPorApi(),
    };
    try {
      sessionStorage.setItem(CLAVE_SESION, JSON.stringify(sesion));
    } catch {
      // Modo privado o cuota llena: la sesión sigue viva en memoria.
    }
  }

  /**
   * Programa el cierre automático de la sesión cuando se cumple `expiraEn` y,
   * además, el AVISO previo (`AVISO_EXPIRACION_MS` antes) para que el usuario
   * no pierda la sesión sin enterarse. Los retardos se limitan al máximo de
   * `setTimeout` (~24,8 días) para no desbordar el temporizador.
   *
   * Con `SESION_CADUCA = false` no se programa nada: solo se limpian los avisos
   * para que la sesión nunca se cierre por tiempo.
   */
  private programarCaducidad(expiraEn: number | null): void {
    this.cancelarCaducidad();
    this.sesionPorExpirar.set(false);
    this.segundosRestantes.set(null);
    if (!SESION_CADUCA || !expiraEn) return;
    const restante = expiraEn - Date.now();
    if (restante <= 0) return;
    // Aviso previo: si ya está dentro de la ventana, se muestra de inmediato.
    const esperaAviso = Math.min(Math.max(restante - AVISO_EXPIRACION_MS, 0), RETARDO_MAXIMO_MS);
    this.timerAviso = setTimeout(() => {
      this.timerAviso = null;
      this.iniciarAvisoExpiracion(expiraEn);
    }, esperaAviso);
    this.timerCaducidad = setTimeout(() => {
      this.timerCaducidad = null;
      this.expirarSesion();
    }, Math.min(restante, RETARDO_MAXIMO_MS));
  }

  /** Activa el aviso de caducidad y mantiene al día su cuenta atrás. */
  private iniciarAvisoExpiracion(expiraEn: number): void {
    if (!this.isAuthenticated()) return;
    const actualizar = () => {
      const restantes = Math.max(0, Math.ceil((expiraEn - Date.now()) / 1000));
      this.segundosRestantes.set(restantes);
      this.sesionPorExpirar.set(true);
      // Llegado a 0 la cuenta la toma el temporizador de cierre.
      if (restantes === 0) this.detenerCuentaAtras();
    };
    actualizar();
    this.intervaloCuentaAtras = setInterval(actualizar, 1000);
  }

  /** Detiene el intervalo de la cuenta atrás del aviso de caducidad. */
  private detenerCuentaAtras(): void {
    if (this.intervaloCuentaAtras !== null) {
      clearInterval(this.intervaloCuentaAtras);
      this.intervaloCuentaAtras = null;
    }
  }

  /**
   * Cierra la sesión por caducidad y deja activo `sesionExpirada` para que el
   * visor explique al usuario qué ocurrió (antes se cerraba en silencio).
   *
   * Con `SESION_CADUCA = false` no se invoca: la sesión solo se cierra con
   * `logout()`.
   */
  private expirarSesion(): void {
    if (!this.isAuthenticated()) return;
    this.auditoria.accion(AUDITORIA_OPCIONES.SESION_EXPIRADA, 'La sesión expiró por tiempo', {
      conexionNombre: 'ORACLE',
    });
    this.limpiarSesion();
    this.sesionExpirada.set(true);
  }

  /** Cancela los temporizadores de caducidad, aviso y cuenta atrás. */
  private cancelarCaducidad(): void {
    if (this.timerCaducidad !== null) {
      clearTimeout(this.timerCaducidad);
      this.timerCaducidad = null;
    }
    if (this.timerAviso !== null) {
      clearTimeout(this.timerAviso);
      this.timerAviso = null;
    }
    this.detenerCuentaAtras();
  }

  /**
   * Limpia el estado de sesión (memoria + `sessionStorage`) y los avisos de
   * caducidad. `sesionExpirada` NO se toca aquí: lo fija quien cierra la sesión
   * (`expirarSesion`) o el propio usuario (`descartarAvisoSesion`).
   */
  private limpiarSesion(): void {
    // Sin esto, un temporizador programado antes del logout seguiría vivo y
    // podría cerrar una sesión nueva abierta poco después.
    this.cancelarCaducidad();
    this.token.set(null);
    this.usuario.set(null);
    this.paginas.set([]);
    this.controles.set([]);
    this.expiraEn.set(null);
    this.codigoUsuario.set(null);
    this.userName.set('');
    this.isAuthenticated.set(false);
    this.caducidadPorApi.set(false);
    this.sesionPorExpirar.set(false);
    this.segundosRestantes.set(null);
    try {
      sessionStorage.removeItem(CLAVE_SESION);
    } catch {
      // Sin acceso a sessionStorage: no hay nada que limpiar.
    }
  }

  /**
   * Restaura la sesión persistida al arrancar el servicio (recarga de la página
   * o F5). Con `SESION_CADUCA = true` solo se reanuda si no ha caducado según
   * `expiraEn`; si la sesión guardada YA había caducado se limpia y se activa
   * `sesionExpirada`, de modo que el visor explique al usuario por qué quedó sin
   * acceso (antes se cerraba en silencio). Con `SESION_CADUCA = false` se reanuda
   * siempre, aunque el JWT del API haya vencido, porque el visor no lo valida.
   */
  private restaurarSesion(): void {
    let sesion: SesionPersistida | null = null;
    try {
      const crudo = sessionStorage.getItem(CLAVE_SESION);
      sesion = crudo ? (JSON.parse(crudo) as SesionPersistida) : null;
    } catch {
      sesion = null;
    }
    if (!sesion) {
      this.limpiarSesion();
      return;
    }
    if (SESION_CADUCA && (!sesion.expiraEn || sesion.expiraEn <= Date.now())) {
      this.limpiarSesion();
      this.sesionExpirada.set(true);
      return;
    }
    this.token.set(sesion.token || null);
    this.usuario.set(sesion.usuario ?? null);
    this.paginas.set(sesion.paginas ?? []);
    this.controles.set(sesion.controles ?? []);
    this.expiraEn.set(sesion.expiraEn ?? null);
    // El usuario puede venir solo en `codigoUsuario` (respuestas del API sin
    // `informacionUsuario`), por eso se consultan ambas fuentes.
    const codigoUsuario = sesion.usuario?.codigoUsuario || sesion.codigoUsuario || '';
    this.codigoUsuario.set(codigoUsuario || null);
    this.userName.set((sesion.usuario?.nombres || codigoUsuario).trim());
    this.isAuthenticated.set(true);
    // Las sesiones guardadas antes de este cambio no traen `expiraPorApi`: sin
    // token, la caducidad es local y por tanto prorrogable.
    this.caducidadPorApi.set(sesion.expiraPorApi ?? !!sesion.token);
    // Con `SESION_CADUCA = true` reanuda el cierre automático de la sesión (y su
    // aviso previo) al cumplirse el tiempo restante; con `false` no programa nada
    // y la sesión sigue vigente.
    this.programarCaducidad(sesion.expiraEn);
  }

  // --- Validación de la respuesta del API ----------------------------------

  /**
   * El API responde HTTP 200 tanto en éxito como en error, informando el
   * resultado en `codigoRespuesta` (`ERR-###` en los fallos).
   *
   * Solo se abre sesión si el API entrega una sesión utilizable (`token`,
   * `informacionUsuario` o permisos) y el código es de éxito. Antes bastaba con
   * un código "exitoso", así que una respuesta `"99"` con todo vacío —la que
   * devuelve el API cuando el `codigoSistema` no está registrado— dejaba al
   * usuario dentro del visor con una sesión sin token ni permisos que, además,
   * el front cerraba sola minutos después.
   */
  private esRespuestaExitosa(respuesta: LoginRespuesta | null | undefined): boolean {
    if (!respuesta) return false;
    const codigo = (respuesta.codigoRespuesta ?? '').trim().toUpperCase();
    if (codigo.startsWith('ERR')) return false;
    return AuthService.tieneSesionUtil(respuesta) && (!codigo || CODIGOS_EXITO_SESION.has(codigo));
  }

  /** ¿La respuesta del API trae algo con lo que se pueda abrir sesión? */
  private static tieneSesionUtil(respuesta: LoginRespuesta): boolean {
    return !!respuesta.token
      || !!respuesta.informacionUsuario
      || !!respuesta.paginas?.length
      || !!respuesta.controles?.length;
  }

  /**
   * Caducidad (epoch ms) declarada dentro del JWT (`exp`), si se puede leer. Es
   * la fuente más fiable porque es la que usa el API para rechazar el token.
   * Devuelve `null` si el token no es un JWT de tres partes o no trae `exp`.
   */
  private static expiracionDelToken(token: string | null): number | null {
    if (!token) return null;
    const partes = token.split('.');
    if (partes.length !== 3) return null;
    try {
      const payload = JSON.parse(atob(partes[1].replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: number };
      return typeof payload?.exp === 'number' ? payload.exp * 1000 : null;
    } catch {
      return null;
    }
  }

  /**
   * Traduce el `mensajeRespuesta` del API (que puede incluir el volcado de una
   * excepción de Oracle) a un texto corto y entendible para el usuario.
   */
  private static mensajeDeError(respuesta: LoginRespuesta | null | undefined): string {
    // Los mensajes del API traen saltos de línea y trazas ORA-06512.
    const crudo = (respuesta?.mensajeRespuesta ?? '').replace(/\s+/g, ' ').trim();
    const codigo = respuesta?.codigoRespuesta ?? '';

    if (codigo === CODIGO_SIN_SESION) {
      return 'El servicio de seguridad no devolvió la sesión (código 99): el código de sistema del visor no está registrado en el API de Seguridad.';
    }
    if (/NO EXISTE|CREDENCIAL|USUARIO O CLAVE/i.test(crudo)) {
      return 'El usuario o la contraseña son incorrectos.';
    }
    if (/BLOQUE/i.test(crudo)) {
      return 'El usuario está bloqueado. Comuníquese con el administrador del sistema.';
    }
    if (/CONTRASE|CLAVE/i.test(crudo)) {
      return 'La contraseña ingresada es incorrecta.';
    }
    if (/SISTEMA/i.test(crudo) && /(NO|SIN)\b/i.test(crudo)) {
      return 'El usuario no tiene acceso al sistema Geovisor.';
    }
    if (crudo) return crudo;
    return codigo === 'ERR-999'
      ? 'No se pudo validar las credenciales. Intente nuevamente.'
      : 'No se pudo iniciar sesión. Intente nuevamente.';
  }

  /**
   * Convierte cualquier fallo (HTTP, timeout, red) en `ErrorAutenticacion` con
   * un mensaje apto para mostrar en el modal de login.
   */
  private static normalizarError(error: unknown): ErrorAutenticacion {
    if (error instanceof ErrorAutenticacion) return error;

    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        return new ErrorAutenticacion('ERR-RED', 'No se pudo conectar con el servicio de seguridad. Verifique su conexión.');
      }
      if (error.status === 401 || error.status === 403) {
        return new ErrorAutenticacion('ERR-AUT', 'Las credenciales ingresadas no son válidas.');
      }
      if (error.status === 404) {
        return new ErrorAutenticacion('ERR-404', 'El servicio de seguridad no está disponible (404).');
      }
      return new ErrorAutenticacion(`ERR-${error.status}`, `Error del servicio de seguridad (${error.status}). Intente nuevamente.`);
    }

    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'Timeout')) {
      return new ErrorAutenticacion('ERR-TIEMPO', 'El servicio de seguridad no respondió a tiempo. Intente nuevamente.');
    }

    return new ErrorAutenticacion('ERR-DESCONOCIDO', 'Ocurrió un error inesperado al iniciar sesión.');
  }
}
