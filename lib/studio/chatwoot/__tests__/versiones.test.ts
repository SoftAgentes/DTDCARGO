// @vitest-environment node
/**
 * SDD-0588 · paso 3.2 · parte pura del vigilante de versiones: comparar, leer
 * `/api`, filtrar releases y limpiar las notas de menciones a personas.
 */
import { describe, expect, it } from "vitest";

import {
  MAX_NOTAS,
  MAX_PENDIENTES,
  compararVersiones,
  evaluarVersiones,
  limpiarNotas,
  releasesEstables,
  versionDeApi,
  type ReleaseChatwoot,
} from "../versiones";

const rel = (tag: string, extra: Record<string, unknown> = {}) => ({
  tag_name: tag,
  name: tag,
  draft: false,
  prerelease: false,
  published_at: "2026-10-20T10:00:00Z",
  html_url: `https://github.com/chatwoot/chatwoot/releases/tag/${tag}`,
  body: "## What's Changed\n* fix: algo",
  ...extra,
});

describe("compararVersiones", () => {
  it("compara por número, no por texto", () => {
    expect(compararVersiones("4.9.0", "4.10.0")).toBe(-1);
    expect(compararVersiones("4.19.1", "4.19.1")).toBe(0);
    expect(compararVersiones("5.0.0", "4.99.99")).toBe(1);
    expect(compararVersiones("4.19.10", "4.19.9")).toBe(1);
  });
});

describe("versionDeApi", () => {
  it("toma la versión del cuerpo de GET /api", () => {
    expect(versionDeApi({ version: "4.19.1", timestamp: "x", queue_services: "ok", data_services: "ok" })).toBe("4.19.1");
  });
  it("rechaza cuerpos sin la forma esperada", () => {
    for (const cuerpo of [null, "4.19.1", {}, { version: 4 }, { version: "4.19" }, { version: "4.19.1-ce" }, { version: "<b>4.19.1</b>" }]) {
      expect(versionDeApi(cuerpo)).toBeNull();
    }
  });
});

describe("limpiarNotas", () => {
  it("quita a quien contribuyó y la sección de contribuidores nuevos", () => {
    const notas = [
      "## What's Changed",
      "* feat: plantillas de WhatsApp by @ana-dev in https://github.com/chatwoot/chatwoot/pull/1",
      "* chore: deps by @dependabot[bot] in https://github.com/chatwoot/chatwoot/pull/2",
      "* fix: gracias a @luis por el reporte",
      "",
      "## New Contributors",
      "* @nuevo made their first contribution in https://github.com/chatwoot/chatwoot/pull/3",
      "",
      "**Full Changelog**: https://github.com/chatwoot/chatwoot/compare/v4.19.1...v4.20.0",
    ].join("\r\n");
    const limpio = limpiarNotas(notas);
    expect(limpio).not.toMatch(/ana-dev|dependabot|luis|nuevo|New Contributors/);
    expect(limpio).toContain("* feat: plantillas de WhatsApp in https://github.com/chatwoot/chatwoot/pull/1");
    expect(limpio).toContain("* fix: gracias a @… por el reporte");
    expect(limpio).toContain("**Full Changelog**");
    expect(limpio).not.toContain("\r");
  });

  it("no guarda HTML crudo: quita etiquetas y comentarios, deja el texto", () => {
    const limpio = limpiarNotas('<!-- oculto --><details><summary>Cambios</summary>\n<img src="x" onerror="alert(1)">* fix: <b>algo</b> 2 < 3\n</details>');
    expect(limpio).not.toMatch(/<[A-Za-z!/]|oculto|onerror/);
    expect(limpio).toContain("Cambios");
    expect(limpio).toContain("* fix: algo 2 < 3");
  });

  it("la sección de contribuidores al final también sale", () => {
    expect(limpiarNotas("* fix: x\n\n## New Contributors\n* @otra made their first contribution")).toBe("* fix: x");
  });

  it("recorta notas largas", () => {
    const largo = limpiarNotas("x".repeat(MAX_NOTAS + 50));
    expect(largo.length).toBe(MAX_NOTAS + 2);
    expect(largo.endsWith("\n…")).toBe(true);
  });
});

