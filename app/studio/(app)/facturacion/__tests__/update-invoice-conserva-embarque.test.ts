/**
 * SDD-0555 · `updateInvoice` persiste el `shipmentCode` de cada línea.
 *
 * Es el último tramo del camino de edición: el drawer manda las líneas en el
 * input `lines` (JSON), la action las parsea (`parseLines` → `normalizeLines`),
 * las valida (`validateInvoiceInput`) y hace el UPDATE. Si cualquiera de esos
 * pasos suelta el código, el Portal pierde la lista de embarques de la factura.
 *
 * El doble de Supabase registra el UPDATE para afirmar lo que se persiste.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/studio/rbac-guard", () => ({ moduleEditDenial: vi.fn(async () => null) }));
// Las importa el módulo de actions; se aíslan para no depender de entorno ni de correo.
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/studio/mail/mail-rule-engine", () => ({ fireMailEvent: vi.fn() }));
vi.mock("@/lib/studio/fiscal/queries", () => ({
  getFiscalSettingsSafe: vi.fn(async () => ({
    fiscal_module_enabled: false,
    default_invoice_iva_mode: "sin_iva",
    iva_rate_general: 16,
  })),
}));

type Write = { table: string; values: Record<string, unknown>; conds: [string, unknown][] };
let writes: Write[] = [];
let status = "borrador";

function makeClient() {
  return {
    from(table: string) {
      let pending: Write | null = null;
      const chain = {
        select: () => chain,
        eq(col: string, val: unknown) {
          if (pending) pending.conds.push([col, val]);
          return chain;
        },
        update(values: Record<string, unknown>) {
          pending = { table, values, conds: [] };
          writes.push(pending);
          return chain;
        },
        maybeSingle: async () => {
          if (table === "invoices") {
            return { data: { status, invoice_code: "F-2026-0555", tenant_id: "t1" }, error: null };
          }
          if (table === "tenants") return { data: { iva_enabled: false }, error: null };
          throw new Error(`lectura inesperada en ${table}`);
        },
        // El UPDATE se espera directo (`await supabase.from().update().eq()`).
        then(resolve: (v: { error: null }) => void) {
          resolve({ error: null });
        },
      };
      return chain;
    },
  };
}

vi.mock("@/lib/db/server", () => ({ createClient: async () => makeClient() }));

const { updateInvoice } = await import("../actions");

/** Lo que manda el drawer: dos embarques, un exceso del primero y una línea a mano. */
function formDelDrawer(): FormData {
  const fd = new FormData();
  fd.set("client_markbox", "DTD-1001");
  fd.set("client_name", "Cliente de prueba");
  fd.set("currency", "USD");
  fd.set(
    "lines",
    JSON.stringify([
      { desc: "Flete DDP · ENV-PRUEBA-01 · 1.5 m³ × $100", qty: 1.5, unitPrice: 100, shipmentCode: "ENV-PRUEBA-01" },
      { desc: "Flete DDP · ENV-PRUEBA-02 · 2 m³ × $100", qty: 2, unitPrice: 95, shipmentCode: " ENV-PRUEBA-02 " },
      { desc: "Exceso de peso · ENV-PRUEBA-01 · cajas · 30 kg × $1", qty: 30, unitPrice: 1, shipmentCode: "ENV-PRUEBA-01" },
      { desc: "Seguro", qty: 1, unitPrice: 12 },
    ]),
  );
  return fd;
}

beforeEach(() => {
  writes = [];
  status = "borrador";
});

describe("updateInvoice · líneas con embarque", () => {
  it("el UPDATE de invoices lleva el shipmentCode de cada línea, recortado", async () => {
    const res = await updateInvoice("inv-0555", {}, formDelDrawer());
    expect(res).toEqual({ ok: true });

    const update = writes.find((w) => w.table === "invoices");
    expect(update?.conds).toContainEqual(["id", "inv-0555"]);
    const lines = update?.values.lines as Record<string, unknown>[];
    expect(lines.map((l) => l.shipmentCode)).toEqual([
      "ENV-PRUEBA-01",
      "ENV-PRUEBA-02",
      "ENV-PRUEBA-01",
      undefined,
    ]);
    expect(lines[3]).not.toHaveProperty("shipmentCode");
    // 1.5 × 100 + 2 × 95 + 30 × 1 + 1 × 12: la línea a mano también suma.
    expect(update?.values.base_amount).toBe(382);
  });

  it("una factura que ya no es borrador no se escribe", async () => {
    status = "emitida";
    const res = await updateInvoice("inv-0555", {}, formDelDrawer());
    expect(res).toEqual({ error: "Solo las facturas en borrador pueden editarse." });
    expect(writes).toHaveLength(0);
  });
});
