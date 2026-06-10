import { Component, ElementRef, ViewChild, afterNextRender, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
// Servicios y módulos
import { MapService } from '../../../../services/map.service';
// Componentes relacionados
import { Navbar } from './components/navbar/navbar';
import { Sidebar } from './components/sidebar/sidebar';
import { Funciones } from './components/functions/functions';
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
  ],
  templateUrl: './map.html',
  styleUrl: './map.css',
})
export class MapComponent {
  /** Referencia al contenedor principal donde se inyecta el lienzo de OpenLayers */
  @ViewChild('mapContainer') mapContainer!: ElementRef;

  private readonly mapService = inject(MapService);
  private readonly cdr = inject(ChangeDetectorRef);
  constructor() {
    // afterNextRender asegura que el mapa se inicialice solo en el cliente (navegador)
    afterNextRender(() => {
      this.initMap();
    });
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
