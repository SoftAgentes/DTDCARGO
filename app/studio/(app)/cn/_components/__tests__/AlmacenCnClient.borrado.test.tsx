/**
 * SDD-0522 · Almacén CN: «Eliminar…» en la barra de selección que ya existe.
 *
 * Sin la capability no aparece. Si algo de lo elegido está bloqueado, el botón
 * se deshabilita y la barra dice cuál y por qué (BTN-01 §6). Si se puede, abre
 * el mismo ConfirmDialog R3 que Embarques, en es-VE y en zh-CN. La acción es un
 * doble: la regla la decide la RPC (contrato de la 0476).
 */
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { WarehouseReceiptRow } from "@/lib/studio/warehouse-cn-types";
import type { InfoBorradoRecepcion } from "@/lib/studio/borrado/reglas";

const mocks = vi.hoisted(() => ({
  deleteReceiptsAction: vi.fn(),
  show: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: mocks.refresh }),
  usePathname: () => "/studio/cn",
  useSearchParams: () => new URLSearchParams(""),
}));
vi.mock("../../actions", () => ({
  deleteReceiptsAction: (...a: unknown[]) => mocks.deleteReceiptsAction(...a),
  bulkChangeReceiptPaymentStatusAction: vi.fn(),
  bulkChangeReceiptStatusAction: vi.fn(),
  changeReceiptPaymentStatusAction: vi.fn(),
  changeReceiptStatusAction: vi.fn(),
  markReceiptVerifiedAction: vi.fn(),
  createReceiptAction: vi.fn(),
}));
vi.mock("@/app/studio/_components/ui/ToastProvider", () => ({
  useToast: () => ({ show: mocks.show, success: vi.fn(), info: vi.fn(), error: vi.fn(), warning: vi.fn(), dismiss: vi.fn() }),
}));

const { AlmacenCnClient } = await import("../AlmacenCnClient");
const { LocaleProvider } = await import("@/lib/i18n/LocaleProvider");

function recepcion(i: number): WarehouseReceiptRow {
  return {
    id: `r-${i}`,
    tenant_id: "t1",
    receipt_code: `WR-2026-000${i}`,
    warehouse_id: "wh-1",
    client_markbox: "DTD-0418",
    client_name: null,
    is_orphan: false,
    orphan_marks: null,
    orphan_brought_by: null,
    orphan_suspected_client: null,
    supplier_name: "Proveedor de prueba",
    supplier_name_translated: null,
    boxes: 2,
    total_cbm: 1.5,
    total_weight_kg: 20,
    status: "pendiente_consolidacion",
    shipment_id: null,
    received_at: "2026-10-14",
    notes: null,
    destination_city: null,
    payment_status: "pendiente",
    invoice_verified_at: null,
    deleted_at: null,
    created_at: "2026-10-14T10:00:00Z",
    updated_at: "2026-10-14T10:00:00Z",
    warehouse: { code: "YIW-A1", hub_code: "YIW", hub_name_es: "Yiwu", hub_name_cn: "义乌" },
    items: [],
    items_count: 0,
  } as WarehouseReceiptRow;
}

const RECEPCIONES = [recepcion(1), recepcion(2), recepcion(3)];
const INFO: Record<string, InfoBorradoRecepcion> = {
  "r-1": { bloqueos: {}, avisos: { boxes: 2 } },
  "r-2": { bloqueos: { consolidated: 1 }, avisos: { boxes: 2 } },
  "r-3": { bloqueos: {}, avisos: {} },
};

function pintar(
  eliminacion?: Parameters<typeof AlmacenCnClient>[0]["eliminacion"],
  envolver: (n: ReactNode) => ReactNode = (n) => n,
) {
  return render(
    envolver(
      <AlmacenCnClient
        receipts={RECEPCIONES}
        warehouses={[]}
        clients={[]}
        cities={[]}
        filters={{}}
        eliminacion={eliminacion}
      />,
    ) as React.ReactElement,
  );
}

const barra = () => screen.getByRole("region", { name: /seleccionad|已选择/ });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.deleteReceiptsAction.mockResolvedValue({ ok: true, deleted: 1, codes: ["WR-2026-0001"] });
});
afterEach(cleanup);

