import { Injectable } from '@angular/core';
import { Observable, catchError, defer, finalize, of, shareReplay, tap } from 'rxjs';

/* ---------------------------------------------------------------------------
 * IP DE LA PC PARA EL CAMPO `vchequipo` DE LA AUDITORÍA
 *
 * El negocio define `mdsisicu.sicu_logmensajes.vchequipo` como el lugar donde
 * se graba la IP de la PC que entra al visor. El navegador, por seguridad, no
 * expone la dirección de la máquina a la página, así que este servicio la
 * resuelve por la vía que pueda, en este orden:
 *
 *   1. IP local (WebRTC): se abre un `RTCPeerConnection` sin servidores STUN
 *      y se leen los candidatos `host` de la reunión ICE. Cuando el navegador
 *      publica la dirección —intranet o permisos concedidos—, ésta es la IP de
 *      la PC, que es el dato que interesa. En los navegadores actuales esos
 *      candidatos vienen ofuscados con mDNS (`xxxx.local`): no son una IP, se
 *      descartan y se pasa al paso 2.
 *   2. IP pública (respaldo): si WebRTC no da una IP utilizable, se consulta
 *      un servicio externo (api.ipify.org / ipinfo.io). Devuelve la salida a
 *      internet de la red —en la municipalidad puede ser la misma para todas
 *      las PC—, pero permite distinguir al menos el origen del visitante.
 *
 * Política de fallos: la auditoría NUNCA depende de la IP. El resultado se
 * guarda en `localStorage` (30 min) para no repetir la consulta en cada
 * carga; si tampoco se consigue, se emite cadena vacía y se reintenta pasados
 * 60 segundos, de modo que una red bloqueada no impide registrar un evento.
 * ------------------------------------------------------------------------- */

/** Clave de `localStorage` donde se conserva la IP ya resuelta. */
const CLAVE_CACHE_IP = 'gmsi_ip_equipo';

/** Vigencia de la IP guardada: una DHCP puede cambiarla durante la jornada. */
const TTL_CACHE_MS = 30 * 60_000;

/** Espera antes de volver a resolver cuando el intento anterior no dio IP. */
const REINTENTO_SIN_IP_MS = 60_000;

/** Máximo que se espera a los candidatos de WebRTC. */
const TIEMPO_WEBRTC_MS = 800;

/** Máximo de espera por servicio público de IP. */
const TIEMPO_POR_FUENTE_MS = 1_500;

/**
 * Presupuesto total de la resolución: el primer evento auditado no debe
 * demorar más que esto esperando la IP; el resto de los eventos ya la toman
 * de la memoria o de la caché.
 */
const PRESUPUESTO_TOTAL_MS = 3_000;

/** Servicios públicos de IP consultados como respaldo, en orden. */
const FUENTES_IP_PUBLICA = [
  'https://api.ipify.org?format=json',
  'https://ipinfo.io/ip',
];

/**
 * Normaliza y valida una dirección IP.
 *
 * Devuelve la IP válida o `''` si no lo es o si es una dirección que no
 * identifica al equipo: loopback (`127.x`, `::1`), enlace local (`169.254.x`,
 * `fe80::`), no especificada (`0.x`, `::`), multicast/broadcast y los nombres
 * mDNS (`xxxx.local`) que los navegadores devuelven en lugar de la IP real.
 *
 * @param valor Dirección candidata, venga de donde venga.
 */
export function ipValida(valor?: string | null): string {
  const ip = (valor ?? '').trim();
  if (!ip) return '';

  if (ip.includes(':')) {
    // IPv6.
    if (!/^[0-9a-f:]+$/i.test(ip)) return '';
    const minusculas = ip.toLowerCase();
    if (minusculas === '::' || minusculas === '::1') return '';
    if (minusculas.startsWith('fe80:') || minusculas.startsWith('ff')) return '';
    return minusculas;
  }

  // IPv4: cuatro octetos en 0..255.
  const octetos = ip.split('.').map(Number);
  if (octetos.length !== 4 || octetos.some(o => !Number.isInteger(o) || o < 0 || o > 255)) {
    return '';
  }
  const [a, b] = octetos;
  if (a === 0 || a === 127) return '';
  if (a === 169 && b === 254) return '';
  if (a >= 224) return '';
  return octetos.join('.');
}

/**
 * Qué tanto identifica a la PC una dirección: `2` si es de red local (la de
 * la PC), `1` si es una pública utilizable y `0` si no sirve.
 */
