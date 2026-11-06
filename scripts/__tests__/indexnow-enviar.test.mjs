import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CLAVE, cuerpoIndexNow, LIMITE_URLS, urlsDelSitemap } from "../indexnow-enviar.mjs";

describe("indexnow-enviar (SDD-0604)", () => {
  it("el archivo publicado contiene la misma clave", () => {
    const archivo = readFileSync(join(process.cwd(), "public", `${CLAVE}.txt`), "utf8");
    expect(archivo.trim()).toBe(CLAVE);
  });

  it("toma las URLs del sitemap y descarta otros dominios", () => {
    const xml = `<urlset>
      <url><loc>https://dtdcargo.com/</loc></url>
      <url><loc> https://dtdcargo.com/faq </loc></url>
      <url><loc>https://otro.example/x</loc></url>
    </urlset>`;
    expect(urlsDelSitemap(xml)).toEqual(["https://dtdcargo.com/", "https://dtdcargo.com/faq"]);
  });

  it("arma el cuerpo con la ubicación de la clave y respeta el límite", () => {
    const urls = Array.from({ length: LIMITE_URLS + 1 }, (_, i) => `https://dtdcargo.com/${i}`);
    const cuerpo = cuerpoIndexNow(urls);
    expect(cuerpo.keyLocation).toBe(`https://dtdcargo.com/${CLAVE}.txt`);
    expect(cuerpo.urlList).toHaveLength(LIMITE_URLS);
  });
});
