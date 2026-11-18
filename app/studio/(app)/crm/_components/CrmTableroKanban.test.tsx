import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi, type Mock } from "vitest";
import {
  armarColumnas,
  type CrmEtapa,
  type CrmTarjetaTablero,
} from "@/lib/studio/crm-tablero";
import { ChatPermitido } from "./ChatPermitido";
import { CrmTableroKanban } from "./CrmTableroKanban";

afterEach(cleanup);

const ETAPAS: CrmEtapa[] = [
  { tablero: "leads", clave: "nuevo", nombre: "Nuevo", orden: 10, terminal: false, sistema: true, activa: true },
  { tablero: "leads", clave: "contactado", nombre: "Contactado", orden: 20, terminal: false, sistema: true, activa: true },
  { tablero: "leads", clave: "perdido", nombre: "Perdido", orden: 90, terminal: true, sistema: true, activa: true },
  { tablero: "clientes", clave: "activo", nombre: "Activo", orden: 10, terminal: false, sistema: true, activa: true },
  { tablero: "clientes", clave: "postventa", nombre: "Postventa", orden: 20, terminal: false, sistema: true, activa: true },
];

const lead: CrmTarjetaTablero = {
  id: "t-1",
  nombre: "Lead de prueba",
  shippingMark: null,
  segmento: "lead_registrado",
  tablero: "leads",
  etapa: "nuevo",
  origen: { tablero: "clientes", etapa: "postventa", vuelta: true },
  diasEnEtapa: 45,
  asesorNombre: "Asesora de prueba",
  tareasAbiertas: 2,
  tareasVencidas: 1,
  fuente: "manual",
  utmSource: null,
};

function pintar({
  canEdit = true,
  tarjetas = [lead],
  onMove = vi.fn<(t: CrmTarjetaTablero, d: CrmEtapa) => void>(),
  onOpen = vi.fn<(t: CrmTarjetaTablero) => void>(),
  chat = false,
}: {
  chat?: boolean;
  canEdit?: boolean;
  tarjetas?: CrmTarjetaTablero[];
  onMove?: Mock<(t: CrmTarjetaTablero, d: CrmEtapa) => void>;
  onOpen?: Mock<(t: CrmTarjetaTablero) => void>;
} = {}) {
  render(
    <ChatPermitido valor={chat}>
      <CrmTableroKanban
        tablero="leads"
        columnas={armarColumnas(ETAPAS, tarjetas, "leads")}
        etapas={ETAPAS}
        canEdit={canEdit}
        moviendo={new Set()}
        onMove={onMove}
        onOpen={onOpen}
      />
    </ChatPermitido>,
  );
  return { onMove, onOpen };
}

describe("CrmTableroKanban · columnas y tarjeta", () => {
  it("pinta las etapas de Leads en orden y la tarjeta en su columna", () => {
    pintar();
    const columnas = screen.getAllByRole("region");
    expect(columnas.map((c) => c.getAttribute("aria-label"))).toEqual([
      "Etapa Nuevo",
      "Etapa Contactado",
      "Etapa Perdido",
    ]);
    expect(within(columnas[0]).getByText("Lead de prueba")).toBeTruthy();
    expect(within(columnas[1]).getByText("Sin tarjetas en esta etapa.")).toBeTruthy();
  });

  it("dice de dónde vino, el dueño, el segmento y la tarea vencida", () => {
    pintar();
    expect(screen.getByText(/Volvió de Clientes · Postventa/)).toBeTruthy();
    expect(screen.getByText("Registrado · Asesora de prueba")).toBeTruthy();
    expect(screen.getByText("1 tarea vencida")).toBeTruthy();
    // La antigüedad no depende solo del color.
    expect(screen.getByText(/más de 30 días/)).toBeTruthy();
  });

  it("las columnas se reparten el ancho con un mínimo de 232 px (SDD-0648 §3)", () => {
    pintar();
    const tablero = document.querySelector('[data-guia="embudo.tablero"]') as HTMLElement;
    expect(tablero.style.display).toBe("grid");
    expect(tablero.style.gridAutoColumns).toBe("minmax(232px, 1fr)");
  });
});

