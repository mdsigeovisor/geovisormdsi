import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class OtrosService {
  private readonly http = inject(HttpClient);

  /** URL base del servidor WMS de la Municipalidad de San Isidro */
  // Usamos una ruta relativa para que sea interceptada por el proxy de desarrollo y evitar errores de CORS
  public readonly WMS_URL = `${environment.geoserver.serverUrl}/${environment.geoserver.workspace}/wms?`;

  /** Versión estándar de WMS a utilizar en la aplicación */
  public readonly WMS_VERSION = '1.1.0';

  /**
   * Obtiene el documento de capacidades (GetCapabilities) del servidor.
   * Este XML contiene la lista de capas disponibles como Límites Departamentales, Provinciales y Distritales.
   */
  getCapabilities(): Observable<string> {
    return this.http.get(this.WMS_URL, {
      params: {
        SERVICE: 'WMS',
        REQUEST: 'GetCapabilities',
        VERSION: this.WMS_VERSION
      },
      responseType: 'text'
    });
  }
}
