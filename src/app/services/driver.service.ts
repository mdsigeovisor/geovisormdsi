import { Injectable, signal } from '@angular/core';
import { driver, type Driver, type DriveStep } from 'driver.js';

/**
 * Servicio singleton que envuelve la factory `driver()` de driver.js 1.8.x.
 *
 * - La instancia de `Driver` se crea una sola vez (reutilizada entre tours):
 *   si el usuario vuelve a abrir el tour mientras otro corre, el previo se
 *   cierra con `destroy()` antes de iniciar el nuevo.
 * - La signal `tourActivo` permite a la UI (p. ej. el botón del navbar)
 *   reflejar el estado y reaccionar a un cierre externo (Escape, click overlay).
 *
 * @see https://driverjs.com/
 */
@Injectable({ providedIn: 'root' })
export class DriverService {
  /** Estado reactivo del tour (true mientras está activo). */
  readonly tourActivo = signal(false);

  private driverInstance: Driver | null = null;

  /**
   * Construye la lista de pasos del recorrido interactivo por el visor.
   * Cada paso ancla un `element` del DOM (que debe existir al iniciar el tour)
   * y describe su propósito en el popover. Los pasos del iconbar lateral
   * usan `side: 'right'` porque el iconbar siempre está visible (el panel de
   * contenido colapsable no afecta al recorrido).
   */
  private steps(): DriveStep[] {
    return [
      {
        element: '#msiLogo',
        popover: {
          title: 'Geovisor Catastral',
          description: 'Municipalidad de San Isidro. Logo institucional de la aplicación.',
        },
      },
      {
        element: '#visor-title',
        popover: {
          title: 'Título del visor',
          description: 'Nombre principal del geovisor del ámbito catastral municipal.',
        },
      },
      {
        element: '#mapContainer',
        popover: {
          title: 'Mapa principal',
          description:
            'Visualiza, navega y consulta la cartografía catastral. Usa la rueda del ratón o los controles para hacer zoom y arrastrar.',
        },
      },
      {
        element: '#btn-sidebar-search',
        popover: {
          side: 'right',
          title: 'Consultas',
          description:
            'Busca predios por código catastral, CUC, dirección, habilitación, titular, denominación o parque.',
        },
      },
      {
        element: '#btn-sidebar-layers',
        popover: {
          side: 'right',
          title: 'Capas',
          description: 'Activa o desactiva las capas cartográficas visibles en el mapa.',
        },
      },
      {
        element: '#btn-sidebar-legend',
        popover: {
          side: 'right',
          title: 'Leyenda',
          description: 'Visualiza la simbología de las capas activas en una ventana flotante.',
        },
      },
      {
        element: '#btn-sidebar-coordenadas',
        popover: {
          side: 'right',
          title: 'Búsqueda por Coordenadas',
          description: 'Ubica un punto ingresando sus coordenadas geográficas.',
        },
      },
      {
        element: '#btn-sidebar-print',
        popover: {
          side: 'right',
          title: 'Imprimir',
          description: 'Genera un PDF con la vista actual del mapa.',
        },
      },
      {
        element: '#btn-sidebar-downloads',
        popover: {
          side: 'right',
          title: 'Descargas',
          description: 'Accede a los formatos de descarga disponibles.',
        },
      },
      {
        element: '#visit-counter',
        popover: {
          title: 'Visitas',
          description:
            'Contador de visitas al geovisor. Cada carga de la página incrementa el contador.',
        },
      },
      {
        element: '#btn-observatorio',
        popover: {
          title: 'Observatorio Urbano',
          description:
            'Enlace externo al Observatorio Urbano de la comuna. Se abre en una pestaña nueva.',
        },
      },
      {
        element: '#btn-tour',
        popover: {
          title: 'Recorrido interactivo',
          description: 'Repite el tour de bienvenida en cualquier momento pulsando este botón.',
        },
      },
      {
        element: '#btn-auth',
        popover: {
          title: 'Acceso / Salida',
          description:
            'Accede con tu cuenta para desbloquear capas y búsquedas restringidas (p. ej. CUC y Titular).',
        },
      },
    ];
  }

  /**
   * Inicia el recorrido interactivo. Si ya había un tour activo, se cierra
   * (`destroy()`) antes de iniciar uno nuevo.
   */
  startTour(): void {
    // Cerramos un tour previo (si existe) antes de iniciar uno nuevo.
    if (this.driverInstance) {
      this.driverInstance.destroy();
      this.driverInstance = null;
    }
    this.tourActivo.set(false);

    // Factory `driver(config)` devuelve una instancia `Driver` con los hooks
    // declarados como opciones (driver.js 1.8).
    const drv = driver({
      showProgress: true,
      showButtons: ['next', 'previous', 'close'],
      allowClose: true,
      overlayColor: 'rgba(0, 0, 0, 0.6)',
      animate: true,
      duration: 300,
      steps: this.steps(),
      onHighlightStarted: () => this.tourActivo.set(true),
      onDeselected: () => this.tourActivo.set(false),
      onDestroyStarted: () => {
        this.tourActivo.set(false);
        this.driverInstance = null;
      },
    });

    this.driverInstance = drv;
    // `drive()` inicia el tour en el primer paso.
    drv.drive();
  }

  /** Detiene y cierra el tour activo (si lo hay). */
  stopTour(): void {
    if (!this.driverInstance) {
      return;
    }
    this.driverInstance.destroy();
    this.driverInstance = null;
    this.tourActivo.set(false);
  }

  /** Indica si hay un tour en ejecución. */
  isRunning(): boolean {
    return this.tourActivo();
  }
}
