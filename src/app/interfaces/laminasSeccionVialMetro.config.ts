/**
 * Láminas PDF de la capa "Sección de Vías Normativas Metropolitanas"
 * (`tg_seccion_vial_normativa_metropolitana`, Ordenanza N° 2343-MML).
 *
 * El campo llave de la capa es `refname` (p. ej. `A59`, `C104`, `E16`, `E33`) y
 * el servidor publica una lámina por vía en la carpeta
 * `DataGIS_WGS84/23_LAMINAS_SECCION_VIAL_MET_ORD_2343` (servidor TUSNE).
 *
 * Regla general VERIFICADA contra el servidor: `{letras}-{número}.pdf`
 * (`A59` → `A-59.pdf`, `C104` → `C-104.pdf`, `E16` → `E-16.pdf`).
 *
 * Ojo: el API NO basta con concatenar `.pdf` al `refname`, porque el guion que
 * separa la letra del número no viene en la capa. Las vías publicadas con otro
 * nombre y las que todavía no tienen lámina se declaran en las tablas de abajo;
 * al subir o renombrar láminas solo hay que actualizarlas.
 */

/** Vías cuya lámina se publicó con un nombre distinto al de la regla general. */
export const LAMINAS_SECCION_VIAL_METRO_EXCEPCIONES: Readonly<Record<string, string>> = {
  // No existe "E-33.pdf": la lámina de esta vía es "E33.pdf".
  E33: 'E33',
};

/** Vías cuya lámina todavía no está publicada en el servidor. */
export const LAMINAS_SECCION_VIAL_METRO_PENDIENTES: ReadonlySet<string> = new Set<string>([
  'A60',
  'C36',
]);

/**
 * Nombre del archivo PDF que debería tener la lámina de una vía.
 *
 * @param refname Valor del campo `refname` de la capa (p. ej. `E16`).
 * @returns Nombre del archivo (p. ej. `E-16.pdf`); cadena vacía si no hay valor.
 */
export function nombreLaminaSeccionVialMetro(refname: string): string {
  // El campo llega en mayúsculas desde la capa, pero se normaliza por seguridad.
  const clave = refname.trim().toUpperCase();
  if (!clave) return '';
  const nombre = LAMINAS_SECCION_VIAL_METRO_EXCEPCIONES[clave]
    ?? clave.replace(/^([A-Z]+)(\d+)$/, '$1-$2');
  return `${nombre}.pdf`;
}

/**
 * Indica si la lámina de una vía ya está publicada en el servidor.
 *
 * @param refname Valor del campo `refname` de la capa (p. ej. `A60`).
 */
export function laminaSeccionVialMetroPublicada(refname: string): boolean {
  const clave = refname.trim().toUpperCase();
  return !!clave && !LAMINAS_SECCION_VIAL_METRO_PENDIENTES.has(clave);
}
