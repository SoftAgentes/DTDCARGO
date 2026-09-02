// @vitest-environment node
/**
 * Reproducción independiente de comandos de pago: acciones, identidad Portal,
 * contador, validadores y upload reales; sólo DB/Storage/avisos/Next simulados.
 * Conserva las garantías de la contención original al retirar el DML:
 * ahora exige el recibo real de la RPC auditada 0421.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  notifyPaymentReportToAdmin: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/db/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/studio/payment-report-notify", () => ({
  notifyPaymentReportToAdmin: mocks.notifyPaymentReportToAdmin,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import {
  cancelPaymentReportAction,
  reportPaymentAction,
} from "@/app/portal/(app)/facturas/[code]/reportar/actions";
import { countPendingReports } from "../payment-report-queries";

const CLIENT_ID = "11000000-0000-4000-8000-000000000001";
const TENANT_ID = "22000000-0000-4000-8000-000000000001";
const INVOICE_ID = "33000000-0000-4000-8000-000000000001";
const REPORT_ID = "44000000-0000-4000-8000-000000000001";
const REQUEST_ID = "55000000-0000-4000-8000-000000000001";
const AUDIT_ID = "66000000-0000-4000-8000-000000000001";
const MISSING_REPORT_ID = "44000000-0000-4000-8000-000000000099";
const INVOICE_CODE = "F-TEST-0001";
const MARKBOX = "DTD-TEST-0001";
const DB_FAILURE = { code: "57014", message: "synthetic statement timeout" };
const UNCERTAIN_INSERT = { code: "", message: "synthetic response lost after request was sent" };

function commandReceipt(cancelled = false) {
  return { request_id: REQUEST_ID, report_id: REPORT_ID, invoice_id: INVOICE_ID, invoice_code: INVOICE_CODE,
    status: "reportado", cancelled, audit_event_id: AUDIT_ID, replayed: false };
}

type DbReply = {
  data?: unknown;
  count?: number | null;
  error: { code: string; message: string } | null;
};

/** Respuesta PostgREST encadenable: no reemplaza ninguna query de dominio. */
function replyBuilder(reply: () => DbReply) {
  const builder: Record<string, unknown> = {};
  Object.assign(builder, {
    select: () => builder,
    eq: () => builder,
    is: () => builder,
    maybeSingle: () => Promise.resolve(reply()),
    then: (resolve: (value: DbReply) => unknown, reject: (error: unknown) => unknown) =>
      Promise.resolve(reply()).then(resolve, reject),
  });
  return builder;
}

