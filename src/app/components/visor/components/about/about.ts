import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './about.html',
  styleUrl: './about.css',
})
export class About {
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
