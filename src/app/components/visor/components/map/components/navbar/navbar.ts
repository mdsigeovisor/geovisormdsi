import { Component, inject, Input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../../../../../services/auth.service';
import { environment } from '../../../../../../../environments/environment';


@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css'
})
export class Navbar {
  /** Estado del tour activo (proyectado desde MapComponent vía DriverService). */
  @Input() tourActivo = false;
  login = output<void>();
  logout = output<void>();
  tour = output<void>();
  dashboard = output<void>();

  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  public isAuthenticated = this.authService.isAuthenticated;
  public userName = this.authService.userName;
  public showLogoutModal = signal(false);

  /** URL de la encuesta de salida (abierta al cerrar sesión). */
  private readonly encuestaSalidaUrl = environment.encuestaSalidaUrl;
  /** URL del Observatorio Urbano (abierta en otra pestaña). */
  private readonly observatorioUrl = environment.observatorioUrl;

  onLoginClick(): void {
    if (this.isAuthenticated()) {
      this.showLogoutModal.set(true);
    } else {
      this.login.emit();
    }
  }

  /** Inicia el recorrido interactivo (driver.js). */
  onTourClick(): void {
    this.tour.emit();
  }
  onDashboardClick(): void {
    this.router.navigate(['/visor/dashboard']);
  }
  /** Maneja la selección del selector de herramientas (Tour / Dashboard / Observatorio). */
  onOpcionSeleccionada(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const opcion = select.value;
    // Reinicia el selector a "Herramientas" para que se pueda volver a elegir.
    select.value = '';
    switch (opcion) {
      case 'tour':
        this.onTourClick();
        break;
      case 'dashboard':
        this.onDashboardClick();
        break;
      case 'observatorio':
        window.open(this.observatorioUrl, '_blank', 'noopener,noreferrer');
        break;
    }
  }
  confirmLogout(): void {
    this.authService.logout();
    this.showLogoutModal.set(false);
    // Abre la encuesta de salida en una pestaña nueva.
    window.open(this.encuestaSalidaUrl, '_blank', 'noopener,noreferrer');
    // Opcional: Redirigir a la página de inicio o recargar.
    // window.location.reload();
  }
  cancelLogout(): void {
    this.showLogoutModal.set(false);
  }
}
