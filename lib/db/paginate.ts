/**
 * Leer una tabla COMPLETA de Supabase, paginando de verdad.
 *
 * ## Por qué existe
 *
 * **PostgREST corta toda respuesta en `db-max-rows`** (1.000 en Supabase), y un
 * `.limit(5000)` **no lo sortea**: devuelve 1.000 filas, sin error y sin aviso.
 * El número del `.limit()` es una *intención*, no un contrato.
 *
 * Eso no molesta cuando se pinta una lista — se ven menos filas y se nota. El
 * daño está donde el resultado **se agrega en JS**: una suma, un conteo, un
 * promedio, un agrupado. Ahí no falta una fila: **sale un número equivocado con
 * cara de verdad**.
 *
 * Ya pasó. El 2026-08-11 el tablero del CRM mostraba «1.000 leads» teniendo
 * 3.145, y no era un KPI mal puesto: el embudo, el cementerio de antigüedad, la
 * cartera por asesor y la conversión salían **todos del 32% de los datos**.
 * Nadie lo vio durante meses porque nada falla — sólo miente.
 *
 * ## La regla de corte, y por qué es ésta y no la obvia
 *
 * Se corta **sólo cuando una página vuelve VACÍA**, y se avanza por la cantidad
 * **realmente recibida**, nunca por la pedida.
 *
 * La regla intuitiva —«vino menos de lo que pedí ⇒ terminé»— reintroduce el
 * mismo bug: si `db-max-rows` fuera 500 y pidiéramos 1.000, la primera página
 * volvería con 500 y cortaríamos ahí, truncando en silencio. Esta versión es
 * inmune al tope del servidor, sea cual sea. Cuesta un request extra (el
 * último, vacío) y es barato al lado de subcontar la plata.
 *
 * ## Cuando no alcanza
 *
 * Si se agotan las páginas antes de llegar a la vacía, devuelve
 * `complete: false` en vez de un número plausible. **Preferimos decir "no sé" a
 * repetir el mismo error con otro tope.** Quien llama tiene que mirar ese
 * campo y decirlo en pantalla; ignorarlo es volver al punto de partida.
 *
 * ## Orden estable, obligatorio
 *
 * La query DEBE traer un `.order()` por una columna estable (la PK sirve). Sin
 * orden determinístico, dos páginas consecutivas pueden repetir o saltear filas
 * y el total queda mal igual — de otra forma, pero mal.
 *
 * ## Uso
 *
 * ```ts
 * const { rows, complete } = await fetchAllPaged<InvoiceRow>((from, to) =>
 *   supabase
 *     .from("invoices")
 *     .select(INVOICE_COLUMNS)
 *     .gte("created_at", range.from)
 *     .order("id", { ascending: true })
 *     .range(from, to),
 * );
 * if (!complete) { /* decirlo, no redondear *\/ }
 * ```
 *
 * Recibe una función que arma la página en vez de `(tabla, columnas)`, porque
 * casi todos los sitios reales llevan filtros, joins o embebidos.
 */

/** Filas leídas + si se pudo leer TODO. `complete: false` NO es un detalle. */
export type PagedRows<T> = { rows: T[]; complete: boolean };

/**
 * Tamaño de página. Igual al `db-max-rows` de Supabase: pedir más no trae más.
 */
export const PAGE_SIZE = 1000;

/**
 * Tope de seguridad: 60 páginas = 60.000 filas. No es un límite de negocio, es
 * un cortacircuitos contra un bucle infinito si el orden no fuera estable.
 */
export const MAX_PAGES = 60;

/** Lo mínimo que tiene que devolver la página: la forma de PostgREST. */
type PageResult = { data: unknown; error: { message: string } | null };

export async function fetchAllPaged<T>(
  page: (from: number, to: number) => PromiseLike<PageResult>,
  opts: { pageSize?: number; maxPages?: number } = {},
): Promise<PagedRows<T>> {
  const size = Math.max(1, opts.pageSize ?? PAGE_SIZE);
  const tope = Math.max(1, opts.maxPages ?? MAX_PAGES);

  const rows: T[] = [];
  let from = 0;

  for (let i = 0; i < tope; i++) {
    const { data, error } = await page(from, from + size - 1);
    if (error) throw new Error(error.message);
    const batch = (data as T[] | null) ?? [];
    if (batch.length === 0) return { rows, complete: true };
    rows.push(...batch);
    // Avanza por lo RECIBIDO, no por lo pedido: si el servidor recorta la
    // página, la siguiente arranca donde de verdad quedó.
    from += batch.length;
  }

  return { rows, complete: false };
}
