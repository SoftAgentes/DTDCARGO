/**
 * Doble de PostgREST para los listados de SDD-0509 — APLICA los filtros.
 *
 * Lo que se prueba ES un filtro (`deleted_at is null`), así que un doble con
 * `is: () => query` no mide nada: la consulta con el filtro y la que se lo
 * olvidó leerían las mismas filas. Por eso este doble:
 *
 *  - aplica de verdad `eq/neq/is/in/not/gte/lte/ilike`, ordena con `order` y
 *    corta con `limit`/`range`, como PostgREST;
 *  - registra `or` pero NO filtra con él: así una búsqueda de texto matchea la
 *    fila viva Y la eliminada, y lo único que puede dejar afuera a la
 *    eliminada es el `deleted_at`;
 *  - cuenta con `{ count: "exact" }` sobre las filas filtradas (antes del
 *    `limit`) y con `head: true` no devuelve filas, como PostgREST;
 *  - devuelve COPIAS, para que nada que mute «lo leído» cambie el store;
 *  - LANZA si se llama un filtro antes de `select()`: en supabase-js los
 *    filtros viven en lo que devuelve `select()`, y un doble más permisivo que
 *    la biblioteca bendice código que en producción no corre.
 *
 * Tablas no sembradas devuelven `[]`. No es un motor SQL: alcanza para las
 * cadenas de los lectores de clientes y embarques.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type Fila = Record<string, unknown>;

export interface FiltroVisto {
  table: string;
  op: string;
  col: string;
  val: unknown;
}

export interface DobleListados {
  client: SupabaseClient;
  /** Filtros aplicados, en orden, para afirmar sobre ellos. */
  filtros: FiltroVisto[];
}

type Resultado = {
  data: unknown;
  error: null;
  count: number | null;
};

const copia = (fila: Fila): Fila => ({ ...fila });

/** `"(a,b,c)"` → `["a","b","c"]`, como PostgREST lee la lista de `not.in`. */
function listaPostgrest(raw: unknown): string[] {
  return String(raw)
    .replace(/^\(|\)$/g, "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function comparar(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1; // nulls last, como el default de PostgREST en asc
  if (b == null) return -1;
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Opciones del doble.
 *
 * `serverCap` (SDD-0557) emula `db-max-rows`: ninguna respuesta trae más de N
 * filas, pida lo que pida el lector (`range` o `limit`). Sin él, una lectura
 * sin paginar devuelve todo y el mutante «leer sin `fetchAllPaged`» sobrevive.
 * Es opcional para no cambiar las pruebas que ya usan el doble.
 */
export interface OpcionesDoble {
  serverCap?: number;
}

export function dobleListados(
  tablas: Record<string, Fila[]>,
  opciones: OpcionesDoble = {},
): DobleListados {
  const filtros: FiltroVisto[] = [];
  const cap = opciones.serverCap ?? Infinity;

  function from(table: string) {
    const lanzar = (metodo: string) => () => {
      throw new Error(
        `doble: .${metodo}() antes de .select() sobre ${table} — supabase-js no lo permite`,
      );
    };

    return {
      select(_cols?: string, opts?: { count?: string; head?: boolean }) {
        let visibles = (tablas[table] ?? []).map(copia);
        let tope = Infinity;
        const contar = opts?.count === "exact";
        const head = opts?.head === true;
        const registrar = (op: string, col: string, val: unknown) =>
          filtros.push({ table, op, col, val });

        const resolver = (filas: Fila[], total: number): Resultado => ({
          data: head ? null : filas.map(copia),
          error: null,
          count: contar ? total : null,
        });

        const chain: Record<string, unknown> = {
          eq(col: string, val: unknown) {
            registrar("eq", col, val);
            visibles = visibles.filter((r) => r[col] === val);
            return chain;
          },
          neq(col: string, val: unknown) {
            registrar("neq", col, val);
            visibles = visibles.filter((r) => r[col] !== val);
            return chain;
          },
          is(col: string, val: unknown) {
            registrar("is", col, val);
            if (val === null) visibles = visibles.filter((r) => r[col] == null);
            else visibles = visibles.filter((r) => r[col] === val);
            return chain;
          },
          in(col: string, vals: unknown[]) {
            registrar("in", col, vals);
            visibles = visibles.filter((r) => vals.includes(r[col]));
            return chain;
          },
          not(col: string, op: string, val: unknown) {
            registrar(`not.${op}`, col, val);
            if (op === "in") {
              const fuera = listaPostgrest(val);
              visibles = visibles.filter((r) => !fuera.includes(String(r[col])));
            } else if (op === "is" && val === null) {
              visibles = visibles.filter((r) => r[col] != null);
            } else {
              throw new Error(`doble: not(${col}, ${op}) sin modelar`);
            }
            return chain;
          },
          gte(col: string, val: string | number) {
            registrar("gte", col, val);
            visibles = visibles.filter(
              (r) => r[col] != null && (r[col] as string | number) >= val,
            );
            return chain;
          },
          lte(col: string, val: string | number) {
            registrar("lte", col, val);
            visibles = visibles.filter(
              (r) => r[col] != null && (r[col] as string | number) <= val,
            );
            return chain;
          },
          ilike(col: string, patron: string) {
            registrar("ilike", col, patron);
            const aguja = patron.replace(/%/g, "").toLowerCase();
            visibles = visibles.filter((r) =>
              String(r[col] ?? "").toLowerCase().includes(aguja),
            );
            return chain;
          },
          or(expr: string) {
            registrar("or", expr, null);
            return chain;
          },
          order(col: string, opts?: { ascending?: boolean }) {
            const asc = opts?.ascending !== false;
            visibles = [...visibles].sort((a, b) =>
              asc ? comparar(a[col], b[col]) : comparar(b[col], a[col]),
            );
            return chain;
          },
          limit(n: number) {
            tope = n;
            return chain;
          },
          range(desde: number, hasta: number) {
            const fin = Math.min(hasta + 1, desde + cap);
            return Promise.resolve(
              resolver(visibles.slice(desde, fin), visibles.length),
            );
          },
          maybeSingle() {
            return Promise.resolve({
              data: visibles[0] ? copia(visibles[0]) : null,
              error: null,
            });
          },
          then(
            resolve: (v: Resultado) => unknown,
            reject?: (e: unknown) => unknown,
          ) {
            const n = Math.min(tope, cap);
            const cortadas = n === Infinity ? visibles : visibles.slice(0, n);
            return Promise.resolve(resolver(cortadas, visibles.length)).then(
              resolve,
              reject,
            );
          },
        };
        return chain;
      },
      eq: lanzar("eq"),
      is: lanzar("is"),
      in: lanzar("in"),
      not: lanzar("not"),
      order: lanzar("order"),
      limit: lanzar("limit"),
    };
  }

  /** Una RPC sirve `tablas[fn]` con la misma cadena que una tabla. */
  function rpc(fn: string) {
    return from(fn).select();
  }

  return {
    client: { from, rpc } as unknown as SupabaseClient,
    filtros,
  };
}

/** Las filas con `deleted_at` puesto en `null`: lo que vería un lector sin filtro. */
export function todoVivo(tablas: Record<string, Fila[]>): Record<string, Fila[]> {
  return Object.fromEntries(
    Object.entries(tablas).map(([t, filas]) => [
      t,
      filas.map((f) => ({ ...f, deleted_at: null })),
    ]),
  );
}
