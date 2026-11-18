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
import { getVigentePayrollRulesConEstado } from "@/lib/studio/nomina/payroll-rules-queries";
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
import { computeEmployeeKpis, toEmployeeListItem } from "@/lib/studio/nomina/employee-types";
import { createAdminClient } from "@/lib/db/admin";
import { getFichaEmpleadoAccess } from "@/lib/studio/nomina/ficha-empleado-guard";
import { firmarFotos, rutasDeFoto } from "@/lib/studio/nomina/employee-photo";
import { computeContractorKpis } from "@/lib/studio/nomina/contractor-types";
import { computeLoanKpis } from "@/lib/studio/nomina/loan-types";
import { computeWarningKpis } from "@/lib/studio/nomina/warning-types";
import { computePayrollRunKpis } from "@/lib/studio/nomina/payroll-run-types";
import { computeSettlementKpis } from "@/lib/studio/nomina/settlement-types";
import { NominaClient } from "./_components/NominaClient";

export const metadata = { title: "Nómina" };

export default async function NominaPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string | string[] }>;
}) {
  const params = (await searchParams) ?? {};
  const initialTab = typeof params.tab === "string" ? params.tab : undefined;
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
    reglasEstado,
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
    getVigentePayrollRulesConEstado(supabase),
    listAttendance(supabase),
    listHolidays(supabase),
    listWarnings(supabase),
    listPayrollRuns(supabase),
    listSettlements(supabase),
    listInvites(supabase),
    listRegistrations(supabase),
    listAllComms(supabase),
  ]);

  // SDD-0653 A2b: las reglas y si la base ya tiene la migración 0556 (campos nuevos del formulario).
  const rules = reglasEstado.rules;
  const reglasAmpliada = reglasEstado.ampliada;

  // Los préstamos derivan saldo combinando con sus cuotas y con los empleados.
  const loans = await listLoansWithBalance(supabase, employees);

  // SDD-0652 fase 2: fotos de la fila. Solo para rol admin o accounting activo
  // (D4); se firman aquí, en el servidor, con vida corta. La ruta del bucket no
  // viaja. Sin la migración 0555 aplicada no hay columna y nadie tiene foto.
  const fotos = new Map<string, string>();
  const accesoFicha = await getFichaEmpleadoAccess(supabase);
  if (accesoFicha.ok && employees.length > 0) {
    const rutas = await rutasDeFoto(
      supabase,
      accesoFicha.tenantId,
      employees.filter((e) => e.tenant_id === accesoFicha.tenantId).map((e) => e.id),
    );
    if (rutas.size > 0) {
      const firmadas = await firmarFotos(createAdminClient(), [...rutas.values()]);
      for (const [id, ruta] of rutas) {
        const url = firmadas.get(ruta);
        if (url) fotos.set(id, url);
      }
    }
  }

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
        // SDD-0652 F1: al navegador va la proyección de lista, sin cédula,
        // sueldo, nacimiento, teléfono ni cuenta. La fila completa se queda en
        // el servidor (KPIs y préstamos se calculan aquí arriba). Las solicitudes
        // (fase 2, N2) también llegan como proyección: `listRegistrations` ni
        // siquiera lee la cédula ni la cuenta.
        employees={employees.map((e) => toEmployeeListItem(e, fotos.get(e.id) ?? null))}
        initialTab={initialTab}
        positions={positions}
        contractors={contractors}
        payments={payments}
        rules={rules}
        reglasAmpliada={reglasAmpliada}
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
