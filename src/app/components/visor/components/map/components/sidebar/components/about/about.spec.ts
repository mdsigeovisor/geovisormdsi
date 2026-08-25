// Scaffolding CLI obsoleto: la ruta relativa apuntaba fuera del proyecto; la
// correcta es './about'. TODO: regenerar la suite con mock de MapService.
import { About } from './about';

describe('About', () => {
  it('exporta el panel "Acerca de"', () => {
    expect(About).toBeDefined();
  });
});
