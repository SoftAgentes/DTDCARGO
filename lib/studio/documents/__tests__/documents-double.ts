/**
 * Doble en memoria de `documents` + Storage para las pruebas de SDD-0508.
 *
 * No miente en lo que estas pruebas miden:
 *  - `select(cols)` devuelve SOLO esas columnas. Si una acción olvida pedir
 *    `bucket_id`, la fila llega sin él y el resolvedor no encuentra bucket.
 *  - `eq`/`is` filtran de verdad; `update` toca solo las filas filtradas.
 *  - `insert` aplica el default de `bucket_id` de 0307 (`'documents'`): si la
 *    acción no lo envía, la fila queda mintiendo, como en la base.
 *  - `createSignedUrl` solo firma si el objeto existe EN ESE bucket.
 * Devuelve copias, nunca las filas vivas.
 */

type Row = Record<string, unknown>;
type Filter = { col: string; op: "eq" | "is"; val: unknown };

export type StorageCall = {
  bucket: string;
  op: "remove" | "createSignedUrl";
  paths: string[];
};

export function makeDocumentsDouble(opts: {
  rows?: Row[];
  /** Objetos existentes, como `bucket/path`. */
  objects?: string[];
  updateError?: { message: string } | null;
  insertError?: { message: string } | null;
}) {
  const rows: Row[] = (opts.rows ?? []).map((r) => ({ ...r }));
  const objects = new Set(opts.objects ?? []);
  const storageCalls: StorageCall[] = [];
  const selects: string[] = [];
  const inserts: Row[] = [];

  function matches(row: Row, filters: Filter[]): boolean {
    return filters.every((f) =>
      f.op === "eq" ? row[f.col] === f.val : (row[f.col] ?? null) === f.val,
    );
  }

  function project(row: Row, cols: string | null): Row {
    if (!cols || cols.trim() === "*") return { ...row };
    const out: Row = {};
    for (const c of cols.split(",").map((s) => s.trim()).filter(Boolean)) {
      if (c in row) out[c] = row[c];
    }
    return out;
  }

  function table(name: string) {
    if (name !== "documents") throw new Error(`tabla inesperada: ${name}`);
    const filters: Filter[] = [];
    let cols: string | null = null;
    let patch: Row | null = null;

    const run = () => {
      if (patch) {
        if (opts.updateError) return { data: null, error: opts.updateError };
        for (const r of rows) if (matches(r, filters)) Object.assign(r, patch);
        return { data: null, error: null };
      }
      const data = rows.filter((r) => matches(r, filters)).map((r) => project(r, cols));
      return { data, error: null };
    };

    // supabase-js no ofrece filtros sobre `from()` a secas: primero select/update.
    const started = () => {
      if (cols === null && patch === null) {
        throw new Error("filtro antes de .select()/.update()");
      }
    };

    const builder = {
      select(c: string) {
        cols = c;
        selects.push(c);
        return builder;
      },
      eq(col: string, val: unknown) {
        started();
        filters.push({ col, op: "eq", val });
        return builder;
      },
      is(col: string, val: unknown) {
        started();
        filters.push({ col, op: "is", val });
        return builder;
      },
      order() {
        started();
        return builder;
      },
      update(p: Row) {
        patch = p;
        return builder;
      },
      insert(payload: Row) {
        inserts.push({ ...payload });
        if (opts.insertError) return Promise.resolve({ data: null, error: opts.insertError });
        rows.push({ bucket_id: "documents", deleted_at: null, ...payload });
        return Promise.resolve({ data: null, error: null });
      },
      async maybeSingle() {
        const { data, error } = run() as { data: Row[] | null; error: unknown };
        if (error || !data) return { data: null, error };
        if (data.length > 1) return { data: null, error: { message: "varias filas" } };
        return { data: data[0] ?? null, error: null };
      },
      then<T>(resolve: (v: { data: unknown; error: unknown }) => T) {
        return Promise.resolve(run()).then(resolve);
      },
    };
    return builder;
  }

  const supabase = {
    from: (name: string) => table(name),
    storage: {
      from(bucket: string) {
        return {
          async remove(paths: string[]) {
            storageCalls.push({ bucket, op: "remove", paths: [...paths] });
            for (const p of paths) objects.delete(`${bucket}/${p}`);
            return { data: null, error: null };
          },
          async createSignedUrl(path: string) {
            storageCalls.push({ bucket, op: "createSignedUrl", paths: [path] });
            if (!objects.has(`${bucket}/${path}`)) {
              return { data: null, error: { message: "Object not found" } };
            }
            return { data: { signedUrl: `https://firmada/${bucket}/${path}` }, error: null };
          },
        };
      },
    },
  };

  return {
    supabase,
    rows: () => rows.map((r) => ({ ...r })),
    objects: () => [...objects],
    storageCalls,
    selects,
    inserts,
  };
}
