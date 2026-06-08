"use server";

/**
 * "Completá tu perfil" (REGISTRO EXPRESS · founder 2026-06-07).
 *
 * El alta express difiere la FOTO de cédula y la DIRECCIÓN de entrega; acá el
 * cliente las completa desde el portal (se piden antes de la 1ª compra; el asesor
 * revisa la foto antes de operar). Persiste en `clients.cedula_photo_path` +
 * `clients.address` del cliente LOGUEADO.
 *
 * Identidad + escritura (defensa en profundidad, mismo patrón que el resto del
 * portal): resolvemos el `client_id` del portal con la SESIÓN (`get_portal_client_id`,
 * aislada) y recién entonces escribimos con el ADMIN client (service_role) scopeado
 * EXPLÍCITO a ese id. El cliente nunca toca el bucket privado ni updatea su fila
 * directo (la RLS del portal es read-only para clients) — el admin client lo hace
 * acotado a su propio id, ya verificado por sesión.
 *
 * La foto es obligatoria SOLO si todavía no hay una cargada: completar el perfil no
 * debe forzar a re-subir la cédula cada vez que el cliente corrige la dirección.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import {
  validateAddressInput,
  composeAddress,
  type AddressInput,
  type ProfileActionState,
} from "@/lib/portal/register-types";
import {
  PHOTO_BUCKET,
  validatePhotoFile,
  uploadClientPhoto,
} from "@/lib/portal/client-photo";

function parseAddressForm(formData: FormData): Partial<AddressInput> {
  return {
    state: (formData.get("state") as string | null) ?? undefined,
    municipio: (formData.get("municipio") as string | null) ?? undefined,
    city: (formData.get("city") as string | null) ?? undefined,
    postalCode: (formData.get("postal_code") as string | null) ?? undefined,
    barrio: (formData.get("barrio") as string | null) ?? undefined,
    address: (formData.get("address") as string | null) ?? undefined,
    reference: (formData.get("reference") as string | null) ?? undefined,
  };
}

export async function completeProfileAction(
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  // 1. Identidad por SESIÓN: el client_id del portal logueado (helper aislada).
  const supabase = await createClient();
  const { data: portalClientId, error: idErr } =
    await supabase.rpc("get_portal_client_id");
  if (idErr || !portalClientId) {
    return { error: "Tu sesión expiró. Volvé a entrar al portal." };
  }
  const clientId = portalClientId as string;

  // 2. Validar la dirección (obligatoria al completar el perfil).
  const { input: address, fieldErrors } = validateAddressInput(
    parseAddressForm(formData),
  );
  const errors: ProfileActionState["fieldErrors"] = { ...fieldErrors };

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: "No está disponible ahora. Probá de nuevo en un rato." };
  }

  // 3. Estado actual (scopeado al id ya verificado por sesión): tenant + markbox
  //    para el path de la foto, y si ya hay una foto cargada.
  const { data: clientRow, error: clientErr } = await admin
    .from("clients")
    .select("tenant_id, markbox, cedula_photo_path")
    .eq("id", clientId)
    .maybeSingle<{
      tenant_id: string;
      markbox: string;
      cedula_photo_path: string | null;
    }>();
  if (clientErr || !clientRow) {
    return { error: "No pudimos cargar tu cuenta. Probá de nuevo." };
  }
  const hasExistingPhoto = !!String(clientRow.cedula_photo_path ?? "").trim();

  // 4. Foto: obligatoria solo si no hay una previa. Si vino una nueva, validarla.
  const photoRaw = formData.get("cedula_photo");
  const photoProvided = photoRaw instanceof File && photoRaw.size > 0;
  if (!photoProvided && !hasExistingPhoto) {
    errors.photo = "Subí la foto de tu cédula/RIF.";
  }
  let newPhoto: File | null = null;
  if (photoProvided) {
    const v = validatePhotoFile(photoRaw);
    if (!v.ok) errors.photo = v.error;
    else newPhoto = v.file;
  }

  if (Object.keys(errors).length > 0) {
    return { fieldErrors: errors };
  }
  // address está garantizado acá (sin fieldErrors de dirección).
  const addr = address as AddressInput;

  // 5. Subir la foto nueva (si vino) al bucket privado. Path nuevo por subida.
  let newPhotoPath: string | undefined;
  if (newPhoto) {
    const up = await uploadClientPhoto(
      admin,
      clientRow.tenant_id,
      clientRow.markbox,
      newPhoto,
    );
    if (up.error || !up.path) {
      console.error("[completeProfileAction] foto upload error:", up.error);
      return { error: "No pudimos guardar tu foto. Probá de nuevo." };
    }
    newPhotoPath = up.path;
  }

  // 6. Update: dirección compuesta + (si hubo) la foto nueva.
  const patch: Record<string, string> = { address: composeAddress(addr) };
  if (newPhotoPath) patch.cedula_photo_path = newPhotoPath;

  const { error: updErr } = await admin
    .from("clients")
    .update(patch)
    .eq("id", clientId);
  if (updErr) {
    // Rollback de la foto recién subida si el update falló (no dejar huérfana).
    if (newPhotoPath) {
      await admin.storage.from(PHOTO_BUCKET).remove([newPhotoPath]).catch(() => {});
    }
    console.error("[completeProfileAction] update clients error:", updErr);
    return { error: "No pudimos guardar tus datos. Probá de nuevo." };
  }

  // 7. Best-effort: borrar la foto vieja reemplazada (no dejar PII colgada).
  if (newPhotoPath && hasExistingPhoto && clientRow.cedula_photo_path) {
    await admin.storage
      .from(PHOTO_BUCKET)
      .remove([clientRow.cedula_photo_path])
      .catch(() => {});
  }

  revalidatePath("/portal");
  revalidatePath("/portal/perfil");
  revalidatePath("/portal/cuenta");
  return { ok: true };
}
