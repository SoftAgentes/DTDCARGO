/**
 * Genera los íconos PWA del Portal del Cliente desde el isólogo oficial.
 *
 * Source: public/brand/dtdcargo-isologo-primary.png (741×764, transparente)
 * Outputs:
 *  - public/portal/icon-192.png          (192×192, fondo paper #FBFAF7)
 *  - public/portal/icon-512.png          (512×512, fondo paper #FBFAF7)
 *  - public/portal/icon-maskable-512.png (512×512, fondo paper, safe-zone)
 *
 * Decisiones:
 * - **Variante `primary` sobre fondo paper (#FBFAF7)**, no `reverse` sobre navy.
 *   Tres razones: (1) BRAND.md — primary va sobre light/paper, ratio 14.8:1;
 *   (2) es el MISMO par que ya usa `apple-touch-icon.png` del sitio público, así
 *   el cliente que instala el portal ve en su home screen el ícono que ya
 *   conoce de dtdcargo.com; (3) lo diferencia de "DTD Operario"
 *   (`public/m/icon-*.png` = reverse sobre navy), que es otra app y otra
 *   audiencia. NO se inventan variantes nuevas — son 4 y esta es una de ellas.
 * - **Fondo opaco, no transparente.** iOS no renderiza transparencia en el home
 *   screen (deja ver el wallpaper detrás del isólogo); Android la pinta negra
 *   en el ícono maskable. Paper sólido es la única opción limpia.
 * - **`purpose: "any"` (192/512) vs `"maskable"` (512).** Android recorta el
 *   maskable a la forma del launcher (círculo, squircle, gota). La safe zone
 *   es un círculo de radio 40% del canvas → el contenido tiene que caber ahí
 *   dentro. Con paddingRatio 0.22 el isólogo queda en 287px y su
 *   semi-diagonal (~200px) entra en los 204.8px de radio seguro. Por eso el
 *   maskable NO puede ser una copia del 512 normal: se le comerían las puntas
 *   de la "D".
 *
 * Uso:
 *   node scripts/generate-portal-icons.mjs
 */
import sharp from "sharp";
import { mkdir } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SRC = join(ROOT, "public/brand/dtdcargo-isologo-primary.png");
const OUT_DIR = join(ROOT, "public/portal");

/** paper #FBFAF7 — token --bg-base del tema claro. */
const PAPER = { r: 251, g: 250, b: 247, alpha: 1 };

/**
 * Compone un PNG cuadrado: canvas full-bleed en `background` + isólogo
 * centrado ocupando (1 - 2*paddingRatio) del lado.
 */
async function makeIcon(size, outFile, paddingRatio) {
  const innerSize = Math.round(size * (1 - paddingRatio * 2));

  const resized = await sharp(SRC)
    .resize(innerSize, innerSize, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .toBuffer();

  // El isólogo es 741×764 (más alto que ancho): tras `contain` el buffer sigue
  // siendo innerSize×innerSize con transparencia a los lados, así que centrarlo
  // con el mismo pad en x/y deja el símbolo ópticamente centrado.
  const pad = Math.round((size - innerSize) / 2);
  await sharp({
    create: { width: size, height: size, channels: 4, background: PAPER },
  })
    .composite([{ input: resized, left: pad, top: pad }])
    .png({ compressionLevel: 9 })
    .toFile(join(OUT_DIR, outFile));

  console.log(
    `✓ ${outFile} · ${size}×${size} · isólogo al ${Math.round((1 - paddingRatio * 2) * 100)}% · fondo paper`,
  );
}

console.log(`Source: ${SRC}\nOutput: ${OUT_DIR}\n`);

await mkdir(OUT_DIR, { recursive: true });

await makeIcon(192, "icon-192.png", 0.14);
await makeIcon(512, "icon-512.png", 0.14);
// Safe zone de Android: círculo de radio 40% → el isólogo no puede pasar del 56%.
await makeIcon(512, "icon-maskable-512.png", 0.22);

console.log("\n✓ Listo. 3 íconos del portal regenerados desde isologoPrimary.");
