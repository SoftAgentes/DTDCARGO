#!/usr/bin/env node
/**
 * build-guia-pdf.mjs — SDD-0099
 *
 * Renderiza el print-master branded de la guía "Cómo comprar en Alibaba" a PDF con
 * Chromium headless (Playwright, ya en el repo). Reemplaza al PDF de `make-pdf` (que no
 * permite temática de marca). Soluciona el render del chino (espera document.fonts.ready
 * antes de imprimir → cero cuadritos ▯).
 *
 * Entrada:  docs/specs/0099-guia-comprar-alibaba/assets/guia-comprar-alibaba.html
 *           (tokens __LOGO_REVERSE__ / __LOGO_PRIMARY__ → se inyectan como data-URI base64)
 * Salida:   docs/specs/0099-guia-comprar-alibaba/assets/guia-comprar-alibaba.pdf
 *
 * Uso:   node scripts/build-guia-pdf.mjs           # solo el PDF
 *        node scripts/build-guia-pdf.mjs --png     # + screenshots de control (CJK/marca) en %TEMP%
 *
 * Nota: corre DIRECTO con node (evita el preflight de pnpm). Las fuentes se cargan de Google
 * Fonts en tiempo de render; sin red, el CJK cae a la fuente del sistema (igual renderiza).
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { chromium } from "@playwright/test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const ASSETS = join(ROOT, "docs", "specs", "0099-guia-comprar-alibaba", "assets");
const HTML_IN = join(ASSETS, "guia-comprar-alibaba.html");
const PDF_OUT = join(ASSETS, "guia-comprar-alibaba.pdf");
const BRAND = join(ROOT, "public", "brand");

const wantPng = process.argv.includes("--png");

function dataUri(file) {
  const abs = join(BRAND, file);
  if (!existsSync(abs)) throw new Error(`Logo no encontrado: ${abs}`);
  return `data:image/png;base64,${readFileSync(abs).toString("base64")}`;
}

async function main() {
  if (!existsSync(HTML_IN)) throw new Error(`No existe el HTML fuente: ${HTML_IN}`);

  // 1) HTML auto-contenido: inyectar logos como data-URI base64.
  let html = readFileSync(HTML_IN, "utf8")
    .replaceAll("__LOGO_REVERSE__", dataUri("dtdcargo-isologo-reverse.png"))
    .replaceAll("__LOGO_PRIMARY__", dataUri("dtdcargo-isologo-primary.png"));

  // 2) Render con Chromium.
  let browser;
  try {
    browser = await chromium.launch();
  } catch (err) {
    console.error("\n✗ No se pudo lanzar Chromium de Playwright.");
    console.error("  Instálalo una sola vez con:  npx playwright install chromium\n");
    throw err;
  }

  try {
    const page = await browser.newPage({ viewport: { width: 794, height: 1123 } }); // A4 @96dpi
    await page.setContent(html, { waitUntil: "networkidle" });
    // Garantiza que TODAS las fuentes (incl. Noto Sans SC / CJK) cargaron antes de imprimir.
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(250);

    const footer = `
      <div style="width:100%; font-family:Archivo,Arial,sans-serif; font-size:7pt; color:#6B6B6B;
                  padding:0 16mm; display:flex; justify-content:space-between; align-items:center;">
        <span>DTD Cargo · Cómo comprar en Alibaba</span>
        <span>dtdcargo.com · <span class="pageNumber"></span>/<span class="totalPages"></span></span>
      </div>`;

    await page.pdf({
      path: PDF_OUT,
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: footer,
      margin: { top: "16mm", bottom: "16mm", left: "16mm", right: "16mm" },
    });
    console.log(`✓ PDF generado: ${PDF_OUT}`);

    // 3) Screenshots de control (verificación visual de CJK + marca).
    if (wantPng) {
      const fullPng = join(tmpdir(), "guia-alibaba-full.png");
      const addrPng = join(tmpdir(), "guia-alibaba-addr.png");
      await page.screenshot({ path: fullPng, fullPage: true });
      const addr = page.locator("table.addr");
      if (await addr.count()) await addr.first().screenshot({ path: addrPng });
      console.log(`✓ PNG control (doc):       ${fullPng}`);
      console.log(`✓ PNG control (tabla CJK): ${addrPng}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