describe("CrmTableroKanban · logo del canal (SDD-0648 §2)", () => {
  it("pinta el canal con su nombre accesible", () => {
    pintar({ tarjetas: [{ ...lead, fuente: "instagram" }] });
    expect(screen.getByRole("img", { name: "Instagram" })).toBeTruthy();
  });

  it("una alta manual no pinta logo", () => {
    pintar({ tarjetas: [{ ...lead, fuente: "manual" }] });
    expect(document.querySelector("[data-canal]")).toBeNull();
  });

  it("TikTok sale del utm del registro web", () => {
    pintar({ tarjetas: [{ ...lead, fuente: "web_registro", utmSource: "tiktok" }] });
    expect(screen.getByRole("img", { name: "TikTok" })).toBeTruthy();
  });
});

describe("CrmTableroKanban · menú de la tarjeta (SDD-0648 §1)", () => {
  const disparador = () => screen.getByRole("button", { name: "Acciones de Lead de prueba" });

  it("el menú es un control de 32 × 32 con nombre que dice de quién es", () => {
    pintar();
    const b = disparador();
    expect(b.style.height).toBe("32px");
    expect(b.style.minWidth).toBe("32px");
    expect(b.getAttribute("aria-haspopup")).toBe("menu");
  });

  it("con teclado: el menú alcanza cualquier etapa activa del tablero, sin la actual", async () => {
    const user = userEvent.setup();
    const { onMove } = pintar();
    await user.click(disparador());
    const opciones = screen.getAllByRole("menuitem").map((o) => o.textContent?.trim());
    expect(opciones).toEqual(["Abrir ficha", "Mover a Contactado", "Mover a Perdido"]);

    await user.click(screen.getByRole("menuitem", { name: "Mover a Contactado" }));
    expect(onMove).toHaveBeenCalledWith(lead, expect.objectContaining({ clave: "contactado" }));
  });

  it("«Abrir chat» navega a la ruta que resuelve la conversación cuando el canal es de Chatwoot", async () => {
    const user = userEvent.setup();
    pintar({ tarjetas: [{ ...lead, fuente: "whatsapp_leads" }], chat: true });
    await user.click(disparador());
    const chat = screen.getByRole("menuitem", { name: "Abrir chat" });
    expect(chat.tagName).toBe("A");
    expect(chat.getAttribute("href")).toBe("/studio/crm/chat/t-1");
  });

  it("sin entrada a la Bandeja (rol o flag) no ofrece «Abrir chat» aunque el canal sea de Chatwoot", async () => {
    const user = userEvent.setup();
    pintar({ tarjetas: [{ ...lead, fuente: "whatsapp_leads" }], chat: false });
    await user.click(disparador());
    expect(screen.queryByRole("menuitem", { name: "Abrir chat" })).toBeNull();
  });

  it("sin canal de chat ni ficha no ofrece «Abrir chat»", async () => {
    const user = userEvent.setup();
    pintar({ tarjetas: [{ ...lead, fuente: "manual" }], chat: true });
    await user.click(disparador());
    expect(screen.queryByRole("menuitem", { name: "Abrir chat" })).toBeNull();
  });

  it("sin permiso de edición: el menú solo abre, no mueve", async () => {
    const user = userEvent.setup();
    pintar({ canEdit: false });
    await user.click(disparador());
    const opciones = screen.getAllByRole("menuitem").map((o) => o.textContent?.trim());
    expect(opciones).toEqual(["Abrir ficha"]);
  });
});

