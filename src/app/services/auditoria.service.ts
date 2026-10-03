import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, catchError, map, of, timeout } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

/* ---------------------------------------------------------------------------
 * MÓDULO DE AUDITORÍA DEL API WSGEOVISOR (MSICAS)
 * Fuente: swagger del propio API (`/WSGEOVISOR/swagger/docs/v1`), definiciones
 * BeAuditoriaRegistrarEntrada / BeBaseRespuesta del endpoint
 * `POST /api/seguridad/auditoria/registrar`.
 *
 * A diferencia del resto de endpoints de Seguridad, este NO exige token: es un
 * registro de auditoría de acciones y de fallos de las consultas, así que debe
 * poder escribirse incluso sin sesión y, sobre todo, sin romper el visor.
 * ------------------------------------------------------------------------- */

/** Origen de conexión declarado en `conexionNombre`. */
export type ConexionAuditoria = 'ORACLE' | 'REST' | 'GEOSERVER' | 'DATAGIS' | 'NAVEGADOR';

/**
 * Acción auditada en `opcion`. Catálogo cerrado para que los reportes del API
 * agrupen por una clave conocida y no por el texto libre que envíe cada vista.
 */
export const AUDITORIA_OPCIONES = {
  /** Búsqueda disparada desde el panel de Consultas (por pestaña activa). */
  BUSQUEDA: 'BUSQUEDA',
  /** Impresión de la ficha del lote (generar PDF o enviar a impresora). */
  IMPRESION_FICHA: 'IMPRESION_FICHA',
  /** Activación / desactivación de la visibilidad de una capa. */
  CAPA_VISIBILIDAD: 'CAPA_VISIBILIDAD',
  /** Activación / desactivación de todas las capas de una sección. */
  CAPA_VISIBILIDAD_GRUPADA: 'CAPA_VISIBILIDAD_GRUPADA',
  /** Cambio de opacidad de una capa. */
  CAPA_OPACIDAD: 'CAPA_OPACIDAD',
  /** Inicio o cierre de sesión en el módulo de Seguridad. */
  SESION: 'SESION',
  /** Pérdida de la sesión por caducidad del token. */
  SESION_EXPIRADA: 'SESION_EXPIRADA',
  /** Consulta al API del Geovisor (`/api/geovisor/...`). */
  CONSULTA_GEOVISOR: 'CONSULTA_GEOVISOR',
  /** Fallo local del front (no imputable al API). */
  ERROR_CLIENTE: 'ERROR_CLIENTE',
  /**
   * Entrada al visor como usuario anónimo (sin sesión): la aceptamos cuando el
   * visitante acepta los Términos y Condiciones, que es el momento en que el
   * visor lo deja usar.
   */
  INGRESO_ANONIMO: 'INGRESO_ANONIMO',
  /** Se mostró el modal de Términos y Condiciones. */
  TERMINOS_MOSTRADOS: 'TERMINOS_MOSTRADOS',
  /** El visitante rechazó los términos y salió hacia el portal. */
  TERMINOS_RECHAZADOS: 'TERMINOS_RECHAZADOS',
  /** Petición a un servicio cartográfico de GeoServer (WMS / WFS / WMTS). */
  CONSULTA_GEOSERVER: 'CONSULTA_GEOSERVER',
} as const;

/** Cualquiera de las acciones del catálogo `AUDITORIA_OPCIONES`. */
export type OpcionAuditoria = typeof AUDITORIA_OPCIONES[keyof typeof AUDITORIA_OPCIONES];

/** Cuerpo de `POST /api/seguridad/auditoria/registrar` (`BeAuditoriaRegistrarEntrada`). */
export interface AuditoriaEntrada {
  /** Aplicación cliente que reporta. La completa el servicio si no se informa. */
  aplicacion?: string;
  /** Acción auditada (`opcion`). */
  opcion?: string;
  /** Origen de la conexión (`conexionNombre`). */
  conexionNombre?: string;
  /** Duración de la operación en milisegundos. */
  tiempoMs?: number;
  /** Código del mensaje: `'00'` en éxito, `ERR-...` en fallo. */
  codigoMensaje?: string;
  /** Texto libre del mensaje o error. */
  mensaje?: string;
  /** Login del usuario. La completa el servicio con el de la sesión. */
  codigoUsuario?: string;
  /** Navegador / equipo. La completa el servicio si no se informa. */
  equipo?: string;
  /** Nodo o sesión del cliente (ventana). La completa el servicio si no se informa. */
  nodo?: string;
}

/** Respuesta de `POST /api/seguridad/auditoria/registrar` (`BeBaseRespuesta`). */
export interface AuditoriaRespuesta {
  codigoRespuesta?: string;
  mensajeRespuesta?: string;
}

