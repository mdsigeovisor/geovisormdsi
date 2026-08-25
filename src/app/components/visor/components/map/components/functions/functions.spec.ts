// Scaffolding CLI obsoleto: la ruta correcta es './functions' (la clase
// conserva el nombre 'Funciones'). TODO: regenerar la suite con mocks de
// MapService y DrawMeasureService.
import { Funciones } from './functions';

describe('Funciones', () => {
  it('exporta el componente de funciones de mapa', () => {
    expect(Funciones).toBeDefined();
  });
});
