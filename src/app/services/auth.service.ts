import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  // Señal para rastrear el estado de autenticación del usuario.
  public isAuthenticated = signal<boolean>(false);

  // Señal con el nombre de usuario que inició sesión.
  public userName = signal<string>('');

  // Simula el inicio de sesión.
  login(username?: string): void {
    this.isAuthenticated.set(true);
    this.userName.set(username ?? '');
  }

  // Simula el cierre de sesión.
  logout(): void {
    this.isAuthenticated.set(false);
    this.userName.set('');
  }
}