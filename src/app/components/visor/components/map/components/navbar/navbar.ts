import { Component, inject, Input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../../../../services/auth.service';


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

  private readonly authService = inject(AuthService);
  public isAuthenticated = this.authService.isAuthenticated;
  public visitCount = this.authService.visitCount;
  public showLogoutModal = signal(false);

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
  confirmLogout(): void {
    this.authService.logout();
    this.showLogoutModal.set(false);
    // Opcional: Redirigir a la página de inicio o recargar.
    // window.location.reload();
  }
  cancelLogout(): void {
    this.showLogoutModal.set(false);
  }
}