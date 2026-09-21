// @vitest-environment node
/**
 * SDD-0495 · `voidInvoice` avisa cuando la reversión del crédito no se pudo hacer.
 *
 * El defecto medido (punto 2 del «Fuera de alcance» de la SDD-0490): la
 * reversión de los créditos de referido es best-effort y, si fallaba, lo ÚNICO
 * que pasaba era un `console.error`. La action devolvía `{ ok: true }` y quien
 * anulaba veía un éxito limpio, mientras el crédito quedaba 'aplicado' colgando
 * de una factura anulada.
 *
 * Lo que estos tests fijan:
 *  - la anulación SIGUE siendo exitosa cuando la reversión falla (no se bloquea:
 *    ese es el diseño de la SDD-0137 §3.6 y no cambia acá),
 *  - pero ya no es silenciosa: sube un `warning` con el ok,
 *  - el aviso NO lleva el texto crudo del error —quien anula facturas no depura
 *    PostgREST— y el detalle técnico sigue yendo al log,
 *  - un éxito real no arrastra aviso (si no, el aviso deja de significar algo),
 *  - y Fidelización se revalida también en el fallo, porque su pantalla pasa a
 *    tener un crédito varado que mostrar.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const revalidateSpy = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (...a: unknown[]) => revalidateSpy(...(a as [])),
}));

/** Gate RBAC del módulo `invoices`: null = puede anular. */
let denial: string | null = null;
vi.mock("@/lib/studio/rbac-guard", () => ({
  moduleEditDenial: vi.fn(async () => denial),
}));

/** Lo que devuelve la reversión del crédito (el escenario de cada test). */
let revertResult: { ok: boolean; reverted: number; error?: string } = {
  ok: true,
  reverted: 0,
};
const revertSpy = vi.fn(async () => revertResult);
vi.mock("@/lib/studio/accounting/referral-credit-posting", () => ({
  revertReferralCreditsForInvoice: (...a: unknown[]) =>
    revertSpy(...(a as [])),
  voidReferralCreditEntry: vi.fn(),
}));

// No los usa voidInvoice, pero el módulo de actions los importa.
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/studio/mail/mail-rule-engine", () => ({ fireMailEvent: vi.fn() }));

type Fila = {
  id: string;
  tenant_id: string;
  status: string;
  invoice_code: string;
};

let fila: Fila | null = null;
/** Qué devolvió la RPC de anulación (`void_invoice_with_audit_reason`). */
let rpcChanged: unknown = true;
let rpcError: { message: string } | null = null;
/** Llamadas a la RPC observadas. */
let rpcCalls: { fn: string; args: unknown }[] = [];

function makeClient() {
  return {
    from(table: string) {
      if (table !== "invoices") throw new Error(`tabla inesperada: ${table}`);
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: () => Promise.resolve({ data: fila, error: null }),
      };
      return chain;
    },
    rpc(fn: string, args: unknown) {
      rpcCalls.push({ fn, args });
      return Promise.resolve({ data: rpcChanged, error: rpcError });
    },
  };
}

vi.mock("@/lib/db/server", () => ({
  createClient: async () => makeClient(),
}));

const { voidInvoice } = await import("../actions");
const {
  VOID_REFERRAL_REVERT_WARNING,
  VOID_REFERRAL_REVERT_PARTIAL_WARNING,
} = await import("@/lib/studio/fidelizacion/referral-revert-notice");

const EMITIDA: Fila = {
  id: "inv-1",
  tenant_id: "t-1",
  status: "emitida",
  invoice_code: "F-2026-0007",
};

const MOTIVO = "Error en el monto facturado";

