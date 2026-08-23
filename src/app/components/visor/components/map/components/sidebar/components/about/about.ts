import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
//Servicio
import { MapService } from '@app/services/map.service';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './about.html',
  styleUrl: './about.css',
})
export class About {
  private readonly mapService = inject(MapService);

  currentYear: number = new Date().getFullYear();
  onLogin(): void {
    console.log('Iniciar sesión');
  }
  onGuestAccess(): void {
    console.log('Consulta como invitado');
  }
  /**
   * Abre el modal global de Términos y Condiciones (app-terms-modal).
   */
  openTerms(): void {
    this.mapService.openTermsModal();
  }
}
