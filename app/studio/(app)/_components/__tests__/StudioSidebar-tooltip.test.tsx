/**
 * Menú lateral cerrado: el nombre del módulo sale al instante con un tooltip propio
 * (el `title` nativo tarda ~1 s), también con el foco del teclado, y el enlace conserva
 * su nombre accesible. El movimiento del icono y el reduced-motion viven en studio.css.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FEATURE_FLAG_DEFAULTS } from "@/lib/studio/feature-flags-types";

vi.mock("next/navigation", () => ({
  usePathname: () => "/studio/dashboard",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("../BandejaBadge", () => ({ BandejaBadge: () => null }));

const { StudioSidebar } = await import("../StudioSidebar");

afterEach(() => {
  cleanup();
  try {
    localStorage.clear();
  } catch {
    // sin storage
  }
});

async function abrirCerrado() {
  localStorage.setItem("studio_sidebar_collapsed", "1");
  render(<StudioSidebar role="admin" featureFlags={FEATURE_FLAG_DEFAULTS} />);
  await waitFor(() => {
    expect(document.querySelector(".studio-sb-link--cerrado")).not.toBeNull();
  });
  return document.querySelector(".studio-sb-link--cerrado") as HTMLElement;
}

describe("menú lateral cerrado: nombre al instante", () => {
  it("no usa el title nativo y conserva el nombre accesible", async () => {
    const enlace = await abrirCerrado();
    expect(enlace.getAttribute("title")).toBeNull();
    expect(enlace.getAttribute("aria-label")).toBeTruthy();
  });

  it("muestra el nombre al pasar el mouse y lo quita al salir", async () => {
    const enlace = await abrirCerrado();
    const nombre = enlace.getAttribute("aria-label")!;
    expect(document.querySelector(".studio-sb-tip")).toBeNull();
    fireEvent.mouseEnter(enlace);
    expect(document.querySelector(".studio-sb-tip")?.textContent).toBe(nombre);
    fireEvent.mouseLeave(enlace);
    expect(document.querySelector(".studio-sb-tip")).toBeNull();
  });

  it("también lo muestra con el foco del teclado", async () => {
    const enlace = await abrirCerrado();
    const nombre = enlace.getAttribute("aria-label")!;
    // jsdom no resuelve :focus-visible: se simula como lo haría el navegador con Tab.
    const matches = vi.spyOn(enlace, "matches").mockReturnValue(true);
    fireEvent.focus(enlace);
    expect(document.querySelector(".studio-sb-tip")?.textContent).toBe(nombre);
    fireEvent.blur(enlace);
    expect(document.querySelector(".studio-sb-tip")).toBeNull();
    matches.mockRestore();
  });

  it("Escape cierra el tooltip (WCAG 1.4.13) y el tooltip no se lee doble", async () => {
    const enlace = await abrirCerrado();
    fireEvent.mouseEnter(enlace);
    const tip = document.querySelector(".studio-sb-tip");
    expect(tip?.getAttribute("aria-hidden")).toBe("true");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.querySelector(".studio-sb-tip")).toBeNull();
  });

  it("el scroll del menú cierra el tooltip", async () => {
    const enlace = await abrirCerrado();
    fireEvent.mouseEnter(enlace);
    expect(document.querySelector(".studio-sb-tip")).not.toBeNull();
    fireEvent.scroll(document.querySelector("nav") as HTMLElement);
    expect(document.querySelector(".studio-sb-tip")).toBeNull();
  });

  it("con el foco de teclado en el enlace, salir con el mouse no borra el tooltip", async () => {
    const enlace = await abrirCerrado();
    vi.spyOn(enlace, "matches").mockReturnValue(true);
    enlace.focus();
    fireEvent.focus(enlace);
    fireEvent.mouseEnter(enlace);
    fireEvent.mouseLeave(enlace);
    expect(document.querySelector(".studio-sb-tip")).not.toBeNull();
  });

  it("abierto no pinta tooltip ni la clase de cerrado", () => {
    render(<StudioSidebar role="admin" featureFlags={FEATURE_FLAG_DEFAULTS} />);
    expect(document.querySelector(".studio-sb-link--cerrado")).toBeNull();
    expect(document.querySelector(".studio-sb-tip")).toBeNull();
  });
});

describe("studio.css: tooltip del menú y contador de iconos", () => {
  const css = readFileSync(join(process.cwd(), "app/studio/studio.css"), "utf8").split(String.fromCharCode(13)).join("");

  it("el tooltip aparece en menos de 150 ms y respeta prefers-reduced-motion", () => {
    expect(css).toMatch(/\.studio-sb-tip\s*\{[^}]*animation:\s*studio-sb-tip-in\s+90ms/);
    const reducido = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce) {\n  .studio-sb-icono"));
    expect(reducido).toMatch(/\.studio-sb-tip\s*\{\s*animation:\s*none/);
    expect(reducido).toMatch(/transform:\s*none/);
  });

  it("el contador queda en la esquina superior derecha, montado sobre el borde", () => {
    const bloque = css.match(/\.studio-contador-icono\s*\{[^}]*\}/)?.[0] ?? "";
    expect(bloque).toMatch(/top:\s*-\d+px/);
    expect(bloque).toMatch(/right:\s*-\d+px/);
    const btn = css.match(/\.studio-icono-btn,\s*\n\.studio-cerrar-panel\s*\{[^}]*\}/)?.[0] ?? "";
    expect(btn).not.toMatch(/overflow:\s*hidden/);
  });
});
