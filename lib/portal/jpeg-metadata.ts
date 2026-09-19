/**
 * SDD-0487 · Quita los metadatos de un JPEG antes de guardarlo.
 *
 * El navegador ya vuelve a codificar la foto de perfil con canvas, lo que
 * descarta el EXIF. Pero el servidor no confía en el navegador: una llamada
 * directa a la action podría subir el archivo original, con la ubicación GPS
 * del teléfono adentro. Por eso aquí se recorren los segmentos del JPEG y se
 * descartan los que llevan metadatos de la persona:
 *
 *   APP1 (FFE1)  · EXIF (GPS, modelo del teléfono, fecha) y XMP.
 *   APP13 (FFED) · IPTC de Photoshop (autor, ubicación, palabras clave).
 *   COM (FFFE)   · comentario de texto libre.
 *
 * El resto se conserva tal cual, incluido APP2 (perfil de color ICC), que no
 * identifica a nadie y sin el cual la foto puede verse con otros colores.
 *
 * PURA: recibe bytes y devuelve bytes, o `null` si el archivo no es un JPEG
 * bien formado. Un `null` se rechaza: no se guarda algo que no se pudo revisar.
 */

const STRIPPED = new Set([0xe1, 0xed, 0xfe]);

export function stripJpegMetadata(input: Uint8Array): Uint8Array | null {
  if (input.length < 4 || input[0] !== 0xff || input[1] !== 0xd8) return null;

  const out: number[] = [0xff, 0xd8];
  let i = 2;
  while (i < input.length) {
    if (input[i] !== 0xff) return null;
    // Bytes de relleno 0xFF entre segmentos.
    while (i < input.length && input[i] === 0xff) i += 1;
    if (i >= input.length) return null;
    const marker = input[i];
    i += 1;

    // Marcadores sin longitud: RSTn y TEM. Antes del SOS no deberían estar,
    // pero si aparecen se copian sin más.
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      out.push(0xff, marker);
      continue;
    }
    // EOI sin imagen: no es una foto.
    if (marker === 0xd9) return null;

    if (i + 1 >= input.length) return null;
    const length = (input[i] << 8) | input[i + 1];
    if (length < 2 || i + length > input.length) return null;

    if (marker === 0xda) {
      // SOS: a partir de aquí van los datos de la imagen hasta el final.
      out.push(0xff, marker);
      const rest = input.subarray(i);
      const result = new Uint8Array(out.length + rest.length);
      result.set(out, 0);
      result.set(rest, out.length);
      return result;
    }

    if (!STRIPPED.has(marker)) {
      out.push(0xff, marker);
      for (let k = 0; k < length; k += 1) out.push(input[i + k]);
    }
    i += length;
  }
  return null;
}
