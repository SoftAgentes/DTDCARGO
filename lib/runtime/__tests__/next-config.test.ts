// @vitest-environment node
/**
 * Integración de `originFromEnv` en `next.config.ts` (SDD-0505). Carga la config
 * REAL con distintos `NEXT_PUBLIC_SUPABASE_URL` y comprueba lo que el navegador
 * va a ver: el host propio entra en la CSP del sitio (`img-src`, `media-src`,
 * `connect-src` con https + wss) y en `images.remotePatterns` sin sacar
 * `*.supabase.co`; con Cloud o sin URL no se añade nada; y `output: "standalone"`
 * solo aparece con `DTD_STANDALONE=1`. Sin esto, una CSP que bloquea Realtime o
 * Storage en el servidor propio no la detecta ninguna prueba: el servidor no falla,
 * falla el navegador.
 */
import { existsSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NextConfig } from "next";

type HeaderEntry = { source: string; headers: { key: string; value: string }[] };

async function loadConfig(env: Record<string, string | undefined>): Promise<NextConfig> {
  // La config lee `process.env` al cargar el módulo: hay que reimportarla.
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", undefined);
  vi.stubEnv("DTD_STANDALONE", undefined);
  vi.stubEnv("CHATWOOT_URL", undefined);
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  const mod = await import("../../../next.config");
  return mod.default;
}

/** CSP del catch-all estricto del sitio (`/:path((?!m/|marca|…).*)`). */
async function siteCsp(cfg: NextConfig): Promise<string> {
  const entries = (await cfg.headers!()) as HeaderEntry[];
  const catchAll = entries.filter((entry) => entry.source.startsWith("/:path((?!"));
  expect(catchAll).toHaveLength(1);
  const csp = catchAll[0].headers.filter((header) => header.key === "Content-Security-Policy");
  expect(csp).toHaveLength(1);
  return csp[0].value;
}

function directive(csp: string, name: string): string {
  const found = csp.split(";").map((d) => d.trim()).find((d) => d.startsWith(`${name} `));
  if (!found) throw new Error(`La CSP no tiene ${name}`);
  return found;
}

function remotePatterns(cfg: NextConfig): Array<{ protocol?: string; hostname: string; port?: string; pathname?: string }> {
  return (cfg.images?.remotePatterns ?? []).map((pattern) =>
    pattern instanceof URL
      ? { protocol: pattern.protocol.replace(/:$/, ""), hostname: pattern.hostname, port: pattern.port, pathname: pattern.pathname }
      : pattern,
  );
}

describe("next.config.ts · Supabase propio (SDD-0505)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("host propio: entra en img-src, media-src y connect-src (https + wss) sin quitar *.supabase.co", async () => {
    const cfg = await loadConfig({ NEXT_PUBLIC_SUPABASE_URL: "https://supabase.dtdcargo.com/" });
    const csp = await siteCsp(cfg);
    expect(directive(csp, "img-src")).toContain(
      "https://*.supabase.co https://supabase.dtdcargo.com",
    );
    expect(directive(csp, "media-src")).toContain(
      "https://*.supabase.co https://supabase.dtdcargo.com",
    );
    expect(directive(csp, "connect-src")).toContain(
      "https://*.supabase.co wss://*.supabase.co https://supabase.dtdcargo.com wss://supabase.dtdcargo.com",
    );
    // Ninguna directiva recibe la barra final de la URL configurada.
    expect(csp).not.toContain("supabase.dtdcargo.com/");
  });

  it("host propio: entra en images.remotePatterns con puerto vacío y la ruta pública de Storage", async () => {
    const cfg = await loadConfig({ NEXT_PUBLIC_SUPABASE_URL: "https://supabase.dtdcargo.com" });
    expect(remotePatterns(cfg)).toEqual([
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
      {
        protocol: "https",
        hostname: "supabase.dtdcargo.com",
        port: "",
        pathname: "/storage/v1/object/public/**",
      },
    ]);
  });

  it("gateway interno con http y puerto: ws:// en connect-src y port explícito en remotePatterns", async () => {
    const cfg = await loadConfig({ NEXT_PUBLIC_SUPABASE_URL: "http://api-gw:8000" });
    const csp = await siteCsp(cfg);
    expect(directive(csp, "connect-src")).toContain("http://api-gw:8000 ws://api-gw:8000");
    expect(directive(csp, "img-src")).toContain("http://api-gw:8000");
    expect(remotePatterns(cfg)[1]).toEqual({
      protocol: "http",
      hostname: "api-gw",
      port: "8000",
      pathname: "/storage/v1/object/public/**",
    });
  });

  it.each([
    ["Supabase Cloud", "https://abcdefghijklmnopqrst.supabase.co"],
    ["sin URL", undefined],
    ["URL vacía", ""],
    ["URL inválida", "no url"],
    ["esquema que no es http(s)", "ftp://x.test"],
  ])("%s: la CSP y remotePatterns quedan como siempre (solo *.supabase.co)", async (_label, url) => {
    const cfg = await loadConfig({ NEXT_PUBLIC_SUPABASE_URL: url });
    const csp = await siteCsp(cfg);
    expect(directive(csp, "img-src")).toContain("https://*.supabase.co https://*.google-analytics.com");
    expect(directive(csp, "media-src")).toBe("media-src 'self' blob: https://*.supabase.co");
    expect(directive(csp, "connect-src")).toContain(
      "https://*.supabase.co wss://*.supabase.co https://*.google-analytics.com",
    );
    expect(csp).not.toContain("abcdefghijklmnopqrst");
    expect(csp).not.toContain("x.test");
    expect(remotePatterns(cfg)).toHaveLength(1);
    expect(remotePatterns(cfg)[0].hostname).toBe("*.supabase.co");
  });

  it("output: standalone solo con DTD_STANDALONE=1", async () => {
    expect((await loadConfig({ DTD_STANDALONE: "1" })).output).toBe("standalone");
    expect((await loadConfig({ DTD_STANDALONE: "true" })).output).toBeUndefined();
    expect((await loadConfig({ DTD_STANDALONE: "" })).output).toBeUndefined();
    expect((await loadConfig({})).output).toBeUndefined();
  });
});

