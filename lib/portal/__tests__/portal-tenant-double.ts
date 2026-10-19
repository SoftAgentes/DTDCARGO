/**
 * SDD-0549 · Doble en memoria de supabase-js para probar el corte del Portal por
 * principal y tenant.
 *
 * No es más permisivo que la biblioteca (ver los tres modos en que miente un
 * doble de PostgREST):
 *  - APLICA de verdad `eq`, `neq`, `is(col, null)`, `in` y `gte` sobre las filas,
 *    en lecturas, UPDATE y DELETE. Quitar un `.eq("tenant_id", …)` del código
 *    cambia lo que la consulta devuelve o toca, y la prueba lo ve. `gte` compara
 *    con `>=` de JavaScript: sirve para números y fechas ISO (SDD-0552, zarpes).
 *  - `from()` sólo expone `select/insert/update/upsert/delete`, como supabase-js:
 *    un filtro antes de `select()` lanza `TypeError`.
 *  - Devuelve COPIAS: una escritura posterior no cambia lo ya leído.
 *
 * NO modela la RLS: devuelve toda fila que pase los filtros de la consulta. Eso
 * es lo que ve una sesión híbrida (miembro de equipo del tenant B y cliente
 * Portal del tenant A) por la policy permisiva «<tabla> by tenant»: el único
 * corte que queda es el filtro explícito de la aplicación, que es lo que se
 * prueba. Tampoco ordena (`order` no hace nada): las pruebas no dependen del
 * orden.
 *
 * `range(desde, hasta)` recorta como PostgREST (ambos extremos incluidos), para
 * las lecturas paginadas con `fetchAllPaged` (SDD-0554). Cada espera vuelve a
 * correr la consulta con el último `range`, como el builder de supabase-js.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type Row = Record<string, unknown>;
type Op = "eq" | "neq" | "is" | "in" | "gte";
export type Filter = { column: string; op: Op; value: unknown };
export type Kind = "select" | "insert" | "update" | "upsert" | "delete";

export interface Operation {
  table: string;
  kind: Kind;
  filters: Filter[];
  /** Filas leídas, insertadas o tocadas al resolver. */
  affected: number;
}

export interface PortalDoubleOptions {
  /** `null` = sin sesión. Por defecto `PORTAL_USER`. */
  userId?: string | null;
  /** Filas sembradas por tabla. Se copian: el store del doble es propio. */
  tables?: Record<string, Row[]>;
  /** RPC atendidas: valor fijo o función de los argumentos. Las demás devuelven null. */
  rpc?: Record<string, unknown | ((args: Row) => unknown)>;
}

export interface PortalDouble {
  db: SupabaseClient;
  /** Estado vivo del store, para leer el efecto de las escrituras. */
  store: Record<string, Row[]>;
  operations: Operation[];
  rpcCalls: { name: string; args: Row }[];
  /** Operaciones sobre una tabla, sin la resolución del principal. */
  on(table: string): Operation[];
}

export const PORTAL_USER = "11111111-1111-4111-8111-111111111111";
export const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
export const CLIENT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
/** El Shipping Mark es único POR tenant: el mismo valor existe en A y en B. */
export const MARKBOX = "DTD-0001";

/**
 * Vínculo Portal activo del usuario con el cliente A. `clientTenant` distinto de
 * TENANT_A arma un principal incoherente (vínculo de A, cliente de otro tenant).
 */
export function portalMembership(options: { clientTenant?: string; deletedAt?: string | null } = {}): Row {
  return {
    auth_user_id: PORTAL_USER,
    status: "active",
    client_id: CLIENT_A,
    tenant_id: TENANT_A,
    clients: {
      id: CLIENT_A,
      tenant_id: options.clientTenant ?? TENANT_A,
      markbox: MARKBOX,
      name: "Cliente sintético A",
      email: null,
      phone: null,
      address: null,
      rif: null,
      doc_kind: "empresa",
      city: null,
      state: null,
      deleted_at: options.deletedAt ?? null,
    },
  };
}

const clone = <T>(value: T): T => structuredClone(value);

function cell(row: Row, column: string): unknown {
  const value = row[column];
  // Una columna no escrita al insertar vale NULL en Postgres.
  return value === undefined ? null : value;
}

function matches(row: Row, filters: Filter[]): boolean {
  return filters.every(({ column, op, value }) => {
    const actual = cell(row, column);
    switch (op) {
      case "eq":
        return actual !== null && actual === value;
      case "neq":
        // `col <> x` con col NULL no es verdadero en SQL: la fila no pasa.
        return actual !== null && actual !== value;
      case "is":
        return actual === value;
      case "in":
        return Array.isArray(value) && actual !== null && value.includes(actual);
      case "gte":
        // `col >= x` con col NULL no es verdadero en SQL.
        return actual !== null && (actual as string | number) >= (value as string | number);
    }
  });
}

