import {
  LAMINAS_SECCION_VIAL_METRO_EXCEPCIONES,
  LAMINAS_SECCION_VIAL_METRO_PENDIENTES,
  laminaSeccionVialMetroPublicada,
  nombreLaminaSeccionVialMetro,
} from './laminasSeccionVialMetro.config';

/**
 * El nombre de la lámina se resuelve desde el campo `refname`, que trae la vía
 * sin guion ("E16"), mientras que el servidor publica el PDF con guion
 * ("E-16.pdf"). Estas pruebas fijan la regla y sus excepciones verificadas
 * contra el servidor de láminas (ORD. N° 2343-MML).
 */
describe('nombreLaminaSeccionVialMetro', () => {
  it('intercala el guion entre las letras y el número', () => {
    expect(nombreLaminaSeccionVialMetro('A59')).toBe('A-59.pdf');
    expect(nombreLaminaSeccionVialMetro('C104')).toBe('C-104.pdf');
    expect(nombreLaminaSeccionVialMetro('E16')).toBe('E-16.pdf');
  });

  it('respeta las láminas publicadas con otro nombre', () => {
    expect(nombreLaminaSeccionVialMetro('E33')).toBe('E33.pdf');
  });

  it('normaliza minúsculas y espacios del campo `refname`', () => {
    expect(nombreLaminaSeccionVialMetro(' e16 ')).toBe('E-16.pdf');
  });

  it('devuelve cadena vacía si la capa no informa el campo llave', () => {
    expect(nombreLaminaSeccionVialMetro('')).toBe('');
    expect(nombreLaminaSeccionVialMetro('   ')).toBe('');
  });

  it('la excepción declarada no sigue la regla general', () => {
    expect(LAMINAS_SECCION_VIAL_METRO_EXCEPCIONES['E33']).toBe('E33');
  });
});

describe('laminaSeccionVialMetroPublicada', () => {
  it('marca como publicadas las vías con lámina en el servidor', () => {
    expect(laminaSeccionVialMetroPublicada('E16')).toBe(true);
    expect(laminaSeccionVialMetroPublicada('e33')).toBe(true);
  });

  it('marca como pendientes las láminas aún no publicadas', () => {
    for (const pendiente of LAMINAS_SECCION_VIAL_METRO_PENDIENTES) {
      expect(laminaSeccionVialMetroPublicada(pendiente)).toBe(false);
    }
    expect(laminaSeccionVialMetroPublicada('A60')).toBe(false);
    expect(laminaSeccionVialMetroPublicada('C36')).toBe(false);
  });

  it('sin campo llave no hay lámina que cargar', () => {
    expect(laminaSeccionVialMetroPublicada('')).toBe(false);
  });
});

