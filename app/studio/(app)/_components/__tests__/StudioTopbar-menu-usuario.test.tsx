/**
 * SDD-0714 · la vista y el tema salen de la barra y viven en el menú del usuario,
 * guardados en su cuenta. Datos ficticios.
 */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const guardar = vi.hoisted(() => vi.fn(async () => ({ ok: true }) as { ok: true } | { error: string }));

vi.mock("next/navigation", () => ({ usePathname: () => "/studio/dashboard", useSearchParams: () => new URLSearchParams() }));
vi.mock("../../actions", () => ({ signOut: vi.fn() }));
vi.mock("@/app/studio/(app)/_actions/apariencia-actions", () => ({ guardarAparienciaAction: guardar }));
vi.mock("../../../_components/wiring/WiringProvider", () => ({
  useDTDWiring: () => ({ openProfileModal: vi.fn(), openShortcutsModal: vi.fn(), openBugReport: vi.fn() }),
}));
vi.mock("../../../_components/wiring/GlobalSearchModal", () => ({ GlobalSearchModal: () => null }));
vi.mock("../NotificationBell", () => ({ NotificationBell: () => <button type="button">Notificaciones</button> }));
vi.mock("../ConversationsIndicator", () => ({ ConversationsIndicator: () => null }));

import { ToastProvider } from "../../../_components/ui/ToastProvider";
import { DENSITY_KEY, THEME_KEY } from "../../../_components/appearance-prefs";
import { StudioTopbar } from "../StudioTopbar";

function pintar() {
  return render(
    <ToastProvider>
      <StudioTopbar
        userEmail="ana.prueba@example.test"
        displayName="Ana Prueba"
        roleLabel="Operaciones"
        userId="u-ficticio"
        initialNotifications={[]}
        conversationsTenantId={null}
        initialUnreadConversations={[]}
        showConversations={false}
      />
    </ToastProvider>,
  );
}

const abrir = () =>
  act(() => {
    fireEvent.click(screen.getByRole("button", { name: "Menú de usuario" }));
  });

const pulsado = (grupo: string, nombre: string) =>
  within(screen.getByRole("group", { name: grupo })).getByRole("button", { name: nombre }).getAttribute("aria-pressed");

describe("menú del usuario · SDD-0714", () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.density;
    delete document.documentElement.dataset.theme;
    guardar.mockClear();
  });
  afterEach(cleanup);

  it("A1 · la barra ya no lleva selector de vista ni botón de tema", () => {
    pintar();
    expect(screen.queryByRole("group", { name: "Vista" })).toBeNull();
    expect(screen.queryByRole("button", { name: /tema/i })).toBeNull();
    expect(screen.queryByRole("button", { name: "Compacta" })).toBeNull();
    expect(screen.getByRole("button", { name: "Menú de usuario" }).textContent).toContain("Ana Prueba");
  });

  it("A2 · el menú trae nombre, rol, Vista, Tema, Mi perfil y Cerrar sesión, en ese orden", () => {
    pintar();
    abrir();
    const menu = screen.getByRole("dialog", { name: "Menú de usuario" });
    const texto = menu.textContent ?? "";
    const orden = ["Ana Prueba", "Operaciones", "Vista", "Tema", "Mi perfil", "Cerrar sesión"].map((t) => texto.indexOf(t));
    expect(orden.every((i) => i >= 0)).toBe(true);
    expect([...orden].sort((a, b) => a - b)).toEqual(orden);
    for (const n of ["Normal", "Compacta", "Súper compacta"]) {
      expect(within(screen.getByRole("group", { name: "Vista" })).getByRole("button", { name: n })).toBeTruthy();
    }
    for (const n of ["Claro", "Oscuro", "Automático"]) {
      expect(within(screen.getByRole("group", { name: "Tema" })).getByRole("button", { name: n })).toBeTruthy();
    }
  });

  it("sin nada guardado: Compacta y Oscuro nacen marcadas", () => {
    pintar();
    abrir();
    expect(pulsado("Vista", "Compacta")).toBe("true");
    expect(pulsado("Vista", "Normal")).toBe("false");
    expect(pulsado("Tema", "Oscuro")).toBe("true");
  });

  it("A3 · elegir vista y tema los aplica, los guarda local y los manda a la cuenta", async () => {
    pintar();
    abrir();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Súper compacta" }));
    });
    expect(document.documentElement.dataset.density).toBe("ultra");
    expect(localStorage.getItem(DENSITY_KEY)).toBe("ultra");
    expect(pulsado("Vista", "Súper compacta")).toBe("true");
    expect(guardar).toHaveBeenLastCalledWith({ vista: "ultra", tema: "dark" });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Claro" }));
    });
    expect(document.documentElement.dataset.theme).toBe("");
    expect(localStorage.getItem(THEME_KEY)).toBe("light");
    expect(guardar).toHaveBeenLastCalledWith({ vista: "ultra", tema: "light" });
    // El menú sigue abierto: se puede seguir eligiendo.
    expect(screen.getByRole("dialog", { name: "Menú de usuario" })).toBeTruthy();
  });

  it("volver a oprimir la opción marcada no guarda otra vez", async () => {
    pintar();
    abrir();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Compacta" }));
    });
    expect(guardar).not.toHaveBeenCalled();
  });

  it("si la cuenta no guarda, avisa y el cambio queda en este equipo", async () => {
    guardar.mockResolvedValueOnce({ error: "No se pudo guardar en tu usuario." });
    pintar();
    abrir();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Normal" }));
    });
    expect(localStorage.getItem(DENSITY_KEY)).toBe("normal");
    expect(await screen.findByText(/El cambio quedó solo en este equipo/)).toBeTruthy();
  });

  it("A7 · al abrir, el foco entra a la vista marcada; Escape cierra y devuelve el foco", () => {
    pintar();
    abrir();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Compacta" }));
    act(() => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    expect(screen.queryByRole("dialog", { name: "Menú de usuario" })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Menú de usuario" }));
  });

  it("la pastilla declara qué abre", () => {
    pintar();
    const pastilla = screen.getByRole("button", { name: "Menú de usuario" });
    expect(pastilla.getAttribute("aria-expanded")).toBe("false");
    abrir();
    expect(pastilla.getAttribute("aria-expanded")).toBe("true");
    expect(pastilla.getAttribute("aria-controls")).toBe(screen.getByRole("dialog").id);
  });
});
