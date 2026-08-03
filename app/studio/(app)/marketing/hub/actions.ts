"use server";

/**
 * Server actions del HUB de marca (SDD-0238) — Studio › Marketing.
 *
 * Acá se administra lo que ve `/marca`: subir y quitar archivos del catálogo, y
 * poner el código de acceso que el founder le pasa a diseño.
 *
 * Parsing manual de FormData + validadores propios, sin Zod (convención del repo).
 *
 * PERMISO: `moduleEditDenial(supabase, "marketing")` como backstop server-side —
 * las actions son invocables directo, no basta con esconder el botón. La RLS de
 * `brand_assets` (sólo admin escribe) y el chequeo de rol dentro de
 * `set_brand_access_code` son el aislamiento duro.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { moduleEditDenial } from "@/lib/studio/rbac-guard";
import { isBrandAssetKind, isBrandTile } from "@/lib/marca/catalog-types";

const BUCKET = "brand-assets";

/** 200 MB — el mismo tope que el bucket (migr 0334). */
const MAX_BYTES = 200 * 1024 * 1024;

export type BrandAdminState = {
  ok?: boolean;
  error?: string;
  message?: string;
};

/**
 * Nombre de archivo seguro para la clave de Storage. Sin acentos ni espacios
 * (kebab-case, convención de assets del repo) y sin `/` ni `..`, que abrirían
 * la puerta a escribir fuera del prefijo del tenant.
 */
function safeFileName(name: string): string {
  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // descarta los diacríticos ya separados
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  return normalized.length > 0 ? normalized.slice(0, 120) : "archivo";
}

async function resolveTenant(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const { data } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .is("disabled_at", null)
    .limit(1)
    .maybeSingle<{ tenant_id: string }>();
  return data?.tenant_id ?? null;
}

// ── Subir un archivo al catálogo ────────────────────────────────

export async function uploadBrandAssetAction(
  _prev: BrandAdminState,
  formData: FormData,
): Promise<BrandAdminState> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "marketing");
  if (denial) return { error: denial };

  const tenantId = await resolveTenant(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant." };

  const file = formData.get("file");
  const sectionId = formData.get("sectionId");
  const titleRaw = formData.get("title");
  const subtitleRaw = formData.get("subtitle");
  const kindRaw = formData.get("kind");
  const tileRaw = formData.get("tile");
  const widthRaw = formData.get("width");
  const heightRaw = formData.get("height");

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Elige un archivo." };
  }
  if (file.size > MAX_BYTES) {
    return { error: "El archivo pasa de 200 MB. Comprímelo o súbelo en partes." };
  }
  if (typeof sectionId !== "string" || sectionId.length === 0) {
    return { error: "Elige la sección." };
  }
  const kind = typeof kindRaw === "string" && isBrandAssetKind(kindRaw) ? kindRaw : "documento";
  const title =
    typeof titleRaw === "string" && titleRaw.trim().length > 0
      ? titleRaw.trim()
      : file.name;
  const subtitle =
    typeof subtitleRaw === "string" && subtitleRaw.trim().length > 0
      ? subtitleRaw.trim()
      : null;
  const tile = typeof tileRaw === "string" && isBrandTile(tileRaw) ? tileRaw : "auto";

  /**
   * Las dimensiones las lee el NAVEGADOR (naturalWidth/naturalHeight) y llegan
   * como campos del formulario — leerlas en el servidor exigiría una
   * dependencia de decodificación de imágenes para un dato cosmético. Al venir
   * del cliente son manipulables, así que se sanean acá; el CHECK de la migr
   * 0335 es el backstop. Si no son válidas → null y la ficha no las muestra.
   */
  const dimension = (raw: FormDataEntryValue | null): number | null => {
    if (typeof raw !== "string" || raw.trim() === "") return null;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 && n <= 100_000 ? n : null;
  };
  const width = dimension(widthRaw);
  const height = dimension(heightRaw);

  // La sección tiene que ser del MISMO tenant. Sin esto, un formulario
  // manipulado colgaría el archivo de la sección de otro — el FK compuesto de la
  // migración lo atajaría igual, pero acá el error es legible.
  const { data: section } = await supabase
    .from("brand_sections")
    .select("id, slug")
    .eq("id", sectionId)
    .eq("tenant_id", tenantId)
    .maybeSingle<{ id: string; slug: string }>();
  if (!section) return { error: "Esa sección no existe." };

  // Convención de adjuntos de AGENTS.md: {tenant_id}/{entidad}/{id}/archivo.
  // El timestamp evita que subir dos veces el mismo nombre pise el anterior —
  // el archivo viejo sigue sirviendo a quien tenga la página abierta.
  const storagePath = `${tenantId}/marca/${section.slug}/${Date.now()}-${safeFileName(file.name)}`;

  // Storage con service_role: el bucket es privado y no tiene políticas para
  // `authenticated` a propósito (el navegador nunca habla con Storage directo).
  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (uploadError) {
    return { error: `No se pudo subir el archivo: ${uploadError.message}` };
  }

  // La fila se inserta con el cliente del USUARIO para que la RLS vuelva a
  // validar el rol admin. Si rebota, se limpia el objeto: un binario huérfano en
  // el bucket no lo ve nadie pero ocupa y confunde en la auditoría.
  const { error: insertError } = await supabase.from("brand_assets").insert({
    tenant_id: tenantId,
    section_id: section.id,
    title,
    subtitle,
    kind,
    storage_path: storagePath,
    mime: file.type || null,
    bytes: file.size,
    width,
    height,
    tile,
  });
  if (insertError) {
    await admin.storage.from(BUCKET).remove([storagePath]);
    return { error: `No se pudo guardar el archivo: ${insertError.message}` };
  }

  revalidatePath("/studio/marketing/hub");
  revalidatePath("/marca");
  return { ok: true, message: `"${title}" quedó publicado en ${section.slug}.` };
}

