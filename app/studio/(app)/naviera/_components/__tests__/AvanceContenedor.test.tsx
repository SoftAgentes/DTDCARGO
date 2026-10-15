/**
 * SDD-0530 · El diálogo de «Marcar zarpado / arribado» y el resumen que queda
 * a la vista, en jsdom.
 */
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ResumenAvanceContenedor } from "@/lib/studio/naviera/avance-por-contenedor";

const mocks = vi.hoisted(() => ({ toastSuccess: vi.fn() }));
vi.mock("@/app/studio/_components/ui/ToastProvider", () => ({
  useToast: () => ({ success: mocks.toastSuccess, error: vi.fn(), info: vi.fn(), warning: vi.fn(), show: vi.fn() }),
}));

import { AvanceContenedorAccion, mensajeConfirmacionAvance } from "../AvanceContenedorAccion";
import { AvanceContenedorResumen } from "../AvanceContenedorResumen";

const originalOffsetParent = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetParent");
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "offsetParent", {
    configurable: true,
    get() {
      return document.body;
    },
  });
});
afterAll(() => {
  if (originalOffsetParent) Object.defineProperty(HTMLElement.prototype, "offsetParent", originalOffsetParent);
});
beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

function resumen(over: Partial<ResumenAvanceContenedor> = {}): ResumenAvanceContenedor {
  return {
    outcome: "transitioned",
    to: "zarpado",
    destino: "shipped",
    destinoTexto: "Embarcado",
    consolidationRef: "DTD-CONSOL-0101",
    avanzados: [
      { code: "ENV-101", clientMarkbox: "DTD-101" },
      { code: "ENV-102", clientMarkbox: "DTD-102" },
    ],
    saltados: [
      { code: "ENV-103", clientMarkbox: "DTD-103", motivo: "entregado", motivoTexto: "Ya está entregado" },
      { code: "ENV-109", clientMarkbox: null, motivo: "excepcion", motivoTexto: "Está en excepción: resuélvela en Tracking" },
    ],
    piezasSinEnvio: 1,
    avisosProgramados: 2,
    ...over,
  };
}

describe("AvanceContenedorResumen", () => {
  it("dice cuántos avanzaron, los avisos y cuáles no cambiaron con su motivo", () => {
    render(<AvanceContenedorResumen resumen={resumen()} />);
    const region = screen.getByRole("region", { name: "Resumen del zarpe" });
    expect(within(region).getByRole("heading", { name: "Zarpe de DTD-CONSOL-0101 registrado" })).toBeInTheDocument();
    expect(region).toHaveTextContent("2 envíos pasaron a Embarcado. 2 avisos de «Embarcado» en la agenda.");
    expect(region).toHaveTextContent("2 envíos no cambiaron:");
    const items = within(region).getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual([
      "ENV-103 · DTD-103 — Ya está entregado",
      "ENV-109 — Está en excepción: resuélvela en Tracking",
    ]);
    expect(region).toHaveTextContent(
      "1 pieza del contenedor no tiene envío asociado: por ella no se avanzó ni se avisó a nadie.",
    );
  });

  it("en singular y sin avisos lo dice tal cual", () => {
    render(
      <AvanceContenedorResumen
        resumen={resumen({
          avanzados: [{ code: "ENV-101", clientMarkbox: "DTD-101" }],
          saltados: [{ code: "ENV-103", clientMarkbox: "DTD-103", motivo: "entregado", motivoTexto: "Ya está entregado" }],
          piezasSinEnvio: 0,
          avisosProgramados: 0,
        })}
      />,
    );
    const region = screen.getByRole("region", { name: "Resumen del zarpe" });
    expect(region).toHaveTextContent("1 envío pasó a Embarcado. No se programó ningún aviso de «Embarcado».");
    expect(region).toHaveTextContent("1 envío no cambió:");
    expect(region).not.toHaveTextContent("pieza");
  });

  it("al arribar suma los avisos de «Tu carga llegó a Venezuela»", () => {
    render(
      <AvanceContenedorResumen
        resumen={resumen({
          to: "arribado",
          destino: "in_customs",
          destinoTexto: "En aduana",
          consolidationRef: "DTD-CONSOL-0102",
          saltados: [],
          piezasSinEnvio: 0,
          avisosProgramados: 1,
          avisosLlegada: 3,
        })}
      />,
    );
    const region = screen.getByRole("region", { name: "Resumen del arribo" });
    expect(within(region).getByRole("heading", { name: "Arribo de DTD-CONSOL-0102 registrado" })).toBeInTheDocument();
    expect(region).toHaveTextContent(
      "2 envíos pasaron a En aduana. 1 aviso de «En aduana» en la agenda. 3 avisos de «Tu carga llegó a Venezuela» en la agenda.",
    );
    expect(within(region).queryByRole("list")).toBeNull();
  });

  it("si ya estaba zarpado, dice que no se tocó nada", () => {
    render(<AvanceContenedorResumen resumen={resumen({ outcome: "already", avanzados: [], saltados: [], avisosProgramados: 0 })} />);
    const region = screen.getByRole("region", { name: "Resumen del zarpe" });
    expect(within(region).getByRole("heading", { name: "DTD-CONSOL-0101 ya estaba zarpado" })).toBeInTheDocument();
    expect(region).toHaveTextContent("No se tocó ningún envío ni se programó ningún aviso.");
    expect(region).not.toHaveTextContent("pieza");
  });
});

