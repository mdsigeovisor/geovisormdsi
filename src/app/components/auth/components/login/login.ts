import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output } from '@angular/core'; // Removed inject, Router

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  @Output() close = new EventEmitter<void>(); // Emit event to close modal

  handleLogin(): void {
    console.log('Iniciando sesión...');
    this.close.emit(); // Emit close event after simulated login
  }
}
