import { Component, ElementRef, ViewChild, afterNextRender, inject, ChangeDetectorRef, effect, HostListener, signal, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
// Servicios y módulos
import { LoteInfoWindow, MapService } from '../../../../services/map.service';
import { DriverService } from '../../../../services/driver.service';
import { DrawMeasureService } from '../../../../services/draw.service';
// Componentes relacionados
import { Navbar } from './components/navbar/navbar';
import { Sidebar } from './components/sidebar/sidebar';
import { Funciones } from './components/functions/functions';
import { Spinner } from '../../../../animations/spinner/spinner';
import { Login } from '../../../auth/components/login/login'; // Import Login component
import { CoordinateInfo } from './components/coordinate-info/coordinate-info';
import { TermsModal } from './components/terminos/terminos';
import { Leyenda } from './components/sidebar/components/leyenda/leyenda';
/**
 * Componente principal de la interfaz del mapa.
 * Coordina la visualización de la barra de herramientas, barra lateral y los controles
 * interactivos del mapa central.
 */
@Component({
  selector: 'app-map',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  imports: [
    CommonModule,
    Navbar,
    Sidebar,    
    Funciones,
    Login, // Add Login to imports
    Spinner,
    CoordinateInfo,
    TermsModal,
    Leyenda,
  ],
  templateUrl: './map.html',
  styleUrl: './map.css',
})
export class MapComponent {
  /** Referencia al contenedor principal donde se inyecta el lienzo de OpenLayers */
  @ViewChild('mapContainer') mapContainer!: ElementRef;

  /** Referencia al componente de funciones para invocar sus métodos. */
  @ViewChild(Funciones) funcionesComponent!: Funciones;

  public showLoginModal = signal(false);

  /** Conjunto de ids de ventanas de lote cuyo iframe ya terminó de cargar (para ocultar el spinner). */
  private readonly loteWindowsLoaded = signal<Set<string>>(new Set());

    public readonly mapService = inject(MapService);
  private readonly driverService = inject(DriverService);
  /** Estado del tour activo (proyectado al navbar para el resaltado del botón). */
  isTourActive = this.driverService.tourActivo;
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly drawMeasureService = inject(DrawMeasureService);
  /** Rastrea errores de carga de iframe por URL para mostrar mensaje de error. */
  private readonly iframeErrors = signal<Set<string>>(new Set());
  /** Rastrea qué iframes han cargado correctamente para ocultar el spinner. */
  private readonly iframeLoaded = signal<Set<string>>(new Set());
  /** Posición del modal de cruces de accesibilidad */
  cruceModalPosition = signal<{ x: number; y: number }>({ x: 0, y: 0 });
  /** Posición del modal de manzanas de accesibilidad */
  manzanaModalPosition = signal<{ x: number; y: number }>({ x: 0, y: 0 });
  /** Estado de arrastre para los modales */
  private cruceDragState: { startX: number; startY: number; originX: number; originY: number } | null = null;
  private manzanaDragState: { startX: number; startY: number; originX: number; originY: number } | null = null;

  constructor() {
    // Usamos un 'effect' para reaccionar a los cambios de la signal 'isReady'.
    // El effect debe crearse en el constructor para tener un contexto de inyección.
    effect(() => {
      if (this.mapService.isReady()) {
        setTimeout(() => {
          this.funcionesComponent.goHome();
          // Eliminamos la capa del INEI después de la animación inicial
          this.mapService.removeLayerById('ig_departamento');
        }, 2000); // 5 segundos
      }
    });

    // afterNextRender asegura que el mapa se inicialice solo en el cliente (navegador)
    afterNextRender(() => this.initMap());
  }
  /**
   * Solicita al servicio la creación de la instancia de OpenLayers pasando el
   * contenedor nativo del componente.
   */
  private initMap(): void {
    // Utilizamos el servicio para inicializar el mapa centralizando la lógica
    const map = this.mapService.initMap(this.mapContainer.nativeElement);
    // Una vez que el mapa está inicializado, lo pasamos al servicio de dibujo
    this.drawMeasureService.inicializar(map);

    this.cdr.detectChanges();
  }

  /**
   * Escucha la tecla 'Escape' a nivel de documento para cerrar el modal.
   * @param event El evento de teclado.
   */
  @HostListener('document:keydown.escape', ['$event'])
  onKeydownHandler(event: KeyboardEvent) {
    if (this.mapService.loteInfoWindows().length > 0) {
      this.mapService.closeLastLoteWindow();
    }
    if (this.mapService.fotoDroneUrl2018()) {
      this.closeFotoDroneModal2018();
    }
    if (this.mapService.fotoDroneUrl2024()) {
      this.closeFotoDroneModal2024();
    }
    if (this.mapService.ptoGeodesicoUrl()) {
      this.closePtoGeodesicoModal();
    }
    if (this.mapService.arboladoUrbano2015Url()) {
      this.closeArboladoUrbano2015Modal();
    }
    if (this.mapService.tusneUrl()) {
      this.closeTusneModal();
    }
    if (this.mapService.cruceAccesibilidadUrl()) {
      this.closeCruceAccesibilidadModal();
    }
    if (this.mapService.cruceAccesibilidadManzanaUrl()) {
      this.closeCruceAccesibilidadManzanaModal();
    }
    if (this.mapService.showTermsModal()) {
      this.mapService.closeTermsModal();
    }
  }
  /** Estado interno del arrastre de una ventana de lote */
  private loteDragState: { id: string; startX: number; startY: number; originX: number; originY: number } | null = null;

  /**
   * Inicia el arrastre de una ventana flotante desde su barra de título.
   */
  startLoteDrag(event: PointerEvent, win: LoteInfoWindow): void {
    if (event.button !== 0) return;
    event.preventDefault(); // Evita seleccionar texto durante el arrastre
    this.loteDragState = { id: win.id, startX: event.clientX, startY: event.clientY, originX: win.x, originY: win.y };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  /**
   * Arrastra la ventana siguiendo el movimiento del puntero.
   */
  dragLote(event: PointerEvent): void {
    if (!this.loteDragState) return;
    const x = this.loteDragState.originX + (event.clientX - this.loteDragState.startX);
    const y = this.loteDragState.originY + (event.clientY - this.loteDragState.startY);
    this.mapService.moveLoteWindow(this.loteDragState.id, x, y);
  }

  /**
   * Finaliza el arrastre de la ventana.
   */
  endLoteDrag(): void {
    this.loteDragState = null;
  }

  /**
   * Trae la ventana al frente cuando el usuario interactúa con ella.
   */
  focusLote(win: LoteInfoWindow): void {
    this.mapService.bringLoteToFront(win.id);
  }

  /**
   * Cierra una ventana flotante de información del lote.
   */
  closeLoteWindow(id: string): void {
    this.mapService.closeLoteWindow(id);
    this.loteWindowsLoaded.update(s => { const n = new Set(s); n.delete(id); return n; });
  }

  /**
   * Indica si el iframe de la ventana de lote indicada ya terminó de cargar.
   * @param id Identificador de la ventana de lote.
   */
  isLoteWindowLoaded(id: string): boolean {
    return this.loteWindowsLoaded().has(id);
  }

  /**
   * Marca como cargada la ventana de lote indicada (disparado por el evento
   * load del iframe) para ocultar el indicador de carga.
   * @param id Identificador de la ventana de lote.
   */
  onLoteIframeLoad(id: string): void {
    // Si ya estaba registrado, no reescribimos la signal: evita disparar
    // ciclos de detección de cambios innecesarios con cada recarga.
    if (this.loteWindowsLoaded().has(id)) return;
    this.loteWindowsLoaded.update(s => { const n = new Set(s); n.add(id); return n; });
  }

  /**
   * Cierra el modal de la foto del dron de 2018.
   */
  closeFotoDroneModal2018(): void {
    this.mapService.clearFotoDroneUrl2018();
  }

  /**
   * Cierra el modal de la foto del dron de 2024.
   */
  closeFotoDroneModal2024(): void {
    this.mapService.clearFotoDroneUrl2024();
  }

  /**
   * Cierra el modal del punto geodésico.
   */
  closePtoGeodesicoModal(): void {
    this.mapService.clearPtoGeodesicoUrl();
  }

  /**
   * Cierra el modal del arbolado urbano 2015.
   */
  closeArboladoUrbano2015Modal(): void {
    this.mapService.clearArboladoUrbano2015Url();
  }

  /**
   * Cierra el modal del levantamiento topográfico (TUSNE).
   */
  closeTusneModal(): void {
    this.mapService.clearTusneUrl();
  }

  /**
   * Cierra el modal del cruce de accesibilidad.
   */
  closeCruceAccesibilidadModal(): void {
    const url = this.mapService.cruceAccesibilidadUrl();
    if (url) {
      this.clearIframeError(url);
      this.iframeLoaded.update(loaded => { const s = new Set(loaded); s.delete(url); return s; });
    }
    this.mapService.clearCruceAccesibilidadUrl();
  }

  /**
   * Cierra el modal de la manzana de accesibilidad.
   */
  closeCruceAccesibilidadManzanaModal(): void {
    const url = this.mapService.cruceAccesibilidadManzanaUrl();
    if (url) {
      this.clearIframeError(url);
      this.iframeLoaded.update(loaded => { const s = new Set(loaded); s.delete(url); return s; });
    }
    this.mapService.clearCruceAccesibilidadManzanaUrl();
  }

  /**
   * Verifica si una URL tuvo error de carga en el iframe.
   */
  hasIframeError(url: string): boolean {
    return this.iframeErrors().has(url);
  }

  /**
   * Verifica si un iframe ha cargado correctamente.
   */
  isIframeLoaded(url: string): boolean {
    return this.iframeLoaded().has(url);
  }

  /**
   * Maneja el evento de carga exitosa del iframe.
   */
  onIframeLoad(url: string): void {
    this.iframeLoaded.update(loaded => {
      const newLoaded = new Set(loaded);
      newLoaded.add(url);
      return newLoaded;
    });
  }

  /**
   * Maneja el error de carga de un iframe.
   */
  onIframeError(url: string): void {
    this.iframeErrors.update(errors => {
      const newErrors = new Set(errors);
      newErrors.add(url);
      return newErrors;
    });
  }

  /**
   * Limpia el error de carga de un iframe (para reintentos).
   */
  clearIframeError(url: string): void {
    this.iframeErrors.update(errors => {
      const newErrors = new Set(errors);
      newErrors.delete(url);
      return newErrors;
    });
    // También limpiamos el estado de cargado para que reaparezca el spinner
    this.iframeLoaded.update(loaded => {
      const newLoaded = new Set(loaded);
      newLoaded.delete(url);
      return newLoaded;
    });
  }

  /**
   * Reintenta cargar la URL en el iframe.
   */
  retryIframe(url: string): void {
    this.clearIframeError(url);
  }

  // ========== Métodos de arrastre para modales ==========

  /** Inicia el arrastre del modal de cruces */
  startCruceDrag(event: PointerEvent): void {
    if (event.button !== 0) return;
    event.preventDefault();
    this.cruceDragState = {
      startX: event.clientX,
      startY: event.clientY,
      originX: this.cruceModalPosition().x,
      originY: this.cruceModalPosition().y
    };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  /** Arrastra el modal de cruces */
  dragCruce(event: PointerEvent): void {
    if (!this.cruceDragState) return;
    const nx = this.cruceDragState.originX + (event.clientX - this.cruceDragState.startX);
    const ny = this.cruceDragState.originY + (event.clientY - this.cruceDragState.startY);
    this.cruceModalPosition.set({ x: nx, y: ny });
  }

  /** Finaliza el arrastre del modal de cruces */
  endCruceDrag(): void {
    this.cruceDragState = null;
  }

  /** Inicia el arrastre del modal de manzanas */
  startManzanaDrag(event: PointerEvent): void {
    if (event.button !== 0) return;
    event.preventDefault();
    this.manzanaDragState = {
      startX: event.clientX,
      startY: event.clientY,
      originX: this.manzanaModalPosition().x,
      originY: this.manzanaModalPosition().y
    };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  /** Arrastra el modal de manzanas */
  dragManzana(event: PointerEvent): void {
    if (!this.manzanaDragState) return;
    const nx = this.manzanaDragState.originX + (event.clientX - this.manzanaDragState.startX);
    const ny = this.manzanaDragState.originY + (event.clientY - this.manzanaDragState.startY);
    this.manzanaModalPosition.set({ x: nx, y: ny });
  }

  /** Finaliza el arrastre del modal de manzanas */
  endManzanaDrag(): void {
    this.manzanaDragState = null;
  }

  /**
   * Abre el modal de inicio de sesión.
   */
  openLoginModal(): void {
    this.showLoginModal.set(true);
  }
  /**
   * Cierra el modal de inicio de sesión.
   */
    closeLoginModal(): void {
    this.showLoginModal.set(false);
  }

  /**
   * Inicia el recorrido interactivo del visor (driver.js).
   * Se delega al `DriverService` singleton.
   */
  startTour(): void {
    this.driverService.startTour();
  }

  /**
   * Cierra la ventana flotante de la leyenda (botón X de la propia ventana).
   * Apaga la señal dedicada `leyendaVisible` del MapService, lo que oculta
   * el <app-leyenda> renderizado condicionalmente en la plantilla. No toca
   * las herramientas activas del sidebar.
   */
  closeLeyenda(): void {
    this.mapService.closeLeyenda();
  }

  /**
   * Caché de URLs ya sanitizadas, indexada por la URL de origen.
   * CRÍTICO: `bypassSecurityTrustResourceUrl` devuelve un objeto nuevo en cada
   * llamada; si el binding [src] del iframe recibiera una instancia distinta en
   * cada ciclo de detección de cambios, Angular reescribiría el atributo `src`
   * y el iframe se recargaría indefinidamente (bucle de peticiones que congela
   * la interfaz y satura la red).
   */
  private readonly safeUrlCache = new Map<string, SafeResourceUrl>();

  /**
   * Sanitiza la URL para que sea segura de usar en un iframe, reutilizando el
   * resultado si la URL ya fue sanitizada (binding estable entre ciclos de CD).
   * @param url La URL a sanitizar.
   * @returns Una URL segura para recursos.
   */
  getSafeUrl(url: string): SafeResourceUrl {
    let safe = this.safeUrlCache.get(url);
    if (!safe) {
      safe = this.sanitizer.bypassSecurityTrustResourceUrl(url);
      this.safeUrlCache.set(url, safe);
    }
    return safe;
  }

  /**
   * Maneja el evento de apertura/cierre del sidebar para desplazar el mapa.
   * @param isOpen El estado de apertura del sidebar.
   */
  handleSidebarToggle(isOpen: boolean): void {
    // El ancho del sidebar es de 400px según su CSS.
    this.mapService.panMapForSidebar(isOpen, 400);
  }
}

