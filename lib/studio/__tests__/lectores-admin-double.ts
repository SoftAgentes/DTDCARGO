/**
 * Doble de PostgREST para los lectores con cliente admin de SDD-0511 — APLICA
 * los filtros.
 *
 * Lo que se prueba ES un filtro (`deleted_at is null`). Un doble que devuelve
 * la misma fila haga lo que haga la consulta no distingue la lectura con
 * filtro de la que se lo olvidó. Por eso este doble:
 *
 *  - aplica de verdad `eq/neq/is/in/not/lt/lte`, ordena con `order` y corta
 *    con `limit`, como PostgREST;
 *  - `maybeSingle()` falla con más de una fila (PGRST116), como PostgREST: un
 *    doble que se quedara con la primera bendice una lectura que en producción
 *    devuelve `null`;
 *  - `update()` modifica SU copia del store solo en las filas que cumplen sus
 *    `eq`, así que un UPDATE condicional (el claim del drain) se comporta como
 *    en la base: si la fila ya cambió de estado, no matchea;
 *  - trabaja sobre una copia de las tablas y devuelve COPIAS: ni el fixture
 *    del test ni «lo leído» cambian el store por accidente;
 *  - LANZA si se llama un filtro antes de `select()`/`update()`: en
 *    supabase-js los filtros viven en lo que devuelven, y un doble más
 *    permisivo que la biblioteca bendice código que en producción no corre;
 *  - las RPC responden lo que diga el test (`rpcs`), con el store a la vista;
 *    una RPC no declarada falla como en PostgREST (PGRST202).
 *
 * SDD-0524 le suma, sin cambiar lo anterior:
 *
 *  - `insert()` sobre su copia del store, con los índices únicos que declare
 *    el test (`opciones.unicos`, parciales con `where`): un INSERT que choca
 *    devuelve 23505 y NO escribe, como Postgres. Sin eso, el descarte por
 *    duplicado del índice de la 0389 no existe en la prueba y el aviso «sale»;
 *  - `opciones.rechazarInsert` para simular una columna que falta (42703) u
 *    otro error de la base sin tocar el store;
 *  - `opciones.fallarSelect` para que una lectura devuelva error y `data: null`,
 *    como cuando PostgREST no responde: separa «no hay» de «no se pudo saber»;
 *  - `or("a.is.null,a.eq.x")`, la única forma que usa el motor de avisos;
 *  - `inserts`, en orden, con lo que se pidió escribir (haya entrado o no).
 *
 * Es equivalente al de SDD-0509 (`listados-double.ts`, PR #203, todavía sin
 * fusionar al escribir esto). Cuando los dos estén en main conviene unirlos.
 * No es un motor SQL: alcanza para las cadenas de los lectores de esta SDD.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type Fila = Record<string, unknown>;
export type Tablas = Record<string, Fila[]>;

export interface FiltroVisto {
  table: string;
  op: string;
  col: string;
  val: unknown;
}

export interface UpdateVisto {
  table: string;
  values: Fila;
  filtros: Array<{ op: string; col: string; val: unknown }>;
}

type ErrorPostgrest = { code: string; message: string };
type Resultado = { data: unknown; error: ErrorPostgrest | null };

export type Rpc = (args: Record<string, unknown>, store: Tablas) => Resultado;

/** Un índice único (parcial si trae `where`), como los de la 0389. */
export interface IndiceUnico {
  nombre: string;
  cols: string[];
  where?: (fila: Fila) => boolean;
}

export interface InsertVisto {
  table: string;
  values: Fila;
  /** `null` si entró; el error de la base si no. */
  error: ErrorPostgrest | null;
}

export interface OpcionesDoble {
  /** Índices únicos por tabla. */
  unicos?: Record<string, IndiceUnico[]>;
  /** Error que la base devuelve a un INSERT en esa tabla (no escribe). */
  rechazarInsert?: (table: string, fila: Fila) => ErrorPostgrest | null;
  /** Error que la base devuelve a toda lectura de esa tabla (`data: null`). */
  fallarSelect?: (table: string) => ErrorPostgrest | null;
}

