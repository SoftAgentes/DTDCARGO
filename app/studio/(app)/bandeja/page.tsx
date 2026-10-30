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
import { getStudioAccess } from "@/lib/studio/rbac-guard";
import { chatwootConfig } from "@/lib/studio/chatwoot/config";
import { getVinculoPropio, listVinculos } from "@/lib/studio/chatwoot/links-queries";
import { parseChatwootUserId, urlPanel } from "@/lib/studio/chatwoot/chatwoot-types";
import { SSO_COOKIE, ssoVigentePara } from "@/lib/studio/chatwoot/sso-cookie";
import { listMembers } from "@/lib/studio/user-queries";
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

  let admin: { vinculos: VinculoFila[]; miembros: MiembroOpcion[] } | null = null;
  if (access.role === "admin" && access.tenantId && cfg) {
    const [vinculos, miembros] = await Promise.all([
      listVinculos(supabase, access.tenantId),
      listMembers(supabase, { tenantId: access.tenantId }),
    ]);
    const nombres = new Map(miembros.map((m) => [m.user_id, nombreDe(m.profile)]));
    admin = {
      vinculos: vinculos.map((v) => ({
        userId: v.user_id,
        nombre: nombres.get(v.user_id) || v.user_id.slice(0, 8),
        chatwootUserId: v.chatwoot_user_id,
      })),
      miembros: miembros
        .filter((m) => !vinculos.some((v) => v.user_id === m.user_id))
        .map((m) => ({ userId: m.user_id, nombre: nombreDe(m.profile) || m.user_id.slice(0, 8) })),
    };
  }

  return (
    <BandejaClient estado={estado} panelUrl={panelUrl} inicioUrl={inicioUrl} conversacion={conversacion} admin={admin} />
  );
}
