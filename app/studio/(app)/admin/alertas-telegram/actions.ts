"use server";

/**
 * Server actions de Administración › Alertas de Telegram (SDD-0271).
 *
 * Patrón del Studio: "use server" + parsing manual de FormData + validación
 * propia (sin Zod) + revalidatePath. Todas exigen rol `admin`: es el mismo
 * gate que la RLS de la migr 0386, acá para que la UI no sea la única barrera.
 *
 * El gate de navegación es el `layout.tsx` (requireModuleView("admin")); acá se
 * revalida por ROL porque una pantalla escondida no es una barrera: estas
 * actions son endpoints y hay que poder llamarlas directo y que rebote.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { getStudioRole } from "@/lib/studio/rbac-guard";
import { generateTelegramLinkCode } from "@/lib/studio/telegram/link-code";
import {
  TELEGRAM_ALERT_CATEGORIES,
  type TelegramAlertCategory,
} from "@/lib/studio/telegram/alert-routing";

const ALERTAS_PATH = "/studio/admin/alertas-telegram";

type StudioClient = Awaited<ReturnType<typeof createClient>>;

export interface AjustesActionState {
  ok?: boolean;
  error?: string;
  /** Código recién generado, para mostrarlo en pantalla sin recargar. */
  linkCode?: string;
}

/** Rol admin + tenant, o el mensaje de denegación. Un solo lugar. */
async function requireAdmin(
  supabase: StudioClient,
): Promise<{ tenantId: string } | { error: string }> {
  const role = await getStudioRole(supabase);
  if (role !== "admin") {
    return { error: "Sólo un administrador puede cambiar las alertas de Telegram." };
  }

  const { data } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .is("disabled_at", null)
    .limit(1)
    .maybeSingle<{ tenant_id: string }>();

  if (!data?.tenant_id) return { error: "No se pudo resolver tu tenant." };
  return { tenantId: data.tenant_id };
}

function isCategory(value: string): value is TelegramAlertCategory {
  return (TELEGRAM_ALERT_CATEGORIES as ReadonlyArray<string>).includes(value);
}

/**
 * Crea un destino nuevo, PENDIENTE de enlace, y devuelve su código.
 *
 * El destino nace sin `chat_id` a propósito: un chat_id no se puede derivar de
 * un número de teléfono — el bot sólo lo aprende cuando esa cuenta le manda
 * `/start <código>`. Hasta entonces el destino no recibe nada, y las categorías
 * ruteadas a él siguen cayendo al broadcast de admins.
 */
export async function createTelegramDestinationAction(
  _prev: AjustesActionState,
  formData: FormData,
): Promise<AjustesActionState> {
  const supabase = await createClient();
  const guard = await requireAdmin(supabase);
  if ("error" in guard) return { error: guard.error };

  const label = String(formData.get("label") ?? "").trim();
  if (!label) return { error: "Ponle un nombre al destino." };
  if (label.length > 60) return { error: "El nombre no puede pasar de 60 caracteres." };

  // Reintento por si el código choca con el índice único (8 chars, colisión
  // rarísima, pero un 23505 en la cara del usuario no se explica solo).
  for (let intento = 0; intento < 5; intento++) {
    const linkCode = generateTelegramLinkCode();
    const { error } = await supabase.from("telegram_destinations").insert({
      tenant_id: guard.tenantId,
      label,
      link_code: linkCode,
    });
    if (!error) {
      revalidatePath(ALERTAS_PATH);
      return { ok: true, linkCode };
    }
    if (error.code !== "23505") {
      console.error("[ajustes] createTelegramDestination falló:", error.message);
      return { error: "No se pudo crear el destino. Reintenta." };
    }
  }

  return { error: "No se pudo generar un código único. Reintenta." };
}

/**
 * Genera un código nuevo para un destino (para re-enlazarlo a otro chat, o si
 * el anterior se perdió). Limpia el chat: mientras no se use el código, el
 * destino queda pendiente y sus categorías caen al broadcast de admins.
 */
