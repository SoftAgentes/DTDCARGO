/**
 * SDD-0560 · Las acciones del asistente de borrado.
 *
 *   · sólo admin (`delete_shipments`), ANTES de leer o tocar nada;
 *   · el plan se recalcula en el servidor antes de cada paso, y sólo se ejecuta
 *     el paso SIGUIENTE de ese plan (dos personas a la vez: el segundo no
 *     ejecuta un paso viejo);
 *   · cada paso va a la acción de SU módulo, con el motivo validado;
 *   · después de un paso se devuelve el plan nuevo.
 *
 * El plan se arma con `calcularPlan` real; lo que se dobla es la lectura (para
 * elegir qué ve el servidor en cada llamada) y las acciones de los módulos.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { STUDIO_USER_ROLES, type StudioUserRole } from "@/lib/studio/user-types";
import { supabaseDouble, type MembershipRow } from "@/lib/studio/__tests__/user-tenants-double";
import { calcularPlan, type EntradaPlan, type PlanBorrado } from "@/lib/studio/borrado/asistente";

const S = "11111111-1111-4111-8111-111111111111";
const F = "33333333-3333-4333-8333-333333333333";
const DENIAL = "No tienes permiso para realizar esta acción.";

const m = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  leerPlanDeBorrado: vi.fn(),
  voidInvoice: vi.fn(),
  softDeleteInvoice: vi.fn(),
  voidExpenseAction: vi.fn(),
  voidBill: vi.fn(),
  eliminarEmbarques: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: (u: string) => m.revalidatePath(u) }));
vi.mock("@/lib/studio/role-module-overrides-queries", () => ({ getRoleModuleOverrides: async () => ({}) }));
vi.mock("@/lib/studio/borrado/asistente-servidor", () => ({
  leerPlanDeBorrado: (...a: unknown[]) => m.leerPlanDeBorrado(...a),
}));
vi.mock("@/lib/studio/borrado/servidor", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/studio/borrado/servidor")>()),
  eliminarEmbarques: (...a: unknown[]) => m.eliminarEmbarques(...a),
}));
vi.mock("@/app/studio/(app)/facturacion/actions", () => ({
  voidInvoice: (...a: unknown[]) => m.voidInvoice(...a),
  softDeleteInvoice: (...a: unknown[]) => m.softDeleteInvoice(...a),
}));
vi.mock("@/app/studio/(app)/gastos/actions", () => ({
  voidExpenseAction: (...a: unknown[]) => m.voidExpenseAction(...a),
}));
vi.mock("@/app/studio/(app)/tesoreria/actions", () => ({
  voidBill: (...a: unknown[]) => m.voidBill(...a),
}));

let memberships: MembershipRow[] = [];
let cliente: unknown;
vi.mock("@/lib/db/server", () => ({
  createClient: async () => {
    cliente = supabaseDouble({ userId: "user-1", memberships }).client;
    return cliente;
  },
}));

const { leerPlanDeBorradoAction, ejecutarPasoDeBorradoAction } = await import("../actions");

const membresia = (role: StudioUserRole): MembershipRow => ({ user_id: "user-1", tenant_id: "tn-1", role, disabled_at: null });

function plan(bloqueos: Record<string, number>, extra: Partial<EntradaPlan> = {}): PlanBorrado {
  return calcularPlan({
    embarque: { id: S, codigo: "S-2026-0042" },
    info: { bloqueos, avisos: {} },
    facturas: [],
    gastos: [],
    cxp: [],
    rutas: [],
    consolidaciones: [],
    recepciones: [],
    compras: [],
    ...extra,
  });
}
const conFactura = (estado = "emitida", asientoVivo: boolean | null = false) =>
  plan({ invoices: 1 }, { facturas: [{ id: F, codigo: "F-2026-0007", estado, pagado: 0, asientoVivo }] });
const soloEmbarque = () => plan({});

/** Lo que el servidor «ve» en cada lectura, en orden. */
function planes(...secuencia: PlanBorrado[]) {
  for (const p of secuencia) m.leerPlanDeBorrado.mockResolvedValueOnce(p);
}

const ninguna = () => {
  for (const f of [m.voidInvoice, m.softDeleteInvoice, m.voidExpenseAction, m.voidBill, m.eliminarEmbarques]) {
    expect(f).not.toHaveBeenCalled();
  }
};

