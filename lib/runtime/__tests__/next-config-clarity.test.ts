// @vitest-environment node
/**
 * CSP de Microsoft Clarity (fase 1). Carga la config REAL y mide, con el mismo
 * matcher de rutas que usa Next para `headers()`:
 *  · sin ID (ausente, vacío u `off`) ninguna CSP nombra a Clarity;
 *  · con ID, Clarity entra en `script-src`, `connect-src` e `img-src` SOLO en
 *    la CSP pública; nunca en `default-src`, nunca `c.bing.com`, y
 *    `frame-ancestors` queda igual;
 *  · cada ruta recibe EXACTAMENTE una CSP (dos se intersectarían);
 *  · paridad con la guarda del componente: toda ruta que
 *    `isClarityExcludedUrl` excluye por ruta recibe una CSP sin Clarity.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NextConfig } from "next";
import { getPathMatch } from "next/dist/shared/lib/router/utils/path-match";

type HeaderEntry = { source: string; headers: { key: string; value: string }[] };

vi.mock("next/navigation", () => ({ usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));
vi.mock("next/script", () => ({ default: () => null }));

async function loadConfig(clarityId: string | undefined): Promise<NextConfig> {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", undefined);
  vi.stubEnv("CHATWOOT_URL", undefined);
  vi.stubEnv("NEXT_PUBLIC_CLARITY_ID", clarityId);
  const mod = await import("../../../next.config");
  return mod.default;
}

async function cspsFor(cfg: NextConfig, pathname: string): Promise<string[]> {
  const entries = (await cfg.headers!()) as HeaderEntry[];
  const out: string[] = [];
  for (const entry of entries) {
    const match = getPathMatch(entry.source, { strict: true, removeUnnamedParams: true, regexModifier: (r) => r });
    if (match(pathname) === false) continue;
    for (const header of entry.headers) {
      if (header.key === "Content-Security-Policy") out.push(header.value);
    }
  }
  return out;
}

function directive(csp: string, name: string): string {
  return csp.split(";").map((d) => d.trim()).find((d) => d.startsWith(`${name} `)) ?? "";
}

const PUBLIC_PATHS = ["/", "/cotizador-flete", "/cotizadores", "/servicios", "/tarifas", "/fcl", "/noticias/una-nota", "/track", "/portales", "/mapa", "/preguntas", "/privacidad"];
const PRIVATE_PATHS = [
  "/portal",
  "/portal/envios/DTD-0001",
  "/studio",
  "/studio/crm",
  "/back",
  "/invitar/tok",
  "/acceso/tok",
  "/entrar",
  "/entrar/codigo",
  "/abrir",
  "/registro",
  "/registro/link/tok",
  "/cotizador",
  "/cotizador/algo",
  "/verificar",
  "/p/tok",
  "/interno",
  "/interno/marca",
  "/track/DTD-0001",
  "/m",
  "/m/erp",
  "/marca",
  "/marca/doc/x",
  "/tarifas/embed",
  "/fcl/embed",
  "/studio/bandeja",
  "/studio/bitacora",
  "/studio/ficha-chat",
  "/studio/cerrar-chat",
];

describe("next.config.ts · CSP de Clarity", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([undefined, "", "  ", "off"])("con NEXT_PUBLIC_CLARITY_ID=%j ninguna CSP nombra a Clarity", async (id) => {
    const cfg = await loadConfig(id);
    for (const path of [...PUBLIC_PATHS, ...PRIVATE_PATHS]) {
      for (const csp of await cspsFor(cfg, path)) expect(csp).not.toContain("clarity");
    }
  });

  it("cada ruta recibe exactamente una CSP distinta (nunca la pública y la privada a la vez)", async () => {
    // `/tarifas/embed` coincide con `/tarifas/embed` y `/tarifas/embed/:path*`
    // desde antes de esta SDD: la misma CSP dos veces no cambia la intersección.
    const cfg = await loadConfig("synthetic00");
    for (const path of [...PUBLIC_PATHS, ...PRIVATE_PATHS]) {
      const csps = await cspsFor(cfg, path);
      expect({ path, some: csps.length >= 1, distinct: new Set(csps).size }).toEqual({ path, some: true, distinct: 1 });
    }
  });

  it("con ID: la CSP pública suma Clarity solo en script-src, connect-src e img-src", async () => {
    const cfg = await loadConfig("synthetic00");
    for (const path of PUBLIC_PATHS) {
      const [csp] = await cspsFor(cfg, path);
      for (const name of ["script-src", "connect-src", "img-src"]) {
        expect(directive(csp, name)).toContain("https://www.clarity.ms https://*.clarity.ms");
      }
      expect(directive(csp, "default-src")).toBe("default-src 'self'");
      expect(directive(csp, "frame-ancestors")).toBe("frame-ancestors 'none'");
      expect(csp).not.toContain("c.bing.com");
      expect(csp.match(/clarity\.ms/g)).toHaveLength(6);
    }
  });

  it("con ID: las rutas privadas y las reglas propias quedan sin Clarity", async () => {
    const cfg = await loadConfig("synthetic00");
    for (const path of PRIVATE_PATHS) {
      const [csp] = await cspsFor(cfg, path);
      expect({ path, clarity: csp.includes("clarity") }).toEqual({ path, clarity: false });
    }
  });

  it("con ID: la CSP privada es la estricta de siempre (igual a la de sin ID)", async () => {
    const off = await loadConfig(undefined);
    const offCsp = (await cspsFor(off, "/portal"))[0];
    const on = await loadConfig("synthetic00");
    expect((await cspsFor(on, "/portal"))[0]).toBe(offCsp);
    // Sin ID la pública tampoco cambia: misma CSP que la privada.
    expect((await cspsFor(off, "/servicios"))[0]).toBe(offCsp);
  });

  it("paridad con la guarda del componente: lo que excluye por ruta no recibe Clarity", async () => {
    vi.stubEnv("NEXT_PUBLIC_CLARITY_ID", "synthetic00");
    const { isClarityExcludedUrl } = await import("../../../components/Clarity");
    const cfg = await loadConfig("synthetic00");
    for (const path of [...PUBLIC_PATHS, ...PRIVATE_PATHS]) {
      const excluded = isClarityExcludedUrl(path, new URLSearchParams());
      const [csp] = await cspsFor(cfg, path);
      expect({ path, cspHasClarity: csp.includes("clarity") }).toEqual({ path, cspHasClarity: !excluded });
    }
  });
});
