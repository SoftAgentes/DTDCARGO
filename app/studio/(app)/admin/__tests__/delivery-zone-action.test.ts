// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { calcularEnvioLCL } from "@/lib/calculadora";
import { combinarDestinos } from "@/lib/public/rates-queries";
import { saveDeliveryZoneAction } from "../calculator-actions";

const mocks = vi.hoisted(() => ({ client: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/db/server", () => ({ createClient: mocks.client }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/studio/role-module-overrides-queries", () => ({ getRoleModuleOverrides: async () => ({}) }));
vi.mock("@/lib/studio/platform-admin", () => ({ isPlatformAdmin: async () => true }));

const id = "10000000-0000-4000-8000-000000000001";
const initial = { id, tenant_id: "tenant-1", slug: "acarigua", label: "Acarigua", km: 175, casco: true, sort_order: 4, deleted_at: null as string | null };
let row: typeof initial;
let role: string;
let disabled: boolean;
let signedIn: boolean;
let dbError: boolean;
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
            // Ejecuta el gate real: exige filtro disabled_at y user_id.
            expect(predicates).toContainEqual(["disabled_at", null]);
            expect(predicates).toContainEqual(["user_id", "user-1"]);
            return { data: disabled ? null : { tenant_id: "tenant-1", role, warehouse_scope: "all" } };
          }
          expect(table).toBe("calculator_cities");
          filters = predicates;
          if (dbError) return { data: null, error: { message: "SQL secret" } };
          if (!predicates.every(([key, value]) => row[key as keyof typeof row] === value)) return { data: null, error: null };
          Object.assign(row, payload);
          return { data: { id }, error: null };
        },
      };
      return query;
    },
  };
}
function form(casco = "false", previous = "true") {
  const data = new FormData();
  data.set("casco", casco);
  data.set("previousCasco", previous);
  return data;
}

describe("saveDeliveryZoneAction con gate real y persistencia simulada", () => {
  beforeEach(() => {
    row = { ...initial }; role = "admin"; disabled = false; signedIn = true; dbError = false; writes = []; filters = [];
    mocks.client.mockReset(); mocks.client.mockResolvedValue(client()); mocks.revalidate.mockReset();
  });
  it("persiste sólo casco y el cálculo final cobra tarifa; reincluir restaura el precio base", async () => {
    expect(await saveDeliveryZoneAction(id, {}, form())).toEqual({ ok: true });
    expect(writes).toEqual([{ casco: false }]);
    expect(row).toEqual({ ...initial, casco: false });
    expect(filters).toEqual([["id", id], ["tenant_id", "tenant-1"], ["deleted_at", null], ["casco", true]]);
    const quote = () => calcularEnvioLCL(
      { cbmTotal: 1, pesoKg: 100, embalaje: "estandar", ciudadId: row.slug },
      undefined, combinarDestinos([{ id: row.slug, label: row.label, km: row.km, casco: row.casco }], []),
    );
    expect(quote().total).toBe(973.6);
    expect(await saveDeliveryZoneAction(id, {}, form("true", "false"))).toEqual({ ok: true });
    expect(quote().total).toBe(850);
    expect(mocks.revalidate).toHaveBeenCalledWith("/tarifas/embed");
  });
  it.each(["ventas", "operaciones", "cliente"])("rechaza no-admin %s antes de escribir", async (value) => {
    role = value;
    expect((await saveDeliveryZoneAction(id, {}, form())).error).toBeTruthy();
    expect(writes).toEqual([]);
  });
  it("rechaza admin suspendido (disabled_at) antes de escribir", async () => {
    disabled = true;
    expect((await saveDeliveryZoneAction(id, {}, form())).error).toBeTruthy();
    expect(writes).toEqual([]);
  });
  it("rechaza sesión ausente", async () => {
    signedIn = false;
    expect((await saveDeliveryZoneAction(id, {}, form())).error).toBeTruthy();
    expect(writes).toEqual([]);
  });
  it.each(["invalid", "", "on"])("rechaza estado inválido %s", async (value) => {
    expect((await saveDeliveryZoneAction(id, {}, form(value))).error).toBeTruthy();
    expect(writes).toEqual([]);
  });
  it.each(["tenant", "deleted", "concurrent"])("cero filas por %s nunca anuncia éxito", async (reason) => {
    if (reason === "tenant") row.tenant_id = "tenant-other";
    if (reason === "deleted") row.deleted_at = "2026-10-08";
    if (reason === "concurrent") row.casco = false;
    expect((await saveDeliveryZoneAction(id, {}, form())).error).toMatch(/cambió|disponible/);
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("error DB conserva estado y no expone diagnóstico interno", async () => {
    dbError = true;
    const result = await saveDeliveryZoneAction(id, {}, form());
    expect(result.error).toMatch(/intenta de nuevo/);
    expect(result.error).not.toContain("SQL");
    expect(row.casco).toBe(true);
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
});
