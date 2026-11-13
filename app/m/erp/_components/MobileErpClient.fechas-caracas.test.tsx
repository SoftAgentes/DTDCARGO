import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Expense, ExpenseActionState } from "@/lib/studio/expense-types";
import { ToastProvider } from "@/app/studio/_components/ui/ToastProvider";
import { MobileErpClient } from "./MobileErpClient";

type FileSnapshot = { name: string; type: string; size: number; bytes: number[] };
type PayloadSnapshot = {
  action: "create" | "edit"; id?: string; fields: Record<string, string>; receipt: FileSnapshot | null;
};
const io = vi.hoisted(() => ({
  client: vi.fn(), account: vi.fn(), post: vi.fn(), void: vi.fn(), revalidate: vi.fn(), refresh: vi.fn(),
  role: vi.fn(async () => "commercial"), admin: { current: null as unknown },
  captured: [] as PayloadSnapshot[],
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: io.refresh }) }));
vi.mock("@/app/studio/(app)/actions", () => ({ signOut: vi.fn() }));
vi.mock("@/components/BrandMark", () => ({ BrandMark: () => <span>DTD Cargo</span> }));
vi.mock("@/lib/db/server", () => ({ createClient: io.client }));
// SDD-0624: el asiento histórico se lee con el cliente de servicio; el doble
// devuelve el mismo cliente. El rol no es support.
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => io.admin.current }));
vi.mock("@/lib/studio/rbac-guard", async (orig) => ({
  ...(await orig<typeof import("@/lib/studio/rbac-guard")>()),
  getStudioRole: io.role,
}));
vi.mock("@/lib/studio/expense-queries", () => ({ resolveExpenseAccountId: io.account }));
vi.mock("@/lib/studio/accounting/expense-posting", () => ({
  syncExpenseEntry: io.post, voidExpenseEntriesForExpense: io.void,
}));
vi.mock("next/cache", () => ({ revalidatePath: io.revalidate }));
vi.mock("../actions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../actions")>();
  return {
    ...actual,
    createExpenseAction: async (previous: ExpenseActionState, data: FormData) => {
      io.captured.push(await snapshot("create", data));
      return actual.createExpenseAction(previous, data);
    },
    updateExpenseAction: async (id: string, previous: ExpenseActionState, data: FormData) => {
      io.captured.push(await snapshot("edit", data, id));
      return actual.updateExpenseAction(id, previous, data);
    },
  };
});

const T = "10000000-0000-4000-8000-000000000001";
const U = "20000000-0000-4000-8000-000000000001";
const A = "40000000-0000-4000-8000-000000000001";
const J = "50000000-0000-4000-8000-000000000001";
const BYTES = [137, 80, 78, 71, 13, 10, 26, 10, 17, 29, 41];
const EXPENSE: Expense = {
  id: "30000000-0000-4000-8000-000000000001", tenant_id: T, user_id: U,
  expense_code: "EXP-fixture", amount: 25, currency: "USD", amount_usd: 25, fx_rate: 1,
  category: "taxi", scope: "external", method: "cash", shipment_id: null,
  note: "Traslado ficticio", location: "Ubicación ficticia", billable: false,
  receipt_path: T + "/" + U + "/EXP-fixture.jpg", receipt_document_id: null, account_id: A,
  occurred_at: "2026-10-21T02:30:00.000Z", created_at: "2026-10-21T02:30:00.000Z",
  updated_at: "2026-10-21T02:30:00.000Z", deleted_at: null,
};
type Row = Record<string, unknown>;
type Envelope = { data: unknown; error: unknown };
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

function fileBytes(file: File): Promise<number[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(Array.from(new Uint8Array(reader.result as ArrayBuffer)));
    reader.readAsArrayBuffer(file);
  });
}
async function snapshot(action: PayloadSnapshot["action"], data: FormData, id?: string): Promise<PayloadSnapshot> {
  // Observe the actual FormData received by the real action wrapper.
  // No reconstructed form, payload repair or reference-only File comparison.
  expect(data).toBeInstanceOf(window.FormData);
  const receipt = data.get("receipt");
  const fields = Object.fromEntries(Array.from(data.entries())
    .filter((entry): entry is [string, string] => typeof entry[1] === "string"));
  let photo: FileSnapshot | null = null;
  if (receipt !== null && typeof receipt !== "string" && receipt.size > 0) {
    expect(receipt).toBeInstanceOf(window.File);
    photo = { name: receipt.name, type: receipt.type, size: receipt.size, bytes: await fileBytes(receipt) };
  }
  return { action, id, fields, receipt: photo };
}

