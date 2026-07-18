/**
 * Genera el LECTOR OFFLINE de los documentos de marketing.
 *
 * Un solo archivo HTML autocontenido con todos los `.md` de `docs/marketing/`
 * embebidos: se navega sin internet ni servidor (doble clic). Es hermano del
 * lector integrado en el Studio (`/studio/marketing/docs`, SDD-0158) — mismo
 * contenido, pero portable para abrir fuera del ERP.
 *
 * Uso:
 *   pnpm marketing:reader                     → outputs/lector-marketing-dtd.html
 *   node scripts/build-marketing-reader.mjs "C:/ruta/Lector.html"   → destino custom
 *
 * La plantilla (barra lateral + buscador + renderizador de markdown) vive en
 * `scripts/marketing-reader.template.html`; este script solo inyecta los docs.
 * La salida NO se commitea (está en `.gitignore`): se regenera cuando cambian
 * los `.md`.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const MK = join(ROOT, "docs", "marketing");
const TEMPLATE = join(HERE, "marketing-reader.template.html");
const OUT = process.argv[2]
  ? resolve(process.cwd(), process.argv[2])
  : join(ROOT, "outputs", "lector-marketing-dtd.html");

// Grupos + orden de los documentos en la barra lateral (igual que el lector del
// Studio, `lib/studio/marketing/docs-reader.ts`).
const PLAN = [
  ["Sistema de adquisición", ["README.md", "adquisicion.md", "oferta-borradores.md", "prospectos-ancla.md", "guiones-asesor.md", "checklist-kommo.md", "ventas.md", "embudo-ventas.md"]],
  ["Estrategia y ventas", ["estrategia.md", "identidad.md", "manual-vendedores-peso.md", "condiciones-cotizacion.md"]],
  ["Canales y contenido", ["seo.md", "plan-accion-digital.md", "ads-reestructura-search.md", "redes.md", "whatsapp-business.md", "link-in-bio.md", "videos/video-registro-markbox.md"]],
];

const blocks = [];
let n = 0;
for (const [group, files] of PLAN) {
  for (const rel of files) {
    let content;
    try {
      content = readFileSync(join(MK, rel), "utf8");
    } catch {
      console.warn("  ! falta", rel);
      continue;
    }
    // El único cierre que rompe un <script> es "</script"; ningún doc lo tiene,
    // pero lo neutralizamos por seguridad.
    content = content.replace(/<\/script/gi, "<\\/script");
    blocks.push(
      `<script type="text/markdown" data-path="docs/marketing/${rel}" data-group="${group}">\n${content}\n</script>`,
    );
    n++;
  }
}

const template = readFileSync(TEMPLATE, "utf8");
const html = template.replace("<!--DOCS-->", blocks.join("\n"));

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, html, "utf8");

console.log(`OK · ${n} documentos embebidos`);
console.log(`Salida: ${OUT}`);
console.log(`Tamaño: ${(Buffer.byteLength(html, "utf8") / 1024).toFixed(0)} KB`);
