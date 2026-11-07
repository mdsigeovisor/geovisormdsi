import proj4 from 'proj4';
import { get as getProjection } from 'ol/proj';
import { register } from 'ol/proj/proj4';

proj4.defs(
  'EPSG:32718',
  '+proj=utm +zone=18 +south +datum=WGS84 +units=m +no_defs +type=crs'
);

register(proj4);

const utm18s = getProjection('EPSG:32718');
if (!utm18s) {
  throw new Error('No se pudo registrar la proyección EPSG:32718.');
}

utm18s.setExtent([166021.44, 0, 833978.56, 10000000]);
