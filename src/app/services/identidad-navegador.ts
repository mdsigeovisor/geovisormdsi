/* ---------------------------------------------------------------------------
 * IDENTIDAD DEL NAVEGADOR PARA LA AUDITORÍA
 *
 * El negocio necesita que los eventos del usuario ANÓNIMO (el que navega el
 * visor sin haber iniciado sesión, que es el caso por defecto) no queden todos
 * atribuidos a un mismo `ANONIMO` indistinguible entre sí.
 *
 * POR QUÉ NO SE USA EL CORREO DE CHROME
 * -------------------------------------
 * Pedir el correo de la cuenta del navegador es inviable desde una página web:
 *
 *  - `navigator.userAgentData` (Client Hints) NO expone el correo: solo
 *    plataforma, versión, arquitectura y si es móvil;
 *  - `chrome.identity.getProfileUserInfo()` es una API de EXTENSIONES, no de
 *    sitios web;
 *  - la cookie de sesión de Google es `HttpOnly`: `document.cookie` no la ve;
 *  - la única vía para obtener un correo real es OAuth/Google Identity Services,
 *    que exige Client ID configurado, popup de consentimiento del usuario y un
 *    endpoint propio en el backend que valide el token.
 *
 * Además, un identificador automático sin consentimiento tiene problemas de
 * protección de datos. Así que lo que se registra es un identificador técnico
 * y persistente, NO un dato personal: sirve para saber "si el mismo visitante
 * hizo tres búsquedas" o "cuántas veces entró el mismo equipo".
 * ------------------------------------------------------------------------- */

/** Clave de `localStorage` donde se conserva el identificador del visitante. */
const CLAVE_ID_VISITANTE = 'gmsi_id_visitante';

/**
 * Prefijo del identificador anónimo.
 *
 * Es lo que permite distinguir de un vistazo, en `vchcodusuario`, una fila de
 * un visitante sin sesión (`ANON-…`) de una de un usuario real (`ADMIN`), que
 * viaja sin prefijo. Cabe en `vchcodusuario varchar(50)`: 5 + 36 = 41.
 */
const PREFIJO_ANONIMO = 'ANON-';

/** Longitud del `equipo` (`vchequipo varchar(50)`). */
const LIMITE_EQUIPO = 50;

/**
 * Genera un UUID v4 y, si `crypto.randomUUID` no existiera, un identificador
 * con la misma forma a partir de `Math.random` (suficiente para correlacionar
 * eventos de un mismo navegador, que es para lo que sirve).
 */
function generarUuid(): string {
  const api = typeof crypto === 'undefined' ? null : crypto;
  if (api && typeof api.randomUUID === 'function') return api.randomUUID();
  const hex = '0123456789abcdef';
  let uuid = '';
  for (let i = 0; i < 36; i++) {
    // Guiones en las posiciones 8, 13, 18 y 23 del UUID.
    if (i === 8 || i === 13 || i === 18 || i === 23) uuid += '-';
    else uuid += hex[Math.floor(Math.random() * 16)];
  }
  return uuid;
}

/**
 * Identificador persistente del visitante anónimo.
 *
 * Va en `localStorage` (y no en `sessionStorage` como el `nodo`) precisamente
 * para que sobreviva al cierre del navegador: el valor se genera una sola vez y
 * se reutiliza en todas las visitas, que es lo que permite distinguir "el mismo
 * visitante de ayer" de "otro visitante nuevo".
 *
 * Si el almacenamiento no está disponible (modo privado sin cuota, `localStorage`
 * bloqueado por políticas del navegador), se genera uno en memoria: la sesión
 * sigue siendo auditable, solo pierde la correlación entre recargas.
 */
function idVisitanteDe(): string {
  const generado = generarUuid();
  try {
    const guardado = localStorage.getItem(CLAVE_ID_VISITANTE);
    if (guardado) return guardado;
    localStorage.setItem(CLAVE_ID_VISITANTE, generado);
    return generado;
  } catch {
    return generado;
  }
}

/** Identificador del visitante anónimo, prefijado para distinguirlo a simple vista. */
export const ID_VISITANTE = `${PREFIJO_ANONIMO}${idVisitanteDe()}`;

