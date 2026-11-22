/**
 * SDD-0709 · Menú lateral cerrado: un botón por grupo y lista flotante.
 *
 * Contrato: con el menú cerrado NO vuelven los módulos sueltos; solo quedan los cinco
 * grupos de `modules.ts` (más el Dashboard arriba). La lista se abre al oprimir, no al
 * pasar el mouse; se maneja con flechas; Esc y clic afuera la cierran; elegir un módulo
 * la cierra; el grupo del módulo activo va en azul de acción.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FEATURE_FLAG_DEFAULTS } from "@/lib/studio/feature-flags-types";
import { GROUP_ORDER } from "@/lib/studio/modules";
import { GROUP_ICONS, MODULO_SUELTO_CERRADO } from "@/lib/studio/sidebar-grupos";
import type { StudioUserRole } from "@/lib/studio/user-types";

const nav = vi.hoisted(() => ({ pathname: "/studio/dashboard" }));
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("../BandejaBadge", () => ({ BandejaBadge: () => null }));

const { StudioSidebar } = await import("../StudioSidebar");

afterEach(() => {
  cleanup();
  nav.pathname = "/studio/dashboard";
  try {
    localStorage.clear();
  } catch {
    // sin storage
  }
});

async function abrirCerrado(role: StudioUserRole = "admin", pathname = "/studio/dashboard") {
  nav.pathname = pathname;
  localStorage.setItem("studio_sidebar_collapsed", "1");
  render(<StudioSidebar role={role} featureFlags={FEATURE_FLAG_DEFAULTS} />);
  await waitFor(() => {
    expect(document.querySelectorAll(".studio-sb-grupo-btn").length).toBeGreaterThan(0);
  });
}

const botones = () => Array.from(document.querySelectorAll<HTMLButtonElement>(".studio-sb-grupo-btn"));
const boton = (nombre: RegExp) => screen.getByRole("button", { name: nombre });

describe("menú cerrado: solo los grupos", () => {
  it("admin ve los cinco grupos, uno por botón, en el orden de modules.ts", async () => {
    await abrirCerrado();
    expect(botones()).toHaveLength(GROUP_ORDER.length);
    expect(botones().map((b) => b.getAttribute("data-grupo"))).toEqual(GROUP_ORDER);
  });

  it("no hay enlaces de módulo sueltos: solo el Dashboard queda arriba", async () => {
    await abrirCerrado();
    const enlaces = Array.from(document.querySelectorAll("nav a"));
    expect(enlaces).toHaveLength(1);
    expect(enlaces[0].getAttribute("href")).toBe("/studio/dashboard");
    expect(MODULO_SUELTO_CERRADO).toBe("dashboard");
    expect(document.querySelectorAll('[role="menuitem"]')).toHaveLength(0);
  });

  it("cada grupo tiene su icono propio", () => {
    expect(Object.keys(GROUP_ICONS).sort()).toEqual([...GROUP_ORDER].sort());
    expect(new Set(Object.values(GROUP_ICONS)).size).toBe(GROUP_ORDER.length);
  });

  it("cada botón es accesible: nombre, aria-haspopup=menu y aria-expanded", async () => {
    await abrirCerrado();
    for (const b of botones()) {
      expect(b.getAttribute("aria-label")).toBeTruthy();
      expect(b.getAttribute("aria-haspopup")).toBe("menu");
      expect(b.getAttribute("aria-expanded")).toBe("false");
    }
  });

  it("un rol con pocos módulos no ve grupos vacíos", async () => {
    await abrirCerrado("support");
    expect(botones().length).toBeGreaterThan(0);
    expect(botones().length).toBeLessThanOrEqual(GROUP_ORDER.length);
  });
});

describe("lista flotante", () => {
  it("pasar el mouse no la abre, solo muestra el nombre", async () => {
    await abrirCerrado();
    const b = boton(/Operación/i);
    fireEvent.mouseEnter(b);
    expect(document.querySelector('[role="menu"]')).toBeNull();
    expect(b.getAttribute("aria-expanded")).toBe("false");
    expect(document.querySelector(".studio-sb-tip")?.textContent).toMatch(/Operación/i);
  });

  it("oprimir el grupo la abre con sus módulos y marca aria-expanded", async () => {
    await abrirCerrado();
    const b = boton(/Operación/i);
    fireEvent.click(b);
    expect(b.getAttribute("aria-expanded")).toBe("true");
    const menu = screen.getByRole("menu", { name: /Operación/i });
    expect(b.getAttribute("aria-controls")).toBe(menu.id);
    expect(within(menu).getByRole("menuitem", { name: /Embarques/i })).toBeTruthy();
    // El Dashboard está arriba, no se repite en la lista.
    expect(within(menu).queryByRole("menuitem", { name: /^Dashboard$/i })).toBeNull();
  });

  it("los padres salen como subgrupo con sus hijos dentro", async () => {
    await abrirCerrado();
    fireEvent.click(boton(/Operación/i));
    const sub = screen.getByRole("group", { name: /Almacenes/i });
    expect(within(sub).getAllByRole("menuitem").length).toBeGreaterThanOrEqual(2);
  });

  it("solo una lista abierta a la vez", async () => {
    await abrirCerrado();
    fireEvent.click(boton(/Operación/i));
    fireEvent.click(boton(/Comercial/i));
    expect(screen.getAllByRole("menu")).toHaveLength(1);
    expect(screen.getByRole("menu").getAttribute("aria-label")).toMatch(/Comercial/i);
  });

  it("al abrir, el foco va al primer módulo y las flechas se mueven (con vuelta)", async () => {
    await abrirCerrado();
    fireEvent.click(boton(/Comercial/i));
    const items = screen.getAllByRole("menuitem");
    await waitFor(() => expect(document.activeElement).toBe(items[0]));
    fireEvent.keyDown(items[0], { key: "ArrowDown" });
    expect(document.activeElement).toBe(items[1]);
    fireEvent.keyDown(items[1], { key: "ArrowUp" });
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(items[0], { key: "ArrowUp" });
    expect(document.activeElement).toBe(items[items.length - 1]);
    fireEvent.keyDown(items[items.length - 1], { key: "Home" });
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(items[0], { key: "End" });
    expect(document.activeElement).toBe(items[items.length - 1]);
  });

  it("Esc la cierra y devuelve el foco al botón del grupo", async () => {
    await abrirCerrado();
    const b = boton(/Comercial/i);
    fireEvent.click(b);
    const items = screen.getAllByRole("menuitem");
    fireEvent.keyDown(items[0], { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(b.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(b);
  });

  it("clic afuera la cierra", async () => {
    await abrirCerrado();
    fireEvent.click(boton(/Comercial/i));
    expect(screen.getByRole("menu")).toBeTruthy();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("Tab la cierra", async () => {
    await abrirCerrado();
    fireEvent.click(boton(/Comercial/i));
    fireEvent.keyDown(screen.getAllByRole("menuitem")[0], { key: "Tab" });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("elegir un módulo la cierra y el enlace conserva su destino", async () => {
    await abrirCerrado();
    fireEvent.click(boton(/Comercial/i));
    const item = screen.getByRole("menuitem", { name: /Clientes/i });
    expect(item.getAttribute("href")).toBe("/studio/clientes");
    fireEvent.click(item);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("la flecha abajo sobre el botón también la abre", async () => {
    await abrirCerrado();
    const b = boton(/Finanzas/i);
    fireEvent.keyDown(b, { key: "ArrowDown" });
    expect(b.getAttribute("aria-expanded")).toBe("true");
  });

  it("expandir el menú cierra la lista", async () => {
    await abrirCerrado();
    fireEvent.click(boton(/Comercial/i));
    fireEvent.click(screen.getByRole("button", { name: /Expandir sidebar/i }));
    expect(screen.queryByRole("menu")).toBeNull();
  });
});

describe("grupo activo", () => {
  it("marca el grupo del módulo activo y solo ese", async () => {
    await abrirCerrado("admin", "/studio/clientes");
    const activos = botones().filter((b) => b.getAttribute("data-activo") === "true");
    expect(activos.map((b) => b.getAttribute("data-grupo"))).toEqual(["COMERCIAL"]);
  });

  it("dentro de la lista, el módulo activo lleva aria-current", async () => {
    await abrirCerrado("admin", "/studio/clientes");
    fireEvent.click(boton(/Comercial/i));
    const actual = screen.getAllByRole("menuitem").filter((i) => i.getAttribute("aria-current") === "page");
    expect(actual).toHaveLength(1);
    expect(actual[0].textContent).toMatch(/Clientes/i);
  });
});

describe("menú abierto: sin cambios", () => {
  it("no pinta botones de grupo flotante y sigue con el acordeón", () => {
    render(<StudioSidebar role="admin" featureFlags={FEATURE_FLAG_DEFAULTS} />);
    expect(document.querySelector(".studio-sb-grupo-btn")).toBeNull();
    expect(screen.getByRole("link", { name: /Embarques/i })).toBeTruthy();
    expect(document.querySelectorAll("nav button[aria-expanded]").length).toBeGreaterThanOrEqual(GROUP_ORDER.length);
  });
});

describe("estilos y contraste", () => {
  const css = readFileSync(join(process.cwd(), "app/studio/studio.css"), "utf8").split(String.fromCharCode(13)).join("");
  const tokens = readFileSync(join(process.cwd(), "app/studio/tokens.css"), "utf8");

  const lum = (h: string) => {
    const [r, g, b] = [1, 3, 5]
      .map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contraste = (a: string, b: string) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };

  it("el azul de acción sobre cada --bg-sidebar mide ≥ 4,5:1 (AA texto; el icono pide 3:1)", () => {
    const soft = /--accion-soft:\s*(#[0-9a-f]{6})/i.exec(tokens)?.[1] as string;
    const fondos = [...tokens.matchAll(/--bg-sidebar:\s*(#[0-9a-f]{6})/gi)].map((m) => m[1]);
    expect(fondos.length).toBeGreaterThanOrEqual(2);
    for (const f of fondos) expect(contraste(soft, f)).toBeGreaterThanOrEqual(4.5);
  });

  it("el módulo activo de la lista (on-warning sobre blanco) mide ≥ 4,5:1", () => {
    const on = /--on-warning:\s*(#[0-9a-f]{6})/i.exec(tokens)?.[1] as string;
    expect(contraste(on, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
  });

  it("botón y ítems miden al menos 32 px de alto y tienen foco visible", () => {
    expect(css).toMatch(/\.studio-sb-grupo-btn\s*\{[^}]*min-height:\s*(3[2-9]|[4-9]\d)px/);
    expect(css).toMatch(/\.studio-sb-flot__item\s*\{[^}]*min-height:\s*(3[2-9]|[4-9]\d)px/);
    expect(css).toMatch(/\.studio-sb-grupo-btn:focus-visible[^{]*\{[^}]*outline:\s*2px solid/);
  });

  it("el grupo activo usa --accion-soft, no vino ni rgba en línea", () => {
    const bloque = css.match(/\.studio-sb-grupo-btn\[data-activo="true"\]\s*\{[^}]*\}/)?.[0] ?? "";
    expect(bloque).toContain("var(--accion-soft)");
    expect(bloque).not.toMatch(/wine|rgba/);
  });

  it("respeta prefers-reduced-motion", () => {
    expect(css).toMatch(/prefers-reduced-motion: reduce\) \{\s*\.studio-sb-grupo-btn\s*\{\s*transition:\s*none/);
  });
});
