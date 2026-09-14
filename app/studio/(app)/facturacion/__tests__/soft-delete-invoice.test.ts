/**
 * SDD-0465 · `softDeleteInvoice` sólo acepta borradores.
 *
 * Es la matriz de permanencia MP-01 para facturación: «Borrador: P2/R2.
 * Emitido o asentado: P3/R3». Una factura emitida ya produjo asiento de venta
 * (SDD-0040), puede tener recibos (SDD-0041) y créditos de referido aplicados
 * (SDD-0137) y entra al libro de ventas (SDD-0073): se anula con motivo
 * (`voidInvoice`), no se oculta con `deleted_at`.
 *
 * La UI sólo muestra «Eliminar» en el drawer de edición, que se abre para
 * borradores (`isEditable`). El servidor no confía en eso: la action acepta
 * cualquier id, así que la regla vive acá, con mensaje claro cuando no procede.
 *
 * El doble de Supabase registra la lectura y la escritura para afirmar que un
 * rechazo NO escribe nada y que el UPDATE lleva sus guardas de carrera.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const revalidateSpy = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (...a: unknown[]) => revalidateSpy(...(a as [])),
}));

/** Lo que devuelve el gate RBAC: null = puede editar facturas. */
let denial: string | null = null;
vi.mock("@/lib/studio/rbac-guard", () => ({
  moduleEditDenial: vi.fn(async () => denial),
}));

// No los usa softDeleteInvoice, pero el módulo de actions los importa: se
// aíslan para que el test no dependa de variables de entorno ni de correo.
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/studio/mail/mail-rule-engine", () => ({ fireMailEvent: vi.fn() }));

type Fila = {
  id: string;
  status: string;
  invoice_code: string;
  deleted_at: string | null;
};

type Cond = { op: string; col: string; val: unknown };
type Write = { values: Record<string, unknown>; conds: Cond[] };

/** Escenario: la fila que la lectura devuelve y cómo responde el UPDATE. */
let fila: Fila | null = null;
let readError: { message: string } | null = null;
let updateMatches = true;
let updateError: { message: string } | null = null;
/** Escrituras observadas. */
let writes: Write[] = [];
/** Lecturas observadas (para afirmar que un rechazo por RBAC ni siquiera lee). */
let reads = 0;

function makeClient() {
  return {
    from(table: string) {
      if (table !== "invoices") throw new Error(`tabla inesperada: ${table}`);
      let pending: Write | null = null;
      const chain: Record<string, unknown> = {
        select() {
          return chain;
        },
        eq(col: string, val: unknown) {
          if (pending) pending.conds.push({ op: "eq", col, val });
          return chain;
        },
        is(col: string, val: unknown) {
          if (pending) pending.conds.push({ op: "is", col, val });
          return chain;
        },
        update(values: Record<string, unknown>) {
          pending = { values, conds: [] };
          writes.push(pending);
          return chain;
        },
        maybeSingle() {
          if (pending) {
            if (updateError) return Promise.resolve({ data: null, error: updateError });
            return Promise.resolve({
              data: updateMatches ? { id: pending.conds.find((c) => c.col === "id")?.val } : null,
              error: null,
            });
          }
          reads += 1;
          if (readError) return Promise.resolve({ data: null, error: readError });
          return Promise.resolve({ data: fila, error: null });
        },
      };
      return chain;
    },
  };
}

vi.mock("@/lib/db/server", () => ({
  createClient: async () => makeClient(),
}));

const { softDeleteInvoice } = await import("../actions");

const BORRADOR: Fila = {
  id: "inv-1",
  status: "borrador",
  invoice_code: "F-2026-0007",
  deleted_at: null,
};

beforeEach(() => {
  denial = null;
  fila = { ...BORRADOR };
  readError = null;
  updateMatches = true;
  updateError = null;
  writes = [];
  reads = 0;
  revalidateSpy.mockClear();
});

