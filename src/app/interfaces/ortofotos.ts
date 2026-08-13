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
  2025,
  2024, 
  2018, 
  2016, 
  2015, 
  2012, 
  2008, 
  2006, 
  2002, 
  1998, 
  1984,
  1974,
  1958, 
  1949,  
  1943, 
];