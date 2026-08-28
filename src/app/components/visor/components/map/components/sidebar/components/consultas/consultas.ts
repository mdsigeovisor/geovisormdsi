import { Component, Input, signal, output, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MapService } from '../../../../../../../../services/map.service';
import { AuthService } from '../../../../../../../../services/auth.service';
import { Subject, take, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';
import { GeoJSONFeature, GeoJSONGeometry, SearchResult } from '../../../../../../../../interfaces/geoLayers';

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
  /** Campos para búsqueda por Código Predial */
  codigoPredial = '';
  /** Campos para búsqueda por Dirección */
  nombreVia = '';
  // --- Lógica para autocompletado de vías ---
  private readonly nombreViaSubject = new Subject<string>();
  viaSuggestions: string[] = [];
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
      switchMap(partialName => this.mapService.searchVias(partialName, false, true))
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
      cuc: () => this.cuc = '',
      predial: () => this.codigoPredial = '',
      direccion: () => {        
        this.nombreVia = '';        
      },
      habilitacion: () => {
        this.nombreHabilitacion = '';
        this.habilitacionSuggestions = [];
        this.resetDependenciasHabilitacion();
      },
      titular: () => this.codigoTitular = '',
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
  selectViaSuggestion(suggestion: string) {
    this.nombreVia = suggestion.trim(); // Limpiamos espacios en blanco al seleccionar
    this.showViaSuggestions = false;
    this.viaSuggestions = [];
    this.handleBuscarByDireccion(); // Ejecutamos la búsqueda de dirección automáticamente
  }

  onNombreViaBlur() {
    // Ocultamos las sugerencias con un pequeño retardo para permitir el clic
    setTimeout(() => this.showViaSuggestions = false, 200);
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
  private procesarViasEncontradas(features: GeoJSONFeature[]): void {
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
    this.Close.emit(); // Cerramos el panel para una mejor visualización
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
            // Ajustamos el mapa para que todas las geometrías de la vía sean visibles.
            // La capa de resaltado se encargará de dibujar todos los segmentos.
            this.mapService.fitToGeometry(geometryCollection, 'EPSG:32718', undefined, true);
            // No se emite un SearchResult porque una vía no es un predio, solo se ubica en el mapa.
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
    // La búsqueda por dirección ahora tiene su propio manejador
    if (this.activeTab === 'direccion') {
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
      this.loading.set(true);
      this.searchError.set(null);
      this.mapService.searchLoteByCuc(this.cuc).pipe(take(1)).subscribe({
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
            this.mapService.fitToGeometry(feature.geometry, 'EPSG:32718', undefined, true);
            this.mapService.drawSearchMarker(feature.geometry, `CUC encontrado: ${this.cuc}`);
            this.emitResult(result);
          } else {
            this.searchError.set('No se encontró el lote con el CUC ingresado.');
          }
        },
        error: (err) => {
          console.error('Error en la búsqueda por CUC:', err);
          this.searchError.set('Error de conexión con el servicio catastral.');
          this.loading.set(false);
        }
      });
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
    this.nombreParque = parque.properties['denominaci'];
    this.showParqueSuggestions = false;
    // Resaltamos la geometría del parque seleccionado y centramos el mapa en él.
    this.mapService.fitToGeometry(parque.geometry, 'EPSG:32718', undefined, true);
    this.Close.emit(); // Cerramos el panel para una mejor visualización.
    this.parqueSuggestions = [];
  }

  private emitResult(result: SearchResult) {
    this.SearchResult.emit(result);
  }
}