describe("CrmTableroKanban · mover y abrir (DND-01)", () => {
  const abrir = () => screen.getByRole("button", { name: "Abrir ficha de Lead de prueba" }) as HTMLButtonElement;
  const transferencia = () => {
    const store: Record<string, string> = {};
    return {
      setData: (k: string, v: string) => {
        store[k] = v;
      },
      getData: (k: string) => store[k] ?? "",
      effectAllowed: "",
    };
  };

  it("arrastrando: soltar en otra columna mueve; soltar en la misma no", () => {
    const { onMove } = pintar();
    const dataTransfer = transferencia();
    const card = document.querySelector('[data-tarjeta-id="t-1"]')!;
    fireEvent.dragStart(card, { dataTransfer });

    fireEvent.drop(screen.getByRole("region", { name: "Etapa Nuevo" }), { dataTransfer });
    expect(onMove).not.toHaveBeenCalled();

    fireEvent.drop(screen.getByRole("region", { name: "Etapa Contactado" }), { dataTransfer });
    expect(onMove).toHaveBeenCalledWith(lead, expect.objectContaining({ clave: "contactado" }));
  });

  it("SDD-0671: no hay botón «Abrir»; el nombre es la parada de teclado y la segunda es el menú", async () => {
    const user = userEvent.setup();
    const { onOpen } = pintar();
    expect(screen.queryByText("Abrir", { exact: true })).toBeNull();
    expect(screen.getAllByRole("button", { name: /^Abrir ficha de / })).toHaveLength(1);
    expect(abrir().tabIndex).toBe(0);
    expect(abrir().textContent).toContain("Lead de prueba");
    await user.tab();
    expect(document.activeElement).toBe(abrir());
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Acciones de Lead de prueba" }));
    await user.keyboard("{Escape}");
    abrir().focus();
    await user.keyboard("{Enter}");
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith(lead);
  });

  it("el nombre abre con el ratón, una sola vez, y abarca las dos líneas (32 px, BD-037)", async () => {
    const user = userEvent.setup();
    const { onOpen } = pintar();
    expect(abrir().style.minHeight).toBe("32px");
    expect(abrir().textContent).toContain("Registrado · Asesora de prueba");
    await user.click(abrir());
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith(lead);
  });

  it("SDD-0671: un clic en cualquier parte de la tarjeta abre la ficha; el menú no", async () => {
    const user = userEvent.setup();
    const { onOpen } = pintar();
    await user.click(screen.getByText("1 tarea vencida"));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith(lead);
    await user.click(screen.getByRole("button", { name: "Acciones de Lead de prueba" }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("menuitem", { name: "Mover a Contactado" }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("sin permiso de edición: no hay arrastre, pero la ficha se abre", () => {
    const { onMove } = pintar({ canEdit: false });
    const card = document.querySelector('[data-tarjeta-id="t-1"]')!;
    expect(card.getAttribute("draggable")).toBe("false");
    const dataTransfer = { getData: () => "t-1", setData: () => {} };
    fireEvent.drop(screen.getByRole("region", { name: "Etapa Contactado" }), { dataTransfer });
    expect(onMove).not.toHaveBeenCalled();
    expect(abrir()).toBeTruthy();
  });

  it("no estorba al arrastre: el arrastre que empieza sobre el nombre mueve sin abrir", () => {
    const { onMove, onOpen } = pintar();
    const card = document.querySelector('[data-tarjeta-id="t-1"]')!;
    expect(card.getAttribute("draggable")).toBe("true");
    expect(abrir().hasAttribute("draggable")).toBe(false);
    const dataTransfer = transferencia();
    fireEvent.dragStart(abrir(), { dataTransfer });
    expect(dataTransfer.getData("text/plain")).toBe("t-1");
    fireEvent.drop(screen.getByRole("region", { name: "Etapa Contactado" }), { dataTransfer });
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("el clic fantasma al soltar no abre la ficha; el siguiente clic sí", () => {
    vi.useFakeTimers();
    try {
      const { onOpen } = pintar();
      const card = document.querySelector('[data-tarjeta-id="t-1"]')!;
      const dataTransfer = transferencia();
      fireEvent.dragStart(card, { dataTransfer });
      fireEvent.click(abrir());
      expect(onOpen).not.toHaveBeenCalled();
      fireEvent.dragEnd(card, { dataTransfer });
      vi.runAllTimers();
      fireEvent.click(abrir());
      expect(onOpen).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
