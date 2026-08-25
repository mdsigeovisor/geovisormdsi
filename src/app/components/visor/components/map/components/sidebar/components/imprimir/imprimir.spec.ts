import { ComponentFixture, TestBed } from '@angular/core/testing';

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
        calcularRepartoInferior(a: number, g: number): { fotoW: number; tablaW: number; infoW: number };
      }
    ).calcularRepartoInferior(190, 3); // A4 vertical: 190 mm útiles

    expect(reparto.fotoW).toBe(64); // antes era 32 mm
  });

  it('reparte el resto sin huecos y garantiza mínimos legibles (A4 vertical)', () => {
    const reparto = (
      component as unknown as {
        calcularRepartoInferior(a: number, g: number): { fotoW: number; tablaW: number; infoW: number };
      }
    ).calcularRepartoInferior(190, 3);

    expect(reparto.tablaW).toBeGreaterThanOrEqual(52); // mínimo tabla cualitativa
    expect(reparto.infoW).toBeGreaterThanOrEqual(44);  // mínimo ficha pública
    // La suma cubre TODO el espacio disponible: la foto absorbe lo sobrante
    expect(reparto.fotoW + 3 * 2 + reparto.tablaW + reparto.infoW).toBe(190);
  });

  it('limita la tabla cualitativa a su máximo en hojas grandes (A3 horizontal)', () => {
    const reparto = (
      component as unknown as {
        calcularRepartoInferior(a: number, g: number): { fotoW: number; tablaW: number; infoW: number };
      }
    ).calcularRepartoInferior(400, 3); // A3 horizontal: 400 mm útiles

    expect(reparto.fotoW).toBe(64);
    expect(reparto.tablaW).toBeLessThanOrEqual(84);
    expect(reparto.fotoW + 3 * 2 + reparto.tablaW + reparto.infoW).toBe(400);
  });
});
