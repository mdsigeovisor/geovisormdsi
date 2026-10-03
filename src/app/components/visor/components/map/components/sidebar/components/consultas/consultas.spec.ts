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

  describe('búsqueda por Dirección', () => {
    let httpMock: HttpTestingController;
    /** Petición al API listar-vias (búsqueda por nombre de vía). */
    const peticionApi = (nombre: string) => httpMock.expectOne(
      req => req.url.endsWith('/listar-vias') && req.params.get('pvcTXTNOMBREVIA') === nombre);
    /** Petición al WFS que trae la geometría de la vía por su código. */
    const peticionGeometria = () => httpMock.expectOne(
      req => (req.params.get('typeName') ?? '').includes('vw_tg_via'));
    const viaApi = {
      codvia: '1170',
      txtnomvia: 'Juan De Arona',
      txttipoviaabrev: 'Av.',
      codviaequ: 'L271170',
      codtipovia: '010011',
      txttipovia: 'AVENIDA'
    };
    const segmento = (id: string) => ({
      type: 'Feature',
      id,
      properties: { codi_via: 'L271170', codi_via2: '1170', etiquetado_ext: 'Av. Juan De Arona' },
      geometry: {
        type: 'MultiLineString',
        coordinates: [[[279000, 8661000], [279100, 8661050]]]
      }
    });

    beforeEach(() => {
      httpMock = TestBed.inject(HttpTestingController);
      component.activeTab = 'direccion';
      component.nombreVia = 'Juan De Arona';
    });

    it('abre el modal con las coincidencias y no mueve el mapa hasta elegir una vía', () => {
      const fitSpy = vi.spyOn(TestBed.inject(MapService), 'fitToGeometry').mockImplementation(() => undefined);
      const closeSpy = vi.spyOn(component.Close, 'emit');

      component.handleSearch();

      // 1) El API es la fuente de verdad de los nombres de vías.
      peticionApi('Juan De Arona').flush({ status: 200, data: [viaApi] });

      // 2) Con coincidencias se abre el modal y el mapa aún no se mueve.
      expect(component.modalViasAbierto()).toBe(true);
      expect(component.viasEncontradas.length).toBe(1);
      expect(fitSpy).not.toHaveBeenCalled();
      expect(closeSpy).not.toHaveBeenCalled();
    });

    it('resalta la vía en la gráfica al elegir una coincidencia del modal', () => {
      const fitSpy = vi.spyOn(TestBed.inject(MapService), 'fitToGeometry').mockImplementation(() => undefined);
      const closeSpy = vi.spyOn(component.Close, 'emit');

      component.handleSearch();
      peticionApi('Juan De Arona').flush({ status: 200, data: [viaApi] });
      expect(component.modalViasAbierto()).toBe(true);

      // Se elige la coincidencia: se cierra el modal y se busca por su código.
      component.irAViaSeleccionada(component.sugerenciaDe(component.viasEncontradas[0]));

      expect(component.modalViasAbierto()).toBe(false);
      expect(component.codVia).toBe('L271170');
      const geometria = peticionGeometria();
      expect(geometria.request.params.get('cql_filter')).toContain("codi_via = 'L271170'");
      geometria.flush({ type: 'FeatureCollection', features: [segmento('a')] });

      expect(fitSpy).toHaveBeenCalledTimes(1);
      expect(fitSpy.mock.calls[0][0].type).toBe('MultiLineString');
      expect(closeSpy).toHaveBeenCalled();
      expect(component.searchError()).toBeNull();
    });

    it('avisa cuando la vía existe en el API pero no está dibujada en la cartografía', () => {
      const fitSpy = vi.spyOn(TestBed.inject(MapService), 'fitToGeometry').mockImplementation(() => undefined);
      const closeSpy = vi.spyOn(component.Close, 'emit');

      component.handleSearch();
      peticionApi('Juan De Arona').flush({ status: 200, data: [viaApi] });
      component.irAViaSeleccionada(component.sugerenciaDe(component.viasEncontradas[0]));
      peticionGeometria().flush({ type: 'FeatureCollection', features: [] });

      expect(fitSpy).not.toHaveBeenCalled();
      expect(closeSpy).not.toHaveBeenCalled();
      expect(component.searchError()).toContain('no está dibujada en el mapa');
      expect(component.loading()).toBe(false);
    });

    it('informa cuando el API no devuelve ninguna vía con ese nombre', () => {
      const fitSpy = vi.spyOn(TestBed.inject(MapService), 'fitToGeometry').mockImplementation(() => undefined);

      component.handleSearch();
      peticionApi('Juan De Arona').flush({ status: 200, data: [] });

      expect(component.modalViasAbierto()).toBe(false);
      expect(fitSpy).not.toHaveBeenCalled();
      expect(component.searchError()).toContain('No se encontraron vías');
      expect(component.loading()).toBe(false);
    });

    it('renderiza el modal de vías en el DOM al abrirlo', () => {
      fixture.detectChanges();
      const modal = fixture.nativeElement.querySelector('#vias-modal');
      expect(modal).toBeNull();

      component.handleSearch();
      peticionApi('Juan De Arona').flush({ status: 200, data: [viaApi] });
      fixture.detectChanges();

      // El modal existe en el DOM y lista la vía encontrada.
      const renderizado = fixture.nativeElement.querySelector('#vias-modal');
      expect(renderizado).toBeTruthy();
      expect(renderizado.textContent).toContain('Juan De Arona');
      // El código de vía no se muestra al usuario.
      expect(renderizado.textContent).not.toContain('L271170');

      component.cerrarModalVias();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('#vias-modal')).toBeNull();
    });

    it('abre el modal al pulsar Buscar con una sola letra escrita', () => {
      fixture.detectChanges();
      component.activeTab = 'direccion';
      // Una única letra escrita: el botón NO debe estar deshabilitado.
      component.nombreVia = 'A';
      fixture.detectChanges();
      expect(component.isSearchDisabled()).toBe(false);
      expect(component.modalViasAbierto()).toBe(false);

      // Se pulsa el botón Buscar.
      component.handleSearch();
      peticionApi('A').flush({ status: 200, data: [viaApi] });
      fixture.detectChanges();

      // El modal debe mostrarse con la coincidencia.
      expect(component.modalViasAbierto()).toBe(true);
      expect(component.viasEncontradas.length).toBe(1);
      const modal = fixture.nativeElement.querySelector('#vias-modal');
      expect(modal).toBeTruthy();
      expect(modal.textContent).toContain('Juan De Arona');
    });

    it('lista en el modal todas las coincidencias con una sola letra', () => {
      component.activeTab = 'direccion';
      component.nombreVia = 'J';

      component.handleSearch();
      peticionApi('J').flush({
        status: 200,
        data: [
          viaApi,
          { ...viaApi, codvia: '1900', codviaequ: 'L271900', txtnomvia: 'José Gálvez', txttipoviaabrev: 'Jr.' }
        ]
      });
      fixture.detectChanges();

      // Ambas vías se listan en el modal con su etiqueta oficial.
      expect(component.viasEncontradas.length).toBe(2);
      expect(component.sugerenciaDe(component.viasEncontradas[0]).etiqueta).toBe('Av. Juan De Arona');
      expect(component.sugerenciaDe(component.viasEncontradas[0]).codVia).toBe('L271170');
      const modal = fixture.nativeElement.querySelector('#vias-modal');
      expect(modal.textContent).toContain('José Gálvez');
      // Los códigos de vía no se muestran en el modal.
      expect(modal.textContent).not.toContain('L271170');
      expect(modal.textContent).not.toContain('L271900');
    });

    it('Volver a buscar reinicia la búsqueda igual que Limpiar', () => {
      component.activeTab = 'direccion';
      component.nombreVia = 'Av. Juan De Arona';
      // Estado de una búsqueda ya completada: vía elegida con sus numeraciones
      // y un número seleccionado (esto es lo que rompía el flujo).
      component.codVia = 'L271170';
      component.viaNumeros = [{ numero: '0110', codlote: '3105075021', codlotenumero: '31050750210110' }];
      component.numeroSeleccionado = '0110';
      component.viasEncontradas = [viaApi];
      component.modalViasAbierto.set(true);
      fixture.detectChanges();

      // Se pulsa "Volver a buscar" dentro del modal.
      component.volverABuscarVias();
      fixture.detectChanges();

      // Deja la búsqueda en cero, igual que el botón Limpiar: sin texto, sin
      // código, sin numeraciones y con el modal cerrado.
      expect(component.nombreVia).toBe('');
      expect(component.codVia).toBe('');
      expect(component.viaNumeros).toEqual([]);
      expect(component.numeroSeleccionado).toBe('');
      expect(component.viasEncontradas).toEqual([]);
      expect(component.modalViasAbierto()).toBe(false);
      // El selector "Número" desaparece y el botón Buscar se deshabilita.
      expect(fixture.nativeElement.querySelector('#numeroViaSelect')).toBeNull();
      expect(component.isSearchDisabled()).toBe(true);
      // No se consulta el API: se reinicia para escribir una vía nueva.
      httpMock.expectNone(req => req.url.endsWith('/listar-vias'));
    });

    it('no renderiza lista desplegable bajo el campo de vía', () => {
      component.activeTab = 'direccion';
      fixture.detectChanges();
      // El combobox se retiró: bajo el campo solo hay texto, sin lista de sugerencias.
      const campo = fixture.nativeElement.querySelector('#nombreViaInput');
      expect(campo).toBeTruthy();
      expect(campo.parentElement.querySelector('button')).toBeNull();
    });

    it('Limpiar devuelve la búsqueda de dirección a cero y borra el selector de Número', () => {
      // Simula una búsqueda completa: vía elegida, modal y numeraciones cargadas.
      component.activeTab = 'direccion';
      component.nombreVia = 'Av. Juan De Arona';
      component.codVia = 'L271170';
      component.viasEncontradas = [viaApi];
      component.modalViasAbierto.set(true);
      component.viaNumeros = [
        { numero: '101', codlote: 'LOT1', codlotenumero: 'LOT1-101' }
      ] as any;
      component.numeroSeleccionado = '101';
      component.viaNumerosError = null;
      fixture.detectChanges();
      // El selector "Número" está visible porque hay numeraciones.
      expect(fixture.nativeElement.querySelector('#numeroViaSelect')).toBeTruthy();

      component.handleClear();
      fixture.detectChanges();

      // Todo vuelve a cero: sin texto, sin código y sin numeraciones.
      expect(component.nombreVia).toBe('');
      expect(component.codVia).toBe('');
      expect(component.viaNumeros).toEqual([]);
      expect(component.numeroSeleccionado).toBe('');
      expect(component.viaNumerosError).toBeNull();
      expect(component.viasEncontradas).toEqual([]);
      expect(component.modalViasAbierto()).toBe(false);
      // El selector "Número" desaparece del DOM.
      expect(fixture.nativeElement.querySelector('#numeroViaSelect')).toBeNull();
      // Y el botón Buscar vuelve a quedar deshabilitado.
      expect(component.isSearchDisabled()).toBe(true);
    });
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
