/**
 * SDD-0603 · tramo 5d (BD-037): cada conversación de la lista se abre con un
 * control real, «Abrir», que es su única parada de teclado. La fila sigue
 * abriendo con el ratón, fuera del orden de Tab. La elegida y los filtros
 * elegidos se marcan con tinta, no con vino. Datos inventados.
 */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ConversationRow } from "@/lib/studio/conversaciones/conversations-types";
import { ConversationList } from "./ConversationList";

function conversacion(i: number, channel: ConversationRow["channel"]): ConversationRow {
  return {
    id: `conv-${i}`,
    tenant_id: "10000000-0000-4000-8000-000000000001",
    client_id: `cli-${i}`,
    ref: null,
    channel,
    status: "abierto",
    is_case: false,
    assigned_to: null,
    subject: null,
    last_message_at: null,
    unread_count: 0,
    external_ref: null,
    created_at: "2026-11-08T00:00:00Z",
    updated_at: "2026-11-08T00:00:00Z",
    deleted_at: null,
    markbox: `DTD-000${i}`,
    client_name: `Cliente sintético ${i}`,
    email: null,
    phone: null,
    agent: null,
    last_message_preview: "Mensaje de prueba",
    last_message_direction: "in",
  };
}

const LISTA = [conversacion(1, "whatsapp"), conversacion(2, "portal")];

function pintar(selectedId: string | null = "conv-1") {
  const onSelect = vi.fn<(id: string) => void>();
  const setStatusFilter = vi.fn();
  const setChannelFilter = vi.fn();
  render(
    <ConversationList
      list={LISTA}
      selectedId={selectedId}
      onSelect={onSelect}
      statusFilter="abierto"
      setStatusFilter={setStatusFilter}
      channelFilter="all"
      setChannelFilter={setChannelFilter}
      search=""
      setSearch={vi.fn()}
    />,
  );
  return { onSelect, setStatusFilter, setChannelFilter };
}

afterEach(cleanup);

describe("ConversationList · «Abrir» en la fila (SDD-0603, tramo 5d)", () => {
  it("cada fila trae «Abrir» con nombre que dice qué abre", () => {
    pintar();
    const botones = screen.getAllByRole("button", { name: /^Abrir conversación de / });
    expect(botones.map((b) => b.getAttribute("aria-label"))).toEqual([
      "Abrir conversación de Cliente sintético 1 por WhatsApp",
      "Abrir conversación de Cliente sintético 2 por Portal",
    ]);
    for (const b of botones) {
      expect(b.textContent).toBe("Abrir");
      expect((b as HTMLButtonElement).tabIndex).toBe(0);
    }
  });

  it("la fila sigue abriendo con el ratón, pero sale del Tab", async () => {
    const user = userEvent.setup();
    const { onSelect } = pintar();
    const datos = screen.getByText("Cliente sintético 2").closest("button")!;
    expect(datos.tabIndex).toBe(-1);
    await user.click(datos);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenLastCalledWith("conv-2");
  });

  it("«Abrir» abre lo mismo con teclado, una sola vez", async () => {
    const user = userEvent.setup();
    const { onSelect } = pintar();
    screen.getByRole("button", { name: "Abrir conversación de Cliente sintético 2 por Portal" }).focus();
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenLastCalledWith("conv-2");
  });

  it("la elegida lleva relleno de tinta y aria-current; las otras, secundario; ninguna usa vino", () => {
    pintar();
    const sel = screen.getByRole("button", { name: "Abrir conversación de Cliente sintético 1 por WhatsApp" });
    const otra = screen.getByRole("button", { name: "Abrir conversación de Cliente sintético 2 por Portal" });
    expect(sel.className.split(" ")).toEqual(expect.arrayContaining(["studio-btn", "studio-btn-dark", "studio-btn-sm"]));
    expect(sel.getAttribute("aria-current")).toBe("true");
    expect(otra.className.split(" ")).toEqual(expect.arrayContaining(["studio-btn", "studio-btn-ghost", "studio-btn-sm"]));
    expect(otra.hasAttribute("aria-current")).toBe(false);
    const fila = sel.parentElement as HTMLElement;
    expect(fila.style.borderLeft).toContain("var(--ctl-border)");
    expect(fila.getAttribute("style")).not.toMatch(/--wine/);
    expect((otra.parentElement as HTMLElement).getAttribute("style")).not.toMatch(/--wine|--ctl-border/);
  });

  it("los filtros son chips con contorno; el elegido va con relleno de tinta y aria-pressed", async () => {
    const user = userEvent.setup();
    const { setStatusFilter, setChannelFilter } = pintar();
    const abiertas = screen.getByRole("button", { name: "Abiertas" });
    const resueltas = screen.getByRole("button", { name: "Resueltas" });
    const todos = screen.getByRole("button", { name: "Todos" });
    const portal = screen.getByRole("button", { name: "Portal" });
    for (const chip of [abiertas, resueltas, todos, portal]) {
      expect(chip.className).toBe("studio-chip");
      expect(chip.hasAttribute("style")).toBe(false);
    }
    expect(abiertas.getAttribute("aria-pressed")).toBe("true");
    expect(abiertas.getAttribute("data-activo")).toBe("true");
    expect(resueltas.getAttribute("aria-pressed")).toBe("false");
    expect(resueltas.hasAttribute("data-activo")).toBe(false);
    expect(todos.getAttribute("data-activo")).toBe("true");
    expect(portal.hasAttribute("data-activo")).toBe(false);

    await user.click(resueltas);
    expect(setStatusFilter).toHaveBeenCalledWith("resuelto");
    await user.click(portal);
    expect(setChannelFilter).toHaveBeenCalledWith("portal");
  });
});