export async function regenerateTelegramLinkCodeAction(
  _prev: AjustesActionState,
  formData: FormData,
): Promise<AjustesActionState> {
  const supabase = await createClient();
  const guard = await requireAdmin(supabase);
  if ("error" in guard) return { error: guard.error };

  const destinationId = String(formData.get("destination_id") ?? "");
  if (!destinationId) return { error: "Falta el destino." };

  for (let intento = 0; intento < 5; intento++) {
    const linkCode = generateTelegramLinkCode();
    const { error } = await supabase
      .from("telegram_destinations")
      .update({
        link_code: linkCode,
        chat_id: null,
        linked_at: null,
        telegram_username: null,
      })
      .eq("id", destinationId)
      .eq("tenant_id", guard.tenantId);
    if (!error) {
      revalidatePath(ALERTAS_PATH);
      return { ok: true, linkCode };
    }
    if (error.code !== "23505") {
      console.error("[ajustes] regenerateTelegramLinkCode falló:", error.message);
      return { error: "No se pudo generar el código. Reintenta." };
    }
  }

  return { error: "No se pudo generar un código único. Reintenta." };
}

/**
 * Enciende o apaga una categoría para un destino. Insert/delete de la fila de
 * ruta — no hay estado intermedio que sincronizar.
 */
export async function toggleTelegramRouteAction(
  _prev: AjustesActionState,
  formData: FormData,
): Promise<AjustesActionState> {
  const supabase = await createClient();
  const guard = await requireAdmin(supabase);
  if ("error" in guard) return { error: guard.error };

  const destinationId = String(formData.get("destination_id") ?? "");
  const category = String(formData.get("category") ?? "");
  const enable = String(formData.get("enable") ?? "") === "1";

  if (!destinationId) return { error: "Falta el destino." };
  if (!isCategory(category)) return { error: "Esa categoría de aviso no existe." };

  if (enable) {
    const { error } = await supabase.from("telegram_alert_routes").insert({
      tenant_id: guard.tenantId,
      category,
      destination_id: destinationId,
    });
    // 23505 = ya estaba encendida. El resultado que pidió el usuario ya se
    // cumple, así que no es un error que mostrarle.
    if (error && error.code !== "23505") {
      console.error("[ajustes] toggleTelegramRoute insert falló:", error.message);
      return { error: "No se pudo encender esa categoría." };
    }
  } else {
    const { error } = await supabase
      .from("telegram_alert_routes")
      .delete()
      .eq("tenant_id", guard.tenantId)
      .eq("destination_id", destinationId)
      .eq("category", category);
    if (error) {
      console.error("[ajustes] toggleTelegramRoute delete falló:", error.message);
      return { error: "No se pudo apagar esa categoría." };
    }
  }

  revalidatePath(ALERTAS_PATH);
  return { ok: true };
}

/**
 * Borra un destino. Sus rutas se van con él (`on delete cascade`), así que las
 * categorías que sólo apuntaban acá vuelven al broadcast de admins.
 */
export async function deleteTelegramDestinationAction(
  _prev: AjustesActionState,
  formData: FormData,
): Promise<AjustesActionState> {
  const supabase = await createClient();
  const guard = await requireAdmin(supabase);
  if ("error" in guard) return { error: guard.error };

  const destinationId = String(formData.get("destination_id") ?? "");
  if (!destinationId) return { error: "Falta el destino." };

  const { error } = await supabase
    .from("telegram_destinations")
    .delete()
    .eq("id", destinationId)
    .eq("tenant_id", guard.tenantId);

  if (error) {
    console.error("[ajustes] deleteTelegramDestination falló:", error.message);
    return { error: "No se pudo borrar el destino." };
  }

  revalidatePath(ALERTAS_PATH);
  return { ok: true };
}