describe("mensajeConfirmacionAvance", () => {
  it("nombra el contenedor, cuántos envíos y la consecuencia", () => {
    expect(mensajeConfirmacionAvance("zarpado", "DTD-CONSOL-0101", 3)).toBe(
      "Los 3 envíos de DTD-CONSOL-0101 pasan a «Embarcado». A sus clientes les sale el aviso de embarque, según las reglas de avisos. No se tocan los entregados, los cancelados, los que están en excepción ni los que ya van más adelante. Cada cambio queda en el historial del envío.",
    );
    expect(mensajeConfirmacionAvance("arribado", "DTD-CONSOL-0102", 1)).toBe(
      "El envío de DTD-CONSOL-0102 pasa a «En aduana». A su cliente le sale «Tu carga llegó a Venezuela» y, si está activa, la regla de aviso de aduana. No se tocan los entregados, los cancelados, los que están en excepción ni los que ya van más adelante. Cada cambio queda en el historial del envío.",
    );
    expect(mensajeConfirmacionAvance("zarpado", "DTD-CONSOL-0103", 0)).toBe(
      "DTD-CONSOL-0103 no tiene envíos asignados: sólo cambia el estado del contenedor.",
    );
  });
});

describe("AvanceContenedorAccion", () => {
  function montar(onAvanzar: () => Promise<unknown>) {
    const onResumen = vi.fn();
    render(
      <AvanceContenedorAccion
        to="zarpado"
        consolidationRef="DTD-CONSOL-0101"
        totalEnvios={3}
        onAvanzar={onAvanzar as never}
        onResumen={onResumen}
      />,
    );
    return { onResumen };
  }

  it("abrir el diálogo no cambia nada; confirmar llama una vez, cierra y deja el resumen", async () => {
    const user = userEvent.setup();
    let resolver!: (v: unknown) => void;
    const onAvanzar = vi.fn(() => new Promise((res) => { resolver = res; }));
    const { onResumen } = montar(onAvanzar);

    await user.click(screen.getByRole("button", { name: "Marcar zarpado" }));
    const dialogo = screen.getByRole("dialog", { name: "Marcar zarpado · DTD-CONSOL-0101" });
    expect(dialogo).toHaveTextContent("Los 3 envíos de DTD-CONSOL-0101 pasan a «Embarcado».");
    expect(onAvanzar).not.toHaveBeenCalled();

    const confirmar = within(dialogo).getByRole("button", { name: "Marcar zarpado" });
    await user.click(confirmar);
    await user.click(confirmar);
    expect(onAvanzar).toHaveBeenCalledTimes(1);

    const r = resumen();
    await act(async () => { resolver({ ok: true, avance: r }); });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onResumen).toHaveBeenCalledWith(r);
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "Contenedor zarpado · 2 envíos pasaron a Embarcado · 2 sin cambio",
    );
  });

  it("si falla, el error queda en el diálogo y no hay resumen", async () => {
    const user = userEvent.setup();
    const onAvanzar = vi.fn(async () => ({ error: "No tienes permiso para cambiar el estado de este contenedor." }));
    const { onResumen } = montar(onAvanzar);

    await user.click(screen.getByRole("button", { name: "Marcar zarpado" }));
    const dialogo = screen.getByRole("dialog");
    await user.click(within(dialogo).getByRole("button", { name: "Marcar zarpado" }));

    expect(screen.getByRole("dialog")).toHaveTextContent("No tienes permiso para cambiar el estado de este contenedor.");
    expect(onResumen).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).not.toHaveBeenCalled();

    // Reintentar después del mismo error vuelve a llamar: el diálogo no queda trabado.
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Marcar zarpado" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Marcar zarpado" }));
    expect(onAvanzar).toHaveBeenCalledTimes(3);
  });

  it("si la llamada se cae, dice que reintentar es seguro", async () => {
    const user = userEvent.setup();
    const onAvanzar = vi.fn(async () => { throw new Error("red"); });
    montar(onAvanzar);
    await user.click(screen.getByRole("button", { name: "Marcar zarpado" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Marcar zarpado" }));
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "No se pudo confirmar el cambio. Puedes volver a intentarlo: si ya se hizo, no se repite.",
    );
  });

  it("cancelar cierra sin llamar", async () => {
    const user = userEvent.setup();
    const onAvanzar = vi.fn();
    montar(onAvanzar);
    await user.click(screen.getByRole("button", { name: "Marcar zarpado" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onAvanzar).not.toHaveBeenCalled();
  });
});