export { PREFIJO_ANONIMO, LIMITE_EQUIPO };

/** Marca de navegador que publica `userAgentData.brands` ("Google Chrome"). */
interface MarcaNavegador {
  brand: string;
  version: string;
}

/**
 * `navigator.userAgentData` (Client Hints) no está en la librería DOM de
 * TypeScript: se declara aquí el usarlo mínimo. Los datos NO contienen el
 * correo del usuario (eso no lo expone ningún navegador, ver cabecera del
 * archivo); solo sirven para describir el equipo.
 */
interface UserAgentData {
  brands?: MarcaNavegador[];
  platform?: string;
}

/** `userAgentData` si el navegador lo publica; `undefined` en el resto. */
function userAgentDataDe(): UserAgentData | undefined {
  if (typeof navigator === 'undefined') return undefined;
  return (navigator as Navigator & { userAgentData?: UserAgentData }).userAgentData;
}

/**
 * Nombre corto del navegador y su versión.
 *
 * Se usa `navigator.userAgentData.brands` cuando existe (Chrome 90+, es la vía
 * estándar y ya viene normalizada por el navegador) y se cae al `userAgent`
 * clásico para el resto.
 */
function navegadorDe(ua: string): string {
  const marcas = userAgentDataDe()?.brands;
  if (Array.isArray(marcas) && marcas.length) {
    // `brands` incluye marcas que no son el navegador real (`"Not A(Brand"`,
    // `"Chromium"`, `"Google Chrome"`), así que se toman solo las del motor.
    const propia = marcas.find(m => /chrom/i.test(m.brand) && !/not a/i.test(m.brand));
    const usada = propia ?? marcas[0];
    const mayor = String(usada.version ?? '').split('.')[0];
    return mayor ? `${usada.brand}/${mayor}` : usada.brand;
  }
  const encontrado = /(Chrome|Chromium|Edg|Firefox|Safari)\/([\d.]+)/.exec(ua);
  return encontrado ? `${encontrado[1]}/${encontrado[2].split('.')[0]}` : 'navegador';
}

/**
 * Sistema operativo, desde `userAgentData.platform` (Chrome: dato síncrono y
 * fiable) o, si no existe, deducido del `userAgent` clásico.
 */
function sistemaOperativoDe(ua: string): string {
  const plataforma = userAgentDataDe()?.platform;
  if (plataforma) {
    return plataforma === 'macOS' ? 'macOS' : plataforma === 'Windows' ? 'Windows' : plataforma;
  }
  if (/Windows NT 10/.test(ua)) return 'Windows 10+';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Android/.test(ua)) return 'Android';
  if (/(iPhone|iPad|iPod)/.test(ua)) return 'iOS';
  if (/Mac OS X/.test(ua)) return 'macOS';
  if (/CrOS/.test(ua)) return 'ChromeOS';
  if (/Linux/.test(ua)) return 'Linux';
  return 'desconocido';
}

/**
 * Zona horaria en formato IANA (`America/Lima`), que ubica al visitante mejor
 * que un offset UTC y cabe en el ancho de la columna. Vacía si no se puede.
 */
function zonaHorariaDe(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    return '';
  }
}

/**
 * Perfil del equipo que se registra en `equipo` (`vchequipo varchar(50)`).
 *
 * Antes de esto se enviaba el `userAgent` recortado a 50 caracteres, lo que en
 * la práctica solo dejaba `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKi…`:
 * la parte útil (navegador y SO) quedaba cortada. Aquí se compone un perfil
 * legible que entra en los 50 caracteres:
 *
 * ```
 * Chrome/138 / Windows / es-PE / America/Lima
 * ```
 *
 * @param equipo Valor informado por el llamador; si viene, se respeta tal cual.
 */
export function perfilEquipo(equipo?: string): string {
  if (equipo) return equipo;
  if (typeof navigator === 'undefined') return '';
  const ua = navigator.userAgent ?? '';
  return [navegadorDe(ua), sistemaOperativoDe(ua), navigator.language || 'es', zonaHorariaDe()]
    .filter(Boolean)
    .join(' / ')
    .slice(0, LIMITE_EQUIPO);
}
