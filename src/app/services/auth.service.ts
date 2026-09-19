import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, catchError, map, throwError, timeout } from 'rxjs';
import { environment } from '../../environments/environment';

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
  /** Momento (epoch ms) en que caduca la sesión según `tokenExpiraEnMinutos`. */
  expiraEn: number;
  usuario: UsuarioSesion | null;
  /**
   * Usuario (login) con el que se abrió la sesión. Se conserva aparte porque
   * hay respuestas del API que no incluyen `informacionUsuario`.
   */
  codigoUsuario: string | null;
  paginas: PaginaAutorizada[];
  controles: ControlAutorizado[];
}

/** Clave de `sessionStorage` donde se conserva la sesión del Geovisor. */
const CLAVE_SESION = 'gmsi_sesion_geovisor';
/** Minutos de sesión cuando el API no informa `tokenExpiraEnMinutos`. */
const MINUTOS_SESION_POR_DEFECTO = 30;
/** Tiempo máximo de espera de la respuesta del API de seguridad (ms). */
const TIEMPO_MAXIMO_MS = 20000;

/**
 * Códigos de `codigoRespuesta` que el API devuelve cuando las credenciales son
 * válidas. Verificado contra el API de pruebas con `ADMIN` / `123456`:
 * el procedimiento `MSICAS.PKGCAS_LOGIN` valida usuario y contraseña y el API
 * responde HTTP 200 con `codigoRespuesta: "99"`, `mensajeRespuesta: ""`,
 * `token` nulo y sin páginas ni controles (esa parte del servicio aún no está
 * implementada; el endpoint de auditoría del mismo módulo también falla con
 * "el componente 'PS_LISTARAUDITORIA' se debe declarar").
 * Con credenciales inválidas el API responde `ERR-999` con el detalle de Oracle
 * ("USUARIO NO EXISTE" / "CONTRASEÑA INCORRECTA").
 */
