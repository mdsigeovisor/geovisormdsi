import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LayerItem } from '../../../../../../../../interfaces/geoLayers';

@Component({
  selector: 'app-layer-item',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: ` <div class="pr-4">
    <div class="flex items-center gap-3">
      <div class="relative flex items-center">
        <input type="checkbox" [id]="sectionId() + '-' + layer().id" [checked]="layer().visible"
          (change)="toggleVisibility.emit()"
          class="w-3 h-3 rounded-md border-gray-300 text-primary focus:ring-primary/20 cursor-pointer transition-all accent-primary" />
      </div>
      <label [for]="sectionId() + '-' + layer().id"
        class="flex-1 cursor-pointer font-bold text-gray-600 group-hover/item:text-primary transition-colors leading-tight"
        [ngClass]="size() === 'small' ? 'text-[8px]' : 'text-[10px]'">
        {{ layer().label }}
      </label>
    </div>
    <!-- Control de Opacidad -->
    <div class="flex items-center gap-3 pl-8" [class.opacity-40]="!layer().visible">      
      <input type="range" min="0" max="100" [value]="layer().opacity * 100"
        (input)="opacityChange.emit($event)"
        class="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
        [disabled]="!layer().visible" title="Opacidad" />
      <span class="font-mono font-bold text-primary w-6" [ngClass]="size() === 'small' ? 'text-[10px]' : 'text-[12px]'">{{ (layer().opacity * 100) | number:'1.0-0' }}%</span>
    </div>
    </div>
  `
})
export class LayerItemComponent {
  layer = input.required<LayerItem>();
  sectionId = input.required<string>();
  size = input<'normal' | 'small'>('normal');
  toggleVisibility = output<void>();
  opacityChange = output<Event>();
}