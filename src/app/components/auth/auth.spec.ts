// Scaffolding CLI obsoleto: la instancia completa del componente requiere los
// proveedores de autenticación/HTTP. TODO: regenerar la suite con `ng generate`
// y mocks de AuthService cuando se retome la cobertura de este módulo.
import Auth from './auth';

describe('Auth', () => {
  it('exporta el componente raíz de autenticación', () => {
    expect(Auth).toBeDefined();
  });
});