describe("SDD-0581 · CSP de medición sin relajar defensas públicas", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("release permite el loader y colectores clásicos conservando eval, media y framing restringidos", async () => {
    const csp = await siteCsp(await loadConfig({ NODE_ENV: "production" }));
    expect(directive(csp, "script-src")).toContain("https://www.googletagmanager.com");
    expect(directive(csp, "script-src")).not.toContain("'unsafe-eval'");
    expect(directive(csp, "connect-src")).toContain("https://www.googleadservices.com");
    expect(directive(csp, "connect-src")).toContain("https://ad.doubleclick.net");
    expect(directive(csp, "connect-src")).toContain("wss://*.supabase.co");
    expect(directive(csp, "connect-src").split(" ")).not.toContain("wss:");
    expect(directive(csp, "media-src")).toContain("blob:");
    expect(directive(csp, "object-src")).toBe("object-src 'none'");
    expect(directive(csp, "base-uri")).toBe("base-uri 'self'");
    expect(directive(csp, "form-action")).toBe("form-action 'self'");
    expect(directive(csp, "frame-ancestors")).toBe("frame-ancestors 'none'");
  });
});

describe("SDD-0602 · la plantilla del packing list viaja con su ruta", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("el GET la lee por fs: tiene que estar trazada y existir en el repo", async () => {
    const trazadas = (await loadConfig({})).outputFileTracingIncludes?.["/p/[token]/packlist"] ?? [];
    expect(trazadas).toEqual(["./public/templates/dtd-packing-list-invoice.xlsx"]);
    expect(existsSync(trazadas[0])).toBe(true);
  });
});

/**
 * Cabeceras que el navegador recibe para una URL: todas las reglas cuyo
 * `source` matchea, con el MISMO matcher que usa Next al servirlas. Varias
 * `Permissions-Policy` o varias CSP sobre una URL se intersectan, así que lo que
 * importa es cuántas llegan y qué dicen, no qué regla las declara.
 */
async function headersFor(cfg: NextConfig, pathname: string): Promise<{ key: string; value: string }[]> {
  const { getPathMatch } = await import("next/dist/shared/lib/router/utils/path-match");
  const entries = (await cfg.headers!()) as HeaderEntry[];
  return entries
    .filter((entry) => getPathMatch(entry.source, { removeUnnamedParams: true, strict: true })(pathname) !== false)
    .flatMap((entry) => entry.headers);
}

const values = (headers: { key: string; value: string }[], key: string) =>
  headers.filter((header) => header.key === key).map((header) => header.value);

