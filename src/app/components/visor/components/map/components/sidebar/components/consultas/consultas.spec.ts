import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { Consultas } from './consultas';
import { MapService } from '@app/services/map.service';
import { GeoJSONGeometry } from '@app/interfaces/geoLayers';

/**
 * Centroide de prueba (EPSG:32718) tal y como lo devuelve la capa del buscador
 * de parques (`vw_tg_area_rec_nombres`, geometría `Point`).
 */
const CENTROIDE: GeoJSONGeometry = { type: 'Point', coordinates: [279316.4016, 8662132.9926] };
/** Polígonos (EPSG:32718) del área recreativa real que contiene ese centroide. */
const AREA_POLIGONO_A: GeoJSONGeometry = {
  type: 'Polygon',
  coordinates: [[[279286, 8662111], [279346, 8662111], [279346, 8662154], [279286, 8662154], [279286, 8662111]]]
};
const AREA_POLIGONO_B: GeoJSONGeometry = {
  type: 'Polygon',
  coordinates: [[[279300, 8662100], [279330, 8662100], [279330, 8662120], [279300, 8662120], [279300, 8662100]]]
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
    /** Petición espacial que localiza el área poligonal que contiene el centroide. */
    const peticionAreaEnPunto = () => httpMock.expectOne(
      req => (req.params.get('cql_filter') ?? '').startsWith('INTERSECTS(geom,SRID=32718;POINT('));
    /** Petición de los polígonos del área recreativa localizada. */
    const peticionAreaPoligonos = (denominacion: string) =>
      httpMock.expectOne(req => req.params.get('cql_filter') === `denominaci = '${denominacion}'`);
    /** Respuesta del buscador con el centroide del área (capa `..._nombres`). */
    const centroide = (denominacion: string) => ({
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: { denominaci: denominacion }, geometry: CENTROIDE }]
    });
    const sinResultados = { type: 'FeatureCollection', features: [] };

    beforeEach(() => {
      httpMock = TestBed.inject(HttpTestingController);
      component.activeTab = 'parque';
    });

    it('resalta el ÁREA real del parque cuando el buscador solo devuelve su centroide', () => {
      const fitSpy = vi.spyOn(TestBed.inject(MapService), 'fitToParque').mockImplementation(() => undefined);
      const markerSpy = vi.spyOn(TestBed.inject(MapService), 'drawSearchMarkerForParque').mockImplementation(() => undefined);
      const closeSpy = vi.spyOn(component.Close, 'emit');
      component.nombreParque = 'Bosque El Olivar';

      component.handleSearch();

      // 1) La consulta exacta usa ILIKE sin comodines (ignora mayúsculas/minúsculas),
      //    de modo que no se traen otros parques con nombres parecidos.
      const exacta = peticion('BOSQUE EL OLIVAR');
      expect(exacta.request.params.get('typeName')).toContain('vw_tg_area_rec_nombres');
      exacta.flush(centroide('Bosque El Olivar'));

      // 2) El centroide devuelto se cruza con la capa poligonal para localizar el
      //    área recreativa que lo contiene (los nombres de ambas capas no coinciden).
      const enPunto = peticionAreaEnPunto();
      expect(enPunto.request.params.get('typeName')).toContain('vw_tg_area_rec');
      expect(enPunto.request.params.get('cql_filter')).toBe(
        `INTERSECTS(geom,SRID=32718;POINT(${CENTROIDE.coordinates![0]} ${CENTROIDE.coordinates![1]}))`
      );
      enPunto.flush({
        type: 'FeatureCollection',
        features: [{ type: 'Feature', properties: { denominaci: 'EL OLIVAR' } }]
      });

      // 3) Se traen TODOS los polígonos del área para resaltar su superficie.
      const poligonos = peticionAreaPoligonos('EL OLIVAR');
      expect(poligonos.request.params.get('propertyName')).toBe('geom');
      poligonos.flush({
        type: 'FeatureCollection',
        features: [
          { type: 'Feature', properties: {}, geometry: AREA_POLIGONO_A },
          { type: 'Feature', properties: {}, geometry: AREA_POLIGONO_B }
        ]
      });

      // El encuadre recibe la extensión unida de todos los polígonos del área
      const area = [AREA_POLIGONO_A, AREA_POLIGONO_B];
      expect(fitSpy).toHaveBeenCalledTimes(1);
      expect(fitSpy.mock.calls[0][0]).toEqual(area);
      // El pin se coloca en el centro del área del parque, como en la búsqueda de lotes
      expect(markerSpy).toHaveBeenCalledWith(area);
      // El panel se cierra para dejar ver el parque completo en el mapa
      expect(closeSpy).toHaveBeenCalled();
      expect(component.searchError()).toBeNull();
      expect(component.loading()).toBe(false);
    });

    it('ubica el parque con su centroide cuando no existe área poligonal', () => {
      const fitSpy = vi.spyOn(TestBed.inject(MapService), 'fitToParque').mockImplementation(() => undefined);
      const markerSpy = vi.spyOn(TestBed.inject(MapService), 'drawSearchMarkerForParque').mockImplementation(() => undefined);
      const closeSpy = vi.spyOn(component.Close, 'emit');
      component.nombreParque = 'Parque Grecia';

      component.handleSearch();

      peticion('PARQUE GRECIA').flush(centroide('Parque Grecia'));
      peticionAreaEnPunto().flush(sinResultados);

      // Sin polígonos se resalta el centroide: el pin sigue ubicando el parque.
      expect(fitSpy).toHaveBeenCalledWith([CENTROIDE]);
      expect(markerSpy).toHaveBeenCalledWith([CENTROIDE]);
      expect(closeSpy).toHaveBeenCalled();
    });

    it('mantiene la ubicación con el centroide si falla el servicio de polígonos', () => {
      const fitSpy = vi.spyOn(TestBed.inject(MapService), 'fitToParque').mockImplementation(() => undefined);
      component.nombreParque = 'Parque Antequera';

      component.handleSearch();

      peticion('PARQUE ANTEQUERA').flush(centroide('Parque Antequera'));
      peticionAreaEnPunto().flush('Error interno', { status: 500, statusText: 'Server Error' });

      expect(fitSpy).toHaveBeenCalledWith([CENTROIDE]);
    });

    it('recurre a la búsqueda parcial cuando no hay coincidencia exacta', () => {
      const fitSpy = vi.spyOn(TestBed.inject(MapService), 'fitToParque').mockImplementation(() => undefined);
      component.nombreParque = 'El Olivar';

      component.handleSearch();

      // Sin coincidencias exactas se repite la consulta con comodines
      peticion('EL OLIVAR').flush(sinResultados);
      peticion('%EL OLIVAR%').flush(centroide('Bosque El Olivar'));
      peticionAreaEnPunto().flush(sinResultados);

      expect(fitSpy).toHaveBeenCalledWith([CENTROIDE]);
    });

    it('busca por palabras significativas cuando el nombre escrito lleva el término genérico', () => {
      const fitSpy = vi.spyOn(TestBed.inject(MapService), 'fitToParque').mockImplementation(() => undefined);
      // Es el texto de ejemplo del campo: "Parque El Olivar" no coincide con la
      // denominación real "Bosque El Olivar" ni exacta ni parcialmente.
      component.nombreParque = 'Parque El Olivar';

      component.handleSearch();

      peticion('PARQUE EL OLIVAR').flush(sinResultados);
      peticion('%PARQUE EL OLIVAR%').flush(sinResultados);
      // Se descarta el término genérico y se busca solo por "OLIVAR".
      peticion('%OLIVAR%').flush(centroide('Bosque El Olivar'));
      peticionAreaEnPunto().flush(sinResultados);

      expect(fitSpy).toHaveBeenCalledWith([CENTROIDE]);
      expect(component.searchError()).toBeNull();
    });

    it('no repite la búsqueda por palabras significativas si ya encontró el parque', () => {
      const fitSpy = vi.spyOn(TestBed.inject(MapService), 'fitToParque').mockImplementation(() => undefined);
      component.nombreParque = 'Parque Antequera';

      component.handleSearch();

      // Coincidencia exacta: no debe dispararse la consulta por palabras
      // significativas (dejaría una petición pendiente sin resolver).
      peticion('PARQUE ANTEQUERA').flush(centroide('Parque Antequera'));
      peticionAreaEnPunto().flush(sinResultados);

      expect(fitSpy).toHaveBeenCalledWith([CENTROIDE]);
    });

    it('informa al usuario cuando no se encuentra ningún parque', () => {
      const fitSpy = vi.spyOn(TestBed.inject(MapService), 'fitToParque').mockImplementation(() => undefined);
      component.nombreParque = 'Parque Inexistente';

      component.handleSearch();

      peticion('PARQUE INEXISTENTE').flush(sinResultados);
      peticion('%PARQUE INEXISTENTE%').flush(sinResultados);
      peticion('%INEXISTENTE%').flush(sinResultados);

      expect(fitSpy).not.toHaveBeenCalled();
      expect(component.searchError()).toContain('No se encontraron parques');
      expect(component.loading()).toBe(false);
    });
  });
});