const CODIGOS_EXITO_SESION = new Set(['99', '00', '0', 'OK']);

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly http = inject(HttpClient);

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

  /** Momento (epoch ms) en que caduca la sesión; `null` si no hay sesión. */
  public expiraEn = signal<number | null>(null);

  /** Rol del usuario autenticado (`codigoRol`). */
  public codigoRol = computed<string | null>(() => this.usuario()?.codigoRol ?? null);

  /** Temporizador que cierra la sesión al cumplirse `expiraEn`. */
  private timerCaducidad: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Restaura la sesión de la pestaña actual (recarga con F5) si sigue vigente.
    this.restaurarSesion();
  }

  // --- API pública ---------------------------------------------------------

  /**
   * Inicia sesión contra `POST /api/seguridad/auth/iniciar-sesion` y guarda la
   * sesión (token, usuario, páginas y controles autorizados).
   *
   * Notas del contrato real del API:
   *  - el cuerpo debe ir como `application/x-www-form-urlencoded` (con JSON el
   *    API responde ERR-999 "Los datos de entrada no pueden ser nulos");
   *  - los campos obligatorios son `codigoUsuario`, `contrasena` y
   *    `codigoSistema`;
   *  - en caso de error responde HTTP 200 con `codigoRespuesta: "ERR-..."` y el
   *    detalle en `mensajeRespuesta`, por lo que el error se valida en el body.
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
        // El API puede validar las credenciales sin devolver `informacionUsuario`
        // (respuesta con `codigoRespuesta: "99"`): en ese caso la sesión se
        // identifica con el usuario que se escribió en el formulario.
        const informacion: UsuarioSesion = respuesta.informacionUsuario ?? {
          codigoUsuario,
          nombres: '',
          correoElectronico: '',
          codigoRol: ''
        };
        this.guardarSesion(respuesta, informacion.codigoUsuario || codigoUsuario);
        return informacion;
      }),
      catchError(error => throwError(() => AuthService.normalizarError(error)))
    );
  }

  /** Cierra la sesión: limpia el estado en memoria y la sesión persistida. */
  logout(): void {
    this.limpiarSesion();
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
   * El `tokenExpiraEnMinutos` del API define la caducidad; si no viene (o llega
   * en 0, como en la respuesta `codigoRespuesta: "99"`), se usa
   * `MINUTOS_SESION_POR_DEFECTO`.
   *
   * @param respuesta Cuerpo devuelto por `iniciar-sesion`.
   * @param codigoUsuarioIngresado Usuario escrito en el formulario; se usa
   * cuando el API no devuelve `informacionUsuario`.
   */
  private guardarSesion(respuesta: LoginRespuesta, codigoUsuarioIngresado: string): void {
    const minutos = respuesta.tokenExpiraEnMinutos && respuesta.tokenExpiraEnMinutos > 0
      ? respuesta.tokenExpiraEnMinutos
      : MINUTOS_SESION_POR_DEFECTO;
    const expiraEn = Date.now() + minutos * 60_000;
    const usuario = respuesta.informacionUsuario ?? null;
    const paginas = respuesta.paginas ?? [];
    const controles = respuesta.controles ?? [];
    const token = respuesta.token ?? null;
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

    const sesion: SesionPersistida = { token: token ?? '', expiraEn, usuario, codigoUsuario, paginas, controles };
    try {
      sessionStorage.setItem(CLAVE_SESION, JSON.stringify(sesion));
    } catch {
      // Modo privado o cuota llena: la sesión sigue viva en memoria.
    }
    // Cierra la sesión automáticamente al cumplirse el tiempo del token.
    this.programarCaducidad(expiraEn);
  }

  /**
   * Programa el cierre automático de la sesión cuando se cumple `expiraEn`
   * (según `tokenExpiraEnMinutos` del API). El retardo se limita al máximo de
   * `setTimeout` (~24,8 días) para no desbordar el temporizador.
   */
  private programarCaducidad(expiraEn: number): void {
    this.cancelarCaducidad();
    const restante = expiraEn - Date.now();
    if (restante <= 0) return;
    this.timerCaducidad = setTimeout(() => {
      this.timerCaducidad = null;
      this.limpiarSesion();
    }, Math.min(restante, 2_147_483_647));
  }

  /** Cancela el temporizador de caducidad de la sesión. */
  private cancelarCaducidad(): void {
    if (this.timerCaducidad !== null) {
      clearTimeout(this.timerCaducidad);
      this.timerCaducidad = null;
    }
  }

  /** Limpia el estado de sesión (memoria + `sessionStorage`). */
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
    try {
      sessionStorage.removeItem(CLAVE_SESION);
    } catch {
      // Sin acceso a sessionStorage: no hay nada que limpiar.
    }
  }

  /**
   * Restaura la sesión persistida al arrancar el servicio (recarga de la
   * página) siempre que no haya caducado según `expiraEn`.
   */
  private restaurarSesion(): void {
    let sesion: SesionPersistida | null = null;
    try {
      const crudo = sessionStorage.getItem(CLAVE_SESION);
      sesion = crudo ? (JSON.parse(crudo) as SesionPersistida) : null;
    } catch {
      sesion = null;
    }
    if (!sesion || !sesion.expiraEn || sesion.expiraEn <= Date.now()) {
      this.limpiarSesion();
      return;
    }
    this.token.set(sesion.token || null);
    this.usuario.set(sesion.usuario ?? null);
    this.paginas.set(sesion.paginas ?? []);
    this.controles.set(sesion.controles ?? []);
    this.expiraEn.set(sesion.expiraEn);
    // El usuario puede venir solo en `codigoUsuario` (respuestas del API sin
    // `informacionUsuario`), por eso se consultan ambas fuentes.
    const codigoUsuario = sesion.usuario?.codigoUsuario || sesion.codigoUsuario || '';
    this.codigoUsuario.set(codigoUsuario || null);
    this.userName.set((sesion.usuario?.nombres || codigoUsuario).trim());
    this.isAuthenticated.set(true);
    // Reanuda el cierre automático de la sesión al cumplirse el tiempo restante.
    this.programarCaducidad(sesion.expiraEn);
  }

  // --- Validación de la respuesta del API ----------------------------------

  /**
   * El API responde HTTP 200 tanto en éxito como en error, informando el fallo
   * en `codigoRespuesta` (`ERR-###`).
   *
   * Se considera sesión válida cuando:
   *  - llega `token` o `informacionUsuario` (contrato completo), o
   *  - el código de respuesta pertenece a `CODIGOS_EXITO_SESION`, es decir, el
   *    procedimiento `MSICAS.PKGCAS_LOGIN` validó las credenciales pero el API
   *    todavía no emite token ni permisos.
   */
  private esRespuestaExitosa(respuesta: LoginRespuesta | null | undefined): boolean {
    if (!respuesta) return false;
    const codigo = (respuesta.codigoRespuesta ?? '').trim().toUpperCase();
    if (codigo.startsWith('ERR')) return false;
    if (respuesta.token || respuesta.informacionUsuario) return true;
    return CODIGOS_EXITO_SESION.has(codigo);
  }

  /**
   * Traduce el `mensajeRespuesta` del API (que puede incluir el volcado de una
   * excepción de Oracle) a un texto corto y entendible para el usuario.
   */
  private static mensajeDeError(respuesta: LoginRespuesta | null | undefined): string {
    // Los mensajes del API traen saltos de línea y trazas ORA-06512.
    const crudo = (respuesta?.mensajeRespuesta ?? '').replace(/\s+/g, ' ').trim();
    const codigo = respuesta?.codigoRespuesta ?? '';

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
