import { describe, it, expect } from "vitest";
import { buildComprobante, estadoDelComprobante } from "../comprobante";
import type { PortalInvoiceDetail } from "../portal-types";

/** Detalle de factura mínimo válido para el builder; override por test. */
function inv(over: Partial<PortalInvoiceDetail> = {}): PortalInvoiceDetail {
  return {
    id: "inv-1",
    tenantId: "t-1",
    clientRif: null,
    clientDocKind: null,
    code: "F-2026-0001",
    clientName: "Empresa Demo S.A.",
    status: "emitida",
    currency: "USD",
    fxRate: null,
    ivaRate: 0,
    base: 1000,
    ivaAmount: 0,
    total: 1000,
    paid: 0,
    issuedAt: "2026-06-01",
    dueDate: "2026-06-16",
    lines: [
      { desc: "Flete marítimo LCL", qty: 2, unitPrice: 300 },
      { desc: "Servicio DDP", qty: 1, unitPrice: 400 },
    ],
    notes: null,
    shipmentId: null,
    shipmentCode: "DTD-5001",
    createdAt: "2026-06-01T00:00:00Z",
    ...over,
  };
}

describe("buildComprobante", () => {
  it("calcula subtotal por línea = qty × precio unitario", () => {
    const c = buildComprobante(inv());
    expect(c.lines.map((l) => l.subtotal)).toEqual([600, 400]);
    expect(c.linesTotal).toBe(1000);
  });

  it("deriva IVA OFF cuando ivaRate = 0", () => {
    const c = buildComprobante(inv({ ivaRate: 0 }));
    expect(c.ivaOn).toBe(false);
  });

  it("deriva IVA ON cuando ivaRate > 0", () => {
    const c = buildComprobante(
      inv({ ivaRate: 16, base: 1000, ivaAmount: 160, total: 1160 }),
    );
    expect(c.ivaOn).toBe(true);
    expect(c.ivaAmount).toBe(160);
    expect(c.total).toBe(1160);
  });

  it("saldo = total − pagado y marca hasBalance", () => {
    const c = buildComprobante(inv({ total: 1000, paid: 300 }));
    expect(c.balance).toBe(700);
    expect(c.hasBalance).toBe(true);
    expect(c.isPaid).toBe(false);
  });

  it("factura saldada → isPaid, sin saldo", () => {
    const c = buildComprobante(inv({ total: 1000, paid: 1000 }));
    expect(c.balance).toBe(0);
    expect(c.hasBalance).toBe(false);
    expect(c.isPaid).toBe(true);
  });

  it("sobrepago no genera saldo negativo (clamp a 0)", () => {
    const c = buildComprobante(inv({ total: 1000, paid: 1200 }));
    expect(c.balance).toBe(0);
    expect(c.hasBalance).toBe(false);
  });

  it("factura sin pagos no es 'pagada' aunque no tenga saldo positivo extraño", () => {
    const c = buildComprobante(inv({ total: 0, paid: 0 }));
    expect(c.isPaid).toBe(false);
  });

  it("tolera líneas vacías", () => {
    const c = buildComprobante(inv({ lines: [] }));
    expect(c.lines).toEqual([]);
    expect(c.linesTotal).toBe(0);
  });

  it("SDD-0556 · anulada sin pagos: sin saldo, no «pagada», isVoided", () => {
    const c = buildComprobante(inv({ status: "anulada", total: 1000, paid: 0 }));
    expect(c).toMatchObject({
      balance: 0,
      hasBalance: false,
      isPaid: false,
      isVoided: true,
      paidOnVoided: 0,
    });
  });

  it("SDD-0556 · anulada con abono: sin saldo pendiente y lo pagado a la vista", () => {
    // Antes: balance 700 y hasBalance true — el comprobante le cobraba al
    // cliente una factura que ya no existe.
    const c = buildComprobante(inv({ status: "anulada", total: 1000, paid: 300 }));
    expect(c).toMatchObject({
      balance: 0,
      hasBalance: false,
      isPaid: false,
      isVoided: true,
      paidOnVoided: 300,
    });
  });

  it("SDD-0556 · anulada pagada entera tampoco es «pagada»", () => {
    const c = buildComprobante(inv({ status: "anulada", total: 1000, paid: 1000 }));
    expect(c.isPaid).toBe(false);
    expect(c.paidOnVoided).toBe(1000);
  });

  it("una viva no es anulada ni tiene paidOnVoided", () => {
    const c = buildComprobante(inv({ total: 1000, paid: 300 }));
    expect(c.isVoided).toBe(false);
    expect(c.paidOnVoided).toBe(0);
  });

  it("normaliza qty/precio no numéricos a 0", () => {
    const c = buildComprobante(
      inv({
        // @ts-expect-error — fuerza valores inválidos como vendrían de un JSON sucio
        lines: [{ desc: "Sucio", qty: "x", unitPrice: null }],
      }),
    );
    expect(c.lines[0].subtotal).toBe(0);
  });
});

describe("estadoDelComprobante · el pill (SDD-0556)", () => {
  const NOW = new Date("2026-10-18T12:00:00Z").getTime();
  const VENCIDA = "2026-06-16";

  it("una anulada vencida con saldo dice «Anulada», no «Vencida» ni «Pendiente»", () => {
    const c = buildComprobante(inv({ status: "anulada", total: 1000, paid: 300, dueDate: VENCIDA }));
    expect(estadoDelComprobante(c, VENCIDA, NOW)).toEqual({
      label: "Anulada",
      color: "var(--doc-ink-soft)",
    });
  });

  it("los estados de una viva no cambian", () => {
    const vencida = buildComprobante(inv({ total: 1000, paid: 300 }));
    expect(estadoDelComprobante(vencida, VENCIDA, NOW).label).toBe("Vencida");
    expect(estadoDelComprobante(vencida, "2026-12-31", NOW).label).toBe("Pendiente");
    expect(estadoDelComprobante(buildComprobante(inv({ paid: 1000 })), VENCIDA, NOW).label).toBe("Pagada");
    expect(estadoDelComprobante(buildComprobante(inv({ total: 0 })), null, NOW).label).toBe("Emitida");
  });
});