function setupIo(
  pending: DbReply = { count: 0, error: null },
  options: {
    pendingTransportError?: Error;
    cancellationReply?: DbReply;
    insertReply?: DbReply;
    insertTransportError?: Error;
  } = {},
) {
  const state = {
    pendingReads: 0,
    cancellationTableCalls: 0,
    cancellationAttempts: 0,
    cancelledRows: 0,
    cancellationUpdates: [] as { patch: unknown; options: unknown }[],
    cancellationFilters: [] as { method: "eq" | "is"; column: string; value: unknown }[],
    uploadedObjects: [] as string[],
    insertedReports: [] as Record<string, unknown>[],
    directWrites: 0,
    commands: [] as { name: string; args: Record<string, unknown> }[],
  };
  const portalClient = { id: CLIENT_ID, markbox: MARKBOX, name: "Cliente sintético" };
  const session = {
    rpc: async (name: string, args: Record<string, unknown> = {}) => {
      if (name === "get_portal_client_id") return { data: CLIENT_ID, error: null };
      state.commands.push({ name, args });
      if (name === "cancel_portal_payment_report") {
        state.cancellationAttempts += 1;
        return options.cancellationReply ?? { data: null, error: { code: "P0002", message: "PAYMENT_NOT_FOUND" } };
      }
      if (name === "create_portal_payment_report") {
        // También representa COMMIT seguido de respuesta perdida. El objeto
        // debe sobrevivir; no se simula rollback de la frontera remota.
        state.insertedReports.push({ id: args.p_report_id, tenant_id: TENANT_ID, invoice_id: INVOICE_ID,
          client_markbox: MARKBOX, amount: args.p_amount, currency: "USD", status: "reportado", proof_path: args.p_proof_path });
        if (options.insertTransportError) throw options.insertTransportError;
        return options.insertReply ?? { data: commandReceipt(), error: null };
      }
      throw new Error(`RPC no simulada: ${name}`);
    },
    from: (table: string) => {
      if (table === "clients") return replyBuilder(() => ({ data: portalClient, error: null }));
      if (table === "payment_reports") {
        state.cancellationTableCalls += 1;
        const noMatch = replyBuilder(() => {
          state.cancellationAttempts += 1;
          // Sólo simula la respuesta de PostgREST. Ni siquiera count=1 prueba
          // que la RLS legado permita realmente cancelar; ese gate sigue abierto.
          return options.cancellationReply ?? { data: null, count: null, error: null };
        });
        noMatch.eq = (column: string, value: unknown) => {
          state.cancellationFilters.push({ method: "eq", column, value });
          return noMatch;
        };
        noMatch.is = (column: string, value: unknown) => {
          state.cancellationFilters.push({ method: "is", column, value });
          return noMatch;
        };
        return {
          update: (patch: unknown, options: unknown) => {
            state.directWrites += 1;
            state.cancellationUpdates.push({ patch, options });
            return noMatch;
          },
        };
      }
      throw new Error(`Tabla de sesión no simulada: ${table}`);
    },
  } as unknown as SupabaseClient;
  const upload = vi.fn(async (path: string) => {
    state.uploadedObjects.push(path);
    return { data: { path }, error: null };
  });
  const remove = vi.fn(async (paths: string[]) => {
    state.uploadedObjects = state.uploadedObjects.filter((path) => !paths.includes(path));
    return { data: [], error: null };
  });
  const admin = {
    from: (table: string) => {
      if (table === "clients") return replyBuilder(() => ({ data: { tenant_id: TENANT_ID }, error: null }));
      if (table === "invoices") {
        return replyBuilder(() => ({
          data: { id: INVOICE_ID, currency: "USD", status: "emitida", total_amount: 1000, paid_amount: 20 },
          error: null,
        }));
      }
      if (table === "payment_reports") {
        const counter = replyBuilder(() => {
          state.pendingReads += 1;
          if (options.pendingTransportError) throw options.pendingTransportError;
          return pending;
        });
        // El lookup exacto de replay no es una consulta de cupo.
        counter.maybeSingle = () => Promise.resolve({ data: null, error: null });
        return {
          ...counter,
          insert: async (row: Record<string, unknown>) => {
            state.directWrites += 1;
            // Representa también el caso incierto: la DB pudo confirmar el
            // INSERT antes de perderse su respuesta. No es un rollback falso.
            state.insertedReports.push(row);
            if (options.insertTransportError) throw options.insertTransportError;
            return options.insertReply ?? { data: null, error: null };
          },
        };
      }
      throw new Error(`Tabla admin no simulada: ${table}`);
    },
    storage: {
      from: (bucket: string) => {
        if (bucket !== "payment-proofs") throw new Error(`Bucket no simulado: ${bucket}`);
        return { upload, remove };
      },
    },
  } as unknown as SupabaseClient;
  mocks.createClient.mockResolvedValue(session);
  mocks.createAdminClient.mockReturnValue(admin);
  return { admin, state, upload, remove };
}

function validPaymentForm(): FormData {
  const form = new FormData();
  form.set("request_id", REQUEST_ID);
  form.set("report_id", REPORT_ID);
  form.set("reason", "Cancelación solicitada por el cliente");
  form.set("amount", "45.50");
  form.set("method", "transferencia");
  form.set("paid_at", "2026-09-01");
  form.set("note", "Pago sintético de prueba");
  form.set("proof", new File(["%PDF-1.4\nsynthetic"], "comprobante.pdf", { type: "application/pdf" }));
  return form;
}

