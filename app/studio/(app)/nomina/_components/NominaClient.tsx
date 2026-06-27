"use client";

/**
 * NominaClient — pestañas Empleados / Prestadores + KPIs + tablas + drawers
 * (SDD-0103 · Slice A). Patrón de tabs de NavieraClient (useState), tablas a
 * mano con grid (no hay primitiva <Table>), toggle de estado vía server action
 * bindeada (patrón ActiveToggle de operarios).
 */

import { useState, useTransition } from "react";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { KpiCard } from "@/app/studio/_components/ui/KpiCard";
import { Icon } from "@/app/studio/_components/icons";
import {
  employeeStatusLabel,
  employeeStatusTone,
  type Employee,
  type EmployeeKpis,
} from "@/lib/studio/nomina/employee-types";
import {
  contractorStatusLabel,
  contractorStatusTone,
  type Contractor,
  type ContractorPayment,
  type ContractorKpis,
} from "@/lib/studio/nomina/contractor-types";
import {
  payFrequencyLabel,
  dayMethodLabel,
  payrollRulesStatusLabel,
  payrollRulesStatusTone,
  type PayrollRules,
} from "@/lib/studio/nomina/payroll-rules-types";
import {
  loanStatusLabel,
  loanStatusTone,
  type LoanWithBalance,
  type LoanKpis,
} from "@/lib/studio/nomina/loan-types";
import {
  warningSeverityLabel,
  warningSeverityTone,
  warningStatusLabel,
  warningStatusTone,
  type Warning,
  type WarningKpis,
} from "@/lib/studio/nomina/warning-types";
import type {
  PayrollRun,
  PayrollRunKpis,
} from "@/lib/studio/nomina/payroll-run-types";
import {
  setEmployeeStatusAction,
  setContractorStatusAction,
  anularAmonestacionAction,
} from "../actions";
import { EmpleadoDrawer } from "./EmpleadoDrawer";
import { PrestadorDrawer } from "./PrestadorDrawer";
import { PagoPrestadorDrawer } from "./PagoPrestadorDrawer";
import { ReglasDrawer } from "./ReglasDrawer";
import { AsistenciaTab } from "./AsistenciaTab";
import { PrestamoDrawer } from "./PrestamoDrawer";
import { CuotaPrestamoDrawer } from "./CuotaPrestamoDrawer";
import { AmonestacionDrawer } from "./AmonestacionDrawer";
import { RecibosTab } from "./RecibosTab";
import { GenerarCorteDrawer } from "./GenerarCorteDrawer";
import { LiquidacionTab } from "./LiquidacionTab";
import { GenerarFiniquitoDrawer } from "./GenerarFiniquitoDrawer";
import { SolicitudesTab } from "./SolicitudesTab";
import { GenerarInvitacionDrawer } from "./GenerarInvitacionDrawer";
import { RevisarSolicitudDrawer } from "./RevisarSolicitudDrawer";
import { ComunicacionesTab } from "./ComunicacionesTab";
import type { EmployeeComm } from "@/lib/studio/nomina/comms-types";
import type { Settlement, SettlementKpis } from "@/lib/studio/nomina/settlement-types";
import type { EmployeeInvite } from "@/lib/studio/nomina/invite-types";
import type { EmployeeRegistration } from "@/lib/studio/nomina/registration-types";
import type { RegistrationKpis } from "@/lib/studio/nomina/registration-queries";
import type { Attendance, Holiday } from "@/lib/studio/nomina/attendance-types";

type Tab =
  | "empleados"
  | "solicitudes"
  | "prestadores"
  | "asistencia"
  | "prestamos"
  | "amonestaciones"
  | "recibos"
  | "liquidaciones"
  | "comunicaciones"
  | "reglas";

function fmtUsd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? iso + "T00:00:00" : iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-VE", { day: "2-digit", month: "short", year: "numeric" });
}

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .slice(0, 2)
      .join("") || "??"
  );
}

const TABS: { value: Tab; label: string }[] = [
  { value: "empleados", label: "Empleados" },
  { value: "solicitudes", label: "Solicitudes" },
  { value: "prestadores", label: "Prestadores" },
  { value: "asistencia", label: "Asistencia" },
  { value: "prestamos", label: "Préstamos" },
  { value: "amonestaciones", label: "Amonestaciones" },
  { value: "recibos", label: "Recibos" },
  { value: "liquidaciones", label: "Liquidaciones" },
  { value: "comunicaciones", label: "Comunicaciones" },
  { value: "reglas", label: "Reglas" },
];