beforeEach(() => {
  vi.clearAllMocks();
  m.leerPlanDeBorrado.mockReset();
  memberships = [membresia("admin")];
  m.voidInvoice.mockResolvedValue({ ok: true });
  m.softDeleteInvoice.mockResolvedValue({ ok: true });
  m.voidExpenseAction.mockResolvedValue({ ok: true, outcome: "voided" });
  m.voidBill.mockResolvedValue({ ok: true });
  m.eliminarEmbarques.mockResolvedValue({ estado: "eliminado", codigos: ["S-2026-0042"] });
});

describe("sólo admin, antes de todo", () => {
  it.each(STUDIO_USER_ROLES.filter((r) => r !== "admin"))("rol %s: ni lee el plan ni ejecuta", async (rol) => {
    memberships = [membresia(rol)];
    expect(await leerPlanDeBorradoAction(S)).toEqual({ ok: false, error: DENIAL });
    expect(await ejecutarPasoDeBorradoAction(S, `anular_factura:${F}`, "Embarque de prueba")).toEqual({
      ok: false,
      error: DENIAL,
      plan: null,
    });
    expect(m.leerPlanDeBorrado).not.toHaveBeenCalled();
    ninguna();
  });

  it("un id que no es uuid no llega a la base", async () => {
    expect(await leerPlanDeBorradoAction("S-2026-0042")).toEqual({
      ok: false,
      error: "Este embarque no es válido. Recarga la página.",
    });
    expect(m.leerPlanDeBorrado).not.toHaveBeenCalled();
  });

  it("admin: lee el plan con su propio cliente de sesión", async () => {
    planes(conFactura());
    const r = await leerPlanDeBorradoAction(S);
    expect(r).toEqual({ ok: true, plan: conFactura() });
    expect(m.leerPlanDeBorrado).toHaveBeenCalledWith(cliente, S);
  });
});

describe("el plan se recalcula antes de cada paso", () => {
  it("si el paso pedido ya no es el siguiente, no ejecuta y devuelve el plan nuevo", async () => {
    // La pantalla creía que tocaba anular la factura; otra persona ya lo hizo.
    planes(soloEmbarque());
    const r = await ejecutarPasoDeBorradoAction(S, `anular_factura:${F}`, "Embarque de prueba");
    expect(r).toEqual({
      ok: false,
      error:
        "El plan cambió mientras lo revisabas: alguien más resolvió o agregó algo. Revisa el paso siguiente antes de seguir.",
      plan: soloEmbarque(),
    });
    ninguna();
  });

  it("si el plan se bloqueó (apareció un asiento vivo), no anula la factura", async () => {
    planes(conFactura("emitida", true));
    const r = await ejecutarPasoDeBorradoAction(S, `anular_factura:${F}`, "Embarque de prueba");
    expect(r.ok).toBe(false);
    expect(r).toHaveProperty("plan.estado", "bloqueado");
    ninguna();
  });

  it("no se puede saltar al último paso: eliminar el embarque con una factura pendiente", async () => {
    planes(conFactura());
    const r = await ejecutarPasoDeBorradoAction(S, `eliminar_embarque:${S}`, "Embarque de prueba");
    expect(r).toMatchObject({ ok: false, plan: conFactura() });
    ninguna();
  });

  it("un paso de otro módulo no lo ejecuta el asistente", async () => {
    const enTms = plan({ tms_routes: 1 }, { rutas: [{ id: "r-1", codigo: "R-1", estado: "planificado" }] });
    planes(enTms);
    const r = await ejecutarPasoDeBorradoAction(S, "modulo:tms_routes", "x");
    expect(r).toEqual({
      ok: false,
      error: "Este paso se hace en su módulo. Cuando lo termines, vuelve a revisar el plan.",
      plan: enTms,
    });
    ninguna();
  });

  it.each([
    ["no_disponible", { ...soloEmbarque(), estado: "no_disponible" } as PlanBorrado],
    ["ya_eliminado", { ...soloEmbarque(), estado: "ya_eliminado" } as PlanBorrado],
  ])("plan %s: no ejecuta", async (_e, p) => {
    planes(p);
    expect((await ejecutarPasoDeBorradoAction(S, `eliminar_embarque:${S}`, "Embarque de prueba")).ok).toBe(false);
    ninguna();
  });
});

describe("el motivo", () => {
  it.each(["", "   ", "abc", "x".repeat(1001)])("R3 con motivo %j: no ejecuta", async (motivo) => {
    planes(conFactura());
    const r = await ejecutarPasoDeBorradoAction(S, `anular_factura:${F}`, motivo);
    expect(r.ok).toBe(false);
    ninguna();
  });

  it("el borrador (R2) no pide motivo y no lo manda", async () => {
    planes(conFactura("borrador"), soloEmbarque());
    const r = await ejecutarPasoDeBorradoAction(S, `eliminar_borrador_factura:${F}`, "");
    expect(r).toMatchObject({ ok: true, hecho: "Factura en borrador F-2026-0007 eliminada.", eliminado: false });
    expect(m.softDeleteInvoice).toHaveBeenCalledWith(F);
  });
});

