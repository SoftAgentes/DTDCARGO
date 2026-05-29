"use client";

/**
 * Compresión de imagen client-side (Sprint 3.5 v3).
 *
 * El camionero saca foto del POD con la cámara del teléfono · esas fotos
 * pesan 3-8MB. En la calle, con datos VE flojos, subir 8MB falla o tarda
 * minutos. Comprimimos a ~1600px lado mayor + JPEG quality 0.7 → típico
 * 200-500KB sin perder legibilidad del documento/firma.
 *
 * Usa canvas (sin dependencias). Si el browser no soporta algo o la
 * imagen es chica, devuelve el File original (graceful).
 */

const MAX_DIMENSION = 1600; // px, lado mayor
const JPEG_QUALITY = 0.7;
const SKIP_BELOW_BYTES = 400 * 1024; // <400KB ya está OK, no recomprimir

export async function compressImage(file: File): Promise<File> {
  // No tocar si ya es chica o no es imagen
  if (!file.type.startsWith("image/")) return file;
  if (file.size <= SKIP_BELOW_BYTES) return file;
  if (typeof document === "undefined") return file;

  try {
    const bitmap = await loadBitmap(file);
    const { width, height } = scaleDimensions(
      bitmap.width,
      bitmap.height,
      MAX_DIMENSION,
    );

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      closeBitmap(bitmap);
      return file;
    }
    ctx.drawImage(bitmap as CanvasImageSource, 0, 0, width, height);
    closeBitmap(bitmap);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    if (!blob || blob.size >= file.size) {
      // Compresión no ayudó (raro) · quedarse con el original
      return file;
    }

    const newName = file.name.replace(/\.\w+$/, "") + ".jpg";
    return new File([blob], newName, {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
  } catch (err) {
    console.warn("[image-compress] fallo, uso original:", err);
    return file;
  }
}

// ─── helpers ──────────────────────────────────────────────────

type AnyBitmap = ImageBitmap | HTMLImageElement;

async function loadBitmap(file: File): Promise<AnyBitmap> {
  // createImageBitmap es más rápido y maneja EXIF orientation en browsers
  // modernos. Fallback a <img> + objectURL.
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      /* fallthrough */
    }
  }
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

function closeBitmap(b: AnyBitmap): void {
  if ("close" in b && typeof b.close === "function") b.close();
}

function scaleDimensions(
  w: number,
  h: number,
  max: number,
): { width: number; height: number } {
  if (w <= max && h <= max) return { width: w, height: h };
  const ratio = w > h ? max / w : max / h;
  return { width: Math.round(w * ratio), height: Math.round(h * ratio) };
}
