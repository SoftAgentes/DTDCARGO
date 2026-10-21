/**
 * SDD-0522 · Embarques: elegir y eliminar.
 *
 * Tres estados de `eliminacion`: `undefined` (no puede: nada se pinta),
 * `no_disponible` (no se pudo leer qué bloquea: se dice, sin casillas) y
 * `lista` (casilla por fila, motivo visible en las bloqueadas, barra y
 * ConfirmDialog R3 con motivo obligatorio). La acción es un doble: lo que se
 * mide aquí es la pantalla; la regla la decide la RPC (contrato de la 0476).
 */
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ShipmentListRow } from "@/lib/studio/shipment-queries";
import type { InfoBorradoEmbarque } from "@/lib/studio/borrado/reglas";

const mocks = vi.hoisted(() => ({
  deleteShipmentsAction: vi.fn(),
  leerPlanDeBorradoAction: vi.fn(),
  ejecutarPasoDeBorradoAction: vi.fn(),
  show: vi.fn(),
}));

vi.mock("../../actions", () => ({
  deleteShipmentsAction: (...a: unknown[]) => mocks.deleteShipmentsAction(...a),
  // SDD-0560: el asistente que abre «Ver los pasos».
  leerPlanDeBorradoAction: (...a: unknown[]) => mocks.leerPlanDeBorradoAction(...a),
  ejecutarPasoDeBorradoAction: (...a: unknown[]) => mocks.ejecutarPasoDeBorradoAction(...a),
}));
vi.mock("@/app/studio/_components/ui/ToastProvider", () => ({
  useToast: () => ({ show: mocks.show, success: vi.fn(), info: vi.fn(), error: vi.fn(), warning: vi.fn(), dismiss: vi.fn() }),
}));

const { EmbarquesClient } = await import("../EmbarquesClient");

function envio(i: number, extra: Partial<ShipmentListRow> = {}): ShipmentListRow {
  return {
    id: `s-${i}`,
    code: `S-2026-${String(i).padStart(4, "0")}`,
    client_name: "María Fernanda Rojas",
    client_markbox: "DTD-0418",
    origin: "Yiwu",
    destination: "Valencia",
    shipment_service: "puerta_a_puerta_DDP",
    status: "draft",
    weight_kg: null,
    volume_m3: 1.2,
    created_at: `2026-10-0${(i % 9) + 1}T10:00:00Z`,
    ...extra,
  };
}

const ENVIOS = [envio(1), envio(2, { status: "in_transit" }), envio(3)];
const INFO: Record<string, InfoBorradoEmbarque> = {
  "s-1": { bloqueos: {}, avisos: { documents: 2, scheduled_notifications: 1 } },
  "s-2": { bloqueos: { invoices: 1 }, avisos: {} },
  "s-3": { bloqueos: {}, avisos: {} },
};
const MOTIVO_S2 =
  "No se puede eliminar: tiene 1 factura sin anular (Facturación). Primero anula, elimina o desvincula eso en su módulo.";

function pintar(eliminacion?: Parameters<typeof EmbarquesClient>[0]["eliminacion"], shipments = ENVIOS) {
  return render(<EmbarquesClient shipments={shipments} adjuntos={undefined} eliminacion={eliminacion} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.deleteShipmentsAction.mockResolvedValue({ ok: true, deleted: 2, codes: ["S-2026-0001", "S-2026-0003"] });
});
afterEach(cleanup);

describe("EmbarquesClient · quién ve el borrado", () => {
  it("sin la capability: ni casillas ni barra", () => {
    pintar(undefined);
    expect(screen.queryAllByRole("checkbox")).toEqual([]);
    expect(screen.queryByText(/no se pudo comprobar qué embarques/i)).toBeNull();
  });

  it("sin poder leer qué bloquea: lo dice y no ofrece borrar", () => {
    pintar({ estado: "no_disponible" });
    expect(screen.getByRole("status").textContent).toBe(
      "No se pudo comprobar qué embarques se pueden eliminar. Recarga la página.",
    );
    expect(screen.queryAllByRole("checkbox")).toEqual([]);
  });
});

