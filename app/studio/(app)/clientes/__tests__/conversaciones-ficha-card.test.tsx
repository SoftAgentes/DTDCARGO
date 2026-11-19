/**
 * SDD-0650 F2 · La tarjeta del panel de conversaciones y su componente de servidor.
 *
 * La tarjeta solo pinta lo que el servidor le pasó: sin `abrirHref` no hay «Abrir»
 * y aparece «hay conversaciones que tu rol no abre» sin número. El componente de
 * servidor muestra la tarjeta de la F1 cuando la F2 está apagada o sin uniones.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ cargar: vi.fn(), refresh: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: h.refresh }) }));
vi.mock("@/app/studio/_components/ui/ToastProvider", () => ({ useToast: () => ({ success: vi.fn() }) }));
vi.mock("../conversaciones-actions", () => ({ unirChatAction: vi.fn(), quitarUnionAction: vi.fn() }));
vi.mock("@/lib/studio/chatwoot/ficha-panel", () => ({ cargarPanelConversaciones: h.cargar }));

import type { PanelConversaciones } from "@/lib/studio/chatwoot/ficha-conversaciones";

import { ConversacionesFichaCard } from "../_components/ConversacionesFichaCard";
import { PanelConversacionesFicha } from "../_components/PanelConversacionesFicha";

afterEach(cleanup);

const FICHA = "c0000000-0000-0000-0000-0000000000a1";

const PANEL: PanelConversaciones = {
  items: [
    { conversationId: 12, estado: "open", ultimaActividad: null, texto: "SINT texto de WhatsApp", autor: "cliente", fechaMensaje: null, esArchivoKommo: false, abrirHref: "/studio/bandeja?c=12" },
    { conversationId: 11, estado: "resolved", ultimaActividad: null, texto: "SINT texto del archivo", autor: "equipo", fechaMensaje: null, esArchivoKommo: true, abrirHref: null },
  ],
  hayQueNoAbres: true,
  nombreEnElChat: "SINT Nombre del Chat",
  incompleto: false,
};

function montar(panel: PanelConversaciones = PANEL, extra: { puedeUnir?: boolean; puedeVerTexto?: boolean } = {}) {
  render(
    <ConversacionesFichaCard
      panel={panel}
      uniones={[{ chatwootContactId: 501, origen: "kommo" }]}
      puedeUnir={extra.puedeUnir ?? false}
      puedeVerTexto={extra.puedeVerTexto ?? true}
      clientId={FICHA}
      markbox="DTD-0001"
    />,
  );
}

describe("ConversacionesFichaCard", () => {
  it("un solo «Abrir», el de la conversación que el rol abre", () => {
    montar();
    const abrir = screen.getAllByRole("link", { name: "Abrir" });
    expect(abrir.map((a) => a.getAttribute("href"))).toEqual(["/studio/bandeja?c=12"]);
  });

  it("muestra el texto, el autor y el Archivo Kommo; avisa sin contar", () => {
    montar();
    expect(screen.getByText("SINT texto del archivo")).toBeTruthy();
    // La marca de la conversación (la unión de abajo también dice «del Archivo Kommo»).
    expect(screen.getByText("· Archivo Kommo")).toBeTruthy();
    const aviso = screen.getByText("Hay conversaciones que tu rol no abre.");
    expect(aviso.textContent).not.toMatch(/\d/);
  });

  it("«Nombre en el chat» cuando viene", () => {
    montar();
    expect(screen.getByText("SINT Nombre del Chat")).toBeTruthy();
  });

  it("sin texto por la región: lo dice, sin inventarlo", () => {
    montar({ ...PANEL, nombreEnElChat: null, items: PANEL.items.map((i) => ({ ...i, texto: null })) }, { puedeVerTexto: false });
    expect(screen.getAllByText(/El texto no se muestra en tu región/)).toHaveLength(2);
  });

  it("sin conversaciones", () => {
    montar({ items: [], hayQueNoAbres: false, nombreEnElChat: null, incompleto: false });
    expect(screen.getByText("Los chats unidos a esta ficha no tienen conversaciones.")).toBeTruthy();
    expect(screen.queryByText("Hay conversaciones que tu rol no abre.")).toBeNull();
  });

  it("unir y quitar solo con permiso de edición", () => {
    montar();
    expect(screen.queryByText("Vincular otra red")).toBeNull();
    expect(screen.queryByRole("button", { name: "Quitar" })).toBeNull();
    cleanup();
    montar(PANEL, { puedeUnir: true });
    expect(screen.getByText("Vincular otra red")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Quitar" })).toBeTruthy();
  });
});

describe("ConversacionesFichaCard · el chat del portal (SDD-0676)", () => {
  it("su chip dice «Portal · del portal» y no trae «Quitar», aunque la persona pueda quitar las demás", () => {
    render(
      <ConversacionesFichaCard
        panel={PANEL}
        uniones={[
          { chatwootContactId: 501, origen: "kommo" },
          { chatwootContactId: 777, origen: "portal", canal: "portal" },
        ]}
        puedeUnir
        puedeVerTexto
        clientId={FICHA}
        markbox="DTD-0001"
      />,
    );
    expect(screen.getByText("Portal")).toBeTruthy();
    expect(screen.getByText("del portal")).toBeTruthy();
    // Un solo «Quitar»: el de la unión del Archivo Kommo.
    expect(screen.getAllByRole("button", { name: "Quitar" })).toHaveLength(1);
  });
});

describe("PanelConversacionesFicha (servidor)", () => {
  const F1 = [{ conversation_id: 42, status: "open", unread_count: 0, last_activity_at: null }];
  const props = {
    supabase: {} as never,
    tenantId: "11111111-1111-1111-1111-111111111111",
    clientId: FICHA,
    markbox: "DTD-0001",
    acceso: { role: "commercial" as const },
    puedeVerDatos: true,
    fichaSinNombre: false,
    conversacionesF1: F1,
  };

  it.each([["apagado"], ["sin_uniones"]])("%s: la tarjeta de la F1, como hoy", async (estado) => {
    h.cargar.mockResolvedValueOnce({ estado });
    render(await PanelConversacionesFicha(props));
    expect(screen.getByText("Conversación #42")).toBeTruthy();
  });

  it("si el cargador lanza, la ficha no se cae: la tarjeta de la F1", async () => {
    h.cargar.mockRejectedValueOnce(new Error("x"));
    render(await PanelConversacionesFicha(props));
    expect(screen.getByText("Conversación #42")).toBeTruthy();
  });

  it("Chatwoot no responde: aviso con «Reintentar»", async () => {
    h.cargar.mockResolvedValueOnce({ estado: "chatwoot_no_responde" });
    render(await PanelConversacionesFicha(props));
    expect(screen.getByText(/Chatwoot no responde/)).toBeTruthy();
    screen.getByRole("button", { name: "Reintentar" }).click();
    expect(h.refresh).toHaveBeenCalled();
  });

  it("listo: el panel en vivo", async () => {
    h.cargar.mockResolvedValueOnce({ estado: "listo", panel: PANEL, uniones: [], puedeUnir: false });
    render(await PanelConversacionesFicha(props));
    expect(screen.getByText("SINT texto de WhatsApp")).toBeTruthy();
    expect(screen.queryByText("Conversación #42")).toBeNull();
  });
});
