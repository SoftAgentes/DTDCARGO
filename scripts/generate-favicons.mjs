/**
 * Regenera favicons y apple-touch-icon a partir del isólogo oficial v3.0.
 *
 * Source: public/brand/dtdcargo-isologo-primary.png (741×764, transparente)
 * Outputs:
 *  - public/brand/favicon-16.png       (16×16, fondo transparente)
 *  - public/brand/favicon-32.png       (32×32, fondo transparente)
 *  - public/brand/apple-touch-icon.png (180×180, fondo paper #FBFAF7)
 *
 * Decisiones:
 * - Favicons (16/32): fondo transparente. Funciona con tab bars claros y
 *   oscuros (el navy del isólogo se ve en claros; en oscuros el isólogo es
 *   más sutil pero sigue siendo reconocible por la forma).
 * - Apple touch icon (180): fondo paper (#FBFAF7) en vez de transparente.
 *   iOS no renderiza transparencia en el home screen; un fondo brand-color
 *   queda más limpio que dejar que el wallpaper se vea atrás del isólogo.
 * - Padding interno: el isólogo ocupa ~80% del canvas para que respire en
 *   tamaños chicos (sin padding se ve apretado a 16×16).
 *
 * Uso:
 *   node scripts/generate-favicons.mjs
 */
import sharp from "sharp";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SRC = join(ROOT, "public/brand/dtdcargo-isologo-primary.png");
const OUT_DIR = join(ROOT, "public/brand");

/** Genera un favicon PNG cuadrado con padding interno y fondo opcional. */
async function makeIcon(size, outFile, options = {}) {
  const { background = null, paddingRatio = 0.1 } = options;
  // El isólogo ocupa ~(1 - 2*paddingRatio) del canvas.
  const innerSize = Math.round(size * (1 - paddingRatio * 2));

  // Resize el source al tamaño interno (preserva aspect ratio, encaja en cuadrado)
  const resized = await sharp(SRC)
    .resize(innerSize, innerSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  // Crear canvas cuadrado del tamaño final, con fondo (o transparente) y pegar el resized centrado.
  const pad = Math.round((size - innerSize) / 2);
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: background ?? { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: resized, left: pad, top: pad }])
    .png({ compressionLevel: 9 })
    .toFile(join(OUT_DIR, outFile));

  console.log(`✓ ${outFile} · ${size}×${size}${background ? " · fondo " + JSON.stringify(background) : " · transparente"}`);
}

console.log(`Source: ${SRC}\nOutput: ${OUT_DIR}\n`);

await makeIcon(16, "favicon-16.png", { paddingRatio: 0.06 });
await makeIcon(32, "favicon-32.png", { paddingRatio: 0.08 });
await makeIcon(180, "apple-touch-icon.png", {
  background: { r: 251, g: 250, b: 247, alpha: 1 }, // paper #FBFAF7
  paddingRatio: 0.12,
});

console.log("\n✓ Listo. favicon.ico se mantiene del v2.x (legacy fallback IE).\n  Para regenerar el .ico hay que instalar un pkg adicional (to-ico).\n  Modern browsers usan los PNGs directamente vía <link rel='icon' type='image/png'>.");
