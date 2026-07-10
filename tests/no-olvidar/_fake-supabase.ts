/**
 * Fake mínimo de SupabaseClient para tests unitarios de recovery.ts y
 * session.ts SIN una DB real. Soporta SOLO las cadenas que esos módulos usan:
 *
 *   from(t).select(c).eq(k,v)…maybeSingle() / .single()
 *   from(t).insert(row).select("*").single()
 *   from(t).update(patch).eq(k,v)…               (await → {error})
 *   from(t).update(patch).eq(k,v)….select("*").single()
 *   rpc("no_olvidar_check_admin", { p_user_id })
 *
 * NO pretende replicar RLS ni PostgREST — los guards `.eq("status","pending")`
 * se aplican como filtros de fila para ejercitar la lógica anti-carrera.
 */

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars -- test double: shapes dinámicas + params de firma sin usar */

type Row = Record<string, any>;

let idCounter = 1;
function nextId(): string {
  return `id-${idCounter++}`;
}

interface Filter {
  key: string;
  value: unknown;
}

class QueryBuilder {
  private op: "select" | "insert" | "update" = "select";
  private filters: Filter[] = [];
  private payload: Row | null = null;
  private wantSelect = false;

  constructor(
    private table: Row[],
    private tableName: string,
  ) {}

  select(_cols?: string): this {
    if (this.op === "select") this.op = "select";
    this.wantSelect = true;
    return this;
  }

  insert(row: Row | Row[]): this {
    this.op = "insert";
    this.payload = Array.isArray(row) ? row[0] : row;
    return this;
  }

  update(patch: Row): this {
    this.op = "update";
    this.payload = patch;
    return this;
  }

  eq(key: string, value: unknown): this {
    this.filters.push({ key, value });
    return this;
  }

  private match(row: Row): boolean {
    return this.filters.every((f) => row[f.key] === f.value);
  }

  private execute(): { data: Row[] | null; error: { message: string } | null } {
    if (this.op === "insert") {
      const row: Row = {
        id: this.payload!.id ?? nextId(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...this.payload,
      };
      this.table.push(row);
      return { data: [row], error: null };
    }
    if (this.op === "update") {
      const affected = this.table.filter((r) => this.match(r));
      for (const r of affected) Object.assign(r, this.payload);
      return { data: affected, error: null };
    }
    // select
    return { data: this.table.filter((r) => this.match(r)), error: null };
  }

  async maybeSingle<T = Row>(): Promise<{ data: T | null; error: { message: string } | null }> {
    const { data, error } = this.execute();
    return { data: (data && data[0]) ? (data[0] as T) : null, error };
  }

  async single<T = Row>(): Promise<{ data: T | null; error: { message: string } | null }> {
    const { data, error } = this.execute();
    if (error) return { data: null, error };
    if (!data || data.length === 0) {
      return { data: null, error: { message: "no rows (single)" } };
    }
    return { data: data[0] as T, error: null };
  }

  // Thenable: `await builder` (update/insert sin .select()) ejecuta y devuelve {error}.
  then(
    resolve: (v: { data: Row[] | null; error: { message: string } | null }) => unknown,
    reject?: (e: unknown) => unknown,
  ): unknown {
    try {
      return resolve(this.execute());
    } catch (e) {
      return reject ? reject(e) : undefined;
    }
  }
}

export interface FakeSupabaseOptions {
  admins?: string[];
  tables?: Record<string, Row[]>;
}

export interface FakeSupabase {
  from(table: string): QueryBuilder;
  rpc(fn: string, args?: Row): Promise<{ data: unknown; error: { message: string } | null }>;
  /** Acceso directo a las filas de una tabla (para asserts en tests). */
  _rows(table: string): Row[];
}

/** Construye un fake con tablas sembradas y un set de admins para el RPC. */
export function makeFakeSupabase(opts: FakeSupabaseOptions = {}): FakeSupabase {
  const admins = new Set(opts.admins ?? []);
  const store: Record<string, Row[]> = {
    no_olvidar_recovery_requests: [],
    no_olvidar_user_keys: [],
    no_olvidar_config: [{ id: 1, recovery_approvals_required: 2, session_timeout_minutes: 30, failed_attempts_lockout: 5, lockout_minutes: 15 }],
    no_olvidar_access_log: [],
    ...(opts.tables ?? {}),
  };

  return {
    from(table: string) {
      if (!store[table]) store[table] = [];
      return new QueryBuilder(store[table], table);
    },
    async rpc(fn: string, args: Row = {}) {
      if (fn === "no_olvidar_check_admin") {
        return { data: admins.has(args.p_user_id as string), error: null };
      }
      if (fn === "no_olvidar_increment_failed_attempt") {
        // Simula la lógica del RPC 0224 contra el store in-memory. La
        // corrección del SQL real la valida el revisor / la aplicación de la
        // migración; acá se ejercita el cableado y el parseo del jsonb.
        const cfg = store.no_olvidar_config[0] ?? {};
        const threshold = (cfg.failed_attempts_lockout as number) ?? 5;
        const lockoutMin = (cfg.lockout_minutes as number) ?? 15;
        const row = store.no_olvidar_user_keys.find((r) => r.user_id === args.p_user_id);
        if (!row) return { data: null, error: { message: "sin fila user_keys" } };
        row.failed_unlock_attempts = ((row.failed_unlock_attempts as number) ?? 0) + 1;
        const attempts = row.failed_unlock_attempts as number;
        const locked = attempts >= threshold;
        if (locked) {
          row.locked_until = new Date(Date.now() + lockoutMin * 60_000).toISOString();
        }
        return { data: { attempts, locked, until: row.locked_until ?? null }, error: null };
      }
      return { data: null, error: { message: `rpc ${fn} no soportado en fake` } };
    },
    _rows(table: string) {
      return store[table] ?? [];
    },
  };
}