describe("EmbarquesClient · casillas y motivo", () => {
  it("la fila bloqueada tiene la casilla deshabilitada y el motivo a la vista, asociado", () => {
    pintar({ estado: "lista", info: INFO });
    const bloqueada = screen.getByRole("checkbox", { name: "Seleccionar S-2026-0002" });
    expect(bloqueada).toBeDisabled();
    expect(screen.getByText(MOTIVO_S2)).toBeVisible();
    expect(bloqueada).toHaveAccessibleDescription(MOTIVO_S2);
    expect(screen.getByRole("checkbox", { name: "Seleccionar S-2026-0001" })).toBeEnabled();
  });

  it("la casilla NO está dentro del botón de la fila (HTML válido)", () => {
    pintar({ estado: "lista", info: INFO });
    const casilla = screen.getByRole("checkbox", { name: "Seleccionar S-2026-0001" });
    expect(casilla.closest("button")).toBeNull();
    expect(screen.getByText("S-2026-0001").closest("button")).not.toBeNull();
  });

  it("sin la fila en la lectura, también bloquea", () => {
    pintar({ estado: "lista", info: { "s-1": INFO["s-1"] } });
    expect(screen.getByRole("checkbox", { name: "Seleccionar S-2026-0003" })).toBeDisabled();
    expect(screen.getAllByText("No se pudo comprobar qué depende de este embarque. Recarga la página.")).toHaveLength(2);
  });

  it("la casilla del cliente elige sólo los que se pueden eliminar", async () => {
    const user = userEvent.setup();
    pintar({ estado: "lista", info: INFO });
    await user.click(screen.getByRole("checkbox", { name: /Seleccionar los embarques de .* que se pueden eliminar/ }));
    expect(screen.getByRole("checkbox", { name: "Seleccionar S-2026-0001" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Seleccionar S-2026-0003" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Seleccionar S-2026-0002" })).not.toBeChecked();
    expect(screen.getByRole("region", { name: /Selección de embarques/ }).textContent).toContain(
      "2 embarques seleccionados",
    );
  });
});

