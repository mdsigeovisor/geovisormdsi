import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-bienvenido',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './bienvenido.html',
  styleUrl: './bienvenido.css',
})
export class Bienvenido {
  termsAccepted = false;
  showTermsModal = false;
  showPrivacyModal = false;
  modalTermsAccepted = false;
  currentYear: number = new Date().getFullYear();

  constructor(private readonly router: Router) {}

  onLogin(): void {
    console.log('Iniciar sesión');
  }

  acceptAndEnter(): void {
    this.termsAccepted = true;
    this.showTermsModal = false;
    this.router.navigate(['/visor']);
  }

  onGuestAccess(): void {
    console.log('Consulta como invitado');
  }
}
