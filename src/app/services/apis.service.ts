import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  CodPredialResultado,
  CucResultado,
  DenominacionLoteResultado,
  LoteDatosHover,
  TitularCatastral,
  ViaNumero,
  ViaApi,
} from '../interfaces/geoLayers';

/* ---------------------------------------------------------------------------
 * API DEL GEOVISOR (WSGEOVISOR · /api/geovisor)
 *
 * Punto ÚNICO de acceso a los endpoints del Geovisor municipal, cuya ruta real
 * es:   https://<host>/WSGEOVISOR/api/geovisor/<endpoint>
 *
 * Antes, cada consulta repetía la misma mecánica (ruta relativa -> host de
 * pruebas -> host de producción). Aquí se centraliza:
 *   - el catálogo de endpoints (`GEOVISOR_ENDPOINTS`),
 *   - la resolución de la URL base (`environment.geovisorApiUrl`),
 *   - la estrategia de reintentos entre hosts (`peticionConReintentos`),
 *   - el desempaquetado de las respuestas `{ status, data }` del API.
 *
 * Así, si cambia un endpoint, un nombre de parámetro o un host de respaldo,
 * se ajusta en un solo lugar y no en cada consumidor (p. ej. `MapService`).
 * ------------------------------------------------------------------------- */

/** Catálogo de endpoints del API del Geovisor (`/WSGEOVISOR/api/geovisor/<valor>`). */
export const GEOVISOR_ENDPOINTS = {
  /** Datos resumidos de un lote (popup del mapa). */
  listarDatosLote: 'listar-datos-lote',
  /** Predios por Código Único Catastral (CUC). */
  buscarPorCuc: 'busqueda-cuc',
  /** Predios por Código Predial. */
  buscarPorCodPredial: 'busqueda-codpredial',
  /** Numeraciones (lotes) asociadas a un código de vía. */
  listarViaNumeros: 'listar-via-numero',
  /** Vías por nombre (fuente de verdad de los nombres de vías del distrito). */
  listarVias: 'listar-vias',
  /** Titulares catastrales por apellido / razón social. */
  buscarTitularCatastral: 'busqueda-titular-catastral',
  /** Predios por denominación del predio. */
  buscarDenominacionLote: 'busqueda-denominacion-lote',
} as const;

/** Nombre (ruta relativa) de cualquier endpoint del Geovisor. */
export type GeovisorEndpoint = typeof GEOVISOR_ENDPOINTS[keyof typeof GEOVISOR_ENDPOINTS];

/** Host de respaldo con su etiqueta, para mensajes de log legibles. */
interface HostGeovisor {
  url: string;
  etiqueta: string;
}

@Injectable({
  providedIn: 'root',
})
export class ApisService {
  private readonly http = inject(HttpClient);

  /**
   * Hosts en orden de intento. El primero (cadena vacía) resuelve la ruta
   * relativa a través del proxy de desarrollo (`proxy.conf.json`) o del
   * proxy inverso Nginx en QA/Prod (mismo origen); los otros dos son los
   * respaldos directos usados en desarrollo.
   */
  private static readonly HOSTS: readonly HostGeovisor[] = [
    { url: '', etiqueta: 'ruta relativa' },
    { url: 'https://test.munisanisidro.gob.pe', etiqueta: 'test.munisanisidro.gob.pe' },
    { url: 'https://www.munisanisidro.gob.pe', etiqueta: 'www.munisanisidro.gob.pe' },
  ];

  /** Construye la URL de un endpoint sobre el host indicado (vacío = ruta relativa). */
  private url(endpoint: GeovisorEndpoint, host = ''): string {
    return `${host}${environment.geovisorApiUrl}/${endpoint}`;
  }