beforeEach(() => {
  denial = null;
  fila = { ...EMITIDA };
  rpcChanged = true;
  rpcError = null;
  rpcCalls = [];
  revertResult = { ok: true, reverted: 0 };
  revertSpy.mockClear();
  revalidateSpy.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("voidInvoice · la reversión del crédito falló", () => {
  beforeEach(() => {
    revertResult = {
      ok: false,
      reverted: 0,
      error:
        "crédito abc: la factura cambió de saldo o de estado 3 veces seguidas",
    };
  });

  it("la factura queda anulada igual: el aviso no bloquea la anulación", async () => {
    const res = await voidInvoice("inv-1", MOTIVO);

    expect(res.ok).toBe(true);
    expect(res.error).toBeUndefined();
    expect(rpcCalls).toEqual([
      {
        fn: "void_invoice_with_audit_reason",
        args: { p_id: "inv-1", p_reason: MOTIVO },
      },
    ]);
  });

  it("devuelve el aviso junto con el ok (antes sólo iba al log)", async () => {
    const res = await voidInvoice("inv-1", MOTIVO);

    expect(res.warning).toBe(VOID_REFERRAL_REVERT_WARNING);
  });

  it("el aviso no filtra el texto crudo del error ni jerga técnica", async () => {
    const res = await voidInvoice("inv-1", MOTIVO);
    const aviso = String(res.warning);

    expect(aviso).not.toContain(String(revertResult.error));
    expect(aviso).not.toMatch(/postgrest|supabase|rpc|null|undefined|error:/i);
  });

  it("el aviso dice qué pasó, a quién le duele y que no se arregla desde ahí", async () => {
    const res = await voidInvoice("inv-1", MOTIVO);
    const aviso = String(res.warning);

    expect(aviso).toMatch(/crédito de referido/i);
    expect(aviso).toMatch(/referidor/i);
    expect(aviso).toMatch(/no se arregla desde aquí/i);
    expect(aviso).toMatch(/fidelizaci[oó]n/i);
  });

  it("el detalle técnico sigue yendo al log del servidor, con el código de factura", async () => {
    await voidInvoice("inv-1", MOTIVO);

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("F-2026-0007"),
      revertResult.error,
    );
  });

  it("revalida Fidelización: su pantalla pasa a tener un crédito varado", async () => {
    await voidInvoice("inv-1", MOTIVO);

    expect(revalidateSpy).toHaveBeenCalledWith("/studio/fidelizacion");
    expect(revalidateSpy).toHaveBeenCalledWith("/studio/facturacion");
    expect(revalidateSpy).toHaveBeenCalledWith(
      "/studio/facturacion/F-2026-0007",
    );
  });
});

describe("voidInvoice · la reversión falló A MEDIAS", () => {
  /**
   * `revertReferralCreditsForInvoice` recorre los créditos de la factura de a
   * uno: suma a `reverted` los que salen bien y junta el resto en `failures`.
   * Con dos créditos en la misma factura, uno liberado y otro no, devuelve
   * `ok: false` con `reverted > 0`. **Esto es alcanzable hoy**, sin esperar a
   * que la reversión se mude a SQL.
   */
  beforeEach(() => {
    revertResult = {
      ok: false,
      reverted: 1,
      error: "crédito b: la factura cambió de saldo o de estado 3 veces",
    };
  });

  it("no dice que no se pudo liberar: eso sería falso para el que SÍ se liberó", async () => {
    const res = await voidInvoice("inv-1", MOTIVO);

    expect(res.warning).toBe(VOID_REFERRAL_REVERT_PARTIAL_WARNING);
    expect(res.warning).not.toBe(VOID_REFERRAL_REVERT_WARNING);
  });

  it("el aviso parcial dice que se liberó una parte y que el resto quedó", async () => {
    const res = await voidInvoice("inv-1", MOTIVO);
    const aviso = String(res.warning);

    expect(aviso).toMatch(/parte de los créditos de referido se liberó/i);
    expect(aviso).toMatch(/no todos/i);
    expect(aviso).toMatch(/se listan cuáles/i);
  });

  it("sigue siendo una anulación exitosa y revalida Fidelización", async () => {
    const res = await voidInvoice("inv-1", MOTIVO);

    expect(res.ok).toBe(true);
    expect(res.error).toBeUndefined();
    expect(revalidateSpy).toHaveBeenCalledWith("/studio/fidelizacion");
  });

  it("tampoco filtra el texto crudo del error", async () => {
    const res = await voidInvoice("inv-1", MOTIVO);

    expect(String(res.warning)).not.toContain(String(revertResult.error));
  });
});

describe("voidInvoice · la reversión salió bien", () => {
  it("sin créditos que revertir: ok limpio, sin aviso", async () => {
    revertResult = { ok: true, reverted: 0 };

    const res = await voidInvoice("inv-1", MOTIVO);

    expect(res).toEqual({ ok: true });
    expect("warning" in res).toBe(false);
    expect(revalidateSpy).not.toHaveBeenCalledWith("/studio/fidelizacion");
  });

  it("con créditos revertidos: ok limpio, sin aviso, y Fidelización revalidada", async () => {
    revertResult = { ok: true, reverted: 2 };

    const res = await voidInvoice("inv-1", MOTIVO);

    expect(res).toEqual({ ok: true });
    expect(revalidateSpy).toHaveBeenCalledWith("/studio/fidelizacion");
  });

  it("la reversión se pide con el tenant y el id de ESTA factura", async () => {
    await voidInvoice("inv-1", MOTIVO);

    expect(revertSpy).toHaveBeenCalledWith("t-1", "inv-1");
  });
});

describe("voidInvoice · lo que se rechaza antes de llegar al crédito", () => {
  it("sin permiso del módulo no anula ni intenta revertir", async () => {
    denial = "No tienes permiso para realizar esta acción.";

    const res = await voidInvoice("inv-1", MOTIVO);

    expect(res).toEqual({ error: denial });
    expect(rpcCalls).toHaveLength(0);
    expect(revertSpy).not.toHaveBeenCalled();
  });

  it("motivo muy corto: ni siquiera abre el cliente", async () => {
    const res = await voidInvoice("inv-1", "x");

    expect(res.error).toMatch(/al menos 4 caracteres/i);
    expect(rpcCalls).toHaveLength(0);
    expect(revertSpy).not.toHaveBeenCalled();
  });

  it("una factura pagada no se anula y no toca el crédito", async () => {
    fila = { ...EMITIDA, status: "pagada" };

    const res = await voidInvoice("inv-1", MOTIVO);

    expect(res.error).toMatch(/ya pagada/i);
    expect(revertSpy).not.toHaveBeenCalled();
  });

  it("si la RPC de anulación falla, no hay aviso de crédito ni reversión", async () => {
    rpcError = { message: "deadlock detected" };

    const res = await voidInvoice("inv-1", MOTIVO);

    expect(res).toEqual({ error: "deadlock detected" });
    expect(revertSpy).not.toHaveBeenCalled();
    expect(revalidateSpy).not.toHaveBeenCalled();
  });

  it("si la RPC no cambió nada, tampoco se revierte nada", async () => {
    rpcChanged = false;

    const res = await voidInvoice("inv-1", MOTIVO);

    expect(res.error).toMatch(/ya no admite anulación/i);
    expect(revertSpy).not.toHaveBeenCalled();
  });
});
