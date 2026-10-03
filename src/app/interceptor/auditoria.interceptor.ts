import { HttpContext, HttpContextToken, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, tap, throwError } from 'rxjs';

import { environment } from '../../environments/environment';
import { AUDITORIA_OPCIONES, AuditoriaService } from '../services/auditoria.service';

/* ---------------------------------------------------------------------------
 * INTERCEPTOR DE AUDITORÍA DEL VISOR
 *
 * Registra en `mdsisicu.sicu_logmensajes` (vía `POST /api/seguridad/auditoria/
 * registrar`) las consultas que el visor hace por `HttpClient`, con su duración
 * real en `dectiempo` y su resultado en `vchcodmensaje`:
 *
 *   - respuesta correcta  -> `codigoMensaje: "00"` y el mensaje del servicio;
 *   - error HTTP o de red -> `codigoMensaje: "ERR-<status>"` y el motivo.
 *
 * Cubre DOS backends, porque el visor consulta a los dos:
 *
 *   1. WSGEOVISOR (`/WSGEOVISOR/api/...`): módulo `geovisor` (búsquedas por CUC,
 *      titular, código predial, vías) y `seguridad` (login y auditoría).
 *   2. GeoServer por OWS (`.../ows`, consultas WFS GetFeature): búsquedas por
 *      **código catastral**, **parques**, **habilitaciones urbanas**, manzanas y
 *      lotes urbanos, y resolución de geometrías. Van por `HttpClient`, así que
 *      este interceptor sí las ve.
 *
 * Lo que NO pasa por aquí: las imágenes de teselas WMS, que OpenLayers pide con
 * el `Image` del navegador (`ImageWMS`) y nunca por `HttpClient`. Esas se
 * auditan en `MapService.addWmsLayer`, donde el visor abre la conexión con la capa.
 *
 * Dos rutas quedan FUERA del interceptor, porque ya se auditan en el sitio
 * correcto y aquí solo producirían un registro duplicado o sin atribución:
 *
 *  - la propia auditoría (`/seguridad/auditoria/`), que si no dispararía otra
 *    auditoría y provocaría un bucle infinito de peticiones;
 *  - el login (`/seguridad/auth/`), que emite `AuthService.iniciarSesion` con
 *    `opcion: SESION` DESPUÉS de guardar la sesión, con el usuario y el token ya
 *    disponibles. Aquí el `tap` correría antes de que existieran.
 * ------------------------------------------------------------------------- */

/**
 * Prefijo del API que se audita: todo lo que cuelgue de `/WSGEOVISOR/api/`
 * (los módulos `geovisor` y `seguridad`).
 *
 * Se deriva de `environment.geovisorApiUrl` quitando el módulo completo
 * (`'/api/geovisor'`), y no de `seguridadApiUrl` quitando solo `'/seguridad'`.
 * El motivo es que ambas rutas dejan el mismo prefijo de la APLICACIÓN
 * (`/WSGEOVISOR`), no el del API:
 *
 *   '/WSGEOVISOR/api/geovisor'  → quita '/api/geovisor'  → '/WSGEOVISOR'  ✔
 *   '/WSGEOVISOR/api/seguridad' → quita '/seguridad'     → '/WSGEOVISOR/api' ✘
 *
 * Con la segunda variante, comparando con `${PREFIJO}/api/` se buscaría
 * `/WSGEOVISOR/api/api/`, una ruta inexistente: el filtro no coincidía nunca
 * y ninguna petición llegaba a registrarse.
 */
const PREFIJO_API = environment.geovisorApiUrl.replace(/\/api\/geovisor$/, '');

/** Sufijo de las rutas del API que se auditan. */
const SUFIJO_API = '/api/';

/**
 * Endpoint OWS de GeoServer (`.../WEB_GIS/ows`), donde el visor hace las
 * consultas WFS `GetFeature` de las búsquedas cartográficas.
 */
const URL_OWS = environment.geoserver.owsUrl;

/** Parámetros de la petición como cadena, o cadena vacía si no lleva ninguno. */
function parametrosDe(req: { params: { toString(): string } }): string {
  return req.params.toString();
}

/**
 * Marca una petición que NO debe entrar en la auditoría.
 *
 * Se usa para el autocompletado de los buscadores (parques, habilitaciones):
 * ahí el usuario va escribiendo y cada pausa de 300 ms lanza una consulta
 * (`debounceTime` + `switchMap`). Esas consultas parciales —"E", "El", "El O"— no
 * son búsquedas reales, solo el texto que se va tecleando, y llenaban la tabla
 * deruido. La búsqueda definitiva, la que el usuario confirma, sí se registra.
 */
export const SIN_AUDITORIA = new HttpContextToken<boolean>(() => false);

