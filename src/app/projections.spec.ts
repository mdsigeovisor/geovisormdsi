import './projections';
import { transform } from 'ol/proj';

describe('proyección EPSG:32718', () => {
  it('transforma coordenadas UTM 18S a geográficas y de vuelta', () => {
    const utm: [number, number] = [278950.35, 8667546.05];
    const geographic = transform(utm, 'EPSG:32718', 'EPSG:4326');
    const roundTrip = transform(geographic, 'EPSG:4326', 'EPSG:32718');

    expect(roundTrip[0]).toBeCloseTo(utm[0], 3);
    expect(roundTrip[1]).toBeCloseTo(utm[1], 3);
  });
});
