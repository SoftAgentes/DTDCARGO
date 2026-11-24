"use server";

/**
 * Vista y tema guardados en la cuenta (SDD-0714, opción B de Sam).
 *
 * Se escriben en `user_metadata.studio_apariencia` de la propia persona con
 * `auth.updateUser({ data })`: GoTrue mezcla las claves de `data`, así que las
 * demás claves del metadata no se tocan. Sin migración y sin tabla nueva.
 *
 * `user_metadata` lo puede escribir la propia persona, así que aquí solo van gustos
 * de pantalla; nada decide acceso con esta clave. La forma se valida contra el
 * catálogo y lo demás se rechaza sin escribir.
 *
 * Sin `revalidatePath`: el cambio ya está aplicado en el cliente.
 */

import { createClient } from "@/lib/db/server";
import { parseAparienciaGuardada, type AparienciaGuardada } from "@/app/studio/_components/apariencia-usuario";

export type GuardarAparienciaResultado = { ok: true } | { error: string };

export async function guardarAparienciaAction(entrada: AparienciaGuardada): Promise<GuardarAparienciaResultado> {
  const valor = parseAparienciaGuardada(entrada);
  if (!valor) return { error: "Vista o tema inválidos." };

  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) return { error: "Inicia sesión primero." };

  const { error } = await supabase.auth.updateUser({ data: { studio_apariencia: valor } });
  if (error) return { error: "No se pudo guardar en tu usuario." };
  return { ok: true };
}