/**
 * Detecta una consulta OGC a GeoServer y extrae qué se pidió: el tipo de
 * servicio (WFS/WMS) y la capa consultada, que es lo que identifica la búsqueda
 * (código catastral, parque, habilitación, manzana…).
 *
 * GeoServer compone estos parámetros en la URL porque `MapService` los pasa con
 * `HttpParams`, así que llegan en la query.
 */
function datosOgcs(url: string, params: string): { capa: string; consulta: string } | null {
  if (!url.startsWith(URL_OWS)) return null;
  const busqueda = new URLSearchParams(params);
  const capa = busqueda.get('typeName') ?? busqueda.get('layers') ?? '';
  const consulta = busqueda.get('cql_filter') ?? busqueda.get('request') ?? '';
  return { capa, consulta };
}

/**
 * Interceptor funcional que audita las consultas del visor por `HttpClient`:
 * las del API del WSGEOVISOR (`/WSGEOVISOR/api/...`) y las de GeoServer por OWS
 * (`.../ows`, WFS GetFeature) que usan las búsquedas por código catastral,
 * parques, habilitaciones, manzanas y lotes urbanos.
 *
 * Se registra en `app.config.ts` with
 * `provideHttpClient(withInterceptors([auditoriaInterceptor]))`.
 */
export const auditoriaInterceptor: HttpInterceptorFn = (req, next) => {
  // Petición marcada como ruido (autocompletado): pasa sin registrarse.
  if (req.context.get(SIN_AUDITORIA)) return next(req);

  const esApi = req.url.startsWith(`${PREFIJO_API}${SUFIJO_API}`);
  const ogcs = esApi ? null : datosOgcs(req.url, parametrosDe(req));
  if (!esApi && !ogcs) return next(req);
  // La auditoría no se audita a sí misma (si no, cada registro generaría otro).
  if (req.url.startsWith(`${environment.seguridadApiUrl}/auditoria/`)) return next(req);
  // El login tampoco pasa por aquí: `AuthService.iniciarSesion` ya emite su
  // propio evento `SESION` con el usuario correcto. El interceptor lo registraría
  // ADEMÁS y en el momento equivocado: su `tap` corre antes del `map` que
  // llama a `guardarSesion()`, así que todavía no hay `codigoUsuario` ni token,
  // y esa fila se guardaría como ANONIMO/visitante anónimo. Con la exclusión el
  // login deja un solo registro, ya con el login del usuario.
  if (req.url.startsWith(`${environment.seguridadApiUrl}/auth/`)) return next(req);

  const auditoria = inject(AuditoriaService);
  const inicio = performance.now();
  /** Conexión y opción del catálogo según el backend atendido. */
  const conexionNombre = esApi ? 'REST' : 'GEOSERVER';
  const opcion = esApi ? AUDITORIA_OPCIONES.CONSULTA_GEOVISOR : AUDITORIA_OPCIONES.CONSULTA_GEOSERVER;
  const contexto = { conexionNombre: conexionNombre as 'REST' | 'GEOSERVER', tiempoMs: performance.now() - inicio };

  /** Detalle legible: método, endpoint y parámetros (o capa y filtro OGC). */
  const detalle = esApi
    ? `${req.method} ${req.url.replace(`${PREFIJO_API}${SUFIJO_API}`, '')}${
        parametrosDe(req) ? ` ${parametrosDe(req)}` : ''
      }`
    : `WFS capa="${ogcs?.capa || '(sin capa)'}" filtro=${ogcs?.consulta || '(sin filtro)'}`;

  return next(req).pipe(
    tap(respuesta => {
      // El API responde HTTP 200 también ante errores de negocio: el resultado
      // real va en `codigoRespuesta` del cuerpo (BeBaseRespuesta).
      const cuerpo = respuesta as { codigoRespuesta?: string; mensajeRespuesta?: string };
      const codigo = cuerpo?.codigoRespuesta ?? '';
      const ok = !codigo || codigo === '00';

      if (ok) {
        auditoria.accion(opcion, `${detalle} ${cuerpo?.mensajeRespuesta ?? ''}`.trim(), contexto);
      } else {
        auditoria.error(opcion, `${detalle} ${cuerpo.mensajeRespuesta ?? ''}`.trim(), contexto, codigo);
      }
    }),
    catchError((fallo: unknown) => {
      const status = (fallo as { status?: number })?.status;
      // 0 = no hubo respuesta (DNS caído, sin red, CORS); se marca como RED.
      const codigo = status ? `ERR-${status}` : 'ERR-RED';
      auditoria.error(
        opcion,
        `${detalle} → ${(fallo as { message?: string })?.message ?? 'sin respuesta'}`,
        { conexionNombre: conexionNombre as 'REST' | 'GEOSERVER', tiempoMs: performance.now() - inicio },
        codigo
      );
      // El error se propaga intacto: auditar no cambia el comportamiento de la app.
      return throwError(() => fallo);
    })
  );
};
