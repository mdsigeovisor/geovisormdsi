import {
  Component,
  Input,
  ViewChild,
  ElementRef,
  afterNextRender,
  inject,
  signal,
  output,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MapService } from '@app/services/map.service';
import { GeoJSONFeature } from '@app/interfaces/geoLayers';
import { catchError, of, take } from 'rxjs';
import { Chart } from 'chart.js/auto';
import ChartDataLabels from 'chartjs-plugin-datalabels';

Chart.register(ChartDataLabels);

/** Renglón normalizado de un registro de la capa de Conformidad de Obra. */
interface RenglonConformidad {
  txttipobra: string;
  codanoconformidad: string;
}

/** Paleta de colores para las series clasificadas por `codanoconformidad`. */
const PALETA = [
  '#2d780e', '#2563eb', '#d97706', '#dc2626', '#7c3aed',
  '#0d9488', '#db2777', '#4b5563', '#ca8a04', '#059669',
];

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnDestroy {
  /** Configuración del servicio que se representa (por defecto tem_conforobra). */
  @Input() servicio = {
    id: 'tem_conforobra',
    layerName: 'WEB_GIS:view_conformidadobra',
    title: 'Conformidad de Obra',
  };

  /** Si es true, se muestra a pantalla completa como página independiente (ruta). */
  @Input() fullPage = false;

  /** Evento para pedir al contenedor que cierre el dashboard. */
  Close = output<void>();

  private readonly mapService = inject(MapService);
  private readonly router = inject(Router);

  // --- Estado de la UI ---
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);

  // --- Datos procesados ---
  /** Valores únicos de `txttipobra` (medición). */
  tipObras: string[] = [];
  /** Valores únicos de `codanoconformidad` (clasificación). */
  codConformidad: string[] = [];
  /** Matriz de conteos: [por tipo de obra][por código de conformidad]. */
  matriz: number[][] = [];
  /** Totales por tipo de obra. */
  totalesPorTipo: number[] = [];
  /** Totales por código de conformidad. */
  totalesPorCodigo: number[] = [];
  /** Total general de registros. */
  totalRegistros = 0;

  private chartBarra: Chart | null = null;
  private chartTorta: Chart | null = null;

  @ViewChild('chartBarra') chartBarraEl!: ElementRef<HTMLCanvasElement>;
  @ViewChild('chartTorta') chartTortaEl!: ElementRef<HTMLCanvasElement>;

  constructor() {
    // Carga automática cuando el componente se monta en el DOM.
    afterNextRender(() => this.cargarDatos());
  }

  /** Desactiva los Charts para evitar fugas de memoria. */
  ngOnDestroy(): void {
    this.chartBarra?.destroy();
    this.chartTorta?.destroy();
  }

  /** Consulta el WFS y procesa los datos del servicio. */
  cargarDatos(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.mapService.getConformidadObraData().pipe(
      take(1),
      catchError((err) => {
        console.error('[Dashboard] Error consultando Conformidad de Obra:', err);
        this.error.set('No se pudo conectar con el servicio WFS. Verifique la conexión e intente nuevamente.');
        this.cargando.set(false);
        return of(null);
      })
    ).subscribe((features) => {
      this.procesar(features ?? []);
      this.cargando.set(false);
      // Diferimos la creación de los gráficos para que Angular haya montado los
      // <canvas> en el DOM (tanto en la carga inicial como al refrescar).
      setTimeout(() => this.renderChart(), 0);
    });
  }

  /** Cierra el dashboard (emitido al contenedor). */
  cerrar(): void {
    this.Close.emit();
    // En modo página completa navegamos de vuelta al mapa.
    if (this.fullPage) {
      this.router.navigate(['/visor/map']);
    }
  }

  /**
   * Normaliza cada feature y construye la matriz tipobra × codanoconformidad.
   */
  private procesar(features: GeoJSONFeature[]): void {
    const renglones: RenglonConformidad[] = features.map((f) => ({
      txttipobra: String(f.properties?.['txttipobra'] ?? '').trim() || 'Sin especificar',
      codanoconformidad: String(f.properties?.['codanoconformidad'] ?? '').trim() || 'Sin especificar',
    }));

    // Valores únicos conservando el orden de aparición.
    this.tipObras = [...new Set(renglones.map((r) => r.txttipobra))];
    this.codConformidad = [...new Set(renglones.map((r) => r.codanoconformidad))];

    this.totalesPorTipo = this.tipObras.map(() => 0);
    this.totalesPorCodigo = this.codConformidad.map(() => 0);
    this.matriz = this.tipObras.map(() => this.codConformidad.map(() => 0));
    this.totalRegistros = 0;

    for (const r of renglones) {
      const fila = this.tipObras.indexOf(r.txttipobra);
      const col = this.codConformidad.indexOf(r.codanoconformidad);
      if (fila >= 0 && col >= 0) {
        this.matriz[fila][col]++;
        this.totalesPorTipo[fila]++;
        this.totalesPorCodigo[col]++;
        this.totalRegistros++;
      }
    }
  }

  /**
   * Dibuja los gráficos (barras apiladas por tipo de obra + torta total).
   * Se envuelve en try/catch porque jsdom/Canvas puede no soportar 2D.
   */
  private renderChart(): void {
    try {
      if (!this.tipObras.length || !this.codConformidad.length) return;
      if (!this.chartBarraEl?.nativeElement?.getContext || !this.chartTortaEl?.nativeElement?.getContext) return;
      if (!this.chartBarraEl.nativeElement.getContext('2d') || !this.chartTortaEl.nativeElement.getContext('2d')) return;

      // Barras apiladas: eje X = txttipobra; series = codanoconformidad.
      if (this.chartBarra) this.chartBarra.destroy();
      this.chartBarra = new Chart(this.chartBarraEl.nativeElement, {
        type: 'bar',
        data: {
          labels: this.tipObras,
          datasets: this.codConformidad.map((codigo, i) => ({
            label: codigo,
            data: this.tipObras.map((_, j) => this.matriz[j][i]),
            backgroundColor: PALETA[i % PALETA.length],
            stack: 'conformidad',
          })),
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top', labels: { boxWidth: 12, usePointStyle: true } },
            datalabels: { display: false },
          },
          scales: {
            x: { stacked: true, ticks: { color: '#374151' } },
            y: { stacked: true, beginAtZero: true, ticks: { precision: 0, color: '#374151' } },
          },
        },
      });

      // Torta: distribución total por tipo de obra.
      if (this.chartTorta) this.chartTorta.destroy();
      this.chartTorta = new Chart(this.chartTortaEl.nativeElement, {
        type: 'doughnut',
        data: {
          labels: this.tipObras,
          datasets: [{
            data: this.totalesPorTipo,
            backgroundColor: this.tipObras.map((_, i) => PALETA[i % PALETA.length]),
            borderWidth: 2,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'right', labels: { boxWidth: 12, usePointStyle: true } },
            datalabels: {
              color: '#ffffff',
              font: { weight: 'bold', size: 11 },
              formatter: (value: number) => (value > 0 ? value : ''),
              anchor: 'center',
              align: 'center',
            },
          },
        },
      });
    } catch (e) {
      // En entornos sin canvas 2D (tests) los gráficos no se dibujan; no es fatal.
      console.warn('[Dashboard] No se pudieron renderizar los gráficos:', e);
    }
  }
}

