/**
 * SDD-0689 · Embarques: encabezado del contenedor y clic en el cliente (pedido de Sam, 2026-11-20).
 *  - Encabezado: el peso total para todos; el «Total sin facturar» (USD de los borradores) solo si la
 *    página pasó `montos` (accounting y admin), oculto tras un ojo que lo muestra 4 segundos.
 *    Sin borradores, «Sin precios cargados», nunca $0.00.
 *  - Clic en un cliente del detalle: con un solo embarque abre su ficha (el panel); con varios, abre
 *    su bloque de embarques.
 * Datos inventados.
 */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { ShipmentListRow } from "@/lib/studio/shipment-queries";
import type {
  ContenedoresDeEmbarques,
  MontosDeContenedores,
} from "@/lib/studio/embarques-contenedores";

vi.mock("../ShipmentDetailDrawer", () => ({
  ShipmentDetailDrawer: ({ shipment }: { shipment: { code: string } }) => (
    <div data-testid="ficha-embarque">{shipment.code}</div>
  ),
}));

import { EmbarquesClient } from "../EmbarquesClient";

beforeAll(() => {
  // jsdom no implementa scrollIntoView.
  Element.prototype.scrollIntoView = vi.fn();
});

function envio(id: string, over: Partial<ShipmentListRow> = {}): ShipmentListRow {
  return {
    id,
    code: `S-${id}`,
    client_name: "Cliente Uno",
    client_markbox: "DTD-1001",
    origin: "Yiwu",
    destination: "La Guaira",
    shipment_service: "puerta_a_puerta_DDP",
    status: "in_transit",
    weight_kg: 100,
    volume_m3: 1,
    created_at: "2026-10-02T10:00:00Z",
    ...over,
  };
}

// Cliente Uno: dos embarques; Cliente Dos y Tres: uno solo. Con tres clientes los bloques arrancan cerrados.
const ENVIOS = [
  envio("a1"),
  envio("a3", { weight_kg: 50.5 }),
  envio("a2", { client_name: "Cliente Dos", client_markbox: "DTD-1002", weight_kg: 20 }),
  envio("a4", { client_name: "Cliente Tres", client_markbox: "DTD-1003", weight_kg: 9.5 }),
];

const DATOS: ContenedoresDeEmbarques = {
  contenedores: [
    {
      id: "c64", ref: "DTD-CONSOL-0002", containerNo: null, numeroDtd: 64,
      status: "zarpado", naviera: null, eta: null, createdAt: "2026-09-29T00:00:00Z",
    },
  ],
  porEmbarque: { a1: "c64", a3: "c64", a2: "c64", a4: "c64" },
  cajasPorEmbarque: { a1: 10, a3: 5, a2: 1, a4: 2 },
  recibidasPorContenedor: {},
};

const CON_BORRADORES: MontosDeContenedores = {
  estado: "lista",
  porEmbarque: {
    a1: { facturas: 1, porCobrarUsd: 1500, cobradoUsd: 0, otraMoneda: 0, borradores: 1, sinFacturarUsd: 1500 },
    a2: { facturas: 1, porCobrarUsd: 250.75, cobradoUsd: 0, otraMoneda: 0, borradores: 1, sinFacturarUsd: 250.75 },
  },
};

const SIN_BORRADORES: MontosDeContenedores = { estado: "lista", porEmbarque: {} };

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function region(): HTMLElement {
  return screen.getByRole("region", { name: "DDP 64" });
}

function cabecera(): HTMLElement {
  return within(region()).getAllByRole("button")[0];
}

/** Con un solo contenedor la vista lo abre sola; si está cerrado, se abre. */
async function abrir(): Promise<void> {
  if (cabecera().getAttribute("aria-expanded") !== "true") await userEvent.click(cabecera());
}

