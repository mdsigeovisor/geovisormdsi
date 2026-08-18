import { Component, EventEmitter, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {
  @Output() close = new EventEmitter<void>();
  private readonly authService = inject(AuthService);

  handleLogin(): void {
    this.authService.login(); // Cambia el estado de autenticación
    this.close.emit(); // Emite el evento para cerrar el modal
  }
}