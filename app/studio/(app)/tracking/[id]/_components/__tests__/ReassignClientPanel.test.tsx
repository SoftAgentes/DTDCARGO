/**
 * SDD-0645 · «Pasar a otro cliente»: el modal no deja confirmar sin cliente de
 * la lista, sin vista previa limpia ni sin motivo; muestra los bloqueos y lo
 * que se mueve; sin la migración, dice que no está disponible.
 */
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  preview: vi.fn(),
  reassign: vi.fn(),
  success: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("../../actions", () => ({
  previewReassignShipmentClient: (...a: unknown[]) => mocks.preview(...a),
  reassignShipmentClient: (...a: unknown[]) => mocks.reassign(...a),
}));
vi.mock("@/app/studio/_components/ui/ToastProvider", () => ({
  useToast: () => ({ show: vi.fn(), success: mocks.success, info: vi.fn(), error: vi.fn(), warning: vi.fn(), dismiss: vi.fn() }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: mocks.refresh }) }));
// El buscador real habla con el servidor; acá basta con elegir un cliente.
vi.mock("@/app/studio/_components/ui/ClientCombobox", () => ({
  ClientCombobox: (props: { id: string; value: string; onSelect: (c: unknown) => void; disabled?: boolean }) => (
    <>
      <input id={props.id} value={props.value} readOnly disabled={props.disabled} />
      <button
        type="button"
        disabled={props.disabled}
        onClick={() => props.onSelect({ id: "cli-1", markbox: "DTD-1001", name: "Cliente Ficticio", rif: null, person_id: null })}
      >
        Elegir DTD-1001
      </button>
    </>
  ),
}));

const { ReassignClientPanel } = await import("../ReassignClientPanel");

const PROPS = { shipmentId: "shp-1", shipmentCode: "S-2026-0064", currentMarkbox: "DTD-0000" };
const resultado = (outcome: string, extra: Record<string, unknown> = {}) => ({
  ok: true,
  resultado: {
    outcome,
    shipmentCode: "S-2026-0064",
    oldMarkbox: "DTD-0000",
    newMarkbox: "DTD-1001",
    blockers: {},
    warnings: { tarifa_congelada: 1 },
    portal: { documentos: { bl: 1 }, eventos: 2, eventosConNota: 1 },
    moved: { shipments: 1, warehouse_receipts_cn: 1, warehouse_boxes: 5, invoices: 1 },
    ...extra,
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.preview.mockResolvedValue(resultado("preview"));
  mocks.reassign.mockResolvedValue(resultado("reassigned"));
});
afterEach(cleanup);

async function abrirYElegir() {
  const user = userEvent.setup();
  render(<ReassignClientPanel {...PROPS} />);
  expect(screen.getByText("DTD-0000")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Pasar a otro cliente" }));
  const dialogo = screen.getByRole("dialog", { name: "Pasar a otro cliente" });
  await user.click(within(dialogo).getByRole("button", { name: "Elegir DTD-1001" }));
  return { user, dialogo };
}

describe("ReassignClientPanel", () => {
  it("vista previa, motivo y confirmación con el Shipping Mark nuevo", async () => {
    const { user, dialogo } = await abrirYElegir();
    expect(mocks.preview).toHaveBeenCalledWith("shp-1", "cli-1");
    await within(dialogo).findByText(/Se pasa de DTD-0000 a DTD-1001/);
    expect(dialogo.textContent).toContain("1 recepción del Almacén CN (5 cajas), 1 factura en borrador");
    expect(dialogo.textContent).toContain("DTD-0000 dejará de verlo en el Portal y DTD-1001 lo verá");
    // H-2: qué verá el nuevo, sin contenido. H-1: la tarifa congelada avisa, no bloquea.
    expect(dialogo.textContent).toContain("DTD-1001 va a ver en el Portal: 1 BL, 2 eventos del seguimiento (1 con nota)");
    expect(dialogo.textContent).toContain("1 recepción tiene tarifa congelada del cliente anterior; contabilidad debe reemplazarla antes de facturar.");

    // El motivo queda en la bitácora: se avisa que no lleve datos personales.
    expect(within(dialogo).getByLabelText("Motivo")).toHaveAccessibleDescription(/no escribas datos personales/);

    const confirmar = within(dialogo).getByRole("button", { name: "Pasar a DTD-1001" });
    expect(confirmar).toBeDisabled();
    await user.type(within(dialogo).getByLabelText("Motivo"), "abc");
    expect(confirmar).toBeDisabled();
    await user.type(within(dialogo).getByLabelText("Motivo"), "d");
    expect(confirmar).toBeEnabled();

    await user.click(confirmar);
    await waitFor(() => expect(mocks.reassign).toHaveBeenCalledWith("shp-1", "cli-1", "abcd"));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith("Embarque S-2026-0064 pasado a DTD-1001"));
    expect(mocks.refresh).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("con bloqueos los muestra y no ofrece motivo ni confirmar", async () => {
    mocks.preview.mockResolvedValue(resultado("blocked", { blockers: { factura_emitida: 1 } }));
    const { dialogo } = await abrirYElegir();
    await within(dialogo).findByText("No se puede pasar todavía");
    expect(dialogo.textContent).toContain("Tiene 1 factura emitida a nombre del cliente actual. Anúlala primero.");
    expect(within(dialogo).queryByLabelText("Motivo")).toBeNull();
    expect(within(dialogo).getByRole("button", { name: "Pasar a DTD-1001" })).toBeDisabled();
  });

  it("sin la migración dice que no está disponible y bloquea el buscador", async () => {
    mocks.preview.mockResolvedValue({ ok: false, error: "Esta acción todavía no está disponible.", noDisponible: true });
    const { dialogo } = await abrirYElegir();
    await within(dialogo).findByText("Esta acción todavía no está disponible.");
    expect(within(dialogo).getByRole("button", { name: "Elegir DTD-1001" })).toBeDisabled();
    expect(mocks.reassign).not.toHaveBeenCalled();
  });

  it("Cancelar cierra sin llamar al cambio", async () => {
    const { user, dialogo } = await abrirYElegir();
    await user.click(within(dialogo).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(mocks.reassign).not.toHaveBeenCalled();
  });
});
