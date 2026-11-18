// @vitest-environment node
/** SDD-0573 UI/B1: lector real, filtros/proyección/páginas del doble real. NO prueba RLS de una DB. */
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { dobleListados, type Fila, type OpcionesDoble } from "./listados-double";
import { getEntryByCode, journalEntryProtections, listEntries } from "../journal-queries";

const entry = (id: string, extra: Fila = {}): Fila => ({
  id, tenant_id: "t1", entry_code: `A-2026-${id === "o" ? "0001" : id === "r" ? "0002" : "0003"}`,
  entry_date: "2026-10-20", memo: null, source: "manual", status: "borrador", deleted_at: null,
  invoice_id: null, reverses_entry_id: null, receipt_id: null, bill_id: null, supplier_payment_id: null,
  posted_at: null, created_at: "", updated_at: "", journal_lines: [], ...extra,
});
const pair = () => [
  entry("o", { source: "invoice", status: "asentado", invoice_id: "f1" }),
  entry("r", { source: "invoice_reversal", status: "asentado", invoice_id: "f1", reverses_entry_id: "o" }),
];
type Response = { data: unknown; error: unknown; count?: number | null };
type Read = { table: string; columns: string; lookup?: string; from?: number; to?: number; response: Response };
type Chain = {
  in: (column: string, values: unknown[]) => Chain;
  range: (from: number, to: number) => Promise<Response>;
  then: (resolve: (value: Response) => unknown, reject?: (reason: unknown) => unknown) => PromiseLike<unknown>;
};
function clientFor(rows: Fila[], options: OpcionesDoble = {}, fault?: (read: Read) => Response) {
  const membership: Fila[] = [{ tenant_id: "t1", user_id: "u1", disabled_at: null }];
  const tables = { journal_entries: rows, user_tenants: membership };
  const base = dobleListados(tables, { proyectar: true, ...options });
  const reads: Read[] = [];
  const auth = vi.fn(async () => ({ data: { user: { id: "u1" } }, error: null }));
  const client = {
    auth: { getUser: auth },
    from(table: string) {
      const source = base.client.from(table);
      return {
        select(columns: string, opts?: { count?: "exact"; head?: boolean }) {
          const query = source.select(columns, opts) as unknown as Chain;
          const range = query.range.bind(query);
          const then = query.then.bind(query);
          const inFilter = query.in.bind(query);
          let lookup: string | undefined;
          query.in = (column, values) => { lookup = column; return inFilter(column, values); };
          query.range = async (from, to) => {
            const read = { table, columns, lookup, from, to, response: await range(from, to) };
            reads.push(read);
            return fault ? fault(read) : read.response;
          };
          query.then = (resolve, reject) => new Promise<Response>((resolveResponse, rejectResponse) => {
            then(resolveResponse, rejectResponse);
          }).then((response) => {
            const read = { table, columns, response };
            reads.push(read);
            return fault ? fault(read) : response;
          }).then(resolve, reject);
          return query;
        },
      };
    },
  } as unknown as SupabaseClient;
  return { client, tables, filters: base.filtros, reads, auth };
}
const auxiliary = (read: Read) => read.table === "journal_entries" && read.columns.includes("reverses_entry_id");

