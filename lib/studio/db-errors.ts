/**
 * Clasificación de errores de Postgres/PostgREST compartida por las queries del
 * Studio.
 *
 * El porqué (ronda /GOLD 2026-07-14): el repo aplica las migraciones a prod a
 * mano, así que existe una ventana real entre "el código está deployado" y "la
 * migración está aplicada". Durante esa ventana una query pide una tabla o una
 * columna que todavía no existe. Las queries que hacían `throw error` tumbaban
 * la ruta ENTERA con un 500 (pasó con /studio/marketing y /studio/fidelizacion);
 * las que degradaban a vacío mostraban el módulo sin datos y nadie se moría.
 *
 * Regla: un objeto de DB que falta es un estado ESPERADO del deploy, no un bug →
 * degradar. Cualquier otro error sí se propaga (bug real, no lo escondemos).
 */

type DbError = { code?: string; message?: string } | null | undefined;

/**
 * ¿El error es "el objeto de DB no existe todavía"? Cubre los dos casos que
 * produce una migración sin aplicar:
 *  - `42P01` undefined_table    → falta la tabla o la VIEW entera.
 *  - `42703` undefined_column   → la tabla existe pero le falta una columna
 *                                 (una migración que hace ALTER TABLE ADD COLUMN).
 *
 * El match por texto cubre a PostgREST, que a veces responde PGRST205 con el
 * detalle en el mensaje en vez del SQLSTATE crudo.
 */
export function isMissingDbObject(error: DbError): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "42703") return true;
  return /relation .* does not exist|column .* does not exist|could not find the (table|column)/i.test(
    error.message ?? "",
  );
}
