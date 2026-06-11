import { Component, input } from '@angular/core';

@Component({
  selector: 'app-spinner',
  standalone: true,
  imports: [],
  templateUrl: './spinner.html',
  styleUrl: './spinner.css',
})
export class Spinner {
  /** Tamaño del spinner (clases de Tailwind) */
  size = input<string>('h-10 w-10');
  /** Color del spinner (clases de Tailwind) */
  color = input<string>('text-blue-700');
  /** URL opcional de una imagen para mostrar en el centro */
  imageUrl = input<string | null>(null);
}
