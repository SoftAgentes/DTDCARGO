/**
 * SDD-0674 · EXC-0674 — la server action de «Facturar».
 *
 * Antes de llamar a la RPC exige el rol (accounting o admin), «Confirmado» y montos
 * válidos (total con IVA, > 0, 2 decimales). Manda los centavos exactos y traduce los errores de
 * la base. Después avisa por correo cada factura emitida. Datos inventados.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const estado = vi.hoisted(() => ({
  rol: "accounting" as string | null,
  tenantId: "t1" as string | null,
  llamadas: [] as { fn: string; args: Record<string, unknown> }[],
  respuesta: { data: null as unknown, error: null as null | { message: string } },
  correos: [] as unknown[],
  denegado: null as string | null,
}));

vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@/lib/db/server", () => ({
  createClient: async () => ({
    rpc: async (fn: string, args: Record<string, unknown>) => {
      estado.llamadas.push({ fn, args });
      return estado.respuesta;
    },
  }),
}));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/studio/rbac-guard", () => ({
  getStudioAccess: async () => ({ role: estado.rol, tenantId: estado.tenantId }),
  moduleEditDenial: async (_s: unknown, mod: string) => (mod === "invoices" ? estado.denegado : "módulo equivocado"),
}));
vi.mock("@/lib/studio/mail/mail-rule-engine", () => ({
  fireMailEvent: async (_a: unknown, _t: unknown, input: unknown) => {
    estado.correos.push(input);
  },
}));

import { emitirPreordenesExc0674Action, facturarExc0674Action } from "../facturar-actions";

const C64 = "00000000-0000-4000-8000-00000000c064";

beforeEach(() => {
  estado.rol = "accounting";
  estado.tenantId = "t1";
  estado.llamadas = [];
  estado.correos = [];
  estado.denegado = null;
  estado.respuesta = {
    data: {
      version: 1,
      facturas: [
        {
          client_markbox: "DTD-T001", invoice_id: "i1", invoice_code: "F-TEST-1", billed_markbox: "DTD-T001",
          billed_name: "Cliente Uno", shipment_code: "DTD-T001-01", issued_at: "2026-11-18", due_date: "2026-12-18",
          total_usd: 1234.56,
        },
      ],
    },
    error: null,
  };
});

describe("facturarExc0674Action", () => {
  it.each(["operations", "commercial", "warehouse", "support", "marketing", null])("%s: no llama a la RPC", async (rol) => {
    estado.rol = rol;
    const r = await facturarExc0674Action(C64, [{ clientMarkbox: "DTD-T001", total: "116" }], "Confirmado");
    expect(r.ok).toBe(false);
    expect(estado.llamadas).toEqual([]);
  });

  it("accounting sin edición de Facturación (override) no llama a la RPC", async () => {
    estado.denegado = "No tienes permiso para editar esto.";
    const r = await facturarExc0674Action(C64, [{ clientMarkbox: "DTD-T001", total: "116" }], "Confirmado");
    expect(r).toEqual({ ok: false, error: "No tienes permiso para editar esto." });
    expect(estado.llamadas).toEqual([]);
  });

  it("sin «Confirmado» exacto no llama a la RPC", async () => {
    const r = await facturarExc0674Action(C64, [{ clientMarkbox: "DTD-T001", total: "116" }], "confirmado");
    expect(r.ok).toBe(false);
    expect(estado.llamadas).toEqual([]);
  });

  it("un monto inválido no llama a la RPC y nombra al cliente", async () => {
    const r = await facturarExc0674Action(
      C64,
      [{ clientMarkbox: "DTD-T001", total: "116" }, { clientMarkbox: "DTD-T002", total: "0" }],
      "Confirmado",
    );
    expect(r).toEqual({ ok: false, error: expect.stringContaining("DTD-T002") });
    expect(estado.llamadas).toEqual([]);
  });

  it("un cliente repetido o un contenedor que no es un id no llaman a la RPC", async () => {
    expect(
      (await facturarExc0674Action(C64, [{ clientMarkbox: "dtd-t001", total: "1" }, { clientMarkbox: "DTD-T001", total: "1" }], "Confirmado")).ok,
    ).toBe(false);
    expect((await facturarExc0674Action("c64", [{ clientMarkbox: "DTD-T001", total: "1" }], "Confirmado")).ok).toBe(false);
    expect(estado.llamadas).toEqual([]);
  });

  it.each(["accounting", "admin"])("%s: manda los centavos exactos y la confirmación", async (rol) => {
    estado.rol = rol;
    const r = await facturarExc0674Action(
      C64,
      [{ clientMarkbox: " dtd-t001", total: "1.234,56" }, { clientMarkbox: "AR-S-0001", total: "0,10" }],
      "Confirmado",
    );
    expect(estado.llamadas).toEqual([
      {
        fn: "exc0674_facturar",
        args: {
          p_consolidation_id: C64,
          p_montos: [
            { client_markbox: "DTD-T001", total_usd: 1234.56 },
            { client_markbox: "AR-S-0001", total_usd: 0.1 },
          ],
          p_confirmacion: "Confirmado",
        },
      },
    ]);
    expect(r).toEqual({ ok: true, facturas: [{ clientMarkbox: "DTD-T001", invoiceCode: "F-TEST-1", totalUsd: 1234.56 }] });
  });

  it("avisa por correo cada factura emitida, como emitInvoice", async () => {
    await facturarExc0674Action(C64, [{ clientMarkbox: "DTD-T001", total: "1234.56" }], "Confirmado");
    expect(estado.correos).toEqual([
      expect.objectContaining({
        event: "invoice_emitted",
        clientMarkbox: "DTD-T001",
        sourceRef: { kind: "invoice", id: "i1" },
        vars: expect.objectContaining({ invoice_code: "F-TEST-1", due_date: "2026-12-18" }),
      }),
    ]);
  });

  it("con aliado raíz, el correo va al aliado facturado, con los datos del retorno de la RPC (N8)", async () => {
    estado.respuesta = {
      data: {
        version: 1,
        facturas: [
          {
            client_markbox: "AR-S-0001", invoice_id: "i2", invoice_code: "F-TEST-2", billed_markbox: "AR",
            billed_name: "Aliado Raíz", shipment_code: "AR-S-0001-01", issued_at: "2026-11-18", due_date: "2026-12-18",
            total_usd: 10,
          },
        ],
      },
      error: null,
    };
    await facturarExc0674Action(C64, [{ clientMarkbox: "AR-S-0001", total: "10" }], "Confirmado");
    expect(estado.correos).toEqual([
      expect.objectContaining({
        clientMarkbox: "AR",
        clientName: "Aliado Raíz",
        sourceRef: { kind: "invoice", id: "i2" },
        vars: expect.objectContaining({ invoice_code: "F-TEST-2" }),
      }),
    ]);
    // Solo una llamada a la base: la RPC. La action no vuelve a leer `invoices`.
    expect(estado.llamadas).toHaveLength(1);
  });

  it("traduce el error de la base y no avisa por correo", async () => {
    estado.respuesta = { data: null, error: { message: "exc0674:ya_facturado:DTD-T001" } };
    const r = await facturarExc0674Action(C64, [{ clientMarkbox: "DTD-T001", total: "116" }], "Confirmado");
    expect(r).toEqual({ ok: false, error: expect.stringContaining("ya está facturado") });
    expect(estado.correos).toEqual([]);
  });
});

describe("emitirPreordenesExc0674Action (SDD-0690)", () => {
  const P1 = "00000000-0000-4000-8000-0000000000a1";
  const P2 = "00000000-0000-4000-8000-0000000000a2";

  it.each(["operations", "commercial", "warehouse", "support", "marketing", null])("%s: no llama a la RPC", async (rol) => {
    estado.rol = rol;
    const r = await emitirPreordenesExc0674Action(C64, [P1], "Confirmado");
    expect(r.ok).toBe(false);
    expect(estado.llamadas).toEqual([]);
  });

  it("sin edición de Facturación, sin «Confirmado» o con ids inválidos no llama a la RPC", async () => {
    estado.denegado = "No tienes permiso para editar esto.";
    expect((await emitirPreordenesExc0674Action(C64, [P1], "Confirmado")).ok).toBe(false);
    estado.denegado = null;
    expect((await emitirPreordenesExc0674Action(C64, [P1], "confirmado")).ok).toBe(false);
    expect((await emitirPreordenesExc0674Action(C64, [], "Confirmado")).ok).toBe(false);
    expect((await emitirPreordenesExc0674Action(C64, ["no-es-uuid"], "Confirmado")).ok).toBe(false);
    expect((await emitirPreordenesExc0674Action(C64, [P1, P1], "Confirmado")).ok).toBe(false);
    expect((await emitirPreordenesExc0674Action("c64", [P1], "Confirmado")).ok).toBe(false);
    expect(estado.llamadas).toEqual([]);
  });

  it("emite por id, sin montos, y avisa por correo cada factura", async () => {
    const r = await emitirPreordenesExc0674Action(C64, [P1, P2], "Confirmado");
    expect(estado.llamadas).toEqual([
      {
        fn: "exc0674_emitir_borradores",
        args: { p_consolidation_id: C64, p_invoice_ids: [P1, P2], p_confirmacion: "Confirmado" },
      },
    ]);
    expect(r).toEqual({ ok: true, facturas: [{ clientMarkbox: "DTD-T001", invoiceCode: "F-TEST-1", totalUsd: 1234.56 }] });
    expect(estado.correos).toHaveLength(1);
  });

  it("si la base rechaza, no hay correo y el error es legible", async () => {
    estado.respuesta = { data: null, error: { message: "exc0674:contenedor_fuera_de_lista" } };
    const r = await emitirPreordenesExc0674Action(C64, [P1], "Confirmado");
    expect(r).toEqual({ ok: false, error: "Este contenedor no está en la lista de la regla transitoria." });
    expect(estado.correos).toEqual([]);
  });
});
