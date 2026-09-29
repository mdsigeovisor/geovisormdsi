import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { Consultas } from './consultas';
import { MapService } from '@app/services/map.service';
import { GeoJSONGeometry } from '@app/interfaces/geoLayers';

/** Polígonos de prueba (EPSG:32718) que simulan los lotes que componen un parque. */
const POLIGONO_NORTE: GeoJSONGeometry = {
  type: 'Polygon',
  coordinates: [[[276000, 8661000], [276050, 8661000], [276050, 8661050], [276000, 8661050], [276000, 8661000]]]
};
const POLIGONO_SUR: GeoJSONGeometry = {
  type: 'Polygon',
  coordinates: [[[276000, 8660000], [276050, 8660000], [276050, 8660050], [276000, 8660050], [276000, 8660000]]]
};

describe('Consultas', () => {
  let component: Consultas;
  let fixture: ComponentFixture<Consultas>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Consultas],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(Consultas);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('búsqueda por Nombre del Parque', () => {
    let httpMock: HttpTestingController;
    /** Filtro CQL con el que se consultan las áreas recreacionales (parques). */
    const filtro = (patron: string) => `denominaci ILIKE '${patron}'`;
    const peticion = (patron: string) =>
      httpMock.expectOne(req => req.params.get('cql_filter') === filtro(patron));

    beforeEach(() => {
      httpMock = TestBed.inject(HttpTestingController);
      component.activeTab = 'parque';
    });

    it('encuadra TODOS los polígonos del parque cuando la denominación coincide exactamente', () => {
      const fitSpy = vi.spyOn(TestBed.inject(MapService), 'fitToParque').mockImplementation(() => undefined);
      const closeSpy = vi.spyOn(component.Close, 'emit');
      component.nombreParque = 'Parque El Olivar';

      component.handleSearch();

      // La consulta exacta usa ILIKE sin comodines (ignora mayúsculas/minúsculas),
      // de modo que no se traen otros parques con nombres parecidos.
      const exacta = peticion('PARQUE EL OLIVAR');
      expect(exacta.request.params.get('typeName')).toContain('vw_tg_area_rec_nombres');
      exacta.flush({
        type: 'FeatureCollection',
        features: [
          { type: 'Feature', properties: { denominaci: 'PARQUE EL OLIVAR' }, geometry: POLIGONO_NORTE },
          { type: 'Feature', properties: { denominaci: 'PARQUE EL OLIVAR' }, geometry: POLIGONO_SUR }
        ]
      });

      // El encuadre recibe la extensión unida de todos los polígonos del parque
      expect(fitSpy).toHaveBeenCalledTimes(1);
      expect(fitSpy.mock.calls[0][0]).toEqual([POLIGONO_NORTE, POLIGONO_SUR]);
      // El panel se cierra para dejar ver el parque completo en el mapa
      expect(closeSpy).toHaveBeenCalled();
      expect(component.searchError()).toBeNull();
    });

    it('recurre a la búsqueda parcial cuando no hay coincidencia exacta', () => {
      const fitSpy = vi.spyOn(TestBed.inject(MapService), 'fitToParque').mockImplementation(() => undefined);
      component.nombreParque = 'EL OLIVAR';

      component.handleSearch();

      // Sin coincidencias exactas se repite la consulta con comodines
      peticion('EL OLIVAR').flush({ type: 'FeatureCollection', features: [] });
      peticion('%EL OLIVAR%').flush({
        type: 'FeatureCollection',
        features: [{ type: 'Feature', properties: { denominaci: 'PARQUE EL OLIVAR' }, geometry: POLIGONO_NORTE }]
      });

      expect(fitSpy).toHaveBeenCalledWith([POLIGONO_NORTE]);
    });

    it('informa al usuario cuando no se encuentra ningún parque', () => {
      const fitSpy = vi.spyOn(TestBed.inject(MapService), 'fitToParque').mockImplementation(() => undefined);
      component.nombreParque = 'PARQUE INEXISTENTE';

      component.handleSearch();

      peticion('PARQUE INEXISTENTE').flush({ type: 'FeatureCollection', features: [] });
      peticion('%PARQUE INEXISTENTE%').flush({ type: 'FeatureCollection', features: [] });

      expect(fitSpy).not.toHaveBeenCalled();
      expect(component.searchError()).toContain('No se encontraron parques');
    });
  });
});
