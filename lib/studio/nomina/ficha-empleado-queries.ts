/**
 * Consultas de la ficha 360° del empleado (SDD-0652 F1).
 *
 * Cada bloque se lee con su propia consulta, acotada por `employee_id` **y**
 * `tenant_id` y con límite. Si una falla, devuelve `BLOQUE_ERROR` y la ficha
 * lo dice en ese bloque: un error nunca se muestra como «no hay» (§5.3).
 *
 * Quien llama ya comprobó el rol (`getFichaEmpleadoAccess`). La RLS de Nómina
 * sigue siendo la segunda capa.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { num } from "./employee-types";
import {
  BLOQUE_ERROR,
  bloqueOk,
  type AccesoStudio,
  type AsistenciaDia,
  type Bloque,
  type CandidatoEnlace,
  type EventoFicha,
  type NivelFicha,
  type PrestamoFicha,
} from "./ficha-empleado";
import type { StudioUserRole } from "@/lib/studio/user-types";

/** Cuántos hechos de cada clase trae la ficha. «Ver todo» lleva a la pestaña de Nómina. */
export const LIMITES = {
  prestamos: 20,
  amonestaciones: 20,
  recibos: 12,
  finiquitos: 5,
  comunicaciones: 20,
} as const;

type Ids = { tenantId: string; employeeId: string };

export async function prestamosDe(supabase: SupabaseClient, { tenantId, employeeId }: Ids): Promise<Bloque<PrestamoFicha[]>> {
  const { data, error } = await supabase
    .from("nomina_loans")
    .select("id, granted_on, principal_usd, installment_usd, installments_total, status, concept")
    .eq("tenant_id", tenantId)
    .eq("employee_id", employeeId)
    .is("deleted_at", null)
    .order("granted_on", { ascending: false })
    .limit(LIMITES.prestamos);
  if (error) {
    console.error("[ficha-empleado] prestamos", error.message);
    return BLOQUE_ERROR;
  }
  const loans = data ?? [];
  if (loans.length === 0) return bloqueOk([]);

  const { data: cuotas, error: errCuotas } = await supabase
    .from("nomina_loan_installments")
    .select("loan_id, amount_usd")
    .eq("tenant_id", tenantId)
    .in(
      "loan_id",
      loans.map((l) => l.id as string),
    )
    .is("deleted_at", null);
  if (errCuotas) {
    console.error("[ficha-empleado] cuotas", errCuotas.message);
    return BLOQUE_ERROR;
  }
  const pagado = new Map<string, number>();
  for (const c of cuotas ?? []) {
    const id = c.loan_id as string;
    pagado.set(id, (pagado.get(id) ?? 0) + num(c.amount_usd));
  }
  return bloqueOk(
    loans.map((l) => ({
      id: l.id as string,
      granted_on: l.granted_on as string,
      principal_usd: num(l.principal_usd),
      installment_usd: num(l.installment_usd),
      installments_total: Number(l.installments_total ?? 1),
      status: l.status as PrestamoFicha["status"],
      concept: (l.concept as string | null) ?? null,
      paid_usd: Math.round((pagado.get(l.id as string) ?? 0) * 100) / 100,
    })),
  );
}

export async function asistenciaDelMes(
  supabase: SupabaseClient,
  { tenantId, employeeId }: Ids,
  mes: { desde: string; hasta: string },
): Promise<Bloque<AsistenciaDia[]>> {
  const { data, error } = await supabase
    .from("nomina_attendance")
    .select("work_date, status")
    .eq("tenant_id", tenantId)
    .eq("employee_id", employeeId)
    .is("deleted_at", null)
    .gte("work_date", mes.desde)
    .lte("work_date", mes.hasta)
    .limit(31);
  if (error) {
    console.error("[ficha-empleado] asistencia", error.message);
    return BLOQUE_ERROR;
  }
  return bloqueOk((data ?? []) as AsistenciaDia[]);
}

export type AmonestacionFicha = { id: string; issued_on: string; warning_code: string; severity: string; status: string };

export async function amonestacionesDe(supabase: SupabaseClient, { tenantId, employeeId }: Ids): Promise<Bloque<AmonestacionFicha[]>> {
  const { data, error } = await supabase
    .from("nomina_warnings")
    .select("id, issued_on, warning_code, severity, status")
    .eq("tenant_id", tenantId)
    .eq("employee_id", employeeId)
    .is("deleted_at", null)
    .order("issued_on", { ascending: false })
    .limit(LIMITES.amonestaciones);
  if (error) {
    console.error("[ficha-empleado] amonestaciones", error.message);
    return BLOQUE_ERROR;
  }
  return bloqueOk((data ?? []) as AmonestacionFicha[]);
}

export type ReciboFicha = { id: string; period_label: string; period_end: string; net_usd: number; run_status: string };