function selectFile(input: HTMLInputElement, file: File | null) {
  // userEvent.upload proxies input.files in jsdom but does not populate the
  // native FileList serialized by jsdom FormData. Populate that real FileList,
  // then dispatch the real React change handler; never repair submitted FD.
  const implementation = (value: object) => {
    const symbol = Object.getOwnPropertySymbols(value).find((key) => key.description === "impl");
    if (!symbol) throw new Error("Fixture jsdom: implementación DOM no disponible.");
    return (value as Record<symbol, unknown>)[symbol];
  };
  const list = implementation(input.files!) as { length: number; push(value: unknown): number };
  list.length = 0;
  if (file) list.push(implementation(file));
  fireEvent.change(input);
}

function setupDb() {
  const effects: { kind: string; value?: unknown }[] = [];
  const context = {
    open: false, entryDate: "2026-10-20", pause: null as ReturnType<typeof deferred> | null, effects,
  };
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: U } }, error: null }) },
    rpc: vi.fn(async (name: string) => {
      if (name === "get_user_tenant_id") return { data: T, error: null };
      if (name !== "next_expense_code") throw new Error("Unexpected synthetic RPC " + name);
      effects.push({ kind: "code" }); return { data: "EXP-fixture-new", error: null };
    }),
    storage: { from: () => ({
      upload: async (path: string, file: File) => {
        effects.push({ kind: "upload", value: { path, file } }); return { error: null };
      },
      remove: async (paths: string[]) => {
        effects.push({ kind: "remove", value: paths }); return { error: null };
      },
    }) },
    from(table: string) {
      let mode = "read", patch: Row = {}, max = Infinity;
      const filters: [string, unknown][] = [];
      const execute = (): Envelope => {
        if (mode !== "read") {
          effects.push({ kind: mode, value: { table, patch: { ...patch } } });
          return { data: [{ ...EXPENSE, ...patch }], error: null };
        }
        const rows: Record<string, Row[]> = {
          user_tenants: [{ tenant_id: T, user_id: U, disabled_at: null }],
          expenses: [{ ...EXPENSE }],
          accounting_settings: [{
            tenant_id: T, closing_date: context.open ? null : "9999-12-31",
            locked_by: null, locked_at: null, updated_at: null,
          }],
          journal_entries: [{
            id: J, tenant_id: T, expense_id: EXPENSE.id, source: "expense",
            entry_date: context.entryDate, status: "asentado", deleted_at: null,
          }],
        };
        return { data: (rows[table] ?? []).filter((row) => filters.every(([key, value]) => row[key] === value)).slice(0, max), error: null };
      };
      const single = async (): Promise<Envelope> => {
        const result = execute();
        const rows = result.data as Row[];
        return {
          data: rows.length === 1 ? rows[0] : null,
          error: rows.length > 1 ? { code: "PGRST116", message: "synthetic multiple rows" } : null,
        };
      };
      const query = {
        select() { return query; },
        eq(key: string, value: unknown) { filters.push([key, value]); return query; },
        is(key: string, value: unknown) { filters.push([key, value]); return query; },
        limit(value: number) { max = value; return query; },
        insert(value: Row) { mode = "insert"; patch = value; return query; },
        update(value: Row) { mode = "update"; patch = value; return query; },
        maybeSingle: single, single,
        then(onFulfilled: (value: Envelope) => unknown, onRejected?: (reason: unknown) => unknown) {
          return Promise.resolve().then(execute).then(onFulfilled, onRejected);
        },
      };
      return query;
    },
  };
  io.client.mockImplementation(async () => { if (context.pause) await context.pause.promise; return client; });
  io.admin.current = client;
  io.account.mockResolvedValue(A);
  io.post.mockImplementation(async (value) => { effects.push({ kind: "post", value }); });
  io.void.mockImplementation(async (...value) => { effects.push({ kind: "void", value }); });
  io.revalidate.mockImplementation((value) => { effects.push({ kind: "revalidate", value }); });
  return context;
}