describe("AlmacenCnClient · «Eliminar…»", () => {
  it("sin la capability la barra no lo ofrece", async () => {
    const user = userEvent.setup();
    pintar(undefined);
    await user.click(screen.getByRole("checkbox", { name: "Seleccionar WR-2026-0001" }));
    expect(within(barra()).queryByRole("button", { name: "Eliminar…" })).toBeNull();
  });

  it("si algo elegido está bloqueado: deshabilitado, con cuál y por qué a la vista", async () => {
    const user = userEvent.setup();
    pintar({ estado: "lista", info: INFO });
    await user.click(screen.getByRole("checkbox", { name: "Seleccionar WR-2026-0001" }));
    await user.click(screen.getByRole("checkbox", { name: "Seleccionar WR-2026-0002" }));
    const eliminar = within(barra()).getByRole("button", { name: "Eliminar…" });
    expect(eliminar).toBeDisabled();
    expect(eliminar).toHaveAccessibleDescription(
      "No puedes eliminar esta selección: 1 no se pueden eliminar. WR-2026-0002: está consolidada en un embarque (sácala del contenedor primero).",
    );
  });

  it("sin poder leer qué bloquea: lo dice en la página y en la barra", async () => {
    const user = userEvent.setup();
    pintar({ estado: "no_disponible" });
    const aviso = "No se pudo comprobar qué recepciones se pueden eliminar. Recarga la página.";
    expect(screen.getByText(aviso)).toBeVisible();
    await user.click(screen.getByRole("checkbox", { name: "Seleccionar WR-2026-0001" }));
    const eliminar = within(barra()).getByRole("button", { name: "Eliminar…" });
    expect(eliminar).toBeDisabled();
    expect(eliminar).toHaveAccessibleDescription(aviso);
  });

  it("se puede: diálogo R3 con códigos, consecuencias y cajas; motivo obligatorio; un aviso", async () => {
    const user = userEvent.setup();
    pintar({ estado: "lista", info: INFO });
    await user.click(screen.getByRole("checkbox", { name: "Seleccionar WR-2026-0001" }));
    await user.click(within(barra()).getByRole("button", { name: "Eliminar…" }));

    const dialogo = screen.getByRole("dialog");
    expect(within(dialogo).getByRole("heading").textContent).toBe("Eliminar 1 recepción");
    const texto = dialogo.textContent ?? "";
    expect(texto).toContain("Vas a eliminar: WR-2026-0001.");
    expect(texto).toContain("sus cajas se retiran: ya no se pueden estibar ni imprimir");
    expect(texto).toContain("Solo se recuperan desde la base de datos.");
    expect(texto).toContain("Se retiran 2 cajas.");
    await waitFor(() => expect(document.activeElement).toBe(within(dialogo).getByRole("button", { name: "Cancelar" })));
    const confirmar = within(dialogo).getByRole("button", { name: "Eliminar recepción" });
    expect(confirmar.className).toContain("studio-btn-danger");

    await user.click(confirmar);
    expect(mocks.deleteReceiptsAction).not.toHaveBeenCalled();

    await user.type(within(dialogo).getByLabelText("Motivo (obligatorio, sin datos personales)"), "Recepciones de prueba");
    await user.click(confirmar);
    await waitFor(() => expect(mocks.deleteReceiptsAction).toHaveBeenCalledWith(["r-1"], "Recepciones de prueba"));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
    expect(mocks.show).toHaveBeenCalledTimes(1);
    expect(mocks.show.mock.calls[0][0]).toMatchObject({
      tone: "success",
      message: "1 recepción eliminada. Ya no aparece en el Almacén CN.",
    });
  });

  it("si el servidor la bloquea, el porqué queda en el diálogo", async () => {
    mocks.deleteReceiptsAction.mockResolvedValue({
      errorCode: "cn_delete_blocked",
      errorParams: { count: 1 },
      blocked: [{ id: "r-3", code: "WR-2026-0003", blockers: [{ kind: "dispatch_orders", count: 1 }] }],
    });
    const user = userEvent.setup();
    pintar({ estado: "lista", info: INFO });
    await user.click(screen.getByRole("checkbox", { name: "Seleccionar WR-2026-0003" }));
    await user.click(within(barra()).getByRole("button", { name: "Eliminar…" }));
    const dialogo = screen.getByRole("dialog");
    await user.type(within(dialogo).getByLabelText(/Motivo/), "Recepciones de prueba");
    await user.click(within(dialogo).getByRole("button", { name: "Eliminar recepción" }));
    await waitFor(() =>
      expect(within(dialogo).getByRole("alert").textContent).toBe(
        "No se eliminó ninguna recepción: 1 de las elegidas no se pueden eliminar. WR-2026-0003: está en una orden de despacho.",
      ),
    );
    expect(mocks.show).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("en zh-CN: el botón, el diálogo y el motivo en chino", async () => {
    const user = userEvent.setup();
    pintar({ estado: "lista", info: INFO }, (n) => (
      <LocaleProvider locale="zh-CN" region="cn">
        {n}
      </LocaleProvider>
    ));
    await user.click(screen.getByRole("checkbox", { name: "Seleccionar WR-2026-0001" }));
    await user.click(within(barra()).getByRole("button", { name: "删除…" }));
    const dialogo = screen.getByRole("dialog");
    expect(within(dialogo).getByRole("heading").textContent).toBe("删除 1 条收货");
    expect(within(dialogo).getByLabelText("原因（必填，不要填写个人信息）")).toBeRequired();
    expect(within(dialogo).getByRole("button", { name: "取消" })).toBeTruthy();
  });
});
