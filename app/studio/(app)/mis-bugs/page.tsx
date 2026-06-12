/**
 * /studio/mis-bugs · "Mis reportes" del reportador (SDD-0036 Fase 2).
 *
 * Server component. Lista bugs del user logueado con timeline visual.
 * Si el caller es admin, muestra los suyos igual (admin usa /studio/bugs
 * para vista tenant-wide).
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import {
  computeReporterBugSummary,
  listBugsForReporter,
} from "@/lib/studio/bug-queries";
import { BugCard } from "./_components/BugCard";
import {
  BUG_STATE_LABELS,
  type BugState,
} from "@/lib/studio/bug-types";

export const metadata = { title: "Mis reportes · DTD Studio" };
export const dynamic = "force-dynamic";

const KPI_STATES: BugState[] = ["nuevo", "triaje", "espera", "progreso", "resuelto"];

export default async function MisBugsPage() {
  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) redirect("/studio/login");

  const [bugs, summary] = await Promise.all([
    listBugsForReporter(supabase, userResp.user.id),
    computeReporterBugSummary(supabase, userResp.user.id),
  ]);

  return (
    <div style={{ maxWidth: 1080 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <span className="studio-eyebrow">Sistema · Reporter</span>
        <h1
          className="studio-display"
          style={{ fontSize: 30, margin: "8px 0 8px", color: "var(--ink)" }}
        >
          Mis reportes
        </h1>
        <p
          style={{
            font: "400 13px/1.4 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
            maxWidth: "76ch",
          }}
        >
          Bugs, mejoras y sugerencias que reportaste. Cuando un admin avance, te
          avisamos por la campanita. Para reportar uno nuevo usa el botón flotante.
        </p>
      </div>

      {/* Summary chips */}
      {summary.total > 0 && (
        <div
          style={{
            display: "flex",
            gap: "var(--s-3, 12px)",
            flexWrap: "wrap",
            marginBottom: 24,
          }}
        >
          <SummaryChip label="Total" count={summary.total} accent="ink" />
          {KPI_STATES.map((s) =>
            summary.byState[s] > 0 ? (
              <SummaryChip
                key={s}
                label={BUG_STATE_LABELS[s]}
                count={summary.byState[s]}
                accent={s === "resuelto" ? "success" : s === "progreso" ? "info" : "neutral"}
              />
            ) : null,
          )}
        </div>
      )}

      {/* Cards */}
      {bugs.length === 0 ? (
        <EmptyState
          eyebrow="Sin reportes"
          title="Todavía no reportaste nada"
          description={
            <>
              Cuando encuentres algo raro, usa el botón rojo flotante abajo a la
              derecha para mandarnos un reporte. Nosotros te respondemos.
            </>
          }
        />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
            gap: "var(--s-4, 16px)",
          }}
        >
          {bugs.map((bug) => (
            <Link
              key={bug.id}
              href={`/studio/mis-bugs/${bug.id}`}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <BugCard bug={bug} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryChip({
  label,
  count,
  accent,
}: {
  label: string;
  count: number;
  accent: "ink" | "success" | "info" | "neutral";
}) {
  const colorMap: Record<typeof accent, { bg: string; fg: string }> = {
    ink: { bg: "var(--ink)", fg: "var(--ink-inv, #FBFAF7)" },
    success: { bg: "var(--success-bg, #E5F4ED)", fg: "var(--success, #1F8A5B)" },
    info: { bg: "var(--info-bg, #E5EEF9)", fg: "var(--info, #2A6FDB)" },
    neutral: { bg: "var(--neutral-bg, #F2F0EC)", fg: "var(--ink-soft, #6B6B6B)" },
  };
  const c = colorMap[accent];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 12px",
        background: c.bg,
        color: c.fg,
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 500,
      }}
    >
      <span>{label}</span>
      <strong
        style={{
          fontFamily: "var(--font-archivo-black, 'Archivo Black')",
          fontSize: 13,
        }}
      >
        {count}
      </strong>
    </span>
  );
}
