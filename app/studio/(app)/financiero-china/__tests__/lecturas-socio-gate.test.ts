/**
 * Gate de VISTA de `getSupplierFinance` y `getStatementDetail` (SDD-0497).
 *
 * Las dos únicas acciones de `financiero-china/actions.ts` sin candado: sólo
 * llamaban a `resolveTenant`. Exponen saldo del socio, libro mayor, cargos y
 * estados de cuenta de un módulo que la matriz deja en `[]` — admin solamente,
 * y además dentro de SUPERADMIN_ONLY_MODULES.
 *
 * Las policies de las tablas del socio (`supplier_charges`,
 * `partner_ledger_entries` en 0114:470-499; `partner_statements`,
 * `partner_statement_lines` en 0115:304-316) son FOR ALL `to authenticated` y
 * su `using` sólo compara `tenant_id`: sin predicado de rol, así que la RLS no
 * compensaba nada. La cabecera de `0356_superadmin_legal_renditions_gate.sql:16-22`
 * daba por hecho un gate de app que en estas dos funciones no existía.
 *
 * Se usan el guard, la matriz y `isPlatformAdmin` REALES; sólo se reemplazan los
 * bordes: sesión (incluida la RPC `is_platform_admin`), overrides y los lectores.
 * El test cubre los DOS candados por separado — el de rol y el de
 * superadministrador — porque un admin del tenant que no opera la plataforma
 * tampoco debe pasar.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { STUDIO_USER_ROLES, type StudioUserRole } from "@/lib/studio/user-types";

const TENANT = "tn-1";
const SUPPLIER = "sup-1";
const STATEMENT = "stm-1";
const DENIAL_ROL = "No tienes permiso para ver esto.";
const DENIAL_SUPER =
  "Esto lo reserva el superadministrador. Pídeselo a quien administra el sistema.";

const BALANCE = { supplier_id: SUPPLIER, net_usd: -4200 };
const ENTRIES = [{ id: "le-1", amount_usd: 4200 }];
const CHARGES = [{ id: "ch-1", net_usd: 4200 }];
const STATEMENT_ROW = { id: STATEMENT, supplier_id: SUPPLIER, lines: [] };

const getPartnerBalanceMock = vi.fn();
const listLedgerEntriesMock = vi.fn();
const listChargesMock = vi.fn();
const getStatementWithLinesMock = vi.fn();

vi.mock("@/lib/studio/partner-finance/ledger-queries", () => ({
  getPartnerBalance: (...a: unknown[]) => getPartnerBalanceMock(...a),
  listLedgerEntries: (...a: unknown[]) => listLedgerEntriesMock(...a),
}));
vi.mock("@/lib/studio/partner-finance/charges-queries", () => ({
  listCharges: (...a: unknown[]) => listChargesMock(...a),
  addCharge: vi.fn(),
  applyCreditNote: vi.fn(),
  transitionChargeStatus: vi.fn(),
}));
vi.mock("@/lib/studio/partner-finance/statements-queries", () => ({
  getStatementWithLines: (...a: unknown[]) => getStatementWithLinesMock(...a),
  addStatementLines: vi.fn(),
  applyMatchDecision: vi.fn(),
  closeStatement: vi.fn(),
  createStatement: vi.fn(),
}));

let overrides: Record<string, { view: boolean; edit: boolean }> = {};
vi.mock("@/lib/studio/role-module-overrides-queries", () => ({
  getRoleModuleOverrides: async () => overrides,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// ── Cliente de la sesión ──────────────────────────────────────
let sessionUser: { id: string } | null = null;
let role: StudioUserRole | null = null;
let platformAdmin = false;
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
    // `isPlatformAdmin` va por RPC, no por SELECT (platform-admin.ts:38-45):
    // modelarla acá deja correr el helper real en vez de mockear el módulo.
    rpc: async (fn: string) =>
      fn === "is_platform_admin"
        ? { data: platformAdmin, error: null }
        : { data: null, error: null },
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

const { getSupplierFinance, getStatementDetail } = await import("../actions");

beforeEach(() => {
  vi.clearAllMocks();
  sessionReads.length = 0;
  overrides = {};
  sessionUser = { id: "user-1" };
  role = "admin";
  platformAdmin = true;
  getPartnerBalanceMock.mockResolvedValue(BALANCE);
  listLedgerEntriesMock.mockResolvedValue(ENTRIES);
  listChargesMock.mockResolvedValue(CHARGES);
  getStatementWithLinesMock.mockResolvedValue(STATEMENT_ROW);
});

function expectNadaLeido() {
  expect(getPartnerBalanceMock).not.toHaveBeenCalled();
  expect(listLedgerEntriesMock).not.toHaveBeenCalled();
  expect(listChargesMock).not.toHaveBeenCalled();
  expect(getStatementWithLinesMock).not.toHaveBeenCalled();
}

const NO_ADMIN = STUDIO_USER_ROLES.filter((r) => r !== "admin");

describe("financiero-china · candado de rol", () => {
  it.each(NO_ADMIN)(
    "rol %s: getSupplierFinance deniega y no lee saldo ni libro mayor",
    async (r) => {
      role = r;

      const res = await getSupplierFinance(SUPPLIER);

      expect(res).toEqual({ ok: false, error: DENIAL_ROL });
      expectNadaLeido();
    },
  );

  it.each(NO_ADMIN)(
    "rol %s: getStatementDetail deniega y no lee el estado de cuenta",
    async (r) => {
      role = r;

      const res = await getStatementDetail(STATEMENT, SUPPLIER);

      expect(res).toEqual({ ok: false, error: DENIAL_ROL });
      expectNadaLeido();
    },
  );

  it("sin sesión tampoco lee nada", async () => {
    sessionUser = null;
    role = null;

    expect(await getSupplierFinance(SUPPLIER)).toEqual({
      ok: false,
      error: DENIAL_ROL,
    });
    expectNadaLeido();
  });

  it("un override por rol no abre el módulo: está en LOCKED (admin-only)", async () => {
    role = "accounting";
    overrides = { "accounting:financiero-china": { view: true, edit: true } };

    expect(await getSupplierFinance(SUPPLIER)).toEqual({
      ok: false,
      error: DENIAL_ROL,
    });
    expectNadaLeido();
  });
});

describe("financiero-china · segundo candado (superadministrador)", () => {
  it("un admin del tenant que NO opera la plataforma no lee el saldo", async () => {
    platformAdmin = false;

    const res = await getSupplierFinance(SUPPLIER);

    expect(res).toEqual({ ok: false, error: DENIAL_SUPER });
    expectNadaLeido();
  });

  it("tampoco el detalle del estado de cuenta", async () => {
    platformAdmin = false;

    const res = await getStatementDetail(STATEMENT, SUPPLIER);

    expect(res).toEqual({ ok: false, error: DENIAL_SUPER });
    expectNadaLeido();
  });

  it("el mensaje distingue los dos candados: no es el mismo texto", () => {
    expect(DENIAL_SUPER).not.toBe(DENIAL_ROL);
  });
});

describe("financiero-china · lado positivo", () => {
  it("superadmin recibe saldo, libro mayor y cargos", async () => {
    const res = await getSupplierFinance(SUPPLIER);

    expect(res).toEqual({
      ok: true,
      balance: BALANCE,
      ledgerEntries: ENTRIES,
      charges: CHARGES,
    });
  });

  it("superadmin recibe el detalle del estado de cuenta", async () => {
    const res = await getStatementDetail(STATEMENT, SUPPLIER);

    expect(res).toEqual({
      ok: true,
      statement: STATEMENT_ROW,
      charges: CHARGES,
      ledgerEntries: ENTRIES,
    });
  });

  it("el gate corre ANTES de resolver el tenant y de leer", async () => {
    role = "operations";

    await getSupplierFinance(SUPPLIER);

    // `resolveTenant` también lee `user_tenants`: si el candado quedara
    // después, habría DOS lecturas en vez de una.
    expect(sessionReads).toEqual(["user_tenants"]);
  });
});