  /**
   * Ejecuta una petición GET contra el API del Geovisor probando, en orden:
   *  1) la ruta relativa (proxy de desarrollo o Nginx de QA/Prod),
   *  2) el host de pruebas y
   *  3) el host de producción.
   * Pasa al siguiente host solo si el anterior falla; si todos fallan, propaga
   * el error para que la UI distinga "sin resultados" de "sin conexión".
   * @param operacion Nombre del método (para los mensajes de log).
   * @param endpoint Endpoint del catálogo `GEOVISOR_ENDPOINTS`.
   * @param params Parámetros de la consulta.
   * @param normalizar Función que convierte la respuesta cruda del API en el tipo esperado.
   */
  private peticionConReintentos<T>(
    operacion: string,
    endpoint: GeovisorEndpoint,
    params: HttpParams,
    normalizar: (respuesta: unknown) => T
  ): Observable<T> {
    const hosts = ApisService.HOSTS;
    const intento = (indice: number): Observable<T> =>
      this.http.get<unknown>(this.url(endpoint, hosts[indice].url), { params }).pipe(
        map(normalizar),
        catchError(err => {
          const siguiente = indice + 1;
          if (siguiente < hosts.length) {
            console.warn(
              `${operacion}: falló intento (${hosts[indice].etiqueta}), reintentando con ${hosts[siguiente].etiqueta}`,
              err
            );
            return intento(siguiente);
          }
          console.error(`${operacion}: fallaron todos los intentos de conexión`, err);
          return throwError(() => err);
        })
      );
    return intento(0);
  }

  /** Desempaqueta el arreglo `data` de las respuestas `{ status, data }` del API. */
  private extraerData<T>(respuesta: unknown): T[] {
    const data = (respuesta as { data?: unknown } | null)?.data;
    return Array.isArray(data) ? (data as T[]) : [];
  }

  /** Extrae los registros de vía-número, tolerando respuesta directa o envuelta. */
  private extraerViaNumero(respuesta: unknown): ViaNumero[] {
    if (Array.isArray(respuesta)) return respuesta as ViaNumero[];
    if (respuesta && typeof respuesta === 'object') {
      const envuelto = respuesta as { data?: unknown; result?: unknown };
      if (Array.isArray(envuelto.data)) return envuelto.data as ViaNumero[];
      if (Array.isArray(envuelto.result)) return envuelto.result as ViaNumero[];
      return [respuesta as ViaNumero];
    }
    return [];
  }

  /**
   * Consulta los datos resumidos de un lote (`listar-datos-lote`), mostrados
   * en el popup flotante al pasar el cursor sobre el lote.
   * Se resuelve por ruta relativa y, si falla, devuelve `null` (el hover no
   * debe romper la experiencia si el servicio no responde).
   * @param codlote Código catastral del lote (id_lote / codlote).
   * @returns Observable con los datos del lote o `null` si no se encontró.
   */
  listarDatosLote(codlote: string): Observable<LoteDatosHover | null> {
    const codigo = (codlote ?? '').trim();
    if (!codigo) return of(null);
    const params = new HttpParams().set('pvcCODLOTE', codigo);
    return this.http
      .get<{ status?: number; data?: LoteDatosHover[] }>(this.url(GEOVISOR_ENDPOINTS.listarDatosLote), { params })
      .pipe(
        map(response => {
          const registro = response?.data?.[0];
          if (registro && (registro.codlote || registro.codlotecatastral)) {
            return { ...registro, codlote: registro.codlote || registro.codlotecatastral || codigo };
          }
          return null;
        }),
        catchError(err => {
          console.error('listarDatosLote: falló la conexión con el proxy inverso', err);
          return of(null);
        })
      );
  }

  /**
   * Busca predios por Código Único Catastral (CUC) (`busqueda-cuc`).
   * @param cuc Código Único Catastral (8 dígitos).
   * @returns Observable con la lista de coincidencias `{ txtcuc, txtpropietario, codlote, ... }`.
   */
  buscarPorCuc(cuc: string): Observable<CucResultado[]> {
    const codigo = (cuc ?? '').trim();
    if (!codigo) return of([]);
    const params = new HttpParams().set('txtcuc', codigo);
    return this.peticionConReintentos(
      'buscarPorCuc',
      GEOVISOR_ENDPOINTS.buscarPorCuc,
      params,
      respuesta => this.extraerData<CucResultado>(respuesta)
    );
  }

