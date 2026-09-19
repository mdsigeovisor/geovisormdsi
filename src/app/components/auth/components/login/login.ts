import {
  Component,
  Output,
  EventEmitter,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnDestroy,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, take } from 'rxjs';
import { AuthService } from '../../../../services/auth.service';

const CLAVE_RECORDADA = 'gmsi_usuario_recordado';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login implements AfterViewInit, OnDestroy {
  @Output() close = new EventEmitter<void>();
  private readonly authService = inject(AuthService);

  /** Referencias a los campos para gestión de foco. */
  @ViewChild('usuarioInput') usuarioInput?: ElementRef<HTMLInputElement>;
  @ViewChild('claveInput') claveInput?: ElementRef<HTMLInputElement>;

  /** Campos del formulario. */
  usuario = '';
  clave = '';
  recordarme = false;

  /** Estados de la interfaz. */
  cargando = signal(false);
  error = signal<string | null>(null);
  mostrarClave = signal(false);

  /** Petición de login en curso (se cancela al destruir el modal). */
  private peticionLogin?: Subscription;

  constructor() {
    // Restaura el usuario recordado de una sesión anterior (localStorage).
    const recordado = localStorage.getItem(CLAVE_RECORDADA);
    if (recordado) {
      this.usuario = recordado;
      this.recordarme = true;
    }
  }

  ngAfterViewInit(): void {
    // Foco inicial: si el usuario ya estaba recordado, directo a la contraseña.
    const campo = this.recordarme ? this.claveInput : this.usuarioInput;
    campo?.nativeElement.focus();
  }

  ngOnDestroy(): void {
    // Evita actualizar el estado de un componente ya destruido.
    this.peticionLogin?.unsubscribe();
  }

  /** Escape cierra el modal (excepto mientras se está autenticando). */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (!this.cargando()) {
      this.close.emit();
    }
  }

  /** Cancelar (X, botón o clic en el fondo). Bloqueado durante la verificación. */
  cancelar(): void {
    if (!this.cargando()) {
      this.close.emit();
    }
  }

  /**
   * Envío del formulario: valida los campos y autentica contra el API de
   * seguridad (`POST /WSGEOVISOR/api/seguridad/auth/iniciar-sesion`).
   */
  enviar(): void {
    if (this.cargando()) return;

    const user = this.usuario.trim();
    const pass = this.clave;

    // Validaciones con foco en el campo inválido.
    if (!user && !pass) {
      this.error.set('Ingrese su usuario y contraseña.');
      this.usuarioInput?.nativeElement.focus();
      return;
    }
    if (!user) {
      this.error.set('Ingrese su usuario o correo electrónico.');
      this.usuarioInput?.nativeElement.focus();
      return;
    }
    if (!pass) {
      this.error.set('Ingrese su contraseña.');
      this.claveInput?.nativeElement.focus();
      return;
    }

    this.error.set(null);
    this.cargando.set(true);

    // El servicio ya normaliza los errores: siempre llega `error.message` listo
    // para mostrar (credenciales inválidas, usuario bloqueado, sin conexión…).
    this.peticionLogin?.unsubscribe();
    this.peticionLogin = this.authService.iniciarSesion(user, pass).pipe(take(1)).subscribe({
      next: () => {
        this.cargando.set(false);
        // Solo se recuerda el nombre de usuario, nunca la contraseña.
        if (this.recordarme) {
          localStorage.setItem(CLAVE_RECORDADA, user);
        } else {
          localStorage.removeItem(CLAVE_RECORDADA);
        }
        this.close.emit(); // Cierra el modal: el navbar ya muestra al usuario
      },
      error: (error: Error) => {
        this.cargando.set(false);
        this.error.set(error?.message || 'No se pudo iniciar sesión. Intente nuevamente.');
        this.clave = '';
        this.claveInput?.nativeElement.focus();
      }
    });
  }
}
