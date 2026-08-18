import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MapService } from '../../../../../../../../services/map.service';

@Component({
  selector: 'app-imprimir',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './imprimir.html',
})
export class Imprimir {
  private readonly mapService = inject(MapService);

  // Signals para gestionar el estado del formulario de impresión
  formato = signal<'A4' | 'A3' | 'A2'>('A4');
  resolucion = signal<72 | 150 | 300>(150);
  imprimiendo = signal(false);
  incluirMarco = signal(true);
  incluirCuadricula = signal(false);

  /**
   * Establece la resolución y asegura que sea un número.
   * @param res La resolución seleccionada en formato string.
   */
  setResolucion(res: string | 72 | 150 | 300): void {
    this.resolucion.set(Number(res) as 72 | 150 | 300);
  }

  /**
   * Inicia el proceso de impresión llamando al servicio del mapa.
   */
  async imprimirMapa(): Promise<void> {
    this.imprimiendo.set(true);

    try {
      // Llama al nuevo método en MapService, pasando las opciones de impresión.
      await this.mapService.printMap({
        format: this.formato(),
        resolution: this.resolucion(),
        includeGrid: this.incluirCuadricula(),
        includeFrame: this.incluirMarco(),
      });
    } catch (error) {
      console.error('Error al generar el PDF:', error);
      // Aquí podrías mostrar una notificación de error al usuario.
    } finally {
      this.imprimiendo.set(false);
    }
  }
}