function prioridadDe(ip: string): number {
  if (!ip) return 0;
  if (ip.includes(':')) return ip.startsWith('f') ? 2 : 1; // ULA (fc00::/7)
  const [a, b] = ip.split('.').map(Number);
  if (a === 10) return 2;
  if (a === 192 && b === 168) return 2;
  if (a === 172 && b >= 16 && b <= 31) return 2;
  return 1;
}

/**
 * De varias direcciones candidatas devuelve la que mejor identifica a la PC
 * (prefiere la de red local) o `''` si ninguna sirve.
 */
export function mejorIp(candidatos: readonly string[]): string {
  let mejor = '';
  let mejorPrioridad = 0;
  for (const candidato of candidatos) {
    const ip = ipValida(candidato);
    const prioridad = prioridadDe(ip);
    if (prioridad > mejorPrioridad) {
      mejor = ip;
      mejorPrioridad = prioridad;
      if (mejorPrioridad === 2) break; // La local ya es la mejor posible.
    }
  }
  return mejor;
}

/**
 * Extrae la IP de un candidato ICE de WebRTC
 * (`candidate:<fundación> <cmp> <proto> <prio> <ip> <puerto> typ <tipo> …`).
 *
 * Solo interesan los de tipo `host` (direcciones de la propia máquina): los
 * `srflx` serían la reflexión del servidor STUN (pública) y los nombres mDNS
 * ni siquiera son una dirección IP.
 *
 * @param candidato Texto del candidato; `null` cuando termina la reunión ICE.
 */
export function ipDeCandidato(candidato?: string | null): string {
  if (!candidato) return '';
  const partes = candidato.trim().split(/\s+/);
  // [0] candidate:<fundación> [1] componente [2] protocolo [3] prioridad
  // [4] ip [5] puerto [6] 'typ' [7] tipo
  if (partes.length < 8 || partes[6].toLowerCase() !== 'typ') return '';
  if (partes[7].toLowerCase() !== 'host') return '';
  return ipValida(partes[4]);
}

/**
 * IP local obtenida de los candidatos `host` de una reunión ICE sin STUN.
 *
 * Resuelve con la mejor dirección encontrada o con `''` pasados
 * `TIEMPO_WEBRTC_MS`; nunca rechaza, porque un fallo aquí solo significa que
 * se usará el respaldo de IP pública.
 */
function ipLocalWebRtc(): Promise<string> {
  return new Promise(resolver => {
    const Constructor =
      typeof globalThis.RTCPeerConnection === 'undefined' ? undefined : globalThis.RTCPeerConnection;
    if (!Constructor) {
      resolver('');
      return;
    }

    let conexion: RTCPeerConnection;
    try {
      conexion = new Constructor({ iceServers: [] });
    } catch {
      resolver('');
      return;
    }

    const candidatos: string[] = [];
    let terminado = false;
    const terminar = () => {
      if (terminado) return;
      terminado = true;
      clearTimeout(reloj);
      try {
        conexion.close();
      } catch {
        // La conexión ya estaba cerrada: no hay nada que liberar.
      }
      resolver(mejorIp(candidatos));
    };
    const reloj = setTimeout(terminar, TIEMPO_WEBRTC_MS);

    conexion.onicecandidate = evento => {
      const ip = ipDeCandidato(evento?.candidate?.candidate);
      if (ip) candidatos.push(ip);
      // `candidate: null` = reunión ICE terminada: no llegarán más.
      if (!evento.candidate) terminar();
    };

    try {
      // El canal de datos obliga al navegador a generar candidatos.
      conexion.createDataChannel('auditoria');
      void conexion
        .createOffer()
        .then(oferta => conexion.setLocalDescription(oferta))
        .catch(terminar);
    } catch {
      terminar();
    }
  });
}

/** Extrae la IP de la respuesta de un servicio: JSON `{"ip": …}` o texto. */
function ipDeRespuesta(texto: string): string {
  const limpio = texto.trim();
  if (limpio.startsWith('{')) {
    try {
      const cuerpo = JSON.parse(limpio) as { ip?: unknown };
      return ipValida(typeof cuerpo.ip === 'string' ? cuerpo.ip : '');
    } catch {
      return '';
    }
  }
  return ipValida(limpio);
}

/**
 * Consulta un servicio público de IP con tope de espera propio.
 * Devuelve `''` si falla: el error nunca se propaga.
 */
async function ipPublica(url: string, tiempoMaximoMs: number): Promise<string> {
  if (typeof fetch !== 'function') return '';
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), tiempoMaximoMs);
  try {
    const respuesta = await fetch(url, { cache: 'no-store', signal: control.signal });
    if (!respuesta.ok) return '';
    return ipDeRespuesta(await respuesta.text());
  } catch {
    return '';
  } finally {
    clearTimeout(reloj);
  }
}