export function NominaClient({
  employees,
  contractors,
  payments,
  rules,
  attendance,
  holidays,
  loans,
  warnings,
  runs,
  settlements,
  invites,
  registrations,
  comms,
  employeeKpis,
  contractorKpis,
  loanKpis,
  warningKpis,
  runKpis,
  settlementKpis,
  registrationKpis,
}: {
  employees: Employee[];
  contractors: Contractor[];
  payments: ContractorPayment[];
  rules: PayrollRules | null;
  attendance: Attendance[];
  holidays: Holiday[];
  loans: LoanWithBalance[];
  warnings: Warning[];
  runs: PayrollRun[];
  settlements: Settlement[];
  invites: EmployeeInvite[];
  registrations: EmployeeRegistration[];
  comms: EmployeeComm[];
  employeeKpis: EmployeeKpis;
  contractorKpis: ContractorKpis;
  loanKpis: LoanKpis;
  warningKpis: WarningKpis;
  runKpis: PayrollRunKpis;
  settlementKpis: SettlementKpis;
  registrationKpis: RegistrationKpis;
}) {
  const [tab, setTab] = useState<Tab>("empleados");
  const [empDrawer, setEmpDrawer] = useState<null | { mode: "new" } | { mode: "edit"; employee: Employee }>(null);
  const [prestDrawer, setPrestDrawer] = useState<null | { mode: "new" } | { mode: "edit"; contractor: Contractor }>(null);
  const [pagoOpen, setPagoOpen] = useState(false);
  const [reglasOpen, setReglasOpen] = useState(false);
  const [prestamoOpen, setPrestamoOpen] = useState(false);
  const [cuotaLoan, setCuotaLoan] = useState<LoanWithBalance | null>(null);
  const [amonestacionOpen, setAmonestacionOpen] = useState(false);
  const [corteOpen, setCorteOpen] = useState(false);
  const [finiquitoOpen, setFiniquitoOpen] = useState(false);
  const [invitacionOpen, setInvitacionOpen] = useState(false);
  const [reviewReg, setReviewReg] = useState<EmployeeRegistration | null>(null);

  const contractorName = new Map(contractors.map((c) => [c.id, c.full_name]));
  const employeeName = new Map(
    employees.map((e) => [e.id, `${e.full_name} · ${e.employee_code}`]),
  );

  return (
    <div>
      {/* KPIs — Asistencia y Reglas traen lo suyo adentro */}
      {tab !== "asistencia" && tab !== "reglas" && tab !== "comunicaciones" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "var(--s-3)",
            marginBottom: "var(--s-6)",
          }}
        >
          {tab === "empleados" && (
            <>
              <KpiCard value={employeeKpis.active_count} label="Empleados activos" />
              <KpiCard
                value={fmtUsd(employeeKpis.monthly_payroll_usd)}
                label="Nómina mensual"
                sub="Σ sueldos de activos · indexado USD"
              />
              <KpiCard value={employeeKpis.total_count} label="Total en ficha" highlightWhenPositive={false} />
            </>
          )}
          {tab === "solicitudes" && (
            <>
              <KpiCard value={registrationKpis.pending_count} label="Por revisar" />
              <KpiCard value={registrationKpis.approved_count} label="Aprobadas" highlightWhenPositive={false} />
              <KpiCard value={registrationKpis.total_count} label="Total solicitudes" highlightWhenPositive={false} />
            </>
          )}
          {tab === "prestadores" && (
            <>
              <KpiCard value={contractorKpis.active_count} label="Prestadores activos" />
              <KpiCard value={contractorKpis.payments_count} label="Pagos registrados" highlightWhenPositive={false} />
              <KpiCard value={fmtUsd(contractorKpis.total_paid_usd)} label="Total pagado" />
            </>
          )}
          {tab === "prestamos" && (
            <>
              <KpiCard value={loanKpis.active_count} label="Préstamos activos" />
              <KpiCard value={loanKpis.total_count} label="Total registrados" highlightWhenPositive={false} />
              <KpiCard value={fmtUsd(loanKpis.outstanding_usd)} label="Saldo por cobrar" />
            </>
          )}
          {tab === "amonestaciones" && (
            <>
              <KpiCard value={warningKpis.this_month_count} label="Amonestaciones del mes" />
              <KpiCard value={warningKpis.active_count} label="Vigentes (emitidas)" highlightWhenPositive={false} />
              <KpiCard value={warningKpis.severe_count} label="Graves / muy graves" highlightWhenPositive={false} />
            </>
          )}
          {tab === "recibos" && (
            <>
              <KpiCard value={runKpis.live_count} label="Cortes vivos" highlightWhenPositive={false} />
              <KpiCard value={runKpis.draft_count} label="En borrador" highlightWhenPositive={false} />
              <KpiCard value={fmtUsd(runKpis.net_usd)} label="Neto de cortes vivos" />
            </>
          )}
          {tab === "liquidaciones" && (
            <>
              <KpiCard value={settlementKpis.draft_count} label="En borrador" highlightWhenPositive={false} />
              <KpiCard value={settlementKpis.confirmed_count} label="Confirmados" highlightWhenPositive={false} />
              <KpiCard value={fmtUsd(settlementKpis.net_usd)} label="Neto de finiquitos vivos" />
            </>
          )}
        </div>
      )}

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: "var(--s-5)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        {TABS.map((t) => {
          const active = tab === t.value;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              style={{
                padding: "10px 16px",
                background: "transparent",
                border: "none",
                borderBottom: active ? "2px solid var(--wine)" : "2px solid transparent",
                color: active ? "var(--ink)" : "var(--ink-soft)",
                font: `${active ? 700 : 500} 13px/1 var(--f-sans)`,
                cursor: "pointer",
                marginBottom: -1,
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "empleados" && (
        <EmpleadosTab
          employees={employees}
          onNew={() => setEmpDrawer({ mode: "new" })}
          onEdit={(employee) => setEmpDrawer({ mode: "edit", employee })}
        />
      )}
      {tab === "solicitudes" && (
        <SolicitudesTab
          invites={invites}
          registrations={registrations}
          onNewInvite={() => setInvitacionOpen(true)}
          onReview={(r) => setReviewReg(r)}
        />
      )}
      {tab === "prestadores" && (
        <PrestadoresTab
          contractors={contractors}
          payments={payments}
          contractorName={contractorName}
          onNewContractor={() => setPrestDrawer({ mode: "new" })}
          onEditContractor={(contractor) => setPrestDrawer({ mode: "edit", contractor })}
          onNewPayment={() => setPagoOpen(true)}
        />
      )}
      {tab === "asistencia" && (
        <AsistenciaTab
          attendance={attendance}
          holidays={holidays}
          employees={employees}
        />
      )}
      {tab === "prestamos" && (
        <PrestamosTab
          loans={loans}
          onNew={() => setPrestamoOpen(true)}
          onRegisterCuota={(loan) => setCuotaLoan(loan)}
        />
      )}
      {tab === "amonestaciones" && (
        <AmonestacionesTab
          warnings={warnings}
          employeeName={employeeName}
          hasEmployees={employees.length > 0}
          onNew={() => setAmonestacionOpen(true)}
        />
      )}
      {tab === "recibos" && (
        <RecibosTab runs={runs} onNew={() => setCorteOpen(true)} />
      )}
      {tab === "liquidaciones" && (
        <LiquidacionTab
          settlements={settlements}
          hasEmployees={employees.some((e) => e.status !== "egresado")}
          onNew={() => setFiniquitoOpen(true)}
        />
      )}
      {tab === "comunicaciones" && (
        <ComunicacionesTab comms={comms} employees={employees} />
      )}
      {tab === "reglas" && (
        <ReglasTab rules={rules} onEdit={() => setReglasOpen(true)} />
      )}

      {empDrawer && (
        <EmpleadoDrawer
          employee={empDrawer.mode === "edit" ? empDrawer.employee : null}
          onClose={() => setEmpDrawer(null)}
        />
      )}
      {prestDrawer && (
        <PrestadorDrawer
          contractor={prestDrawer.mode === "edit" ? prestDrawer.contractor : null}
          onClose={() => setPrestDrawer(null)}
        />
      )}
      {pagoOpen && (
        <PagoPrestadorDrawer
          contractors={contractors.filter((c) => c.status === "activo")}
          onClose={() => setPagoOpen(false)}
        />
      )}
      {reglasOpen && (
        <ReglasDrawer rules={rules} onClose={() => setReglasOpen(false)} />
      )}
      {prestamoOpen && (
        <PrestamoDrawer
          employees={employees.filter((e) => e.status === "activo")}
          onClose={() => setPrestamoOpen(false)}
        />
      )}
      {cuotaLoan && (
        <CuotaPrestamoDrawer loan={cuotaLoan} onClose={() => setCuotaLoan(null)} />
      )}
      {amonestacionOpen && (
        <AmonestacionDrawer
          employees={employees.filter((e) => e.status !== "egresado")}
          onClose={() => setAmonestacionOpen(false)}
        />
      )}
      {corteOpen && (
        <GenerarCorteDrawer rules={rules} onClose={() => setCorteOpen(false)} />
      )}
      {finiquitoOpen && (
        <GenerarFiniquitoDrawer
          employees={employees}
          rules={rules}
          onClose={() => setFiniquitoOpen(false)}
        />
      )}
      {invitacionOpen && (
        <GenerarInvitacionDrawer onClose={() => setInvitacionOpen(false)} />
      )}
      {reviewReg && (
        <RevisarSolicitudDrawer registration={reviewReg} onClose={() => setReviewReg(null)} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Reglas de cálculo (payroll_rules · Slice B)
// ─────────────────────────────────────────────────────────────
function fmtBs(n: number): string {
  return new Intl.NumberFormat("es-VE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function ReglasTab({
  rules,
  onEdit,
}: {
  rules: PayrollRules | null;
  onEdit: () => void;
}) {
  if (!rules) {
    return (
      <EmptyState
        eyebrow="Sin reglas"
        title="Aún no defines las reglas de cálculo."
        description="Los parámetros LOTTT (salario mínimo, cestaticket, deducciones, topes, recargos y provisiones) que la nómina del período va a usar. Es config, no cálculo."
        action={
          <button type="button" className="studio-btn studio-btn-primary" onClick={onEdit}>
            Definir reglas
          </button>
        }
      />
    );
  }

  const moneyRows: { label: string; value: string }[] = [
    { label: "Salario mínimo", value: `Bs ${fmtBs(rules.min_salary)}` },
    { label: "Cestaticket", value: `Bs ${fmtBs(rules.cestaticket)}` },
    { label: "Bono de guerra", value: `Bs ${fmtBs(rules.bono_guerra)}` },
  ];
  const pctRows: { label: string; value: string }[] = [
    { label: "SSO / IVSS", value: `${rules.sso_pct} %` },
    { label: "RPE", value: `${rules.rpe_pct} %` },
    { label: "FAOV", value: `${rules.faov_pct} %` },
    { label: "Tope IVSS", value: `${rules.sso_cap_sm} SM` },
    { label: "Tope RPE", value: `${rules.rpe_cap_sm} SM` },
  ];
  const recargoRows: { label: string; value: string }[] = [
    { label: "Hora extra diurna", value: `${rules.overtime_pct} %` },
    { label: "Bono nocturno", value: `${rules.night_pct} %` },
    { label: "Día feriado", value: `${rules.holiday_pct} %` },
  ];
  const provisionRows: { label: string; value: string }[] = [
    { label: "Utilidades", value: `${rules.utilidades_days} días` },
    { label: "Bono vacacional", value: `${rules.bono_vacacional_days} días` },
    { label: "Vacaciones", value: `${rules.vacaciones_days} días` },
  ];

  return (
    <>
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
        <div style={{ display: "flex", alignItems: "center", gap: "var(--s-3)" }}>
          <Badge tone={payrollRulesStatusTone(rules.status)} size="sm">
            {payrollRulesStatusLabel(rules.status)} · v{rules.version}
          </Badge>
          <span style={{ font: "500 12.5px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
            {payFrequencyLabel(rules.pay_frequency)} · {dayMethodLabel(rules.day_method)}
          </span>
        </div>
        <button type="button" className="studio-btn studio-btn-primary" onClick={onEdit}>
          Editar reglas
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "var(--s-4)",
        }}
      >
        <RulesCard title="Montos base (Bs)" rows={moneyRows} />
        <RulesCard title="Deducciones y topes" rows={pctRows} />
        <RulesCard title="Recargos" rows={recargoRows} />
        <RulesCard title="Provisiones / prestaciones" rows={provisionRows} />
      </div>

      {rules.notes && (
        <p
          style={{
            font: "400 12.5px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: "var(--s-4) 0 0",
            maxWidth: "62ch",
          }}
        >
          {rules.notes}
        </p>
      )}
    </>
  );
}

function RulesCard({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: string }[];
}) {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        padding: "16px 18px",
      }}
    >
      <div
        style={{
          font: "700 9.5px/1 var(--f-sans)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--ink-mute)",
          marginBottom: "var(--s-3)",
        }}
      >
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map((r) => (
          <div
            key={r.label}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}
          >
            <span style={{ font: "500 12.5px/1.3 var(--f-sans)", color: "var(--ink-soft)" }}>
              {r.label}
            </span>
            <span style={{ font: "700 12.5px/1 var(--f-mono)", color: "var(--ink)" }}>
              {r.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Empleados
// ─────────────────────────────────────────────────────────────
const EMP_COLS = "minmax(220px,1.4fr) 1fr 120px 96px 150px";

function EmpleadosTab({
  employees,
  onNew,
  onEdit,
}: {
  employees: Employee[];
  onNew: () => void;
  onEdit: (e: Employee) => void;
}) {
  return (
    <>
      <Toolbar
        count={employees.length}
        singular="empleado"
        plural="empleados"
        ctaLabel="+ Nuevo empleado"
        onCta={onNew}
      />
      {employees.length === 0 ? (
        <EmptyState
          eyebrow="Ficha vacía"
          title="Aún no hay empleados."
          description="Registra la ficha de cada persona del equipo: datos, banco y sueldo indexado en USD."
          action={
            <button type="button" className="studio-btn studio-btn-primary" onClick={onNew}>
              + Nuevo empleado
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
          <TableHeader cols={EMP_COLS}>
            <span>Empleado</span>
            <span>Cargo · Departamento</span>
            <span style={{ textAlign: "right" }}>Sueldo / mes</span>
            <span>Estado</span>
            <span style={{ textAlign: "right" }}>Acciones</span>
          </TableHeader>
          {employees.map((e, i) => (
            <EmpleadoRow key={e.id} e={e} first={i === 0} onEdit={onEdit} />
          ))}
        </div>
      )}
    </>
  );
}

function EmpleadoRow({
  e,
  first,
  onEdit,
}: {
  e: Employee;
  first: boolean;
  onEdit: (e: Employee) => void;
}) {
  const dimmed = e.status !== "activo";
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: EMP_COLS,
        gap: 12,
        padding: "12px 20px",
        alignItems: "center",
        borderTop: first ? 0 : "1px solid var(--border)",
        opacity: dimmed ? 0.6 : 1,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "var(--s-3)", minWidth: 0 }}>
        <span
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "var(--wine-tint)",
            color: "var(--wine)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            font: "800 12px/1 var(--f-display)",
            flexShrink: 0,
          }}
        >
          {initialsOf(e.full_name)}
        </span>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              font: "700 13px/1.2 var(--f-sans)",
              color: "var(--ink)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {e.full_name}
          </div>
          <div style={{ font: "600 11px/1.3 var(--f-mono)", color: "var(--ink-mute)" }}>
            {e.employee_code}
          </div>
        </div>
      </div>

      <div style={{ minWidth: 0 }}>
        <div style={{ font: "500 12.5px/1.3 var(--f-sans)", color: "var(--ink)" }}>
          {e.position_label ?? "—"}
        </div>
        <div style={{ font: "500 11.5px/1.3 var(--f-sans)", color: "var(--ink-soft)" }}>
          {e.department ?? "—"}
        </div>
      </div>

      <span style={{ font: "700 13px/1 var(--f-mono)", color: "var(--ink)", textAlign: "right" }}>
        {fmtUsd(e.salary_usd)}
      </span>

      <Badge tone={employeeStatusTone(e.status)} size="sm">
        {employeeStatusLabel(e.status)}
      </Badge>

      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center" }}>
        {e.status !== "egresado" && (
          <StatusToggle
            id={e.id}
            active={e.status === "activo"}
            kind="employee"
            ariaOn="Desactivar empleado"
            ariaOff="Activar empleado"
          />
        )}
        <button
          type="button"
          onClick={() => onEdit(e)}
          aria-label="Editar empleado"
          className="studio-btn studio-btn-ghost studio-btn-sm"
          style={{ padding: "6px 10px" }}
        >
          {Icon.edit(13)}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Prestadores
// ─────────────────────────────────────────────────────────────
const PREST_COLS = "minmax(200px,1.3fr) 1fr 110px 96px 110px";
const PAY_COLS = "130px minmax(160px,1fr) 1.4fr 120px";

function PrestadoresTab({
  contractors,
  payments,
  contractorName,
  onNewContractor,
  onEditContractor,
  onNewPayment,
}: {
  contractors: Contractor[];
  payments: ContractorPayment[];
  contractorName: Map<string, string>;
  onNewContractor: () => void;
  onEditContractor: (c: Contractor) => void;
  onNewPayment: () => void;
}) {
  return (
    <>
      <Toolbar
        count={contractors.length}
        singular="prestador"
        plural="prestadores"
        ctaLabel="+ Nuevo prestador"
        onCta={onNewContractor}
        extraCta={
          contractors.some((c) => c.status === "activo")
            ? { label: "Registrar pago", onClick: onNewPayment }
            : undefined
        }
      />

      {contractors.length === 0 ? (
        <EmptyState
          eyebrow="Sin prestadores"
          title="Aún no hay prestadores."
          description="Freelance que cobran por sesión (limpieza, plomería, mensajería). Van fuera de la nómina fija."
          action={
            <button type="button" className="studio-btn studio-btn-primary" onClick={onNewContractor}>
              + Nuevo prestador
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
            marginBottom: "var(--s-6)",
          }}
        >
          <TableHeader cols={PREST_COLS}>
            <span>Prestador</span>
            <span>Servicio</span>
            <span style={{ textAlign: "right" }}>Tarifa ref.</span>
            <span>Estado</span>
            <span style={{ textAlign: "right" }}>Acciones</span>
          </TableHeader>
          {contractors.map((c, i) => (
            <PrestadorRow key={c.id} c={c} first={i === 0} onEdit={onEditContractor} />
          ))}
        </div>
      )}

      {/* Pagos por sesión */}
      <h2
        className="studio-display"
        style={{ fontSize: 16, margin: "0 0 var(--s-3)", color: "var(--ink)" }}
      >
        Pagos por sesión
      </h2>
      {payments.length === 0 ? (
        <p style={{ font: "500 12.5px/1.4 var(--f-sans)", color: "var(--ink-soft)", margin: 0 }}>
          Todavía no se registraron pagos a prestadores.
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
          <TableHeader cols={PAY_COLS}>
            <span>Fecha</span>
            <span>Prestador</span>
            <span>Concepto</span>
            <span style={{ textAlign: "right" }}>Monto</span>
          </TableHeader>
          {payments.map((p, i) => (
            <div
              key={p.id}
              style={{
                display: "grid",
                gridTemplateColumns: PAY_COLS,
                gap: 12,
                padding: "11px 20px",
                alignItems: "center",
                borderTop: i === 0 ? 0 : "1px solid var(--border)",
              }}
            >
              <span style={{ font: "600 12px/1 var(--f-mono)", color: "var(--ink-soft)" }}>
                {fmtDate(p.paid_on)}
              </span>
              <span style={{ font: "600 12.5px/1.3 var(--f-sans)", color: "var(--ink)" }}>
                {contractorName.get(p.contractor_id) ?? "Prestador"}
              </span>
              <span style={{ font: "500 12.5px/1.3 var(--f-sans)", color: "var(--ink-soft)" }}>
                {p.concept}
              </span>
              <span style={{ font: "700 12.5px/1 var(--f-mono)", color: "var(--ink)", textAlign: "right" }}>
                {fmtUsd(p.amount_usd)}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function PrestadorRow({
  c,
  first,
  onEdit,
}: {
  c: Contractor;
  first: boolean;
  onEdit: (c: Contractor) => void;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: PREST_COLS,
        gap: 12,
        padding: "12px 20px",
        alignItems: "center",
        borderTop: first ? 0 : "1px solid var(--border)",
        opacity: c.status === "activo" ? 1 : 0.6,
      }}
    >
      <div style={{ font: "700 13px/1.2 var(--f-sans)", color: "var(--ink)", minWidth: 0 }}>
        {c.full_name}
      </div>
      <div style={{ font: "500 12.5px/1.3 var(--f-sans)", color: "var(--ink-soft)" }}>
        {c.service}
      </div>
      <span style={{ font: "700 12.5px/1 var(--f-mono)", color: "var(--ink)", textAlign: "right" }}>
        {fmtUsd(c.default_rate_usd)}
      </span>
      <Badge tone={contractorStatusTone(c.status)} size="sm">
        {contractorStatusLabel(c.status)}
      </Badge>
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center" }}>
        <StatusToggle
          id={c.id}
          active={c.status === "activo"}
          kind="contractor"
          ariaOn="Desactivar prestador"
          ariaOff="Activar prestador"
        />
        <button
          type="button"
          onClick={() => onEdit(c)}
          aria-label="Editar prestador"
          className="studio-btn studio-btn-ghost studio-btn-sm"
          style={{ padding: "6px 10px" }}
        >
          {Icon.edit(13)}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Compartidos
// ─────────────────────────────────────────────────────────────
function Toolbar({
  count,
  singular,
  plural,
  ctaLabel,
  onCta,
  ctaDisabled,
  extraCta,
}: {
  count: number;
  singular: string;
  plural: string;
  ctaLabel: string;
  onCta: () => void;
  ctaDisabled?: boolean;
  extraCta?: { label: string; onClick: () => void };
}) {
  return (
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
      <div style={{ font: "500 12.5px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
        {count === 0 ? `Sin ${plural}.` : `${count} ${count === 1 ? singular : plural}`}
      </div>
      <div style={{ display: "flex", gap: "var(--s-2)" }}>
        {extraCta && (
          <button type="button" className="studio-btn studio-btn-ghost" onClick={extraCta.onClick}>
            {extraCta.label}
          </button>
        )}
        <button
          type="button"
          className="studio-btn studio-btn-primary"
          onClick={onCta}
          disabled={ctaDisabled}
        >
          {ctaLabel}
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
        color: "var(--ink-mute)",
        borderBottom: "1px solid var(--border)",
        background: "var(--bg-elevated)",
      }}
    >
      {children}
    </div>
  );
}

/**
 * Toggle activo/inactivo. Llama la server action posicional (id, status) vía
 * useTransition; revalidatePath en la action refresca el listado. El gate de rol
 * (moduleEditDenial) y la RLS validan del lado servidor.
 */
function StatusToggle({
  id,
  active,
  kind,
  ariaOn,
  ariaOff,
}: {
  id: string;
  active: boolean;
  kind: "employee" | "contractor";
  ariaOn: string;
  ariaOff: string;
}) {
  const [isPending, startTransition] = useTransition();
  const toggle = () => {
    startTransition(async () => {
      if (kind === "employee") {
        await setEmployeeStatusAction(id, active ? "inactivo" : "activo");
      } else {
        await setContractorStatusAction(id, active ? "inactivo" : "activo");
      }
    });
  };
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      aria-label={active ? ariaOn : ariaOff}
      title={active ? ariaOn : ariaOff}
      style={{
        width: 38,
        height: 22,
        borderRadius: 999,
        background: active ? "var(--success)" : "var(--ink-mute)",
        border: 0,
        position: "relative",
        cursor: isPending ? "wait" : "pointer",
        opacity: isPending ? 0.6 : 1,
        transition: "background var(--dur-fast) var(--ease)",
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: 2,
          left: active ? 18 : 2,
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "#FFFFFF",
          transition: "left var(--dur-fast) var(--ease)",
        }}
      />
    </button>
  );
}

// ──────────────────────────────────────────────────────────────
// Préstamos (loans · Slice C)
// ──────────────────────────────────────────────────────────────
const LOAN_COLS = "minmax(200px,1.3fr) 1fr 110px 110px 96px 110px";

function PrestamosTab({
  loans,
  onNew,
  onRegisterCuota,
}: {
  loans: LoanWithBalance[];
  onNew: () => void;
  onRegisterCuota: (loan: LoanWithBalance) => void;
}) {
  return (
    <>
      <Toolbar
        count={loans.length}
        singular="préstamo"
        plural="préstamos"
        ctaLabel="+ Nuevo préstamo"
        onCta={onNew}
      />
      {loans.length === 0 ? (
        <EmptyState
          eyebrow="Sin préstamos"
          title="Aún no hay préstamos."
          description="Adelantos al empleado con una cuota que se descuenta del recibo. El descuento real lo aplica el motor de nómina; acá registras el préstamo y su saldo."
          action={
            <button type="button" className="studio-btn studio-btn-primary" onClick={onNew}>
              + Nuevo préstamo
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
          <TableHeader cols={LOAN_COLS}>
            <span>Empleado</span>
            <span>Concepto</span>
            <span style={{ textAlign: "right" }}>Cuota</span>
            <span style={{ textAlign: "right" }}>Saldo</span>
            <span>Estado</span>
            <span style={{ textAlign: "right" }}>Acciones</span>
          </TableHeader>
          {loans.map((l, i) => (
            <PrestamoRow
              key={l.id}
              l={l}
              first={i === 0}
              onRegisterCuota={onRegisterCuota}
            />
          ))}
        </div>
      )}
    </>
  );
}

function PrestamoRow({
  l,
  first,
  onRegisterCuota,
}: {
  l: LoanWithBalance;
  first: boolean;
  onRegisterCuota: (loan: LoanWithBalance) => void;
}) {
  const dimmed = l.status !== "activo";
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: LOAN_COLS,
        gap: 12,
        padding: "12px 20px",
        alignItems: "center",
        borderTop: first ? 0 : "1px solid var(--border)",
        opacity: dimmed ? 0.6 : 1,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            font: "700 13px/1.2 var(--f-sans)",
            color: "var(--ink)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {l.employee_name}
        </div>
        <div style={{ font: "600 11px/1.3 var(--f-mono)", color: "var(--ink-mute)" }}>
          {l.employee_code}
        </div>
      </div>
      <div style={{ font: "500 12.5px/1.3 var(--f-sans)", color: "var(--ink-soft)", minWidth: 0 }}>
        {l.concept ?? "—"}
      </div>
      <span style={{ font: "700 12.5px/1 var(--f-mono)", color: "var(--ink)", textAlign: "right" }}>
        {fmtUsd(l.installment_usd)}
      </span>
      <span style={{ font: "700 12.5px/1 var(--f-mono)", color: "var(--ink)", textAlign: "right" }}>
        {fmtUsd(l.balance_usd)}
      </span>
      <Badge tone={loanStatusTone(l.status)} size="sm">
        {loanStatusLabel(l.status)}
      </Badge>
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center" }}>
        {l.status === "activo" && (
          <button
            type="button"
            onClick={() => onRegisterCuota(l)}
            className="studio-btn studio-btn-ghost studio-btn-sm"
            style={{ padding: "6px 10px" }}
          >
            {l.balance_usd > 0 ? "Registrar cuota" : "Ver"}
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Amonestaciones (warnings · Slice C)
// ─────────────────────────────────────────────────────────────
const WARN_COLS = "100px minmax(200px,1.4fr) minmax(180px,1.2fr) 110px 100px 88px";

function AmonestacionesTab({
  warnings,
  employeeName,
  hasEmployees,
  onNew,
}: {
  warnings: Warning[];
  employeeName: Map<string, string>;
  hasEmployees: boolean;
  onNew: () => void;
}) {
  return (
    <>
      <Toolbar
        count={warnings.length}
        singular="amonestación"
        plural="amonestaciones"
        ctaLabel="+ Nueva amonestación"
        onCta={onNew}
        ctaDisabled={!hasEmployees}
      />
      {warnings.length === 0 ? (
        <EmptyState
          eyebrow="Sin amonestaciones"
          title="Aún no hay amonestaciones."
          description={
            hasEmployees
              ? "Documenta una falta del empleado con el asistente: causal (Art. 79 LOTTT), relato, testigos y acta."
              : "Primero registra al menos un empleado para poder amonestar."
          }
          action={
            hasEmployees ? (
              <button type="button" className="studio-btn studio-btn-primary" onClick={onNew}>
                + Nueva amonestación
              </button>
            ) : undefined
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
          <TableHeader cols={WARN_COLS}>
            <span>Código</span>
            <span>Empleado · Causal</span>
            <span>Relato</span>
            <span>Severidad</span>
            <span>Estado</span>
            <span style={{ textAlign: "right" }}>Acciones</span>
          </TableHeader>
          {warnings.map((w, i) => (
            <AmonestacionRow
              key={w.id}
              w={w}
              first={i === 0}
              employeeLabel={employeeName.get(w.employee_id) ?? "Empleado"}
            />
          ))}
        </div>
      )}
    </>
  );
}

function AmonestacionRow({
  w,
  first,
  employeeLabel,
}: {
  w: Warning;
  first: boolean;
  employeeLabel: string;
}) {
  const [isPending, startTransition] = useTransition();
  const anulada = w.status === "anulada";
  const anular = () => {
    startTransition(async () => {
      await anularAmonestacionAction(w.id);
    });
  };
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: WARN_COLS,
        gap: 12,
        padding: "12px 20px",
        alignItems: "center",
        borderTop: first ? 0 : "1px solid var(--border)",
        opacity: anulada ? 0.55 : 1,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ font: "700 12px/1.2 var(--f-mono)", color: "var(--ink)" }}>
          {w.warning_code}
        </div>
        <div style={{ font: "600 10.5px/1.3 var(--f-mono)", color: "var(--ink-mute)" }}>
          {fmtDate(w.issued_on)}
        </div>
      </div>

      <div style={{ minWidth: 0 }}>
        <div
          style={{
            font: "700 12.5px/1.3 var(--f-sans)",
            color: "var(--ink)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {employeeLabel}
        </div>
        <div
          style={{
            font: "500 11.5px/1.35 var(--f-sans)",
            color: "var(--ink-soft)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {w.cause}
        </div>
      </div>

      <div
        style={{
          font: "500 12px/1.4 var(--f-sans)",
          color: "var(--ink-soft)",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {w.narrative}
      </div>

      <Badge tone={warningSeverityTone(w.severity)} size="sm">
        {warningSeverityLabel(w.severity)}
      </Badge>

      <Badge tone={warningStatusTone(w.status)} size="sm">
        {warningStatusLabel(w.status)}
      </Badge>

      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
        {!anulada && (
          <button
            type="button"
            onClick={anular}
            disabled={isPending}
            className="studio-btn studio-btn-ghost studio-btn-sm"
            style={{ padding: "6px 10px", opacity: isPending ? 0.6 : 1 }}
          >
            {isPending ? "Anulando…" : "Anular"}
          </button>
        )}
      </div>
    </div>
  );
}
