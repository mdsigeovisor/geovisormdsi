import { TestBed } from '@angular/core/testing';

import { DriverService } from './driver.service';

/**
 * Pruebas del recorrido interactivo (tour) del visor.
 *
 * Se prueba contra la librería REAL de driver.js (funciona en jsdom): así se
 * fija el comportamiento que ve el usuario, no la forma interna de la llamada.
 * El contrato que importa es:
 *  - `startTour()` monta el popover del primer paso y marca `tourActivo`;
 *  - el recorrido tiene 18 pasos y los botones están en español;
 *  - pedir un tour mientras corre otro cierra el anterior (nunca quedan dos);
 *  - `stopTour()` desmonta el popover y apaga `tourActivo`;
 *  - `stopTour()` sin tour activo es un no-op (idempotente).
 *
 * `onHighlighted` lo dispara driver.js tras la animación de entrada, de ahí la
 * espera antes de comprobar `tourActivo`.
 */

/** Selectores que anclan cada paso del recorrido; deben existir en el DOM. */
const SELECTORES = [
  '#msiLogo',
  '#visor-title',
  '#visit-counter',
  '#btn-menus',
  '#mapContainer',
  '#btn-sidebar-search',
  '#btn-sidebar-layers',
  '#btn-sidebar-legend',
  '#btn-sidebar-coordenadas',
  '#btn-sidebar-print',
  '#btn-sidebar-downloads',
  '#btn-zoom-in',
  '#btn-zoom-out',
  '#btn-home',
  '#btn-geolocalizacion',
  '#btn-cambio-base',
  '#btn-herramientas',
  '#btn-auth',
];

/** Número de pasos del recorrido (debe coincidir con `SELECTORES`). */
const TOTAL_PASOS = SELECTORES.length;

/** Margen máximo para la animación de entrada de driver.js (300 ms). */
const ESPERA_ANIMACION_MS = 500;

describe('DriverService', () => {
  let service: DriverService;

  /**
   * Espera a que driver.js aplique el paso. La librería anima el popover y el
   * resaltado con temporizadores, así que se espera un plazo fijo (mayor que
   * los 300 ms de animación) en lugar de sondear el DOM.
   */
  function esperarPaso(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ESPERA_ANIMACION_MS));
  }

  /** Espera a que el popover esté montado y `tourActivo` encendido. */
  function esperarTourMontado(): Promise<void> {
    return esperarPaso();
  }

  /** Pulsa "Siguiente" y devuelve el ancla del nuevo paso. */
  async function avanzar(): Promise<string> {
    (document.querySelector('.driver-popover-next-btn') as HTMLElement).click();
    await esperarPaso();
    return elementoResaltado() ?? '';
  }

  /** Elemento resaltado por el popover (el ancla del paso visible). */
  function elementoResaltado(): string | null {
    return document.querySelector('.driver-active-element')?.id ?? null;
  }

  /** Número de popovers montados a la vez (debe ser 0 o 1). */
  function popoversMontados(): number {
    return document.querySelectorAll('.driver-popover').length;
  }

  beforeEach(async () => {
    // El tour exige que cada ancla exista en el DOM cuando arranca.
    for (const selector of SELECTORES) {
      const elemento = document.createElement('div');
      elemento.id = selector.replace('#', '');
      document.body.appendChild(elemento);
    }

    TestBed.configureTestingModule({});
    service = TestBed.inject(DriverService);
  });

  afterEach(async () => {
    // driver.js deja nodos y listeners en `document`; sin esperar a que el tour
    // se desmonte, el test siguiente hereda el popover del anterior.
    service.stopTour();
    await new Promise(resolve => setTimeout(resolve, ESPERA_ANIMACION_MS));
    document.body.innerHTML = '';
    TestBed.resetTestingModule();
  });

  it('arranca sin tour activo', () => {
    expect(service.tourActivo()).toBe(false);
    expect(service.isRunning()).toBe(false);
    expect(popoversMontados()).toBe(0);
  });
