/**
 * /studio/nomina/empleados/[codigo] — ficha 360° del empleado (SDD-0652 F1).
 *
 * Orden, a propósito:
 *
 *   1. `requireModuleView("nomina")`: la primera puerta, como el resto de Nómina.
 *   2. `getFichaEmpleadoAccess`: rol `admin` o `accounting` con la membresía
 *      activa, comprobado en el servidor **antes de leer la ficha**. Un acceso
 *      extra a `nomina` o la lectura propia de la 0181 no alcanzan: 404.
 *   3. La ficha se busca por código **en el tenant de esa membresía**. Si no
 *      existe, 404; si la lectura falla, se dice «No se pudo cargar» (no 404).
 *   4. Los bloques se leen en paralelo, cada uno con su propio error.
 *
 * Al navegador va la ficha con la cuenta ya enmascarada. Lo que es solo de
 * admin (correo de acceso, rol, último ingreso, pestaña Acceso) no se calcula
 * para Contabilidad.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { requireModuleView } from "@/lib/studio/rbac-guard";
import { canEditModule } from "@/lib/studio/rbac";
import { getEmployeeByCode } from "@/lib/studio/nomina/employee-queries";
import { toEmployeeEditView } from "@/lib/studio/nomina/employee-types";
import { listPositions } from "@/lib/studio/nomina/position-queries";
import { getFichaEmpleadoAccess } from "@/lib/studio/nomina/ficha-empleado-guard";
import { lineaDeTiempo, mesDeCaracas } from "@/lib/studio/nomina/ficha-empleado";
import {
  accesoDe,
  amonestacionesDe,
  asistenciaDelMes,
  cambioBancoPendiente,
  comunicacionesDe,
  finiquitosDe,
  nombresDelTenant,
  prestamosDe,
  recibosDe,
} from "@/lib/studio/nomina/ficha-empleado-queries";
import { Aviso } from "@/app/studio/_components/ui/Aviso";
import { FichaEmpleadoVista } from "./_components/FichaEmpleadoVista";

export const metadata = { title: "Ficha del empleado" };

export default async function FichaEmpleadoPage({ params }: { params: Promise<{ codigo: string }> }) {
  const role = await requireModuleView("nomina");
  const supabase = await createClient();

  const acceso = await getFichaEmpleadoAccess(supabase);
  if (!acceso.ok) notFound();

  const { codigo } = await params;
  const lookup = await getEmployeeByCode(supabase, acceso.tenantId, decodeURIComponent(codigo));
  if (lookup.kind === "not_found") notFound();
  if (lookup.kind === "error") {
    return (
      <div style={{ maxWidth: 720 }}>
        <Link href="/studio/nomina" className="studio-link-quiet" style={{ font: "500 12px/1 var(--f-sans)" }}>
          ← Volver a Empleados
        </Link>
        <div style={{ marginTop: "var(--s-4)" }}>
          <Aviso tono="error" titulo="No se pudo cargar la ficha">
            Hubo un problema al leer los datos. Recarga la página en unos segundos.
          </Aviso>
        </div>
      </div>
    );
  }

  const employee = lookup.employee;
  const ids = { tenantId: acceso.tenantId, employeeId: employee.id };
  const mes = mesDeCaracas();
  const admin = createAdminClient();
  const puedeEditar = canEditModule(role, "nomina");

  const [prestamos, asistencia, amonestaciones, recibos, finiquitos, comunicaciones, cambioBanco, accesoStudio, positions, nombres] =
    await Promise.all([
      prestamosDe(supabase, ids),
      asistenciaDelMes(supabase, ids, mes),
      amonestacionesDe(supabase, ids),
      recibosDe(supabase, ids),
      finiquitosDe(supabase, ids),
      comunicacionesDe(supabase, ids),
      cambioBancoPendiente(supabase, ids),
      accesoDe(admin, acceso.nivel, acceso.tenantId, employee.auth_user_id),
      listPositions(supabase),
      acceso.nivel === "admin" && employee.auth_user_id
        ? nombresDelTenant(admin, acceso.tenantId)
        : Promise.resolve({} as Record<string, string>),
    ]);

  const fallaron = Object.entries({ prestamos, amonestaciones, recibos, finiquitos, comunicaciones })
    .filter(([, b]) => !b.ok)
    .map(([k]) => k);

  const hechos = lineaDeTiempo({
    hireDate: employee.hire_date,
    comunicaciones: comunicaciones.ok ? comunicaciones.data : [],
    prestamos: prestamos.ok ? prestamos.data : [],
    amonestaciones: amonestaciones.ok ? amonestaciones.data : [],
    recibos: recibos.ok ? recibos.data : [],
    finiquitos: finiquitos.ok ? finiquitos.data : [],
  });

  const puesto = positions.find((x) => x.id === employee.position_id)?.title ?? null;

  return (
    <FichaEmpleadoVista
      nivel={acceso.nivel}
      employee={toEmployeeEditView(employee)}
      puesto={puesto}
      acceso={accesoStudio}
      positions={puedeEditar ? positions : null}
      mes={{ etiqueta: mes.etiqueta }}
      prestamos={prestamos}
      asistencia={asistencia}
      amonestaciones={amonestaciones}
      recibos={recibos}
      finiquitos={finiquitos}
      comunicaciones={comunicaciones}
      cambioBanco={cambioBanco}
      linea={{ hechos, fallaron }}
      nombres={nombres}
    />
  );
}
