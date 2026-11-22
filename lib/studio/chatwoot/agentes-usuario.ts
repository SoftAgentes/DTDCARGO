import "server-only";

import { createAdminClient } from "@/lib/db/admin";
import { chatwootConfig, chatwootServicioUserId, chatwootTenantId } from "./config";
import { sincronizarAgentes } from "./agentes-ciclo";

/**
 * Baja inmediata en Chatwoot desde Usuarios (SDD-0585, paso 2.5). Usuarios la
 * llama DESPUÉS de desactivar a alguien o cambiarle el rol, ya confirmado.
 *
 * Nunca lanza y nunca cambia el resultado de Usuarios: la desactivación ya
 * ocurrió y es lo que importa; si Chatwoot falla, el cron diario
 * `chatwoot-agentes` lo reintenta. Solo mira el tenant de la cuenta de Chatwoot
 * (`CHATWOOT_TENANT_ID`): una baja en otro tenant no cambia nada acá. Sin
 * configuración de Chatwoot no hace nada.
 *
 * SDD-0675: devuelve `false` si Chatwoot quedó pendiente (no respondió, una baja
 * falló o quedó bloqueada, el cierre de sesiones o la matriz no terminaron, o
 * no se pudieron leer los accesos). Quien la llama puede avisarle al admin; el
 * resultado de Usuarios no cambia. `true` también cuando no hay Chatwoot.
 */
export async function sincronizarAgenteDeUsuario(userId: string): Promise<boolean> {
  const cfg = chatwootConfig();
  const tenantId = chatwootTenantId();
  if (!cfg || !tenantId) return true;
  try {
    const r = await sincronizarAgentes(
      { admin: createAdminClient(), tenantId, cfg, servicioId: chatwootServicioUserId() },
      { soloUsuario: userId },
    );
    if (r.fallidas > 0 || r.bloqueadas > 0) {
      console.warn(`[chatwoot-agentes] baja desde Usuarios: ${r.fallidas} fallida(s), ${r.bloqueadas} bloqueada(s)`);
    }
    return quedoAlDia(r);
  } catch {
    console.warn("[chatwoot-agentes] baja desde Usuarios: no se pudo sincronizar");
    return false;
  }
}

/** ¿La corrida dejó a Chatwoot como dice Studio? Puro, para probarlo sin red. */
export function quedoAlDia(r: Awaited<ReturnType<typeof sincronizarAgentes>>): boolean {
  if (r.omitido || r.sinEstado) return false;
  if (r.fallidas > 0 || r.bloqueadas > 0 || r.cierresPendientes > 0) return false;
  if ((r.sinBandejaEnEspera ?? 0) > 0) return false;
  if (!r.matriz || r.matriz.fallidas > 0 || r.matriz.bloqueadas > 0) return false;
  return true;
}
