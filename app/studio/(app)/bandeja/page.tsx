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
 *
 * SDD-0655: la Bandeja es una pestaña de CRM. Esta ruta se queda (sus cabeceras
 * y los `?c=N` ya entregados apuntan aquí). Las pestañas del CRM llevan Embudos
 * solo si quien mira ve el módulo `kommo`. «Agentes vinculados» se mudó a
 * Usuarios › Bandeja; al admin le queda el enlace.
 * SDD-0680 (variante C): sin la cabecera grande del CRM. Las pestañas van en la
 * fila de la Bandeja, junto al estado y las acciones (`BandejaClient`).
 */
import { cookies } from "next/headers";

import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { getStudioAccess } from "@/lib/studio/rbac-guard";
import { listFeatureFlags } from "@/lib/studio/feature-flags-queries";
import { accesoCrm, RUTA_AGENTES_VINCULADOS } from "@/lib/studio/crm-acceso";
import { chatwootConfig } from "@/lib/studio/chatwoot/config";
import { resumenPortal, type ResumenPortal } from "@/lib/studio/chatwoot/portal";
import { getVinculoPropio } from "@/lib/studio/chatwoot/links-queries";
import { listEventosDescartados, type EventoDescartado } from "@/lib/studio/chatwoot/conversations-queries";
import { parseChatwootUserId, urlPanel } from "@/lib/studio/chatwoot/chatwoot-types";
import { SSO_COOKIE, ssoVigentePara } from "@/lib/studio/chatwoot/sso-cookie";
import { CrmPestanas } from "../crm/_components/CrmPestanas";
import { pestanasCrm } from "../crm/_components/kommo-tabs.shared";
import { BandejaClient, type BandejaEstado } from "./_components/BandejaClient";

export const metadata = { title: "Bandeja · CRM" };

export default async function BandejaPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string | string[] }>;
}) {
  const { c } = await searchParams;
  const conversacion = parseChatwootUserId(Array.isArray(c) ? c[0] : c);
  const supabase = await createClient();
  const [access, flags] = await Promise.all([getStudioAccess(supabase), listFeatureFlags(supabase)]);
  // El layout ya exigió rol + flag de la Bandeja; aquí solo se decide si se pinta Embudos.
  const { embudos } = accesoCrm(access.role, flags, access.overrides, access.grants);
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
    descartados: EventoDescartado[];
    portal: ResumenPortal | null;
    agentesHref: string;
  } | null = null;
  if (access.role === "admin" && access.tenantId && cfg) {
    const [descartados, portal] = await Promise.all([
      listEventosDescartados(supabase, access.tenantId),
      // SDD-0586 (10.5, PR 1b): la cola del portal es solo de service_role; el gate de admin es el de arriba.
      resumenPortal(createAdminClient(), access.tenantId),
    ]);
    admin = { descartados, portal, agentesHref: RUTA_AGENTES_VINCULADOS };
  }

  return (
    // Sin `maxWidth`: el panel del chat usa todo el ancho (`data-ancho-completo` en la sección).
    <BandejaClient
      estado={estado}
      panelUrl={panelUrl}
      inicioUrl={inicioUrl}
      conversacion={conversacion}
      pestanas={<CrmPestanas pestanas={pestanasCrm({ embudos, bandeja: true })} activa="bandeja" compacta />}
      admin={admin}
    />
  );
}