function renderMobile(expense = EXPENSE, role = "warehouse") {
  return render(
    <div className="m-root" data-theme="light">
      <ToastProvider>
        <MobileErpClient
          user={{ id: U, firstName: "Prueba", fullName: "Persona ficticia", initials: "PF", role, email: "fixture@example.invalid" }}
          shipments={[]} clients={[]} expenses={[expense]} receiptUrls={{}}
          expensesTodayUsd={25} operatingLat={null} operatingLng={null} initialTab="expenses"
          fxPrefill={{ VES: 40, CNY: 7 }}
        />
      </ToastProvider>
    </div>,
  );
}
async function openForm(mode: "create" | "edit", user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: mode === "create" ? "Nuevo gasto" : "Editar gasto EXP-fixture" }));
  const amount = screen.getByLabelText("Monto");
  const form = amount.closest("form")!;
  await user.clear(amount);
  await user.type(amount, "30");
  await user.clear(screen.getByLabelText("Nota (opcional)"));
  await user.type(screen.getByLabelText("Nota (opcional)"), "Nota ficticia conservada");
  await user.clear(screen.getByLabelText("Ubicación (opcional)"));
  await user.type(screen.getByLabelText("Ubicación (opcional)"), "Lugar ficticio");
  await user.selectOptions(screen.getByLabelText("Método de pago"), "transfer");
  await user.click(within(form).getByRole("button", { name: /Taxi/ }));
  const input = document.getElementById(mode === "create" ? "exp-receipt" : "exp-edit-receipt") as HTMLInputElement;
  const file = new File([new Uint8Array(BYTES)], "c3-ficticio.png", { type: "image/png" });
  selectFile(input, file);
  return { form, input, file, save: within(form).getByRole("button", { name: mode === "create" ? "Guardar gasto" : "Guardar cambios" }) };
}
async function keyboardSubmit(user: ReturnType<typeof userEvent.setup>, button: HTMLElement) {
  button.focus();
  await user.keyboard("{Enter}");
}
function assertFirstFile() {
  expect(io.captured[0].receipt).toEqual({ name: "c3-ficticio.png", type: "image/png", size: BYTES.length, bytes: BYTES });
}