describe("releasesEstables", () => {
  it("deja solo las estables, sin repetir, de la más nueva a la más vieja", () => {
    const lista = releasesEstables([
      rel("v4.19.1"),
      rel("v4.21.0-rc1"),
      rel("v4.22.0", { prerelease: true }),
      rel("v4.23.0", { draft: true }),
      rel("v4.20.0"),
      rel("v4.20.0-ce"),
      rel("v4.10.0"),
      rel("nightly"),
      null,
    ]);
    expect(lista?.map((r) => r.version)).toEqual(["4.20.0", "4.19.1", "4.10.0"]);
  });

  it("solo acepta enlaces a los releases de chatwoot/chatwoot", () => {
    const [r] = releasesEstables([rel("v4.20.0", { html_url: "https://ejemplo.test/phish" })]) ?? [];
    expect(r.url).toBeNull();
    const [bueno] = releasesEstables([rel("v4.20.0")]) ?? [];
    expect(bueno.url).toBe("https://github.com/chatwoot/chatwoot/releases/tag/v4.20.0");
  });

  it("marca las que mencionan seguridad y limpia las notas", () => {
    const [r] = releasesEstables([rel("v4.20.0", { body: "* fix: XSS en el widget by @alguien in https://github.com/x/1" })]) ?? [];
    expect(r.seguridad).toBe(true);
    expect(r.notas).not.toContain("alguien");
    const [s] = releasesEstables([rel("v4.20.1", { body: "* feat: emojis" })]) ?? [];
    expect(s.seguridad).toBe(false);
  });

  it("una respuesta que no es lista → null", () => {
    expect(releasesEstables({ message: "API rate limit exceeded" })).toBeNull();
  });
});

describe("evaluarVersiones", () => {
  const r = (version: string): ReleaseChatwoot => ({ version, nombre: version, publicada: "", url: null, notas: "", seguridad: false });

  it("al día cuando la instalada es la más nueva", () => {
    const out = evaluarVersiones({ ok: true, version: "4.20.0" }, { ok: true, lista: [r("4.20.0"), r("4.19.1")] });
    expect(out).toEqual({ estado: "al_dia", instalada: "4.20.0", disponible: "4.20.0", pendientes: [], recortado: false, error: null });
  });

  it("hay nueva: lista solo las más nuevas que la instalada", () => {
    const out = evaluarVersiones({ ok: true, version: "4.19.1" }, { ok: true, lista: [r("4.21.0"), r("4.20.0"), r("4.19.1"), r("4.19.0")] });
    expect(out.estado).toBe("hay_nueva");
    expect(out.disponible).toBe("4.21.0");
    expect(out.pendientes.map((p) => p.version)).toEqual(["4.21.0", "4.20.0"]);
  });

  it(`guarda como mucho ${MAX_PENDIENTES} pendientes y avisa el recorte`, () => {
    const lista = Array.from({ length: 12 }, (_, i) => r(`4.${31 - i}.0`));
    const out = evaluarVersiones({ ok: true, version: "4.19.1" }, { ok: true, lista });
    expect(out.pendientes).toHaveLength(MAX_PENDIENTES);
    expect(out.recortado).toBe(true);
  });

  it("si /api falla, error con la disponible igual", () => {
    const out = evaluarVersiones({ ok: false, error: "instalada_no_responde" }, { ok: true, lista: [r("4.20.0")] });
    expect(out).toMatchObject({ estado: "error", instalada: null, disponible: "4.20.0", error: "instalada_no_responde" });
  });

  it("si GitHub falla, error con la instalada igual", () => {
    const out = evaluarVersiones({ ok: true, version: "4.19.1" }, { ok: false, error: "releases_formato" });
    expect(out).toMatchObject({ estado: "error", instalada: "4.19.1", disponible: null, error: "releases_formato" });
  });
});
