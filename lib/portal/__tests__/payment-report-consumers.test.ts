// @vitest-environment node
/** SDD-0365: acciones, identidad, RBAC, transporte y upload REALES;
 * únicamente DB/Storage/Next/avisos son fronteras sintéticas. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
const mocks = vi.hoisted(() => ({ createClient: vi.fn(), createAdminClient: vi.fn(), notify: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/db/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/studio/payment-report-notify", () => ({ notifyPaymentReportToAdmin: mocks.notify }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { reportPaymentAction, cancelPaymentReportAction } from "@/app/portal/(app)/facturas/[code]/reportar/actions";
import { resolvePaymentReport } from "@/app/studio/(app)/facturacion/payment-report-actions";

const CLIENT = "11000000-0000-4000-8000-000000000001";
const TENANT = "22000000-0000-4000-8000-000000000002";
const INVOICE = "33000000-0000-4000-8000-000000000003";
const REPORT = "44000000-0000-4000-8000-000000000004";
const REQUEST = "55000000-0000-4000-8000-000000000005";
const AUDIT = "66000000-0000-4000-8000-000000000006";
const ACTOR = "77000000-0000-4000-8000-000000000007";
const OTHER = "88000000-0000-4000-8000-000000000008";
const CODE = "F-SYNTH-0365";
const MARK = "DTD-SYNTH-0365";
const REASON = "Pago cotejado con el comprobante";
const PRIVATE = "synthetic_private_db_detail";
type Row = Record<string, unknown>;
type Reply = { data?: unknown; error: { code: string; message: string } | null; count?: number | null };
type Outcome = { ok?: boolean; error?: string; uncertain?: boolean; receipt?: Row; fieldErrors?: Record<string, string> };
const resolveAction = resolvePaymentReport;

function wire(status = "reportado", cancelled = false): Row {
  return { request_id: REQUEST, report_id: REPORT, invoice_id: INVOICE, invoice_code: CODE,
    status, cancelled, audit_event_id: AUDIT, replayed: false };
}
function receipt(status = "reportado", cancelled = false): Row {
  return { requestId: REQUEST, reportId: REPORT, invoiceId: INVOICE, invoiceCode: CODE,
    status, cancelled, auditEventId: AUDIT, replayed: false };
}
function form(overrides: Record<string, string> = {}): FormData {
  const value = new FormData();
  for (const [key, text] of Object.entries({ request_id: REQUEST, report_id: REPORT, reason: REASON,
    amount: "45.50", method: "transferencia", paid_at: "2026-09-01", note: "Nota del cliente", ...overrides })) value.set(key, text);
  value.set("proof", new File(["%PDF-1.4\nsynthetic"], "proof.pdf", { type: "application/pdf" }));
  return value;
}

function io(options: { portal?: boolean; role?: string | null; disabled?: boolean; pending?: number | null;
  preflightError?: "invoices" | "payment_reports"; commandReply?: Reply; commandThrow?: boolean;
  commitBeforeError?: boolean; invoiceStatus?: string; existing?: Row } = {}) {
  const client = { id: CLIENT, tenant_id: TENANT, markbox: MARK, name: "Cliente sintético", deleted_at: null };
  const invoice = { id: INVOICE, tenant_id: TENANT, invoice_code: CODE, client_markbox: MARK,
    currency: "USD", status: options.invoiceStatus ?? "emitida", total_amount: 1000, paid_amount: 20, deleted_at: null };
  const state = { reports: options.existing ? [options.existing] : [] as Row[], objects: new Map<string, Uint8Array>(),
    commands: [] as { name: string; args: Row }[], legacy: [] as string[], dml: [] as { table: string; row: Row }[],
    reads: [] as { source: string; table: string; filters: [string, unknown][] }[], receipts: new Map<string, Row>() };
  const query = (source: string, table: string) => {
    const filters: [string, unknown][] = [];
    state.reads.push({ source, table, filters });
    let countOnly = false;
    const result = (single = false): Reply => {
      if (source === "admin" && options.preflightError === table) return { data: null, count: null, error: { code: "57014", message: PRIVATE } };
      if (countOnly) return { data: null, count: options.pending === undefined ? 0 : options.pending, error: null };
      const candidates: Row[] = table === "client_users"
        ? (options.portal === false ? [] : [{
            auth_user_id: ACTOR, status: "active", client_id: CLIENT,
            tenant_id: TENANT, clients: client,
          }])
        : table === "clients" ? [client] : table === "invoices" ? [invoice]
        : table === "payment_reports" ? state.reports : table === "user_tenants"
          ? [{ user_id: ACTOR, tenant_id: TENANT, role: options.role === undefined ? "accounting" : options.role,
            disabled_at: options.disabled ? "2026-09-01" : null, warehouse_scope: "all" }]
          : [];
      const rows = candidates.filter((row) => filters.every(([field, value]) => row[field] === value));
      return { data: single ? rows[0] ?? null : rows, error: null };
    };
    const builder: Record<string, unknown> = {};
    Object.assign(builder, {
      select: (_columns: string, config?: { head?: boolean }) => { countOnly = Boolean(config?.head); return builder; },
      eq: (key: string, value: unknown) => { filters.push([key, value]); return builder; },
      is: (key: string, value: unknown) => { filters.push([key, value]); return builder; },
      limit: () => builder, order: () => builder,
      maybeSingle: () => Promise.resolve(result(true)), returns: () => Promise.resolve(result()),
      then: (resolve: (reply: Reply) => unknown, reject: (error: unknown) => unknown) => Promise.resolve(result()).then(resolve, reject),
      insert: async (row: Row) => { state.dml.push({ table, row }); state.reports.push(row); return { data: null, error: null }; },
      update: (row: Row) => { state.dml.push({ table, row }); return { ...builder,
        then: (resolve: (reply: Reply) => unknown) => Promise.resolve({ data: null, count: 1, error: null }).then(resolve) }; },
    });
    return builder;
  };
  const rpc = vi.fn(async (name: string, args: Row = {}): Promise<Reply> => {
    if (name === "get_portal_client_id") return { data: options.portal === false ? null : CLIENT, error: null };
    if (name === "get_portal_client_markbox") return { data: options.portal === false ? null : MARK, error: null };
    if (name === "confirm_payment_report") { state.legacy.push(name); return options.commandReply ?? { data: { invoice_code: CODE }, error: null }; }
    state.commands.push({ name, args });
    const previous = state.receipts.get(String(args.p_request_id));
    if (previous) return { data: { ...previous, replayed: true }, error: null };
    const status = name === "resolve_payment_report" ? String(args.p_action) : "reportado";
    const value = { ...wire(status, name === "cancel_portal_payment_report"), request_id: args.p_request_id, report_id: args.p_report_id };
    if ((!options.commandReply && !options.commandThrow) || options.commitBeforeError) {
      state.receipts.set(String(args.p_request_id), value);
      if (name === "create_portal_payment_report") state.reports.push({ id: args.p_report_id, tenant_id: TENANT,
        invoice_id: INVOICE, invoice_code: CODE, client_markbox: MARK, status: "reportado", deleted_at: null,
        proof_path: args.p_proof_path, amount: args.p_amount, currency: "USD", method: args.p_method,
        paid_at: args.p_paid_at, note: args.p_note, cancelled_at: null, cancelled_by: null, resolution_reason: null });
    }
    if (options.commandThrow) throw new Error(PRIVATE);
    return options.commandReply ?? { data: value, error: null };
  });
  const session = { rpc, from: (table: string) => query("session", table), auth: {
    getUser: async () => ({ data: { user: { id: ACTOR } }, error: null }),
  } } as unknown as SupabaseClient;
  const upload = vi.fn(async (path: string, bytes: Uint8Array, config: { upsert: boolean }) => {
    if (config.upsert) throw new Error("No se sobrescribe evidencia");
    if (state.objects.has(path)) return { data: null, error: { statusCode: "409", message: "exists" } };
    state.objects.set(path, new Uint8Array(bytes));
    return { data: { path }, error: null };
  });
  const download = vi.fn(async (path: string) => ({
    data: state.objects.has(path) ? new Blob([new Uint8Array(state.objects.get(path)!)]): null,
    error: state.objects.has(path) ? null : { message: "missing" },
  }));
  const remove = vi.fn(async () => { throw new Error("No se elimina evidencia"); });
  const admin = { from: (table: string) => query("admin", table), storage: { from: (bucket: string) => {
    expect(bucket).toBe("payment-proofs"); return { upload, download, remove };
  } } } as unknown as SupabaseClient;
  mocks.createClient.mockResolvedValue(session);
  mocks.createAdminClient.mockReturnValue(admin);
  return { state, invoice, rpc, upload, download, remove };
}

beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-02T12:00:00Z")); mocks.notify.mockResolvedValue(undefined); });
afterEach(() => { vi.useRealTimers(); });

describe("consumidores de comandos auditados", () => {
  it("Portal crea con las claves recibidas, RPC de sesión y recibo validado", async () => {
    const { state } = io();
    const result = await reportPaymentAction(CODE, {}, form()) as Outcome;
    expect(result).toMatchObject({ ok: true, receipt: receipt() });
    expect(state.dml).toEqual([]);
    expect(state.commands).toEqual([{ name: "create_portal_payment_report", args: {
      p_request_id: REQUEST, p_report_id: REPORT, p_invoice_code: CODE, p_amount: 45.5,
      p_method: "transferencia", p_paid_at: "2026-09-01", p_note: "Nota del cliente", p_proof_path: [...state.objects.keys()][0],
    } }]);
    expect([...state.objects.keys()][0]).toMatch(new RegExp(`^${TENANT}/${INVOICE}/${REPORT}/`));
    expect(mocks.notify).toHaveBeenCalledOnce();
  });

  it("Portal cancela por RPC, con motivo y sin admin ni UPDATE", async () => {
    const { state } = io();
    expect(await cancelPaymentReportAction(CODE, {}, form())).toMatchObject({ ok: true, receipt: receipt("reportado", true) });
    expect(state.commands).toEqual([{ name: "cancel_portal_payment_report", args: {
      p_request_id: REQUEST, p_report_id: REPORT, p_invoice_code: CODE, p_reason: REASON,
    } }]);
    expect(state.dml).toEqual([]);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it.each(["confirmado", "rechazado"] as const)("Studio %s usa permiso vigente y la RPC nueva", async (action) => {
    const { state } = io();
    expect(await resolveAction(REPORT, action, REASON, REQUEST)).toMatchObject({ ok: true, receipt: receipt(action) });
    expect(state.commands).toEqual([{ name: "resolve_payment_report", args: {
      p_request_id: REQUEST, p_report_id: REPORT, p_action: action, p_reason: REASON,
    } }]);
    expect(state.legacy).toEqual([]);
    expect(state.dml).toEqual([]);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });
});

describe("consumidores · permiso, entrada y preflight fail-closed", () => {
  const invalidInputs: { action: "create" | "cancel"; values: Record<string, string> }[] = [
    { action: "create", values: { request_id: "" } },
    { action: "create", values: { report_id: "no-uuid" } },
    { action: "cancel", values: { request_id: "" } },
    { action: "cancel", values: { reason: "abc" } },
  ];
  it.each(invalidInputs)("$action rechaza identidad/motivo inválido antes de efectos", async ({ action, values }) => {
    const { state, upload } = io();
    const result = action === "create" ? await reportPaymentAction(CODE, {}, form(values)) : await cancelPaymentReportAction(CODE, {}, form(values));
    expect(result.ok).not.toBe(true);
    expect(result.error).toMatch(/\S/);
    expect(state.commands).toEqual([]);
    expect(state.dml).toEqual([]);
    expect(upload).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it("sin principal Portal no crea cliente admin ni efectos", async () => {
    const { state, upload } = io({ portal: false });
    expect((await reportPaymentAction(CODE, {}, form())).ok).not.toBe(true);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
    expect(state.commands).toEqual([]);
    expect(upload).not.toHaveBeenCalled();
  });

  it.each([
    { label: "rol no financiero", options: { role: "marketing" } },
    { label: "membresía desactivada", options: { disabled: true } },
    { label: "sin rol vigente", options: { role: null } },
  ])("Studio mantiene RBAC real: $label", async ({ options }) => {
    const { state } = io(options);
    expect((await resolveAction(REPORT, "confirmado", REASON, REQUEST)).ok).not.toBe(true);
    expect(state.commands).toEqual([]);
    expect(state.legacy).toEqual([]);
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it("Studio exige requestId y motivo antes de resolver", async () => {
    const { state } = io();
    for (const [reason, request] of [[REASON, ""], ["abc", REQUEST]]) {
      expect((await resolveAction(REPORT, "confirmado", reason, request)).ok).not.toBe(true);
    }
    expect(state.commands).toEqual([]);
    expect(state.legacy).toEqual([]);
  });

  it.each(["invoices", "payment_reports"] as const)("error preflight de %s corta antes del upload", async (preflightError) => {
    const { state, upload, remove } = io({ preflightError });
    const result = await reportPaymentAction(CODE, {}, form());
    expect(result.ok).not.toBe(true);
    expect(result.error).toMatch(/\S/);
    expect(result.error).not.toContain(PRIVATE);
    expect(upload).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(state.commands).toEqual([]);
    expect(state.dml).toEqual([]);
    expect(mocks.notify).not.toHaveBeenCalled();
  });
});

describe("consumidores · resultado comprobable y recuperación", () => {
  it.each([
    { label: "create NULL", action: "create", options: { commandReply: { data: null, error: null } } },
    { label: "cancel recibo malformado", action: "cancel", options: { commandReply: { data: { ...wire("reportado", true), proof_path: PRIVATE }, error: null } } },
    { label: "Studio error SQL ajeno", action: "studio", options: { commandReply: { data: null, error: { code: "23514", message: PRIVATE } } } },
    { label: "Studio excepción transporte", action: "studio", options: { commandThrow: true } },
  ])("$label no devuelve éxito ni filtra datos de la dependencia", async ({ action, options }) => {
    const { state, remove } = io(options);
    const result = (action === "create" ? await reportPaymentAction(CODE, {}, form())
      : action === "cancel" ? await cancelPaymentReportAction(CODE, {}, form())
        : await resolveAction(REPORT, "confirmado", REASON, REQUEST)) as Outcome;
    expect(result).toMatchObject({ error: expect.any(String), uncertain: true });
    expect(result.ok).not.toBe(true);
    expect(result.error).not.toMatch(/synthetic_private|SQLSTATE|PAYMENT_/);
    expect(state.dml).toEqual([]);
    expect(state.legacy).toEqual([]);
    expect(remove).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it("replay propio recupera recibo aun con factura pagada y cinco pendientes, sin otro aviso", async () => {
    const options = { pending: 0 };
    const { state, invoice, remove } = io(options);
    const first = await reportPaymentAction(CODE, {}, form()) as Outcome;
    expect(first).toMatchObject({ ok: true, receipt: receipt() });
    const proof = [...state.objects.keys()][0];
    invoice.status = "pagada";
    options.pending = 5;
    const replay = await reportPaymentAction(CODE, {}, form()) as Outcome;
    expect(replay).toMatchObject({ ok: true, receipt: { ...receipt(), replayed: true } });
    expect(state.commands).toHaveLength(2);
    expect(state.commands[0]).toEqual(state.commands[1]);
    expect([...state.objects.keys()]).toEqual([proof]);
    expect(mocks.notify).toHaveBeenCalledOnce();
    expect(remove).not.toHaveBeenCalled();
    expect(state.dml).toEqual([]);
  });

  it("respuesta perdida conserva evidencia y permite recuperar el mismo intento", async () => {
    const { state, invoice, remove } = io({ commandThrow: true, commitBeforeError: true });
    const uncertain = await reportPaymentAction(CODE, {}, form()) as Outcome;
    expect(uncertain).toMatchObject({ uncertain: true, error: expect.any(String) });
    expect(uncertain.ok).not.toBe(true);
    expect(state.objects.size).toBe(1);
    invoice.status = "pagada";
    const replay = await reportPaymentAction(CODE, {}, form()) as Outcome;
    expect(replay).toMatchObject({ ok: true, receipt: { ...receipt(), replayed: true } });
    expect(state.commands[0]).toEqual(state.commands[1]);
    expect(state.objects.size).toBe(1);
    expect(mocks.notify).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it("recuperar un intento no sube evidencia distinta ni toma un path del navegador", async () => {
    const { state, upload, remove } = io();
    expect((await reportPaymentAction(CODE, {}, form())).ok).toBe(true);
    const originalPath = [...state.objects.keys()][0];
    const retry = form({ proof_path: originalPath });
    retry.set("proof", new File(["%PDF-1.4\ndifferent synthetic proof"], "proof.pdf", { type: "application/pdf" }));
    const result = await reportPaymentAction(CODE, {}, retry);
    expect(result.ok).not.toBe(true);
    expect(result.error).toMatch(/\S/);
    expect(state.commands).toHaveLength(1);
    expect(upload).toHaveBeenCalledOnce();
    expect([...state.objects.keys()]).toEqual([originalPath]);
    expect(remove).not.toHaveBeenCalled();
    expect(mocks.notify).toHaveBeenCalledOnce();
  });

  it.each(["tenant_id", "invoice_id", "client_markbox"])("un reporte con %s ajeno no habilita replay", async (field) => {
    const existing = { id: REPORT, tenant_id: TENANT, invoice_id: INVOICE, invoice_code: CODE,
      client_markbox: MARK, deleted_at: null, [field]: field === "client_markbox" ? "DTD-AJENO" : OTHER };
    const { state, upload } = io({ invoiceStatus: "pagada", pending: 5, existing });
    expect((await reportPaymentAction(CODE, {}, form())).ok).not.toBe(true);
    expect(state.commands).toEqual([]);
    expect(upload).not.toHaveBeenCalled();
  });

  it("fallo del aviso no convierte el commit verificado en fallo", async () => {
    const { state } = io();
    mocks.notify.mockRejectedValueOnce(new Error(PRIVATE));
    expect(await reportPaymentAction(CODE, {}, form())).toMatchObject({ ok: true, receipt: receipt() });
    expect(state.commands).toHaveLength(1);
    expect(mocks.notify).toHaveBeenCalledOnce();
    expect(mocks.revalidate).toHaveBeenCalled();
  });

  it("fallo de revalidación conserva el recibo confirmado", async () => {
    const { state } = io();
    mocks.revalidate.mockImplementationOnce(() => { throw new Error(PRIVATE); });
    expect(await cancelPaymentReportAction(CODE, {}, form())).toMatchObject({ ok: true, receipt: receipt("reportado", true) });
    expect(state.commands).toHaveLength(1);
    expect(state.dml).toEqual([]);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });
});
