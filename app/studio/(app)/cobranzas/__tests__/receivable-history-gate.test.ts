/**
 * Gate de VISTA de `getReceivableHistory` (SDD-0497).
 *
 * Gemelo exacto del `getBillHistory` de Tesorería que cerró SDD-0494: era la
 * única de las ocho acciones de `cobranzas/actions.ts` sin candado, y una server
 * action es un endpoint invocable directo — el `requireModuleView` del layout
 * protege la página, no esto. La RLS tampoco compensa: `payment_receipts_team_select`
 * (0470:186-191) y `"collection_activities by tenant"` (0079:151-155) sólo
 * comparan `tenant_id`, sin predicado de rol.
 *
 * Se usan el guard y la matriz REALES (`rbac-guard.ts` + `rbac.ts`); sólo se
 * reemplazan los bordes: sesión, overrides por rol y los dos lectores. Así el
 * test se pone rojo también si el guard pregunta por otro módulo o si queda
 * DESPUÉS de leer los recibos.
 *
 * UN CAMBIO DE PERMISOS SE PRUEBA POR EL LADO NEGATIVO: lo que importa no es
 * que devuelva un mensaje, sino que al rol sin permiso no se le lea ni un recibo.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { STUDIO_USER_ROLES, type StudioUserRole } from "@/lib/studio/user-types";

const TENANT = "tn-1";
const INVOICE = "inv-1";
const DENIAL = "No tienes permiso para ver esto.";

const RECIBOS = [
  { id: "rc-1", receipt_code: "RC-2026-0001", amount: 1500, method: "transferencia" },
];
const GESTIONES = [{ id: "ca-1", kind: "contacto", body: "Llamado al cliente" }];

const listReceiptsMock = vi.fn();
const listActivitiesMock = vi.fn();
// SDD-0622: los accesos adicionales de la persona se leen aparte, como los
// desvíos por rol; aquí no son el objeto de la prueba.
vi.mock("@/lib/studio/user-module-grants-queries", () => ({
  getMyModuleGrants: async () => ({}),
}));
vi.mock("@/lib/studio/payment-queries", () => ({
  listReceipts: (...a: unknown[]) => listReceiptsMock(...a),
  listActivities: (...a: unknown[]) => listActivitiesMock(...a),
  // `cobranzas/actions.ts` también importa `receivablesQueue` en el tope del
  // módulo (lo usan los recordatorios); sin esto el import del archivo revienta.
  receivablesQueue: vi.fn(),
}));

let overrides: Record<string, { view: boolean; edit: boolean }> = {};
vi.mock("@/lib/studio/role-module-overrides-queries", () => ({
  getRoleModuleOverrides: async () => overrides,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => ({}) }));

// ── Cliente de la sesión ──────────────────────────────────────
let sessionUser: { id: string } | null = null;
let role: StudioUserRole | null = null;
/** Tablas leídas con la sesión: acá se ve si el gate quedó antes o después. */
const sessionReads: string[] = [];

type Query = {
  select: () => Query;
  eq: () => Query;
  is: () => Query;
  limit: () => Query;
  maybeSingle: () => Promise<{ data: unknown; error: null }>;
};

function sessionClient() {
  return {
    auth: { getUser: async () => ({ data: { user: sessionUser } }) },
    from(table: string) {
      sessionReads.push(table);
      const row =
        table === "user_tenants" && role ? { tenant_id: TENANT, role } : null;
      const query: Query = {
        select: () => query,
        eq: () => query,
        is: () => query,
        limit: () => query,
        maybeSingle: async () => ({ data: row, error: null }),
      };
      return query;
    },
  };
}

vi.mock("@/lib/db/server", () => ({ createClient: async () => sessionClient() }));

const { getReceivableHistory } = await import("../actions");

beforeEach(() => {
  vi.clearAllMocks();
  sessionReads.length = 0;
  overrides = {};
  sessionUser = { id: "user-1" };
  role = "accounting";
  listReceiptsMock.mockResolvedValue(RECIBOS);
  listActivitiesMock.mockResolvedValue(GESTIONES);
});

function expectNadaLeido() {
  expect(listReceiptsMock).not.toHaveBeenCalled();
  expect(listActivitiesMock).not.toHaveBeenCalled();
}

/**
 * `collections` es módulo de DINERO: la matriz lo reserva a `accounting`
 * (+admin implícito). Los otros cinco roles no lo ven.
 */
const ROLES_SIN_COBRANZAS = STUDIO_USER_ROLES.filter(
  (r) => r !== "admin" && r !== "accounting",
);

describe("getReceivableHistory · lado negativo", () => {
  it.each(ROLES_SIN_COBRANZAS)(
    "rol %s: recibe la denegación y NO los recibos",
    async (r) => {
      role = r;

      const res = await getReceivableHistory(INVOICE);

      expect(res.error).toBe(DENIAL);
      expect(res.receipts).toEqual([]);
      expect(res.activities).toEqual([]);
      expectNadaLeido();
    },
  );

  it("sin sesión tampoco lee nada", async () => {
    sessionUser = null;
    role = null;

    const res = await getReceivableHistory(INVOICE);

    expect(res.error).toBe(DENIAL);
    expect(res.receipts).toEqual([]);
    expectNadaLeido();
  });

  it("un miembro desactivado con JWT vivo tampoco pasa", async () => {
    // `getStudioAccess` filtra por `disabled_at is null` (0200); el doble
    // devuelve la fila sólo cuando hay rol, así que un rol nulo modela al
    // desactivado igual que la query real.
    role = null;

    const res = await getReceivableHistory(INVOICE);

    expect(res.error).toBe(DENIAL);
    expectNadaLeido();
  });

  it("un override por rol no abre Cobranzas: el módulo es LOCKED (dinero)", async () => {
    role = "commercial";
    overrides = { "commercial:collections": { view: true, edit: true } };

    const res = await getReceivableHistory(INVOICE);

    expect(res.error).toBe(DENIAL);
    expectNadaLeido();
  });
});

describe("getReceivableHistory · lado positivo", () => {
  it("accounting recibe recibos y gestiones, sin campo de error", async () => {
    const res = await getReceivableHistory(INVOICE);

    expect(res.error).toBeUndefined();
    expect(res.receipts).toEqual(RECIBOS);
    expect(res.activities).toEqual(GESTIONES);
    expect(listReceiptsMock).toHaveBeenCalledWith(expect.anything(), {
      invoiceId: INVOICE,
    });
    expect(listActivitiesMock).toHaveBeenCalledWith(expect.anything(), INVOICE);
  });

  it("admin también, aunque no figure en la matriz", async () => {
    role = "admin";

    const res = await getReceivableHistory(INVOICE);

    expect(res.error).toBeUndefined();
    expect(res.receipts).toEqual(RECIBOS);
  });

  it("el gate corre ANTES de leer: sólo se consultó user_tenants", async () => {
    role = "operations";

    await getReceivableHistory(INVOICE);

    // Si el candado se moviera después de los lectores, este assert seguiría
    // verde pero el de `expectNadaLeido` no: los dos juntos fijan el orden.
    expect(sessionReads).toEqual(["user_tenants"]);
  });
});
