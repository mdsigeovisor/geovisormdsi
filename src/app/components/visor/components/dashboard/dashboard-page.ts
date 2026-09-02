import { Component } from '@angular/core';
import { Dashboard } from './dashboard';

/**
 * Componente contenedor de la ruta `/visor/dashboard`.
 * Renderiza el Dashboard en modo página completa (fullPage=true).
 */
@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [Dashboard],
  template: `<app-dashboard [fullPage]="true"></app-dashboard>`,
})
export class DashboardPage {}