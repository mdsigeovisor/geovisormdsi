import { Component, Input, signal, output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MapService } from '../../../../../../../../services/map.service';
import { SearchResult } from '../../../../../../../../interfaces/search';
import { Subject, debounceTime, distinctUntilChanged, switchMap, take } from 'rxjs';


@Component({
  selector: 'app-buscar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './buscar.html',
  styleUrl: './buscar.css',
})
export class Buscar {
  @Input() isGuest: boolean = false;
  private readonly mapService = inject(MapService);
  Close = output<void>();
  SearchResult = output<SearchResult>();
  /** Control de pestañas */
  activeTab: 'cuc' | 'predial' | 'direccion' | 'habilitacion' | 'titular' | 'catastral' | 'ciudadano' | 'denominacion' | 'parque' = 'cuc';
  /** Campos para búsqueda por CUC */
  cuc = '';
  /** Campos para búsqueda por Código Predial */
  codigoPredial = '';
  /** Campos para búsqueda por Dirección */
  readonly tiposVia: { id: number, nombre: string }[] = [
    { id: 1, nombre: 'AVENIDA' },
    { id: 2, nombre: 'CALLE' },
    { id: 3, nombre: 'PASAJE' },
    { id: 4, nombre: 'ALAMEDA' },
    { id: 5, nombre: 'JIRON' },
    { id: 6, nombre: 'VIA EXPRESA' },
    { id: 7, nombre: 'AUTOPISTA' },
    { id: 8, nombre: 'OTROS' },
    { id: 9, nombre: 'PARQUE' },
    { id: 10, nombre: 'MALECON' },
    { id: 11, nombre: 'PLAZA' }
  ];
  tipoVia: number = 0; // Usamos el ID numérico
  nombreVia = '';
  numeroMunicipal = ''; // Mantenido por si se usa en el futuro
  numeroCuadra = '';
  /** Campos para búsqueda por Habilitación Urbana */
  // --- Lógica para autocompletado de vías ---
  private nombreViaSubject = new Subject<string>();
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
  private readonly mockCitizenProperties: SearchResult[] = [
    {
      codigoCatastral: "05-012-003",
      direccion: "Av. La Marina 2450, San Miguel",
      propietario: "Carlos Alberto Fernández Silva",
      area: "120.50 m²",
      zonificacion: "RDM",
      fotoFrontis: "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=400&q=80",
      numeroPisos: 3,
      materialPredominante: "Ladrillo",
      estadoConservacion: "Bueno",
    },
    {
      codigoCatastral: "05-018-007",
      direccion: "Jr. Federico Gallese 890, San Miguel",
      propietario: "Carlos Alberto Fernández Silva",
      area: "95.00 m²",
      zonificacion: "RDA",
      fotoFrontis: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=400&q=80",
      numeroPisos: 5,
      materialPredominante: "Ladrillo",
      estadoConservacion: "Muy Bueno",
    }
  ];

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
    let formatted = "";
    if (numbers.length > 0) formatted = numbers.slice(0, 4);
    if (numbers.length > 4) formatted += "-" + numbers.slice(4, 7);
    if (numbers.length > 7) formatted += "-" + numbers.slice(7, 10);
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
    this.mapService.clearSearchMarker(); // Limpia el marcador del mapa
    if (this.activeTab === 'cuc') {
      this.cuc = '';
    } else if (this.activeTab === 'predial') {
      this.codigoPredial = '';
    } else if (this.activeTab === 'direccion') {
      this.tipoVia = 0;
      this.nombreVia = '';
      this.numeroMunicipal = '';
      this.numeroCuadra = '';
      this.viaSuggestions = [];
      this.showViaSuggestions = false;
    } else if (this.activeTab === 'habilitacion') {
      this.nombreHabilitacion = '';
      this.manzanaUrbana = '';
      this.loteUrbano = '';
    } else if (this.activeTab === 'titular') {
      this.codigoTitular = '';
    } else if (this.activeTab === 'denominacion') {
      this.denominacionPredio = '';
    } else if (this.activeTab === 'parque') {
      this.nombreParque = '';
    } else if (this.activeTab === 'catastral') {
      this.codigoCatastral = '';
    } else {
      this.dni = '';
      this.nombreCiudadano = '';
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
        return !this.nombreVia.trim() || this.tipoVia === 0;
      case 'habilitacion':
        return this.nombreHabilitacion.trim().length === 0;
      case 'titular':
        return this.codigoTitular.trim().length === 0;
      case 'denominacion':
        return this.denominacionPredio.trim().length === 0;
      case 'parque':
        return this.nombreParque.trim().length === 0;
      case 'catastral':
        return this.codigoCatastral.length < 12; // 10 dígitos + 2 guiones
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
    this.nombreVia = suggestion;
    this.showViaSuggestions = false;
    this.viaSuggestions = [];

    // Ahora, buscamos el tipo de vía para la nomenclatura seleccionada
    this.mapService.searchViasByDireccion(0, this.nombreVia, '').pipe(take(1)).subscribe(features => {
      if (features && features.length > 0) {
        // Si hay múltiples tipos de vía para el mismo nombre, tomamos el primero.
        // Una mejora sería permitir al usuario elegir si hay ambigüedad.
        const firstFeature = features[0];
        const tipoViaId = firstFeature.properties['tipo_via'];
        if (tipoViaId) {
          this.tipoVia = tipoViaId;
        }
      }
    });
  }

  onNombreViaBlur() {
    // Ocultamos las sugerencias con un pequeño retardo para permitir el clic
    setTimeout(() => this.showViaSuggestions = false, 200);
  }

  handleSearch() {
    if (this.activeTab === 'cuc') {
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
            this.mapService.fitToGeometry(feature.geometry);
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
      return;
    }
    if (this.activeTab === 'direccion') {      
      this.loading.set(true);
      this.searchError.set(null);
      this.mapService.searchViasByDireccion(this.tipoVia, this.nombreVia, this.numeroCuadra)
        .pipe(take(1))
        .subscribe({
          next: (features) => {
            this.loading.set(false);
            if (features && features.length > 0) {
              // Por ahora, solo tomamos la primera vía encontrada
              const feature = features[0];
              const props = feature.properties as any;
              const tipoViaNombre = this.tiposVia.find(t => t.id === props['tipo_via'])?.nombre || 'Vía';
              const direccion = `${tipoViaNombre} ${props['nomenclatura']}, Cuadra ${props['num_cuadr']}`;

              this.mapService.fitToGeometry(feature.geometry, true);
              this.mapService.drawSearchMarker(feature.geometry, direccion);
              // No se emite un SearchResult porque una vía no es un predio, solo se ubica en el mapa.
              // Si se quisiera mostrar info, se podría emitir un resultado parcial.
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
    } else if (this.activeTab === 'catastral') {
      this.loading.set(true);
      this.searchError.set(null);

      this.mapService.searchLoteByCodigo(this.codigoCatastral).pipe(take(1)).subscribe({
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
            this.mapService.fitToGeometry(feature.geometry);
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
    } else if (this.activeTab === 'ciudadano') {
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
      this.mapService.fitToGeometry(property.geometry);
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
