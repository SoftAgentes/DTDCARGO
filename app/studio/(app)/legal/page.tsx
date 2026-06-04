/**
 * Legal · Aceptaciones T&C (SDD-0054 · Slice B) — repositorio versionado de
 * documentos legales + bitácora de aceptaciones inmutables.
 *
 * Server component, READ-ONLY, ADMIN-ONLY:
 *   1. Auth + verifica rol `admin` (no-admin → redirect /studio/dashboard),
 *      mismo patrón que /studio/direccion y /studio/usuarios.
 *   2. Fetchea TODOS los docs (vigente + archivada), las aceptaciones y los
 *      docs vigentes de cara al cliente (para marcar "stale" en la bitácora).
 *   3. Computa KPIs (total, este mes, en versión vigente).
 *   4. Delega la UI a LegalClient (tabs Documentos + Aceptaciones).
 *
 * Read-only: NO publica versiones nuevas en este slice (futuro). El botón "Ver"
 * sí (lee el body del doc). El registro real de aceptaciones lo produce Slice C.
 *
 * Diseño de referencia: docs/design/studio/_norte/erp/modules/admin-legal.jsx
 * (adaptado a primitivas reales del Studio + a los datos que existen).
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { listLegalDocs, listAcceptances } from "@/lib/studio/legal/queries";
import type { DocRef } from "@/lib/studio/legal/types";
import { LegalClient } from "./_components/LegalClient";

export const metadata = { title: "Legal · Aceptaciones T&C · DTD Studio" };
export const dynamic = "force-dynamic";

export default async function LegalPage() {
  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) redirect("/studio/login");

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

  // Admin-only (la capa legal es compliance del dueño).
  if (link.role !== "admin") {
    redirect("/studio/dashboard");
  }

  const [docs, acceptances] = await Promise.all([
    listLegalDocs(supabase, link.tenant_id),
    listAcceptances(supabase),
  ]);

  // Versiones vigentes de cara al cliente → para marcar "stale" una aceptación
  // cuya versión de doc ya no es la vigente (re-versión ⇒ re-aceptación).
  const currentVersions = new Map<string, string>(
    docs
      .filter((d) => d.status === "vigente" && d.audience === "cliente")
      .map((d) => [d.key, d.version]),
  );

  const onCurrent = (refs: DocRef[]): boolean =>
    refs.length > 0 &&
    refs.every((r) => currentVersions.get(r.key) === r.version);

  // KPIs de la bitácora.
  const now = new Date();
  const thisMonthPrefix = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const total = acceptances.length;
  const thisMonth = acceptances.filter((a) =>
    (a.accepted_at ?? "").startsWith(thisMonthPrefix),
  ).length;
  const onCurrentCount = acceptances.filter((a) => onCurrent(a.docs)).length;

  return (
    <LegalClient
      docs={docs}
      acceptances={acceptances}
      currentVersions={Object.fromEntries(currentVersions)}
      kpis={{ total, thisMonth, onCurrent: onCurrentCount }}
    />
  );
}
