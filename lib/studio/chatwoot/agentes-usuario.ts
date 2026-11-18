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
 */
export async function sincronizarAgenteDeUsuario(userId: string): Promise<void> {
  const cfg = chatwootConfig();
  const tenantId = chatwootTenantId();
  if (!cfg || !tenantId) return;
  try {
    const r = await sincronizarAgentes(
      { admin: createAdminClient(), tenantId, cfg, servicioId: chatwootServicioUserId() },
      { soloUsuario: userId },
    );
    if (r.fallidas > 0 || r.bloqueadas > 0) {
      console.warn(`[chatwoot-agentes] baja desde Usuarios: ${r.fallidas} fallida(s), ${r.bloqueadas} bloqueada(s)`);
    }
  } catch {
    console.warn("[chatwoot-agentes] baja desde Usuarios: no se pudo sincronizar");
  }
}
