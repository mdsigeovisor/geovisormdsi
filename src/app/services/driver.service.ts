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
      {/* 1. Logo MSI - Navbar izquierda */
        element: '#msiLogo',
        popover: {
          side: 'bottom',
          align: 'start',
          title: 'Geovisor Catastral',
             description: '<div style="text-align: center;"><img src="assets/images/logo_visor.png" alt="Logo" style="max-width: 200px; margin-bottom: 8px;"></div> Municipalidad de San Isidro. Logo institucional de la aplicación.',
        },
      },
      {/* 2. Título - Navbar centro */
        element: '#visor-title',
        popover: {
          side: 'bottom',
          title: 'Geovisor Catastral',
          description: 'Nombre principal del geovisor del ámbito catastral municipal.',
        },
      },
      {/* 3. Contador de visitas - Navbar derecha */
        element: '#visit-counter',
        popover: {
          side: 'bottom',
          align: 'end',
          title: 'Visitas',
          description: 'Contador de visitas al geovisor. Cada carga de la página incrementa el contador.',
        },
      },
      {/* 4. Menú de Herramientas - Navbar derecha (Tour / Dashboard / Observatorio) */
        element: '#btn-menus',
        popover: {
          side: 'bottom',
          align: 'end',
          title: 'Herramientas',
          description: 'Acceso rápido al Tour (recorrido interactivo), al Dashboard de Conformidad de Obra y al Observatorio Urbano (abre en una pestaña nueva).',
        },
      },
      {/* 5. Mapa principal - Centro */
        element: '#mapContainer',
        popover: {
          side: 'bottom',
          align: 'end',
          title: 'Mapa principal',
          description:
            'Visualiza, navega y consulta la cartografía catastral. Usa la rueda del ratón o los controles para hacer zoom y arrastrar.',
        },
      },
      {/* 6. Consultas - Sidebar izquierda */
        element: '#btn-sidebar-search',
        popover: {
          side: 'right',
          title: 'Consultas',
          description:
            'Busca predios por código catastral, CUC, dirección, habilitación, titular, denominación o parque.',
        },
      },
      {/* 7. Capas - Sidebar izquierda */
        element: '#btn-sidebar-layers',
        popover: {
          side: 'right',
          title: 'Capas',
          description: 'Activa o desactiva las capas cartográficas visibles en el mapa.',
        },
      },
      {/* 8. Leyenda - Sidebar izquierda */
        element: '#btn-sidebar-legend',
        popover: {
          side: 'right',
          title: 'Leyenda',
          description: 'Visualiza la simbología de las capas activas en una ventana flotante.',
        },
      },
      {/* 9. Coordenadas - Sidebar izquierda */
        element: '#btn-sidebar-coordenadas',
        popover: {
          side: 'right',
          title: 'Búsqueda por Coordenadas',
          description: 'Ubica un punto ingresando sus coordenadas geográficas.',
        },
      },
      {/* 10. Imprimir - Sidebar izquierda */
        element: '#btn-sidebar-print',
        popover: {
          side: 'right',
          title: 'Imprimir',
          description: 'Genera un PDF con la vista actual del mapa.',
        },
      },
      {/* 11. Descargas - Sidebar izquierda */
        element: '#btn-sidebar-downloads',
        popover: {
          side: 'right',
          title: 'Descargas',
          description: 'Accede a los formatos de descarga disponibles.',
        },
      },
      {/* 12. Zoom In - Panel derecho */
        element: '#btn-zoom-in',
        popover: {
          side: 'right',
          align: 'center',
          title: 'Acercar zoom',
          description: 'Aumenta el nivel de zoom para ver más detalle del mapa.',
        },
      },
      {/* 13. Zoom Out - Panel derecho */
        element: '#btn-zoom-out',
        popover: {
          side: 'right',
          align: 'center',
          title: 'Alejar zoom',
          description: 'Reduce el nivel de zoom para ver una área más amplia.',
        },
      },
      {/* 14. Vista general - Panel derecho */
        element: '#btn-home',
        popover: {
          side: 'right',
          align: 'center',
          title: 'Vista general',
          description: 'Restablece la vista del mapa a la extensión inicial del distrito.',
        },
      },
      {/* 15. Geolocalización - Panel derecho */
        element: '#btn-geolocalizacion',
        popover: {
          side: 'right',
          align: 'center',
          title: 'Mi ubicación',
          description: 'Centra el mapa en tu ubicación actual usando geolocalización del navegador.',
        },
      },
      {/* 16. Cambio base - Panel derecho */
        element: '#btn-cambio-base',
        popover: {
          side: 'right',
          align: 'center',
          title: 'Cambiar mapa base',
          description: 'Alterna entre las vistas satélite, calles y mapa en blanco.',
        },
      },
      {/* 17. Herramientas - Panel derecho */
        element: '#btn-herramientas',
        popover: {
          side: 'right',
          align: 'center',
          title: 'Herramientas de dibujo',
          description: 'Abre el panel de herramientas para medir distancias, áreas y dibujar sobre el mapa.',
        },
      },
      {/* 18. Botón Auth/Login - Último, Navbar derecha */
        element: '#btn-auth',
        popover: {
          side: 'bottom',
          align: 'end',
          title: 'Acceso / Salida',
          description: 'Accede con tu cuenta para desbloquear capas y búsquedas restringidas (p. ej. CUC y Titular).',
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
      nextBtnText: 'Siguiente',
      prevBtnText: 'Anterior',
      doneBtnText: 'Finalizar',
      progressText: '{{current}} de {{total}}',
      steps: this.steps(),
      // onHighlighted se dispara cuando un elemento es resaltado (cada paso).
      // Lo usamos para marcar el tour como activo.
      onHighlighted: () => this.tourActivo.set(true),
      // onDestroyed se dispara DESPUÉS de que el tour se cierra completamente.
      // NO usar onDeselected aquí porque ese se dispara entre cada paso,
      // lo que haría que tourActivo parpadeara durante el recorrido.
      onDestroyed: () => {
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
