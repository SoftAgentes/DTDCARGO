// @vitest-environment node
/**
 * `voidInvoice` y el crédito de referido aplicado a la factura.
 *
 * HISTORIA:
 *  - SDD-0495: la reversión del crédito corría DESPUÉS de anular y era
 *    best-effort; si fallaba, lo único que pasaba era un `console.error`. La
 *    0495 hizo subir un `warning` con el ok.
 *  - SDD-0496: la reversión pasó a ser una transacción (revert_referral_credits,
 *    0471) y el aviso se elige por QUÉ falló (`failure`), no por el conteo.
 *  - **SDD-0573 (0497):** la base ya no anula una factura con cobros vivos ni con
 *    abono sin recibo (decisión del Director, 2026-10-20). Por eso el orden se
 *    invierte: la action mira los cobros vivos, REVIERTE el crédito PRIMERO y
 *    recién después anula. Si el crédito no vuelve, la factura NO se anula: ya no
 *    puede quedar un crédito pegado a una factura anulada.
 *
 * Lo que estos tests fijan:
 *  - con cobros vivos no se anula y no se toca el crédito;
 *  - con abono, el crédito se revierte antes de anular, con el tenant y el id de
 *    ESTA factura; sin abono, ni se intenta;
 *  - si la reversión no liberó nada, no se anula, y el mensaje no lleva el texto
 *    crudo (el detalle va al log);
 *  - si la plata volvió pero el asiento del crédito quedó vivo ("entries"), se
 *    anula con su aviso, que no dice que el crédito quedó varado;
 *  - la RPC muestra solo sus mensajes (hint dtd-anular), nunca el texto crudo;
 *  - un éxito real no arrastra aviso, y revalida lo que corresponde.
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
let revertResult: {
  ok: boolean;
  reverted: number;
  error?: string;
  failure?: "revert" | "entries";
} = { ok: true, reverted: 0 };
const orden: string[] = [];
const revertSpy = vi.fn(async () => {
  orden.push("revertir");
  return revertResult;
});
vi.mock("@/lib/studio/accounting/referral-credit-posting", () => ({
  revertReferralCreditsForInvoice: (...a: unknown[]) => revertSpy(...(a as [])),
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
  paid_amount: number;
};

let fila: Fila | null = null;
/** Cuántos recibos vivos tiene la factura. */
let recibosVivos: number | null = 0;
/** Error de PostgREST independiente del count, incluso si devolvió un número. */
let recibosError: { message: string; code?: string } | null = null;
/** Recibos sintéticos de otro tenant con el mismo invoice_id contaminado. */
let recibosAjenos = 0;
/** Qué devolvió la RPC de anulación (`void_invoice_with_audit_reason`). */
let rpcChanged: unknown = true;
let rpcError: { message: string; code?: string; hint?: string | null } | null | undefined | false = null;
/** Llamadas a la RPC observadas. */
let rpcCalls: { fn: string; args: unknown }[] = [];
/** Los filtros de la consulta de recibos (el doble los aplica de verdad). */
let filtrosRecibos: [string, string, unknown][] = [];