/** Acepta rechazo o resultado no-numérico sin prescribir la API del arreglo. */
function settle<T>(promise: Promise<T>) {
  return promise.then(
    (value) => ({ kind: "resolved" as const, value }),
    (error: unknown) => ({ kind: "rejected" as const, error }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-02T12:00:00Z"));
  mocks.notifyPaymentReportToAdmin.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("cancelPaymentReportAction · resultado comprobable tras retirar UPDATE", () => {
  it("acepta sólo recibo validado y revalida sin DML ni cliente admin", async () => {
    const { state } = setupIo(undefined, { cancellationReply: { data: commandReceipt(true), error: null } });
    const result = await cancelPaymentReportAction(INVOICE_CODE, {}, validPaymentForm());
    expect(result).toMatchObject({ ok: true, receipt: {
      requestId: REQUEST_ID, reportId: REPORT_ID, cancelled: true, auditEventId: AUDIT_ID,
    } });
    expect(state.cancellationAttempts).toBe(1);
    expect(state.commands).toEqual([{ name: "cancel_portal_payment_report", args: {
      p_request_id: REQUEST_ID, p_report_id: REPORT_ID, p_invoice_code: INVOICE_CODE,
      p_reason: "Cancelación solicitada por el cliente",
    } }]);
    expect(state.directWrites).toBe(0);
    expect(state.cancellationUpdates).toEqual([]);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
    expect(mocks.revalidatePath.mock.calls).toEqual([
      ["/portal/facturas"], [`/portal/facturas/${INVOICE_CODE}`], [`/portal/facturas/${INVOICE_CODE}/reportar`],
      ["/studio/facturacion"], [`/studio/facturacion/${INVOICE_CODE}`],
    ]);
  });

  it.each([
    { label: "count=1 sin recibo no es éxito", data: null, count: 1, error: null },
    { label: "dos filas sin recibo", data: null, count: 2, error: null },
    { label: "recibo junto con error", data: commandReceipt(true), count: 1, error: DB_FAILURE },
  ])("$label", async ({ data, count, error }) => {
    const { state } = setupIo(undefined, { cancellationReply: { data, count, error } });
    const result = await cancelPaymentReportAction(INVOICE_CODE, {}, validPaymentForm());
    expect(state.cancellationAttempts).toBe(1);
    expect(state.directWrites).toBe(0);
    expect(result.ok).not.toBe(true);
    expect(result.error).toMatch(/\S/);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it.each(["", "not-a-uuid", `${REPORT_ID}-extra`])("UUID inválido %j no toca reportes ni RPC de comando", async (reportId) => {
    const { state } = setupIo();
    const form = validPaymentForm();
    form.set("report_id", reportId);
    const result = await cancelPaymentReportAction(INVOICE_CODE, {}, form);
    expect(state.cancellationTableCalls).toBe(0);
    expect(state.cancellationAttempts).toBe(0);
    expect(state.commands).toEqual([]);
    expect(state.directWrites).toBe(0);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
    expect(result.ok).not.toBe(true);
    expect(result.error).toMatch(/\S/);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("ID inexistente no comunica éxito ni revalida", async () => {
    const { state } = setupIo();
    const form = validPaymentForm();
    form.set("report_id", MISSING_REPORT_ID);
    const result = await cancelPaymentReportAction(INVOICE_CODE, {}, form);
    expect(state.cancellationAttempts).toBe(1);
    expect(state.directWrites).toBe(0);
    expect(result.ok).not.toBe(true);
    expect(result.error).toMatch(/\S/);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("cero filas sin recibo no comunica éxito", async () => {
    const { state } = setupIo(undefined, { cancellationReply: { data: [], count: 0, error: null } });
    const result = await cancelPaymentReportAction(INVOICE_CODE, {}, validPaymentForm());
    expect(state.cancellationAttempts).toBe(1);
    expect(state.directWrites).toBe(0);
    expect(result.ok).not.toBe(true);
    expect(result.error).toMatch(/\S/);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("rechazo DB nunca comunica éxito ni filtra SQL", async () => {
    const { state } = setupIo(undefined, {
      cancellationReply: { data: null, error: { code: "42501", message: "synthetic RLS denial" } },
    });
    const result = await cancelPaymentReportAction(INVOICE_CODE, {}, validPaymentForm());
    expect(state.cancellationAttempts).toBe(1);
    expect(state.directWrites).toBe(0);
    expect(result.ok).not.toBe(true);
    expect(result.error).toMatch(/\S/);
    expect(result.error).not.toMatch(/synthetic|RLS|42501/);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("countPendingReports · error distinto de cero", () => {
  it("conserva el cero cuando la consulta realmente tuvo éxito", async () => {
    const { admin, state } = setupIo({ count: 0, error: null });

    await expect(countPendingReports(admin, { tenantId: TENANT_ID, invoiceId: INVOICE_ID })).resolves.toBe(0);

    expect(state.pendingReads).toBe(1);
  });

  it("no transforma un error de DB en cero pendientes", async () => {
    const { admin, state } = setupIo({ count: null, error: DB_FAILURE });

    const outcome = await settle(countPendingReports(admin, { tenantId: TENANT_ID, invoiceId: INVOICE_ID }));

    expect(state.pendingReads).toBe(1);
    expect(outcome).toEqual({ kind: "resolved", value: null });
  });
});

describe("reportPaymentAction · conteo fail-closed", () => {
  it("recorre el alta real cuando conoce un conteo válido bajo el límite", async () => {
    const { state, upload } = setupIo({ count: 0, error: null });

    await expect(reportPaymentAction(INVOICE_CODE, {}, validPaymentForm())).resolves.toMatchObject({
      ok: true, receipt: { requestId: REQUEST_ID, reportId: REPORT_ID, auditEventId: AUDIT_ID },
    });

    expect(state.pendingReads).toBe(1);
    expect(upload).toHaveBeenCalledOnce();
    expect(state.uploadedObjects).toHaveLength(1);
    expect(state.insertedReports).toHaveLength(1);
    expect(state.directWrites).toBe(0);
    expect(state.commands[0].name).toBe("create_portal_payment_report");
    expect(state.insertedReports[0]).toMatchObject({
      tenant_id: TENANT_ID, invoice_id: INVOICE_ID, client_markbox: MARKBOX,
      amount: 45.5, currency: "USD", status: "reportado", proof_path: state.uploadedObjects[0],
    });
    expect(mocks.notifyPaymentReportToAdmin).toHaveBeenCalledOnce();
  });

  it("no sube comprobante, inserta ni notifica cuando falla el conteo", async () => {
    const { state, upload, remove } = setupIo({ count: null, error: DB_FAILURE });

    const outcome = await settle(reportPaymentAction(INVOICE_CODE, {}, validPaymentForm()));

    expect(state.pendingReads).toBe(1);
    // Ni siquiera una subida posteriormente revertida es aceptable: con
    // cupo desconocido el flujo no debe iniciar efectos externos.
    expect.soft(upload).not.toHaveBeenCalled();
    expect.soft(remove).not.toHaveBeenCalled();
    expect.soft(state.uploadedObjects).toHaveLength(0);
    expect.soft(state.insertedReports).toHaveLength(0);
    expect.soft(mocks.notifyPaymentReportToAdmin).not.toHaveBeenCalled();
    expect.soft(mocks.revalidatePath).not.toHaveBeenCalled();
    expect(outcome.kind).toBe("resolved");
    if (outcome.kind === "resolved") {
      expect(outcome.value.ok).not.toBe(true);
      expect(outcome.value.error).toMatch(/\S/);
      expect(outcome.value.error).not.toMatch(/synthetic|57014|statement timeout/i);
    }
  });

  it.each([
    { label: "null", count: null },
    { label: "undefined", count: undefined },
    { label: "NaN", count: Number.NaN },
    { label: "negativo", count: -1 },
    { label: "no entero", count: 0.5 },
    { label: "infinito", count: Number.POSITIVE_INFINITY },
  ])("no inicia efectos externos con conteo $label aunque no venga error DB", async ({ count }) => {
    const { state, upload, remove } = setupIo({ count, error: null });

    const outcome = await settle(reportPaymentAction(INVOICE_CODE, {}, validPaymentForm()));

    expect(state.pendingReads).toBe(1);
    expect.soft(upload).not.toHaveBeenCalled();
    expect.soft(remove).not.toHaveBeenCalled();
    expect.soft(state.uploadedObjects).toHaveLength(0);
    expect.soft(state.insertedReports).toHaveLength(0);
    expect.soft(mocks.notifyPaymentReportToAdmin).not.toHaveBeenCalled();
    expect.soft(mocks.revalidatePath).not.toHaveBeenCalled();
    expect(outcome.kind).toBe("resolved");
    if (outcome.kind === "resolved") {
      expect(outcome.value.ok).not.toBe(true);
      expect(outcome.value.error).toMatch(/\S/);
      expect(outcome.value.error).not.toMatch(/synthetic|57014|statement timeout/i);
    }
  });

  it("no inicia efectos externos si el transporte rechaza la consulta del conteo", async () => {
    const { state, upload, remove } = setupIo(undefined, {
      pendingTransportError: new Error("synthetic count transport failure"),
    });

    const outcome = await settle(reportPaymentAction(INVOICE_CODE, {}, validPaymentForm()));

    expect(state.pendingReads).toBe(1);
    expect(upload).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(state.uploadedObjects).toHaveLength(0);
    expect(state.insertedReports).toHaveLength(0);
    expect(mocks.notifyPaymentReportToAdmin).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
    expect(outcome.kind).toBe("resolved");
    if (outcome.kind === "resolved") {
      expect(outcome.value.ok).not.toBe(true);
      expect(outcome.value.error).toMatch(/\S/);
      expect(outcome.value.error).not.toMatch(/synthetic|transport failure/i);
    }
  });

  it("bloquea el alta al alcanzar exactamente cinco pendientes", async () => {
    const { state, upload, remove } = setupIo({ count: 5, error: null });

    const result = await reportPaymentAction(INVOICE_CODE, {}, validPaymentForm());

    expect(state.pendingReads).toBe(1);
    expect(result.ok).not.toBe(true);
    expect(result.error).toMatch(/\S/);
    expect(upload).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(state.uploadedObjects).toHaveLength(0);
    expect(state.insertedReports).toHaveLength(0);
    expect(mocks.notifyPaymentReportToAdmin).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("reportPaymentAction · resultado incierto del comando auditado", () => {
  it.each([
    { label: "respuesta con error", options: { insertReply: { data: null, error: UNCERTAIN_INSERT } } },
    { label: "rechazo de transporte", options: { insertTransportError: new Error("synthetic insert response lost") } },
  ])("conserva el comprobante potencialmente vinculado ante $label y pide revisar antes de repetir", async ({ options }) => {
    const { state, upload, remove } = setupIo({ count: 0, error: null }, options);

    const outcome = await settle(reportPaymentAction(INVOICE_CODE, {}, validPaymentForm()));

    expect(upload).toHaveBeenCalledOnce();
    expect(state.insertedReports).toHaveLength(1);
    expect(state.directWrites).toBe(0);
    expect.soft(remove).not.toHaveBeenCalled();
    expect.soft(state.uploadedObjects).toEqual([state.insertedReports[0].proof_path]);
    expect.soft(mocks.notifyPaymentReportToAdmin).not.toHaveBeenCalled();
    expect.soft(mocks.revalidatePath).not.toHaveBeenCalled();
    // La incertidumbre debe llegar como mensaje de la acción, no como éxito
    // ni excepción de transporte sin orientación para quien reportó el pago.
    expect.soft(outcome.kind).toBe("resolved");
    if (outcome.kind === "resolved") {
      expect.soft(outcome.value.ok).not.toBe(true);
      expect.soft(outcome.value.error).toEqual(expect.any(String));
      expect.soft(outcome.value.error).toMatch(/revis|verific|comprueb|asesor|confirm/i);
    }
  });
});
