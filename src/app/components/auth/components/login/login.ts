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

  /**
   * Credenciales de DEMOSTRACIÓN mientras no exista backend real.
   * Al conectar el servicio HTTP de autenticación, reemplazar la
   * comparación de `enviar()` por la llamada al API.
   */
  private readonly DEMO_USUARIO = 'admin';
  private readonly DEMO_CLAVE = '1234';

  private timeoutId?: ReturnType<typeof setTimeout>;

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
    if (this.timeoutId !== undefined) {
      clearTimeout(this.timeoutId);
    }
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

  /** Envío del formulario: valida y ejecuta la autenticación simulada. */
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

    // Autenticación simulada (800 ms). Reemplazar por HTTP real.
    this.timeoutId = setTimeout(() => {
      this.cargando.set(false);

      if (user.toLowerCase() === this.DEMO_USUARIO && pass === this.DEMO_CLAVE) {
        if (this.recordarme) {
          localStorage.setItem(CLAVE_RECORDADA, user);
        } else {
          localStorage.removeItem(CLAVE_RECORDADA);
        }
        this.authService.login(user); // Cambia el estado de autenticación y guarda el nombre de usuario
        this.close.emit();        // Cierra el modal
      } else {
        this.error.set('Usuario o contraseña incorrectos.');
        this.clave = '';
        this.claveInput?.nativeElement.focus();
      }
    }, 800);
  }
}
