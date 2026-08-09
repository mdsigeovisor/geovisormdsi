import {
  Component,
  AfterViewInit,
  ElementRef,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule, NgFor } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Chart, registerables } from 'chart.js';
import { WfsResponse } from '../../../../interfaces/geoLayers';
import { environment } from '../../../../../environments/environment';
import { catchError, map, of } from 'rxjs';

// Registrar todos los componentes de Chart.js
Chart.register(...registerables);

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

  private readonly http = inject(HttpClient);
  private chart: Chart | undefined;

  ngAfterViewInit(): void {
    this.loadManzanasData();
  }

  private loadManzanasData(): void {
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
        this.createChart(data);
      });
  }

  private createChart(data: { [sector: string]: number }): void {
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

    if (this.chart) {
      this.chart.destroy();
    }

    const context = this.chartCanvas.nativeElement.getContext('2d');
    if (context) {
      this.chart = new Chart(context, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'Nº de Manzanas por Sector',
              data: values,
              backgroundColor: 'rgba(70, 87, 15, 0.6)',
              borderColor: 'rgba(70, 87, 15, 1)',
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
              },
            },
            x: {
              title: {
                display: true,
                text: 'Sector Catastral',
              },
            },
          },
          plugins: {
            legend: {
              display: true,
              position: 'top',
            },
            title: {
              display: true,
              text: 'Distribución de Manzanas por Sector Catastral',
              font: {
                size: 18,
              },
            },
          },
        },
      });
    }
  }
}
