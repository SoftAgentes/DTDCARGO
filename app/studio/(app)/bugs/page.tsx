/**
 * /studio/bugs · Bug Tracker admin (SDD-0036 Fase 3).
 *
 * Server component:
 *  1. Auth + verifica role admin (si no, redirige a /mis-bugs).
 *  2. Parse filters de query params.
 *  3. Fetch bugs · KPIs · reporter profiles map.
 *  4. Render BugsAdminClient (tabs Kanban/Tabla/Stats · filtros · drawer).
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import {
  computeBugAdminKpis,
  countStaleBugs,
  listBugsForAdmin,
} from "@/lib/studio/bug-queries";
import { parseBugAdminFilters, type ReporterProfile } from "@/lib/studio/bug-types";
import { BugsAdminClient } from "./_components/BugsAdminClient";
import { requireModuleView } from "@/lib/studio/rbac-guard";

const STALE_DAYS = 7;

export const metadata = { title: "Bug Tracker · DTD Studio" };
export const dynamic = "force-dynamic";

type SearchParams = { [key: string]: string | string[] | undefined };

export default async function BugsAdminPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  // SDD-0624: el gate va también en la página, no sólo en el layout: un
  // layout compartido no se vuelve a ejecutar en la navegación parcial.
  await requireModuleView("bugs");

  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) redirect("/studio/login");

  // Solo admin del tenant
  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id, role")
    .maybeSingle<{ tenant_id: string; role: string }>();

  if (!link?.tenant_id) {
    return (
      <EmptyState
        eyebrow="Sin tenant"
        title="Tu cuenta no está vinculada a ningún tenant"
        description="Pediles a un admin que te agregue al equipo."
      />
    );
  }

  if (link.role !== "admin") {
    redirect("/studio/mis-bugs");
  }

  const params = await searchParams;
  const filters = parseBugAdminFilters(params);

  const [bugs, kpis, staleCount] = await Promise.all([
    listBugsForAdmin(supabase, filters),
    computeBugAdminKpis(supabase),
    countStaleBugs(supabase, STALE_DAYS),
  ]);

  // Reporter profiles para mostrar nombre en cards/tabla
  const reporterIds = Array.from(new Set(bugs.map((b) => b.reporter_id)));
  let reporterMap: Record<string, ReporterProfile> = {};
  if (reporterIds.length > 0) {
    const { data: profiles } = await supabase
      .from("user_profiles")
      .select("user_id, first_name, last_name")
      .in("user_id", reporterIds);
    const list = (profiles as Array<{
      user_id: string;
      first_name: string | null;
      last_name: string | null;
    }> | null) ?? [];
    reporterMap = Object.fromEntries(
      list.map((p) => [
        p.user_id,
        {
          user_id: p.user_id,
          first_name: p.first_name,
          last_name: p.last_name,
          email: null,
        } as ReporterProfile,
      ]),
    );
  }

  // Lista única de módulos para filtro
  const modulesSet = new Set<string>();
  for (const b of bugs) modulesSet.add(b.module);
  const moduleList = Array.from(modulesSet).sort();

  return (
    <div style={{ maxWidth: 1480 }}>
      <div style={{ marginBottom: 24 }}>
        <span className="studio-eyebrow">Sistema · Soporte interno</span>
        <h1
          className="studio-display"
          style={{ fontSize: 30, margin: "8px 0 8px", color: "var(--ink)" }}
        >
          Bug Tracker
        </h1>
        <p
          style={{
            font: "400 13px/1.4 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
            maxWidth: "76ch",
          }}
        >
          Bugs, mejoras y sugerencias reportados desde el FAB del Studio.
          Toma uno desde el Kanban, conversa con quien lo reportó, usa
          “Copiar prompt” para asistirte con Claude Code en otra ventana, y
          cuando aplicaste el fix marca el bug como resuelto tú mismo desde
          el drawer. Convención de commit:{" "}
          <code
            style={{
              fontFamily: "var(--font-mono, 'JetBrains Mono')",
              fontSize: 12,
              color: "var(--wine-text)",
              padding: "2px 6px",
              background: "var(--wine-tint, #FBE9EC)",
              borderRadius: 4,
            }}
          >
            fix: BUG-XXXXX
          </code>{" "}
          (sólo trazabilidad, no dispara nada).
        </p>
      </div>

      <BugsAdminClient
        bugs={bugs}
        kpis={kpis}
        filters={filters}
        reporterMap={reporterMap}
        moduleList={moduleList}
        currentUserId={userResp.user.id}
        staleCount={staleCount}
        staleDays={STALE_DAYS}
      />
    </div>
  );
}
