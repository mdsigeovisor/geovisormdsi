import { Component, Input, signal, output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MapService } from '../../../../../../../../services/map.service';
import { SearchResult } from '../../../../../../../../interfaces/search';
import { Subject, take, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';
import { GeoJSONGeometry } from '../../../../../../../../interfaces/geoLayers';

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
  Close = output<void>();
  SearchResult = output<SearchResult>();
  /** Control de pestañas */
  activeTab: 'catastral' | 'predial' | 'direccion' | 'habilitacion' | 'titular' | 'cuc' | 'ciudadano' | 'denominacion' | 'parque' = 'catastral';
  /** Campos para búsqueda por CUC */
  cuc = '';
  /** Campos para búsqueda por Código Predial */
  codigoPredial = '';
  /** Campos para búsqueda por Dirección */
  nombreVia = '';
  numeroMunicipal = ''; // Mantenido por si se usa en el futuro
  numeroCuadra = '';
  // --- Lógica para autocompletado de vías ---
  private readonly nombreViaSubject = new Subject<string>();
  viaSuggestions: string[] = [];
  showViaSuggestions = false;
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
  /** Campos para búsqueda por Ciudadano */
  searchType: 'dni' | 'nombre' = 'dni';
  dni = '';
  nombreCiudadano = '';
  showCitizenResults = false;
  selectedCitizen = '';
  citizenProperties: SearchResult[] = [];
  /** Datos simulados para la demostración */
 
  constructor() {
    this.nombreViaSubject.pipe(
      debounceTime(300), // Espera 300ms después de la última pulsación
      distinctUntilChanged(), // Solo emite si el valor ha cambiado
      switchMap(partialName => this.mapService.getUniqueVias(partialName))
    ).subscribe(suggestions => {
      this.viaSuggestions = suggestions;
      this.showViaSuggestions = suggestions.length > 0;
    });
  }

  onNombreViaInput(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.nombreViaSubject.next(value);
  }

  /** Formatea el código catastral mientras el usuario escribe (XXXX-XXX-XXX) */
  handleCodigoCatastralChange(value: string) {
    const numbers = value.replace(/\D/g, "");
    let formatted = numbers.slice(0, 2); // Sector
    if (numbers.length > 2) formatted += "-" + numbers.slice(2, 5); // Manzana
    if (numbers.length > 5) formatted += "-" + numbers.slice(5, 8); // Lote
    this.codigoCatastral = formatted;
  }

  /** Asegura que el DNI sea solo numérico y de 8 dígitos */
  handleDniChange(value: string) {
    this.dni = value.replace(/\D/g, "").slice(0, 8);
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
        this.numeroCuadra = '';        
      },
      habilitacion: () => {
        this.nombreHabilitacion = '';
        this.manzanaUrbana = '';
        this.loteUrbano = '';
      },
      titular: () => this.codigoTitular = '',
      denominacion: () => this.denominacionPredio = '',
      parque: () => this.nombreParque = '',
      catastral: () => this.codigoCatastral = '',
      ciudadano: () => {
        this.dni = '';
        this.nombreCiudadano = '';
      }
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
        return this.nombreHabilitacion.trim().length === 0;
      case 'titular':
        return this.codigoTitular.trim().length === 0;
      case 'denominacion':
        return this.denominacionPredio.trim().length === 0;
      case 'parque':
        return this.nombreParque.trim().length === 0;
      case 'catastral':
        return this.codigoCatastral.length < 10; // 8 dígitos + 2 guiones
      case 'ciudadano':
        return this.searchType === 'dni'
          ? this.dni.length < 8
          : this.nombreCiudadano.trim().length < 3;
      default:
        return true;
    }
  }

  /** Ejecuta la búsqueda según la pestaña activa */
  selectViaSuggestion(suggestion: string) {
    this.nombreVia = suggestion.trim(); // Limpiamos espacios en blanco al seleccionar
    this.showViaSuggestions = false;
    this.viaSuggestions = [];
    this.handleSearchByAddress(); // Ejecutamos la búsqueda de dirección automáticamente
  }

  onNombreViaBlur() {
    // Ocultamos las sugerencias con un pequeño retardo para permitir el clic
    setTimeout(() => this.showViaSuggestions = false, 200);
  }

  /**
   * Maneja específicamente la búsqueda por dirección, que tiene una lógica diferente
   * al resto de búsquedas (no emite un SearchResult, solo navega).
   */
  private handleSearchByAddress() {
    if (this.isSearchDisabled() || this.loading()) {
      return;
    }

    this.loading.set(true);
    this.searchError.set(null);
    this.mapService.searchViasByEtiquetado(this.nombreVia)
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
            this.searchError.set('No se encontraron vías con los criterios ingresados.');
          }
        },
        error: (err) => {
          console.error('Error en la búsqueda por dirección:', err);
          this.searchError.set('Error de conexión con el servicio de vías.');
          this.loading.set(false);
        }
      });
  }

  handleSearch() {
    if (this.isSearchDisabled() || this.loading()) {
      return; // No hacer nada si la búsqueda está deshabilitada o ya está cargando
    }

    // La búsqueda por dirección ahora tiene su propio manejador
    if (this.activeTab === 'direccion') {
      this.handleSearchByAddress();
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
    }  else if (this.activeTab === 'ciudadano') {
      this.loading.set(true);
      this.searchError.set(null);
      const query = this.searchType === 'dni' ? this.dni : this.nombreCiudadano;

      this.mapService.searchPropertiesByCitizen(this.searchType, query).pipe(take(1)).subscribe({
        next: (features) => {
          this.loading.set(false);
          if (features && features.length > 0) {
            this.citizenProperties = features.map(feature => {
              const props = feature.properties as any;
              return {
                codigoCatastral: String(props['id_lote'] || 'N/A').trim(),
                direccion: props['direccion'] ?? props['ubicacion'] ?? "Ubicación no disponible",
                propietario: props['propietario'] ?? "Información reservada",
                area: props['area_lote'] ? `${props['area_lote']} m²` : "No disponible",
                zonificacion: props['zonificacion'] ?? "No disponible",
                fotoFrontis: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=400&q=80", // Mantener o adaptar
                numeroPisos: props['pisos'] ?? 1,
                geometry: feature.geometry
              };
            });
            this.selectedCitizen = this.citizenProperties[0]?.propietario || (this.searchType === 'dni' ? `DNI ${this.dni}`: this.nombreCiudadano);
            this.showCitizenResults = true;
          } else {
            this.searchError.set('No se encontraron propiedades para el ciudadano especificado.');
            this.showCitizenResults = false;
            this.citizenProperties = [];
          }
        },
        error: (err) => {
          console.error('Error en la búsqueda por ciudadano:', err);
          this.searchError.set('Error de conexión con el servicio de búsqueda.');
          this.loading.set(false);
        }
      });
    }
  }

  /** Selecciona un predio de la lista del ciudadano */
  handleSelectProperty(property: SearchResult) {
    // Si el predio tiene geometría, centramos el mapa antes de emitir
    if (property.geometry) {
      this.mapService.fitToGeometry(property.geometry, 'EPSG:32718', undefined, true);
    }
    
    this.emitResult(property);
    this.showCitizenResults = false;
  }
  /** Método privado para emitir el resultado y opcionalmente cerrar el panel */
  private emitResult(result: SearchResult) {
    this.SearchResult.emit(result);
    // Si deseas que el panel de búsqueda se cierre automáticamente al encontrar algo:
    // this.onClose.emit();
  }
}
