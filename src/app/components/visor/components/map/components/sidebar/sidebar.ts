import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';


import { CapasComponent } from './components/capas/capas';
import { Buscar } from './components/buscar/buscar';
import { Leyenda } from './components/leyenda/leyenda';
import { MapService } from '../../../../../../services/map.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CapasComponent,
    Buscar,
    Leyenda,
  ],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class Sidebar implements OnInit {
  public mapService = inject(MapService);

  /** Exponemos el signal para que el template sepa cuál está activo visualmente */
  activeTools = this.mapService.activeSidebarTools;

  isOpen = false;

  // Ítems de navegación vinculados a las herramientas del MapService
  menuItems: { id: string; icon: string; label: string }[] = [
    { id: 'search', icon: 'search', label: 'Buscar' },
    { id: 'layers', icon: 'layers', label: 'Capas' },
    { id: 'legend', icon: 'legend_toggle', label: 'Leyenda' },
    { id: 'print', icon: 'print', label: 'Imprimir' },
    { id: 'settings', icon: 'settings', label: 'Configuración' },
    { id: 'info', icon: 'info', label: 'Acerca' }
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

  ngOnInit() {
    // La alineación del estado inicial se gestiona a través de los Signals del MapService
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
