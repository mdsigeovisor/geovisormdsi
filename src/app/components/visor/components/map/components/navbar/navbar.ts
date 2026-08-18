import { Component, inject, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../../../../services/auth.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css'
})
export class Navbar {
  login = output<void>();
  logout = output<void>();

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