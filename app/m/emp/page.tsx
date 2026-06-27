/**
 * /m/emp — app self-service del empleado (SDD-0113 Slice C).
 *
 * Superficie SEPARADA de /m/erp (que es el Studio móvil del admin). Aquí el
 * empleado entra con SU sesión Supabase (auth.users enlazado a su ficha vía
 * auth_user_id). Todo lo que ve está acotado a get_employee_id_for_user() por
 * RLS/RPC: su ficha, su recibo confirmado/pagado, sus comunicaciones.
 *
 * Server component: resuelve la sesión y carga los datos del propio empleado;
 * la interacción (tabs, marcar leído, acuse, perfil) vive en EmpClient.
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import {
  getMyEmployee,
  getMyPayslip,
  getMyPayslipPeriods,
  getMyPendingBankChange,
} from "@/lib/studio/nomina/employee-self-queries";
import { listMyComms } from "@/lib/studio/nomina/comms-queries";
import { EmpClient } from "./_components/EmpClient";

export const metadata = { title: "Mi espacio" };

export default async function EmpPage() {
  const supabase = await createClient();

  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) redirect("/studio/login?next=/m/emp");

  const me = await getMyEmployee(supabase);
  // Sesión válida pero sin ficha de empleado enlazada → no es un empleado.
  if (!me) {
    return (
      <main
        style={{
          minHeight: "100dvh",
          background: "var(--bg-base)",
          padding: "48px 20px",
          maxWidth: 520,
          margin: "0 auto",
        }}
      >
        <span className="studio-eyebrow">DTD Cargo · RRHH</span>
        <h1 className="studio-display" style={{ fontSize: 22, margin: "8px 0", color: "var(--ink)" }}>
          Sin acceso de empleado
        </h1>
        <p style={{ font: "400 13px/1.5 var(--f-sans)", color: "var(--ink-soft)" }}>
          Tu cuenta no está enlazada a una ficha de empleado activa. Si crees que es un error,
          contacta a Recursos Humanos.
        </p>
      </main>
    );
  }

  const [payslip, periods, comms, pendingBank] = await Promise.all([
    getMyPayslip(supabase, null),
    getMyPayslipPeriods(supabase),
    listMyComms(supabase),
    getMyPendingBankChange(supabase),
  ]);

  return (
    <EmpClient
      me={me}
      payslip={payslip}
      periods={periods}
      comms={comms}
      pendingBank={pendingBank}
    />
  );
}