describe("EmbarquesClient · barra y diálogo", () => {
  async function elegirYAbrir() {
    const user = userEvent.setup();
    pintar({ estado: "lista", info: INFO });
    await user.click(screen.getByRole("checkbox", { name: "Seleccionar S-2026-0003" }));
    await user.click(screen.getByRole("checkbox", { name: "Seleccionar S-2026-0001" }));
    const barra = screen.getByRole("region", { name: /Selección de embarques/ });
    expect(within(barra).getByRole("button", { name: "Cancelar selección" })).toBeEnabled();
    await user.click(within(barra).getByRole("button", { name: "Eliminar…" }));
    return { user, dialogo: screen.getByRole("dialog") };
  }

  it("el diálogo nombra los códigos, las consecuencias y lo que se conserva; foco en Cancelar", async () => {
    const { dialogo } = await elegirYAbrir();
    expect(within(dialogo).getByRole("heading").textContent).toBe("Eliminar 2 embarques");
    const texto = dialogo.textContent ?? "";
    expect(texto).toContain("Vas a eliminar 2 embarques: S-2026-0001, S-2026-0003.");
    expect(texto).toContain("Desaparecen de Embarques, Tracking, el Portal del cliente y el calendario");
    expect(texto).toContain("se cancelan sus avisos pendientes");
    expect(texto).toContain("Sus códigos no se pueden volver a usar. Solo se recuperan desde la base de datos.");
    expect(texto).toContain("Se conservan 2 adjuntos. Se cancela 1 aviso pendiente.");
    expect(texto).not.toMatch(/\b(elegí|confirmá|escribí|podés|tenés)\b/i);
    await waitFor(() => expect(document.activeElement).toBe(within(dialogo).getByRole("button", { name: "Cancelar" })));
    const confirmar = within(dialogo).getByRole("button", { name: "Eliminar embarques" });
    expect(confirmar.className).toContain("studio-btn-danger");
    expect(within(dialogo).getByLabelText("Motivo (obligatorio, sin datos personales)")).toBeRequired();
  });

  it("sin motivo no llama a la acción", async () => {
    const { user, dialogo } = await elegirYAbrir();
    await user.click(within(dialogo).getByRole("button", { name: "Eliminar embarques" }));
    expect(mocks.deleteShipmentsAction).not.toHaveBeenCalled();
  });

  it("con motivo: una sola acción con los ids elegidos, un solo aviso y la selección se limpia", async () => {
    const { user, dialogo } = await elegirYAbrir();
    await user.type(within(dialogo).getByLabelText(/Motivo/), "Embarques de prueba");
    await user.click(within(dialogo).getByRole("button", { name: "Eliminar embarques" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(mocks.deleteShipmentsAction).toHaveBeenCalledTimes(1);
    expect(mocks.deleteShipmentsAction).toHaveBeenCalledWith(["s-1", "s-3"], "Embarques de prueba");
    expect(mocks.show).toHaveBeenCalledTimes(1);
    expect(mocks.show.mock.calls[0][0]).toMatchObject({
      eventKey: "shipments:deleted",
      tone: "success",
      message: "2 embarques eliminados. Ya no aparecen en Embarques, Tracking ni el Portal.",
    });
    expect(screen.queryByRole("region", { name: /Selección de embarques/ })).toBeNull();
  });

  it("si no se borró, el error queda en el diálogo y se puede reintentar", async () => {
    mocks.deleteShipmentsAction.mockResolvedValue({ error: "No se eliminó ningún embarque. S-2026-0001: …" });
    const { user, dialogo } = await elegirYAbrir();
    await user.type(within(dialogo).getByLabelText(/Motivo/), "Embarques de prueba");
    await user.click(within(dialogo).getByRole("button", { name: "Eliminar embarques" }));

    await waitFor(() => expect(within(dialogo).getByRole("alert").textContent).toContain("No se eliminó ningún embarque"));
    expect(screen.getByRole("dialog")).toBe(dialogo);
    expect(mocks.show).not.toHaveBeenCalled();

    // El alert puede aparecer mientras el diálogo todavía está procesando.
    const reintentar = await waitFor(() => {
      const boton = within(dialogo).getByRole("button", { name: "Eliminar embarques" });
      expect(boton).toBeVisible();
      expect(boton).toBeEnabled();
      return boton;
    });
    await user.click(reintentar);
    await waitFor(() => expect(mocks.deleteShipmentsAction).toHaveBeenCalledTimes(2));
  });

  it("si la acción lanza, no cierra y no avisa éxito", async () => {
    mocks.deleteShipmentsAction.mockRejectedValue(new Error("red caída"));
    const { user, dialogo } = await elegirYAbrir();
    await user.type(within(dialogo).getByLabelText(/Motivo/), "Embarques de prueba");
    await user.click(within(dialogo).getByRole("button", { name: "Eliminar embarques" }));
    await waitFor(() =>
      expect(within(dialogo).getByRole("alert").textContent).toBe(
        "No se pudo confirmar el borrado. Recarga la lista para ver cómo quedó.",
      ),
    );
    expect(mocks.show).not.toHaveBeenCalled();
  });

  it("cancelar no borra y conserva la selección", async () => {
    const { user, dialogo } = await elegirYAbrir();
    await user.click(within(dialogo).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(mocks.deleteShipmentsAction).not.toHaveBeenCalled();
    expect(screen.getByRole("checkbox", { name: "Seleccionar S-2026-0001" })).toBeChecked();
  });

  it("más de 100: «Eliminar…» deshabilitado y dice cuántos quitar", async () => {
    const user = userEvent.setup();
    const muchos = Array.from({ length: 101 }, (_, i) => envio(i + 1));
    const info = Object.fromEntries(muchos.map((s) => [s.id, { bloqueos: {}, avisos: {} }]));
    pintar({ estado: "lista", info }, muchos);
    await user.click(screen.getByRole("checkbox", { name: /Seleccionar los embarques de .* que se pueden eliminar/ }));
    const barra = screen.getByRole("region", { name: /Selección de embarques/ });
    const eliminar = within(barra).getByRole("button", { name: "Eliminar…" });
    expect(eliminar).toBeDisabled();
    expect(eliminar).toHaveAccessibleDescription("Elige hasta 100 por vez: quita 1 de la selección.");
  });
});

describe("EmbarquesClient · «Ver los pasos» (SDD-0560)", () => {
  it("la fila bloqueada ofrece el asistente, sin tocar la descripción de la casilla", () => {
    pintar({ estado: "lista", info: INFO });
    const ver = screen.getByRole("button", { name: "Ver los pasos para eliminar S-2026-0002" });
    expect(ver.textContent).toBe("Ver los pasos");
    // La descripción de la casilla sigue siendo sólo el motivo.
    expect(screen.getByRole("checkbox", { name: "Seleccionar S-2026-0002" })).toHaveAccessibleDescription(MOTIVO_S2);
    // Las que se pueden eliminar no lo necesitan.
    expect(screen.queryByRole("button", { name: "Ver los pasos para eliminar S-2026-0001" })).toBeNull();
  });

  it("sin lectura de la fila, o ya eliminado, no se ofrece (no hay plan que mostrar)", () => {
    pintar({
      estado: "lista",
      info: { "s-1": INFO["s-1"], "s-2": { bloqueos: { already_deleted: 1 }, avisos: {} } },
    });
    expect(screen.queryByRole("button", { name: /Ver los pasos para eliminar/ })).toBeNull();
  });

  it("abre el asistente de ese embarque", async () => {
    const user = userEvent.setup();
    mocks.leerPlanDeBorradoAction.mockResolvedValue({ ok: false, error: "No se pudo revisar." });
    pintar({ estado: "lista", info: INFO });
    await user.click(screen.getByRole("button", { name: "Ver los pasos para eliminar S-2026-0002" }));
    expect(await screen.findByRole("heading", { name: "Eliminar S-2026-0002 paso a paso" })).toBeTruthy();
    expect(mocks.leerPlanDeBorradoAction).toHaveBeenCalledWith("s-2");
  });

  it("al eliminar desde el asistente: un solo aviso y se cierra", async () => {
    const user = userEvent.setup();
    const hecho = "Embarque S-2026-0002 eliminado. Ya no aparece en Embarques, Tracking ni el Portal.";
    const { calcularPlan } = await import("@/lib/studio/borrado/asistente");
    mocks.leerPlanDeBorradoAction.mockResolvedValue({
      ok: true,
      plan: calcularPlan({
        embarque: { id: "s-2", codigo: "S-2026-0002" },
        info: { bloqueos: {}, avisos: {} },
        facturas: [],
        gastos: [],
        cxp: [],
        rutas: [],
        consolidaciones: [],
        recepciones: [],
        compras: [],
      }),
    });
    mocks.ejecutarPasoDeBorradoAction.mockResolvedValue({ ok: true, hecho, eliminado: true, plan: null });
    pintar({ estado: "lista", info: INFO });
    await user.click(screen.getByRole("button", { name: "Ver los pasos para eliminar S-2026-0002" }));
    await user.click(await screen.findByRole("button", { name: "Eliminar embarque…" }));
    const confirmacion = screen.getAllByRole("dialog")[1];
    await user.type(within(confirmacion).getByLabelText(/Motivo/), "Embarque de prueba");
    await user.click(within(confirmacion).getByRole("button", { name: "Eliminar embarque" }));

    await waitFor(() => expect(screen.queryAllByRole("dialog")).toHaveLength(0));
    expect(mocks.show).toHaveBeenCalledTimes(1);
    expect(mocks.show.mock.calls[0][0]).toMatchObject({ eventKey: "shipments:deleted", tone: "success", message: hecho });
  });
});
