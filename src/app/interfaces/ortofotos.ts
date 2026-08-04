/**
 * @file Contiene la configuración centralizada para las capas de ortofotos.
 * Este archivo es la única fuente de verdad para los años de vuelos disponibles en la aplicación.
 * Para agregar un nuevo año, simplemente añádelo a la lista `ORTOFOTO_YEARS`.
 */
/**
 * Interfaz que define la estructura de la configuración de una capa de ortofoto.
 */
export interface OrtofotoLayerConfig {
  year: number;
  zIndex: number;
}
/**
 * Lista de años de las ortofotos disponibles.
 * El `zIndex` se mantiene en 1 para todas, asegurando que se muestren sobre el mapa base.
 */
export const ORTOFOTO_YEARS: number[] = [
  1943, 
  1949,  
  1984, 
  1998, 
  2002, 
  2006, 
  2008, 
  2012, 
  2015, 
  2016, 
  2018, 
  2024, 
  2025,
];