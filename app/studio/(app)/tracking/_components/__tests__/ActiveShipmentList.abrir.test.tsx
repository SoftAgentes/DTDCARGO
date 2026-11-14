/**
 * SDD-0603 · tramo 5c: la tarjeta de la barra de Tracking se abre con un
 * control real, «Abrir», que es su única parada de teclado. La seleccionada
 * se marca con tinta (relleno del botón y contorno), no con vino.
 */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActiveShipmentList, type ActiveShipmentRow } from "../ActiveShipmentList";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(),
}));

function envio(i: number): ActiveShipmentRow {
  return {
    id: `s-${i}`, code: `S-2026-000${i}`, client_name: "Cliente de prueba",
    client_markbox: "DTD-0001", origin: "Yiwu", destination: "Valencia",
    shipment_service: "puerta_a_puerta_DDP", status: "in_transit",
    created_at: "2026-10-01T10:00:00Z", arrived_destination_at: null,
  };
}

const ENVIOS = [envio(1), envio(2)];
const pintar = () => render(<ActiveShipmentList shipments={ENVIOS} selectedId="s-1" adjuntos={{}} />);

afterEach(() => {
  cleanup();
  replace.mockReset();
});

describe("ActiveShipmentList · «Abrir» en la tarjeta (SDD-0603, tramo 5c)", () => {
  it("cada tarjeta trae «Abrir» con nombre que dice qué abre", () => {
    pintar();
    const botones = screen.getAllByRole("button", { name: /^Abrir embarque / });
    expect(botones).toHaveLength(ENVIOS.length);
    for (const [i, b] of botones.entries()) {
      expect(b.getAttribute("aria-label")).toBe(`Abrir embarque ${ENVIOS[i].code}`);
      expect(b.textContent).toBe("Abrir");
      expect(b.tabIndex).toBe(0);
    }
  });

  it("la tarjeta sigue abriendo con el ratón, pero sale del Tab", async () => {
    const user = userEvent.setup();
    pintar();
    const datos = screen.getByText("S-2026-0002").closest("button")!;
    expect(datos.tabIndex).toBe(-1);
    await user.click(datos);
    expect(replace).toHaveBeenLastCalledWith("?id=s-2", { scroll: false });
  });

  it("«Abrir» abre lo mismo con teclado", async () => {
    const user = userEvent.setup();
    pintar();
    screen.getByRole("button", { name: "Abrir embarque S-2026-0002" }).focus();
    await user.keyboard("{Enter}");
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenLastCalledWith("?id=s-2", { scroll: false });
  });

  it("la seleccionada lleva relleno de tinta y aria-current; las otras, secundario", () => {
    pintar();
    const sel = screen.getByRole("button", { name: "Abrir embarque S-2026-0001" });
    const otra = screen.getByRole("button", { name: "Abrir embarque S-2026-0002" });
    expect(sel.className.split(" ")).toEqual(expect.arrayContaining(["studio-btn", "studio-btn-dark", "studio-btn-sm"]));
    expect(sel.getAttribute("aria-current")).toBe("true");
    expect(otra.className.split(" ")).toEqual(expect.arrayContaining(["studio-btn", "studio-btn-ghost", "studio-btn-sm"]));
    expect(otra.hasAttribute("aria-current")).toBe(false);
    const tarjeta = document.querySelector('[data-row-id="S-2026-0001"]') as HTMLElement;
    expect(tarjeta.style.border).toContain("var(--ctl-border)");
    expect(tarjeta.getAttribute("style")).not.toMatch(/--wine/);
  });
});
