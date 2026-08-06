import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
//Servicio
import { MapService } from '../../../../../../services/map.service';
//Componentes
import { CapasComponent } from './components/capas/capas';
import { Consultas } from './components/consultas/consultas';
import { Leyenda } from './components/leyenda/leyenda';
import { Descargaspdf } from './components/descargaspdf/descargaspdf';
import { Imprimir } from './components/imprimir/imprimir';
import { UbicacionCoordenadas } from './components/coordenadas/coordenadas';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    CapasComponent,    
    CommonModule,
    Consultas,
    Descargaspdf,        
    FormsModule,
    Leyenda,
    Imprimir,
    UbicacionCoordenadas

  ],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class Sidebar implements OnInit {
  ngOnInit(): void {
    
  }
  public mapService = inject(MapService);
  /** Exponemos el signal para que el template sepa cuál está activo visualmente */
  activeTools = this.mapService.activeSidebarTools;
  isOpen = false;
  // Ítems de navegación vinculados a las herramientas del MapService
  menuItems: { id: string; icon: string; label: string }[] = [
    { id: 'search', icon: 'bi-search', label: 'Consultas'},
    { id: 'layers', icon: 'bi-layers', label: 'Capas'},
    { id: 'legend', icon: 'bi bi-map-fill', label: 'Leyenda'},
    { id: 'coordenadas', icon: 'bi bi-geo', label: 'Busqueda por Coordenadas'},
    { id: 'print', icon: 'bi-printer', label: 'Imprimir'},
    { id: 'downloads', icon: 'bi-download', label: 'Descargas'},
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
  toggleSidebar() {
    this.isOpen = !this.isOpen;
  }
  toggleTool(toolId: string) {
    console.log('Sidebar: Recibida orden de toggle para', toolId);
    const item = this.menuItems.find(i => i.id === toolId);
    if (item) {
      this.setActive(item.id);
    }
  }
  setActive(toolId: string) {
    const currentActive = this.activeTab;
    if (currentActive === toolId) {
      // Si es la misma, cerramos el panel
      this.isOpen = false;
      this.mapService.toggleSidebarTool(toolId);
    } else {
      // Si hay una activa diferente, primero la quitamos y ponemos la nueva
      if (currentActive) this.mapService.toggleSidebarTool(currentActive);
      this.mapService.toggleSidebarTool(toolId);
      this.isOpen = true;
    }
  }
}
