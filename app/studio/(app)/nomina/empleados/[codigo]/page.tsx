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
import {
  hechosDeEventos,
  lineaDeTiempo,
  mesDeCaracas,
  sugerenciaDeEnlace,
  unirHechos,
} from "@/lib/studio/nomina/ficha-empleado";
import { firmarFotos, rutasDeFoto } from "@/lib/studio/nomina/employee-photo";
import {
  accesoDe,
  amonestacionesDe,
  asistenciaDelMes,
  cambioBancoPendiente,
  candidatosDeEnlace,
  comunicacionesDe,
  eventosDe,
  finiquitosDe,
  nombresDelTenant,
  prestamosDe,
  recibosDe,
} from "@/lib/studio/nomina/ficha-empleado-queries";
import { ReintentarCarga } from "./_components/ReintentarCarga";
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
          <ReintentarCarga titulo="No se pudo cargar la ficha">
            Hubo un problema al leer los datos. Vuelve a intentarlo en unos segundos.
          </ReintentarCarga>
        </div>
      </div>
    );
  }

  const employee = lookup.employee;
  const ids = { tenantId: acceso.tenantId, employeeId: employee.id };
  const mes = mesDeCaracas();
  const admin = createAdminClient();
  const puedeEditar = canEditModule(role, "nomina");

  // Fase 2. Los candidatos a enlazar se calculan solo para admin y solo si la
  // ficha no tiene cuenta: a Contabilidad no le llega ni la lista ni la
  // sugerencia. La foto se firma aquí, después del control de rol.
  const esAdmin = acceso.nivel === "admin";
  const [
    prestamos,
    asistencia,
    amonestaciones,
    recibos,
    finiquitos,
    comunicaciones,
    cambioBanco,
    accesoStudio,
    positions,
    nombres,
    eventos,
    candidatos,
    rutasFoto,
  ] = await Promise.all([
      prestamosDe(supabase, ids),
      asistenciaDelMes(supabase, ids, mes),
      amonestacionesDe(supabase, ids),
      recibosDe(supabase, ids),
      finiquitosDe(supabase, ids),
      comunicacionesDe(supabase, ids),
      cambioBancoPendiente(supabase, ids),
      accesoDe(admin, acceso.nivel, acceso.tenantId, employee.auth_user_id),
      listPositions(supabase),
      // Quién hizo cada cambio de la línea de tiempo: nombres del equipo, para los dos niveles.
      nombresDelTenant(admin, acceso.tenantId),
      eventosDe(supabase, employee.id),
      esAdmin && !employee.auth_user_id ? candidatosDeEnlace(admin, acceso.tenantId) : Promise.resolve(null),
      rutasDeFoto(supabase, acceso.tenantId, [employee.id]),
    ]);

  const rutaFoto = rutasFoto.get(employee.id) ?? null;
  const fotoUrl = rutaFoto ? ((await firmarFotos(admin, [rutaFoto])).get(rutaFoto) ?? null) : null;
  const sugerencia =
    esAdmin && candidatos?.ok && employee.status !== "egresado"
      ? sugerenciaDeEnlace(employee.email, candidatos.data)
      : null;

  const fallaron = Object.entries({ prestamos, amonestaciones, recibos, finiquitos, comunicaciones, eventos })
    .filter(([, b]) => !b.ok)
    .map(([k]) => k);

  const hechos = unirHechos(
    lineaDeTiempo({
      hireDate: employee.hire_date,
      comunicaciones: comunicaciones.ok ? comunicaciones.data : [],
      prestamos: prestamos.ok ? prestamos.data : [],
      amonestaciones: amonestaciones.ok ? amonestaciones.data : [],
      recibos: recibos.ok ? recibos.data : [],
      finiquitos: finiquitos.ok ? finiquitos.data : [],
    }),
    eventos.ok ? hechosDeEventos(eventos.data, nombres) : [],
  );

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
      nombres={esAdmin ? nombres : {}}
      fotoUrl={fotoUrl}
      candidatos={candidatos}
      sugerencia={sugerencia}
    />
  );
}
