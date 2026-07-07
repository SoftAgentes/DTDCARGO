"use client";

/**
 * AsistenciaTab — calendario de asistencia (lista por día) + panel de feriados
 * (SDD-0103 · Slice C). Filtro por mes client-side, KPIs del mes, drawers de
 * alta/edición. Montos/horas en JetBrains Mono, Badge por estado, EmptyState si
 * no hay filas. El gate de rol y la RLS viven del lado servidor.
 */

import { useMemo, useState, useTransition } from "react";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { KpiCard } from "@/app/studio/_components/ui/KpiCard";
import { Icon } from "@/app/studio/_components/icons";
import {
  attendanceStatusLabel,
  attendanceStatusTone,
  attendanceMonthKey,
  computeAttendanceKpis,
  holidayScopeLabel,
  holidayScopeTone,
  type Attendance,
  type Holiday,
} from "@/lib/studio/nomina/attendance-types";
import type { Employee } from "@/lib/studio/nomina/employee-types";
import { softDeleteHolidayAction } from "../actions";
import { AsistenciaDrawer } from "./AsistenciaDrawer";
import { FeriadoDrawer } from "./FeriadoDrawer";

const ATT_COLS = "120px minmax(180px,1.4fr) 110px 96px 96px 90px";
const HOL_COLS = "130px minmax(180px,1fr) 110px 80px";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? iso + "T00:00:00" : iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-VE", { day: "2-digit", month: "short", year: "numeric" });
}

function monthLabel(key: string): string {
  const d = new Date(key + "-01T00:00:00");
  if (Number.isNaN(d.getTime())) return key;
  return d.toLocaleDateString("es-VE", { month: "long", year: "numeric" });
}

function fmtHours(n: number): string {
  return n === 0 ? "—" : `${n} h`;
}

