// SDD-0583 · logo de los correos: el isologo primary sobre una ficha blanca opaca.
//
// Gmail y Outlook en modo oscuro oscurecen el fondo del correo pero no las imágenes: el
// primary con fondo transparente quedaría sobre oscuro (BRAND.md lo prohíbe, 1.1:1). Con la
// ficha blanca dentro de la imagen se ve igual en claro y en oscuro. No es una variante
// nueva: es el primary, sin tocar, sobre su fondo permitido (white).
//
// Uso (desde la raíz del repo): node infra/chatwoot/correo/generar-logo.mjs
// Sale a 2x (128×128) para pantallas densas; las plantillas lo muestran a 64×64.
import sharp from "sharp";

const ORIGEN = "infra/chatwoot/marca/dtdcargo-isologo-primary.png";
const DESTINO = "infra/chatwoot/marca/dtdcargo-isologo-correo.png";
const LADO = 128;
const RADIO = 28;
const ALTO_LOGO = 92;

const logo = await sharp(ORIGEN).resize({ height: ALTO_LOGO }).png().toBuffer();
const ficha = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${LADO}" height="${LADO}"><rect width="${LADO}" height="${LADO}" rx="${RADIO}" fill="#FFFFFF"/></svg>`,
);
await sharp(ficha).composite([{ input: logo, gravity: "center" }]).png({ compressionLevel: 9 }).toFile(DESTINO);
console.log(`listo: ${DESTINO}`);
