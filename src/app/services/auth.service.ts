import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);

  // Configuración del contador de visitas (centralizado en environment.ts).
  private readonly contador = environment.visitCounter;

  // Clave para localStorage: solo se usa como RESPALDO (si la API no responde),
  // nunca se suma a la API para no duplicar visitas.
  private readonly LOCAL_KEY = 'geovisor_visitas_local';

  // Señal para rastrear el estado de autenticación del usuario.
  public isAuthenticated = signal<boolean>(false);

  // Señal con el nombre de usuario que inició sesión.
  public userName = signal<string>('');

  // Señal para el contador de visitas (fuente única de verdad: la API).
  public visitCount = signal<number>(0);

  // Estado de carga del contador
  public cargandoVisitas = signal<boolean>(true);

  constructor() {
    if (this.contador.enabled) {
      this.inicializarContador();
    } else {
      this.cargandoVisitas.set(false);
    }
  }

  /**
   * Construye la URL base del contador (endpoint + namespace + clave).
   */
  private urlContador(): string {
    return `${this.contador.apiBase}/${this.contador.namespace}/${this.contador.key}`;
  }

  /**
   * Inicializa el contador al cargar la aplicación.
   * Incrementa la visita en la API (+1) y muestra el total GLOBAL.
   * Los contadores locales solo sirven como respaldo temporal si la API
   * no responde; NUNCA se suman a la API (evita el doble conteo).
   */
  private async inicializarContador(): Promise<void> {
    this.cargandoVisitas.set(true);
    try {
      // /up incrementa en +1 el contador global y devuelve el nuevo total.
      const response = await firstValueFrom(
        this.http.get<{ count: number }>(`${this.urlContador()}/up`)
      );
      this.visitCount.set(response.count);
    } catch (error) {
      console.error('Error al obtener contador de API, usando respaldo local:', error);
      // Respaldo: incrementar y mostrar solo las visitas locales registradas.
      this.incrementarVisitaLocal();
      this.visitCount.set(this.obtenerVisitasLocales());
    } finally {
      this.cargandoVisitas.set(false);
    }
  }

  /**
   * Registra una visita consumiendo la API del contador.
   * Incrementa el contador global en +1 y actualiza el valor mostrado.
   */
  async registrarVisita(): Promise<void> {
    this.cargandoVisitas.set(true);
    try {
      const response = await firstValueFrom(
        this.http.get<{ count: number }>(`${this.urlContador()}/up`)
      );
      this.visitCount.set(response.count);
    } catch (error) {
      console.error('Error al registrar visita, usando respaldo local:', error);
      this.incrementarVisitaLocal();
      this.visitCount.set(this.obtenerVisitasLocales());
    } finally {
      this.cargandoVisitas.set(false);
    }
  }

  /**
   * Reinicia el contador a 0 (solo para administración).
   */
  async reiniciarContador(): Promise<void> {
    this.cargandoVisitas.set(true);
    try {
      const response = await firstValueFrom(
        this.http.get<{ count: number }>(`${this.urlContador()}/set?count=0`)
      );
      this.visitCount.set(response.count);
    } catch (error) {
      console.error('Error al reiniciar contador:', error);
      this.visitCount.set(0);
    } finally {
      localStorage.removeItem(this.LOCAL_KEY);
      this.cargandoVisitas.set(false);
    }
  }

  /**
   * Obtiene el número de visitas de respaldo almacenadas localmente.
   */
  private obtenerVisitasLocales(): number {
    const stored = localStorage.getItem(this.LOCAL_KEY);
    return stored ? parseInt(stored, 10) : 0;
  }

  /**
   * Incrementa el contador de respaldo local en 1.
   */
  private incrementarVisitaLocal(): void {
    const actuales = this.obtenerVisitasLocales();
    localStorage.setItem(this.LOCAL_KEY, (actuales + 1).toString());
  }

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