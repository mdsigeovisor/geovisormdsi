import { Component, AfterViewInit, ElementRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Manual de Usuario completo del Geovisor Catastral.
 * Página autónoma con índice lateral, secciones numeradas y FAQs.
 * Reutiliza los estilos globales del proyecto (Tailwind v4 y bootstrap-icons).
 */
@Component({
  selector: 'app-manual-completo',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './manualCompleto.html',
  styleUrl: './manualCompleto.css',
})
export class ManualCompleto implements AfterViewInit {
  private readonly elementRef = inject(ElementRef);

  /**
   * Desplaza la vista hasta la sección indicada por el fragmento de la URL
   * (p. ej. /manual#s10 -> sección "Preguntas frecuentes"). En un SPA los
   * anclajes no se resuelven de forma automática, por eso se hace aquí.
   */
  ngAfterViewInit(): void {
    const hash = window.location.hash;
    if (!hash) return;
    const target = this.elementRef.nativeElement.querySelector(hash) as HTMLElement | null;
    if (target) target.scrollIntoView({ behavior: 'smooth' });
  }
}