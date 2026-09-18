// @vitest-environment node
/**
 * SDD-0473 · El sitemap lista /cotizador sólo cuando la ruta existe.
 *
 * El contrato de cobertura (`sitemap-cobertura-contract.test.ts`) lee archivos:
 * ve que `/cotizador` está en `app/sitemap.ts` y que su página ya no es
 * `noindex`, y queda conforme. No puede ver que la entrada depende de la bandera.
 * Esto sí: con `DOCUMENT_IMPORT_ENABLED` apagada la ruta es 404, y pedirle a
 * Google que rastree un 404 es peor que no pedirle nada.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/public/news-queries", () => ({ listPublishedPosts: async () => [] }));

import sitemap from "../sitemap";

const BASE = "https://dtdcargo.test";
const urls = async () => (await sitemap()).map((r) => r.url);

afterEach(() => vi.unstubAllEnvs());

describe("Sitemap · /cotizador detrás de su bandera (SDD-0473)", () => {
  it("con la bandera encendida, /cotizador está, una sola vez", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", BASE);
    vi.stubEnv("DOCUMENT_IMPORT_ENABLED", "true");
    expect((await urls()).filter((u) => u === `${BASE}/cotizador`)).toHaveLength(1);
  });

  it("con cualquier otro valor, /cotizador no está y el resto no cambia", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", BASE);
    vi.stubEnv("DOCUMENT_IMPORT_ENABLED", "true");
    const encendido = await urls();
    for (const valor of ["", "false", "1", "TRUE"]) {
      vi.stubEnv("DOCUMENT_IMPORT_ENABLED", valor);
      const apagado = await urls();
      expect(apagado, `DOCUMENT_IMPORT_ENABLED=${JSON.stringify(valor)}`).not.toContain(`${BASE}/cotizador`);
      expect(apagado).toEqual(encendido.filter((u) => u !== `${BASE}/cotizador`));
    }
  });
});
