import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ChatwootConfig } from "./config";
import { borrarUsuario, listarMiembrosCuenta } from "./platform-api";

/**
 * Purga por plazo de la Bandeja (SDD-0585, paso 2.7), en el cron
 * `chatwoot-reintentos`, con el patrón de E10 (`purgarEnrutamientoChatwoot`).
 * Plazos: propuesta del Director del 2026-10-30, sin objeción de Sam.
 *
 *  - `purgarBandejaChatwoot`: eventos del webhook «procesado» y «descartado» de
 *    más de 90 días, y conversaciones sin actividad en 12 meses (0508,
 *    `chatwoot_purgar_bandeja`).
 *  - `purgarBajasVencidas`: borra de Chatwoot el usuario de un agente dado de
 *    baja hace más de 12 meses (0508, `chatwoot_bajas_vencidas`). Candados: nunca
 *    el usuario de servicio, nunca uno que esté en la cuenta o tenga un vínculo
 *    (alguien lo volvió a dar de alta). Sin la lista de la cuenta no se borra nadie.
 *
 * Sin la 0508 las dos responden `omitido`. Nunca lanzan. Los logs llevan códigos.
 */

const FUNCION_AUSENTE = new Set(["PGRST202", "42883", "PGRST205", "42P01"]);

export type ResultadoPurgaBandeja = { eventos: number; conversaciones: number } | { omitido: true };

export async function purgarBandejaChatwoot(admin: SupabaseClient): Promise<ResultadoPurgaBandeja> {
  const { data, error } = await admin.rpc("chatwoot_purgar_bandeja");
  if (error) {
    if (!FUNCION_AUSENTE.has(error.code ?? "")) console.warn(`[chatwoot-purga] bandeja: ${error.code ?? "sin código"}`);
    return { omitido: true };
  }
  const fila = (Array.isArray(data) ? data[0] : data) as { eventos?: unknown; conversaciones?: unknown } | null;
  return { eventos: Number(fila?.eventos ?? 0), conversaciones: Number(fila?.conversaciones ?? 0) };
}

export type ResultadoPurgaBajas =
  | { borrados: number; conservados: number; ajenos: number; fallidos: number }
  | { omitido: true };

export async function purgarBajasVencidas(
  admin: SupabaseClient,
  cfg: ChatwootConfig | null,
  servicioId: number | null,
): Promise<ResultadoPurgaBajas> {
  if (!cfg) return { omitido: true };
  const { data, error } = await admin.rpc("chatwoot_bajas_vencidas");
  if (error) {
    if (!FUNCION_AUSENTE.has(error.code ?? "")) console.warn(`[chatwoot-purga] bajas: ${error.code ?? "sin código"}`);
    return { omitido: true };
  }
  const vencidas = ((data ?? []) as { tenant_id: string; chatwoot_user_id: number }[]).filter(
    (v) => Number.isInteger(v.chatwoot_user_id) && v.chatwoot_user_id > 0,
  );
  const resultado = { borrados: 0, conservados: 0, ajenos: 0, fallidos: 0 };
  if (vencidas.length === 0) return resultado;

  const cuenta = await listarMiembrosCuenta(cfg);
  const ids = vencidas.map((v) => v.chatwoot_user_id);
  const { data: vinculos, error: errorVinculos } = await admin
    .from("chatwoot_agent_links")
    .select("chatwoot_user_id")
    .in("chatwoot_user_id", ids);
  if (!cuenta.ok || errorVinculos) {
    console.warn(`[chatwoot-purga] bajas sin comprobar: ${cuenta.ok ? (errorVinculos?.code ?? "sin código") : cuenta.error}`);
    resultado.fallidos = vencidas.length;
    return resultado;
  }
  const enCuenta = new Set(cuenta.data.map((m) => m.userId));
  const vinculados = new Set(((vinculos ?? []) as { chatwoot_user_id: number }[]).map((v) => v.chatwoot_user_id));

  for (const v of vencidas) {
    const id = v.chatwoot_user_id;
    if (id === servicioId || enCuenta.has(id) || vinculados.has(id)) {
      // Volvió a la cuenta o a Studio: la baja ya no vale.
      await borrarFila(admin, v.tenant_id, id);
      resultado.conservados += 1;
      continue;
    }
    const r = await borrarUsuario(id, cfg);
    if (!r.ok && r.error === "no_autorizado") {
      // No lo creó la Platform App (vínculo manual a un usuario ajeno): Studio no
      // lo puede borrar. Se borra a mano desde el superadmin (runbook de agentes).
      await borrarFila(admin, v.tenant_id, id);
      resultado.ajenos += 1;
      continue;
    }
    if (!r.ok && r.error !== "no_encontrado") {
      console.warn(`[chatwoot-purga] no se pudo borrar el usuario: ${r.error}`);
      resultado.fallidos += 1;
      continue;
    }
    await borrarFila(admin, v.tenant_id, id);
    resultado.borrados += 1;
  }
  return resultado;
}

async function borrarFila(admin: SupabaseClient, tenantId: string, chatwootUserId: number): Promise<void> {
  const { error } = await admin
    .from("chatwoot_agent_bajas")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("chatwoot_user_id", chatwootUserId);
  if (error) console.warn(`[chatwoot-purga] no se pudo borrar la fila de la baja: ${error.code ?? "sin código"}`);
}
