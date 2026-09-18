import { Component, Input, signal, output, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MapService } from '@app/services/map.service';
import { AuthService } from '@app/services/auth.service';
import { Subject, take, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';
import { GeoJSONFeature, GeoJSONGeometry, SearchResult } from '@app/interfaces/geoLayers';
import { ViaNumero, ViaSugerencia, TitularCatastral, CucResultado, CodPredialResultado } from '@app/services/map.service';

@Component({
  selector: 'app-consultas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './consultas.html',
  styleUrl: './consultas.css',
})
export class Consultas {
  @Input() isGuest: boolean = false;
  private readonly mapService = inject(MapService);
  private readonly authService = inject(AuthService);
  /** Estado de autenticación: las pestañas CUC y Titular solo se muestran con sesión iniciada. */
  public isAuthenticated = this.authService.isAuthenticated;
  Close = output<void>();
  SearchResult = output<SearchResult>();
  /** Control de pestañas */
  activeTab: 'catastral' | 'predial' | 'direccion' | 'habilitacion' | 'titular' | 'cuc' | 'denominacion' | 'parque' = 'catastral';
  /** Campos para búsqueda por CUC */
  cuc = '';
  /** Coincidencias devueltas por el API busqueda-cuc para el CUC consultado. */
  cucResultados: CucResultado[] = [];
  cucConsultado = false;
  /** Clave del interior seleccionado (para resaltarlo en la lista). */
  cucSeleccionado: string | null = null;

  /** Clave única de un registro CUC para track/selección en la lista. */
  cucKey(r: CucResultado): string {
    return `${r.txtcuc}-${r.codtipint}-${r.numeroint}-${r.numero}`;
  }

  /** Resumen del CUC consultado (titular, lote y dirección base del primer registro). */
  get cucResumen(): { txtcuc: string; propietario: string; codlote: string; direccionBase: string } | null {
    const primero = this.cucResultados[0];
    if (!primero) return null;
    const direccionBase = [primero.tipvia, primero.nomvia]
      .filter(p => (p ?? '').toString().trim() !== '')
      .join(' ').trim();
    return {
      txtcuc: (primero.txtcuc ?? '').toString().trim(),
      propietario: (primero.txtpropietario ?? '').toString().trim() || 'Titular no disponible',
      codlote: (primero.codlote ?? '').toString().trim(),
      direccionBase,
    };
  }

  /**
   * Lotes únicos del resultado CUC (agrupados por `codlote`).
   * Si varios interiores comparten el mismo lote (ej. 14 registros con
   * codlote 3103006007), solo se muestra una fila por lote.
   */
  get cucLotesUnicos(): { codlote: string; registro: CucResultado; total: number }[] {
    const mapa = new Map<string, { codlote: string; registro: CucResultado; total: number }>();
    for (const r of this.cucResultados) {
      const cod = (r?.codlote ?? '').toString().trim();
      if (!cod) continue;
      const existente = mapa.get(cod);
      if (existente) {
        existente.total += 1;
      } else {
        mapa.set(cod, { codlote: cod, registro: r, total: 1 });
      }
    }
    return [...mapa.values()];
  }
  /** Campos para búsqueda por Código Predial */
  codigoPredial = '';
  /** Coincidencias devueltas por el API busqueda-codpredial para el código consultado. */
  codPredialResultados: CodPredialResultado[] = [];
  codPredialConsultado = false;
  /** Clave del lote predial seleccionado (para resaltarlo en la lista). */
  codPredialSeleccionado: string | null = null;

  /** Clave única de un registro de Código Predial para track/selección. */
  codPredialKey(r: CodPredialResultado): string {
    return `${r.txtcodipredrent}-${r.codtipint}-${r.numeroint}-${r.numero}`;
  }

  /** Resumen del Código Predial consultado (titular, lote y dirección base). */
  get codPredialResumen(): { codpredial: string; titular: string; codlote: string; direccionBase: string } | null {
    const primero = this.codPredialResultados[0];
    if (!primero) return null;
    const direccionBase = [primero.tipvia, primero.nomvia]
      .filter(p => (p ?? '').toString().trim() !== '')
      .join(' ').trim();
    return {
      codpredial: (primero.txtcodipredrent ?? '').toString().trim(),
      titular: (primero.txttitular ?? '').toString().trim() || 'Titular no disponible',
      codlote: (primero.codlote ?? '').toString().trim(),
      direccionBase,
    };
  }

  /**
   * Lotes únicos del resultado de Código Predial (agrupados por `codlote`).
   * Replica el comportamiento de la búsqueda CUC: una fila por lote
   * (ej. 2 registros con codlote 3112075014 → 1 fila).
   */
  get codPredialLotesUnicos(): { codlote: string; registro: CodPredialResultado; total: number }[] {
    const mapa = new Map<string, { codlote: string; registro: CodPredialResultado; total: number }>();
    for (const r of this.codPredialResultados) {
      const cod = (r?.codlote ?? '').toString().trim();
      if (!cod) continue;
      const existente = mapa.get(cod);
      if (existente) {
        existente.total += 1;
      } else {
        mapa.set(cod, { codlote: cod, registro: r, total: 1 });
      }
    }
    return [...mapa.values()];
  }
  /** Campos para búsqueda por Dirección */
  nombreVia = '';
  /** Campos para consulta de numeración por código de vía */
  codVia = '';
  viaNumeros: ViaNumero[] = [];
  loadingViaNumeros = false;
  viaNumerosError: string | null = null;
  /** Número seleccionado en el selector de numeraciones */
  numeroSeleccionado = '';

  /**
   * Lista única de números de vía disponibles (ej. 'S/N', '0000', '0110').
   * Solo expone el campo 'numero'; el resto de los datos (codlote,
   * codlotenumero) permanecen ocultos pero almacenados en viaNumeros.
   */
  get numerosDisponibles(): string[] {
    return [...new Set(this.viaNumeros.map(r => (r.numero ?? '').trim()))].filter(n => n !== '');
  }

  /**
   * Al seleccionar un número en el selector, navega al lote correspondiente
   * usando el campo 'codlote' del registro (id_lote). Replica la lógica de
   * la búsqueda catastral (búsqueda WFS + fit + marcador + panel de resultado)
   * sin alterar dicha búsqueda.
   */
  irAloteSeleccionado() {
    const numero = (this.numeroSeleccionado ?? '').trim();
    if (!numero) return;
    // Buscamos el registro que corresponde al número seleccionado
    const registro = this.viaNumeros.find(r => (r.numero ?? '').trim() === numero);
    if (!registro?.codlote) {
      this.searchError.set('No se encontró el lote para el número seleccionado.');
      return;
    }
    this.loading.set(true);
    this.searchError.set(null);
    this.mapService.searchLoteByCodigoCatastral(registro.codlote).pipe(take(1)).subscribe({
      next: (feature) => {
        this.loading.set(false);
        if (feature) {
          const props = feature.properties as any;
          const result: SearchResult = {
            codigoCatastral: String(props['id_lote'] || registro.codlote).trim(),
            direccion: props['direccion'] ?? props['ubicacion'] ?? "Ubicación no disponible",
            propietario: props['propietario'] ?? "Información reservada",
            area: props['area_lote'] ? `${props['area_lote']} m²` : "No disponible",
            zonificacion: props['zonificacion'] ?? "No disponible",
            fotoFrontis: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=400&q=80",
            numeroPisos: props['pisos'] ?? 1,
            geometry: feature.geometry
          };
          // Navegamos al polígono encontrado automáticamente
          this.mapService.fitToGeometry(feature.geometry, 'EPSG:32718', undefined, true);
          this.mapService.drawSearchMarker(feature.geometry);
          this.emitResult(result);
        } else {
          this.searchError.set('Número de lote catastral no ubicado en el mapa (id_lote).');
        }
      },
      error: (err) => {
        console.error('Error al navegar al lote por numeración de vía:', err);
        this.loading.set(false);
        this.searchError.set('Número de lote catastral no ubicado en el mapa (id_lote).');
      }
    });
  }
  // --- Lógica para autocompletado de vías ---
  private readonly nombreViaSubject = new Subject<string>();
  viaSuggestions: ViaSugerencia[] = [];
  showViaSuggestions = false;
  // --- Lógica para autocompletado de parques ---
  private readonly nombreParqueSubject = new Subject<string>();
  parqueSuggestions: GeoJSONFeature[] = [];
  showParqueSuggestions = false;

  // --- Lógica para autocompletado de Habilitación Urbana ---
  private readonly nombreHabilitacionSubject = new Subject<string>();
  habilitacionSuggestions: GeoJSONFeature[] = [];
  showHabilitacionSuggestions = false;
  manzanaSuggestions: string[] = [];
  loteSuggestions: string[] = [];
  /** Última habilitación confirmada desde las sugerencias; permite detectar cambios de texto */
  private habilitacionConfirmada = '';

  // -----------------------------------------
  nombreHabilitacion = '';
  manzanaUrbana = '';
  loteUrbano = '';

  /** Campos para búsqueda por Titular Catastral */
  codigoTitular = '';
  /** Coincidencias de titulares obtenidas del API (se muestra solo txttitular). */
  titulares: TitularCatastral[] = [];
  /** Indica si ya se ejecutó una búsqueda de titulares (para mostrar la lista/vacío). */
  titularesConsultados = false;
  /** Campos para búsqueda por Denominación del Predio */
  denominacionPredio = '';
  /** Campos para búsqueda por Nombre de Parque */
  nombreParque = '';
  /** Campos para búsqueda Catastral */
  codigoCatastral = '';
  /** Estados de la búsqueda */
  loading = signal(false);
  searchError = signal<string | null>(null);

  constructor() {
    // Si el usuario cierra sesión con una pestaña restringida (CUC/Titular) abierta,
    // volvemos a la pestaña pública por defecto.
    effect(() => {
      if (!this.authService.isAuthenticated() && (this.activeTab === 'cuc' || this.activeTab === 'titular')) {
        this.activeTab = 'catastral';
      }
    });

    this.nombreViaSubject.pipe(
      debounceTime(300), // Espera 300ms después de la última pulsación
      distinctUntilChanged(), // Solo emite si el valor ha cambiado
      switchMap(partialName => this.mapService.searchViasConCodigo(partialName))
    ).subscribe(suggestions => {
      this.viaSuggestions = suggestions || [];
      this.showViaSuggestions = (suggestions?.length ?? 0) > 0;
    });

    this.nombreParqueSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(partialName => this.mapService.searchParquesByDenominacion(partialName))
    ).subscribe(suggestions => {
      this.parqueSuggestions = suggestions || [];
      this.showParqueSuggestions = (suggestions?.length ?? 0) > 0;
    });

    this.nombreHabilitacionSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(partialName => this.mapService.searchHabilitaciones(partialName))
    ).subscribe(suggestions => {
      this.habilitacionSuggestions = suggestions || [];
      this.showHabilitacionSuggestions = (suggestions?.length ?? 0) > 0;
    });
  }

  onNombreViaInput(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.nombreViaSubject.next(value);
  }

  onNombreParqueInput(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.nombreParqueSubject.next(value);
  }

  onNombreHabilitacionInput(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    // Si el texto deja de coincidir con la habilitación confirmada,
    // invalidamos los filtros dependientes para evitar valores residuales.
    if (value.trim() !== this.habilitacionConfirmada) {
      this.resetDependenciasHabilitacion();
    }
    this.nombreHabilitacionSubject.next(value);
  }

  /**
   * Al cambiar la manzana se reinicia el lote y su lista (evita que queden
   * lotes residuales de la manzana anterior) y se cargan los lotes nuevos.
   */
  onManzanaChange(_event: Event) {
    this.loteUrbano = '';
    this.loteSuggestions = [];
    this.loadLotes();
  }

  /**
   * Limpia los filtros dependientes de la habilitación (confirmación,
   * manzana y lote), evitando que queden valores de búsquedas anteriores.
   */
  private resetDependenciasHabilitacion(): void {
    this.habilitacionConfirmada = '';
    this.manzanaUrbana = '';
    this.loteUrbano = '';
    this.manzanaSuggestions = [];
    this.loteSuggestions = [];
  }

  /** Formatea el código catastral mientras el usuario escribe (XXXX-XXX-XXX) */
  handleCodigoCatastralChange(value: string) {
    const numbers = value.replace(/\D/g, "");
    let formatted = numbers.slice(0, 2); // Sector
    if (numbers.length > 2) formatted += "-" + numbers.slice(2, 5); // Manzana
    if (numbers.length > 5) formatted += "-" + numbers.slice(5, 8); // Lote
    this.codigoCatastral = formatted;
  }

  /** Limpia los campos de la pestaña activa */
  handleClear() {
    this.searchError.set(null);
    this.loading.set(false);
    this.mapService.clearHighlightLayer(); // Limpia cualquier resaltado de búsqueda anterior
    this.mapService.clearSearchMarker(); // Limpia el marcador del mapa

    const clearActions: Record<typeof this.activeTab, () => void> = {
      cuc: () => { this.cuc = ''; this.cucResultados = []; this.cucConsultado = false; this.cucSeleccionado = null; },
      predial: () => { this.codigoPredial = ''; this.codPredialResultados = []; this.codPredialConsultado = false; this.codPredialSeleccionado = null; },
      direccion: () => {        
        this.nombreVia = '';        
      },
      habilitacion: () => {
        this.nombreHabilitacion = '';
        this.habilitacionSuggestions = [];
        this.resetDependenciasHabilitacion();
      },
      titular: () => {
        this.codigoTitular = '';
        this.titulares = [];
        this.titularesConsultados = false;
      },
      denominacion: () => this.denominacionPredio = '',
      parque: () => this.nombreParque = '',
      catastral: () => this.codigoCatastral = '',      
    };

    if (clearActions[this.activeTab]) {
      clearActions[this.activeTab]();
    }
  }
  /** Valida si el botón de búsqueda debe estar deshabilitado */
  isSearchDisabled(): boolean {
    switch (this.activeTab) {
      case 'cuc':
        return this.cuc.trim().length === 0;
      case 'predial':
        return this.codigoPredial.trim().length === 0;
      case 'direccion':
        return this.nombreVia.trim().length === 0;
      case 'habilitacion':
        return this.nombreHabilitacion.trim().length === 0 || 
               this.manzanaUrbana.trim().length === 0 || 
               this.loteUrbano.trim().length === 0;
      case 'titular':
        return this.codigoTitular.trim().length === 0;
      case 'denominacion':
        return this.denominacionPredio.trim().length === 0;
      case 'parque':
        return this.nombreParque.trim().length === 0;
      case 'catastral':
        return this.codigoCatastral.length < 10; // 8 dígitos + 2 guiones      
      default:
        return true;
    }
  }

  /** Ejecuta la búsqueda según la pestaña activa */
  selectViaSuggestion(suggestion: ViaSugerencia) {
    // Asignamos el nombre de la vía y su código (codi_via del WFS)
    this.nombreVia = suggestion.etiqueta.trim();
    this.codVia = suggestion.codVia.trim();
    this.showViaSuggestions = false;
    this.viaSuggestions = [];
    // Acto 1: mostramos la vía resaltada en el mapa
    this.mostrarViaSeleccionada();
    // Acto 1: cargamos las numeraciones para el selector (acto 2)
    this.consultarViaNumeros();
  }

  onNombreViaBlur() {
    // Ocultamos las sugerencias con un pequeño retardo para permitir el clic
    setTimeout(() => this.showViaSuggestions = false, 200);
  }

  /**
   * Consulta las numeraciones (lotes) asociadas a un código de vía
   * usando el endpoint listar-via-numero del Geovisor municipal.
   */
  consultarViaNumeros() {
    const codVia = this.codVia.trim();
    if (!codVia) {
      this.viaNumerosError = 'Ingrese un código de vía para consultar.';
      this.viaNumeros = [];
      return;
    }
    this.loadingViaNumeros = true;
    this.viaNumerosError = null;
    this.viaNumeros = [];
    this.mapService.listarViaNumeros(codVia)
      .pipe(take(1))
      .subscribe({
        next: (registros) => {
          this.loadingViaNumeros = false;
          this.viaNumeros = registros;
          if (registros.length === 0) {
            this.viaNumerosError = 'No se encontraron numeraciones para el código de vía ingresado.';
          }
        },
        error: (err) => {
          console.error('Error al consultar numeraciones de vía:', err);
          this.loadingViaNumeros = false;
          this.viaNumerosError = 'Error de conexión con el servicio de numeraciones.';
        }
      });
  }

  onNombreParqueBlur() {
    setTimeout(() => {
      this.showParqueSuggestions = false;
    }, 200);
  }

  onNombreHabilitacionBlur() {
    setTimeout(() => this.showHabilitacionSuggestions = false, 200);
  }

  selectHabilitacionSuggestion(suggestion: GeoJSONFeature) {
    const nombre = String(suggestion.properties['urbanizaci'] ?? '').trim();
    this.nombreHabilitacion = nombre;
    this.habilitacionConfirmada = nombre;
    this.showHabilitacionSuggestions = false;
    this.habilitacionSuggestions = [];
    // Reiniciamos los filtros dependientes y cargamos las manzanas
    // disponibles de esta habilitación.
    this.manzanaUrbana = '';
    this.loteUrbano = '';
    this.loteSuggestions = [];
    this.loadManzanas();
  }

  /** Carga las manzanas disponibles para la habilitación confirmada */
  private loadManzanas() {
    if (!this.nombreHabilitacion) return;
    this.mapService.searchManzanasByHabilitacion(this.nombreHabilitacion, '')
      .pipe(take(1))
      .subscribe({
        next: manzanas => this.manzanaSuggestions = manzanas || [],
        error: () => this.searchError.set('No se pudieron cargar las manzanas de la habilitación.')
      });
  }

  /** Carga los lotes disponibles para la manzana seleccionada */
  private loadLotes() {
    if (!this.nombreHabilitacion || !this.manzanaUrbana) return;
    this.mapService.searchLotesByHabilitacionManzana(this.nombreHabilitacion, this.manzanaUrbana, '')
      .pipe(take(1))
      .subscribe({
        next: lotes => this.loteSuggestions = lotes || [],
        error: () => this.searchError.set('No se pudieron cargar los lotes de la manzana.')
      });
  }

  /**
   * Maneja específicamente la búsqueda por dirección, que tiene una lógica diferente
   * al resto de búsquedas (no emite un SearchResult, solo navega).
   */
  private handleBuscarByDireccion() {
    if (this.isSearchDisabled() || this.loading()) {
      return;
    }
    this.loading.set(true);
    this.searchError.set(null);
    this.mapService.searchVias(this.nombreVia, true, false)
      .pipe(take(1))
      .subscribe({
        next: (features) => {
          if (!features || features.length === 0) {
            // La coincidencia exacta puede fallar por pequeñas diferencias de
            // escritura; reintentamos con búsqueda parcial (ILIKE).
            this.buscarViaParcial();
            return;
          }
          // Capturamos el código de vía del resultado y cargamos las numeraciones
          // (listar-via-numero), igual que al elegir una sugerencia del autocompletado.
          this.capturarCodVia(features);
          this.procesarViasEncontradas(features);
        },
        error: (err) => {
          console.error('Error en la búsqueda por dirección:', err);
          this.searchError.set('Error de conexión con el servicio de vías.');
          this.loading.set(false);
        }
      });
  }

  /**
   * Extrae el código de vía (codi_via) de los features encontrados y dispara
   * la consulta de numeraciones, de modo que el selector de "Número" también
   * se llene cuando el usuario consulta sin pasar por el autocompletado.
   */
  private capturarCodVia(features: GeoJSONFeature[]): void {
    const codVia = features
      .map(f => String(f.properties['codi_via'] ?? '').trim())
      .find(cod => cod);
    if (codVia) {
      this.codVia = codVia;
      this.consultarViaNumeros();
    }
  }

  /**
   * Segundo intento de búsqueda por dirección usando coincidencia parcial.
   */
  private buscarViaParcial(): void {
    this.mapService.searchVias(this.nombreVia, false, false)
      .pipe(take(1))
      .subscribe({
        next: (features) => {
          if (!features || features.length === 0) {
            this.loading.set(false);
            this.searchError.set('No se encontraron vías con los criterios ingresados.');
            return;
          }
          // Mismo tratamiento que la búsqueda exacta: capturamos el código
          // de vía y cargamos sus numeraciones.
          this.capturarCodVia(features);
          this.procesarViasEncontradas(features);
        },
        error: () => {
          this.loading.set(false);
          this.searchError.set('Error de conexión con el servicio de vías.');
        }
      });
  }

  /**
   * Agrupa todos los segmentos encontrados de la(s) vía(s) en una única
   * geometría MultiLineString, la resalta en el mapa (capa de resaltado,
   * color ámbar para líneas) y ajusta la vista a su extensión completa.
   */
  private procesarViasEncontradas(features: GeoJSONFeature[], cerrarPanel = true): void {
    const multiLineString: GeoJSONGeometry = {
      type: 'MultiLineString',
      // Usamos flatMap para manejar tanto LineString (un array de coordenadas)
      // como MultiLineString (un array de arrays de coordenadas).
      coordinates: features.flatMap(f =>
        f.geometry.type === 'LineString'
          ? [f.geometry.coordinates]
          : f.geometry.coordinates
      )
    };
    // fitToGeometry resalta la geometría y ajusta la vista a su extensión
    this.mapService.fitToGeometry(multiLineString, 'EPSG:32718', undefined, true);
    this.loading.set(false);
    if (cerrarPanel) {
      this.Close.emit(); // Cerramos el panel para una mejor visualización
    }
  }

  /**
   * Acto 1 del flujo por dirección: al seleccionar una vía de las sugerencias,
   * la dibuja resaltada en el mapa (sin cerrar el panel) y carga las
   * numeraciones de esa vía para el selector de números.
   */
  private mostrarViaSeleccionada(): void {
    if (!this.nombreVia.trim()) return;
    this.loading.set(true);
    this.searchError.set(null);
    this.mapService.searchVias(this.nombreVia, false, false)
      .pipe(take(1))
      .subscribe({
        next: (features) => {
          if (features && features.length > 0) {
            // Dibujamos solo los segmentos de la vía seleccionada (mismo codi_via);
            // si el filtro no arroja resultados, usamos todos los encontrados.
            const propias = features.filter(f =>
              String(f.properties['codi_via'] ?? '').trim() === this.codVia
            );
            this.procesarViasEncontradas(propias.length > 0 ? propias : features, false);
          }
          this.loading.set(false);
        },
        error: (err) => {
          console.error('Error al mostrar la vía seleccionada:', err);
          this.loading.set(false);
        }
      });
  }

  private handleBuscarByParque() {
    if (this.isSearchDisabled() || this.loading()) {
      return;
    }
    this.loading.set(true);
    this.searchError.set(null);
    this.mapService.searchParquesByDenominacion(this.nombreParque)
      .pipe(take(1))
      .subscribe({
        next: (features) => {
          this.loading.set(false);
          if (features && features.length > 0) {
            // Creamos una GeometryCollection para que fitToGeometry se ajuste a todas las geometrías.
            const geometryCollection: GeoJSONGeometry = {
              type: 'GeometryCollection',
              geometries: features.map(f => f.geometry)
            };
            // Ajustamos el mapa para que todas las geometrías del parque sean visibles.
            // La capa de resaltado se encargará de dibujar todos los polígonos.
            this.mapService.fitToGeometry(geometryCollection, 'EPSG:32718', undefined, true);
            // No se emite un SearchResult porque un parque no es un predio, solo se ubica en el mapa.
            this.Close.emit(); // Cerramos el panel de búsqueda
          } else {
            this.searchError.set('No se encontraron parques con los criterios ingresados.');
          }
        },
        error: (err) => {
          console.error('Error en la búsqueda por parque:', err);
          this.searchError.set('Error de conexión con el servicio de parques.');
          this.loading.set(false);
        }
      });
  }

  /**
   * Búsqueda por Titular Catastral: consulta el API del Geovisor con el
   * apellido / razón social ingresado y muestra las coincidencias (solo el
   * nombre del titular). La navegación al lote ocurre al seleccionar un
   * resultado (ver irAlLoteDeTitular).
   */
  private handleBuscarByTitular() {
    if (this.isSearchDisabled() || this.loading()) {
      return;
    }
    this.loading.set(true);
    this.searchError.set(null);
    this.titulares = [];
    this.titularesConsultados = false;
    // El API solo recibe mayúsculas: normalizamos el texto antes de consultarlo.
    this.mapService.buscarTitularCatastral(this.codigoTitular.toUpperCase()).pipe(take(1)).subscribe({
      next: (registros) => {
        this.loading.set(false);
        this.titularesConsultados = true;
        this.titulares = registros;
        if (registros.length === 0) {
          this.searchError.set('No se encontraron titulares con el criterio ingresado.');
        }
      },
      error: (err) => {
        console.error('Error en la búsqueda por titular catastral:', err);
        this.loading.set(false);
        this.titularesConsultados = true;
        this.searchError.set('Error de conexión con el servicio de titulares.');
      }
    });
  }

  /**
   * Navega al lote asociado al titular seleccionado usando su `codlote`
   * (id_lote). Replica la lógica de la búsqueda catastral: ajuste del mapa al
   * polígono, marcador y panel de resultado, sin alterar dicha búsqueda.
   */
  irAlLoteDeTitular(registro: TitularCatastral) {
    if (!registro?.codlote) {
      this.searchError.set('No se encontró el lote para el titular seleccionado.');
      return;
    }
    this.loading.set(true);
    this.searchError.set(null);
    this.mapService.searchLoteByCodigoCatastral(registro.codlote).pipe(take(1)).subscribe({
      next: (feature) => {
        this.loading.set(false);
        if (feature) {
          const props = feature.properties as any;
          const result: SearchResult = {
            codigoCatastral: String(props['id_lote'] || registro.codlote).trim(),
            direccion: props['direccion'] ?? props['ubicacion'] ?? "Ubicación no disponible",
            propietario: registro.txttitular ?? props['propietario'] ?? "Información reservada",
            area: props['area_lote'] ? `${props['area_lote']} m²` : "No disponible",
            zonificacion: props['zonificacion'] ?? "No disponible",
            fotoFrontis: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=400&q=80",
            numeroPisos: props['pisos'] ?? 1,
            geometry: feature.geometry
          };
          this.mapService.fitToGeometry(feature.geometry, 'EPSG:32718', undefined, true);
          this.mapService.drawSearchMarker(feature.geometry, `Titular: ${registro.txttitular}`);
          this.emitResult(result);
        } else {
          this.searchError.set('Número de lote catastral no ubicado en el mapa (id_lote).');
        }
      },
      error: (err) => {
        console.error('Error al navegar al lote del titular:', err);
        this.loading.set(false);
        this.searchError.set('Error de conexión con el servicio catastral.');
      }
    });
  }

  /**
   * Consulta el API `busqueda-cuc` con el CUC (8 dígitos)
   * y muestra la lista de interiores encontrados.
   */
  handleBuscarByCuc() {
    const codigo = (this.cuc ?? '').trim();
    if (!/^\d{8}$/.test(codigo)) {
      this.searchError.set('Ingrese los 08 dígitos del CUC para buscar.');
      return;
    }
    this.loading.set(true);
    this.searchError.set(null);
    this.cucResultados = [];
    this.cucConsultado = false;
    this.cucSeleccionado = null;
    this.mapService.buscarPorCuc(codigo).pipe(take(1)).subscribe({
      next: (registros) => {
        this.loading.set(false);
        this.cucConsultado = true;
        this.cucResultados = registros;
        if (registros.length === 0) {
          this.searchError.set('No se encontró el CUC ingresado.');
        }
      },
      error: (err) => {
        console.error('Error en la búsqueda por CUC:', err);
        this.loading.set(false);
        this.cucConsultado = true;
        this.searchError.set('Error de conexión con el servicio catastral.');
      }
    });
  }

  /**
   * Navega al lote asociado al registro CUC seleccionado usando su `codlote`
   * (id_lote). Replica la lógica de la búsqueda catastral: ajuste del mapa al
   * polígono, marcador y panel de resultado, sin alterar dicha búsqueda.
   */
  irAlLoteDeCuc(registro: CucResultado) {
    if (!registro?.codlote) {
      this.searchError.set('No se encontró el lote para el CUC seleccionado.');
      return;
    }
    this.cucSeleccionado = this.cucKey(registro);
    this.loading.set(true);
    this.searchError.set(null);
    this.mapService.searchLoteByCodigoCatastral(registro.codlote).pipe(take(1)).subscribe({
      next: (feature) => {
        this.loading.set(false);
        if (feature) {
          const props = feature.properties as any;
          const direccionApi = [registro.tipvia, registro.nomvia, registro.numero]
            .filter(p => (p ?? '').toString().trim() !== '')
            .join(' ').trim();
          const interiorApi = [registro.txttipint, registro.numeroint]
            .filter(p => (p ?? '').toString().trim() !== '')
            .join(' ').trim();
          const direccion = ([direccionApi, interiorApi ? `Int. ${interiorApi}` : '']
            .filter(p => p !== '').join(' - ').trim())
            || (props['direccion'] ?? props['ubicacion'] ?? 'Ubicación no disponible');
          const result: SearchResult = {
            codigoCatastral: String(props['id_lote'] || registro.codlote).trim(),
            direccion,
            propietario: registro.txtpropietario ?? props['propietario'] ?? 'Información reservada',
            area: props['area_lote'] ? `${props['area_lote']} m²` : 'No disponible',
            zonificacion: props['zonificacion'] ?? 'No disponible',
            fotoFrontis: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=400&q=80',
            numeroPisos: props['pisos'] ?? 1,
            geometry: feature.geometry
          };
          this.mapService.fitToGeometry(feature.geometry, 'EPSG:32718', undefined, true);
          this.mapService.drawSearchMarker(feature.geometry, `CUC encontrado: ${registro.txtcuc}`);
          this.emitResult(result);
        } else {
          this.searchError.set('Número de lote catastral no ubicado en el mapa (id_lote).');
        }
      },
      error: (err) => {
        console.error('Error al navegar al lote del CUC:', err);
        this.loading.set(false);
        this.searchError.set('Error de conexión con el servicio catastral.');
      }
    });
  }

  /**
   * Consulta el API `busqueda-codpredial` con el Código Predial y muestra
   * los lotes únicos encontrados (igual que la búsqueda CUC).
   */
  handleBuscarByCodPredial() {
    const codigo = (this.codigoPredial ?? '').trim();
    if (!codigo) {
      this.searchError.set('Ingrese el Código Predial para buscar.');
      return;
    }
    this.loading.set(true);
    this.searchError.set(null);
    this.codPredialResultados = [];
    this.codPredialConsultado = false;
    this.codPredialSeleccionado = null;
    this.mapService.buscarPorCodPredial(codigo).pipe(take(1)).subscribe({
      next: (registros) => {
        this.loading.set(false);
        this.codPredialConsultado = true;
        this.codPredialResultados = registros;
        if (registros.length === 0) {
          this.searchError.set('No se encontró el Código Predial ingresado.');
        }
      },
      error: (err) => {
        console.error('Error en la búsqueda por Código Predial:', err);
        this.loading.set(false);
        this.codPredialConsultado = true;
        this.searchError.set('Error de conexión con el servicio catastral.');
      }
    });
  }

  /**
   * Navega al lote asociado al registro de Código Predial seleccionado usando
   * su `codlote` (id_lote). Replica la lógica CUC: ajuste del mapa al
   * polígono, marcador y panel de resultado.
   */
  irAlLoteDeCodPredial(registro: CodPredialResultado) {
    if (!registro?.codlote) {
      this.searchError.set('No se encontró el lote para el Código Predial seleccionado.');
      return;
    }
    this.codPredialSeleccionado = this.codPredialKey(registro);
    this.loading.set(true);
    this.searchError.set(null);
    this.mapService.searchLoteByCodigoCatastral(registro.codlote).pipe(take(1)).subscribe({
      next: (feature) => {
        this.loading.set(false);
        if (feature) {
          const props = feature.properties as any;
          const direccionApi = [registro.tipvia, registro.nomvia, registro.numero]
            .filter(p => (p ?? '').toString().trim() !== '')
            .join(' ').trim();
          const interiorApi = [registro.txttipint, registro.numeroint]
            .filter(p => (p ?? '').toString().trim() !== '')
            .join(' ').trim();
          const direccion = ([direccionApi, interiorApi ? `Int. ${interiorApi}` : '']
            .filter(p => p !== '').join(' - ').trim())
            || (props['direccion'] ?? props['ubicacion'] ?? 'Ubicación no disponible');
          const result: SearchResult = {
            codigoCatastral: String(props['id_lote'] || registro.codlote).trim(),
            direccion,
            propietario: registro.txttitular ?? props['propietario'] ?? 'Información reservada',
            area: props['area_lote'] ? `${props['area_lote']} m²` : 'No disponible',
            zonificacion: props['zonificacion'] ?? 'No disponible',
            fotoFrontis: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=400&q=80',
            numeroPisos: props['pisos'] ?? 1,
            geometry: feature.geometry
          };
          this.mapService.fitToGeometry(feature.geometry, 'EPSG:32718', undefined, true);
          this.mapService.drawSearchMarker(feature.geometry, `Código Predial encontrado: ${registro.txtcodipredrent}`);
          this.emitResult(result);
        } else {
          this.searchError.set('Número de lote catastral no ubicado en el mapa (id_lote).');
        }
      },
      error: (err) => {
        console.error('Error al navegar al lote del Código Predial:', err);
        this.loading.set(false);
        this.searchError.set('Error de conexión con el servicio catastral.');
      }
    });
  }

  handleSearch() {
    if (this.isSearchDisabled() || this.loading()) {
      return; // No hacer nada si la búsqueda está deshabilitada o ya está cargando
    }
    // La búsqueda de parques se gestiona exclusivamente por el autocompletado,
    // por lo que el botón "Consultar" no debe hacer nada en esta pestaña.
    if (this.activeTab === 'parque') {
      this.handleBuscarByParque();
      return;
    }
    // La búsqueda por titular catastral tiene su propio manejador:
    // consulta el API y muestra la lista de coincidencias.
    if (this.activeTab === 'titular') {
      this.handleBuscarByTitular();
      return;
    }
    // La búsqueda por dirección ahora tiene su propio manejador
    if (this.activeTab === 'direccion') {
      // Acto 2: si ya hay una vía con numeraciones y un número seleccionado,
      // el botón Consultar navega al lote correspondiente.
      if (this.numeroSeleccionado && this.viaNumeros.length > 0) {
        this.irAloteSeleccionado();
        return;
      }
      this.handleBuscarByDireccion();
      return;
    }
    if (this.activeTab === 'catastral') {
      this.loading.set(true);
      this.searchError.set(null);
      this.mapService.searchLoteByCodigoCatastral(`31-${this.codigoCatastral}`).pipe(take(1)).subscribe({
        next: (feature) => {
          this.loading.set(false);
          if (feature) {
            const props = feature.properties as any;
            const result: SearchResult = {
              codigoCatastral: String(props['id_lote'] || this.codigoCatastral).trim(),
              direccion: props['direccion'] ?? props['ubicacion'] ?? "Ubicación no disponible",
              propietario: props['propietario'] ?? "Información reservada",
              area: props['area_lote'] ? `${props['area_lote']} m²` : "No disponible",
              zonificacion: props['zonificacion'] ?? "No disponible",
              fotoFrontis: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=400&q=80",
              numeroPisos: props['pisos'] ?? 1,
              geometry: feature.geometry
            };            
            // Navegamos al polígono encontrado automáticamente
            this.mapService.fitToGeometry(feature.geometry, 'EPSG:32718', undefined, true);
            this.mapService.drawSearchMarker(feature.geometry);            
            this.emitResult(result);
          } else {
            this.searchError.set('No se encontró el lote con el código ingresado.');
          }
        },
        error: (err) => {
          console.error('Error en la búsqueda catastral:', err);
          this.searchError.set('Error de conexión con el servicio catastral.');
          this.loading.set(false);
        }
      });
    } else if (this.activeTab === 'cuc') {
      // Búsqueda CUC: consulta el API WSGEOVISOR/busqueda-cuc (txtcuc) y
      // muestra los lotes únicos. Al elegir uno se navega al lote usando su
      // codlote (geometría WFS por código catastral).
      const codigo = (this.cuc ?? '').trim();
      if (!/^\d{8}$/.test(codigo)) {
        this.searchError.set('Ingrese los 08 dígitos del CUC para buscar.');
        return;
      }
      this.handleBuscarByCuc();
    } else if (this.activeTab === 'predial') {
      // Búsqueda por Código Predial: consulta el API WSGEOVISOR/busqueda-codpredial
      // (txtcodpredial) y muestra los lotes únicos. Al elegir uno se navega al
      // lote usando su codlote (geometría WFS por código catastral).
      const codigo = (this.codigoPredial ?? '').trim();
      if (!codigo) {
        this.searchError.set('Ingrese el Código Predial para buscar.');
        return;
      }
      this.handleBuscarByCodPredial();
    } else if (this.activeTab === 'habilitacion') {
      // Solo consultamos cuando los tres filtros están completos
      if (!this.nombreHabilitacion.trim() || !this.manzanaUrbana.trim() || !this.loteUrbano.trim()) {
        this.searchError.set('Complete habilitación, manzana y lote para consultar.');
        return;
      }
      this.loading.set(true);
      this.searchError.set(null);
      this.mapService.searchLoteByHabilitacion(this.nombreHabilitacion, this.manzanaUrbana, this.loteUrbano)
        .pipe(take(1))
        .subscribe({
          next: (feature) => {
            this.loading.set(false);
            if (feature) {
              const props = feature.properties as any;
              const result: SearchResult = {
                codigoCatastral: String(props['id_lote'] || 'N/A').trim(),
                direccion: props['direccion'] ?? props['ubicacion'] ?? "Ubicación no disponible",
                propietario: props['propietario'] ?? "Información reservada",
                area: props['area_lote'] ? `${props['area_lote']} m²` : "No disponible",
                zonificacion: props['zonificacion'] ?? "No disponible",
                fotoFrontis: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=400&q=80",
                numeroPisos: props['pisos'] ?? 1,
                geometry: feature.geometry
              };
              // Navegamos al polígono encontrado y lo resaltamos
              this.mapService.fitToGeometry(feature.geometry, 'EPSG:32718', undefined, true);
              this.mapService.drawSearchMarker(feature.geometry);
              this.emitResult(result);
            } else {
              this.searchError.set('No se encontró el lote con los datos de habilitación ingresados.');
            }
          },
          error: (err) => {
            console.error('Error en la búsqueda por habilitación:', err);
            this.searchError.set('Error de conexión con el servicio de búsqueda.');
            this.loading.set(false);
          }
      });
    }  
  }

  selectParqueSuggestion(parque: GeoJSONFeature) {
    // Solo se asigna el nombre al input; el mapa se actualiza
    // únicamente al presionar el botón "Consultas".
    this.nombreParque = parque.properties['denominaci'];
    this.showParqueSuggestions = false;
    this.parqueSuggestions = [];
  }

  private emitResult(result: SearchResult) {
    this.SearchResult.emit(result);
  }
}

