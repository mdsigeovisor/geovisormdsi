import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
/**
 * Este módulo centraliza las herramientas de OpenLayers.
 * Puedes usarlo como un punto central de exportación para simplificar tus componentes.
 */
@NgModule({
  imports: [CommonModule],
  exports: []
})
export class OpenLayersModule { }
export { default as OlMap } from 'ol/Map';
export { default as View } from 'ol/View';
export { default as TileLayer } from 'ol/layer/Tile';
export { default as ImageLayer } from 'ol/layer/Image';
export { default as VectorLayer } from 'ol/layer/Vector';
export { default as Overlay } from 'ol/Overlay';
export type { Positioning as OverlayPositioning } from 'ol/Overlay';
export { default as XYZ } from 'ol/source/XYZ';
export { default as VectorSource } from 'ol/source/Vector';
export { defaults as defaultControls, OverviewMap, ScaleLine, FullScreen, ZoomSlider } from 'ol/control';
export { fromLonLat, transform, transformExtent } from 'ol/proj';
export { Style, Fill, Stroke, Circle, Icon, Text } from 'ol/style';
export { default as Feature } from 'ol/Feature';
export { Point, LineString, Polygon } from 'ol/geom';
export { default as TileWMS } from 'ol/source/TileWMS';
export { default as GeoJSON } from 'ol/format/GeoJSON';
export { default as ImageWMS } from 'ol/source/ImageWMS';
export { default as WKT } from 'ol/format/WKT';
export { getCenter } from 'ol/extent';
export { getDistance } from 'ol/sphere';
export { createXYZ } from 'ol/tilegrid';

