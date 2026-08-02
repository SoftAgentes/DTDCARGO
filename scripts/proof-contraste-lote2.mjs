/**
 * Hoja de prueba visual del Lote 2. Inyecta los tokens REALES de
 * app/studio/tokens.css y renderiza el panel navy de Facturación y la banda
 * vino del dashboard, ANTES (--ink-inv*) vs DESPUÉS (--ink-side*), en los dos
 * temas. Screenshot con el Playwright del repo.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const ROOT = process.argv[2] ?? process.cwd();
const OUT = process.argv[3] ?? path.join(ROOT, "proof-contraste.png");
const tokens = fs.readFileSync(path.join(ROOT, "app/studio/tokens.css"), "utf8");

const panel = (titulo, t1, t2, t3, fondo) => `
  <div class="panel" style="background: var(${fondo});">
    <div class="cap">${titulo}</div>
    <div class="eyebrow" style="color: var(${t3});">TOTAL FACTURADO</div>
    <div class="big" style="color: var(${t1});">$12.480,00</div>
    <div class="hr" style="background: var(${t3});"></div>
    <div class="row" style="color: var(${t2});">
      <span>Base imponible: <b>$10.762,07</b></span>
      <span>IVA 16%: <b>$1.721,93</b></span>
    </div>
    <div class="row small" style="color: var(${t2});">
      Pagado: <b>$8.000,00</b> · Vence: <b style="color: var(${t1});">2026-08-30</b>
    </div>
  </div>`;

const bloque = (tema) => `
<section class="tema" data-theme="${tema}">
  <h2>Tema ${tema === "dark" ? "OSCURO" : "CLARO"}</h2>
  <div class="grid">
    <div>
      <h3 class="antes">ANTES · --ink-inv*</h3>
      ${panel("sobre --bg-sidebar", "--ink-inv", "--ink-inv-soft", "--ink-inv-mute", "--bg-sidebar")}
      ${panel("sobre --wine", "--ink-inv", "--ink-inv-soft", "--ink-inv-mute", "--wine")}
    </div>
    <div>
      <h3 class="despues">DESPUÉS · --ink-side*</h3>
      ${panel("sobre --bg-sidebar", "--ink-side-strong", "--ink-side", "--ink-side-soft", "--bg-sidebar")}
      ${panel("sobre --wine", "--ink-side-strong", "--ink-side", "--ink-side-soft", "--wine")}
    </div>
  </div>
</section>`;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
${tokens}
*{box-sizing:border-box} body{margin:0;font-family:system-ui,sans-serif;background:#7a7a7a}
.tema{padding:18px 22px}
.tema[data-theme="light"]{background:#EDEBE6}
.tema[data-theme="dark"]{background:#0A1120}
h2{margin:0 0 12px;font:800 15px/1 system-ui;letter-spacing:.08em}
.tema[data-theme="light"] h2{color:#1a1a1a} .tema[data-theme="dark"] h2{color:#f0f0f0}
h3{margin:0 0 8px;font:700 11px/1 system-ui;letter-spacing:.12em}
h3.antes{color:#c0392b} h3.despues{color:#1e8449}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.panel{border-radius:12px;padding:16px 18px;margin-bottom:12px}
.cap{font:600 9px/1 system-ui;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.35);margin-bottom:10px}
.eyebrow{font:600 10.5px/1 system-ui;letter-spacing:.14em;text-transform:uppercase}
.big{font:900 34px/1 system-ui;letter-spacing:-.02em;margin-top:6px}
.hr{height:1px;margin:12px 0}
.row{font:500 12.5px/1.4 system-ui;display:flex;gap:20px;flex-wrap:wrap}
.row.small{font-size:11.5px;margin-top:8px}
</style></head><body>
${bloque("light")}
${bloque("dark")}
</body></html>`;

const tmp = path.join(path.dirname(OUT), "proof.html");
fs.writeFileSync(tmp, html);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1180, height: 1120 }, deviceScaleFactor: 2 });
await page.goto("file://" + tmp.split(path.sep).join("/"));
await page.screenshot({ path: OUT, fullPage: true });
await browser.close();
console.log("screenshot →", OUT);
