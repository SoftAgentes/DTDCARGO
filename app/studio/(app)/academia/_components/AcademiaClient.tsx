"use client";

/**
 * Orquestador client de la Academia DTD (SDD-0093, Slice B). Port del Norte
 * `academia.js` con las primitivas reales del repo (KpiCard, Badge, EmptyState,
 * DrawerShell). Solo tokens var(--*).
 *
 * Header + KPIs + 2 pestañas:
 *  - Catálogo  · las tarjetas de cursos (Slice A, ahora dentro de la pestaña).
 *  - Cohortes  · lista de cohortes → detalle con roster + grilla de asistencia
 *                (sesión × alumno, toggle) + "Emitir diplomas" (≥75% aprueba).
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { KpiCard } from "@/app/studio/_components/ui/KpiCard";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { Icon } from "@/app/studio/_components/icons";
import {
  cohortStatusLabel,
  cohortStatusTone,
  courseStatusLabel,
  courseStatusTone,
  modalityLabel,
  tierLabel,
  type CohortDetail,
  type CourseWithCounts,
  type AcademiaStats,
  type RosterRow,
} from "@/lib/studio/academia/types";
import Link from "next/link";
import { CohortDrawer } from "./CohortDrawer";
import { EnrollmentDrawer } from "./EnrollmentDrawer";
import { CourseDrawer } from "./CourseDrawer";
import { CourseEditorDrawer } from "./CourseEditorDrawer";
import { emitDiplomasAction, toggleAttendanceAction } from "../actions";

type Tab = "catalogo" | "cohortes";

const TABS: { value: Tab; label: string }[] = [
  { value: "catalogo", label: "Catálogo" },
  { value: "cohortes", label: "Cohortes" },
];

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
function fmtDate(iso: string | null): string {
  if (!iso) return "Fecha por definir";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MESES[(m - 1) % 12]} ${y}`;
}

export function AcademiaClient({
  stats,
  courses,
  cohorts,
}: {
  stats: AcademiaStats;
  courses: CourseWithCounts[];
  cohorts: CohortDetail[];
}) {
  const [tab, setTab] = useState<Tab>("cohortes");
  const [showNewCohort, setShowNewCohort] = useState(false);

  return (
    <div style={{ maxWidth: 1280 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: "var(--s-6)",
          marginBottom: "var(--s-6)",
          flexWrap: "wrap",
        }}
      >
        <div>
          <span className="studio-eyebrow" style={{ color: "var(--wine)" }}>
            Academia DTD
          </span>
          <h1
            className="studio-display"
            style={{ fontSize: 30, margin: "8px 0 8px", color: "var(--ink)" }}
          >
            Formación · cursos y cohortes.
          </h1>
          <p
            style={{
              font: "400 13px/1.5 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: 0,
              maxWidth: "64ch",
            }}
          >
            El catálogo de cursos y las cohortes en vivo. Marca la asistencia por
            sesión y emite el diploma a quien apruebe (≥ 75% de asistencia).
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link
            href="/studio/academia/diplomas"
            className="studio-btn studio-btn-ghost"
            style={{ textDecoration: "none" }}
          >
            Diplomas
          </Link>
          <button
            type="button"
            className="studio-btn studio-btn-primary"
            onClick={() => {
              setTab("cohortes");
              setShowNewCohort(true);
            }}
          >
            + Nueva cohorte
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 14,
          marginBottom: "var(--s-5)",
        }}
      >
        <KpiCard value={stats.publicados} label="Cursos publicados" sub="visibles" />
        <KpiCard
          value={stats.enCurso}
          label="Cohortes en curso"
          valueColor={stats.enCurso > 0 ? "var(--wine)" : "var(--ink)"}
          sub="activas ahora"
        />
        <KpiCard value={stats.alumnos} label="Alumnos" sub="inscritos" />
        <KpiCard
          value={stats.diplomasListos}
          label="Diplomas listos"
          valueColor={stats.diplomasListos > 0 ? "var(--success)" : "var(--ink)"}
          sub="para emitir"
        />
      </div>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Vistas de la Academia"
        style={{
          display: "flex",
          gap: "var(--s-1)",
          marginBottom: 18,
          borderBottom: "1px solid var(--border)",
        }}
      >
        {TABS.map((tDef) => {
          const active = tab === tDef.value;
          return (
            <button
              key={tDef.value}
              type="button"
              role="tab"
              id={`academia-tab-${tDef.value}`}
              aria-selected={active}
              aria-controls={`academia-panel-${tDef.value}`}
              tabIndex={active ? 0 : -1}
              onClick={() => setTab(tDef.value)}
              style={{
                padding: "10px 16px",
                background: "transparent",
                border: "none",
                borderBottom: active
                  ? "2px solid var(--wine)"
                  : "2px solid transparent",
                color: active ? "var(--ink)" : "var(--ink-soft)",
                font: active
                  ? "700 13px/1 var(--f-sans)"
                  : "500 13px/1 var(--f-sans)",
                cursor: "pointer",
                marginBottom: -1,
              }}
            >
              {tDef.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`academia-panel-${tab}`}
        aria-labelledby={`academia-tab-${tab}`}
      >
        {tab === "catalogo" && <CatalogTab courses={courses} />}
        {tab === "cohortes" && (
          <CohortsTab
            cohorts={cohorts}
            courses={courses}
            onNew={() => setShowNewCohort(true)}
          />
        )}
      </div>

      {showNewCohort && (
        <CohortDrawer courses={courses} onClose={() => setShowNewCohort(false)} />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Tab: Catálogo (Slice A)
// ════════════════════════════════════════════════════════════════

function CatalogTab({ courses }: { courses: CourseWithCounts[] }) {
  const [showNewCourse, setShowNewCourse] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-4)" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "var(--s-3)",
        }}
      >
        <div className="studio-eyebrow">Catálogo · {courses.length} curso(s)</div>
        <button
          type="button"
          className="studio-btn studio-btn-primary studio-btn-sm"
          onClick={() => setShowNewCourse(true)}
        >
          + Nuevo curso
        </button>
      </div>

      {courses.length === 0 ? (
        <EmptyState
          eyebrow="Catálogo vacío"
          title="Aún no hay cursos"
          description="Crea el primer curso con “+ Nuevo curso”. Luego agrégale módulos y lecciones. El precio se fija aparte, en Servicios (Administración)."
          action={
            <button
              type="button"
              className="studio-btn studio-btn-primary"
              onClick={() => setShowNewCourse(true)}
            >
              + Nuevo curso
            </button>
          }
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
            <button
              key={c.id}
              type="button"
              onClick={() => setEditingId(c.id)}
              aria-label={`Editar curso: ${c.title}`}
              style={{
                textAlign: "left",
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-lg)",
                padding: "var(--s-5)",
                display: "flex",
                flexDirection: "column",
                gap: "var(--s-3)",
                cursor: "pointer",
                transition: "border-color var(--dur-fast) var(--ease)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "var(--s-2)", flexWrap: "wrap" }}>
                <Badge tone="wine" size="sm">{tierLabel(c.tier)}</Badge>
                <Badge tone={courseStatusTone(c.status)} size="sm" dot>
                  {courseStatusLabel(c.status)}
                </Badge>
              </div>
              <span style={{ display: "block", font: "800 16px/1.25 var(--f-display)", color: "var(--ink)", margin: 0 }}>
                {c.title}
              </span>
              {c.summary && (
                <p style={{ font: "500 12.5px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: 0 }}>
                  {c.summary}
                </p>
              )}
              <div
                style={{
                  marginTop: "auto",
                  font: "600 11.5px/1 var(--f-sans)",
                  color: "var(--ink-soft)",
                  letterSpacing: "0.02em",
                }}
              >
                {c.modules_count} módulos · {c.lessons_count} lecciones
              </div>
            </button>
          ))}
        </div>
      )}

      {showNewCourse && <CourseDrawer onClose={() => setShowNewCourse(false)} />}
      {editingId && (
        <CourseEditorDrawer
          courseId={editingId}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Tab: Cohortes
// ════════════════════════════════════════════════════════════════

function CohortsTab({
  cohorts,
  courses,
  onNew,
}: {
  cohorts: CohortDetail[];
  courses: CourseWithCounts[];
  onNew: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(
    cohorts[0]?.cohort.id ?? null,
  );
  const selected =
    cohorts.find((d) => d.cohort.id === selectedId) ?? cohorts[0] ?? null;

  if (cohorts.length === 0) {
    return (
      <EmptyState
        eyebrow="Sin cohortes"
        title="Todavía no hay cohortes en vivo."
        description="Crea una cohorte (con o sin curso asociado), inscribe a los alumnos, marca su asistencia por sesión y emite los diplomas al cierre."
        action={
          <button type="button" className="studio-btn studio-btn-primary" onClick={onNew}>
            + Nueva cohorte
          </button>
        }
      />
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: "var(--s-4)" }}>
      {/* Lista lateral */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {cohorts.map((d) => {
          const c = d.cohort;
          const active = selected?.cohort.id === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedId(c.id)}
              style={{
                textAlign: "left",
                padding: "14px 16px",
                borderRadius: "var(--r-lg)",
                background: "var(--bg-surface)",
                border: `1px solid ${active ? "var(--wine)" : "var(--border)"}`,
                boxShadow: active ? "var(--shadow-sm)" : "none",
                cursor: "pointer",
                transition: "border-color var(--dur-fast) var(--ease)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "var(--s-2)",
                  marginBottom: "var(--s-2)",
                }}
              >
                <span
                  style={{
                    font: "700 13px/1.2 var(--f-sans)",
                    color: active ? "var(--wine)" : "var(--ink)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {c.name}
                </span>
                <Badge tone={cohortStatusTone(c.status)} size="sm">
                  {cohortStatusLabel(c.status)}
                </Badge>
              </div>
              <div
                style={{
                  font: "500 11px/1.4 var(--f-sans)",
                  color: "var(--ink-soft)",
                }}
              >
                {fmtDate(c.starts_at)} · {modalityLabel(c.modality)} ·{" "}
                {d.roster.length} inscrito(s)
              </div>
              {d.readyToEmit > 0 && (
                <div
                  style={{
                    marginTop: "var(--s-2)",
                    font: "700 10.5px/1 var(--f-sans)",
                    color: "var(--success)",
                    letterSpacing: "0.02em",
                  }}
                >
                  {d.readyToEmit} diploma(s) por emitir
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Detalle */}
      {selected && <CohortDetailView detail={selected} courses={courses} />}
    </div>
  );
}

function CohortDetailView({
  detail,
  courses,
}: {
  detail: CohortDetail;
  courses: CourseWithCounts[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [showEnroll, setShowEnroll] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [emitError, setEmitError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const c = detail.cohort;
  const sessions = c.sessions;

  // grid: alumno | documento | S1..Sn | % | estado
  const sessionCols = Array.from({ length: sessions }, () => "40px").join(" ");
  const grid = `1.4fr 110px ${sessionCols} 56px 110px`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-4)" }}>
      {/* Header */}
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          padding: "20px 22px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "var(--s-4)",
            flexWrap: "wrap",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div className="studio-eyebrow" style={{ color: "var(--wine)" }}>
              {cohortStatusLabel(c.status)} · {fmtDate(c.starts_at)}
            </div>
            <h2
              className="studio-display"
              style={{ fontSize: 20, margin: "6px 0 6px", color: "var(--ink)" }}
            >
              {c.name}
            </h2>
            <div
              style={{
                font: "500 12px/1.4 var(--f-sans)",
                color: "var(--ink-soft)",
              }}
            >
              {detail.course_title ? `${detail.course_title} · ` : ""}
              {c.hours != null ? `${c.hours} horas · ` : ""}
              {sessions} sesiones · {modalityLabel(c.modality)}
              {c.place ? ` · ${c.place}` : ""}
              {c.facilitator_name ? ` · ${c.facilitator_name}` : ""}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--s-2)", flexShrink: 0 }}>
            <button
              type="button"
              className="studio-btn studio-btn-ghost studio-btn-sm"
              onClick={() => setShowEdit(true)}
            >
              Editar
            </button>
            <button
              type="button"
              className="studio-btn studio-btn-ghost studio-btn-sm"
              onClick={() => setShowEnroll(true)}
            >
              + Inscribir alumno
            </button>
            {/* Separa la acción irreversible (emitir) del resto */}
            <span
              aria-hidden
              style={{ width: 1, alignSelf: "stretch", background: "var(--border)", margin: "0 2px" }}
            />
            {!confirming ? (
              <button
                type="button"
                className="studio-btn studio-btn-primary studio-btn-sm"
                disabled={detail.readyToEmit === 0}
                title={
                  detail.readyToEmit === 0
                    ? "No hay alumnos aprobados (≥75%) sin diploma"
                    : undefined
                }
                onClick={() => {
                  setEmitError(null);
                  setConfirming(true);
                }}
              >
                Emitir diplomas ({detail.readyToEmit})
              </button>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "var(--s-2)" }}>
                <span
                  style={{
                    font: "600 12px/1.35 var(--f-sans)",
                    color: "var(--ink-soft)",
                    maxWidth: "26ch",
                  }}
                >
                  ¿Emitir {detail.readyToEmit} diploma(s)? No se puede deshacer.
                </span>
                <button
                  type="button"
                  className="studio-btn studio-btn-ghost studio-btn-sm"
                  onClick={() => setConfirming(false)}
                >
                  Cancelar
                </button>
                <ActionButton
                  variant="dark"
                  size="sm"
                  idleLabel="Confirmar emisión"
                  loadingLabel="Emitiendo…"
                  successLabel="Emitidos"
                  idleIcon={Icon.check(14)}
                  onAction={async () => {
                    setEmitError(null);
                    const r = await emitDiplomasAction(c.id);
                    if (r.error && !r.ok) return { error: r.error };
                    if (r.ok) {
                      toast.success(
                        `${r.emitted ?? 0} diploma(s) emitido(s)${
                          r.folios && r.folios.length
                            ? ` · ${r.folios.join(", ")}`
                            : ""
                        }`,
                      );
                    }
                    return;
                  }}
                  onError={setEmitError}
                  onSuccess={() => {
                    setConfirming(false);
                    router.refresh();
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {emitError && (
          <p
            role="alert"
            style={{
              font: "500 12px/1.4 var(--f-sans)",
              color: "var(--danger)",
              margin: "14px 0 0",
              padding: "10px 12px",
              background: "var(--danger-bg)",
              border: "1px solid var(--danger)",
              borderRadius: "var(--r-sm)",
            }}
          >
            {emitError}
          </p>
        )}
      </div>

      {/* Roster + asistencia */}
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "16px 20px 14px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: "var(--s-3)",
            flexWrap: "wrap",
          }}
        >
          <div className="studio-eyebrow">
            Inscritos y asistencia · {detail.roster.length}
          </div>
          <span
            style={{
              font: "500 11.5px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
            }}
          >
            Marca la asistencia por sesión. Aprueba con ≥ 75%.
          </span>
        </div>

        {detail.roster.length === 0 ? (
          <div
            style={{
              padding: "28px 20px",
              font: "500 13px/1.5 var(--f-sans)",
              color: "var(--ink-soft)",
            }}
          >
            Sin inscritos todavía. Usa “+ Inscribir alumno”.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: "max-content" }}>
              {/* Header */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: grid,
                  gap: "var(--s-2)",
                  padding: "var(--s-3) var(--s-5)",
                  background: "var(--bg-elevated)",
                  borderBottom: "1px solid var(--border)",
                  font: "700 10px/1 var(--f-sans)",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--ink-soft)",
                  alignItems: "center",
                }}
              >
                <span>Alumno</span>
                <span>Documento</span>
                {Array.from({ length: sessions }, (_, i) => (
                  <span key={i} style={{ textAlign: "center" }}>
                    S{i + 1}
                  </span>
                ))}
                <span style={{ textAlign: "center" }}>%</span>
                <span style={{ textAlign: "right" }}>Estado</span>
              </div>
              {/* Filas */}
              {detail.roster.map((row, i) => (
                <RosterRowView
                  key={row.enrollment.id}
                  row={row}
                  cohortId={c.id}
                  sessions={sessions}
                  grid={grid}
                  isFirst={i === 0}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {showEnroll && (
        <EnrollmentDrawer
          cohortId={c.id}
          cohortName={c.name}
          onClose={() => setShowEnroll(false)}
        />
      )}
      {showEdit && (
        <CohortDrawer
          cohort={c}
          courses={courses}
          onClose={() => setShowEdit(false)}
        />
      )}
    </div>
  );
}

function RosterRowView({
  row,
  cohortId,
  sessions,
  grid,
  isFirst,
}: {
  row: RosterRow;
  cohortId: string;
  sessions: number;
  grid: string;
  isFirst: boolean;
}) {
  const e = row.enrollment;
  const pct = Math.round(row.ratio * 100);
  const attendedCount = row.attended.filter(Boolean).length;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: grid,
        gap: "var(--s-2)",
        padding: "var(--s-3) var(--s-5)",
        borderTop: isFirst ? 0 : "1px solid var(--border)",
        alignItems: "center",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            font: "600 12.5px/1.2 var(--f-sans)",
            color: "var(--ink)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {e.student_name}
        </div>
        {e.client_markbox && (
          <code
            style={{
              font: "700 10px/1 var(--f-mono)",
              color: "var(--wine)",
            }}
          >
            {e.client_markbox}
          </code>
        )}
      </div>
      <code
        style={{
          font: "500 10.5px/1 var(--f-mono)",
          color: "var(--ink-soft)",
        }}
      >
        {e.student_ci ?? "—"}
      </code>
      {Array.from({ length: sessions }, (_, s) => (
        <div key={s} style={{ display: "grid", placeItems: "center" }}>
          <AttendanceCell
            cohortId={cohortId}
            enrollmentId={e.id}
            sessionNum={s + 1}
            attended={row.attended[s] ?? false}
          />
        </div>
      ))}
      <span
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          lineHeight: 1.2,
        }}
      >
        <span
          style={{
            font: "700 11.5px/1 var(--f-mono)",
            color: row.approved ? "var(--success)" : "var(--ink-soft)",
          }}
        >
          {pct}%
        </span>
        <span
          style={{ font: "500 9px/1 var(--f-mono)", color: "var(--ink-soft)", marginTop: 2 }}
          title="Sesiones asistidas / total"
        >
          {attendedCount}/{sessions}
        </span>
      </span>
      <span style={{ textAlign: "right" }}>
        <Badge tone={row.approved ? "success" : "warning"} size="sm">
          {row.approved ? "Aprobado" : "En proceso"}
        </Badge>
      </span>
    </div>
  );
}

function AttendanceCell({
  cohortId,
  enrollmentId,
  sessionNum,
  attended,
}: {
  cohortId: string;
  enrollmentId: string;
  sessionNum: number;
  attended: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  // optimismo local: el valor mostrado mientras revalida.
  const [optimistic, setOptimistic] = useState(attended);

  const on = optimistic;

  const handleClick = () => {
    if (isPending) return;
    const next = !on;
    setOptimistic(next);
    startTransition(async () => {
      const r = await toggleAttendanceAction({
        cohortId,
        enrollmentId,
        sessionNum,
        attended: next,
      });
      if (r.error) {
        setOptimistic(!next); // rollback
        toast.error(r.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-pressed={on}
      aria-label={`Sesión ${sessionNum}: ${on ? "asistió" : "no asistió"}`}
      style={{
        width: 26,
        height: 26,
        display: "grid",
        placeItems: "center",
        borderRadius: "var(--r-sm)",
        border: `1px solid ${on ? "var(--success)" : "var(--border)"}`,
        background: on ? "var(--success-bg)" : "var(--bg-surface)",
        color: on ? "var(--success)" : "var(--ink-mute)",
        cursor: isPending ? "wait" : "pointer",
        transition:
          "border-color var(--dur-fast) var(--ease), background-color var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease)",
      }}
    >
      {on ? Icon.check(13) : null}
    </button>
  );
}
