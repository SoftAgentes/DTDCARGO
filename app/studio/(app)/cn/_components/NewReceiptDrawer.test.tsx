import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  WarehouseCN,
  WarehouseReceiptActionState,
} from "@/lib/studio/warehouse-cn-types";
import type { Client } from "@/lib/studio/client-types";
import { NewReceiptDrawer } from "./NewReceiptDrawer";

const mocks = vi.hoisted(() => ({
  createReceiptAction: vi.fn(),
  push: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock("../actions", () => ({
  createReceiptAction: (...args: unknown[]) =>
    mocks.createReceiptAction(...args),
}));

vi.mock("@/app/studio/_components/ui/ToastProvider", () => ({
  useToast: () => ({ success: mocks.toastSuccess }),
}));

vi.mock("@/lib/i18n", () => ({
  useT: () => (key: string) => key,
  resolveErrorMessage: (
    _translate: (key: string) => string,
    state: WarehouseReceiptActionState | null | undefined,
  ) => state?.error ?? null,
}));

vi.mock("@/app/studio/_components/icons", () => ({
  Icon: {
    box: () => <span aria-hidden="true">box</span>,
    plus: () => <span aria-hidden="true">plus</span>,
    check: () => <span aria-hidden="true">check</span>,
    trash: () => <span aria-hidden="true">trash</span>,
  },
}));

vi.mock("@/app/studio/_components/ui/drawer/DrawerShell", () => ({
  DrawerShell: ({
    children,
    pending,
  }: {
    children: ReactNode;
    pending: boolean;
  }) => (
    <section data-testid="drawer-shell" aria-busy={pending}>
      {children}
    </section>
  ),
}));

vi.mock("./SupplierBilingualInput", () => ({
  SupplierBilingualInput: ({
    value,
    onChange,
    required,
    error,
  }: {
    value: string;
    onChange: (value: string) => void;
    required?: boolean;
    error?: string;
  }) => (
    <div>
      <label htmlFor="supplier-name">Supplier</label>
      <input
        id="supplier-name"
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
      />
      {error && <span>{error}</span>}
    </div>
  ),
}));

vi.mock("@/app/studio/_components/ui/NumericInput", () => ({
  NumericInput: ({
    id,
    name,
    value,
    required,
    onChange,
  }: {
    id: string;
    name?: string;
    value: number | null;
    required?: boolean;
    onChange: (value: number | null) => void;
  }) => (
    <input
      id={id}
      name={name}
      value={value ?? ""}
      required={required}
      onChange={(event) =>
        onChange(
          event.target.value === "" ? null : Number(event.target.value),
        )
      }
    />
  ),
}));

vi.mock("@/app/studio/_components/ui/SplitActionButton", () => ({
  SplitActionButton: ({
    actions,
    disabled,
    onError,
  }: {
    actions: Array<{
      idleLabel: string;
      onAction: () => Promise<void | { error?: string | null }>;
    }>;
    disabled?: boolean;
    onError?: (message: string) => void;
  }) => (
    <button
      type="button"
      disabled={disabled}
      onClick={async () => {
        const result = await actions[0].onAction();
        if (result && result.error) onError?.(result.error);
      }}
    >
      {actions[0].idleLabel}
    </button>
  ),
}));

const warehouses = [
  {
    id: "warehouse-1",
    code: "YIW-A1",
    hub_code: "YIW",
    hub_name_es: "Yiwu",
    hub_name_cn: "义乌",
    warehouse_name: null,
    city: "Yiwu",
    address: null,
    active: true,
    display_order: 1,
    created_at: "2026-07-31T00:00:00.000Z",
  },
] satisfies WarehouseCN[];

const clients = [
  {
    id: "client-1",
    tenant_id: "tenant-1",
    markbox: "DTD-0001",
    name: "Cliente prueba",
    email: null,
    phone: null,
    address: null,
    rif: null,
    contact_name: null,
    tier: "regular",
    notes: null,
    lat: null,
    lng: null,
    registration_channel: "admin",
    doc_kind: null,
    doc_verify_status: null,
    doc_verify_source: null,
    doc_registry_name: null,
    doc_verified_at: null,
    cedula_photo_path: null,
    advisor_id: null,
    person_id: null,
    created_at: "2026-07-31T00:00:00.000Z",
    updated_at: "2026-07-31T00:00:00.000Z",
    deleted_at: null,
  },
] satisfies Client[];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createReceiptAction.mockResolvedValue({
    ok: true,
    createdReceiptCode: "REC-0001",
  });
});

afterEach(cleanup);

async function fillRequiredFields(
  user: ReturnType<typeof userEvent.setup>,
) {
  const warehouse =
    document.querySelector<HTMLSelectElement>("#rd-warehouse");
  const client = document.querySelector<HTMLSelectElement>("#rd-client");
  if (!warehouse || !client) {
    throw new Error("No se encontraron los selects requeridos");
  }
  await user.selectOptions(warehouse, "warehouse-1");
  await user.selectOptions(client, "DTD-0001");
  await user.type(screen.getByLabelText("Supplier"), "Proveedor Yiwu");

  const description =
    document.querySelector<HTMLInputElement>('input[id^="item-desc-"]');
  if (!description) throw new Error("No se encontró la descripción del item");
  await user.type(description, "Repuestos");

  const boxes = document.querySelector<HTMLInputElement>("#rd-boxes");
  if (!boxes) throw new Error("No se encontró el campo de cajas");
  await user.type(boxes, "2");
}

function renderDrawer(onClose = vi.fn()) {
  return {
    onClose,
    ...render(
      <NewReceiptDrawer
        warehouses={warehouses}
        clients={clients}
        onClose={onClose}
      />,
    ),
  };
}

describe("NewReceiptDrawer · feedback y pending", () => {
  it("conserva el resumen y los field errors devueltos por el servidor", async () => {
    mocks.createReceiptAction.mockResolvedValue({
      fieldErrors: { supplier_name: "Supplier no reconocido." },
    });
    const user = userEvent.setup();
    renderDrawer();
    await fillRequiredFields(user);

    await user.click(
      screen.getByRole("button", {
        name: "warehouse_cn.drawer.submit_close",
      }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Revisa los campos indicados.",
    );
    expect(screen.getByText("Supplier no reconocido.")).toBeInTheDocument();
  });

  it("expone pending real y bloquea un segundo submit y Cancelar", async () => {
    let resolveAction!: (value: WarehouseReceiptActionState) => void;
    mocks.createReceiptAction.mockReturnValue(
      new Promise<WarehouseReceiptActionState>((resolve) => {
        resolveAction = resolve;
      }),
    );
    const user = userEvent.setup();
    const { onClose } = renderDrawer();
    await fillRequiredFields(user);

    const submit = screen.getByRole("button", {
      name: "warehouse_cn.drawer.submit_close",
    });
    await user.click(submit);

    await waitFor(() => {
      expect(screen.getByTestId("drawer-shell")).toHaveAttribute(
        "aria-busy",
        "true",
      );
      expect(submit).toBeDisabled();
      expect(
        screen.getByRole("button", { name: "chrome.action.cancel" }),
      ).toBeDisabled();
    });

    await user.click(submit);
    expect(mocks.createReceiptAction).toHaveBeenCalledTimes(1);

    resolveAction({ ok: true, createdReceiptCode: "REC-0002" });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("envía el payload canónico de items sin la clave efímera _key", async () => {
    const user = userEvent.setup();
    renderDrawer();
    await fillRequiredFields(user);

    await user.click(
      screen.getByRole("button", {
        name: "warehouse_cn.drawer.submit_close",
      }),
    );
    await waitFor(() =>
      expect(mocks.createReceiptAction).toHaveBeenCalledTimes(1),
    );

    const formData = mocks.createReceiptAction.mock.calls[0][1] as FormData;
    const items = JSON.parse(String(formData.get("items_json")));

    expect(formData.get("warehouse_id")).toBe("warehouse-1");
    expect(formData.get("client_markbox")).toBe("DTD-0001");
    expect(items).toEqual([
      {
        description: "Repuestos",
        description_translated: null,
        hs_code: null,
        quantity: null,
        unit_value_usd: null,
        notes: null,
      },
    ]);
    expect(items[0]).not.toHaveProperty("_key");
  });
});
