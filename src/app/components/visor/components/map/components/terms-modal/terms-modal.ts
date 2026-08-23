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

  /** Registra la aceptación de los términos y cierra el modal */
  acceptAndEnter(): void {
    this.mapService.acceptTerms();
    this.modalTermsAccepted = false;
  }
}