"use server";

/**
 * Server action del enlace corto de acceso (SDD-0253).
 *
 * ⚠️ **Todo el valor de este archivo está en que sea un POST.** El robot de
 * previsualización de WhatsApp hace GET, y por eso `page.tsx` sólo lee. Acá —y
 * sólo acá— se acuña el magic-link y se quema el código. Si alguna vez se mueve
 * esta lógica al render de la página, vuelve el bug del 2026-08-09: el enlace le
 * llega muerto al cliente.
 *
 * Orden de las operaciones, a propósito: **primero se reclama el código**
 * (sellado atómico) y después se acuña. Si acuñar falla, se suelta el reclamo.
 * Al revés —acuñar y después sellar— dos toques rápidos en un teléfono lento
 * abrirían dos sesiones con el mismo código.
 */

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/db/admin";
import {
  classifyAccessLink,
  consumeAccessLink,
  loadAccessTarget,
  releaseAccessLink,
  resolveAccessLink,
} from "@/lib/studio/portal/access-link";
import { generatePortalAccessLink } from "@/lib/studio/portal-invite-email";

/**
 * Mensaje único para TODOS los modos de fallo (no existe / vencido / usado /
 * revocado / cliente borrado). Distinguirlos le confirmaría a un enumerador
 * cuáles códigos son reales.
 */
const ERROR_GENERICO =
  "Este acceso ya no está disponible. Pídele a tu asesor de DTD Cargo uno nuevo.";

export type EntrarState = { error?: string };

export async function abrirPortalAction(
  _prev: EntrarState,
  formData: FormData,
): Promise<EntrarState> {
  const code = String(formData.get("code") ?? "").trim();
  if (!code) return { error: ERROR_GENERICO };

  const admin = createAdminClient();

  const link = await resolveAccessLink(admin, code);
  if (!link) return { error: ERROR_GENERICO };
  if (classifyAccessLink(link, Date.now()) !== "ok") return { error: ERROR_GENERICO };

  const target = await loadAccessTarget(admin, link.client_id);
  if (!target?.email) return { error: ERROR_GENERICO };

  // 1. Reclamar. Si alguien llegó primero, este toque no abre nada.
  const claimed = await consumeAccessLink(admin, link.id, new Date().toISOString());
  if (!claimed) return { error: ERROR_GENERICO };

  // 2. Acuñar el magic-link RECIÉN AHORA — con el cliente del otro lado de la
  //    pantalla. Éste es el motivo por el que se acabó el TTL corto de Auth
  //    (`MAILER_OTP_EXP` = 3600 s, medido el 2026-08-21).
  const magicLink = await generatePortalAccessLink(admin, target.email);
  if (!magicLink) {
    // 3. No se pudo: se suelta el reclamo para que el cliente pueda reintentar
    //    con el mismo enlace en vez de quedarse sin puerta por un hipo de Auth.
    await releaseAccessLink(admin, link.id);
    return {
      error: "No pudimos abrir tu portal en este momento. Intenta de nuevo en un minuto.",
    };
  }

  // `redirect` lanza una excepción de control de Next → va FUERA de cualquier
  // try/catch, o se traga la navegación.
  redirect(magicLink);
}