// ── Quitar un archivo del catálogo ──────────────────────────────

export async function deleteBrandAssetAction(
  _prev: BrandAdminState,
  formData: FormData,
): Promise<BrandAdminState> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "marketing");
  if (denial) return { error: denial };

  const assetId = formData.get("assetId");
  if (typeof assetId !== "string" || assetId.length === 0) {
    return { error: "Falta el archivo." };
  }

  const tenantId = await resolveTenant(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant." };

  const { data: asset } = await supabase
    .from("brand_assets")
    .select("id, title, storage_path")
    .eq("id", assetId)
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .maybeSingle<{ id: string; title: string; storage_path: string }>();
  if (!asset) return { error: "Ese archivo ya no está." };

  // Soft delete (convención del Studio: nunca DELETE). El binario SÍ se borra:
  // dejarlo sería pagar almacenamiento por algo que ya nadie puede pedir, y el
  // catálogo de marca no tiene valor de auditoría histórica.
  const { error } = await supabase
    .from("brand_assets")
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq("id", asset.id)
    .eq("tenant_id", tenantId);
  if (error) return { error: "No se pudo quitar el archivo." };

  await createAdminClient().storage.from(BUCKET).remove([asset.storage_path]);

  revalidatePath("/studio/marketing/hub");
  revalidatePath("/marca");
  return { ok: true, message: `"${asset.title}" ya no aparece en /marca.` };
}

// ── Poner (o quitar) el código de acceso ────────────────────────

export async function setBrandCodeAction(
  _prev: BrandAdminState,
  formData: FormData,
): Promise<BrandAdminState> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "marketing");
  if (denial) return { error: denial };

  const raw = formData.get("code");
  const code = typeof raw === "string" ? raw.trim() : "";
  const daysRaw = formData.get("sessionDays");
  const days = typeof daysRaw === "string" ? Number.parseInt(daysRaw, 10) : 30;

  // Vacío = cerrar el acceso externo.
  const closing = code.length === 0;
  if (!closing && !/^\d{4,6}$/.test(code)) {
    return { error: "El código son 4 a 6 dígitos, sin letras." };
  }
  if (!Number.isFinite(days) || days < 1 || days > 365) {
    return { error: "La duración va de 1 a 365 días." };
  }

  // La RPC hashea con bcrypt en el servidor, revalida que seas admin del tenant
  // y borra los bloqueos vigentes. El código en claro no se guarda en ningún
  // lado: si se olvida, se pone uno nuevo.
  const { error } = await supabase.rpc("set_brand_access_code", {
    p_code: closing ? null : code,
    p_session_days: days,
  });
  if (error) {
    if (error.message.includes("solo admin")) {
      return { error: "Solo un admin puede cambiar el código." };
    }
    return { error: "No se pudo guardar el código." };
  }

  revalidatePath("/studio/marketing/hub");
  revalidatePath("/marca");
  return {
    ok: true,
    message: closing
      ? "Acceso cerrado. El código anterior dejó de servir."
      : "Código actualizado. El anterior dejó de servir.",
  };
}

// ── Segunda capa: el código de las piezas de producto (SDD-0242) ──

/**
 * Pone (o quita) el código que abre el ERP por dentro, la app del operario y
 * los formularios de inspección dentro de `/marca`.
 *
 * Son SEIS dígitos, no de 4 a 6 como el de marca. Es la capa más profunda y
 * dejar el mínimo bajo justo acá sería al revés de lo que se pidió: por el mismo
 * esfuerzo de tecleo son 100 veces más combinaciones. La regla también vive en
 * la RPC — acá se valida para dar un mensaje decente, no para confiar.
 */
export async function setBrandInternalCodeAction(
  _prev: BrandAdminState,
  formData: FormData,
): Promise<BrandAdminState> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "marketing");
  if (denial) return { error: denial };

  const raw = formData.get("code");
  const code = typeof raw === "string" ? raw.trim() : "";

  const closing = code.length === 0;
  if (!closing && !/^\d{6}$/.test(code)) {
    return { error: "El código de producto son 6 dígitos exactos." };
  }

  const { error } = await supabase.rpc("set_brand_internal_code", {
    p_code: closing ? null : code,
  });
  if (error) {
    if (error.message.includes("solo admin")) {
      return { error: "Solo un admin puede cambiar el código de producto." };
    }
    return { error: "No se pudo guardar el código de producto." };
  }

  revalidatePath("/studio/marketing/hub");
  revalidatePath("/marca");
  return {
    ok: true,
    message: closing
      ? "Piezas de producto cerradas. Ya no las abre nadie."
      : "Código de producto actualizado. El anterior dejó de servir.",
  };
}
