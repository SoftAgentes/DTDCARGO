/**
 * /studio/nomina — Nómina / RRHH (SDD-0103 · Slices A/B/C).
 *
 * Server component: gatea por rol (requireModuleView → solo accounting/admin),
 * fetcha empleados + prestadores + pagos + reglas + asistencia + préstamos +
 * amonestaciones del tenant (RLS filtra por tenant Y rol) y delega la UI al
 * cliente. Es dinero + PII: la page no se renderiza para roles sin acceso
 * (redirect).
 */

import { createClient } from "@/lib/db/server";
import { requireModuleView } from "@/lib/studio/rbac-guard";
import { canEditModule } from "@/lib/studio/rbac";
import { listEmployees } from "@/lib/studio/nomina/employee-queries";
import { listPositions } from "@/lib/studio/nomina/position-queries";
import {
  listContractors,
  listContractorPayments,
} from "@/lib/studio/nomina/contractor-queries";
import { getVigentePayrollRules } from "@/lib/studio/nomina/payroll-rules-queries";
import {
  listAttendance,
  listHolidays,
} from "@/lib/studio/nomina/attendance-queries";
import { listLoansWithBalance } from "@/lib/studio/nomina/loan-queries";
import { listWarnings } from "@/lib/studio/nomina/warning-queries";
import { listPayrollRuns } from "@/lib/studio/nomina/payroll-run-queries";
import { listSettlements } from "@/lib/studio/nomina/settlement-queries";
import { listInvites } from "@/lib/studio/nomina/invite-queries";
import {
  listRegistrations,
  computeRegistrationKpis,
} from "@/lib/studio/nomina/registration-queries";
import { listAllComms } from "@/lib/studio/nomina/comms-queries";
import { computeEmployeeKpis } from "@/lib/studio/nomina/employee-types";
import { computeContractorKpis } from "@/lib/studio/nomina/contractor-types";
import { computeLoanKpis } from "@/lib/studio/nomina/loan-types";
import { computeWarningKpis } from "@/lib/studio/nomina/warning-types";
import { computePayrollRunKpis } from "@/lib/studio/nomina/payroll-run-types";
import { computeSettlementKpis } from "@/lib/studio/nomina/settlement-types";
import { NominaClient } from "./_components/NominaClient";

export const metadata = { title: "Nómina" };

export default async function NominaPage() {
  const role = await requireModuleView("nomina");
  // Dar acceso al sistema (invitar usuario) es admin-only (Usuarios). Gatea la
  // sección de acceso del alta unificada; la action lo re-valida server-side.
  const canManageUsers = canEditModule(role, "users");
  const supabase = await createClient();

  const [
    employees,
    positions,
    contractors,
    payments,
    rules,
    attendance,
    holidays,
    warnings,
    runs,
    settlements,
    invites,
    registrations,
    comms,
  ] = await Promise.all([
    listEmployees(supabase),
    listPositions(supabase),
    listContractors(supabase),
    listContractorPayments(supabase),
    getVigentePayrollRules(supabase),
    listAttendance(supabase),
    listHolidays(supabase),
    listWarnings(supabase),
    listPayrollRuns(supabase),
    listSettlements(supabase),
    listInvites(supabase),
    listRegistrations(supabase),
    listAllComms(supabase),
  ]);

  // Los préstamos derivan saldo combinando con sus cuotas y con los empleados.
  const loans = await listLoansWithBalance(supabase, employees);

  const employeeKpis = computeEmployeeKpis(employees);
  const contractorKpis = computeContractorKpis(contractors, payments);
  const loanKpis = computeLoanKpis(loans);
  const warningKpis = computeWarningKpis(warnings);
  const runKpis = computePayrollRunKpis(runs);
  const settlementKpis = computeSettlementKpis(settlements);
  const registrationKpis = computeRegistrationKpis(registrations);

  return (
    <div style={{ maxWidth: 1280 }}>
      <div style={{ marginBottom: "var(--s-6)" }}>
        <span className="studio-eyebrow">Finanzas · RRHH</span>
        <h1
          className="studio-display"
          style={{ fontSize: 30, margin: "var(--s-2) 0 var(--s-2)", color: "var(--ink)" }}
        >
          Nómina.
        </h1>
        <p
          style={{
            font: "400 13px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
            maxWidth: "62ch",
          }}
        >
          La ficha de cada empleado y los prestadores freelance. Los sueldos se
          manejan indexados en USD; el pago se hace en bolívares a la tasa del día.
        </p>
      </div>

      <NominaClient
        employees={employees}
        positions={positions}
        contractors={contractors}
        payments={payments}
        rules={rules}
        attendance={attendance}
        holidays={holidays}
        loans={loans}
        warnings={warnings}
        runs={runs}
        settlements={settlements}
        invites={invites}
        registrations={registrations}
        comms={comms}
        employeeKpis={employeeKpis}
        contractorKpis={contractorKpis}
        loanKpis={loanKpis}
        warningKpis={warningKpis}
        runKpis={runKpis}
        settlementKpis={settlementKpis}
        registrationKpis={registrationKpis}
        canManageUsers={canManageUsers}
      />
    </div>
  );
}
