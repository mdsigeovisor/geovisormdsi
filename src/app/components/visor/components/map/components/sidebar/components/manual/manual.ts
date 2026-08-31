import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Panel "Manual de Usuario" del sidebar.
 * Version compacta del manual con acordeones y enlace al manual completo.
 */
@Component({
  selector: 'app-manual',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './manual.html',
})
export class Manual {
  /** Abre el manual completo (manual.html) en una pestana nueva. */
  abrirManualCompleto(): void {
    window.open('/manual.html', '_blank', 'noopener,noreferrer');
  }
}
