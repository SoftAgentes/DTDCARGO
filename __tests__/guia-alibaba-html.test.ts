/**
 * La guía de Alibaba, dentro de `pnpm verify` (SDD-0474).
 *
 * `public/guias/comprar-en-alibaba.html` no pasa por el build de Next, ni por
 * ESLint, ni por tsc: se sirve tal cual, con 700+ líneas de JS inline. Sin este
 * test, un string mal cerrado sale a producción con todo verde y deja la página
 * en blanco. Pasó al implementar SDD-0474; de ahí el test.
 *
 * El contenido del check vive en `scripts/check-guia-alibaba.ts` para poder
 * correrlo a mano mientras se edita la guía.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { revisar, GUIA, INVARIANTES, PROHIBIDOS } from "../scripts/check-guia-alibaba";

const html = readFileSync(GUIA, "utf8");

describe("guía de Alibaba (HTML estático)", () => {
  it("el JS inline es sintácticamente válido y cumple los invariantes", () => {
    expect(revisar(html)).toEqual([]);
  });

  it("el mark del portal sigue sanitizándose igual que en lib/guia-alibaba.ts", () => {
    // Si las dos sanitizaciones divergen, el cliente ve un Shipping Mark que no
    // es el suyo y su caja llega a Yiwu sin poder identificarse.
    expect(html).toContain('replace(/[^A-Z0-9-]/g,"")');
    expect(html).toContain('URL_MARK = "DTD-"+URL_MARK');
  });

  it("la calculadora ya no pide arancel, IVA ni last mile", () => {
    // En el puerta a puerta DDP eso va DENTRO de la tarifa por CBM: pedirlos
    // aparte hacía que el cliente los sumara dos veces.
    for (const id of ["lcA", "lcI", "lcO"]) {
      expect(html).not.toContain(`id="${id}"`);
    }
    expect(html).toContain('id="lcCbm"');
  });

  it("no cablea la tarifa por CBM", () => {
    // La migr 0336 la movió con pg_cron (800→850 el 4-sep) y se sigue moviendo
    // desde /studio/tarifas. Un número copiado acá empieza a mentir solo.
    // (Ya no «vuelve a 800» al vencer: desde SDD-0475 el respaldo también es
    // 850, así que al vencer la vigencia el precio no cambia.)
    expect(html).not.toMatch(/per_cbm\s*[:=]\s*\d/);
    expect(html).toContain("let TARIFA = null");
  });

  it("el detector reacciona: detecta un invariante ausente y un prohibido presente", () => {
    // Control del propio check — sin esto, un `revisar()` que devolviera [] a
    // ciegas pasaría por verde para siempre.
    const sinInvariante = html.split(INVARIANTES[0][0]).join("XXX");
    expect(revisar(sinInvariante).join(" ")).toContain("falta");

    const conProhibido = html.replace("<body", `<!-- ${PROHIBIDOS[0][0]} --><body`);
    expect(revisar(conProhibido).join(" ")).toContain("reapareció");

    const roto = html.replace("</script>", 'const x = "sin cerrar;\n</script>');
    expect(revisar(roto).join(" ")).toContain("sintaxis inválida");
  });
});