function makeClient() {
  return {
    from(table: string) {
      if (table === "payment_receipts") {
        const chain: Record<string, unknown> = {
          select: () => chain,
          eq: (col: string, val: unknown) => {
            filtrosRecibos.push(["eq", col, val]);
            return chain;
          },
          is: (col: string, val: unknown) => {
            filtrosRecibos.push(["is", col, val]);
            return chain;
          },
          then: (resolve: (v: { count: number | null; error: typeof recibosError }) => void) => {
            // El doble admite la query actual y aplica también el filtro nuevo.
            // Sin tenant, los recibos ajenos contaminan el conteo observable.
            const deEsta = filtrosRecibos.some(([op, c, v]) => op === "eq" && c === "invoice_id" && v === fila?.id);
            const vivos = filtrosRecibos.some(([op, c, v]) => op === "is" && c === "deleted_at" && v === null);
            const delTenant = filtrosRecibos.some(([op, c, v]) => op === "eq" && c === "tenant_id" && v === fila?.tenant_id);
            const count = recibosVivos === null
              ? null
              : deEsta && vivos
                ? recibosVivos + (delTenant ? 0 : recibosAjenos)
                : 99;
            return Promise.resolve({ count, error: recibosError }).then(resolve);
          },
        };
        return chain;
      }
      if (table !== "invoices") throw new Error(`tabla inesperada: ${table}`);
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: () => Promise.resolve({ data: fila, error: null }),
      };
      return chain;
    },
    rpc(fn: string, args: unknown) {
      orden.push("anular");
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
  VOID_REFERRAL_REVERT_ENTRY_WARNING,
} = await import("@/lib/studio/fidelizacion/referral-revert-notice");

const CON_CREDITO: Fila = {
  id: "inv-1",
  tenant_id: "t-1",
  status: "parcial",
  invoice_code: "F-2026-0007",
  paid_amount: 80,
};

const MOTIVO = "Error en el monto facturado";

beforeEach(() => {
  denial = null;
  fila = { ...CON_CREDITO };
  recibosVivos = 0;
  recibosError = null;
  recibosAjenos = 0;
  rpcChanged = true;
  rpcError = null;
  rpcCalls = [];
  filtrosRecibos = [];
  orden.length = 0;
  revertResult = { ok: true, reverted: 1 };
  revertSpy.mockClear();
  revalidateSpy.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("voidInvoice · el crédito se revierte ANTES de anular (SDD-0573)", () => {
  it("revierte el crédito y después anula, con el tenant y el id de ESTA factura", async () => {
    const res = await voidInvoice("inv-1", MOTIVO);

    expect(res).toEqual({ ok: true });
    expect(orden).toEqual(["revertir", "anular"]);
    expect(revertSpy).toHaveBeenCalledWith(expect.anything(), "t-1", "inv-1");
    expect(rpcCalls).toEqual([
      { fn: "void_invoice_with_audit_reason", args: { p_id: "inv-1", p_reason: MOTIVO } },
    ]);
  });

  it("un éxito revalida la factura, Facturación, Contabilidad y Fidelización", async () => {
    await voidInvoice("inv-1", MOTIVO);

    expect(revalidateSpy).toHaveBeenCalledWith("/studio/fidelizacion");
    expect(revalidateSpy).toHaveBeenCalledWith("/studio/facturacion");
    expect(revalidateSpy).toHaveBeenCalledWith("/studio/facturacion/F-2026-0007");
    expect(revalidateSpy).toHaveBeenCalledWith("/studio/contabilidad");
  });

  it("sin abono no intenta revertir nada: ok limpio, sin aviso", async () => {
    fila = { ...CON_CREDITO, status: "emitida", paid_amount: 0 };

    const res = await voidInvoice("inv-1", MOTIVO);

    expect(res).toEqual({ ok: true });
    expect("warning" in res).toBe(false);
    expect(revertSpy).not.toHaveBeenCalled();
    expect(revalidateSpy).not.toHaveBeenCalledWith("/studio/fidelizacion");
  });
});

describe("voidInvoice · con cobros vivos no se anula (SDD-0573)", () => {
  it("devuelve el motivo y no toca el crédito ni la RPC", async () => {
    recibosVivos = 2;

    const res = await voidInvoice("inv-1", MOTIVO);

    expect(res).toEqual({ error: "La factura tiene 2 cobro(s) vivo(s): anúlalos primero en Cobranzas." });
    expect(revertSpy).not.toHaveBeenCalled();
    expect(rpcCalls).toHaveLength(0);
  });

  it("cuenta solo los recibos vivos de esta factura", async () => {
    await voidInvoice("inv-1", MOTIVO);

    // Conserva ambos filtros heredados y exige tenant; el orden no altera SQL.
    expect(filtrosRecibos).toHaveLength(3);
    expect(filtrosRecibos).toEqual(expect.arrayContaining([
      ["eq", "invoice_id", "inv-1"],
      ["is", "deleted_at", null],
      ["eq", "tenant_id", "t-1"],
    ]));
  });
});

describe("voidInvoice · la reversión del crédito no liberó nada", () => {
  beforeEach(() => {
    revertResult = {
      ok: false,
      reverted: 0,
      failure: "revert",
      error: "crédito abc: la factura cambió de saldo o de estado 3 veces seguidas",
    };
  });

  it("la factura NO se anula: no queda un crédito pegado a una anulada", async () => {
    const res = await voidInvoice("inv-1", MOTIVO);

    expect(res.ok).toBeUndefined();
    expect(rpcCalls).toHaveLength(0);
    expect(res.error).toMatch(/no se pudo liberar el crédito de referido/i);
    expect(res.error).toMatch(/no se anuló/i);
  });

  it("el mensaje no filtra el texto crudo del error ni jerga técnica", async () => {
    const res = await voidInvoice("inv-1", MOTIVO);
    const mensaje = String(res.error);

    expect(mensaje).not.toContain(String(revertResult.error));
    expect(mensaje).not.toMatch(/postgrest|supabase|rpc|null|undefined|error:/i);
  });

  it("el detalle técnico sigue yendo al log del servidor, con el código de factura", async () => {
    await voidInvoice("inv-1", MOTIVO);

    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("F-2026-0007"), revertResult.error);
  });

  it("no revalida nada: no cambió nada", async () => {
    await voidInvoice("inv-1", MOTIVO);

    expect(revalidateSpy).not.toHaveBeenCalled();
  });
});

describe("voidInvoice · la plata volvió pero el ASIENTO del crédito quedó vivo", () => {
  /**
   * SDD-0496: con `failure: "entries"` el crédito volvió entero; lo único que
   * quedó colgado es su asiento. La factura ya no tiene abono, así que se anula,
   * con el aviso que dice eso y no que el crédito quedó varado.
   */
  beforeEach(() => {
    revertResult = {
      ok: false,
      reverted: 1,
      failure: "entries",
      error: "asiento e1: permission denied for table journal_entries",
    };
  });

  it("se anula con el aviso del asiento, no con el del crédito varado", async () => {
    const res = await voidInvoice("inv-1", MOTIVO);

    expect(res.ok).toBe(true);
    expect(res.warning).toBe(VOID_REFERRAL_REVERT_ENTRY_WARNING);
    expect(res.warning).not.toBe(VOID_REFERRAL_REVERT_WARNING);
    expect(orden).toEqual(["revertir", "anular"]);
  });

  it("el aviso dice que el crédito volvió y que lo que falta es el asiento", async () => {
    const res = await voidInvoice("inv-1", MOTIVO);
    const aviso = String(res.warning);

    expect(aviso).toMatch(/volvió a estar disponible/i);
    expect(aviso).toMatch(/asiento contable/i);
    expect(aviso).toMatch(/contabilidad/i);
    expect(aviso).not.toMatch(/sigue marcado como usado/i);
  });

  it("elegir por `reverted` en vez de por `failure` daría el aviso equivocado", async () => {
    expect(revertResult.reverted).toBeGreaterThan(0);
    const res = await voidInvoice("inv-1", MOTIVO);
    expect(res.warning).not.toMatch(/créditos de referido se liberó/i);
  });

  it("revalida Fidelización y no filtra el texto crudo", async () => {
    const res = await voidInvoice("inv-1", MOTIVO);

    expect(revalidateSpy).toHaveBeenCalledWith("/studio/fidelizacion");
    expect(String(res.warning)).not.toContain(String(revertResult.error));
  });
});

describe("voidInvoice · lo que devuelve la RPC (0497)", () => {
  it("muestra el mensaje propio de la 0497 (hint dtd-anular)", async () => {
    fila = { ...CON_CREDITO, paid_amount: 0, status: "emitida" };
    rpcError = {
      code: "55000",
      message: "La factura tiene 2 asientos de venta vivos: revisa el libro diario antes de anular.",
      hint: "dtd-anular",
    };

    const res = await voidInvoice("inv-1", MOTIVO);

    expect(res).toEqual({ error: "La factura tiene 2 asientos de venta vivos: revisa el libro diario antes de anular." });
  });

  it("un error de la base sin el hint no se muestra tal cual (ERR-01)", async () => {
    fila = { ...CON_CREDITO, paid_amount: 0, status: "emitida" };
    rpcError = { code: "40P01", message: "deadlock detected", hint: null };

    const res = await voidInvoice("inv-1", MOTIVO);

    expect(res).toEqual({ error: "No se pudo anular la factura. Intenta de nuevo." });
    expect(revalidateSpy).not.toHaveBeenCalled();
  });

  it("si el crédito ya se liberó y la RPC falla, lo dice", async () => {
    rpcError = { code: "40P01", message: "deadlock detected", hint: null };

    const res = await voidInvoice("inv-1", MOTIVO);

    expect(res.error).toBe(
      "No se pudo anular la factura. Intenta de nuevo. El crédito de referido que tenía aplicado ya volvió a estar disponible.",
    );
  });

  it("si la RPC no cambió nada, lo dice", async () => {
    fila = { ...CON_CREDITO, paid_amount: 0, status: "emitida" };
    rpcChanged = false;

    const res = await voidInvoice("inv-1", MOTIVO);

    expect(res.error).toMatch(/ya no admite anulación/i);
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
    fila = { ...CON_CREDITO, status: "pagada" };

    const res = await voidInvoice("inv-1", MOTIVO);

    expect(res.error).toMatch(/ya pagada/i);
    expect(revertSpy).not.toHaveBeenCalled();
  });
});

/**
 * GO1: fuentes autorales NO EJECUTADAS. El doble conserva todas las operaciones
 * del camino actual; el futuro ROJO debe ser una aserción, no un TypeError.
 */
describe("GO1 M1 · el conteo debe ser conocido antes de producir efectos", () => {
  it.each([
    { nombre: "error con count nulo", count: null },
    { nombre: "error aunque count sea cero", count: 0 },
  ])("$nombre bloquea crédito, void y revalidaciones", async ({ count }) => {
    recibosVivos = count;
    recibosError = { code: "08006", message: "detalle-tecnico-go1-conteo-no-disponible" };

    const res = await voidInvoice("inv-1", MOTIVO);

    expect(res.ok).toBeUndefined();
    expect(res.error).toEqual(expect.any(String));
    expect(res.error).toMatch(/cobros|recibos/i);
    expect(res.error).not.toContain(recibosError.message);
    expect(revertSpy).not.toHaveBeenCalled();
    expect(rpcCalls).toEqual([]);
    expect(orden).toEqual([]);
    expect(revalidateSpy).not.toHaveBeenCalled();
  });

  it("count null sin error no equivale a cero conocido", async () => {
    recibosVivos = null;

    const res = await voidInvoice("inv-1", MOTIVO);

    expect(res.ok).toBeUndefined();
    expect(res.error).toMatch(/cobros|recibos/i);
    expect(revertSpy).not.toHaveBeenCalled();
    expect(rpcCalls).toEqual([]);
    expect(orden).toEqual([]);
    expect(revalidateSpy).not.toHaveBeenCalled();
  });

  it("cero conocido permite crédito y void, una vez y en ese orden", async () => {
    recibosVivos = 0;

    const res = await voidInvoice("inv-1", MOTIVO);

    expect(res).toEqual({ ok: true });
    expect(revertSpy).toHaveBeenCalledTimes(1);
    expect(rpcCalls).toEqual([
      { fn: "void_invoice_with_audit_reason", args: { p_id: "inv-1", p_reason: MOTIVO } },
    ]);
    expect(orden).toEqual(["revertir", "anular"]);
  });

  it("positivo conocido bloquea todo efecto y no revalida", async () => {
    recibosVivos = 1;

    const res = await voidInvoice("inv-1", MOTIVO);

    expect(res.ok).toBeUndefined();
    expect(res.error).toMatch(/1 cobro/);
    expect(revertSpy).not.toHaveBeenCalled();
    expect(rpcCalls).toEqual([]);
    expect(revalidateSpy).not.toHaveBeenCalled();
  });

  it("el recibo ajeno no bloquea una factura sin cobros del tenant de sesión", async () => {
    recibosVivos = 0;
    recibosAjenos = 2;

    const res = await voidInvoice("inv-1", MOTIVO);

    expect(res).toEqual({ ok: true });
    expect(filtrosRecibos).toContainEqual(["eq", "tenant_id", CON_CREDITO.tenant_id]);
    expect(revertSpy).toHaveBeenCalledTimes(1);
    expect(rpcCalls).toHaveLength(1);
  });

  it("crédito confirmado seguido de void fallido conserva el aviso y no repite pasos", async () => {
    revertResult = { ok: true, reverted: 1 };
    rpcError = { code: "40P01", message: "detalle-tecnico-go1-void", hint: null };

    const res = await voidInvoice("inv-1", MOTIVO);

    expect(res.ok).toBeUndefined();
    expect(res.error).toMatch(/crédito de referido.*ya volvió a estar disponible/i);
    expect(res.error).not.toContain(rpcError.message);
    expect(revertSpy).toHaveBeenCalledTimes(1);
    expect(rpcCalls).toHaveLength(1);
    expect(orden).toEqual(["revertir", "anular"]);
    expect(revalidateSpy.mock.calls.map(([ruta]) => ruta)).toEqual(["/studio/fidelizacion"]);
    // Esto observa dos pasos separados; no acredita una transacción conjunta.
  });
});

/**
 * SDD-0573 · Datos FICTICIOS: cada valor se devuelve EXACTO por el doble.
 * Se conserva el universo sintético inv-1/t-1 del test; no hay DB ni dinero real.
 * Los casos y expectativas existen antes de invocar voidInvoice.
 */
const ACK_FICTICIOS_NO_BOOLEANOS: { nombre: string; data: unknown }[] = [
  { nombre: "FICT_objeto_vacio", data: {} },
  { nombre: "FICT_array_vacio", data: [] },
  { nombre: "FICT_array_false", data: [false] },
  { nombre: "FICT_string_false", data: "false" },
  { nombre: "FICT_numero_uno", data: 1 },
  { nombre: "FICT_null", data: null },
  { nombre: "FICT_undefined", data: undefined },
];
const ERRORES_TRANSPORTE_FICTICIOS: { nombre: string; error: undefined | false }[] = [
  { nombre: "FICT_error_ausente", error: undefined },
  { nombre: "FICT_error_false", error: false },
];
const FICT_NO_CONFIRMADO =
  "No se pudo confirmar la anulación de la factura. Revisa su estado antes de volver a intentar.";
const FICT_AVISO_CREDITO =
  "El crédito de referido que tenía aplicado ya volvió a estar disponible.";

function expectAckSinExitoFinal(
  res: { ok?: boolean; error?: string; warning?: string },
  conCredito: boolean,
): void {
  expect(res.ok).toBeUndefined();
  expect(res.warning).toBeUndefined();
  expect(JSON.stringify(res)).not.toMatch(/la factura quedó anulada/i);
  expect(rpcCalls).toEqual([
    { fn: "void_invoice_with_audit_reason", args: { p_id: "inv-1", p_reason: MOTIVO } },
  ]);
  expect(orden).toEqual(conCredito ? ["revertir", "anular"] : ["anular"]);
  expect(revertSpy).toHaveBeenCalledTimes(conCredito ? 1 : 0);
  // Fidelización puede haber cambiado ANTES; sólo las tres finales se bloquean.
  expect(revalidateSpy.mock.calls.map(([ruta]) => ruta))
    .toEqual(conCredito ? ["/studio/fidelizacion"] : []);
  expect(revalidateSpy).not.toHaveBeenCalledWith("/studio/facturacion");
  expect(revalidateSpy).not.toHaveBeenCalledWith("/studio/facturacion/F-2026-0007");
  expect(revalidateSpy).not.toHaveBeenCalledWith("/studio/contabilidad");
}

describe("voidInvoice · ACK estricto y transporte (FICTICIO)", () => {
  for (const conCredito of [false, true]) {
    describe(conCredito ? "FICT_con_credito_ya_liberado" : "FICT_sin_credito", () => {
      it.each(ACK_FICTICIOS_NO_BOOLEANOS)("$nombre no confirma ni repite la mutación", async ({ data }) => {
        fila = conCredito ? { ...CON_CREDITO } : { ...CON_CREDITO, status: "emitida", paid_amount: 0 };
        rpcChanged = data;
        revertResult = { ok: true, reverted: conCredito ? 1 : 0 };

        const res = await voidInvoice("inv-1", MOTIVO);

        expect(res.error).toBe(FICT_NO_CONFIRMADO + (conCredito ? " " + FICT_AVISO_CREDITO : ""));
        expect(res.error).not.toMatch(/no se anuló|rollback|ningún efecto/i);
        expectAckSinExitoFinal(res, conCredito);
      });

      it("FICT_data_true no domina un error nativo ni filtra su detalle", async () => {
        fila = conCredito ? { ...CON_CREDITO } : { ...CON_CREDITO, status: "emitida", paid_amount: 0 };
        rpcChanged = true;
        const detalle = "FICT_NATIVE_DETAIL_NOT_PUBLIC";
        rpcError = { code: "40P01", message: detalle, hint: null };
        revertResult = { ok: true, reverted: conCredito ? 1 : 0 };

        const res = await voidInvoice("inv-1", MOTIVO);

        expect(res.error).toBe("No se pudo anular la factura. Intenta de nuevo." +
          (conCredito ? " " + FICT_AVISO_CREDITO : ""));
        expect(res.error).not.toContain(detalle);
        expectAckSinExitoFinal(res, conCredito);
      });

      it.each(ERRORES_TRANSPORTE_FICTICIOS)("$nombre no acredita éxito aunque data sea true", async ({ error }) => {
        fila = conCredito ? { ...CON_CREDITO } : { ...CON_CREDITO, status: "emitida", paid_amount: 0 };
        rpcChanged = true;
        rpcError = error;
        revertResult = { ok: true, reverted: conCredito ? 1 : 0 };

        const res = await voidInvoice("inv-1", MOTIVO);

        expect(res.error).toBe(FICT_NO_CONFIRMADO + (conCredito ? " " + FICT_AVISO_CREDITO : ""));
        expectAckSinExitoFinal(res, conCredito);
      });
    });
  }

  it("FICT_false sigue siendo ACK negativo válido y conserva el crédito ya liberado", async () => {
    rpcChanged = false;
    revertResult = { ok: true, reverted: 1 };

    const res = await voidInvoice("inv-1", MOTIVO);

    expect(res.error).toBe("La factura ya no admite anulación. " + FICT_AVISO_CREDITO);
    expect(res.error).not.toBe(FICT_NO_CONFIRMADO + " " + FICT_AVISO_CREDITO);
    expectAckSinExitoFinal(res, true);
  });

  it("FICT_22023 audit:reason conserva yaLiberado y el mensaje saneado", async () => {
    rpcChanged = true;
    revertResult = { ok: true, reverted: 1 };
    rpcError = { code: "22023", message: "audit: reason FICT_PRIVATE_DETAIL", hint: null };

    const res = await voidInvoice("inv-1", MOTIVO);

    expect(res.error).toBe("El motivo debe tener entre 4 y 1000 caracteres. " + FICT_AVISO_CREDITO);
    expect(res.error).not.toContain("FICT_PRIVATE_DETAIL");
    expectAckSinExitoFinal(res, true);
  });
});
