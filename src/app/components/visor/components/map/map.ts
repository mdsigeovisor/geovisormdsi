import { Component, ElementRef, ViewChild, afterNextRender, inject, ChangeDetectorRef, effect, HostListener, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
// Servicios y módulos
import { MapService } from '../../../../services/map.service';
import { DrawMeasureService } from '../../../../services/draw.service';
// Componentes relacionados
import { Navbar } from './components/navbar/navbar';
import { Sidebar } from './components/sidebar/sidebar';
import { Funciones } from './components/functions/functions';
import { Spinner } from '../../../../animations/spinner/spinner';
import { Login } from '../../../auth/components/login/login'; // Import Login component
import { CoordinateInfo } from './components/coordinate-info/coordinate-info';
import { TermsModal } from './components/terms-modal/terms-modal';
/**
 * Componente principal de la interfaz del mapa.
 * Coordina la visualización de la barra de herramientas, barra lateral y los controles
 * interactivos del mapa central.
 */
@Component({
  selector: 'app-map',
  standalone: true,
  imports: [
    CommonModule,
    Navbar,
    Sidebar,    
    Funciones,
    Login, // Add Login to imports
    Spinner,
    CoordinateInfo,
    TermsModal,
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

  public readonly mapService = inject(MapService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly drawMeasureService = inject(DrawMeasureService);

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
    if (this.mapService.loteInfoUrl()) {
      this.closeLoteModal();
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
    if (this.mapService.showTermsModal()) {
      this.mapService.closeTermsModal();
    }
  }
  /**
   * Cierra el modal de información del lote.
   */
  closeLoteModal(): void {
    this.mapService.clearLoteInfo();
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
   * Sanitiza la URL para que sea segura de usar en un iframe.
   * @param url La URL a sanitizar.
   * @returns Una URL segura para recursos.
   */
  getSafeUrl(url: string): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
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
