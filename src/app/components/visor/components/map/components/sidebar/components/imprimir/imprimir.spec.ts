import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LineString } from '@app/modules/openlayers.module';
import { MapService } from '@app/services/map.service';
import { Imprimir } from './imprimir';

/**
 * Suite del panel de impresión (runner Vitest del proyecto).
 * Usa un MapService simulado: suficiente para probar la creación del
 * componente, los guardas de captura y el reparto de anchos del cuerpo
 * inferior del plano (fotografía al doble · tabla · ficha pública).
 */
describe('Imprimir', () => {
  let component: Imprimir;
  let fixture: ComponentFixture<Imprimir>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Imprimir],
      providers: [
        {
          provide: MapService,
          useValue: {
            map: () => null,
            loteSeleccionadoCodigo: () => null,
            pickLoteActivo: () => false,
            limpiarLoteSeleccionado: () => undefined,
            asegurarResaltadoLoteSeleccionado: () => undefined,
            activarCuadriculaUtm: () => undefined,
            desactivarCuadriculaUtm: () => undefined,
            getMapCanvas: () => null,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Imprimir);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('rechaza la captura cuando el mapa aún no tiene lienzo disponible', async () => {
    await expect(
      (component as unknown as { capturarMapaSimple(): Promise<string> }).capturarMapaSimple(),
    ).rejects.toThrow('El mapa aún no está listo para exportarse.');
  });

  it('el marco de fotografía ocupa el DOBLE del ancho original (64 mm)', () => {
    const reparto = (
      component as unknown as {
        calcularRepartoInferior(a: number, g: number): { fotoW: number; infoW: number };
      }
    ).calcularRepartoInferior(190, 3); // A4 vertical: 190 mm útiles

    expect(reparto.fotoW).toBe(64); // antes era 32 mm
  });

  it('la ficha pública absorbe TODO el espacio de la tabla cualitativa eliminada', () => {
    const sut = component as unknown as {
      calcularRepartoInferior(a: number, g: number): { fotoW: number; infoW: number };
    };

    const a4 = sut.calcularRepartoInferior(190, 3);
    expect(a4.fotoW + 3 + a4.infoW).toBe(190); // sin huecos ni marcos muertos
    expect(a4.infoW).toBeGreaterThan(100);     // la ficha gana el hueco de la tabla

    const a3 = sut.calcularRepartoInferior(400, 3);
    expect(a3.fotoW + 3 + a3.infoW).toBe(400);
  });

  it('las líneas de cuadrícula se crean con PARES de coordenadas (regresión RangeError)', () => {
    // Regresión del bug original: pasar un array PLANO [x,y,x,y…] a LineString
    // hacía que OpenLayers detectara stride=undefined, vaciara las
    // flatCoordinates y lanzara "RangeError: Invalid array length" dentro de
    // douglasPeucker al renderizar/simplificar la cuadrícula UTM.
    const correcto = new LineString([[1, 2], [3, 4], [5, 6]]);
    expect(correcto.getStride()).toBe(2);
    expect(correcto.getCoordinates().length).toBe(3);

    // El patrón antiguo (flat) produce stride ≠ 2: nunca debe usarse.
    const plano = new LineString([1, 2, 3, 4, 5, 6] as unknown as number[][]);
    expect(plano.getStride()).not.toBe(2);
  });

  it('mapea correctamente las seis escalas fijas disponibles', () => {
    const sut = component as unknown as {
      escala: { set(v: string): void };
      etiquetaEscala(): string;
    };
    for (const e of ['250', '500', '750', '1000', '1250', '2000']) {
      sut.escala.set(e);
      expect(sut.etiquetaEscala()).toBe(`1/${e}`);
    }
    sut.escala.set('auto');
    expect(sut.etiquetaEscala()).toBe('Automática');
  });

  it('muestra el spinner de proceso mientras genera y lo oculta al terminar', () => {
    const sut = component as unknown as { generando: { set(v: boolean): void } };

    sut.generando.set(true);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.msi-print-spinner-overlay')).toBeTruthy();
    expect(el.querySelector('.msi-print-spinner-overlay app-spinner')).toBeTruthy();

    sut.generando.set(false);
    fixture.detectChanges();
    expect(el.querySelector('.msi-print-spinner-overlay')).toBeFalsy();
  });
});