export function portalDouble(options: PortalDoubleOptions = {}): PortalDouble {
  const store: Record<string, Row[]> = clone(options.tables ?? {});
  const operations: Operation[] = [];
  const rpcCalls: { name: string; args: Row }[] = [];
  let nextId = 0;
  const rows = (table: string): Row[] => (store[table] ??= []);

  type Reply = { data: unknown; error: { code: string; message: string } | null; count?: number | null };

  /** Builder de filtros para select/update/delete: resuelve UNA vez, al esperar. */
  function filterBuilder(table: string, kind: "select" | "update" | "delete", payload?: Row, selectOpts?: { count?: string; head?: boolean }) {
    const operation: Operation = { table, kind, filters: [], affected: 0 };
    operations.push(operation);
    let limit: number | null = null;
    let offset = 0;
    let returning = kind === "select";

    const run = (): Row[] => {
      const hit = rows(table).filter((row) => matches(row, operation.filters));
      if (kind === "select") {
        const out = limit === null ? hit.slice(offset) : hit.slice(offset, offset + limit);
        operation.affected = out.length;
        return out.map(clone);
      }
      operation.affected = hit.length;
      if (kind === "update") {
        for (const row of hit) Object.assign(row, clone(payload ?? {}));
      } else {
        store[table] = rows(table).filter((row) => !hit.includes(row));
      }
      return hit.map(clone);
    };
    const reply = (): Reply => {
      const out = run();
      if (selectOpts?.count) return { data: selectOpts.head ? null : out, count: out.length, error: null };
      return { data: returning ? out : null, error: null };
    };
    const several = { code: "PGRST116", message: "doble: la consulta devolvió varias filas" };

    const builder = {
      eq(column: string, value: unknown) {
        operation.filters.push({ column, op: "eq", value });
        return builder;
      },
      neq(column: string, value: unknown) {
        operation.filters.push({ column, op: "neq", value });
        return builder;
      },
      is(column: string, value: unknown) {
        if (value !== null) throw new Error(`doble: is(${column}) sólo admite null`);
        operation.filters.push({ column, op: "is", value });
        return builder;
      },
      in(column: string, values: unknown[]) {
        operation.filters.push({ column, op: "in", value: [...values] });
        return builder;
      },
      gte(column: string, value: unknown) {
        operation.filters.push({ column, op: "gte", value });
        return builder;
      },
      order() {
        return builder;
      },
      limit(n: number) {
        limit = n;
        return builder;
      },
      range(from: number, to: number) {
        offset = from;
        limit = to - from + 1;
        return builder;
      },
      select() {
        if (kind === "select") throw new Error("doble: select() dos veces");
        returning = true;
        return builder;
      },
      async maybeSingle(): Promise<Reply> {
        const out = run();
        if (out.length > 1) return { data: null, error: several };
        return { data: out[0] ?? null, error: null };
      },
      async single(): Promise<Reply> {
        const out = run();
        if (out.length !== 1) return { data: null, error: several };
        return { data: out[0], error: null };
      },
      then<T>(resolve: (value: Reply) => T, reject?: (reason: unknown) => T) {
        return Promise.resolve().then(reply).then(resolve, reject);
      },
    };
    return builder;
  }

  /** insert/upsert: escriben al resolver; `.select().single()` devuelve la copia escrita. */
  function writeBuilder(table: string, kind: "insert" | "upsert", values: Row | Row[], upsertOpts?: { onConflict?: string; ignoreDuplicates?: boolean }) {
    const operation: Operation = { table, kind, filters: [], affected: 0 };
    operations.push(operation);
    let done: Row[] | null = null;
    const run = (): Row[] => {
      if (done) return done;
      const list = Array.isArray(values) ? values : [values];
      const written: Row[] = [];
      for (const value of list) {
        const row: Row = { id: `fila-${++nextId}`, ...clone(value) };
        if (kind === "upsert" && upsertOpts?.onConflict) {
          const keys = upsertOpts.onConflict.split(",").map((key) => key.trim());
          const existing = rows(table).find((r) => keys.every((key) => cell(r, key) === cell(row, key)));
          if (existing) {
            if (!upsertOpts.ignoreDuplicates) Object.assign(existing, clone(value));
            continue;
          }
        }
        rows(table).push(row);
        written.push(clone(row));
      }
      operation.affected = written.length;
      done = written;
      return written;
    };
    const builder = {
      select() {
        return {
          async single(): Promise<Reply> {
            const out = run();
            return out.length === 1 ? { data: out[0], error: null } : { data: null, error: { code: "PGRST116", message: "doble: no hay una sola fila" } };
          },
          async maybeSingle(): Promise<Reply> {
            const out = run();
            return { data: out[0] ?? null, error: null };
          },
        };
      },
      then<T>(resolve: (value: Reply) => T, reject?: (reason: unknown) => T) {
        return Promise.resolve().then(() => {
          run();
          return { data: null, error: null } as Reply;
        }).then(resolve, reject);
      },
    };
    return builder;
  }

  const userId = options.userId === undefined ? PORTAL_USER : options.userId;
  const db = {
    auth: {
      getUser: async () => ({ data: { user: userId ? { id: userId } : null }, error: null }),
    },
    from(table: string) {
      return {
        select: (_columns?: string, selectOpts?: { count?: string; head?: boolean }) =>
          filterBuilder(table, "select", undefined, selectOpts),
        insert: (values: Row | Row[]) => writeBuilder(table, "insert", values),
        upsert: (values: Row | Row[], upsertOpts?: { onConflict?: string; ignoreDuplicates?: boolean }) =>
          writeBuilder(table, "upsert", values, upsertOpts),
        update: (values: Row) => filterBuilder(table, "update", values),
        delete: () => filterBuilder(table, "delete"),
      };
    },
    async rpc(name: string, args: Row = {}) {
      rpcCalls.push({ name, args: clone(args) });
      const handler = options.rpc?.[name];
      const data = typeof handler === "function" ? (handler as (a: Row) => unknown)(args) : handler ?? null;
      return { data, error: null };
    },
  } as unknown as SupabaseClient;

  return {
    db,
    store,
    operations,
    rpcCalls,
    on: (table: string) => operations.filter((operation) => operation.table === table),
  };
}
