/**
 * /studio/bandeja — Bandeja de Chatwoot dentro de Studio (SDD-0585, paso 2.2).
 *
 * El gate (rol + flag `chatwoot_inbox`) está en `layout.tsx`. Acá se decide el
 * estado de la página y desde dónde arranca el iframe:
 *   - sin token o sin cuenta → «sin configurar»;
 *   - sin vínculo → «sin agente» (y, si eres admin, el formulario de vínculos);
 *   - con vínculo y la marca `dtd_cw_sso` de este usuario → el panel, sin SSO;
 *   - con vínculo y sin marca → el cliente pide el enlace de un solo uso.
 * `?c=N` (desde la ficha o el aviso push) abre esa conversación (E2-D24).
 * Las cabeceras (`frame-src`, micrófono delegado) las pone `next.config.ts`.
 */
import { cookies } from "next/headers";

import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { getStudioAccess } from "@/lib/studio/rbac-guard";
import { chatwootConfig, chatwootServicioUserId } from "@/lib/studio/chatwoot/config";
import { listarMiembrosCuenta } from "@/lib/studio/chatwoot/platform-api";
import { evaluarSalud, type SaludBandeja } from "@/lib/studio/chatwoot/agentes-salud";
import { revisarWebhookCuenta, sumarAlertasWebhook } from "@/lib/studio/chatwoot/webhook-salud";
import { resumenPortal, type ResumenPortal } from "@/lib/studio/chatwoot/portal";
import { getVinculoPropio, listVinculos } from "@/lib/studio/chatwoot/links-queries";
import { listEventosDescartados, type EventoDescartado } from "@/lib/studio/chatwoot/conversations-queries";
import { parseChatwootUserId, urlPanel } from "@/lib/studio/chatwoot/chatwoot-types";
import { SSO_COOKIE, ssoVigentePara } from "@/lib/studio/chatwoot/sso-cookie";
import { listMembers } from "@/lib/studio/user-queries";
import { canAccessModule } from "@/lib/studio/rbac";
import { BandejaClient, type BandejaEstado } from "./_components/BandejaClient";
import type { MiembroOpcion, VinculoFila } from "./_components/VinculosAdmin";

export const metadata = { title: "Bandeja · DTD Studio" };

function nombreDe(profile: { first_name: string | null; last_name: string | null } | null): string {
  return `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim();
}

export default async function BandejaPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string | string[] }>;
}) {
  const { c } = await searchParams;
  const conversacion = parseChatwootUserId(Array.isArray(c) ? c[0] : c);
  const supabase = await createClient();
  const access = await getStudioAccess(supabase);
  const cfg = chatwootConfig();
  const vinculo =
    cfg && access.tenantId && access.userId
      ? await getVinculoPropio(supabase, access.tenantId, access.userId)
      : null;

  const estado: BandejaEstado = !cfg ? "sin_configurar" : !vinculo ? "sin_vinculo" : "listo";
  const panelUrl = cfg
    ? conversacion !== null
      ? `${cfg.origin}/app/accounts/${cfg.accountId}/conversations/${conversacion}`
      : urlPanel(cfg.origin, cfg.accountId)
    : null;
  const marca = (await cookies()).get(SSO_COOKIE)?.value;
  const inicioUrl =
    estado === "listo" && access.userId && ssoVigentePara(marca, access.userId) ? panelUrl : null;

  let admin: {
    vinculos: VinculoFila[];
    miembros: MiembroOpcion[];
    descartados: EventoDescartado[];
    salud: SaludBandeja;
    portal: ResumenPortal | null;
  } | null = null;
  if (access.role === "admin" && access.tenantId && cfg) {
    const [vinculos, miembros, descartados, cuenta, webhook, portal] = await Promise.all([
      listVinculos(supabase, access.tenantId),
      listMembers(supabase, { tenantId: access.tenantId }),
      listEventosDescartados(supabase, access.tenantId),
      listarMiembrosCuenta(cfg),
      revisarWebhookCuenta(cfg, chatwootServicioUserId()),
      // SDD-0586 (10.5, PR 1b): la cola del portal es solo de service_role; el gate de admin es el de arriba.
      resumenPortal(createAdminClient(), access.tenantId),
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
    admin = {
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
      descartados,
      salud,
      portal,
    };
  }

  return (
    <BandejaClient estado={estado} panelUrl={panelUrl} inicioUrl={inicioUrl} conversacion={conversacion} admin={admin} />
  );
}
