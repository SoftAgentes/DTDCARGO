// @vitest-environment node
/**
 * Íconos de canal con color en el panel de Chatwoot (`infra/chatwoot/panel/canales-color.html`,
 * va en `DASHBOARD_SCRIPTS` debajo de `dashboard-scripts.html`). Variante B de Sam, 2026-11-23.
 *
 * Se lee el texto REAL del archivo, que es lo que se pega en el Super Admin: solo un <style>,
 * sin scripts ni direcciones; los colores oficiales de las redes; el portal en el azul de acción
 * de DTD solo en su fila (bandeja 10), y el «Archivo Kommo» (también canal API) sin tocar.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const HTML = readFileSync(resolve(ROOT, "infra/chatwoot/panel/canales-color.html"), "utf8");
const SIN_COMENTARIO = HTML.replace(/<!--[\s\S]*?-->/g, "");
const CSS = SIN_COMENTARIO.slice(SIN_COMENTARIO.indexOf(">", SIN_COMENTARIO.indexOf("<style")) + 1, SIN_COMENTARIO.indexOf("</style>"));
const TOKENS = readFileSync(resolve(ROOT, "app/studio/tokens.css"), "utf8");

/** selector → color, en el orden del archivo. */
const REGLAS = new Map(
  [...CSS.matchAll(/([^{}]+)\{\s*color:\s*(#[0-9a-f]{6});\s*\}/gi)].map((m) => [m[1].trim(), m[2].toLowerCase()]),
);

describe("canales-color.html", () => {
  it("es solo un <style>: sin scripts, sin direcciones, sin otras propiedades", () => {
    expect(SIN_COMENTARIO.trim().startsWith('<style id="dtd-canales-color">')).toBe(true);
    expect(SIN_COMENTARIO.trim().endsWith("</style>")).toBe(true);
    expect(SIN_COMENTARIO).not.toMatch(/<script|url\(|@import|https?:/i);
    // Cada regla del bloque es solo un `color`: no esconde ni mueve nada del panel.
    const bloques = [...CSS.matchAll(/\{([^}]*)\}/g)].map((m) => m[1].trim());
    expect(bloques.length).toBe(REGLAS.size);
    for (const b of bloques) expect(b).toMatch(/^color:\s*#[0-9a-f]{6};$/i);
  });

  it("las redes llevan su color oficial (BRAND.md, SDD-0648 D1)", () => {
    expect(REGLAS.get(".i-woot-whatsapp")).toBe("#25d366");
    expect(REGLAS.get(".i-woot-messenger")).toBe("#0866ff");
    expect(REGLAS.get(".i-woot-instagram")).toBe("#e4405f");
    // En oscuro, Messenger sube un tono para leerse sobre el fondo del panel.
    expect(REGLAS.get("body.dark .i-woot-messenger")).toBe("#4d8fff");
  });

  it("el portal va en el azul de acción de DTD, en claro y en oscuro, solo en su fila", () => {
    const claro = /--accion:\s*(#[0-9A-Fa-f]{6});/.exec(TOKENS)?.[1]?.toLowerCase();
    expect(claro).toBe("#1f4fa8");
    expect(REGLAS.get('a[href$="/inbox/10"] .i-woot-api')).toBe(claro);
    expect(REGLAS.get('body.dark a[href$="/inbox/10"] .i-woot-api')).toBe("#7faaf0");
    expect(TOKENS.toLowerCase()).toContain("--accion: #7faaf0;");
  });

  it("ningún otro canal API (el Archivo Kommo) ni el correo cambian de color", () => {
    const conApi = [...REGLAS.keys()].filter((s) => s.includes("i-woot-api"));
    expect(conApi.every((s) => s.includes('a[href$="/inbox/10"]'))).toBe(true);
    expect([...REGLAS.keys()].some((s) => s.includes("i-woot-mail"))).toBe(false);
  });
});

describe("canales-color.html · modo oscuro", () => {
  it("las reglas de oscuro cuelgan de `body.dark` (Chatwoot pone la clase en <body>), nunca de un `.dark` suelto", () => {
    const oscuras = [...REGLAS.keys()].filter((s) => s.includes("dark"));
    expect(oscuras.length).toBe(2);
    for (const s of oscuras) expect(s.startsWith("body.dark ")).toBe(true);
  });
});