describe("SDD-0573 · protección raw del diario", () => {
  it("identifica original y reverso en ambos sentidos sin certificar importes", async () => {
    const rows = pair();
    const d = clientFor(rows);
    expect(await journalEntryProtections(d.client, rows)).toEqual([
      { state: "protegido", reading: "completa", relation: "original", counterpartCode: "A-2026-0002" },
      { state: "protegido", reading: "completa", relation: "reverso", counterpartCode: "A-2026-0001" },
    ]);
    expect(d.auth).toHaveBeenCalledTimes(1);
    expect(d.filters).toContainEqual({ table: "user_tenants", op: "eq", col: "user_id", val: "u1" });
    expect(d.filters).toContainEqual({ table: "user_tenants", op: "is", col: "disabled_at", val: null });
    expect(d.filters).toContainEqual({ table: "journal_entries", op: "eq", col: "tenant_id", val: "t1" });
    expect(d.filters.filter((f) => f.table === "journal_entries" && f.op === "eq").every((f) => f.col === "tenant_id" && f.val === "t1")).toBe(true);
  });

  it("manual conocido requiere backlink null explícito e inverso completo vacío", async () => {
    const row = entry("m");
    const d = clientFor([row], { serverCap: 1 });
    expect(await journalEntryProtections(d.client, [row])).toEqual([{ state: "sin_vinculo_visible", reading: "completa", relation: "ninguno_visible" }]);
    expect(d.reads.some((r) => auxiliary(r) && r.from === 1 && Array.isArray(r.response.data) && r.response.data.length === 0)).toBe(true);
    expect(d.filters.some((f) => f.col === "reverses_entry_id" && f.op === "in")).toBe(true);
  });

  it.each(["invoice_id", "status", "deleted_at", "reverses_entry_id"])("automático con %s ausente conserva protección sin certificar lectura/inconsistencia", async (field) => {
    const row = entry("o", { source: "invoice", [field]: undefined });
    const d = clientFor([row]);
    expect((await journalEntryProtections(d.client, [row]))[0]).toEqual({ state: "protegido", reading: "no_comprobada", relation: "no_comprobado" });
  });

  it.each(["invoice", "invoice_reversal"])("%s sin par permanece protegido sin fabricar contraparte", async (source) => {
    const row = entry("auto", { source });
    const d = clientFor([row]);
    const [p] = await journalEntryProtections(d.client, [row]);
    expect(p.state).toBe("protegido");
    expect(p.relation).not.toBe("original");
    expect(p.relation).not.toBe("reverso");
    expect(p).not.toHaveProperty("counterpartCode");
  });

  it("un manual con referencia entrante borrada/anulada fuera500 y del filtro sigue protegido", async () => {
    const target = entry("000-m");
    const rows = [target, ...Array.from({ length: 501 }, (_, n) => entry(`f-${n}`, { entry_date: "2020-01-01" })),
      entry("zz-r", { source: "invoice_reversal", reverses_entry_id: "000-m", status: "anulado", deleted_at: "2026-10-21", entry_date: "2019-01-01" })];
    const d = clientFor(rows);
    const listed = await listEntries(d.client, { status: "borrador", q: "A-2026" });
    expect(listed).toHaveLength(500);
    expect(listed.find((row) => row.id === "000-m")?.protection).toMatchObject({ state: "protegido", relation: "inconsistente" });
    expect(listed.some((row) => row.id === "zz-r")).toBe(false);
    const inverses = d.filters.filter((f) => f.col === "reverses_entry_id");
    expect(inverses.length).toBeGreaterThan(0);
    // El source/estado/borrado de la pantalla no se aplica a las páginas auxiliares.
    expect(d.reads.filter(auxiliary).every((r) => !r.columns.includes("journal_lines"))).toBe(true);
    expect(d.filters.filter((f) => f.col === "status")).toHaveLength(1);
    expect(d.filters.filter((f) => f.col === "deleted_at")).toHaveLength(1);
  });

  it("más de1000 inversos se pagina y los IDs extra se parten en lotes, sin N+1", async () => {
    const row = entry("m");
    const linked = Array.from({ length: 1001 }, (_, n) => entry(`r-${String(n).padStart(4, "0")}`, { reverses_entry_id: "m" }));
    const d = clientFor([row, ...linked], { serverCap: 19 });
    const [p] = await journalEntryProtections(d.client, [row]);
    expect(p).toMatchObject({ state: "protegido", relation: "inconsistente" });
    expect(d.reads.some((r) => auxiliary(r) && r.from === 1001)).toBe(true);
    expect(d.filters.filter((f) => f.op === "in").every((f) => Array.isArray(f.val) && f.val.length <= 500)).toBe(true);
    expect(d.filters.filter((f) => f.op === "in").length).toBeLessThan(70); // Páginas/lotes, no una consulta por cada reverso.
  });

  it.each([
    ["source ausente", { source: undefined }], ["source ilegible", { source: 7 }],
    ["source ajena al contrato", { source: "desconocida" }], ["tenant ausente", { tenant_id: undefined }],
    ["deleted ausente", { deleted_at: undefined }], ["factura ausente", { invoice_id: undefined }],
    ["backlink ausente", { reverses_entry_id: undefined }], ["backlink ilegible", { reverses_entry_id: 9 }],
  ] as const)("%s nunca se convierte en permiso por coerceEntry", async (_name, patch) => {
    const row = entry("m", patch);
    const d = clientFor([row]);
    const [p] = await journalEntryProtections(d.client, [row]);
    expect(p.state).not.toBe("sin_vinculo_visible");
    const [listed] = await listEntries(d.client);
    expect(listed.protection?.state).not.toBe("sin_vinculo_visible");
  });

  it.each([
    ["factura distinta", { invoice_id: "otra" }], ["tenant distinto observado", { tenant_id: "t2" }],
    ["reverso borrado", { deleted_at: "2026-10-21" }], ["reverso anulado", { status: "anulado" }],
    ["source manual", { source: "manual" }], ["self link", { id: "o", reverses_entry_id: "o" }],
  ] as const)("%s no acredita cabeceras coherentes", async (_name, patch) => {
    const [o, r] = pair();
    const rows = [o, { ...r, ...patch }];
    const d = clientFor(rows);
    const [p] = await journalEntryProtections(d.client, rows);
    expect(p.state).toBe("protegido");
    expect(p.relation).not.toBe("original");
    expect(p.relation).not.toBe("reverso");
  });

  it("varios reversos o un backlink del original son inconsistentes", async () => {
    const [o, r] = pair();
    for (const rows of [[o, r, { ...r, id: "r2" }], [{ ...o, reverses_entry_id: "r" }, r]]) {
      const d = clientFor(rows);
      expect((await journalEntryProtections(d.client, [rows[0]]))[0]).toMatchObject({ state: "protegido", relation: "inconsistente" });
    }
  });

  it.each([false, true])("duplicados contradictorios no eligen la fila favorable, orden invertido=%s", async (reverse) => {
    const rows = [entry("m"), entry("m", { source: "invoice" })];
    if (reverse) rows.reverse();
    const d = clientFor(rows);
    expect((await journalEntryProtections(d.client, [rows[0]]))[0]).toMatchObject({ state: "protegido", relation: "inconsistente" });
  });

  it.each([false, true])("duplicados manuales de distinto estado tampoco autorizan, orden invertido=%s", async (reverse) => {
    const rows = [entry("m"), entry("m", { status: "asentado" })];
    if (reverse) rows.reverse();
    const d = clientFor(rows);
    expect((await journalEntryProtections(d.client, [rows[0]]))[0].state).toBe("no_comprobado");
  });

  it("un extremo no visible no se sustituye por su UUID ni por una pareja inventada", async () => {
    const row = pair()[1];
    const d = clientFor([row]);
    expect((await journalEntryProtections(d.client, [row]))[0]).toEqual({ state: "protegido", reading: "no_comprobada", relation: "no_comprobado" });
  });

  it.each(["42703", "42501", "timeout", "shape"])("auxiliar %s conserva la lista y bloquea, sin borrar evidencia automática", async (kind) => {
    const rows = [entry("m"), pair()[0]];
    const d = clientFor(rows, {}, (read) => {
      if (!auxiliary(read)) return read.response;
      if (kind === "timeout") throw new Error("CENTINELA_PRIVADO");
      if (kind === "shape") return { data: {}, error: null };
      return { data: null, error: { code: kind, message: kind === "42703" ? "column reverses_entry_id does not exist" : "CENTINELA_PRIVADO" } };
    });
    const listed = await listEntries(d.client);
    expect(listed).toHaveLength(2);
    expect(listed.find((r) => r.id === "m")?.protection?.state).toBe("no_comprobado");
    expect(listed.find((r) => r.id === "o")?.protection).toMatchObject({ state: "protegido", reading: "no_comprobada" });
    expect(JSON.stringify(listed)).not.toContain("CENTINELA_PRIVADO");
  });

  it("fallo de segunda página conserva el inverso positivo ya observado", async () => {
    const rows = [entry("m"), entry("r", { reverses_entry_id: "m" })];
    const d = clientFor(rows, { serverCap: 1 }, (read) => auxiliary(read) && read.lookup === "reverses_entry_id" && read.from === 1
      ? { data: null, error: { message: "segunda página" } } : read.response);
    // Fallar sólo después de observar el inverso: se usa el filtro registrado por la consulta real.
    expect((await journalEntryProtections(d.client, [rows[0]]))[0]).toEqual({ state: "protegido", reading: "no_comprobada", relation: "no_comprobado" });
    expect(d.reads.some((r) => r.lookup === "reverses_entry_id" && r.from === 1)).toBe(true);
  });

  it("agotamiento de páginas no presume lectura completa ni sube el máximo", async () => {
    const row = entry("m");
    const d = clientFor([row], {}, (read) => auxiliary(read) ? { data: [row], error: null } : read.response);
    expect((await journalEntryProtections(d.client, [row]))[0].state).toBe("no_comprobado");
    expect(d.reads.filter(auxiliary)).toHaveLength(60);
  });

  it.each(["sin sesión", "disabled", "otro usuario", "error auth"])("%s no aporta contexto autorizado", async (kind) => {
    const row = entry("m");
    const d = clientFor([row]);
    if (kind === "disabled") d.tables.user_tenants[0].disabled_at = "2026-10-21";
    if (kind === "otro usuario") d.tables.user_tenants[0].user_id = "ajeno";
    if (kind === "sin sesión") d.auth.mockResolvedValue({ data: { user: null }, error: null } as never);
    if (kind === "error auth") d.auth.mockRejectedValue(new Error("CENTINELA_PRIVADO"));
    expect((await journalEntryProtections(d.client, [row]))[0].state).toBe("no_comprobado");
    expect(d.filters.some((f) => f.table === "journal_entries")).toBe(false);
  });

  it("detalle cero real es null, uno conserva datos y protección; ambiguo no es ausencia", async () => {
    const d = clientFor(pair(), { serverCap: 1 });
    expect(await getEntryByCode(d.client, "A-2026-9999")).toBeNull();
    expect(await getEntryByCode(d.client, "A-2026-0001")).toMatchObject({ id: "o", entry_code: "A-2026-0001", protection: { state: "protegido", relation: "original" } });
    d.tables.journal_entries.push({ ...pair()[0], id: "otro" });
    await expect(getEntryByCode(d.client, "A-2026-0001")).rejects.toThrow("No se pudo comprobar el asiento");
  });

  it.each(["PGRST116", "shape", "rechazo"])("error base %s no se disfraza de cero visible", async (kind) => {
    const d = clientFor([], {}, (read) => {
      if (read.table !== "journal_entries" || auxiliary(read)) return read.response;
      if (kind === "rechazo") throw new Error("CENTINELA_PRIVADO");
      return kind === "shape" ? { data: null, error: null } : { data: null, error: { code: "PGRST116", message: "CENTINELA_PRIVADO" } };
    });
    await expect(listEntries(d.client)).rejects.toThrow("No se pudo cargar el libro diario");
    await expect(getEntryByCode(d.client, "A-2026-0001")).rejects.toThrow("No se pudo comprobar el asiento");
  });
});
