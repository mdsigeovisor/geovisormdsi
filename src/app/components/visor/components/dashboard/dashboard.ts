import {
  Component,
  AfterViewInit,
  ElementRef,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule, NgFor } from '@angular/common';
import { HttpClient, HttpClientModule, HttpParams } from '@angular/common/http';
import { Chart, registerables } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { WfsResponse } from '../../../../interfaces/geoLayers';
import { environment } from '../../../../../environments/environment';
import { catchError, map, of } from 'rxjs';

// Registrar todos los componentes de Chart.js
Chart.register(...registerables, ChartDataLabels);

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, HttpClientModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements AfterViewInit {
  @ViewChild('manzanasPorSectorChart')
  chartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('lotesPorSectorChart')
  lotesChartCanvas!: ElementRef<HTMLCanvasElement>;

  private readonly http = inject(HttpClient);
  private manzanasChart: Chart | undefined;
  private lotesChart: Chart | undefined;

  ngAfterViewInit(): void {
    this.loadDataAndCreateCharts();
  }

  private loadDataAndCreateCharts(): void {
    // Cargar datos para el gráfico de manzanas
    // Usamos la URL base de GeoServer desde el entorno para construir la petición WFS
    const wfsUrl = `${environment.geoserver.owsUrl}`;
    const params = {
      service: 'WFS',
      version: '1.1.0',
      request: 'GetFeature',
      typeName: 'WEB_GIS:vw_tg_manzana', // La capa que contiene las manzanas
      outputFormat: 'application/json',
      // Solicitamos solo la propiedad necesaria para el conteo
      propertyName: 'id_sector',
    };

    this.http
      .get<WfsResponse>(wfsUrl, { params })
      .pipe(
        map((response) => {
          if (!response || !response.features) {
            return {};
          }
          // Usamos un objeto para contar las ocurrencias (manzanas) de cada sector.
          const conteoSector: { [sector: string]: number } = {};

          response.features.forEach(feature => {
            const sector = feature.properties['id_sector'];
            if (sector) {
              const key = `Sector ${sector}`;
              // Si el sector ya existe en el objeto, incrementamos su contador.
              // Si no, lo inicializamos en 1.
              conteoSector[key] = (conteoSector[key] || 0) + 1;
            }
          });
          return conteoSector;
        }),
        catchError((error) => {
          console.error('Error al obtener los datos de las manzanas:', error);
          return of({}); // Devolver un objeto vacío en caso de error
        })
      )
      .subscribe((data) => {
        this.createManzanasChart(data);
      });

    // Cargar datos para el gráfico de lotes
    const lotesParams = {
      service: 'WFS',
      version: '1.1.0',
      request: 'GetFeature',
      typeName: 'WEB_GIS:vw_tg_lote', // La capa que contiene los lotes
      outputFormat: 'application/json',
      propertyName: 'id_sector',
    };

    this.http
      .get<WfsResponse>(wfsUrl, { params: lotesParams })
      .pipe(
        map((response) => {
          if (!response || !response.features) {
            return {};
          }
          const conteoSector: { [sector: string]: number } = {};
          response.features.forEach(feature => {
            const sector = feature.properties['id_sector'];
            if (sector) {
              const key = `Sector ${sector}`;
              conteoSector[key] = (conteoSector[key] || 0) + 1;
            }
          });
          return conteoSector;
        }),
        catchError((error) => {
          console.error('Error al obtener los datos de los lotes:', error);
          return of({});
        })
      )
      .subscribe((data) => {
        this.createLotesChart(data);
      });
  }

  private createManzanasChart(data: { [sector: string]: number }): void {
    // Convertimos el objeto de datos en un array para poder ordenarlo.
    const sortedData = Object.entries(data).sort(([keyA], [keyB]) => {
      // Extraemos el número del string "Sector XX" para una ordenación numérica.
      const sectorNumA = parseInt(keyA.replace('Sector ', ''), 10);
      const sectorNumB = parseInt(keyB.replace('Sector ', ''), 10);
      return sectorNumA - sectorNumB;
    });

    // Creamos las etiquetas y valores a partir de los datos ya ordenados.
    const labels = sortedData.map(([key]) => key);
    const values = sortedData.map(([, value]) => value);

    if (this.manzanasChart) {
      this.manzanasChart.destroy();
    }

    const context = this.chartCanvas.nativeElement.getContext('2d');
    if (context) {
      this.manzanasChart = new Chart(context, {
        type: 'bar',
        plugins: [ChartDataLabels],
        data: {
          labels: labels,
          datasets: [
            {
              label: 'Nº de Manzanas por Sector',
              data: values,
              // Paleta de colores inspirada en Power BI
              backgroundColor: [
                'rgba(51, 102, 204, 0.8)',
                'rgba(221, 102, 0, 0.8)',
                'rgba(16, 150, 24, 0.8)',
                'rgba(153, 0, 153, 0.8)',
                'rgba(51, 153, 204, 0.8)',
                'rgba(238, 136, 0, 0.8)',
                'rgba(184, 184, 184, 0.8)',
                'rgba(255, 187, 0, 0.8)',
              ],
              borderColor: [
                'rgba(51, 102, 204, 1)',
                'rgba(221, 102, 0, 1)',
                'rgba(16, 150, 24, 1)',
                'rgba(153, 0, 153, 1)',
                'rgba(51, 153, 204, 1)',
                'rgba(238, 136, 0, 1)',
                'rgba(184, 184, 184, 1)',
                'rgba(255, 187, 0, 1)',
              ],
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Cantidad de Manzanas',
                font: { size: 14 }
              },
              grid: {
                color: '#e9e9e9'
              },
              border: {
                color: '#dcdcdc'
              },
            },
            x: {
              title: {
                display: true,
                text: 'Sector Catastral',
                font: { size: 14 }
              },
              grid: {
                display: false // Ocultamos las líneas de la cuadrícula vertical
              },
            },
          },
          plugins: {
            legend: {
              display: true,
              position: 'top',
              labels: {
                font: { size: 12 }
              }
            },
            title: {
              display: true,
              text: 'Distribución de Manzanas por Sector Catastral',
              font: {
                size: 20,
                weight: 'bold'
              },
              padding: { top: 10, bottom: 20 }
            },
            datalabels: {
              anchor: 'end',
              align: 'top',
              formatter: (value: number) => {
                return value > 0 ? value : '';
              },
            },
          },
        },
      });
    }
  }

  private createLotesChart(data: { [sector: string]: number }): void {
    const sortedData = Object.entries(data).sort(([keyA], [keyB]) => {
      const sectorNumA = parseInt(keyA.replace('Sector ', ''), 10);
      const sectorNumB = parseInt(keyB.replace('Sector ', ''), 10);
      return sectorNumA - sectorNumB;
    });

    const labels = sortedData.map(([key]) => key);
    const values = sortedData.map(([, value]) => value);

    if (this.lotesChart) {
      this.lotesChart.destroy();
    }

    const context = this.lotesChartCanvas.nativeElement.getContext('2d');
    if (context) {
      this.lotesChart = new Chart(context, {
        type: 'bar',
        plugins: [ChartDataLabels],
        data: {
          labels: labels,
          datasets: [
            {
              label: 'Nº de Lotes por Sector',
              data: values,
              backgroundColor: [
                'rgba(0, 181, 173, 0.8)',
                'rgba(61, 148, 192, 0.8)',
                'rgba(128, 128, 128, 0.8)',
                'rgba(242, 119, 122, 0.8)',
                'rgba(248, 153, 29, 0.8)',
                'rgba(145, 195, 95, 0.8)',
                'rgba(102, 102, 102, 0.8)',
                'rgba(204, 204, 204, 0.8)',
              ],
              borderColor: [
                'rgba(0, 181, 173, 1)',
                'rgba(61, 148, 192, 1)',
                'rgba(128, 128, 128, 1)',
                'rgba(242, 119, 122, 1)',
                'rgba(248, 153, 29, 1)',
                'rgba(145, 195, 95, 1)',
                'rgba(102, 102, 102, 1)',
                'rgba(204, 204, 204, 1)',
              ],
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              title: { display: true, text: 'Cantidad de Lotes', font: { size: 14 } },
              grid: { color: '#e9e9e9' },
              border: { color: '#dcdcdc' },
            },
            x: {
              title: { display: true, text: 'Sector Catastral', font: { size: 14 } },
              grid: { display: false },
            },
          },
          plugins: {
            legend: {
              display: true,
              position: 'top',
              labels: { font: { size: 12 } },
            },
            title: {
              display: true,
              text: 'Distribución de Lotes por Sector Catastral',
              font: { size: 20, weight: 'bold' },
              padding: { top: 10, bottom: 20 },
            },
            datalabels: {
              anchor: 'end',
              align: 'top',
              formatter: (value: number) => {
                return value > 0 ? value : '';
              },
              color: '#333'
            },
          },
        },
      });
    }
  }
}
