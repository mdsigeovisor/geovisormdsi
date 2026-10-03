import { ApplicationConfig, ErrorHandler, provideBrowserGlobalErrorListeners, inject } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { auditoriaInterceptor } from './services/auditoria.interceptor';
import { AUDITORIA_OPCIONES, AuditoriaService } from './services/auditoria.service';

/**
 * Captura los errores no controlados por la app (excepciones en un clic, en un
 * temporizador, en una promesa...) y los registra en la auditoría. Los errores
 * de las peticiones HTTP los registra `auditoriaInterceptor`, y los de las
 * acciones de usuario, los propios componentes; esto cubre el resto, que antes
 * se perdían en silencio dentro de la consola del navegador.
 */
class GlobalErrorAudit implements ErrorHandler {
  private readonly auditoria = inject(AuditoriaService);

  handleError(error: unknown): void {
    const mensaje = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    // La auditoría nunca debe propagar un error: si fallara, entraría en bucle
    // con este mismo manejador.
    try {
      this.auditoria.error(AUDITORIA_OPCIONES.ERROR_CLIENTE, mensaje, undefined, 'ERR-GLOBAL');
    } catch {
      // Sin auditoría no hay nada más que hacer que mostrar el error.
    }
    console.error(error);
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    { provide: ErrorHandler, useClass: GlobalErrorAudit },
    provideRouter(routes),
    // El interceptor de auditoría registra en mdsisicu.sicu_logmensajes toda
    // llamada al WSGEOVISOR (éxito o error) con su duración real.
    provideHttpClient(withInterceptors([auditoriaInterceptor]))
  ]
};
