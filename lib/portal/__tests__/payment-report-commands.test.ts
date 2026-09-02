// @vitest-environment node
/** SDD-0365: contrato independiente del transporte de las RPC reales 0421.
 * Sólo se simula I/O de sesión. No hay DB, Storage, Cloud ni claves generadas.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runPaymentReportCommand } from "../payment-report-commands";

const outsideSession = vi.hoisted(() => ({
  createClient: vi.fn(() => { throw new Error("El transporte debe usar la sesión entregada"); }),
  createAdminClient: vi.fn(() => { throw new Error("El transporte no puede elevar permisos"); }),
}));
vi.mock("@/lib/db/server", () => ({ createClient: outsideSession.createClient }));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: outsideSession.createAdminClient }));

type Command = Parameters<typeof runPaymentReportCommand>[1];

const REQUEST_ID = "11000000-0000-4000-8000-000000000001";
const REPORT_ID = "22000000-0000-4000-8000-000000000002";
const INVOICE_ID = "33000000-0000-4000-8000-000000000003";
const AUDIT_ID = "44000000-0000-4000-8000-000000000004";
const TENANT_ID = "55000000-0000-4000-8000-000000000005";
const OBJECT_ID = "66000000-0000-4000-8000-000000000006";
const OTHER_ID = "77000000-0000-4000-8000-000000000007";
const INVOICE_CODE = "F-SYNTH-0365";
const PROOF_PATH = `${TENANT_ID}/${INVOICE_ID}/${REPORT_ID}/${OBJECT_ID}.pdf`;
const REASON = "Comprobante cotejado por el equipo";
const PRIVATE_DETAIL = "PRIVATE_SYNTHETIC_DETAIL_do_not_expose";
// Pares emitidos explícitamente por run_report_command en 0421; no se
// clasifican errores por substring, código aislado o textos de dependencias.
const KNOWN_SQL_ERRORS = [
  { code: "42501", message: "PAYMENT_FORBIDDEN" },
  { code: "22023", message: "PAYMENT_INPUT" },
  { code: "22023", message: "PAYMENT_REASON" },
  { code: "P0002", message: "PAYMENT_NOT_FOUND" },
  { code: "23505", message: "PAYMENT_REQUEST_CONFLICT" },
  { code: "23514", message: "PAYMENT_STATE" },
  { code: "23514", message: "PAYMENT_CURRENCY" },
  { code: "23514", message: "PAYMENT_PENDING_LIMIT" },
  { code: "22023", message: "PAYMENT_PROOF" },
  { code: "23514", message: "PAYMENT_AUDIT" },
] as const;

const createCommand = () => ({
  verb: "create" as const,
  requestId: REQUEST_ID,
  reportId: REPORT_ID,
  invoiceId: INVOICE_ID,
  invoiceCode: INVOICE_CODE,
  input: { amount: 45.5, method: "transferencia" as const, paidAt: "2026-09-01", note: "Nota sintética" },
  proofPath: PROOF_PATH,
});
const cancelCommand = () => ({
  verb: "cancel" as const, requestId: REQUEST_ID, reportId: REPORT_ID, invoiceCode: INVOICE_CODE, reason: REASON,
});
const resolveCommand = (verb: "confirm" | "reject" = "confirm") => ({
  verb, requestId: REQUEST_ID, reportId: REPORT_ID, reason: REASON,
});

function wireReceipt(overrides: Record<string, unknown> = {}) {
  return {
    request_id: REQUEST_ID, report_id: REPORT_ID, invoice_id: INVOICE_ID, invoice_code: INVOICE_CODE,
    status: "reportado", cancelled: false, audit_event_id: AUDIT_ID, replayed: false,
    ...overrides,
  };
}
function appReceipt(overrides: Record<string, unknown> = {}) {
  return {
    requestId: REQUEST_ID, reportId: REPORT_ID, invoiceId: INVOICE_ID, invoiceCode: INVOICE_CODE,
    status: "reportado", cancelled: false, auditEventId: AUDIT_ID, replayed: false,
    ...overrides,
  };
}
function sessionIo(reply: unknown = { data: wireReceipt(), error: null }) {
  const rpc = vi.fn().mockResolvedValue(reply);
  const forbidden = vi.fn(() => { throw new Error("No se permite DML, Storage ni fallback en este transporte"); });
  const session = { rpc, from: forbidden, schema: forbidden, storage: { from: forbidden } } as unknown as SupabaseClient;
  return { session, rpc, forbidden };
}
function expectSafeFailure(result: unknown, uncertain: boolean) {
  expect(result).toEqual({ ok: false, error: expect.any(String), uncertain });
  const error = (result as { error: string }).error;
  expect(error.trim().length).toBeGreaterThan(0);
  expect(error).not.toContain(PRIVATE_DETAIL);
  expect(error).not.toMatch(/PAYMENT_|SQLSTATE|PGRST|postgres|supabase|stack|select\s+\*/i);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-02T12:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
  expect(outsideSession.createClient).not.toHaveBeenCalled();
  expect(outsideSession.createAdminClient).not.toHaveBeenCalled();
});