export async function recibosDe(supabase: SupabaseClient, { tenantId, employeeId }: Ids): Promise<Bloque<ReciboFicha[]>> {
  const { data, error } = await supabase
    .from("nomina_payroll_run_lines")
    .select("id, net_usd, run:nomina_payroll_runs!inner(period_label, period_end, status, deleted_at)")
    .eq("tenant_id", tenantId)
    .eq("employee_id", employeeId)
    .is("run.deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(LIMITES.recibos);
  if (error) {
    console.error("[ficha-empleado] recibos", error.message);
    return BLOQUE_ERROR;
  }
  type Fila = { id: string; net_usd: unknown; run: { period_label: string; period_end: string; status: string } | null };
  return bloqueOk(
    ((data ?? []) as unknown as Fila[])
      .filter((r) => r.run)
      .map((r) => ({
        id: r.id,
        period_label: r.run!.period_label,
        period_end: r.run!.period_end,
        net_usd: num(r.net_usd),
        run_status: r.run!.status,
      })),
  );
}

export type FiniquitoFicha = { id: string; settlement_code: string; termination_date: string; status: string; created_at: string };

export async function finiquitosDe(supabase: SupabaseClient, { tenantId, employeeId }: Ids): Promise<Bloque<FiniquitoFicha[]>> {
  const { data, error } = await supabase
    .from("nomina_settlements")
    .select("id, settlement_code, termination_date, status, created_at")
    .eq("tenant_id", tenantId)
    .eq("employee_id", employeeId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(LIMITES.finiquitos);
  if (error) {
    console.error("[ficha-empleado] finiquitos", error.message);
    return BLOQUE_ERROR;
  }
  return bloqueOk((data ?? []) as FiniquitoFicha[]);
}

export type ComunicacionFicha = { id: string; created_at: string; type: string; title: string; read_at: string | null; acked_at: string | null; requires_ack: boolean };

export async function comunicacionesDe(supabase: SupabaseClient, { tenantId, employeeId }: Ids): Promise<Bloque<ComunicacionFicha[]>> {
  const { data, error } = await supabase
    .from("nomina_employee_comms")
    .select("id, created_at, type, title, read_at, acked_at, requires_ack")
    .eq("tenant_id", tenantId)
    .eq("employee_id", employeeId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(LIMITES.comunicaciones);
  if (error) {
    console.error("[ficha-empleado] comunicaciones", error.message);
    return BLOQUE_ERROR;
  }
  return bloqueOk((data ?? []) as ComunicacionFicha[]);
}

/** ¿Hay una solicitud de cambio de banco pendiente? Sin los datos nuevos: solo el aviso. */
export async function cambioBancoPendiente(supabase: SupabaseClient, { tenantId, employeeId }: Ids): Promise<Bloque<boolean>> {
  const { count, error } = await supabase
    .from("nomina_employee_bank_changes")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("employee_id", employeeId)
    .eq("status", "pendiente");
  if (error) {
    console.error("[ficha-empleado] cambio de banco", error.message);
    return BLOQUE_ERROR;
  }
  return bloqueOk((count ?? 0) > 0);
}

/**
 * Acceso al Studio de la cuenta enlazada (§5.1).
 *
 * `user_tenants` solo deja leer la fila propia (0200), así que se usa el cliente
 * admin, **siempre filtrado por el tenant del que mira** y por el `user_id`
 * enlazado. Para Contabilidad se devuelve solo sí o no; el correo de acceso, el
 * rol y el último ingreso solo salen para admin (D10).
 */
export async function accesoDe(
  admin: SupabaseClient,
  nivel: NivelFicha,
  tenantId: string,
  authUserId: string | null,
): Promise<AccesoStudio> {
  if (!authUserId) {
    return nivel === "admin"
      ? { nivel, cuentaEnlazada: false, correoAcceso: null, rol: null, suspendido: false, ultimoIngreso: null, userId: null, error: false }
      : { nivel, cuentaEnlazada: false, conAcceso: false };
  }

  const { data: membresia, error: errM } = await admin
    .from("user_tenants")
    .select("role, disabled_at, last_login_at")
    .eq("tenant_id", tenantId)
    .eq("user_id", authUserId)
    .maybeSingle<{ role: StudioUserRole; disabled_at: string | null; last_login_at: string | null }>();

  if (nivel === "contabilidad") {
    if (errM) return { nivel, cuentaEnlazada: true, conAcceso: null };
    return { nivel, cuentaEnlazada: true, conAcceso: !!membresia && !membresia.disabled_at };
  }

  const { data: authResp, error: errA } = await admin.auth.admin.getUserById(authUserId);
  const correo = authResp?.user?.email ?? null;
  // La más reciente entre la columna de la membresía y la de Auth (SDD-0275).
  const deAuth = authResp?.user?.last_sign_in_at ?? null;
  const deTenant = membresia?.last_login_at ?? null;
  const ultimo =
    deAuth && deTenant ? (new Date(deAuth) > new Date(deTenant) ? deAuth : deTenant) : (deAuth ?? deTenant);

  return {
    nivel,
    cuentaEnlazada: true,
    correoAcceso: correo,
    rol: membresia?.role ?? null,
    suspendido: !!membresia?.disabled_at,
    ultimoIngreso: ultimo,
    userId: authUserId,
    error: !!errM || !!errA,
  };
}

/** Cuántos eventos de la ficha trae la línea de tiempo en la primera página. */
export const LIMITE_EVENTOS = 50;

/**
 * Eventos de auditoría de la ficha (RPC de la migración 0555): enlace, foto,
 * consulta de la cuenta y anulación de sus finiquitos. La RPC repite el control
 * de rol y de tenant y no devuelve payload ni motivo.
 *
 * Sin la 0555 aplicada la RPC no existe (PGRST202 o 42883) y tampoco hay
 * eventos que mostrar: nada los escribió todavía. Ese caso devuelve una lista
 * vacía. Cualquier otro error sí es un error y la línea de tiempo lo dice.
 */
export async function eventosDe(supabase: SupabaseClient, employeeId: string): Promise<Bloque<EventoFicha[]>> {
  const { data, error } = await supabase.rpc("nomina_employee_timeline_events", {
    p_employee_id: employeeId,
    p_cursor: null,
    p_limit: LIMITE_EVENTOS,
  });
  if (error?.code === "PGRST202" || error?.code === "42883") return bloqueOk([]);
  if (error) {
    console.error("[ficha-empleado] eventos", error.code ?? "error");
    return BLOQUE_ERROR;
  }
  type Fila = { id: string; entity_type: string; event_type: string; occurred_at: string; actor_id: string | null };
  return bloqueOk(
    ((data ?? []) as Fila[]).map((r) => ({
      id: r.id,
      entity_type: r.entity_type,
      event_type: r.event_type,
      occurred_at: r.occurred_at,
      actor_id: r.actor_id,
    })),
  );
}

/** Tope de candidatos: el equipo es pequeño; si algún día no cabe, se corta aquí. */
export const LIMITE_CANDIDATOS = 100;

/**
 * Miembros activos del Studio del tenant que todavía no tienen ficha viva
 * (§4 punto 1). **Solo para admin**: quien llama lo comprueba antes.
 *
 * Usa el cliente admin, siempre filtrado por el tenant. El correo de acceso
 * sirve solo para reconocer a la persona en el selector.
 */
export async function candidatosDeEnlace(admin: SupabaseClient, tenantId: string): Promise<Bloque<CandidatoEnlace[]>> {
  const { data: miembros, error: errM } = await admin
    .from("user_tenants")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .is("disabled_at", null)
    .limit(LIMITE_CANDIDATOS);
  if (errM) {
    console.error("[ficha-empleado] candidatos", errM.message);
    return BLOQUE_ERROR;
  }
  const ids = (miembros ?? []).map((m) => m.user_id as string);
  if (ids.length === 0) return bloqueOk([]);

  const [conFicha, clientes, perfiles] = await Promise.all([
    admin.from("nomina_employees").select("auth_user_id").in("auth_user_id", ids).is("deleted_at", null),
    admin.from("client_users").select("auth_user_id").in("auth_user_id", ids),
    admin.from("user_profiles").select("user_id, first_name, last_name").in("user_id", ids),
  ]);
  // Si no se puede saber quién ya tiene ficha o quién es cliente, no se ofrece a nadie.
  const fallo = conFicha.error ?? clientes.error ?? perfiles.error;
  if (fallo) {
    console.error("[ficha-empleado] candidatos", fallo.message);
    return BLOQUE_ERROR;
  }
  const fuera = new Set<string>([
    ...(conFicha.data ?? []).map((r) => r.auth_user_id as string),
    ...(clientes.data ?? []).map((r) => r.auth_user_id as string),
  ]);
  const nombre = new Map<string, string>();
  for (const p of perfiles.data ?? []) {
    const n = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
    if (n) nombre.set(p.user_id as string, n);
  }

  const libres = ids.filter((id) => !fuera.has(id));
  const candidatos = await Promise.all(
    libres.map(async (userId) => {
      const { data, error } = await admin.auth.admin.getUserById(userId);
      const correo = error ? null : (data?.user?.email ?? null);
      return { userId, nombre: nombre.get(userId) ?? correo ?? "Usuario sin nombre", correoAcceso: correo };
    }),
  );
  return bloqueOk(candidatos.sort((a, b) => a.nombre.localeCompare(b.nombre, "es")));
}

/** Nombres de los miembros del tenant, para la pestaña Acceso (quién cambió qué). */
export async function nombresDelTenant(admin: SupabaseClient, tenantId: string): Promise<Record<string, string>> {
  const { data: miembros, error } = await admin.from("user_tenants").select("user_id").eq("tenant_id", tenantId).limit(500);
  if (error || !miembros?.length) return {};
  const ids = miembros.map((m) => m.user_id as string);
  const { data: perfiles } = await admin.from("user_profiles").select("user_id, first_name, last_name").in("user_id", ids);
  const out: Record<string, string> = {};
  for (const p of perfiles ?? []) {
    const nombre = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
    if (nombre) out[p.user_id as string] = nombre;
  }
  return out;
}
