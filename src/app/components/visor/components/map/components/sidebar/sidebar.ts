import { Component, inject, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
//Servicio
import { MapService } from '../../../../../../services/map.service';
//Componentes
import { CapasComponent } from './components/capas/capas';
import { Consultas } from './components/consultas/consultas';
import { About } from './components/about/about';
import { Descargaspdf } from './components/descargaspdf/descargaspdf';
import { Imprimir } from './components/imprimir/imprimir';
import { UbicacionCoordenadas } from './components/coordenadas/coordenadas';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    About,
    CapasComponent,    
    CommonModule,
    Consultas,
    Descargaspdf,        
    FormsModule,
    Imprimir,
    UbicacionCoordenadas

  ],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class Sidebar  {  
  /** Emite el estado de apertura del sidebar (true: abierto, false: cerrado) */
  @Output() onToggle = new EventEmitter<boolean>();
  public mapService = inject(MapService);
  /** Exponemos el signal para que el template sepa cuál está activo visualmente */
  activeTools = this.mapService.activeSidebarTools;
  isOpen = false;
  // Ítems de navegación vinculados a las herramientas del MapService
  menuItems: { id: string; icon: string; label: string}[] = [
    { id: 'search', icon: 'bi-search', label: 'Consultas'},
    { id: 'layers', icon: 'bi-layers', label: 'Capas'},
    { id: 'legend', icon: 'bi bi-map-fill', label: 'Leyenda'},
    { id: 'coordenadas', icon: 'bi bi-geo', label: 'Busqueda por Coordenadas'},
    { id: 'print', icon: 'bi-printer', label: 'Imprimir'},    
    { id: 'downloads', icon: 'bi-download', label: 'Descargas'},
    //{ id: 'about', icon: 'bi-info-circle', label: 'Acerca de'},
  ];
  /** Obtiene el ID de la primera herramienta activa del Set */
  get activeTab(): string | undefined {
    return Array.from(this.activeTools()).pop();
  }
  /** Obtiene el título amigable de la herramienta activa */
  get activeTitle(): string {
    const active = this.activeTab;
    if (!active) return '';
    return this.menuItems.find(i => i.id === active)?.label || 'Herramienta';
  }
  /**
   * Resaltado del menú lateral. La leyenda usa su propia señal
   * (`leyendaVisible`) porque no vive en el Set de herramientas; el resto
   * de opciones se resaltan según el Set de herramienta activa.
   */
  isActive(toolId: string): boolean {
    return toolId === 'legend'
      ? this.mapService.leyendaVisible()
      : this.activeTools().has(toolId);
  }
  toggleSidebar() {
    this.isOpen = !this.isOpen;
    this.onToggle.emit(this.isOpen);
  }
  toggleTool(toolId: string) {
    console.log('Sidebar: Recibida orden de toggle para', toolId);
    const item = this.menuItems.find(i => i.id === toolId);
    if (item) this.setActive(item.id);
  }
  setActive(toolId: string) {
    // "Acerca de" se muestra como tarjeta flotante sobre el mapa,
    // por lo que no debe abrir el panel lateral deslizable.
    if (toolId === 'about') {
      const previous = this.activeTab;
      if (previous && previous !== 'about') {
        // Si había otra herramienta activa, la cerramos junto con el panel
        this.mapService.toggleSidebarTool(previous);
        if (this.isOpen) {
          this.isOpen = false;
          this.onToggle.emit(false);
        }
      }
      this.mapService.toggleSidebarTool('about');
      return;
    }
    // La leyenda es una ventana flotante FIJA con señal propia (`leyendaVisible`):
    // solo se alterna esa señal. No abre el panel deslizable, no toca el Set de
    // herramientas y ninguna otra opción del menú puede cerrarla o borrarla.
    if (toolId === 'legend') {
      this.mapService.toggleLeyenda();
      return;
    }
    const currentActive = this.activeTab;
    const wasOpen = this.isOpen; // Guardamos el estado anterior
    if (currentActive === toolId) {
      // Si es la misma, cerramos el panel
      this.isOpen = false;
      if (wasOpen) this.onToggle.emit(false); // Solo emitir si estaba abierto
      this.mapService.toggleSidebarTool(toolId);
    } else {
      // Si hay una activa diferente, primero la quitamos y ponemos la nueva
      if (currentActive) this.mapService.toggleSidebarTool(currentActive);
      this.mapService.toggleSidebarTool(toolId);
      this.isOpen = true;
      if (!wasOpen) this.onToggle.emit(true); // Solo emitir si estaba cerrado
    }
  }
  /** Cierra la tarjeta flotante de "Acerca de" */
  closeAbout() {
    this.mapService.toggleSidebarTool('about');
  }
}