describe("softDeleteInvoice · borrador", () => {
  it("marca deleted_at y revalida la lista y el detalle", async () => {
    const res = await softDeleteInvoice("inv-1");

    expect(res).toEqual({ ok: true });
    expect(writes).toHaveLength(1);
    expect(typeof writes[0].values.deleted_at).toBe("string");
    expect(Number.isNaN(Date.parse(String(writes[0].values.deleted_at)))).toBe(false);
    expect(revalidateSpy).toHaveBeenCalledWith("/studio/facturacion");
    expect(revalidateSpy).toHaveBeenCalledWith("/studio/facturacion/F-2026-0007");
  });

  it("el UPDATE repite las guardas: mismo id, sigue en borrador y no borrada", async () => {
    // Si la factura se emite entre la lectura y la escritura, el UPDATE no
    // debe matchear: por eso las condiciones viajan en el propio UPDATE.
    await softDeleteInvoice("inv-1");

    expect(writes[0].conds).toEqual(
      expect.arrayContaining([
        { op: "eq", col: "id", val: "inv-1" },
        { op: "eq", col: "status", val: "borrador" },
        { op: "is", col: "deleted_at", val: null },
      ]),
    );
  });

  it("si el UPDATE no matchea ninguna fila (cambió de estado) → error claro y sin revalidar", async () => {
    updateMatches = false;
    const res = await softDeleteInvoice("inv-1");

    expect(res.ok).toBeUndefined();
    expect(res.error).toMatch(/cambió de estado/i);
    expect(revalidateSpy).not.toHaveBeenCalled();
  });

  it("si la escritura falla → devuelve el mensaje de la base", async () => {
    updateError = { message: "deadlock detected" };
    const res = await softDeleteInvoice("inv-1");

    expect(res.error).toBe("deadlock detected");
    expect(revalidateSpy).not.toHaveBeenCalled();
  });
});

describe("softDeleteInvoice · lo que NO se elimina", () => {
  it.each(["emitida", "parcial", "pagada", "vencida"])(
    "una factura %s no se elimina: se explica y se remite a anular, sin escribir",
    async (status) => {
      fila = { ...BORRADOR, status };
      const res = await softDeleteInvoice("inv-1");

      expect(res.ok).toBeUndefined();
      expect(res.error).toMatch(/solo las facturas en borrador pueden eliminarse/i);
      expect(res.error).toContain(`Esta está ${status}`);
      expect(res.error).toMatch(/anúlala con un motivo/i);
      expect(writes).toHaveLength(0);
      expect(revalidateSpy).not.toHaveBeenCalled();
    },
  );

  it("una anulada se conserva como registro: mensaje propio y sin escribir", async () => {
    fila = { ...BORRADOR, status: "anulada" };
    const res = await softDeleteInvoice("inv-1");

    expect(res.error).toMatch(/ya está anulada y se conserva como registro/i);
    expect(writes).toHaveLength(0);
  });

  it("una ya eliminada no se vuelve a marcar", async () => {
    fila = { ...BORRADOR, deleted_at: "2026-05-01T00:00:00Z" };
    const res = await softDeleteInvoice("inv-1");

    expect(res.error).toBe("Esta factura ya está eliminada.");
    expect(writes).toHaveLength(0);
  });

  it("factura inexistente (o fuera del tenant por RLS) → 'Factura no encontrada.'", async () => {
    fila = null;
    const res = await softDeleteInvoice("inv-x");

    expect(res.error).toBe("Factura no encontrada.");
    expect(writes).toHaveLength(0);
  });

  it("error al leer → 'Factura no encontrada.' y sin escribir", async () => {
    readError = { message: "permission denied" };
    const res = await softDeleteInvoice("inv-1");

    expect(res.error).toBe("Factura no encontrada.");
    expect(writes).toHaveLength(0);
  });

  it("sin permiso de edición del módulo → devuelve el rechazo del gate y ni siquiera lee", async () => {
    denial = "No tienes permiso para realizar esta acción.";
    const res = await softDeleteInvoice("inv-1");

    expect(res).toEqual({ error: "No tienes permiso para realizar esta acción." });
    expect(reads).toBe(0);
    expect(writes).toHaveLength(0);
  });
});
