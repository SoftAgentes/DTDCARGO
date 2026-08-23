"use server";

/**
 * Server action del enlace de acceso al portal (SDD-0278).
 *
 * ⚠️ **Todo el valor de este archivo está en que sea un POST.** Los escáneres de
 * correo hacen GET sobre cada enlace que reciben —Gmail lo hizo el 2026-08-21 a
 * las 17:07:55 desde `173.194.92.177`, 7 segundos después de que el cliente ya
 * hubiera entrado— y el token es de un solo uso. Por eso `page.tsx` sólo lee y
 * dibuja: acá, y sólo acá, se gasta. Si esta lógica se muda al render, el enlace
 * vuelve a llegarle muerto al cliente.
 *
 * Es el mismo patrón que `app/entrar/[code]/actions.ts` (SDD-0253), que cerró el
 * bug idéntico con el robot de previsualización de WhatsApp.
 */

import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";

/**
 * Mensaje honesto y accionable. NO dice sólo "venció", porque medimos que casi
 * nunca es eso: de los fallos de `/verify` en 24 h, cero fueron por tiempo. Las
 * dos causas reales —se usó, o se pidió otro enlace después— caben en la misma
 * frase sin mentir, y la hora es el TTL real de Auth (`MAILER_OTP_EXP` = 3600 s).
 */
const ERROR_ENLACE =
  "Este enlace ya no sirve: se usó, o pediste uno más nuevo, o pasó más de una hora desde que lo pediste. Pide otro y entra con el último que te llegue.";

export type AbrirState = { error?: string };

export async function abrirConEnlaceAction(
  _prev: AbrirState,
  formData: FormData,
): Promise<AbrirState> {
  const tokenHash = String(formData.get("token_hash") ?? "").trim();
  // Sólo `magiclink`. No se acepta el `type` crudo del query para no dejar un
  // verificador abierto a cualquier tipo de token de Auth.
  const type = String(formData.get("type") ?? "").trim();
  if (!tokenHash || type !== "magiclink") return { error: ERROR_ENLACE };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "magiclink" as EmailOtpType,
  });
  if (error) return { error: ERROR_ENLACE };

  // Vincular la sesión con su cliente (match por email). Idempotente.
  const { data } = await supabase.rpc("portal_bind_session");
  const row = (Array.isArray(data) ? data[0] : data) as
    | { client_id: string | null; bound: boolean }
    | null
    | undefined;

  // `redirect` lanza una excepción de control de Next → va FUERA de cualquier
  // try/catch, o se traga la navegación.
  if (!row?.bound) redirect("/entrar?status=nohabilitado");
  redirect("/portal");
}