export interface DobleLectores {
  client: SupabaseClient;
  /** El estado de las tablas, con los `update` aplicados. */
  store: Tablas;
  /** Filtros de lectura aplicados, en orden. */
  filtros: FiltroVisto[];
  /** Updates pedidos, en orden. */
  updates: UpdateVisto[];
  /** Inserts pedidos, en orden, con su resultado. */
  inserts: InsertVisto[];
}

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

/** Lo que devuelve PostgREST a `maybeSingle()` sobre estas filas. */
function unaOninguna(filas: Fila[]): Resultado {
  if (filas.length > 1) {
    return {
      data: null,
      error: {
        code: "PGRST116",
        message: "JSON object requested, multiple (or no) rows returned",
      },
    };
  }
  return { data: filas[0] ? copia(filas[0]) : null, error: null };
}

/**
 * `"client_id.is.null,client_id.eq.c-1"` → predicado. Solo `is.null` y `eq`:
 * otra forma lanza, para que el doble no finja entender lo que no modela.
 */
function predicadoOr(expr: string): (r: Fila) => boolean {
  const partes = expr.split(",").map((p) => p.trim()).filter(Boolean);
  const preds = partes.map((p) => {
    const m = /^(\w+)\.(is|eq)\.(.+)$/.exec(p);
    if (!m) throw new Error(`doble: or(${expr}) sin modelar`);
    const [, col, op, val] = m;
    if (op === "is") {
      if (val !== "null") throw new Error(`doble: or(${p}) sin modelar`);
      return (r: Fila) => r[col] == null;
    }
    return (r: Fila) => r[col] != null && String(r[col]) === val;
  });
  return (r) => preds.some((pred) => pred(r));
}

