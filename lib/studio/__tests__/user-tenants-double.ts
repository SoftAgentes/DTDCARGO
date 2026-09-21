/**
 * Doble de PostgREST que HONRA LOS FILTROS — SDD-0498.
 *
 * Los dobles del repo que devuelven la fila pase lo que pase (`is: () => query`)
 * no pueden distinguir un gate que filtra `disabled_at` de uno que no lo filtra:
 * los dos leen la misma fila. Este doble guarda cada `.eq()`/`.is()` y recién al
 * resolver aplica el filtro sobre las filas sembradas, así que una consulta SIN
 * `.is("disabled_at", null)` ve al usuario suspendido y una CON el filtro no lo
 * ve. Esa diferencia es exactamente el defecto que esta tarea arregla.
 *
 * Devuelve COPIAS: si entregara los objetos vivos del store, una escritura
 * posterior cambiaría «lo ya leído» y la prueba pasaría (o fallaría) por algo
 * que en producción no ocurre.
 *
 * No es un motor SQL: sólo igualdad por columna, que es lo que usan estos gates.
 */

export type Row = Record<string, unknown>;
export type Reply = { data: unknown; error: { code?: string; message: string } | null };

export interface MembershipRow {
  user_id: string;
  tenant_id: string;
  role: string | null;
  disabled_at: string | null;
  warehouse_scope?: string | null;
}

export interface Write {
  table: string;
  op: "insert" | "update" | "upsert" | "delete";
  row?: Row;
}

export interface DoubleOptions {
  /** `null` = sin sesión. */
  userId?: string | null;
  /** Filas de `user_tenants`. */
  memberships?: MembershipRow[];
  /** Filas de otras tablas, por nombre. */
  tables?: Record<string, Row[]>;
  /** RPCs atendidas; las no listadas devuelven `{ data: null, error: null }`. */
  rpc?: Record<string, Reply | ((args: Row) => Reply)>;
}

export interface DoubleHandle {
  /** Cliente para inyectar donde el código espera el de `@/lib/db/server`. */
  client: unknown;
  /** Escrituras intentadas, en orden: la evidencia de que NO pasó nada. */
  writes: Write[];
  /** Tablas leídas, en orden. */
  reads: string[];
  /** RPCs llamadas, en orden. */
  rpcCalls: { name: string; args: Row }[];
}

const copy = (row: Row): Row => ({ ...row });

export function supabaseDouble(options: DoubleOptions = {}): DoubleHandle {
  const writes: Write[] = [];
  const reads: string[] = [];
  const rpcCalls: { name: string; args: Row }[] = [];
  const seeded: Record<string, Row[]> = {
    user_tenants: (options.memberships ?? []) as unknown as Row[],
    ...(options.tables ?? {}),
  };

  function query(table: string) {
    reads.push(table);
    const filters: [string, unknown][] = [];
    const matching = (): Row[] =>
      (seeded[table] ?? [])
        .filter((row) => filters.every(([field, value]) => row[field] === value))
        .map(copy);

    const builder: Record<string, unknown> = {};
    Object.assign(builder, {
      select: () => builder,
      eq: (field: string, value: unknown) => {
        filters.push([field, value]);
        return builder;
      },
      is: (field: string, value: unknown) => {
        filters.push([field, value]);
        return builder;
      },
      neq: () => builder,
      in: () => builder,
      order: () => builder,
      limit: () => builder,
      maybeSingle: async (): Promise<Reply> => ({ data: matching()[0] ?? null, error: null }),
      single: async (): Promise<Reply> => ({ data: matching()[0] ?? null, error: null }),
      then: (resolve: (reply: Reply) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve({ data: matching(), error: null } as Reply).then(resolve, reject),
      insert: (row: Row) => {
        writes.push({ table, op: "insert", row: copy(row) });
        return writeBuilder(row);
      },
      upsert: (row: Row) => {
        writes.push({ table, op: "upsert", row: copy(row) });
        return writeBuilder(row);
      },
      update: (row: Row) => {
        writes.push({ table, op: "update", row: copy(row) });
        return writeBuilder(row);
      },
      delete: () => {
        writes.push({ table, op: "delete" });
        return writeBuilder();
      },
    });
    return builder;
  }

  /**
   * Las escrituras encadenan `.eq(...).select(...).maybeSingle()` según la
   * action. Se devuelve una COPIA de la fila escrita con un `id` sintético
   * —el que en producción pone la DB— para que un `insert().select("id")`
   * tenga qué leer sin que la prueba dependa de lo que quedó en el store.
   */
  function writeBuilder(row?: Row) {
    const done: Reply = row
      ? { data: { id: `row-${writes.length}`, ...copy(row) }, error: null }
      : { data: null, error: null };
    const b: Record<string, unknown> = {};
    Object.assign(b, {
      eq: () => b,
      select: () => b,
      maybeSingle: async () => done,
      single: async () => done,
      then: (resolve: (reply: Reply) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(done).then(resolve, reject),
    });
    return b;
  }

  const client = {
    auth: {
      getUser: async () => ({
        data: { user: options.userId === undefined ? null : options.userId === null ? null : { id: options.userId } },
        error: null,
      }),
    },
    from: (table: string) => query(table),
    rpc: async (name: string, args: Row = {}): Promise<Reply> => {
      rpcCalls.push({ name, args: copy(args) });
      const handler = options.rpc?.[name];
      if (typeof handler === "function") return handler(args);
      return handler ?? { data: null, error: null };
    },
  };

  return { client, writes, reads, rpcCalls };
}
