import { Component, Input, signal, output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MapService } from '../../../../../../../../services/map.service';
import { SearchResult } from '../../../../../../../../interfaces/search';
import { take } from 'rxjs';


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
  readonly tiposVia = ["Avenida", "Calle", "Jirón", "Pasaje", "Alameda", "Malecón", "Prolongación", "Plaza", "Parque"];
  tipoVia = '';
  nombreVia = '';
  numeroMunicipal = '';
  block = '';
  departamento = '';
  /** Campos para búsqueda por Habilitación Urbana */
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
      this.tipoVia = '';
      this.nombreVia = '';
      this.numeroMunicipal = '';
      this.block = '';
      this.departamento = '';
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
        return !this.nombreVia || !this.tipoVia;
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
      const result: SearchResult = {
        codigoCatastral: "05-012-003",
        direccion: `${this.tipoVia} ${this.nombreVia} ${this.numeroMunicipal}${this.block ? `, Block ${this.block}` : ""}${this.departamento ? `, Dpto. ${this.departamento}` : ""}, Miraflores`,
        propietario: "Juan Carlos Mendoza López",
        area: "120.50 m²",
        zonificacion: "RDM (Residencial)",
        fotoFrontis: "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=400&q=80",
        numeroPisos: 5,
        materialPredominante: "Ladrillo",
        estadoConservacion: "Muy Bueno",
      };
      this.emitResult(result);
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
      this.selectedCitizen = this.searchType === 'dni'
        ? "Carlos Alberto Fernández Silva"
        : this.nombreCiudadano;

      // Simulamos una carga de datos
      this.citizenProperties = this.mockCitizenProperties;
      this.showCitizenResults = true;
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
