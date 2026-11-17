/**
 * Datos de «Agentes vinculados» (SDD-0585, E2-D10 y paso 2.5) para Usuarios ›
 * Bandeja (SDD-0655). Es la misma lectura que hacía `bandeja/page.tsx` para el
 * admin, mudada sin cambios de lógica: vínculos del tenant, miembros sin
 * vínculo (con si ven la Bandeja) y la salud de la cuenta de Chatwoot.
 *
 * Solo admin: devuelve `null` a cualquier otro rol, sin tenant o sin la
 * Bandeja configurada. La lista de miembros va con el cliente admin (la RLS de
 * `user_tenants` deja ver una sola fila con la sesión), filtrada por el tenant
 * del admin, como antes.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { StudioAccess } from "@/lib/studio/rbac-guard";
import { canAccessModule } from "@/lib/studio/rbac";
import { chatwootConfig, chatwootServicioUserId } from "./config";
import { listarMiembrosCuenta } from "./platform-api";
import { evaluarSalud, type SaludBandeja } from "./agentes-salud";
import { revisarWebhookCuenta, sumarAlertasWebhook } from "./webhook-salud";
import { listVinculos } from "./links-queries";
import { miembrosDeBandeja } from "./bandeja-miembros";

export interface VinculoFila {
  userId: string;
  nombre: string;
  chatwootUserId: number;
}

export interface MiembroOpcion {
  userId: string;
  nombre: string;
  /** Paso 2.5: solo quien ve la Bandeja se puede dar de alta. Sin dato, se ofrece. */
  puedeBandeja?: boolean;
}

export interface AgentesBandejaDatos {
  vinculos: VinculoFila[];
  miembros: MiembroOpcion[];
  salud: SaludBandeja;
}

function nombreDe(profile: { first_name: string | null; last_name: string | null } | null): string {
  return `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim();
}

export async function cargarAgentesBandeja(
  supabase: SupabaseClient,
  access: Pick<StudioAccess, "role" | "tenantId" | "overrides">,
  crearClienteAdmin: () => SupabaseClient,
): Promise<AgentesBandejaDatos | null> {
  const cfg = chatwootConfig();
  if (access.role !== "admin" || !access.tenantId || !cfg) return null;
  const tenantId = access.tenantId;

  const [vinculos, miembros, cuenta, webhook] = await Promise.all([
    listVinculos(supabase, tenantId),
    miembrosDeBandeja(access, crearClienteAdmin),
    listarMiembrosCuenta(cfg),
    revisarWebhookCuenta(cfg, chatwootServicioUserId()),
  ]);
  // Paso 2.5: la misma salud que mide el cron diario, leída al abrir la página.
  const salud = evaluarSalud({
    miembrosCuenta: cuenta,
    servicioId: chatwootServicioUserId(),
    vinculos: vinculos.map((v) => ({ userId: v.user_id, chatwootUserId: v.chatwoot_user_id })),
  });
  // SDD-0586 (10.5, PR 1b): el webhook de cuenta, por donde llegan las respuestas al portal.
  sumarAlertasWebhook(salud, webhook);

  const nombres = new Map(miembros.map((m) => [m.user_id, nombreDe(m.profile)]));
  return {
    vinculos: vinculos.map((v) => ({
      userId: v.user_id,
      nombre: nombres.get(v.user_id) || v.user_id.slice(0, 8),
      chatwootUserId: v.chatwoot_user_id,
    })),
    miembros: miembros
      .filter((m) => !vinculos.some((v) => v.user_id === m.user_id))
      .map((m) => ({
        userId: m.user_id,
        nombre: nombreDe(m.profile) || m.user_id.slice(0, 8),
        puedeBandeja: canAccessModule(m.role, "bandeja", access.overrides),
      })),
    salud,
  };
}
