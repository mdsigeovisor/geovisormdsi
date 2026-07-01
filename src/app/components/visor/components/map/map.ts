import { Component, ElementRef, ViewChild, afterNextRender, inject, ChangeDetectorRef, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
// Servicios y módulos
import { MapService } from '../../../../services/map.service';
// Componentes relacionados
import { Navbar } from './components/navbar/navbar';
import { Sidebar } from './components/sidebar/sidebar';
import { Funciones } from './components/functions/functions';
import { Spinner } from '../../../../animations/spinner/spinner';
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
    Spinner,
  ],
  templateUrl: './map.html',
  styleUrl: './map.css',
})
export class MapComponent {
  /** Referencia al contenedor principal donde se inyecta el lienzo de OpenLayers */
  @ViewChild('mapContainer') mapContainer!: ElementRef;

  /** Referencia al componente de funciones para invocar sus métodos. */
  @ViewChild(Funciones) funcionesComponent!: Funciones;

  public readonly mapService = inject(MapService);
  private readonly cdr = inject(ChangeDetectorRef);

  constructor() {
    // Usamos un 'effect' para reaccionar a los cambios de la signal 'isReady'.
    // El effect debe crearse en el constructor para tener un contexto de inyección.
    effect(() => {
      if (this.mapService.isReady()) {
        setTimeout(() => {
          this.funcionesComponent.goHome();
        }, 5000); // 5 segundos
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
    this.mapService.initMap(this.mapContainer.nativeElement);

    this.cdr.detectChanges();
  }
}