beforeEach(() => {
  vi.clearAllMocks();
  io.captured.length = 0;
  // Use the actual DOM realm constructors, not a fake FormData implementation.
  vi.stubGlobal("File", window.File);
  vi.stubGlobal("FormData", window.FormData);
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:c3-ficticio"), revokeObjectURL: vi.fn() }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("C3 · fila real e Intl IANA", () => {
  it.each([
    ["UTC", "2026-10-21T02:30:00.000Z", /20[-\s]+oct\.?/i],
    ["Asia/Shanghai", "2026-10-21T02:30:00.000Z", /20[-\s]+oct\.?/i],
    ["UTC", "2026-10-21T03:59:59.999Z", /20[-\s]+oct\.?/i],
    ["UTC", "2026-10-21T04:00:00.000Z", /21[-\s]+oct\.?/i],
    ["UTC", "2010-01-01T04:15:00.000Z", /31[-\s]+dic\.?/i],
    ["UTC", "2024-03-01T02:30:00.000Z", /29[-\s]+feb\.?/i],
    ["UTC", "2026-01-01T02:30:00.000Z", /31[-\s]+dic\.?/i],
  ])("D01-D04 %s, %s muestra día literal correcto", (tz, occurred_at, label) => {
    vi.stubEnv("TZ", tz);
    expect(new Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(tz);
    renderMobile({ ...EXPENSE, occurred_at });
    const row = screen.getByRole("button", { name: "Editar gasto EXP-fixture" });
    expect(row).toHaveTextContent(label);
    expect(row).toHaveTextContent("Traslado ficticio");
    expect(row).toHaveTextContent("$ 25");
  });
});

describe.each(["create", "edit"] as const)("C3 · formulario y acción reales · %s", (mode) => {
  it("File independiente: ambos FormData conservan metadatos y bytes sin reselección", async () => {
    const context = setupDb();
    const user = userEvent.setup();
    renderMobile();
    const { form, save } = await openForm(mode, user);
    await keyboardSubmit(user, save);
    await screen.findByText(/Período contable cerrado/i);
    await waitFor(() => expect(save).toBeEnabled());
    assertFirstFile();
    expect(context.effects).toEqual([]);
    expect(screen.getByLabelText("Monto").closest("form")).toBe(form);
    context.open = true;
    await keyboardSubmit(user, save);
    await waitFor(() => expect(io.captured).toHaveLength(2));
    // Independent from scalar fields: a method change cannot be File loss.
    expect(io.captured[1].receipt).toEqual(io.captured[0].receipt);
    expect(io.captured[1].receipt).toEqual({ name: "c3-ficticio.png", type: "image/png", size: BYTES.length, bytes: BYTES });
    await waitFor(() => expect(context.effects.some((event) => event.kind === "post")).toBe(true));
  });
  it("E01/E03 conserva todos los campos y File del MISMO form tras cierre recuperable", async () => {
    const context = setupDb();
    const user = userEvent.setup();
    renderMobile();
    const { form, save } = await openForm(mode, user);
    await keyboardSubmit(user, save);
    await screen.findByText(/Período contable cerrado/i);
    await waitFor(() => expect(save).toBeEnabled());
    assertFirstFile(); // Failure here is a realm/serialization fixture issue, not File loss.
    expect(context.effects).toEqual([]);
    expect(screen.getByLabelText("Monto").closest("form")).toBe(form);
    context.open = true;
    await keyboardSubmit(user, save);
    await waitFor(() => expect(io.captured).toHaveLength(2));
    expect(io.captured[1]).toEqual(io.captured[0]);
    expect(io.captured[1].receipt).toEqual({ name: "c3-ficticio.png", type: "image/png", size: BYTES.length, bytes: BYTES });
    await waitFor(() => expect(context.effects.some((event) => event.kind === "post")).toBe(true));
  });
  it("E03 error de campo del handler real conserva campos y bytes para otro envío", async () => {
    const context = setupDb();
    context.open = true;
    const user = userEvent.setup();
    renderMobile();
    const { form, input, save } = await openForm(mode, user);
    selectFile(input, new File([new Uint8Array([1, 7, 9])], "ficticio.txt", { type: "text/plain" }));
    await keyboardSubmit(user, save);
    await screen.findByText(/Formato inválido/i);
    await waitFor(() => expect(save).toBeEnabled());
    expect(context.effects).toEqual([]);
    expect(form).toBeInTheDocument();
    await keyboardSubmit(user, save);
    await waitFor(() => expect(io.captured).toHaveLength(2));
    expect(io.captured[1]).toEqual(io.captured[0]);
    expect(io.captured[1].receipt).toEqual({ name: "ficticio.txt", type: "text/plain", size: 3, bytes: [1, 7, 9] });
    await screen.findByText(/Formato inválido/i);
    expect(context.effects).toEqual([]);
  });
  it("N2 ubica foco real en error persistente y permite otro envío por teclado", async () => {
    const context = setupDb();
    const user = userEvent.setup();
    renderMobile();
    const { form, save } = await openForm(mode, user);
    await keyboardSubmit(user, save);
    const error = await screen.findByText(/Período contable cerrado/i);
    await waitFor(() => expect(save).toBeEnabled());
    assertFirstFile();
    expect(error).toHaveFocus();
    expect(context.effects).toEqual([]);
    expect(form).toBeInTheDocument();
    context.open = true;
    // Navigate from the error, without focusing the submit button in the retry.
    for (let step = 0; step < 8 && document.activeElement !== save; step++) await user.tab();
    expect(save).toHaveFocus();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(io.captured).toHaveLength(2));
    expect(io.captured[1]).toEqual(io.captured[0]);
  });
  it("N2 no roba foco al editar ni seleccionar otra foto después del error", async () => {
    setupDb();
    const user = userEvent.setup();
    renderMobile();
    const { save, input } = await openForm(mode, user);
    await keyboardSubmit(user, save);
    await screen.findByText(/Período contable cerrado/i);
    const note = screen.getByLabelText("Nota (opcional)");
    await user.type(note, " corregida");
    expect(note).toHaveFocus();
    selectFile(input, new File([new Uint8Array([1, 2, 3])], "sustituto.png", { type: "image/png" }));
    expect(note).not.toHaveValue("Nota ficticia conservada");
    expect(screen.getByText(/Período contable cerrado/i)).toBeInTheDocument();
  });
  it("E04 retirar/cancelar reemplazo evita reenviar el File seleccionado", async () => {
    const context = setupDb();
    const user = userEvent.setup();
    renderMobile();
    const { form, save } = await openForm(mode, user);
    await keyboardSubmit(user, save);
    await screen.findByText(/Período contable cerrado/i);
    await user.click(within(form).getByRole("button", { name: mode === "create" ? "Quitar foto" : "Cancelar reemplazo" }));
    context.open = true;
    await keyboardSubmit(user, save);
    await waitFor(() => expect(io.captured).toHaveLength(2));
    expect(io.captured[1].receipt).toBeNull();
  });
  it("E04 sustituir conserva solo bytes nuevos y cerrar realmente limpia selección", async () => {
    const context = setupDb();
    const user = userEvent.setup();
    renderMobile();
    const { input, save } = await openForm(mode, user);
    await keyboardSubmit(user, save);
    await screen.findByText(/Período contable cerrado/i);
    const replacement = new File([new Uint8Array([3, 2, 1])], "sustituto.png", { type: "image/png" });
    selectFile(input, replacement);
    await keyboardSubmit(user, save);
    await waitFor(() => expect(io.captured).toHaveLength(2));
    expect(io.captured[1].receipt).toEqual({ name: "sustituto.png", type: "image/png", size: 3, bytes: [3, 2, 1] });
    await waitFor(() => expect(save).toBeEnabled());
    expect(context.effects).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Cerrar" }));
    await user.click(screen.getByRole("button", { name: mode === "create" ? "Nuevo gasto" : "Editar gasto EXP-fixture" }));
    const reopened = document.getElementById(mode === "create" ? "exp-receipt" : "exp-edit-receipt") as HTMLInputElement;
    expect(reopened.files).toHaveLength(0);
  });
});

