import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-bienvenido',
  standalone: true,
  imports: [
    RouterLink,
    FormsModule,
  ],
  templateUrl: './bienvenido.html',
  styleUrl: './bienvenido.css',
})
export class Bienvenido {
  termsAccepted = false;
  currentYear: number = new Date().getFullYear();

  onLogin(): void {
    console.log('Iniciar sesión');
  }

  onGuestAccess(): void {
    console.log('Consulta como invitado');
  }
}
