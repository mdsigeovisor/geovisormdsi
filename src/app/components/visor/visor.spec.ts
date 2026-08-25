// Scaffolding CLI obsoleto: la clase ahora se exporta POR DEFECTO desde
// './visor'. TODO: regenerar la suite completa con mocks de sus servicios.
import Visor from './visor';

describe('Visor', () => {
  it('exporta el componente principal del visor', () => {
    expect(Visor).toBeDefined();
  });
});