  /**
   * Busca predios por Código Predial (`busqueda-codpredial`).
   * @param codigoPredial Código de predio (ej. '270543112').
   * @returns Observable con la lista de coincidencias `{ txtcodipredrent, txtcuc, txttitular, codlote, ... }`.
   */
  buscarPorCodPredial(codigoPredial: string): Observable<CodPredialResultado[]> {
    const codigo = (codigoPredial ?? '').trim();
    if (!codigo) return of([]);
    const params = new HttpParams().set('txtcodpredial', codigo);
    return this.peticionConReintentos(
      'buscarPorCodPredial',
      GEOVISOR_ENDPOINTS.buscarPorCodPredial,
      params,
      respuesta => this.extraerData<CodPredialResultado>(respuesta)
    );
  }

  /**
   * Lista las numeraciones (lotes) de un código de vía (`listar-via-numero`).
   * @param codVia Código de la vía (ej. 'L271170').
   * @returns Observable con un array de registros `{ numero, codlote, codlotenumero }`.
   */
  listarViaNumeros(codVia: string): Observable<ViaNumero[]> {
    const params = new HttpParams().set('pvcCODVIA', (codVia ?? '').trim());
    return this.peticionConReintentos(
      'listarViaNumeros',
      GEOVISOR_ENDPOINTS.listarViaNumeros,
      params,
      respuesta => this.extraerViaNumero(respuesta)
    );
  }

  /**
   * Lista las vías del distrito cuyo nombre coincida con el texto indicado
   * (`listar-vias`).
   *
   * El API es la fuente de verdad de los nombres de vías: el WFS `vw_tg_via`
   * solo contiene las vías con geometría dibujada, por lo que buscar en él
   * deja fuera vías existentes (de ahí que se consulte primero aquí). El API
   * también busca por el nombre anterior (`txtnomviA_ANT`), de modo que
   * escribir el nombre antiguo de una vía la encuentra igual.
   * @param nombre Texto de búsqueda (parcial). Admite un solo carácter, de modo
   *   que las coincidencias se muestren desde la primera tecla.
   * @returns Observable con las vías `{ codviaequ, txtnomvia, ... }`.
   */
  listarVias(nombre: string): Observable<ViaApi[]> {
    const texto = (nombre ?? '').trim();
    // El API responde bien con un único carácter; sin texto no hay nada que buscar.
    if (!texto) return of([]);
    const params = new HttpParams().set('pvcTXTNOMBREVIA', texto);
    return this.peticionConReintentos(
      'listarVias',
      GEOVISOR_ENDPOINTS.listarVias,
      params,
      respuesta => this.extraerData<ViaApi>(respuesta)
    );
  }

  /**
   * Busca titulares catastrales por apellido / razón social
   * (`busqueda-titular-catastral`).
   * @param razonSocial Apellido o razón social (búsqueda parcial).
   * @returns Observable con la lista de coincidencias `{ txttitular, codlote }`.
   */
  buscarTitularCatastral(razonSocial: string): Observable<TitularCatastral[]> {
    const texto = (razonSocial ?? '').trim();
    if (!texto) return of([]);
    const params = new HttpParams().set('pvcTXTRAZONSOCIAL', texto);
    return this.peticionConReintentos(
      'buscarTitularCatastral',
      GEOVISOR_ENDPOINTS.buscarTitularCatastral,
      params,
      respuesta => this.extraerData<TitularCatastral>(respuesta)
    );
  }

  /**
   * Busca predios por Denominación del Predio (`busqueda-denominacion-lote`).
   * @param denominacion Denominación del predio (búsqueda parcial).
   * @returns Observable con la lista de coincidencias `{ codlote, txtdenominacion, txtdirecprincipal, ... }`.
   */
  buscarDenominacionLote(denominacion: string): Observable<DenominacionLoteResultado[]> {
    const texto = (denominacion ?? '').trim();
    if (!texto) return of([]);
    const params = new HttpParams().set('pvcDENOMINACIONCAT', texto);
    return this.peticionConReintentos(
      'buscarDenominacionLote',
      GEOVISOR_ENDPOINTS.buscarDenominacionLote,
      params,
      respuesta => this.extraerData<DenominacionLoteResultado>(respuesta)
    );
  }
}
