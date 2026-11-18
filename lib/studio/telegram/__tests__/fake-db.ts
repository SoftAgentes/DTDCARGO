/**
 * Doble de `SupabaseClient` para los tests de ruteo de Telegram (SDD-0271).
 *
 * ⚠️ Está escrito para ser MÁS ESTRICTO, no más cómodo, que el servidor: aplica
 * de verdad `eq` / `in` / `is` / `not`, resuelve el embed `alias:tabla!fk(cols)`
 * contra la tabla real del fixture, y devuelve `[]` para una tabla que el
 * fixture no define. Un doble que ignora filtros convierte cualquier consulta en
 * "trae todo" y deja pasar justo los bugs que estas pruebas buscan.
 *
 * No es un Supabase completo: cubre las formas de consulta que usa
 * `alert-routing.ts` y nada más. Si un módulo empieza a consultar de otra forma,
 * el doble falla ruidosamente en vez de fingir.
 */

type Row = Record<string, unknown>;
export type FakeDb = Record<string, Row[]>;

type Filter =
  | { op: "eq"; col: string; val: unknown }
  | { op: "in"; col: string; vals: unknown[] }
  | { op: "is"; col: string; val: unknown }
  | { op: "notIs"; col: string; val: unknown };

const EMBED_RE = /(\w+)\s*:\s*(\w+)\s*!\s*(\w+)\s*\(([^)]*)\)/;

function applyFilters(rows: Row[], filters: Filter[]): Row[] {
  return rows.filter((row) =>
    filters.every((f) => {
      switch (f.op) {
        case "eq":
          return row[f.col] === f.val;
        case "in":
          return f.vals.includes(row[f.col]);
        case "is":
          return f.val === null
            ? row[f.col] === null || row[f.col] === undefined
            : row[f.col] === f.val;
        case "notIs":
          return f.val === null
            ? row[f.col] !== null && row[f.col] !== undefined
            : row[f.col] !== f.val;
      }
    }),
  );
}

/** Resuelve `alias:tabla!fk ( cols )` uniendo por `id` contra la tabla real. */
function resolveEmbed(db: FakeDb, select: string, rows: Row[]): Row[] {
  const match = select.match(EMBED_RE);
  if (!match) return rows;

  const [, alias, table, fk, colsRaw] = match;
  const cols = colsRaw
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  const target = db[table] ?? [];

  return rows.map((row) => {
    const hit = target.find((t) => t.id === row[fk]);
    const projected = hit
      ? Object.fromEntries(cols.map((c) => [c, hit[c]]))
      : null;
    return { ...row, [alias]: projected };
  });
}

export function makeFakeSupabase(db: FakeDb) {
  function from(table: string) {
    const filters: Filter[] = [];
    let select = "*";

    function resolve() {
      const base = db[table] ?? [];
      const filtered = applyFilters(base, filters);
      return { data: resolveEmbed(db, select, filtered), error: null };
    }

    const chain = {
      /**
       * SDD-0606 · INSERT de una fila. Una tabla que el fixture no define
       * responde como PostgREST cuando la relación no existe (migración sin
       * aplicar): con error y sin escribir nada.
       */
      insert(row: Row | Row[]) {
        const rows = Array.isArray(row) ? row : [row];
        const target = db[table];
        const result = target
          ? (target.push(...rows.map((r) => ({ ...r }))), { data: null, error: null })
          : {
              data: null,
              error: { code: "42P01", message: `relation "public.${table}" does not exist` },
            };
        return {
          then(onOk: (v: unknown) => unknown, onErr?: (e: unknown) => unknown) {
            return Promise.resolve(result).then(onOk, onErr);
          },
        };
      },
      select(cols?: string) {
        if (cols) select = cols;
        return chain;
      },
      eq(col: string, val: unknown) {
        filters.push({ op: "eq", col, val });
        return chain;
      },
      in(col: string, vals: unknown[]) {
        filters.push({ op: "in", col, vals });
        return chain;
      },
      is(col: string, val: unknown) {
        filters.push({ op: "is", col, val });
        return chain;
      },
      not(col: string, op: string, val: unknown) {
        if (op !== "is") throw new Error(`fake-db: .not(${op}) no soportado`);
        filters.push({ op: "notIs", col, val });
        return chain;
      },
      order() {
        return chain;
      },
      limit() {
        return chain;
      },
      async maybeSingle() {
        const { data } = resolve();
        return { data: data[0] ?? null, error: null };
      },
      then(
        onOk: (v: unknown) => unknown,
        onErr?: (e: unknown) => unknown,
      ) {
        return Promise.resolve(resolve()).then(onOk, onErr);
      },
    };

    return chain;
  }

  return { from } as never;
}