describe("runPaymentReportCommand · tres RPC de sesión, sin escritores alternativos", () => {
  it("crea mediante create_portal_payment_report y decodifica el recibo mínimo", async () => {
    const { session, rpc, forbidden } = sessionIo();
    await expect(runPaymentReportCommand(session, createCommand())).resolves.toEqual({ ok: true, receipt: appReceipt() });
    expect(rpc.mock.calls).toEqual([["create_portal_payment_report", {
      p_request_id: REQUEST_ID, p_report_id: REPORT_ID, p_invoice_code: INVOICE_CODE,
      p_amount: 45.5, p_method: "transferencia", p_paid_at: "2026-09-01", p_proof_path: PROOF_PATH, p_note: "Nota sintética",
    }]]);
    expect(forbidden).not.toHaveBeenCalled();
  });

  it("cancela mediante cancel_portal_payment_report conservando estado reportado", async () => {
    const { session, rpc, forbidden } = sessionIo({ data: wireReceipt({ cancelled: true }), error: null });
    await expect(runPaymentReportCommand(session, cancelCommand())).resolves.toEqual({ ok: true, receipt: appReceipt({ cancelled: true }) });
    expect(rpc.mock.calls).toEqual([["cancel_portal_payment_report", {
      p_request_id: REQUEST_ID, p_report_id: REPORT_ID, p_invoice_code: INVOICE_CODE, p_reason: REASON,
    }]]);
    expect(forbidden).not.toHaveBeenCalled();
  });

  it.each([
    { verb: "confirm" as const, status: "confirmado" },
    { verb: "reject" as const, status: "rechazado" },
  ])("$verb usa resolve_payment_report con acción y motivo", async ({ verb, status }) => {
    const { session, rpc, forbidden } = sessionIo({ data: wireReceipt({ status }), error: null });
    await expect(runPaymentReportCommand(session, resolveCommand(verb))).resolves.toEqual({ ok: true, receipt: appReceipt({ status }) });
    expect(rpc.mock.calls).toEqual([["resolve_payment_report", {
      p_request_id: REQUEST_ID, p_report_id: REPORT_ID, p_action: status, p_reason: REASON,
    }]]);
    expect(forbidden).not.toHaveBeenCalled();
  });
});

