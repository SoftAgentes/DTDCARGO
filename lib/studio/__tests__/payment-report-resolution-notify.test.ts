// @vitest-environment node
/**
 * SDD-0556 · El aviso al cliente cuando el equipo resuelve su reporte de pago.
 *
 * Sesión y admin son dobles que APLICAN los filtros (`lectores-admin-double`):
 * lo que se prueba incluye QUÉ fila se lee y con qué cliente. El correo es un
 * spy de `sendEmail`. Todo es sintético; no hay datos de producción.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { dobleLectores, type DobleLectores, type Fila } from "./lectores-admin-double";
import type { PaymentCommandReceipt } from "@/lib/portal/payment-report-commands";

const h = vi.hoisted(() => ({
  admin: null as unknown,
  adminBuilds: 0,
  sendEmail: vi.fn(),
}));

vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => {
    h.adminBuilds += 1;
    return h.admin;
  },
}));
vi.mock("@/lib/studio/mail/send-email", () => ({ sendEmail: h.sendEmail }));

import {
  buildPaymentResolutionEmail,
  notifyPaymentReportResolutionToClient,
} from "../payment-report-resolution-notify";

const TENANT = "22000000-0000-4000-8000-000000000002";
const OTRO_TENANT = "99000000-0000-4000-8000-000000000009";
const INVOICE = "33000000-0000-4000-8000-000000000003";
const REPORT = "44000000-0000-4000-8000-000000000004";
const CODE = "F-SYNTH-1";
const MARK = "DTD-SYNTH-1";
const CORREO = "cliente.sintetico@example.test";

function receipt(over: Partial<PaymentCommandReceipt> = {}): PaymentCommandReceipt {
  return {
    requestId: "55000000-0000-4000-8000-000000000005",
    reportId: REPORT,
    invoiceId: INVOICE,
    invoiceCode: CODE,
    status: "confirmado",
    cancelled: false,
    auditEventId: "66000000-0000-4000-8000-000000000006",
    replayed: false,
    ...over,
  };
}

function reporte(over: Fila = {}): Fila {
  return {
    id: REPORT,
    tenant_id: TENANT,
    invoice_id: INVOICE,
    invoice_code: CODE,
    client_markbox: MARK,
    amount: 45.5,
    currency: "USD",
    method: "transferencia",
    paid_at: "2026-09-01",
    status: "confirmado",
    resolution_reason: "Pago cotejado con el comprobante",
    cancelled_at: null,
    deleted_at: null,
    ...over,
  };
}

let sesion: DobleLectores;
let admin: DobleLectores;

function preparar(opts: { reportes?: Fila[]; clientes?: Fila[] } = {}) {
  sesion = dobleLectores({ payment_reports: opts.reportes ?? [reporte()] });
  admin = dobleLectores(
    {
      clients: opts.clientes ?? [
        { id: "c1", tenant_id: TENANT, markbox: MARK, email: CORREO, deleted_at: null },
        // Mismo Shipping Mark en otro tenant: nunca es el destinatario.
        { id: "c9", tenant_id: OTRO_TENANT, markbox: MARK, email: "ajeno@example.test", deleted_at: null },
      ],
    },
    {
      resolve_markbox: (args, store) => {
        // Sigue la fusión: el final de la cadena del Shipping Mark pedido.
        const ficha = (store.clients ?? []).find(
          (c) => c.tenant_id === args.p_tenant_id && c.markbox === args.p_markbox,
        );
        const destino = ficha?.merged_into_client_id ?? ficha?.id ?? null;
        return { data: destino ? [{ client_id: destino }] : [], error: null };
      },
    },
  );
  h.admin = admin.client;
}

const notificar = (r: PaymentCommandReceipt = receipt()) =>
  notifyPaymentReportResolutionToClient(sesion.client as SupabaseClient, r);

beforeEach(() => {
  h.adminBuilds = 0;
  h.sendEmail.mockReset();
  h.sendEmail.mockResolvedValue({ ok: true, logId: "log-1", resendId: null, queued: false });
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("buildPaymentResolutionEmail", () => {
  const base = {
    invoiceCode: CODE,
    amount: 45.5,
    currency: "USD" as const,
    method: "transferencia" as const,
    paidAt: "2026-09-01",
    portalUrl: "https://dtdcargo.com/portal/facturas/F-SYNTH-1",
  };

  it("confirmación: asunto, monto, método y fecha; sin motivo y sin prometer recibo", () => {
    const { subject, html } = buildPaymentResolutionEmail({
      ...base,
      status: "confirmado",
      reason: "Nota interna que no va",
    });
    expect(subject).toBe("Confirmamos tu pago · F-SYNTH-1");
    expect(html).toContain("Registramos tu pago de USD 45.50 en la factura F-SYNTH-1.");
    expect(html).toContain("Transferencia");
    expect(html).toContain("01/09/2026");
    expect(html).toContain('href="https://dtdcargo.com/portal/facturas/F-SYNTH-1"');
    expect(html).not.toContain("Nota interna que no va");
    expect(html).not.toMatch(/recibo/i);
    expect(html).toContain("font-family:Archivo, system-ui, sans-serif");
  });

  it("rechazo: asunto, motivo y la salida; un motivo con HTML sale escapado", () => {
    const { subject, html } = buildPaymentResolutionEmail({
      ...base,
      status: "rechazado",
      reason: "<script>alert(1)</script> monto distinto",
    });
    expect(subject).toBe("No pudimos confirmar tu pago · F-SYNTH-1");
    expect(html).toContain("Escríbele a tu asesor o repórtalo de nuevo desde tu portal.");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt; monto distinto");
    expect(html).not.toContain("<script>");
  });

  it("no lleva saldo de la factura ni voseo", () => {
    const { html } = buildPaymentResolutionEmail({ ...base, status: "confirmado", reason: null });
    expect(html).not.toMatch(/saldo/i);
    expect(html).not.toMatch(/\b(escribinos|podés|tenés|revisá)\b/i);
  });
});

describe("notifyPaymentReportResolutionToClient", () => {
  it("confirmación: un correo a la ficha viva del tenant del reporte", async () => {
    preparar();
    await notificar();
    expect(h.sendEmail).toHaveBeenCalledOnce();
    const [cliente, tenant, input] = h.sendEmail.mock.calls[0];
    expect(cliente).toBe(admin.client);
    expect(tenant).toBe(TENANT);
    expect(input).toMatchObject({
      to: CORREO,
      subject: "Confirmamos tu pago · F-SYNTH-1",
      metadata: {
        source: "payment-report-resolution-notify",
        code: CODE,
        status: "confirmado",
        report_id: REPORT,
      },
    });
    expect(input.html).toContain("USD 45.50");
  });

  it("rechazo: el correo lleva el motivo del reporte, escapado", async () => {
    preparar({ reportes: [reporte({ status: "rechazado", resolution_reason: "Comprobante <ilegible>" })] });
    await notificar(receipt({ status: "rechazado" }));
    expect(h.sendEmail).toHaveBeenCalledOnce();
    const input = h.sendEmail.mock.calls[0][2];
    expect(input.subject).toBe("No pudimos confirmar tu pago · F-SYNTH-1");
    expect(input.html).toContain("Comprobante &lt;ilegible&gt;");
  });

  it("lee el reporte con la sesión, por id y factura del recibo, y la ficha con admin acotada al tenant del reporte", async () => {
    preparar();
    await notificar();
    expect(sesion.filtros.filter((f) => f.table === "payment_reports")).toEqual(
      expect.arrayContaining([
        { table: "payment_reports", op: "eq", col: "id", val: REPORT },
        { table: "payment_reports", op: "eq", col: "invoice_id", val: INVOICE },
        { table: "payment_reports", op: "is", col: "deleted_at", val: null },
      ]),
    );
    expect(admin.filtros.filter((f) => f.table === "clients")).toEqual(
      expect.arrayContaining([
        { table: "clients", op: "eq", col: "tenant_id", val: TENANT },
        { table: "clients", op: "eq", col: "markbox", val: MARK },
      ]),
    );
    // Nada de facturas: el inventario de lecturas de `invoices` no cambia.
    expect([...sesion.filtros, ...admin.filtros].some((f) => f.table === "invoices")).toBe(false);
  });

  it.each([
    ["el reporte no existe", { reportes: [] }, receipt()],
    ["el estado del reporte no es el del recibo", { reportes: [reporte({ status: "reportado" })] }, receipt()],
    ["el reporte fue cancelado", { reportes: [reporte({ cancelled_at: "2026-09-02T00:00:00Z" })] }, receipt()],
    ["la factura del reporte no es la del recibo", { reportes: [reporte({ invoice_code: "F-OTRA" })] }, receipt()],
    ["el reporte está borrado", { reportes: [reporte({ deleted_at: "2026-09-02T00:00:00Z" })] }, receipt()],
  ] as const)("sin aviso ni admin si %s", async (_label, opts, r) => {
    preparar({ reportes: [...opts.reportes] });
    await notificar(r);
    expect(h.sendEmail).not.toHaveBeenCalled();
    expect(h.adminBuilds).toBe(0);
  });

  it("un replay no lee ni envía nada", async () => {
    preparar();
    await notificar(receipt({ replayed: true }));
    expect(sesion.filtros).toEqual([]);
    expect(h.adminBuilds).toBe(0);
    expect(h.sendEmail).not.toHaveBeenCalled();
  });

  it("una cancelación o un reporte apenas creado no avisan", async () => {
    preparar();
    await notificar(receipt({ cancelled: true }));
    await notificar(receipt({ status: "reportado" }));
    expect(h.sendEmail).not.toHaveBeenCalled();
    expect(sesion.filtros).toEqual([]);
  });

  it("ficha eliminada sin fusión: a un cliente eliminado no se le escribe", async () => {
    preparar({
      clientes: [{ id: "c1", tenant_id: TENANT, markbox: MARK, email: CORREO, deleted_at: "2026-09-01T00:00:00Z" }],
    });
    await notificar();
    expect(h.sendEmail).not.toHaveBeenCalled();
  });

  it("ficha fusionada: el correo va al cliente vigente", async () => {
    preparar({
      clientes: [
        { id: "c1", tenant_id: TENANT, markbox: MARK, email: "viejo@example.test", deleted_at: "2026-09-01T00:00:00Z", merged_into_client_id: "c2" },
        { id: "c2", tenant_id: TENANT, markbox: "DTD-VIGENTE", email: "vigente@example.test", deleted_at: null },
      ],
    });
    await notificar();
    expect(h.sendEmail).toHaveBeenCalledOnce();
    expect(h.sendEmail.mock.calls[0][2].to).toBe("vigente@example.test");
  });

  it("si el envío falla o lanza, resuelve sin lanzar y el registro no lleva el correo ni el monto", async () => {
    preparar();
    h.sendEmail.mockResolvedValueOnce({ ok: false, error: `no se pudo a ${CORREO}` });
    await expect(notificar()).resolves.toBeUndefined();
    h.sendEmail.mockRejectedValueOnce(new Error(`fallo con ${CORREO}`));
    await expect(notificar()).resolves.toBeUndefined();
    const registros = (console.error as unknown as { mock: { calls: unknown[][] } }).mock.calls
      .flat()
      .map(String)
      .join(" ");
    expect(registros).toContain(CODE);
    expect(registros).not.toContain(CORREO);
    expect(registros).not.toContain("45.5");
  });
});