/** Lee la caché de `localStorage`; `''` si no hay o si está caducada. */
function leerCache(): string {
  try {
    const bruto = localStorage.getItem(CLAVE_CACHE_IP);
    if (!bruto) return '';
    const guardado = JSON.parse(bruto) as { ip?: unknown; guardadaEn?: unknown };
    if (
      typeof guardado.ip !== 'string' ||
      typeof guardado.guardadaEn !== 'number' ||
      Date.now() - guardado.guardadaEn > TTL_CACHE_MS
    ) {
      localStorage.removeItem(CLAVE_CACHE_IP);
      return '';
    }
    return ipValida(guardado.ip);
  } catch {
    // Almacenamiento no disponible (modo privado): se resolverá de nuevo.
    return '';
  }
}

/** Guarda la IP resuelta para no repetir la consulta en cada carga. */
function escribirCache(ip: string): void {
  try {
    localStorage.setItem(CLAVE_CACHE_IP, JSON.stringify({ ip, guardadaEn: Date.now() }));
  } catch {
    // Sin cuota o bloqueado: la próxima carga volverá a resolverla.
  }
}

/**
 * IP fija que devuelve el servicio. Solo la fija el entorno de pruebas
 * (`src/test-setup.ts`): WebRTC y los servicios públicos son vías asíncronas
 * y de red que no deben ejecutarse dentro de una prueba unitaria.
 */
let ipDePruebas: string | null = null;

/**
 * Fija la IP que devolverá el servicio (o `null` para restaurar el
 * comportamiento real). Uso exclusivo del entorno de pruebas.
 */
export function fijarIpDePruebas(ip: string | null): void {
  ipDePruebas = ip;
}

/**
 * Servicio que resuelve la IP de la PC que entra al visor, el dato que se
 * graba en `vchequipo` de cada fila de auditoría.
 *
 * `ip()` emite una sola vez, con la IP resuelta o con `''` si no la hay: el
 * registro del evento nunca falla por este dato. Cuando ya se conoce (memoria
 * o caché de `localStorage`), emite de forma síncrona.
 */
@Injectable({
  providedIn: 'root',
})
export class IpEquipoService {
  /** IP ya resuelta en esta sesión de la pestaña. */
  private ipConocida?: string;
  /** Resolución en curso, compartida por todos los eventos que esperan. */
  private resolviendo?: Observable<string>;
  /** Marca del último intento fallido, para no repetirlo en cada evento. */
  private ultimoIntentoFallido = 0;

  /**
   * IP de la PC que entra al visor.
   *
   * @returns Observable que emite la IP o `''`; nunca falla.
   */
  ip(): Observable<string> {
    if (ipDePruebas !== null) return of(ipDePruebas);
    if (typeof window === 'undefined') return of('');
    if (this.ipConocida) return of(this.ipConocida);

    const cache = leerCache();
    if (cache) {
      this.ipConocida = cache;
      return of(cache);
    }

    // Varios eventos pueden llegar mientras se resuelve: comparten el intento.
    if (this.resolviendo) return this.resolviendo;
    // Tras un fallo no se vuelve a salir a la red en cada evento auditado.
    if (Date.now() - this.ultimoIntentoFallido < REINTENTO_SIN_IP_MS) return of('');

    this.resolviendo = defer(() => this.resolver()).pipe(
      catchError(() => of('')),
      tap(ip => {
        if (ip) {
          this.ipConocida = ip;
          escribirCache(ip);
        } else {
          this.ultimoIntentoFallido = Date.now();
        }
      }),
      // Sin IP se libera el intento (para poder reintentar pasados 60 s);
      // con IP, `ipConocida` resuelve cualquier llamada posterior al instante.
      finalize(() => {
        this.resolviendo = undefined;
      }),
      shareReplay({ bufferSize: 1, refCount: false })
    );
    return this.resolviendo;
  }

  /**
   * Resuelve la IP: primero la local (identifica la PC) y, si no, la pública.
   * El conjunto no puede demorar más de `PRESUPUESTO_TOTAL_MS`.
   */
  private async resolver(): Promise<string> {
    const inicio = Date.now();
    const local = await ipLocalWebRtc();
    if (local) return local;

    for (const fuente of FUENTES_IP_PUBLICA) {
      const restante = PRESUPUESTO_TOTAL_MS - (Date.now() - inicio);
      if (restante <= 0) break;
      const publica = await ipPublica(fuente, Math.min(TIEMPO_POR_FUENTE_MS, restante));
      if (publica) return publica;
    }
    return '';
  }
}
