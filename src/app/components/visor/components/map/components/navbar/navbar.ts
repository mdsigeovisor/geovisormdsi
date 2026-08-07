import { Component, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { environment } from '../../../../../../../environments/environment';


@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './navbar.html',
  // Asumo que no hay un css específico o que está en línea con el html
})
export class Navbar {
  public version = environment.version;
  public showLogoutModal = signal(false);

  @HostListener('document:keydown.escape', ['$event'])
  onKeydownHandler(event: KeyboardEvent) {
    if (this.showLogoutModal()) {
      this.cancelLogout();
    }
  }

  openLogoutModal(): void {
    this.showLogoutModal.set(true);
  }

  cancelLogout(): void {
    this.showLogoutModal.set(false);
  }

  confirmLogout(): void {
    console.log('Cerrando sesión desde navbar.ts...');
    this.showLogoutModal.set(true);
    // Nota: Por seguridad, los navegadores modernos solo permiten que los scripts
    // cierren ventanas que ellos mismos abrieron. Si el usuario abrió la pestaña
    // manualmente, window.close() no funcionará. Una alternativa fiable es
    // redirigir a una página en blanco.
    window.location.href = 'about:blank';
  }
}