describe("cada paso usa la acción de su módulo", () => {
  it("anular factura: voidInvoice con el motivo recortado; devuelve el plan nuevo y revalida", async () => {
    planes(conFactura(), soloEmbarque());
    const r = await ejecutarPasoDeBorradoAction(S, `anular_factura:${F}`, "  Embarque de prueba  ");
    expect(m.voidInvoice).toHaveBeenCalledWith(F, "Embarque de prueba");
    expect(m.leerPlanDeBorrado).toHaveBeenCalledTimes(2);
    expect(r).toEqual({ ok: true, hecho: "Factura F-2026-0007 anulada.", eliminado: false, plan: soloEmbarque() });
    expect(m.revalidatePath).toHaveBeenCalledWith(`/studio/tracking/${S}`);
    expect(m.revalidatePath).toHaveBeenCalledWith("/studio/embarques");
  });

  it("el aviso del módulo (créditos de referido) sube con el éxito", async () => {
    m.voidInvoice.mockResolvedValue({ ok: true, warning: "Revisa los créditos de referido." });
    planes(conFactura(), soloEmbarque());
    expect(await ejecutarPasoDeBorradoAction(S, `anular_factura:${F}`, "Embarque de prueba")).toHaveProperty(
      "aviso",
      "Revisa los créditos de referido.",
    );
  });

  it("anular gasto: voidExpenseAction con referencia estable por gasto", async () => {
    const g = "44444444-4444-4444-8444-444444444444";
    planes(plan({ expenses: 1 }, { gastos: [{ id: g, codigo: "EXP-2026-0001" }] }), soloEmbarque());
    await ejecutarPasoDeBorradoAction(S, `anular_gasto:${g}`, "Embarque de prueba");
    expect(m.voidExpenseAction).toHaveBeenCalledWith(g, "Embarque de prueba", `asistente-borrado:${g}`);
  });

  it("anular CxP: voidBill", async () => {
    const c = "55555555-5555-4555-8555-555555555555";
    planes(plan({ supplier_bills: 1 }, { cxp: [{ id: c, codigo: "CXP-1", estado: "pendiente", pagado: 0 }] }), soloEmbarque());
    await ejecutarPasoDeBorradoAction(S, `anular_cxp:${c}`, "Embarque de prueba");
    expect(m.voidBill).toHaveBeenCalledWith(c, "Embarque de prueba");
  });

  it("eliminar el embarque: la RPC de la 0476, con el cliente de sesión; ya no hay plan", async () => {
    planes(soloEmbarque());
    const r = await ejecutarPasoDeBorradoAction(S, `eliminar_embarque:${S}`, "Embarque de prueba");
    expect(m.eliminarEmbarques).toHaveBeenCalledWith(cliente, [S], "Embarque de prueba");
    expect(r).toEqual({
      ok: true,
      hecho: "Embarque S-2026-0042 eliminado. Ya no aparece en Embarques, Tracking ni el Portal.",
      eliminado: true,
      plan: null,
    });
    expect(m.leerPlanDeBorrado).toHaveBeenCalledTimes(1);
  });

  it("si la base rechaza el borrado del embarque, lo dice con el motivo de la 0522", async () => {
    m.eliminarEmbarques.mockResolvedValue({
      estado: "rechazado",
      bloqueadas: [{ id: S, codigo: "S-2026-0042", outcome: "blocked", bloqueos: { expenses: 1 } }],
      noEncontradas: 0,
    });
    planes(soloEmbarque(), soloEmbarque());
    const r = await ejecutarPasoDeBorradoAction(S, `eliminar_embarque:${S}`, "Embarque de prueba");
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining("tiene 1 gasto (Gastos)") });
  });

  it("si el módulo rechaza, el error es el del módulo y vuelve el plan como quedó", async () => {
    m.voidInvoice.mockResolvedValue({ error: "No se puede anular una factura ya pagada." });
    planes(conFactura(), conFactura());
    const r = await ejecutarPasoDeBorradoAction(S, `anular_factura:${F}`, "Embarque de prueba");
    expect(r).toEqual({ ok: false, error: "No se puede anular una factura ya pagada.", plan: conFactura() });
    expect(m.revalidatePath).not.toHaveBeenCalled();
  });
});