describe('startTour', () => {
    it('monta el popover en el primer paso y enciende `tourActivo`', async () => {
      service.startTour();
      await esperarTourMontado();

      expect(popoversMontados()).toBe(1);
      expect(elementoResaltado()).toBe('msiLogo');
      // `tourActivo` lo enciende `onHighlighted`, que driver.js dispara tras la
      // animación: antes de esperar sigue apagado.
      expect(service.tourActivo()).toBe(true);
      expect(service.isRunning()).toBe(true);
    });

    it('el recorrido tiene un paso por cada ancla del visor', async () => {
      service.startTour();
      await esperarTourMontado();

      expect(document.querySelector('.driver-popover-progress-text')?.textContent).toBe(
        `1 de ${TOTAL_PASOS}`
      );
    });

    it('avanza paso a paso por el icono, la barra lateral y el panel derecho', async () => {
      service.startTour();
      await esperarTourMontado();

      // El recorrido cubre navbar, sidebar y panel derecho; se avanza paso a
      // paso comprobando que el popover se ancla en cada elemento.
      const esperadas = ['visor-title', 'visit-counter', 'btn-menus', 'mapContainer', 'btn-sidebar-search'];
      for (const ancla of esperadas) {
        expect(await avanzar()).toBe(ancla);
      }
    });

    it('el último paso ofrece el botón "Finalizar"', async () => {
      service.startTour();
      await esperarTourMontado();

      // Se avanza hasta el último paso (el botón de acceso, `#btn-auth`).
      let ancla = 'msiLogo';
      while (ancla !== 'btn-auth') {
        ancla = await avanzar();
      }

      expect(document.querySelector('.driver-popover-progress-text')?.textContent).toBe(
        `${TOTAL_PASOS} de ${TOTAL_PASOS}`
      );
      expect(document.querySelector('.driver-popover-next-btn')?.textContent?.trim()).toBe('Finalizar');
      // Recorrer los 18 pasos con la animación real tarda más que el timeout
      // por defecto de Vitest (5 s).
    }, 20_000);

    it('navega hacia atrás con el botón "Anterior"', async () => {
      service.startTour();
      await esperarTourMontado();

      (document.querySelector('.driver-popover-next-btn') as HTMLElement).click();
      await esperarTourMontado();
      expect(elementoResaltado()).toBe('visor-title');

      (document.querySelector('.driver-popover-prev-btn') as HTMLElement).click();
      await esperarTourMontado();

      expect(elementoResaltado()).toBe('msiLogo');
    });

    it('los botones de navegación están en español', async () => {
      service.startTour();
      await esperarTourMontado();

      expect(document.querySelector('.driver-popover-prev-btn')?.textContent?.trim()).toBe('Anterior');
      expect(document.querySelector('.driver-popover-next-btn')?.textContent?.trim()).toBe('Siguiente');
      // El primer paso no tiene paso anterior.
      expect(document.querySelector('.driver-popover-prev-btn')?.hasAttribute('disabled')).toBe(true);
    });

    it('cierra el tour anterior antes de iniciar uno nuevo', async () => {
      service.startTour();
      await esperarTourMontado();

      service.startTour();
      await esperarTourMontado();

      // Nunca quedan dos popovers: el nuevo tour reutiliza la instancia viva.
      expect(popoversMontados()).toBe(1);
      expect(elementoResaltado()).toBe('msiLogo');
      expect(service.tourActivo()).toBe(true);
    });
  });

  describe('stopTour', () => {
    it('desmonta el popover y apaga `tourActivo`', async () => {
      service.startTour();
      await esperarTourMontado();
      expect(popoversMontados()).toBe(1);

      service.stopTour();
      await esperarTourMontado();

      expect(popoversMontados()).toBe(0);
      expect(service.tourActivo()).toBe(false);
      expect(service.isRunning()).toBe(false);
    });

    it('no hace nada si no hay tour activo', () => {
      service.stopTour();

      expect(popoversMontados()).toBe(0);
      expect(service.tourActivo()).toBe(false);
    });

    it('permite volver a iniciar el tour tras detenerlo', async () => {
      service.startTour();
      await esperarTourMontado();
      service.stopTour();
      await esperarTourMontado();

      service.startTour();
      await esperarTourMontado();

      expect(popoversMontados()).toBe(1);
      expect(elementoResaltado()).toBe('msiLogo');
      expect(service.tourActivo()).toBe(true);
    });

    it('se puede cerrar el tour desde su propio botón de cerrar', async () => {
      service.startTour();
      await esperarTourMontado();

      (document.querySelector('.driver-popover-close-btn') as HTMLElement).click();
      await esperarTourMontado();

      expect(popoversMontados()).toBe(0);
      expect(service.tourActivo()).toBe(false);
    });
  });

  describe('singleton', () => {
    it('devuelve siempre la misma instancia del servicio', () => {
      expect(TestBed.inject(DriverService)).toBe(service);
    });

    it('comparte el estado del tour entre consumidores', async () => {
      // El botón del navbar y el panel comparten el mismo servicio: si uno abre
      // el tour, el otro debe reflejarlo sin conocer la instancia.
      const otroConsumidor = TestBed.inject(DriverService);

      otroConsumidor.startTour();
      await esperarTourMontado();

      expect(service.tourActivo()).toBe(true);
      expect(service.isRunning()).toBe(true);
    });
  });
});

