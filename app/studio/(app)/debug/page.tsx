/**
 * /studio/debug · Torre de control (SDD-0050).
 *
 * Un solo módulo con pestañas (`?tab=`, default `estado`) que junta las
 * herramientas de diagnóstico: Estado (entorno/deploys/integraciones · vivo),
 * Bugs (Bug Reporter SDD-0036 · vivo), Norte (snapshot de build · Slice B) y
 * Radar (artefacto local · Slice C). Cada pestaña declara su modo (vivo /
 * snapshot / solo local) para no mentir sobre qué funciona en la web.
 *
 * Server component: fetchea en paralelo lo de las pestañas vivas (Estado +
 * Bugs) y pasa los datos a <DebugTabs> (client), que renderiza la pestaña
 * activa según `searchParams.tab`. NUNCA muestra valores de env vars, solo
 * nombres.
 */

import type { Metadata } from "next";
import { createClient } from "@/lib/db/server";
import { getEnvStatus } from "@/lib/studio/env-status";
import { listRecentDeploys } from "@/lib/studio/vercel-deploys";
import {
  checkAllIntegrations,
  fetchRemoteHealth,
  type FetchRemoteResult,
} from "@/lib/studio/integration-health";
import { listBugsForAdmin } from "@/lib/studio/bug-queries";
import { parseBugAdminFilters, type BugReport } from "@/lib/studio/bug-types";
import { DebugTabs, resolveDebugTab } from "./_components/DebugTabs";
import { EstadoTab } from "./_components/EstadoTab";
import { BugsTab } from "./_components/BugsTab";

export const metadata: Metadata = {
  title: "Torre de control",
};

export const dynamic = "force-dynamic";

type SearchParams = { [key: string]: string | string[] | undefined };

export default async function DebugPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const tabRaw = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const activeTab = resolveDebugTab(tabRaw);

  const s = getEnvStatus();
  const isProd = s.env === "production";
  // En local/preview además fetcheamos el estado real de producción
  // para poder comparar "lo que veo acá" vs "lo que ven los usuarios reales".
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dtdcargo.com";

  const supabase = await createClient();

  // ¿El usuario es admin del tenant? (define qué bugs ve · RLS lo refuerza).
  const { data: link } = await supabase
    .from("user_tenants")
    .select("role")
    .maybeSingle<{ role: string }>();
  const isAdmin = link?.role === "admin";

  // Corremos en paralelo: deploys + health local + health prod (si no es prod)
  // + lista de bugs (read-only, ya filtrada por RLS según el caller).
  const bugsFilters = parseBugAdminFilters({ tab: "tabla" });
  const [deploysResult, healthByKey, remoteHealth, bugs] = await Promise.all([
    listRecentDeploys(10),
    checkAllIntegrations(),
    isProd
      ? Promise.resolve<FetchRemoteResult>({ ok: false, error: "skip_in_prod" })
      : fetchRemoteHealth(siteUrl),
    loadBugs(supabase, bugsFilters),
  ]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-6)" }}>
      {/* Header */}
      <div>
        <div
          className="studio-eyebrow"
          style={{ color: "var(--ink-soft)", marginBottom: "var(--s-2)" }}
        >
          Diagnóstico
        </div>
        <h1
          className="studio-display"
          style={{ fontSize: 28, margin: 0, color: "var(--ink)" }}
        >
          Torre de control
        </h1>
        <p
          style={{
            color: "var(--ink-soft)",
            fontSize: 14,
            marginTop: "var(--s-2)",
            maxWidth: 720,
          }}
        >
          Estado del entorno, integraciones, bugs y diagnóstico del proyecto en
          un solo lugar. Cada pestaña indica su modo: <strong>vivo</strong> (se
          consulta en tiempo real), <strong>snapshot</strong> (horneado en el
          build) o <strong>solo local</strong> (no corre en la web).
        </p>
      </div>

      <DebugTabs
        active={activeTab}
        env={s.env}
        estado={
          <EstadoTab
            status={s}
            deploysResult={deploysResult}
            healthByKey={healthByKey}
            remoteHealth={remoteHealth}
            siteUrl={siteUrl}
          />
        }
        bugs={<BugsTab bugs={bugs} isAdmin={isAdmin} />}
      />
    </div>
  );
}

/**
 * Lista de bugs para la pestaña Bugs. Reusa `listBugsForAdmin` (SDD-0036) que
 * trae los bugs del tenant ordenados por fecha; RLS filtra: el admin ve todos
 * los del tenant, el reporter solo los propios. Si la query falla (tabla no
 * migrada en local, etc.) devolvemos lista vacía para no romper la torre.
 */
async function loadBugs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  filters: ReturnType<typeof parseBugAdminFilters>,
): Promise<BugReport[]> {
  try {
    return await listBugsForAdmin(supabase, filters);
  } catch {
    return [];
  }
}