/** Código con el que el API confirma el registro del evento. */
export const CODIGO_AUDITORIA_OK = '00';
/** Identifica al visor ante el API de auditoría (tabla de aplicaciones). */
const APLICACION_GEOVISOR = 'GEOVISOR_MDSI';
/** Etiqueta de nodo/pestaña del visor cuando no hay almacenamiento disponible. */
const NODO_POR_DEFECTO = 'VISOR';
/** Espera máxima de la respuesta del API de auditoría (ms). */
const TIEMPO_MAXIMO_MS = 5_000;

/**
 * Longitudes máximas de las columnas de `mdsisicu.sicu_logmensajes`, la tabla
 * donde el API materializa cada evento:
 *
 * ```sql
 * CREATE TABLE mdsisicu.sicu_logmensajes (
 *   id_logmensajes uuid DEFAULT gen_random_uuid() NOT NULL,
 *   datfecha date NULL,                    -- la fija el servidor
 *   tmsfecha timestamptz NULL,             -- la fija el servidor
 *   vchaplicacion varchar(20)  NULL,
 *   vchopcion      varchar(100) NULL,
 *   vchconnombre   varchar(100) NULL,
 *   dectiempo      numeric(12, 2) NULL,
 *   vchcodmensaje  varchar(12)  NULL,
 *   vchmensaje     varchar(5000) NULL,
 *   vchcodusuario  varchar(50)  NULL,
 *   vchequipo      varchar(50)  NULL,
 *   vchnodo        varchar(50)  NULL,
 *   CONSTRAINT sicu_logmensajes_pkey PRIMARY KEY (id_logmensajes)
 * );
 * ```
 *
 * `id_logmensajes`, `datfecha` y `tmsfecha` los genera el API (el `uuid` por
 * defecto y la marca de tiempo de inserción), así que el front no los envía.
 *
 * Todo valor se recorta a su columna ANTES de enviarlo: si el API no truncara,
 * un texto largo —el `userAgent` del navegador, por ejemplo, que supera con
 * holgura los 50 caracteres de `vchequipo`— haría fallar la inserción completa.
 */
const LIMITE_CAMPOS = {
  aplicacion: 20,
  opcion: 100,
  conexionNombre: 100,
  codigoMensaje: 12,
  mensaje: 5000,
  codigoUsuario: 50,
  equipo: 50,
  nodo: 50,
} as const;

/** Clave de `sessionStorage` donde se conserva el identificador de la pestaña. */
const CLAVE_NODO = 'gmsi_id_nodo';

/**
 * Identificador de la pestaña: permite distinguir los nodos de un mismo equipo
 * (varias pestañas del visor abierto a la vez). Si `sessionStorage` no está
 * disponible (modo privado) se genera uno en memoria y el nodo queda sin
 * correlación entre recargas, que es un detalle menor frente al evento.
 */
