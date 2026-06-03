/**
 * Tests de la torre de control · navegación por pestañas (SDD-0050 Slice A).
 *
 * Cubre los criterios de la spec para esta slice:
 *  - El default es `estado` cuando `?tab=` viene vacío/inválido.
 *  - El switch por `?tab=` navega cambiando el query param con el router.
 *  - Cada pestaña expone su badge de modo (vivo / snapshot / solo local).
 *  - Norte y Radar son placeholders visibles (EmptyState + banner de modo),
 *    sin contenido real todavía (Slice B/C).
 *
 * `next/navigation` se mockea: solo nos interesa qué push dispara cada tab.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import {
  DebugTabs,
  DEBUG_TABS,
  isDebugTab,
  resolveDebugTab,
  modeDotColor,
} from "../_components/DebugTabs";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

beforeEach(() => {
  push.mockClear();
});

function renderTabs(
  active: Parameters<typeof DebugTabs>[0]["active"],
  env: Parameters<typeof DebugTabs>[0]["env"] = "local",
) {
  return render(
    <DebugTabs
      active={active}
      env={env}
      estado={<div data-testid="estado-content">CONTENIDO ESTADO</div>}
      bugs={<div data-testid="bugs-content">CONTENIDO BUGS</div>}
      radar={<div data-testid="radar-content">CONTENIDO RADAR</div>}
    />,
  );
}

describe("resolveDebugTab / isDebugTab", () => {
  it("default es 'estado' cuando el tab es undefined/null/inválido", () => {
    expect(resolveDebugTab(undefined)).toBe("estado");
    expect(resolveDebugTab(null)).toBe("estado");
    expect(resolveDebugTab("")).toBe("estado");
    expect(resolveDebugTab("nope")).toBe("estado");
  });

  it("respeta tabs válidos", () => {
    expect(resolveDebugTab("estado")).toBe("estado");
    expect(resolveDebugTab("bugs")).toBe("bugs");
    expect(resolveDebugTab("norte")).toBe("norte");
    expect(resolveDebugTab("radar")).toBe("radar");
  });

  it("isDebugTab discrimina correctamente", () => {
    expect(isDebugTab("estado")).toBe(true);
    expect(isDebugTab("radar")).toBe(true);
    expect(isDebugTab("xxx")).toBe(false);
    expect(isDebugTab(null)).toBe(false);
  });
});

describe("modeDotColor", () => {
  it("mapea cada modo a un token de color del sistema (no hex)", () => {
    expect(modeDotColor("vivo")).toBe("var(--success)");
    expect(modeDotColor("snapshot")).toBe("var(--warning)");
    expect(modeDotColor("local")).toBe("var(--ink-mute)");
  });
});

describe("DebugTabs · render", () => {
  it("renderiza las 4 pestañas con su badge de modo", () => {
    renderTabs("estado");
    for (const t of DEBUG_TABS) {
      const tab = screen.getByRole("tab", { name: new RegExp(t.label) });
      expect(tab).toBeInTheDocument();
      // El dot de modo expone el modo via title y data-mode (no emoji).
      const dot = tab.querySelector(`[data-mode="${t.mode}"]`);
      expect(dot).not.toBeNull();
      expect(dot).toHaveAttribute("title", `Modo ${t.modeLabel}`);
    }
  });

  it("Estado y Bugs son modo vivo; Norte snapshot; Radar solo local", () => {
    const byKey = Object.fromEntries(DEBUG_TABS.map((t) => [t.key, t]));
    expect(byKey.estado.mode).toBe("vivo");
    expect(byKey.bugs.mode).toBe("vivo");
    expect(byKey.norte.mode).toBe("snapshot");
    expect(byKey.radar.mode).toBe("local");
  });
});

describe("DebugTabs · contenido según tab activo", () => {
  it("active=estado muestra el slot de Estado y marca esa tab seleccionada", () => {
    renderTabs("estado");
    expect(screen.getByTestId("estado-content")).toBeInTheDocument();
    expect(screen.queryByTestId("bugs-content")).toBeNull();
    expect(screen.getByRole("tab", { name: /Estado/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("active=bugs muestra el slot de Bugs", () => {
    renderTabs("bugs");
    expect(screen.getByTestId("bugs-content")).toBeInTheDocument();
    expect(screen.queryByTestId("estado-content")).toBeNull();
  });

  it("active=norte muestra el NorteTab (iframe + banner), sin slots vivos", () => {
    const { container } = renderTabs("norte");
    expect(screen.queryByTestId("estado-content")).toBeNull();
    expect(screen.queryByTestId("bugs-content")).toBeNull();
    // El NorteTab trae su PROPIO banner (mode-aware) → el genérico no se renderiza.
    const iframe = container.querySelector('iframe[src="/norte.html"]');
    expect(iframe).not.toBeNull();
    expect(screen.getByText(/Snapshot/)).toBeInTheDocument();
  });

  it("active=radar muestra el slot del RadarTab (Slice C), sin slots vivos ni banner genérico", () => {
    renderTabs("radar");
    expect(screen.queryByTestId("estado-content")).toBeNull();
    expect(screen.queryByTestId("bugs-content")).toBeNull();
    // El RadarTab llega ya renderizado desde el server (trae su propio banner) →
    // el banner genérico de modo NO se renderiza para Radar.
    expect(screen.getByTestId("radar-content")).toBeInTheDocument();
    expect(screen.queryByText(/Modo solo local/)).toBeNull();
  });
});

describe("DebugTabs · navegación por ?tab=", () => {
  it("click en Bugs navega a ?tab=bugs", () => {
    renderTabs("estado");
    fireEvent.click(screen.getByRole("tab", { name: /Bugs/ }));
    expect(push).toHaveBeenCalledWith("/studio/debug?tab=bugs");
  });

  it("click en Norte navega a ?tab=norte", () => {
    renderTabs("estado");
    fireEvent.click(screen.getByRole("tab", { name: /Norte/ }));
    expect(push).toHaveBeenCalledWith("/studio/debug?tab=norte");
  });

  it("volver a Estado navega a /studio/debug sin query (default)", () => {
    renderTabs("bugs");
    fireEvent.click(screen.getByRole("tab", { name: /Estado/ }));
    expect(push).toHaveBeenCalledWith("/studio/debug");
  });

  it("click en la tab ya activa NO navega (no-op)", () => {
    renderTabs("estado");
    fireEvent.click(screen.getByRole("tab", { name: /Estado/ }));
    expect(push).not.toHaveBeenCalled();
  });

  it("el banner de modo de Estado dice 'vivo'", () => {
    renderTabs("estado");
    // Hay un único banner con role=status para la tab activa.
    const banner = screen.getByRole("status");
    expect(within(banner).getByText(/Modo vivo/)).toBeInTheDocument();
  });
});
