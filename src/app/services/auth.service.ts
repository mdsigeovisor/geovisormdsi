import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);

  // Espacio de nombres y clave para CounterAPI
  private readonly NAMESPACE = 'munisanisidro_geovisor_visitas';
  private readonly KEY = 'visitas';
  private readonly API_BASE = 'https://api.counterapi.dev/v1';

  // Clave para localStorage
  private readonly LOCAL_KEY = 'geovisor_visitas_local';

  // Señal para rastrear el estado de autenticación del usuario.
  public isAuthenticated = signal<boolean>(false);

  // Señal para el contador de visitas.
  public visitCount = signal<number>(0);

  // Estado de carga del contador
  public cargandoVisitas = signal<boolean>(true);

  constructor() {
    this.inicializarContador();
  }

  /**
   * Inicializa el contador: obtiene el valor de la API y sincroniza con localStorage.
   */
  private async inicializarContador(): Promise<void> {
    this.cargandoVisitas.set(true);

    // Obtener visitas locales almacenadas
    const visitasLocales = this.obtenerVisitasLocales();

    try {
      // Obtener contador de la API
      const url = `${this.API_BASE}/${this.NAMESPACE}/${this.KEY}/up`;
      const response = await firstValueFrom(
        this.http.get<{ count: number }>(url)
      );

      // Sumar visitas locales a las de la API (por si la API no contó algunas)
      const total = response.count + visitasLocales;
      this.visitCount.set(total);
    } catch (error) {
      console.error('Error al obtener contador de API:', error);
      // En caso de error, usar visitas locales + 1
      const total = visitasLocales + 1;
      this.visitCount.set(total);
    } finally {
      // Incrementar visita local
      this.incrementarVisitaLocal();
      this.cargandoVisitas.set(false);
    }
  }

  /**
   * Registra una visita consumiendo CounterAPI.dev.
   * Incrementa el contador en +1 y actualiza el valor mostrado.
   */
  async registrarVisita(): Promise<void> {
    this.cargandoVisitas.set(true);
    try {
      const url = `${this.API_BASE}/${this.NAMESPACE}/${this.KEY}/up`;
      const response = await firstValueFrom(
        this.http.get<{ count: number }>(url)
      );
      const visitasLocales = this.obtenerVisitasLocales();
      this.visitCount.set(response.count + visitasLocales);
    } catch (error) {
      console.error('Error al registrar visita:', error);
      this.incrementarVisitaLocal();
      this.visitCount.update(v => v + 1);
    } finally {
      this.cargandoVisitas.set(false);
    }
  }

  /**
   * Reinicia el contador de visitas a 0.
   */
  async reiniciarContador(): Promise<void> {
    this.cargandoVisitas.set(true);
    try {
      const url = `${this.API_BASE}/${this.NAMESPACE}/${this.KEY}/set?count=0`;
      const response = await firstValueFrom(
        this.http.get<{ count: number }>(url)
      );
      this.visitCount.set(response.count);
      // Limpiar contador local
      localStorage.removeItem(this.LOCAL_KEY);
    } catch (error) {
      console.error('Error al reiniciar contador:', error);
      this.visitCount.set(0);
      localStorage.removeItem(this.LOCAL_KEY);
    } finally {
      this.cargandoVisitas.set(false);
    }
  }

  /**
   * Obtiene el número de visitas almacenadas localmente.
   */
  private obtenerVisitasLocales(): number {
    const stored = localStorage.getItem(this.LOCAL_KEY);
    return stored ? parseInt(stored, 10) : 0;
  }

  /**
   * Incrementa el contador local en 1.
   */
  private incrementarVisitaLocal(): void {
    const actuales = this.obtenerVisitasLocales();
    localStorage.setItem(this.LOCAL_KEY, (actuales + 1).toString());
  }

  // Simula el inicio de sesión.
  login(): void {
    this.isAuthenticated.set(true);
  }

  // Simula el cierre de sesión.
  logout(): void {
    this.isAuthenticated.set(false);
  }
}