export function AsistenciaTab({
  attendance,
  holidays,
  employees,
}: {
  attendance: Attendance[];
  holidays: Holiday[];
  employees: Employee[];
}) {
  const [attDrawer, setAttDrawer] = useState<
    null | { mode: "new" } | { mode: "edit"; record: Attendance }
  >(null);
  const [holOpen, setHolOpen] = useState(false);

  const employeeName = useMemo(
    () => new Map(employees.map((e) => [e.id, e.full_name])),
    [employees],
  );

  // Meses presentes en el set (desc), con el último seleccionado por defecto.
  const months = useMemo(() => {
    const set = new Set(attendance.map((a) => attendanceMonthKey(a.work_date)));
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [attendance]);

  const [month, setMonth] = useState<string>("todos");
  const activeMonth = month === "todos" ? null : month;

  const rows = useMemo(
    () =>
      activeMonth
        ? attendance.filter((a) => attendanceMonthKey(a.work_date) === activeMonth)
        : attendance,
    [attendance, activeMonth],
  );

  const kpis = useMemo(() => computeAttendanceKpis(rows), [rows]);

  const hasEmployees = employees.length > 0;

  return (
    <div>
      {/* KPIs del set filtrado */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "var(--s-3)",
          marginBottom: "var(--s-6)",
        }}
      >
        <KpiCard value={kpis.worked_count} label="Días trabajados" />
        <KpiCard value={kpis.absent_count} label="Ausencias" highlightWhenPositive={false} />
        <KpiCard value={fmtHours(kpis.overtime_hours)} label="Horas extra" sub="Diurnas del período" />
        <KpiCard value={fmtHours(kpis.night_hours)} label="Horas nocturnas" />
      </div>

      {/* Toolbar: filtro de mes + alta */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "var(--s-4)",
          gap: "var(--s-3)",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--s-2)" }}>
          <label
            className="studio-label"
            htmlFor="att-month"
            style={{ margin: 0 }}
          >
            Mes
          </label>
          <select
            id="att-month"
            className="studio-input"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            style={{ width: "auto", minWidth: 160 }}
          >
            <option value="todos">Todos</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="studio-btn studio-btn-primary"
          onClick={() => setAttDrawer({ mode: "new" })}
          disabled={!hasEmployees}
          title={hasEmployees ? undefined : "Registra primero un empleado"}
        >
          + Registrar asistencia
        </button>
      </div>

      {!hasEmployees ? (
        <EmptyState
          eyebrow="Sin empleados"
          title="Primero registra empleados."
          description="La asistencia se marca por empleado. Crea fichas en la pestaña Empleados y vuelve acá."
        />
      ) : rows.length === 0 ? (
        <EmptyState
          eyebrow="Calendario vacío"
          title="Aún no hay asistencia registrada."
          description="Marca el día de cada empleado (trabajado, ausente, libre o feriado) con sus horas extra. Alimenta el cálculo del recibo."
          action={
            <button
              type="button"
              className="studio-btn studio-btn-primary"
              onClick={() => setAttDrawer({ mode: "new" })}
            >
              + Registrar asistencia
            </button>
          }
        />
      ) : (
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
            overflow: "hidden",
          }}
        >
          <TableHeader cols={ATT_COLS}>
            <span>Fecha</span>
            <span>Empleado</span>
            <span>Estado</span>
            <span style={{ textAlign: "right" }}>H. extra</span>
            <span style={{ textAlign: "right" }}>H. noct.</span>
            <span style={{ textAlign: "right" }}>Acciones</span>
          </TableHeader>
          {rows.map((a, i) => (
            <div
              key={a.id}
              style={{
                display: "grid",
                gridTemplateColumns: ATT_COLS,
                gap: 12,
                padding: "11px 20px",
                alignItems: "center",
                borderTop: i === 0 ? 0 : "1px solid var(--border)",
              }}
            >
              <span style={{ font: "600 12px/1 var(--f-mono)", color: "var(--ink-soft)" }}>
                {fmtDate(a.work_date)}
              </span>
              <span
                style={{
                  font: "600 12.5px/1.3 var(--f-sans)",
                  color: "var(--ink)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {employeeName.get(a.employee_id) ?? "Empleado"}
              </span>
              <Badge tone={attendanceStatusTone(a.status)} size="sm">
                {attendanceStatusLabel(a.status)}
              </Badge>
              <span style={{ font: "700 12.5px/1 var(--f-mono)", color: "var(--ink)", textAlign: "right" }}>
                {fmtHours(a.overtime_hours)}
              </span>
              <span style={{ font: "700 12.5px/1 var(--f-mono)", color: "var(--ink)", textAlign: "right" }}>
                {fmtHours(a.night_hours)}
              </span>
              <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setAttDrawer({ mode: "edit", record: a })}
                  aria-label="Editar asistencia"
                  className="studio-btn studio-btn-ghost studio-btn-sm"
                  style={{ padding: "6px 10px" }}
                >
                  {Icon.edit(13)}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Feriados ──────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          margin: "var(--s-8) 0 var(--s-3)",
          gap: "var(--s-3)",
          flexWrap: "wrap",
        }}
      >
        <h2 className="studio-display" style={{ fontSize: 16, margin: 0, color: "var(--ink)" }}>
          Feriados
        </h2>
        <button type="button" className="studio-btn studio-btn-ghost" onClick={() => setHolOpen(true)}>
          + Nuevo feriado
        </button>
      </div>

      {holidays.length === 0 ? (
        <p style={{ font: "500 12.5px/1.4 var(--f-sans)", color: "var(--ink-soft)", margin: 0 }}>
          Sin feriados en el calendario. Agrega los nacionales o los propios de la empresa.
        </p>
      ) : (
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
            overflow: "hidden",
          }}
        >
          <TableHeader cols={HOL_COLS}>
            <span>Fecha</span>
            <span>Feriado</span>
            <span>Alcance</span>
            <span style={{ textAlign: "right" }}>Acciones</span>
          </TableHeader>
          {holidays.map((h, i) => (
            <HolidayRow key={h.id} h={h} first={i === 0} />
          ))}
        </div>
      )}

      {attDrawer && (
        <AsistenciaDrawer
          record={attDrawer.mode === "edit" ? attDrawer.record : null}
          employees={employees}
          employeeName={
            attDrawer.mode === "edit"
              ? employeeName.get(attDrawer.record.employee_id) ?? null
              : null
          }
          onClose={() => setAttDrawer(null)}
        />
      )}
      {holOpen && <FeriadoDrawer onClose={() => setHolOpen(false)} />}
    </div>
  );
}

function HolidayRow({ h, first }: { h: Holiday; first: boolean }) {
  const [isPending, startTransition] = useTransition();
  const remove = () => {
    if (isPending) return;
    startTransition(async () => {
      await softDeleteHolidayAction(h.id);
    });
  };
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: HOL_COLS,
        gap: 12,
        padding: "11px 20px",
        alignItems: "center",
        borderTop: first ? 0 : "1px solid var(--border)",
        opacity: isPending ? 0.5 : 1,
      }}
    >
      <span style={{ font: "600 12px/1 var(--f-mono)", color: "var(--ink-soft)" }}>
        {fmtDate(h.holiday_date)}
      </span>
      <span style={{ font: "600 12.5px/1.3 var(--f-sans)", color: "var(--ink)" }}>
        {h.label}
      </span>
      <Badge tone={holidayScopeTone(h.scope)} size="sm">
        {holidayScopeLabel(h.scope)}
      </Badge>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={remove}
          disabled={isPending}
          aria-label="Eliminar feriado"
          className="studio-btn studio-btn-ghost studio-btn-sm"
          style={{ padding: "6px 10px", color: "var(--danger)" }}
        >
          {Icon.trash(13)}
        </button>
      </div>
    </div>
  );
}

function TableHeader({ cols, children }: { cols: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: cols,
        gap: 12,
        padding: "10px 20px",
        font: "700 9.5px/1 var(--f-sans)",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--ink-soft)",
        borderBottom: "1px solid var(--border)",
        background: "var(--bg-elevated)",
      }}
    >
      {children}
    </div>
  );
}
