/**
 * Entorno de pruebas unitarias (runner Vitest del builder @angular/build).
 *
 * La aplicación carga zone.js desde `main.ts`; el proceso de pruebas no pasa
 * por `main.ts`, así que Zone debe cargarse AQUÍ antes que cualquier módulo de
 * Angular. Sin esto, TestBed falla con:
 *   NG0908: In this configuration Angular requires Zone.js
 */
import 'zone.js';
import 'zone.js/testing';

import { fijarIpDePruebas } from './app/services/ip-equipo.service';

// La IP de la PC (`vchequipo`) se resuelve con WebRTC o con servicios
// públicos: dos vías de red asíncronas que no deben ejecutarse dentro de una
// prueba. Se fija un valor fijo para que `registrar()` emita la petición de
// forma síncrona, igual que en producción cuando la IP ya está resuelta.
fijarIpDePruebas('192.168.0.50');