// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { calcularEnvioLCL } from "@/lib/calculadora";
import { combinarDestinos } from "@/lib/public/rates-queries";
import { updateCityAction } from "../calculator-actions";

const mocks = vi.hoisted(() => ({ client: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/db/server", () => ({ createClient: mocks.client }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/studio/role-module-overrides-queries", () => ({ getRoleModuleOverrides: async () => ({}) }));
vi.mock("@/lib/studio/platform-admin", () => ({ isPlatformAdmin: async () => true }));

const id = "10000000-0000-4000-8000-000000000001";
const initial = { id, tenant_id: "tenant-1", slug: "acarigua", label: "Acarigua", km: 175, casco: true, sort_order: 4, deleted_at: null as string | null };
const invalidFields: Record<string, string>[] = [{ label: "" }, { slug: "Bad Slug!" }, { km: "-1" }];
let row: typeof initial;
let role: string;
let disabled: boolean;
let signedIn: boolean;
let dbError: { code?: string; message: string } | null;
let writes: Record<string, unknown>[];
let filters: [string, unknown][];

function client() {
  return {
    auth: { getUser: async () => ({ data: { user: signedIn ? { id: "user-1" } : null } }) },
    from: (table: string) => {
      const predicates: [string, unknown][] = [];
      let payload: Record<string, unknown> | null = null;
      const query = {
        select: () => query,
        limit: () => query,
        eq: (field: string, value: unknown) => { predicates.push([field, value]); return query; },
        is: (field: string, value: unknown) => { predicates.push([field, value]); return query; },
        update: (value: Record<string, unknown>) => { payload = value; writes.push(value); return query; },
        maybeSingle: async () => {
          if (table === "user_tenants") {
            // Gate real: membresía activa del propio usuario.
            expect(predicates).toContainEqual(["disabled_at", null]);
            expect(predicates).toContainEqual(["user_id", "user-1"]);
            return { data: disabled ? null : { tenant_id: "tenant-1", role, warehouse_scope: "all" } };
          }
          expect(table).toBe("calculator_cities");
          filters = predicates;
          if (dbError) return { data: null, error: dbError };
          if (!predicates.every(([key, value]) => row[key as keyof typeof row] === value)) return { data: null, error: null };
          Object.assign(row, payload);
          return { data: { id }, error: null };
        },
      };
      return query;
    },
  };
}
function form(included = false, values: Record<string, string> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ slug: initial.slug, label: initial.label, km: String(initial.km), sort_order: String(initial.sort_order), ...values })) data.set(key, value);
  // Casilla nativa: marcada envía on; desmarcada omite el campo.
  if (included) data.set("casco", "on");
  return data;
}

describe("updateCityAction original: entrega incluida con gate real y persistencia simulada", () => {
  beforeEach(() => {
    row = { ...initial }; role = "admin"; disabled = false; signedIn = true; dbError = null; writes = []; filters = [];
    mocks.client.mockReset(); mocks.client.mockResolvedValue(client()); mocks.revalidate.mockReset();
  });
  it("desmarcar persiste false y cobra entrega; marcar persiste true y devuelve recargo cero", async () => {
    expect(await updateCityAction(id, {}, form())).toEqual({ ok: true });
    expect(writes).toEqual([{ slug: initial.slug, label: initial.label, km: initial.km, casco: false, sort_order: initial.sort_order }]);
    expect(row).toEqual({ ...initial, casco: false });
    expect(filters).toEqual([["id", id], ["tenant_id", "tenant-1"], ["deleted_at", null]]);
    const quote = () => calcularEnvioLCL(
      { cbmTotal: 1, pesoKg: 100, embalaje: "estandar", ciudadId: row.slug },
      undefined, combinarDestinos([{ id: row.slug, label: row.label, km: row.km, casco: row.casco }], []),
    );
    expect(quote().total).toBe(973.6);
    expect(await updateCityAction(id, {}, form(true))).toEqual({ ok: true });
    expect(row.casco).toBe(true);
    expect(quote().total).toBe(850);
    expect(mocks.revalidate.mock.calls.map(([path]) => path)).toEqual([
      "/studio/admin", "/tarifas", "/tarifas/embed", "/studio/admin", "/tarifas", "/tarifas/embed",
    ]);
  });
  it.each(["ventas", "operaciones", "cliente"])("rechaza no-admin %s antes de escribir", async (value) => {
    role = value;
    expect((await updateCityAction(id, {}, form())).error).toBeTruthy();
    expect(writes).toEqual([]);
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("rechaza admin suspendido (disabled_at) antes de escribir", async () => {
    disabled = true;
    expect((await updateCityAction(id, {}, form())).error).toBeTruthy();
    expect(writes).toEqual([]);
  });
  it("rechaza sesión ausente", async () => {
    signedIn = false;
    expect((await updateCityAction(id, {}, form())).error).toBeTruthy();
    expect(writes).toEqual([]);
  });
  it.each(invalidFields)("conserva validación antes de guardar %j", async (values) => {
    expect((await updateCityAction(id, {}, form(false, values))).fieldErrors).toBeTruthy();
    expect(writes).toEqual([]);
    expect(row).toEqual(initial);
  });
  it.each(["tenant", "deleted", "missing"])("cero filas por %s nunca anuncia éxito", async (reason) => {
    if (reason === "tenant") row.tenant_id = "tenant-other";
    if (reason === "deleted") row.deleted_at = "2026-10-08";
    if (reason === "missing") row.id = "10000000-0000-4000-8000-000000000099";
    expect((await updateCityAction(id, {}, form())).error).toMatch(/no está disponible/);
    expect(row.casco).toBe(true);
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("error DB conserva estado sin exponer diagnóstico interno", async () => {
    dbError = { message: "SQL secret" };
    const result = await updateCityAction(id, {}, form());
    expect(result.error).toMatch(/selección se conserva.*intenta de nuevo/);
    expect(result.error).not.toContain("SQL");
    expect(row.casco).toBe(true);
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("conflicto de identificador conserva el mensaje comercial original", async () => {
    dbError = { code: "23505", message: "SQL unique constraint" };
    expect((await updateCityAction(id, {}, form())).error).toMatch(/Ya existe una ciudad/);
    expect(row.casco).toBe(true);
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("fallo de conexión no confirma ni expone un error interno", async () => {
    mocks.client.mockRejectedValueOnce(new Error("internal connection secret"));
    const result = await updateCityAction(id, {}, form());
    expect(result.error).toMatch(/intenta de nuevo/);
    expect(result.error).not.toContain("secret");
    expect(writes).toEqual([]);
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
});