describe("C3 · pending real diferido y recuperación", () => {
  it.each(["button", "backdrop"] as const)("N1 alta conserva mismo form al cerrar por %s mientras pending", async (via) => {
    const context = setupDb();
    const gate = deferred();
    context.pause = gate;
    const user = userEvent.setup();
    renderMobile();
    const { form, save } = await openForm("create", user);
    try {
      await keyboardSubmit(user, save);
      await waitFor(() => expect(save).toBeDisabled());
      await waitFor(() => expect(io.captured).toHaveLength(1));
      assertFirstFile();
      await user.click(via === "button" ? screen.getByRole("button", { name: "Cerrar" }) : form.parentElement!);
      expect(form).toBeInTheDocument();
      expect(screen.getByLabelText("Monto")).toHaveValue(30);
      expect(io.captured).toHaveLength(1);
      await act(async () => { gate.resolve(); });
      await screen.findByText(/Período contable cerrado/i);
      await waitFor(() => expect(save).toBeEnabled());
      context.open = true;
      await keyboardSubmit(user, save);
      await waitFor(() => expect(io.captured).toHaveLength(2));
      expect(io.captured[1]).toEqual(io.captured[0]);
    } finally { await act(async () => { gate.resolve(); }); }
  });
  it("edición ya bloquea ambas vías pending y las libera después del rechazo", async () => {
    const context = setupDb();
    const gate = deferred();
    context.pause = gate;
    const user = userEvent.setup();
    renderMobile();
    const { form, save } = await openForm("edit", user);
    try {
      await keyboardSubmit(user, save);
      await waitFor(() => expect(save).toBeDisabled());
      await user.click(screen.getByRole("button", { name: "Cerrar" }));
      await user.click(form.parentElement!);
      expect(form).toBeInTheDocument();
      await act(async () => { gate.resolve(); });
      await screen.findByText(/Período contable cerrado/i);
      await waitFor(() => expect(save).toBeEnabled());
      await user.click(screen.getByRole("button", { name: "Cerrar" }));
      expect(form).not.toBeInTheDocument();
    } finally { await act(async () => { gate.resolve(); }); }
  });
  it("E02 historia incompatible rechaza antes de efectos y reintenta File sin reselección", async () => {
    const context = setupDb();
    context.open = true;
    context.entryDate = "2026-10-21";
    const user = userEvent.setup();
    renderMobile();
    const { form, save } = await openForm("edit", user);
    await keyboardSubmit(user, save);
    await screen.findByText(/fecha|hist[oó]ric|gobernad/i);
    await waitFor(() => expect(save).toBeEnabled());
    assertFirstFile();
    expect(context.effects).toEqual([]);
    expect(form).toBeInTheDocument();
    context.entryDate = "2026-10-20";
    await keyboardSubmit(user, save);
    await waitFor(() => expect(io.captured).toHaveLength(2));
    expect(io.captured[1]).toEqual(io.captured[0]);
    await waitFor(() => expect(io.post).toHaveBeenCalledTimes(1));
  });
});
