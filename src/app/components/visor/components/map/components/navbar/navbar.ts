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
  public visitCount = this.authService.visitCount;
  public cargandoVisitas = this.authService.cargandoVisitas;
  public showLogoutModal = signal(false);

  /** URL de la encuesta de salida (abierta al cerrar sesión). */
  private readonly encuestaSalidaUrl = environment.encuestaSalidaUrl;
  /** URL del Observatorio Urbano (abierta en otra pestaña). */
  private readonly observatorioUrl = environment.observatorioUrl;

  /**
   * Formatea el número de visitas para una mejor legibilidad.
   * - Menor a 1,000: número completo (ej: 999)
   * - 1,000 a 999,999: formato K (ej: 1.5K, 999.9K)
   * - 1,000,000+: formato M (ej: 1.2M, 15.8M)
   */
  formatearVisitas(valor: number): string {
    if (valor >= 1_000_000) {
      const millones = valor / 1_000_000;
      return millones.toFixed(millones >= 10 ? 0 : 1) + 'M';
    }
    if (valor >= 1_000) {
      const miles = valor / 1_000;
      return miles.toFixed(miles >= 10 ? 0 : 1) + 'K';
    }
    return valor.toString();
  }

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
