/**
 * SDD-0487 · Prepara la foto de perfil EN EL NAVEGADOR antes de subirla.
 *
 * Tres problemas que esto resuelve de una vez:
 *  1. Vercel corta el cuerpo de una función a 4,5 MB. Una foto de teléfono
 *     llega a 3-8 MB y el cliente veía la pantalla de error del Portal. Aquí
 *     queda en 1024 px de lado mayor, normalmente por debajo de 300 KB.
 *  2. Una foto HEIC del iPhone sólo se ve en Safari. Aquí sale JPEG, que se ve
 *     en cualquier navegador. Si el navegador no puede leer el HEIC (Chrome en
 *     Windows), el cliente recibe un mensaje claro y no se sube nada.
 *  3. El EXIF (con la ubicación GPS) no pasa por canvas: el JPEG nuevo no lo
 *     trae. El servidor lo vuelve a quitar por si alguien se salta este paso.
 *
 * La decodificación y la codificación se inyectan para poder probarlas en
 * jsdom, que no implementa canvas.
 */

export const AVATAR_MAX_SIDE = 1024;
export const AVATAR_JPEG_QUALITY = 0.85;
/** Lo que acepta el servidor para el avatar ya preparado. */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
/** Por encima de esto ni se intenta decodificar (memoria del teléfono). */
export const AVATAR_MAX_INPUT_BYTES = 30 * 1024 * 1024;

export const AVATAR_MESSAGES = {
  notImage: "Elige una foto: JPG, PNG o la del iPhone.",
  tooLarge: "Esa foto es demasiado pesada. Elige otra.",
  unreadable: "No pudimos leer esa foto. Elige otra o conviértela a JPG.",
} as const;

export type Decoded = { width: number; height: number; source: CanvasImageSource; close?: () => void };

export type AvatarImageDeps = {
  decode: (file: File) => Promise<Decoded>;
  encode: (source: CanvasImageSource, width: number, height: number, quality: number) => Promise<Blob | null>;
};

export type PreparedAvatar = { ok: true; file: File } | { ok: false; error: string };

/** Escala para que el lado mayor no pase de `max`, sin agrandar nunca. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const side = Math.max(width, height);
  if (side <= max) return { width, height };
  const ratio = max / side;
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) };
}

function looksLikeImage(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  // Windows sin la extensión HEIF deja `type` vacío para un .heic.
  return file.type === "" && /\.(heic|heif|jpe?g|png|webp)$/i.test(file.name);
}

export async function prepareAvatar(file: File, deps: AvatarImageDeps = browserDeps()): Promise<PreparedAvatar> {
  if (!looksLikeImage(file)) return { ok: false, error: AVATAR_MESSAGES.notImage };
  if (file.size <= 0) return { ok: false, error: AVATAR_MESSAGES.unreadable };
  if (file.size > AVATAR_MAX_INPUT_BYTES) return { ok: false, error: AVATAR_MESSAGES.tooLarge };

  let decoded: Decoded;
  try {
    decoded = await deps.decode(file);
  } catch {
    return { ok: false, error: AVATAR_MESSAGES.unreadable };
  }
  try {
    if (!(decoded.width > 0 && decoded.height > 0)) {
      return { ok: false, error: AVATAR_MESSAGES.unreadable };
    }
    // Primer intento a 1024 px; si aun así pesa demasiado, 768 px y menos calidad.
    for (const [side, quality] of [[AVATAR_MAX_SIDE, AVATAR_JPEG_QUALITY], [768, 0.7]] as const) {
      const size = fitWithin(decoded.width, decoded.height, side);
      const blob = await deps.encode(decoded.source, size.width, size.height, quality);
      if (!blob) return { ok: false, error: AVATAR_MESSAGES.unreadable };
      if (blob.size <= AVATAR_MAX_BYTES) {
        return { ok: true, file: new File([blob], "avatar.jpg", { type: "image/jpeg" }) };
      }
    }
    return { ok: false, error: AVATAR_MESSAGES.tooLarge };
  } catch {
    return { ok: false, error: AVATAR_MESSAGES.unreadable };
  } finally {
    decoded.close?.();
  }
}

/** Implementación real: createImageBitmap respeta la orientación del EXIF. */
export function browserDeps(): AvatarImageDeps {
  return {
    async decode(file) {
      if (typeof createImageBitmap === "function") {
        const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
        return { width: bitmap.width, height: bitmap.height, source: bitmap, close: () => bitmap.close() };
      }
      const url = URL.createObjectURL(file);
      try {
        const img = new Image();
        img.decoding = "async";
        img.src = url;
        await img.decode();
        return { width: img.naturalWidth, height: img.naturalHeight, source: img };
      } finally {
        URL.revokeObjectURL(url);
      }
    },
    async encode(source, width, height, quality) {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      // Fondo blanco: un PNG transparente no queda negro al pasar a JPEG.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(source, 0, 0, width, height);
      return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    },
  };
}