describe("EmbarquesClient · encabezado del contenedor (SDD-0689)", () => {
  it("muestra el peso total a todos y el «Total sin facturar» oculto tras el ojo", () => {
    vi.useFakeTimers();
    render(
      <EmbarquesClient shipments={ENVIOS} adjuntos={undefined} contenedores={DATOS} montos={CON_BORRADORES} />,
    );
    expect(cabecera().textContent ?? "").toContain("180 kg");
    const monto = within(region()).getByTestId("total-sin-facturar");
    expect(monto.textContent).toBe("Sin facturar••••••");
    expect(monto.textContent).not.toContain("$");

    fireEvent.click(within(monto).getByRole("button", { name: /Mostrar el total sin facturar de DDP 64/ }));
    expect(monto.textContent).toBe("Sin facturar$1,750.75");

    act(() => {
      vi.advanceTimersByTime(3900);
    });
    expect(monto.textContent).toContain("$1,750.75");
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(monto.textContent).toBe("Sin facturar••••••");
  });

  it("con teclado: Enter muestra, Espacio oculta, y al ocultarse solo no se pierde el foco", async () => {
    // Relojes reales: userEvent no avanza con relojes falsos en este entorno. La espera real es de 4 s.
    const user = userEvent.setup();
    render(
      <EmbarquesClient shipments={ENVIOS} adjuntos={undefined} contenedores={DATOS} montos={CON_BORRADORES} />,
    );
    const monto = within(region()).getByTestId("total-sin-facturar");
    const ojo = within(monto).getByRole("button");
    ojo.focus();
    expect(ojo.getAttribute("aria-pressed")).toBe("false");

    await user.keyboard("{Enter}");
    expect(monto.textContent).toContain("$1,750.75");
    expect(ojo.getAttribute("aria-pressed")).toBe("true");
    expect(ojo.getAttribute("aria-label")).toMatch(/^Ocultar el total sin facturar de DDP 64/);

    await user.keyboard(" ");
    expect(monto.textContent).toBe("Sin facturar••••••");

    await user.keyboard("{Enter}");
    expect(monto.textContent).toContain("$1,750.75");
    await waitFor(() => expect(monto.textContent).toBe("Sin facturar••••••"), { timeout: 5000 });
    expect(document.activeElement).toBe(ojo);
    expect(ojo.getAttribute("aria-label")).toMatch(/^Mostrar el total sin facturar de DDP 64 por 4 segundos/);
  }, 10_000);

  it("el ojo no abre el contenedor: va fuera del botón de la cabecera", () => {
    render(
      <EmbarquesClient shipments={ENVIOS} adjuntos={undefined} contenedores={DATOS} montos={CON_BORRADORES} />,
    );
    const ojo = within(region()).getByRole("button", { name: /Mostrar el total sin facturar/ });
    expect(cabecera().contains(ojo)).toBe(false);
    const antes = cabecera().getAttribute("aria-expanded");
    fireEvent.click(ojo);
    expect(cabecera().getAttribute("aria-expanded")).toBe(antes);
  });

  it("sin montos (operaciones, comercial) hay peso pero ningún dinero", () => {
    render(<EmbarquesClient shipments={ENVIOS} adjuntos={undefined} contenedores={DATOS} />);
    const texto = cabecera().textContent ?? "";
    expect(texto).toContain("180 kg");
    expect(region().textContent ?? "").not.toMatch(/sin facturar|[$]/i);
    expect(within(region()).queryByTestId("total-sin-facturar")).toBeNull();
  });

  it("con montos pero sin borradores dice «Sin precios cargados», no $0.00", () => {
    render(
      <EmbarquesClient shipments={ENVIOS} adjuntos={undefined} contenedores={DATOS} montos={SIN_BORRADORES} />,
    );
    const monto = within(region()).getByTestId("total-sin-facturar");
    expect(monto.textContent).toBe("Sin precios cargados");
    expect(within(monto).queryByRole("button")).toBeNull();
  });
});

describe("EmbarquesClient · clic en el cliente del detalle (SDD-0689)", () => {
  it("con un solo embarque abre su ficha", async () => {
    render(<EmbarquesClient shipments={ENVIOS} adjuntos={undefined} contenedores={DATOS} />);
    await abrir();
    const tabla = within(region()).getByRole("table");
    await userEvent.click(within(tabla).getByRole("button", { name: /Cliente Dos/ }));
    expect(screen.getByTestId("ficha-embarque").textContent).toBe("S-a2");
  });

  it("con varios embarques abre su bloque y lo trae a la vista", async () => {
    render(<EmbarquesClient shipments={ENVIOS} adjuntos={undefined} contenedores={DATOS} />);
    await abrir();
    expect(screen.queryByText("S-a1")).toBeNull();
    const tabla = within(region()).getByRole("table");
    await userEvent.click(within(tabla).getByRole("button", { name: /Cliente Uno/ }));
    expect(await screen.findByText("S-a1")).toBeTruthy();
    expect(screen.getByText("S-a3")).toBeTruthy();
    expect(screen.queryByTestId("ficha-embarque")).toBeNull();
  });
});
