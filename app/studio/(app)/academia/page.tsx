/**
 * Academia DTD (SDD-0093) — catálogo de cursos.
 *
 * Server component: gate de rol + lee KPIs y el catálogo (queries puras).
 * UI provisional (read-only): la versión rica (editor, drawers, cohortes,
 * diplomas) llega con el diseño de Cloud Design → Norte. Slice A = "los
 * cursos y sus títulos" vivos en el ERP.
 */

import { createClient } from "@/lib/db/server";
import { requireModuleView } from "@/lib/studio/rbac-guard";
import { academiaStats, listCoursesWithCounts } from "@/lib/studio/academia/queries";
import { courseStatusLabel, courseStatusTone, tierLabel } from "@/lib/studio/academia/types";
import { KpiCard } from "@/app/studio/_components/ui/KpiCard";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { Badge } from "@/app/studio/_components/ui/Badge";

export const metadata = { title: "Academia · Formación" };

export default async function AcademiaPage() {
  await requireModuleView("academia");
  const supabase = await createClient();

  const [stats, courses] = await Promise.all([
    academiaStats(supabase),
    listCoursesWithCounts(supabase),
  ]);

  return (
    <div style={{ padding: "var(--s-6)", display: "flex", flexDirection: "column", gap: "var(--s-6)" }}>
      <header style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div className="studio-eyebrow" style={{ color: "var(--wine)" }}>Academia DTD</div>
        <h1 style={{ font: "900 24px/1.1 var(--f-display)", color: "var(--ink)", letterSpacing: "-0.01em", margin: 0 }}>
          Formación · cursos de importación
        </h1>
        <p style={{ font: "500 13.5px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: 0, maxWidth: "64ch" }}>
          El catálogo de la Academia. La gestión de contenido (módulos, lecciones, video) y el precio —que pone
          Administración— llegan con el diseño aprobado. Por ahora, los cursos y sus títulos.
        </p>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: "var(--s-4)",
        }}
      >
        <KpiCard value={stats.cursos} label="Cursos" sub="en el catálogo" />
        <KpiCard value={stats.publicados} label="Publicados" sub="visibles" valueColor="var(--success)" />
        <KpiCard value={stats.proximamente} label="Próximamente" sub="por publicar" valueColor="var(--warning)" />
        <KpiCard value={stats.cohortes} label="Cohortes" sub="en vivo" />
        <KpiCard value={stats.alumnos} label="Alumnos" sub="inscritos" />
      </div>

      {courses.length === 0 ? (
        <EmptyState
          eyebrow="Catálogo vacío"
          title="Aún no hay cursos"
          description="Corre el seed de la Academia (scripts/seed-academia.ts) para sembrar los cursos base, o crea uno cuando esté lista la gestión de contenido."
        />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "var(--s-4)",
          }}
        >
          {courses.map((c) => (
            <article
              key={c.id}
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-lg)",
                padding: "var(--s-5)",
                display: "flex",
                flexDirection: "column",
                gap: "var(--s-3)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "var(--s-2)", flexWrap: "wrap" }}>
                <Badge tone="wine" size="sm">{tierLabel(c.tier)}</Badge>
                <Badge tone={courseStatusTone(c.status)} size="sm" dot>
                  {courseStatusLabel(c.status)}
                </Badge>
              </div>
              <h2 style={{ font: "800 16px/1.25 var(--f-display)", color: "var(--ink)", margin: 0 }}>
                {c.title}
              </h2>
              {c.summary && (
                <p style={{ font: "500 12.5px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: 0 }}>
                  {c.summary}
                </p>
              )}
              <div
                style={{
                  marginTop: "auto",
                  font: "600 11.5px/1 var(--f-sans)",
                  color: "var(--ink-mute)",
                  letterSpacing: "0.02em",
                }}
              >
                {c.modules_count} módulos · {c.lessons_count} lecciones
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
