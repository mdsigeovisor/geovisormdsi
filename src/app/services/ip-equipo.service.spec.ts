import { firstValueFrom } from 'rxjs';
import { vi } from 'vitest';

import {
  IpEquipoService,
  fijarIpDePruebas,
  ipDeCandidato,
  ipValida,
  mejorIp,
} from './ip-equipo.service';

/**
 * Pruebas de la IP de la PC que se graba en `vchequipo`.
 *
 * jsdom no implementa WebRTC y las pruebas no deben salir a la red, así que
 * las dos vías de resolución se sustituyen por dobles: un
 * `RTCPeerConnection` falso y un `fetch` controlado con `vi.stubGlobal`.
 */
describe('ipValida', () => {
  it('acepta las IPv4 públicas y privadas utilizables', () => {
    expect(ipValida('192.168.40.77')).toBe('192.168.40.77');
    expect(ipValida(' 10.1.2.3 ')).toBe('10.1.2.3');
    expect(ipValida('186.10.20.30')).toBe('186.10.20.30');
  });

  it('descarta las direcciones que no identifican al equipo', () => {
    expect(ipValida('127.0.0.1')).toBe(''); // loopback
    expect(ipValida('0.0.0.0')).toBe(''); // no especificada
    expect(ipValida('169.254.1.1')).toBe(''); // enlace local
    expect(ipValida('10.0.0.999')).toBe(''); // octeto fuera de rango
    expect(ipValida('mi-equipo.local')).toBe(''); // mDNS, no una IP
    expect(ipValida('')).toBe('');
    expect(ipValida(null)).toBe('');
  });

  it('acepta la ULA IPv6 y descarta loopback y enlace local', () => {
    expect(ipValida('fd00::1')).toBe('fd00::1');
    expect(ipValida('::1')).toBe('');
    expect(ipValida('fe80::1')).toBe('');
  });
});

describe('ipDeCandidato', () => {
  it('extrae la IP de un candidato host de WebRTC', () => {
    expect(
      ipDeCandidato('candidate:842163049 1 udp 1677729535 192.168.40.77 54321 typ host generation 0')
    ).toBe('192.168.40.77');
  });

  it('descarta los nombres mDNS con los que el navegador oculta la IP', () => {
    expect(ipDeCandidato('candidate:1 1 udp 2122260223 ab12-cd34.local 54321 typ host')).toBe('');
  });

  it('descarta los candidatos que no son de la máquina y el cierre', () => {
    // `srflx` = reflexión del servidor STUN (pública, no es la de la PC).
    expect(ipDeCandidato('candidate:1 1 udp 1677729535 186.10.20.30 54321 typ srflx')).toBe('');
    expect(ipDeCandidato(null)).toBe('');
  });
});

describe('mejorIp', () => {
  it('prefiere la IP de red local, que es la de la PC', () => {
    expect(mejorIp(['186.10.20.30', '192.168.40.77'])).toBe('192.168.40.77');
  });

  it('se queda con la pública si no hay ninguna local', () => {
    expect(mejorIp(['', 'mi-equipo.local', '186.10.20.30'])).toBe('186.10.20.30');
  });

  it('devuelve vacío si ninguna dirección sirve', () => {
    expect(mejorIp(['127.0.0.1', 'mi-equipo.local'])).toBe('');
  });
});

describe('IpEquipoService', () => {
  /** Doble de `RTCPeerConnection` que emite los candidatos indicados. */
  function webrtcFalso(candidatos: string[]) {
    return class {
      onicecandidate: ((evento: { candidate: { candidate: string } | null }) => void) | null = null;
      createDataChannel() {
        return {};
      }
      createOffer() {
        return Promise.resolve({});
      }
      setLocalDescription() {
        queueMicrotask(() => {
          for (const candidato of candidatos) {
            this.onicecandidate?.({ candidate: { candidate: candidato } });
          }
          this.onicecandidate?.({ candidate: null });
        });
        return Promise.resolve();
      }
      close() {
        // Nada que liberar: es un doble.
      }
    };
  }

  /** Doble de `fetch` que responde con el cuerpo indicado. */
  function fetchFalso(cuerpo: string) {
    return vi.fn(() => Promise.resolve({ ok: true, text: () => Promise.resolve(cuerpo) }));
  }

  beforeEach(() => {
    // Este archivo prueba el servicio REAL: anula la IP fija del entorno.
    fijarIpDePruebas(null);
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    fijarIpDePruebas(null);
  });

  it('con una IP de pruebas fija no resuelve nada (vía del entorno)', () => {
    const doble = vi.fn();
    vi.stubGlobal('fetch', doble);
    fijarIpDePruebas('10.10.10.10');

    let ip: string | undefined;
    new IpEquipoService().ip().subscribe(valor => (ip = valor));

    expect(ip).toBe('10.10.10.10');
    expect(doble).not.toHaveBeenCalled();
  });

  it('prefiere la IP local de WebRTC y no consulta servicios externos', async () => {
    vi.stubGlobal(
      'RTCPeerConnection',
      webrtcFalso(['candidate:1 1 udp 2122260223 192.168.40.77 54321 typ host'])
    );
    const doble = fetchFalso('{"ip":"186.10.20.30"}');
    vi.stubGlobal('fetch', doble);

    expect(await firstValueFrom(new IpEquipoService().ip())).toBe('192.168.40.77');
    expect(doble).not.toHaveBeenCalled();
  });

  it('si WebRTC solo da mDNS, respalda con la IP pública', async () => {
    vi.stubGlobal(
      'RTCPeerConnection',
      webrtcFalso(['candidate:1 1 udp 2122260223 ab12-cd34.local 54321 typ host'])
    );
    vi.stubGlobal('fetch', fetchFalso('{"ip":"186.10.20.30"}'));

    expect(await firstValueFrom(new IpEquipoService().ip())).toBe('186.10.20.30');
  });

  it('guarda la IP en localStorage y la reutiliza en la siguiente carga', async () => {
    vi.stubGlobal('fetch', fetchFalso('{"ip":"186.10.20.30"}'));
    expect(await firstValueFrom(new IpEquipoService().ip())).toBe('186.10.20.30');

    // Nueva instancia = pestaña recargada: la caché debe bastar y emitir de
    // forma SÍNCRONA (si tuviera que salir a la red, `ip` quedaría vacía).
    vi.unstubAllGlobals();
    let sincrona: string | undefined;
    new IpEquipoService().ip().subscribe(valor => (sincrona = valor));
    expect(sincrona).toBe('186.10.20.30');
  });

  it('si fallan todas las vías emite vacío y no repite la consulta', async () => {
    const doble = vi.fn(() => Promise.reject(new Error('sin red')));
    vi.stubGlobal('fetch', doble);
    const servicio = new IpEquipoService();

    expect(await firstValueFrom(servicio.ip())).toBe('');
    const intentos = doble.mock.calls.length;
    expect(intentos).toBeGreaterThan(0);

    // Dentro del tiempo de espera no se vuelve a la red: cada evento auditado
    // no debe encadenar consultas fallidas.
    expect(await firstValueFrom(servicio.ip())).toBe('');
    expect(doble.mock.calls.length).toBe(intentos);
  });
});