describe("SDD-0585 · Bandeja de Chatwoot: frame-src y micrófono solo en su ruta", () => {
  afterEach(() => vi.unstubAllEnvs());

  for (const pathname of ["/studio/bandeja", "/studio/bandeja/conversacion/12"]) {
    it(`${pathname}: una sola CSP con frame-src del chat y una sola Permissions-Policy con el micrófono delegado`, async () => {
      const headers = await headersFor(await loadConfig({}), pathname);
      const csp = values(headers, "Content-Security-Policy");
      const pp = values(headers, "Permissions-Policy");
      expect(csp).toHaveLength(1);
      expect(pp).toHaveLength(1);
      expect(directive(csp[0], "frame-src")).toBe("frame-src https://chat.dtdcargo.com");
      expect(pp[0]).toContain('microphone=(self "https://chat.dtdcargo.com")');
      expect(pp[0]).toContain("camera=()");
      // Studio sigue sin dejarse enmarcar (E2-D3).
      expect(directive(csp[0], "frame-ancestors")).toBe("frame-ancestors 'none'");
      expect(values(headers, "X-Frame-Options")).toEqual(["DENY"]);
    });
  }

  for (const pathname of ["/studio/dashboard", "/studio/bandejas", "/studio/conversaciones"]) {
    it(`${pathname}: sigue sin frame-src y con microphone=()`, async () => {
      const headers = await headersFor(await loadConfig({}), pathname);
      const csp = values(headers, "Content-Security-Policy");
      const pp = values(headers, "Permissions-Policy");
      expect(csp).toHaveLength(1);
      expect(pp).toHaveLength(1);
      expect(() => directive(csp[0], "frame-src")).toThrow();
      expect(pp[0]).toContain("microphone=()");
    });
  }

  it("CHATWOOT_URL cambia el origen en las dos cabeceras a la vez", async () => {
    const headers = await headersFor(await loadConfig({ CHATWOOT_URL: "https://chat.ejemplo.test/" }), "/studio/bandeja");
    expect(directive(values(headers, "Content-Security-Policy")[0], "frame-src")).toBe("frame-src https://chat.ejemplo.test");
    expect(values(headers, "Permissions-Policy")[0]).toContain('microphone=(self "https://chat.ejemplo.test")');
  });
});

describe("SDD-0585 · 2.4 · Ficha DTD: solo el chat la puede enmarcar (E2-D28)", () => {
  afterEach(() => vi.unstubAllEnvs());

  for (const pathname of ["/studio/ficha-chat"]) {
    it(`${pathname}: una sola CSP con frame-ancestors del chat y sin X-Frame-Options`, async () => {
      const headers = await headersFor(await loadConfig({}), pathname);
      const csp = values(headers, "Content-Security-Policy");
      expect(csp).toHaveLength(1);
      expect(directive(csp[0], "frame-ancestors")).toBe("frame-ancestors https://chat.dtdcargo.com");
      expect(values(headers, "X-Frame-Options")).toEqual([]);
      // El resto de la CSP es la estricta: no enmarca nada ni delega el micrófono.
      expect(() => directive(csp[0], "frame-src")).toThrow();
      const pp = values(headers, "Permissions-Policy");
      expect(pp).toHaveLength(1);
      expect(pp[0]).toContain("microphone=()");
      expect(values(headers, "Strict-Transport-Security")).toHaveLength(1);
    });
  }

  for (const pathname of ["/studio/ficha-chats", "/studio/ficha-chat/otra", "/studio/clientes/DTD-0001"]) {
    it(`${pathname}: no hereda la regla y sigue sin dejarse enmarcar`, async () => {
      const headers = await headersFor(await loadConfig({}), pathname);
      const csp = values(headers, "Content-Security-Policy");
      expect(csp).toHaveLength(1);
      expect(directive(csp[0], "frame-ancestors")).toBe("frame-ancestors 'none'");
      expect(values(headers, "X-Frame-Options")).toEqual(["DENY"]);
    });
  }

  it("CHATWOOT_URL cambia el origen de frame-ancestors", async () => {
    const headers = await headersFor(await loadConfig({ CHATWOOT_URL: "https://chat.ejemplo.test/" }), "/studio/ficha-chat");
    expect(directive(values(headers, "Content-Security-Policy")[0], "frame-ancestors")).toBe("frame-ancestors https://chat.ejemplo.test");
  });
});

describe("SDD-0585 · 2.7 · salida de Studio: frame-src del chat solo en /studio/cerrar-chat (E2-D13)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("/studio/cerrar-chat: una sola CSP con frame-src del chat; sigue sin dejarse enmarcar y sin micrófono", async () => {
    const headers = await headersFor(await loadConfig({}), "/studio/cerrar-chat");
    const csp = values(headers, "Content-Security-Policy");
    expect(csp).toHaveLength(1);
    expect(directive(csp[0], "frame-src")).toBe("frame-src https://chat.dtdcargo.com");
    expect(directive(csp[0], "frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(values(headers, "X-Frame-Options")).toEqual(["DENY"]);
    const pp = values(headers, "Permissions-Policy");
    expect(pp).toHaveLength(1);
    expect(pp[0]).toContain("microphone=()");
  });

  for (const pathname of ["/studio/cerrar-chats", "/studio/cerrar-chat/otra"]) {
    it(`${pathname}: no hereda la regla`, async () => {
      const csp = values(await headersFor(await loadConfig({}), pathname), "Content-Security-Policy");
      expect(csp).toHaveLength(1);
      expect(() => directive(csp[0], "frame-src")).toThrow();
    });
  }
});
