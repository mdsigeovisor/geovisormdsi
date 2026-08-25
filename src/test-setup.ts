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