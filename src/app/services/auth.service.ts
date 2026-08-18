import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  // Señal para rastrear el estado de autenticación del usuario.
  public isAuthenticated = signal<boolean>(false);

  // Señal para el contador de visitas.
  public visitCount = signal<number>(this.initializeVisitCount());

  constructor() { }

  // Simula el inicio de sesión.
  login(): void {
    this.isAuthenticated.set(true);
  }

  // Simula el cierre de sesión.
  logout(): void {
    this.isAuthenticated.set(false);
  }

  // Inicializa el contador de visitas con un número aleatorio para simulación.
  private initializeVisitCount(): number {
    // En una aplicación real, este valor vendría de un backend.
    return Math.floor(Math.random() * (15000 - 5000 + 1)) + 5000;
  }
}