export function dobleLectores(
  tablas: Tablas,
  rpcs: Record<string, Rpc> = {},
  opciones: OpcionesDoble = {},
): DobleLectores {
  const store: Tablas = Object.fromEntries(
    Object.entries(tablas).map(([t, filas]) => [t, filas.map(copia)]),
  );
  const filtros: FiltroVisto[] = [];
  const updates: UpdateVisto[] = [];
  const inserts: InsertVisto[] = [];
  let secuencia = 0;

  /** El índice único que esta fila violaría, o `null`. */
  function choque(table: string, fila: Fila): IndiceUnico | null {
    for (const idx of opciones.unicos?.[table] ?? []) {
      if (idx.where && !idx.where(fila)) continue;
      // En Postgres los NULL no chocan entre sí en un índice único.
      if (idx.cols.some((c) => fila[c] == null)) continue;
      const otra = (store[table] ?? []).find(
        (r) =>
          (!idx.where || idx.where(r)) &&
          idx.cols.every((c) => r[c] != null && r[c] === fila[c]),
      );
      if (otra) return idx;
    }
    return null;
  }

  function from(table: string) {
    const lanzar = (metodo: string) => () => {
      throw new Error(
        `doble: .${metodo}() antes de .select() sobre ${table} — supabase-js no lo permite`,
      );
    };

    return {
      select() {
        let visibles = (store[table] ?? []).map(copia);
        let tope = Infinity;
        const registrar = (op: string, col: string, val: unknown) =>
          filtros.push({ table, op, col, val });
        const cortadas = () => (tope === Infinity ? visibles : visibles.slice(0, tope));

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
          or(expr: string) {
            registrar("or", "*", expr);
            const pred = predicadoOr(expr);
            visibles = visibles.filter(pred);
            return chain;
          },
          lt(col: string, val: string | number) {
            registrar("lt", col, val);
            visibles = visibles.filter(
              (r) => r[col] != null && (r[col] as string | number) < val,
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
          maybeSingle(): Promise<Resultado> {
            const falla = opciones.fallarSelect?.(table) ?? null;
            if (falla) return Promise.resolve({ data: null, error: falla });
            return Promise.resolve(unaOninguna(cortadas()));
          },
          then(resolve: (v: Resultado) => unknown, reject?: (e: unknown) => unknown) {
            const falla = opciones.fallarSelect?.(table) ?? null;
            return Promise.resolve<Resultado>(
              falla
                ? { data: null, error: falla }
                : { data: cortadas().map(copia), error: null },
            ).then(resolve, reject);
          },
        };
        return chain;
      },
      update(values: Fila) {
        const visto: UpdateVisto = { table, values: { ...values }, filtros: [] };
        updates.push(visto);
        const condiciones: Array<(r: Fila) => boolean> = [];
        // Se aplica una sola vez, al resolver, como el UPDATE de PostgREST.
        let aplicadas: Fila[] | null = null;
        const aplicar = (): Fila[] => {
          if (aplicadas) return aplicadas;
          aplicadas = (store[table] ?? []).filter((r) =>
            condiciones.every((c) => c(r)),
          );
          for (const r of aplicadas) Object.assign(r, values);
          return aplicadas;
        };

        const chain: Record<string, unknown> = {
          eq(col: string, val: unknown) {
            visto.filtros.push({ op: "eq", col, val });
            condiciones.push((r) => r[col] === val);
            return chain;
          },
          select() {
            return {
              maybeSingle(): Promise<Resultado> {
                return Promise.resolve(unaOninguna(aplicar()));
              },
              then(resolve: (v: Resultado) => unknown, reject?: (e: unknown) => unknown) {
                return Promise.resolve<Resultado>({
                  data: aplicar().map(copia),
                  error: null,
                }).then(resolve, reject);
              },
            };
          },
          then(resolve: (v: Resultado) => unknown, reject?: (e: unknown) => unknown) {
            aplicar();
            return Promise.resolve<Resultado>({ data: null, error: null }).then(
              resolve,
              reject,
            );
          },
        };
        return chain;
      },
      insert(values: Fila | Fila[]) {
        const filas = (Array.isArray(values) ? values : [values]).map(copia);
        // Todo o nada, como un INSERT de varias filas en Postgres.
        let error: ErrorPostgrest | null = null;
        for (const fila of filas) {
          error = opciones.rechazarInsert?.(table, fila) ?? null;
          if (error) break;
          const idx = choque(table, fila);
          if (idx) {
            error = {
              code: "23505",
              message: `duplicate key value violates unique constraint "${idx.nombre}"`,
            };
            break;
          }
        }
        for (const fila of filas) inserts.push({ table, values: copia(fila), error });
        if (!error) {
          store[table] = store[table] ?? [];
          for (const fila of filas) {
            if (fila.id == null) fila.id = `${table}-${++secuencia}`;
            store[table].push(fila);
          }
        }
        const resultado: Resultado = { data: null, error };
        return {
          then(resolve: (v: Resultado) => unknown, reject?: (e: unknown) => unknown) {
            return Promise.resolve(resultado).then(resolve, reject);
          },
        };
      },
      eq: lanzar("eq"),
      is: lanzar("is"),
      in: lanzar("in"),
      not: lanzar("not"),
      or: lanzar("or"),
      order: lanzar("order"),
      limit: lanzar("limit"),
      maybeSingle: lanzar("maybeSingle"),
    };
  }

  function rpc(fn: string, args: Record<string, unknown> = {}): Promise<Resultado> {
    const impl = rpcs[fn];
    if (!impl) {
      return Promise.resolve({
        data: null,
        error: { code: "PGRST202", message: `doble: rpc ${fn} no declarada` },
      });
    }
    return Promise.resolve(impl(args, store));
  }

  return {
    client: { from, rpc } as unknown as SupabaseClient,
    store,
    filtros,
    updates,
    inserts,
  };
}

/** Las filas con `deleted_at` puesto en `null`: lo que vería un lector sin filtro. */
export function todoVivo(tablas: Tablas): Tablas {
  return Object.fromEntries(
    Object.entries(tablas).map(([t, filas]) => [
      t,
      filas.map((f) => ({ ...f, deleted_at: null })),
    ]),
  );
}
