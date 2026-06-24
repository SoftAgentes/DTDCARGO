/**
 * /studio/nomina — Nómina / RRHH (SDD-0103 · Slice A).
 *
 * Server component: gatea por rol (requireModuleView → solo accounting/admin),
 * fetcha empleados + prestadores + pagos del tenant (RLS filtra por tenant Y
 * rol) y delega la UI al cliente. Es dinero + PII: la page no se renderiza para
 * roles sin acceso (redirect).
 */

import { createClient } from "@/lib/db/server";
import { requireModuleView } from "@/lib/studio/rbac-guard";
import { listEmployees } from "@/lib/studio/nomina/employee-queries";
import {
  listContractors,
  listContractorPayments,
} from "@/lib/studio/nomina/contractor-queries";
import { getVigentePayrollRules } from "@/lib/studio/nomina/payroll-rules-queries";
import { computeEmployeeKpis } from "@/lib/studio/nomina/employee-types";
import { computeContractorKpis } from "@/lib/studio/nomina/contractor-types";
import { NominaClient } from "./_components/NominaClient";

export const metadata = { title: "Nómina" };

export default async function NominaPage() {
  await requireModuleView("nomina");
  const supabase = await createClient();

  const [employees, contractors, payments, rules] = await Promise.all([
    listEmployees(supabase),
    listContractors(supabase),
    listContractorPayments(supabase),
    getVigentePayrollRules(supabase),
  ]);

  const employeeKpis = computeEmployeeKpis(employees);
  const contractorKpis = computeContractorKpis(contractors, payments);

  return (
    <div style={{ maxWidth: 1280 }}>
      <div style={{ marginBottom: "var(--s-6)" }}>
        <span className="studio-eyebrow">Finanzas · RRHH</span>
        <h1
          className="studio-display"
          style={{ fontSize: 30, margin: "8px 0 8px", color: "var(--ink)" }}
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
        contractors={contractors}
        payments={payments}
        rules={rules}
        employeeKpis={employeeKpis}
        contractorKpis={contractorKpis}
      />
    </div>
  );
}
