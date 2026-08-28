import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
//Servicio
import { MapService } from '@app/services/map.service';

/**
 * Modal global de Términos y Condiciones del Geovisor Catastral.
 * Se muestra automáticamente cuando el usuario hace zoom sobre el distrito de
 * San Isidro (ver MapService.setupTermsOnZoom) o al pulsar el botón
 * "Ver Términos y Condiciones" del panel "Acerca de".
 */
@Component({
  selector: 'app-terms-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './terms-modal.html',
  styleUrl: './terms-modal.css',
})
export class TermsModal {
  public readonly mapService = inject(MapService);

  /** Estado del checkbox "He leído y acepto los términos." */
  modalTermsAccepted = false;

  /** Cierra el modal sin registrar la aceptación */
  closeModal(): void {
    this.modalTermsAccepted = false;
    this.mapService.closeTermsModal();
  }

  /** URL pública del sitio de la Municipalidad de San Isidro a la que se redirige al rechazar los términos */
  private readonly institutionalUrl = 'https://msi.gob.pe';

  /** El usuario no acepta los términos: cierra la aplicación y sale hacia el sitio web de la municipalidad */
  rejectAndExit(): void {
    this.modalTermsAccepted = false;
    this.mapService.closeTermsModal();
    // El visor puede estar embebido en un iframe del portal municipal. Si ocurre,
    // lo correcto es navegar la ventana superior para "salir" de la aplicación;
    // si no se puede (embedding cross-origin restringido), navegamos la actual.
    try {
      window.top!.location.assign(this.institutionalUrl);
    } catch {
      window.location.assign(this.institutionalUrl);
    }
  }

  /** Registra la aceptación de los términos y cierra el modal */
  acceptAndEnter(): void {
    this.mapService.acceptTerms();
    this.modalTermsAccepted = false;
  }
}