/**
 * Rendiciones · Rendición quincenal a la Operadora (SDD-0069).
 *
 * Server component, ADMIN-ONLY (decisión #9, patrón direccion/legal):
 *   1. Auth + verifica rol `admin` (no-admin → redirect /studio/dashboard).
 *   2. Resuelve el mes navegable (?month=YYYY-MM) → sus 2 quincenas.
 *   3. Calcula el PREVIEW EN VIVO de cada quincena (decisión #5, NO persiste) +
 *      lista el historial de rendiciones del tenant.
 *   4. Delega la UI a RendicionesClient (quincenas del mes + preview + emitir +
 *      historial + anular).
 *
 * La rendición es un snapshot inmutable: el preview se recalcula en cada carga;
 * emitir lo congela. NUNCA nombra "Canopy" — solo "la Operadora" (handoff §1).
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import {
  formatMonthLabel,
  formatMonthParam,
  nextMonth,
  parseMonthParam,
  prevMonth,
} from "@/lib/studio/calendar-helpers";
import {
  quincenaLabel,
  quincenasOfMonth,
} from "@/lib/studio/renditions/period";
import {
  listRenditions,
  previewRendition,
} from "@/lib/studio/renditions/queries";
import type { RenditionPreview } from "@/lib/studio/renditions/types";
import { RendicionesClient } from "./_components/RendicionesClient";

export const metadata = { title: "Rendiciones · Operadora · DTD Studio" };
export const dynamic = "force-dynamic";

export type QuincenaCard = {
  label: string;
  half: 1 | 2;
  from: string;
  to: string;
  preview: RenditionPreview;
};

export default async function RendicionesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
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
        description="Pídele a un admin que te agregue al equipo."
      />
    );
  }

  // Admin-only (decisión #9): la rendición es compliance del mandato.
  if (link.role !== "admin") {
    redirect("/studio/dashboard");
  }

  const { month } = await searchParams;
  const cursor = parseMonthParam(month);

  // Las 2 quincenas del mes + su preview en vivo (decisión #5).
  const quincenas = quincenasOfMonth(cursor.year, cursor.month);
  const cards: QuincenaCard[] = await Promise.all(
    quincenas.map(async (q) => ({
      label: quincenaLabel(q.year, q.month, q.half),
      half: q.half,
      from: q.from,
      to: q.to,
      preview: await previewRendition(supabase, { from: q.from, to: q.to }),
    })),
  );

  const renditions = await listRenditions(supabase);

  return (
    <RendicionesClient
      monthLabel={formatMonthLabel(cursor)}
      prevMonthParam={formatMonthParam(prevMonth(cursor))}
      nextMonthParam={formatMonthParam(nextMonth(cursor))}
      cards={cards}
      renditions={renditions}
    />
  );
}