describe("runPaymentReportCommand · validar antes de enviar", () => {
  const factories = [createCommand, cancelCommand, () => resolveCommand("confirm"), () => resolveCommand("reject")];
  const invalidIds = [
    { label: "vacío", value: "" }, { label: "no UUID", value: "not-a-uuid" },
    { label: "NULL", value: null }, { label: "ausente", value: undefined },
    { label: "número", value: 123 }, { label: "sufijo LF", value: `${REQUEST_ID}\n` },
  ];
  it.each(factories.flatMap((make) => ["requestId", "reportId"].flatMap((field) => invalidIds.map(({ label, value }) => ({
    label: `${make().verb} ${field} ${label}`, make, field, value,
  })))))
  ("rechaza $label sin RPC ni DML", async ({ make, field, value }) => {
    const { session, rpc, forbidden } = sessionIo();
    const result = await runPaymentReportCommand(session, { ...make(), [field]: value } as unknown as Command);
    expectSafeFailure(result, false);
    expect(rpc).not.toHaveBeenCalled();
    expect(forbidden).not.toHaveBeenCalled();
  });

  it.each(invalidIds)("create rechaza invoiceId $label antes de enviar", async ({ value }) => {
    const { session, rpc } = sessionIo();
    expectSafeFailure(await runPaymentReportCommand(session, { ...createCommand(), invoiceId: value } as unknown as Command), false);
    expect(rpc).not.toHaveBeenCalled();
  });

  const reasonFactories = [cancelCommand, () => resolveCommand("confirm"), () => resolveCommand("reject")];
  const invalidReasons = [
    { label: "NULL", value: null }, { label: "ausente", value: undefined },
    { label: "vacío", value: "" }, { label: "blanco", value: " \n\t\r " },
    { label: "tres caracteres", value: "abc" }, { label: "tres tras normalizar", value: " \nabc\t " },
    { label: "501 caracteres", value: "x".repeat(501) }, { label: "objeto", value: {} },
  ];
  it.each(reasonFactories.flatMap((make) => invalidReasons.map(({ label, value }) => ({
    label: `${make().verb}: ${label}`, make, value,
  }))))("rechaza motivo $label sin RPC", async ({ make, value }) => {
    const { session, rpc } = sessionIo();
    expectSafeFailure(await runPaymentReportCommand(session, { ...make(), reason: value } as unknown as Command), false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each(reasonFactories.flatMap((make) => ["Bien", "m".repeat(500)].map((reason) => ({
    label: `${make().verb}, ${reason.length} caracteres`, make, reason,
  }))))("normaliza y acepta motivo $label", async ({ make, reason }) => {
    const command = { ...make(), reason: ` \n${reason}\t ` };
    const status = command.verb === "confirm" ? "confirmado" : command.verb === "reject" ? "rechazado" : "reportado";
    const { session, rpc } = sessionIo({ data: wireReceipt({ status, cancelled: command.verb === "cancel" }), error: null });
    const result = await runPaymentReportCommand(session, command);
    expect(result.ok).toBe(true);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0][1].p_reason).toBe(reason);
  });

  it.each([createCommand, cancelCommand].flatMap((make) => ["", " ", "x".repeat(81), "F-INV\nOTRA"].map((value) => ({
    label: `${make().verb}: ${JSON.stringify(value)}`, make, value,
  }))))("rechaza invoiceCode inválido $label", async ({ make, value }) => {
    const { session, rpc } = sessionIo();
    expectSafeFailure(await runPaymentReportCommand(session, { ...make(), invoiceCode: value }), false);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("runPaymentReportCommand · recibo mínimo y concordante", () => {
  it.each([
    { label: "NULL", data: null }, { label: "ausente", data: undefined },
    { label: "array vacío", data: [] }, { label: "array con una fila", data: [wireReceipt()] },
    { label: "string JSON", data: JSON.stringify(wireReceipt()) }, { label: "boolean", data: true },
    { label: "número", data: 1 }, { label: "objeto vacío", data: {} },
    { label: "importe extra", data: wireReceipt({ amount: 45.5 }) },
    { label: "path extra", data: wireReceipt({ proof_path: PRIVATE_DETAIL }) },
    { label: "flag extra", data: wireReceipt({ ok: true }) },
  ])("$label no es éxito ni dispara fallback", async ({ data }) => {
    const { session, rpc, forbidden } = sessionIo({ data, error: null });
    expectSafeFailure(await runPaymentReportCommand(session, createCommand()), true);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(forbidden).not.toHaveBeenCalled();
  });

  it.each(Object.keys(wireReceipt()))("campo requerido %s ausente es incierto", async (field) => {
    const data: Record<string, unknown> = wireReceipt();
    delete data[field];
    const { session } = sessionIo({ data, error: null });
    expectSafeFailure(await runPaymentReportCommand(session, createCommand()), true);
  });

  it.each([
    { request_id: OTHER_ID }, { report_id: OTHER_ID }, { invoice_id: OTHER_ID }, { invoice_code: "F-OTRA" },
    { request_id: 1 }, { report_id: null }, { invoice_id: "no-uuid" }, { audit_event_id: null },
    { audit_event_id: "no-uuid" }, { audit_event_id: `${AUDIT_ID}\n` },
    { invoice_code: null }, { invoice_code: "" }, { cancelled: "false" }, { cancelled: 0 },
    { replayed: "false" }, { replayed: null }, { status: null }, { status: "desconocido" },
  ])("rechaza identidad/tipo del recibo %j", async (overrides) => {
    const { session, rpc } = sessionIo({ data: wireReceipt(overrides), error: null });
    expectSafeFailure(await runPaymentReportCommand(session, createCommand()), true);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it.each([
    { make: createCommand, status: "confirmado", cancelled: false },
    { make: createCommand, status: "rechazado", cancelled: false },
    { make: createCommand, status: "reportado", cancelled: true },
    { make: cancelCommand, status: "reportado", cancelled: false },
    { make: cancelCommand, status: "confirmado", cancelled: true },
    { make: () => resolveCommand("confirm"), status: "reportado", cancelled: false },
    { make: () => resolveCommand("confirm"), status: "rechazado", cancelled: false },
    { make: () => resolveCommand("confirm"), status: "confirmado", cancelled: true },
    { make: () => resolveCommand("reject"), status: "reportado", cancelled: false },
    { make: () => resolveCommand("reject"), status: "confirmado", cancelled: false },
    { make: () => resolveCommand("reject"), status: "rechazado", cancelled: true },
  ])("no acepta transición inesperada $status / cancelled=$cancelled", async ({ make, status, cancelled }) => {
    const { session } = sessionIo({ data: wireReceipt({ status, cancelled }), error: null });
    expectSafeFailure(await runPaymentReportCommand(session, make()), true);
  });

  it("cancel rechaza un código de factura distinto", async () => {
    const { session } = sessionIo({ data: wireReceipt({ cancelled: true, invoice_code: "F-AJENA" }), error: null });
    expectSafeFailure(await runPaymentReportCommand(session, cancelCommand()), true);
  });

  it.each(["confirm", "reject"] as const)("%s rechaza request o reporte ajeno incluso con transición válida", async (verb) => {
    const { session, rpc } = sessionIo();
    for (const overrides of [{ request_id: OTHER_ID }, { report_id: OTHER_ID }]) {
      rpc.mockResolvedValueOnce({ data: wireReceipt({ status: verb === "confirm" ? "confirmado" : "rechazado", ...overrides }), error: null });
      expectSafeFailure(await runPaymentReportCommand(session, resolveCommand(verb)), true);
    }
  });
});

describe("runPaymentReportCommand · errores seguros sin fallback", () => {
  it.each(KNOWN_SQL_ERRORS)("traduce el par exacto $code / $message como rechazo conocido", async (sqlError) => {
    const { session, rpc, forbidden } = sessionIo({
      data: null, error: { ...sqlError, details: PRIVATE_DETAIL, hint: `select * from ${PRIVATE_DETAIL}` },
    });
    expectSafeFailure(await runPaymentReportCommand(session, createCommand()), false);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(forbidden).not.toHaveBeenCalled();
  });

  it.each(KNOWN_SQL_ERRORS)("mensaje $message con código diferente no es un rechazo reconocido", async (sqlError) => {
    const { session, rpc } = sessionIo({ data: null, error: { ...sqlError, code: "XX000", details: PRIVATE_DETAIL } });
    expectSafeFailure(await runPaymentReportCommand(session, createCommand()), true);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it.each(KNOWN_SQL_ERRORS)("código $code con texto ajeno no autoriza revelar mensajes", async (sqlError) => {
    const { session } = sessionIo({ data: null, error: { ...sqlError, message: PRIVATE_DETAIL } });
    expectSafeFailure(await runPaymentReportCommand(session, createCommand()), true);
  });

  it.each([
    "PAYMENT_STATE ", " PAYMENT_STATE", "PAYMENT_STATE\n", "payment_state",
    `PAYMENT_STATE: ${PRIVATE_DETAIL}`, `prefix PAYMENT_STATE ${PRIVATE_DETAIL}`,
  ])("no reconoce coincidencia parcial o normalizada: %j", async (message) => {
    const { session } = sessionIo({ data: null, error: { code: "23514", message, details: PRIVATE_DETAIL } });
    expectSafeFailure(await runPaymentReportCommand(session, createCommand()), true);
  });

  it.each([
    { label: "RPC todavía ausente", code: "PGRST202", message: `Could not find the function ${PRIVATE_DETAIL}` },
    { label: "timeout", code: "57014", message: PRIVATE_DETAIL },
    { label: "conexión perdida", code: "08006", message: PRIVATE_DETAIL },
    { label: "restricción desconocida", code: "23514", message: `constraint ${PRIVATE_DETAIL}` },
    { label: "recibo inmutable fuera del API", code: "55000", message: "PAYMENT_RECEIPT_IMMUTABLE" },
  ])("$label permanece incierto sin DML ni RPC alternativa", async ({ code, message }) => {
    const { session, rpc, forbidden } = sessionIo({ data: null, error: { code, message, details: PRIVATE_DETAIL } });
    expectSafeFailure(await runPaymentReportCommand(session, createCommand()), true);
    expect(rpc.mock.calls.map(([name]) => name)).toEqual(["create_portal_payment_report"]);
    expect(forbidden).not.toHaveBeenCalled();
  });

  it.each([
    { label: "Error", error: new Error(PRIVATE_DETAIL) },
    { label: "string", error: PRIVATE_DETAIL },
    { label: "objeto", error: { code: "42501", message: "PAYMENT_FORBIDDEN", details: PRIVATE_DETAIL } },
  ])("rechazo de transporte $label se resuelve como incierto, no lanza ni reintenta", async ({ error }) => {
    const { session, rpc, forbidden } = sessionIo();
    rpc.mockRejectedValueOnce(error);
    expectSafeFailure(await runPaymentReportCommand(session, createCommand()), true);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(forbidden).not.toHaveBeenCalled();
  });

  it("excepción síncrona de rpc se convierte en resultado incierto", async () => {
    const { session, rpc } = sessionIo();
    rpc.mockImplementationOnce(() => { throw new Error(PRIVATE_DETAIL); });
    expectSafeFailure(await runPaymentReportCommand(session, cancelCommand()), true);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it.each([
    { label: "undefined", reply: undefined }, { label: "NULL", reply: null },
    { label: "array", reply: [] }, { label: "texto", reply: PRIVATE_DETAIL },
    { label: "objeto vacío", reply: {} },
    { label: "error sin contrato", reply: { data: wireReceipt(), error: { details: PRIVATE_DETAIL } } },
  ])("envoltorio de respuesta $label no es éxito", async ({ reply }) => {
    const { session, rpc } = sessionIo();
    rpc.mockResolvedValueOnce(reply);
    expectSafeFailure(await runPaymentReportCommand(session, createCommand()), true);
  });

  it("un recibo aparente no neutraliza el error de la misma respuesta", async () => {
    const { session } = sessionIo({ data: wireReceipt(), error: { code: "23514", message: "PAYMENT_STATE" } });
    expectSafeFailure(await runPaymentReportCommand(session, createCommand()), false);
  });
});

describe("runPaymentReportCommand · identidad estable e idempotencia del consumidor", () => {
  it.each([
    { make: createCommand, status: "reportado", cancelled: false },
    { make: cancelCommand, status: "reportado", cancelled: true },
    { make: () => resolveCommand("confirm"), status: "confirmado", cancelled: false },
    { make: () => resolveCommand("reject"), status: "rechazado", cancelled: false },
  ])("repetir $status / cancelled=$cancelled conserva claves y sólo cambia replayed", async ({ make, status, cancelled }) => {
    const command = make();
    const original = structuredClone(command);
    Object.freeze(command);
    if ("input" in command) Object.freeze(command.input);
    const { session, rpc, forbidden } = sessionIo();
    rpc.mockResolvedValueOnce({ data: wireReceipt({ status, cancelled }), error: null });
    rpc.mockResolvedValueOnce({ data: wireReceipt({ status, cancelled, replayed: true }), error: null });

    await expect(runPaymentReportCommand(session, command)).resolves.toEqual({
      ok: true, receipt: appReceipt({ status, cancelled }),
    });
    expect(rpc).toHaveBeenCalledTimes(1);
    await expect(runPaymentReportCommand(session, command)).resolves.toEqual({
      ok: true, receipt: appReceipt({ status, cancelled, replayed: true }),
    });
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1]);
    expect(rpc.mock.calls[1][1]).toMatchObject({ p_request_id: REQUEST_ID, p_report_id: REPORT_ID });
    expect(command).toEqual(original);
    expect(forbidden).not.toHaveBeenCalled();
  });

  it("tras respuesta perdida sólo el consumidor decide repetir con las mismas claves", async () => {
    const command = createCommand();
    const { session, rpc, forbidden } = sessionIo();
    rpc.mockRejectedValueOnce(new Error(PRIVATE_DETAIL));
    rpc.mockResolvedValueOnce({ data: wireReceipt({ replayed: true }), error: null });
    expectSafeFailure(await runPaymentReportCommand(session, command), true);
    expect(rpc).toHaveBeenCalledTimes(1);
    await expect(runPaymentReportCommand(session, command)).resolves.toEqual({ ok: true, receipt: appReceipt({ replayed: true }) });
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1]);
    expect(forbidden).not.toHaveBeenCalled();
  });
});

describe("runPaymentReportCommand · alta validada antes de RPC", () => {
  it.each([
    { label: "monto string no normalizado", input: { amount: "1.10" } },
    { label: "monto NaN", input: { amount: Number.NaN } },
    { label: "monto infinito", input: { amount: Number.POSITIVE_INFINITY } },
    { label: "monto cero", input: { amount: 0 } },
    { label: "monto mayor al máximo", input: { amount: 10_000_000 } },
    { label: "monto con tres decimales", input: { amount: 1.001 } },
    { label: "método fuera del enum", input: { method: "tarjeta_inventada" } },
    { label: "fecha inexistente", input: { paidAt: "2026-02-30" } },
    { label: "fecha futura", input: { paidAt: "2026-09-03" } },
    { label: "año 0000 que PostgreSQL no acepta", input: { paidAt: "0000-01-01" } },
    { label: "nota de 501 caracteres", input: { note: "x".repeat(501) } },
  ])("rechaza $label sin enviar la operación", async ({ input }) => {
    const command = createCommand();
    const { session, rpc, forbidden } = sessionIo();
    const result = await runPaymentReportCommand(session, {
      ...command, input: { ...command.input, ...input },
    } as unknown as Command);
    expectSafeFailure(result, false);
    expect(rpc).not.toHaveBeenCalled();
    expect(forbidden).not.toHaveBeenCalled();
  });

  it.each([
    { label: "factura ajena", path: `${TENANT_ID}/${OTHER_ID}/${REPORT_ID}/${OBJECT_ID}.pdf` },
    { label: "reporte ajeno", path: `${TENANT_ID}/${INVOICE_ID}/${OTHER_ID}/${OBJECT_ID}.pdf` },
    { label: "URL no canónica", path: `https://example.invalid/${PROOF_PATH}` },
    { label: "LF al final", path: `${PROOF_PATH}\n` },
  ])("rechaza comprobante con $label antes de RPC", async ({ path }) => {
    const { session, rpc, forbidden } = sessionIo();
    expectSafeFailure(await runPaymentReportCommand(session, { ...createCommand(), proofPath: path }), false);
    expect(rpc).not.toHaveBeenCalled();
    expect(forbidden).not.toHaveBeenCalled();
  });

  it.each([1.10, 0.29])("acepta monto decimal legítimo %s sin falso rechazo por coma flotante", async (amount) => {
    const command = createCommand();
    const { session, rpc } = sessionIo();
    await expect(runPaymentReportCommand(session, {
      ...command, input: { ...command.input, amount },
    })).resolves.toEqual({ ok: true, receipt: appReceipt() });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0][1].p_amount).toBe(amount);
  });

  it("acepta nota de 500 caracteres tras normalizar y fecha actual", async () => {
    const command = createCommand();
    const { session, rpc } = sessionIo();
    await expect(runPaymentReportCommand(session, {
      ...command, input: { ...command.input, note: ` \n${"x".repeat(500)}\t `, paidAt: "2026-09-02" },
    })).resolves.toEqual({ ok: true, receipt: appReceipt() });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_note: "x".repeat(500), p_paid_at: "2026-09-02" });
  });
});
