/**
 * Foto del empleado (SDD-0652 fase 2, UPL-01 y MP-01). Solo servidor.
 *
 * El navegador manda un archivo; aquí se vuelve a validar todo:
 *
 *   - tamaño (2 MB) y tipo **por contenido** (los primeros bytes), no por la
 *     extensión ni por el tipo que declara el navegador;
 *   - se reescala a 512 px, se guarda en WebP y **pierde los metadatos EXIF**
 *     (pueden traer la ubicación): sharp no los copia si no se le pide;
 *   - la ruta la arma el servidor: `{tenant_id}/{employee_id}/{uuid}.webp`.
 *
 * El bucket `employee-photos` es privado y no tiene policies para
 * `authenticated` (migración 0555): se sube y se firma con el cliente admin,
 * después del control de rol de la ficha.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export const EMPLOYEE_PHOTO_BUCKET = "employee-photos";
export const EMPLOYEE_PHOTO_MAX_BYTES = 2 * 1024 * 1024;
export const EMPLOYEE_PHOTO_SIZE_PX = 512;
/** Vida de la URL firmada: lo que dura una visita a la ficha, no más. */
export const EMPLOYEE_PHOTO_URL_TTL_S = 600;

export type TipoImagen = "image/jpeg" | "image/png" | "image/webp";

/** El tipo real del archivo, por sus primeros bytes. null si no es una de las tres. */
export function detectarTipoImagen(bytes: Uint8Array): TipoImagen | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  // RIFF....WEBP
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

export type FotoValidada = { ok: true; tipo: TipoImagen } | { ok: false; error: string };

/** Tamaño y tipo, antes de gastar CPU en procesar. */
export function validarFoto(bytes: Uint8Array): FotoValidada {
  if (bytes.length === 0) return { ok: false, error: "El archivo está vacío." };
  if (bytes.length > EMPLOYEE_PHOTO_MAX_BYTES) return { ok: false, error: "La foto pesa más de 2 MB." };
  const tipo = detectarTipoImagen(bytes);
  if (!tipo) return { ok: false, error: "El archivo no es una imagen JPG, PNG o WebP." };
  return { ok: true, tipo };
}

export type FotoProcesada = { ok: true; webp: Buffer } | { ok: false; error: string };

/**
 * Valida, endereza según la orientación de la cámara, recorta al centro a
 * 512 × 512 y guarda en WebP sin metadatos.
 */
export async function procesarFotoEmpleado(bytes: Uint8Array): Promise<FotoProcesada> {
  const v = validarFoto(bytes);
  if (!v.ok) return v;
  try {
    const sharp = (await import("sharp")).default;
    const webp = await sharp(bytes, { failOn: "error", limitInputPixels: 40_000_000 })
      .rotate() // aplica la orientación EXIF antes de perderla
      .resize(EMPLOYEE_PHOTO_SIZE_PX, EMPLOYEE_PHOTO_SIZE_PX, { fit: "cover", position: "attention" })
      .webp({ quality: 82 })
      .toBuffer();
    return { ok: true, webp };
  } catch (err) {
    console.error("[employee-photo] procesar", err instanceof Error ? err.message : "error");
    return { ok: false, error: "No se pudo leer la imagen. Prueba con otra foto." };
  }
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const RUTA_RE = new RegExp(`^(${UUID})/(${UUID})/${UUID}[.]webp$`);

/** `{tenant_id}/{employee_id}/{uuid}.webp`. La misma forma que exige la 0555. */
export function rutaFotoEmpleado(tenantId: string, employeeId: string, fileId: string): string {
  const ruta = `${tenantId}/${employeeId}/${fileId}.webp`.toLowerCase();
  if (!RUTA_RE.test(ruta)) throw new Error("ruta de foto inválida");
  return ruta;
}

/** ¿La ruta es de esta ficha y de este tenant? Lo que no lo sea no se firma. */
export function esRutaDeFicha(ruta: string | null | undefined, tenantId: string, employeeId: string): ruta is string {
  if (!ruta) return false;
  const m = RUTA_RE.exec(ruta);
  return !!m && m[1] === tenantId.toLowerCase() && m[2] === employeeId.toLowerCase();
}

/**
 * URL firmadas y cortas para un grupo de rutas. Quien llama ya comprobó el rol.
 * Una ruta que no se pudo firmar no aparece en el mapa: la ficha muestra las
 * iniciales.
 */
export async function firmarFotos(admin: SupabaseClient, rutas: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unicas = [...new Set(rutas.filter(Boolean))];
  if (unicas.length === 0) return out;
  const { data, error } = await admin.storage
    .from(EMPLOYEE_PHOTO_BUCKET)
    .createSignedUrls(unicas, EMPLOYEE_PHOTO_URL_TTL_S);
  if (error || !data) {
    console.error("[employee-photo] firmar", error?.message ?? "sin datos");
    return out;
  }
  for (const fila of data) {
    if (fila.path && fila.signedUrl && !fila.error) out.set(fila.path, fila.signedUrl);
  }
  return out;
}

/**
 * Rutas de foto de un grupo de fichas de un tenant (`id → photo_path`).
 *
 * Va aparte de `EMPLOYEE_COLUMNS` a propósito: mientras la migración 0555 esté
 * en espera, la columna no existe y pedirla junto con la ficha rompería toda
 * Nómina. Así, sin la columna, las fichas se ven sin foto y nada más.
 */
export async function rutasDeFoto(
  supabase: SupabaseClient,
  tenantId: string,
  employeeIds: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (employeeIds.length === 0) return out;
  const { data, error } = await supabase
    .from("nomina_employees")
    .select("id, photo_path")
    .eq("tenant_id", tenantId)
    .in("id", employeeIds)
    .not("photo_path", "is", null);
  if (error) {
    // 42703 / PGRST204: la 0555 todavía no está aplicada. Se registra solo el código.
    console.error("[employee-photo] rutas", error.code ?? "error");
    return out;
  }
  for (const fila of (data ?? []) as { id: string; photo_path: string | null }[]) {
    if (esRutaDeFicha(fila.photo_path, tenantId, fila.id)) out.set(fila.id, fila.photo_path);
  }
  return out;
}