function idNodoDePestana(): string {
  const generado = `NODO-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  try {
    const guardado = sessionStorage.getItem(CLAVE_NODO);
    if (guardado) return guardado;
    sessionStorage.setItem(CLAVE_NODO, generado);
    return generado;
  } catch {
    return generado;
  }
}

const ID_NODO = idNodoDePestana();
/**
 * Servicio de auditoría del Geovisor.
 *
 * Registra en `POST /WSGEOVISOR/api/seguridad/auditoria/registrar` las acciones
 * del usuario y los fallos de las consultas, completando los campos de contexto
 * (aplicación, usuario, equipo y nodo) que el front conoce y el API no envía.
 *
 * Política de errores: la auditoría es **accessoria**, nunca debe romper una
 * acción del visor, por lo que `registrar()` nunca propaga el error — resuelve
 * `false` y deja un aviso en consola. El llamador no necesita `subscribe` con
 * manejadores de error ni un `try/catch`.
 */
@Injectable({
  providedIn: 'root',
})
export class AuditoriaService {
  private readonly http = inject(HttpClient);
  /** Sesión del módulo de Seguridad, para correlacionar el usuario. */
  private readonly authService = inject(AuthService);

  /**
   * Envía un registro de auditoría al API.
   *
   * @param entrada Datos del evento. Los campos ausentes se completan aquí.
   * @returns `true` si el API confirmó el registro (`codigoRespuesta: '00'`).
   */
  registrar(entrada: AuditoriaEntrada): Observable<boolean> {
    const url = `${environment.seguridadApiUrl}/auditoria/registrar`;
    // El endpoint acepta JSON y `x-www-form-urlencoded`; se usa JSON porque
    // `tiempoMs` es numérico y no requiere serializarlo a texto.
    //
    // Se envía además el JWT de sesión en `Authorization`: aunque el swagger no
    // lo documenta, el módulo de Seguridad valida el token en sus endpoints, y
    // es la vía por la que el servidor puede identificar al usuario con
    // certeza en lugar de fiarse del `codigoUsuario` del cuerpo (si este no
    // fuera reconocido, la fila se guardaría como ANONIMO). Enviarlo es
    // inocuo si el API lo ignora y es lo que resuelve el problema si lo usa.
    const token = this.authService.token();
    let cabeceras = new HttpHeaders({ 'Content-Type': 'application/json' });
    if (token) cabeceras = cabeceras.set('Authorization', `Bearer ${token}`);

    return this.http
      .post<AuditoriaRespuesta>(url, this.completarContexto(entrada), { headers: cabeceras })
      .pipe(
        timeout(TIEMPO_MAXIMO_MS),
        map(respuesta => respuesta?.codigoRespuesta === CODIGO_AUDITORIA_OK),
        catchError(error => {
          console.warn('[Auditoría] No se pudo registrar el evento:', entrada?.opcion, error);
          return of(false);
        })
      );
  }

  /**
   * Registra una acción realizada con éxito (fire-and-forget: suscribe aquí, de
   * modo que el llamador no gestiona la suscripción).
   *
   * @param opcion Acción del catálogo `AUDITORIA_OPCIONES`.
   * @param mensaje Detalle legible (búsqueda ejecutada, capa activada…).
   * @param contexto Origen de la conexión y duración, si la acción los midió.
   */
  accion(opcion: OpcionAuditoria, mensaje?: string, contexto?: Partial<AuditoriaEntrada>): void {
    this.registrar({
      ...contexto,
      opcion,
      codigoMensaje: CODIGO_AUDITORIA_OK,
      mensaje,
      conexionNombre: contexto?.conexionNombre ?? 'NAVEGADOR',
    }).subscribe();
  }

  /**
   * Registra un fallo, sea del API, de red o del propio cliente.
   *
   * @param opcion Acción en la que se produjo el fallo.
   * @param mensaje Descripción del error.
   * @param contexto Origen de la conexión y duración acumulada, si se midió.
   * @param codigoMensaje Código del error; por defecto `ERR-GENERICO`.
   */
  error(
    opcion: OpcionAuditoria,
    mensaje: string,
    contexto?: Partial<AuditoriaEntrada>,
    codigoMensaje?: string
  ): void {
    this.registrar({
      ...contexto,
      opcion,
      codigoMensaje: codigoMensaje ?? 'ERR-GENERICO',
      mensaje: mensaje ?? '',
      conexionNombre: contexto?.conexionNombre ?? 'NAVEGADOR',
    }).subscribe();
  }

  /**
   * Ajusta la entrada al formato de `mdsisicu.sicu_logmensajes`:
   *  - `dectiempo` es `numeric(12, 2)`: se envía con dos decimales, nunca entero;
   *  - cada texto se recorta a la longitud de su columna (`varchar(n)`), porque
   *    un valor más largo que la columna haría fallar el INSERT completo;
   *  - los campos ausentes se completan con el contexto que el front conoce
   *    (aplicación, usuario, navegador y nodo) y nunca viajan en `null`.
   */
  private completarContexto(entrada: AuditoriaEntrada): AuditoriaEntrada {
    const recortar = (valor: string, limite: number): string => valor.slice(0, limite);
    const numero = Number(entrada.tiempoMs);
    return {
      aplicacion: recortar(entrada.aplicacion ?? APLICACION_GEOVISOR, LIMITE_CAMPOS.aplicacion),
      opcion: recortar(entrada.opcion ?? '', LIMITE_CAMPOS.opcion),
      conexionNombre: recortar(
        entrada.conexionNombre ?? '',
        LIMITE_CAMPOS.conexionNombre
      ),
      // `dectiempo numeric(12, 2)`: 2 decimales. Un `NaN` se envía como 0 para
      // no generar un INSERT inválido.
      tiempoMs: Number.isFinite(numero) ? Math.round(numero * 100) / 100 : 0,
      codigoMensaje: recortar(entrada.codigoMensaje ?? '', LIMITE_CAMPOS.codigoMensaje),
      mensaje: recortar(entrada.mensaje ?? '', LIMITE_CAMPOS.mensaje),
      // Sin sesión abierta se reporta el usuario vacío: el registro del fallo es
      // justamente lo que interesa cuando el problema es la propia sesión.
      codigoUsuario: recortar(
        entrada.codigoUsuario ?? this.authService.codigoUsuario() ?? '',
        LIMITE_CAMPOS.codigoUsuario
      ),
      equipo: recortar(entrada.equipo ?? this.nombreEquipo(), LIMITE_CAMPOS.equipo),
      nodo: recortar(entrada.nodo ?? (ID_NODO || NODO_POR_DEFECTO), LIMITE_CAMPOS.nodo),
    };
  }

  /** Nombre del navegador (`equipo`), tolerante a entornos sin `navigator`. */
  private nombreEquipo(): string {
    if (typeof navigator === 'undefined') return '';
    return navigator.userAgent ?? '';
  }
}