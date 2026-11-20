import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { canAccessModule, type RoleModuleOverrides } from "@/lib/studio/rbac";
import { DECISION_COLUMNS, grantsFromRows, type GrantDecisionRow } from "@/lib/studio/user-module-grants-queries";
import type { StudioUserRole } from "@/lib/studio/user-types";
import { drainOperarioPushOutbox, enqueueUserPush } from "@/lib/studio/notify/operario-push-outbox";
import type { ChatwootConfig } from "./config";
import { aplicarMatriz, type ResultadoMatriz } from "./agentes-matriz";
import { cerrarSesionesAgente } from "./cierre-sesion";
import type { AgenteMatriz } from "./matriz";
import { listarMiembrosCuenta, quitarDeCuenta, type MiembroCuenta } from "./platform-api";
import {
  bloqueoDeBaja,
  decidirBaja,
  evaluarSalud,
  type AlertaSalud,
  type EstadoMiembroStudio,
  type SaludBandeja,
  type VinculoAgente,
} from "./agentes-salud";

/**
 * Ciclo de vida de los agentes de Chatwoot (SDD-0585, paso 2.5).
 *
 * `sincronizarAgentes` compara cada vínculo (0503) con el estado del usuario en
 * Studio y da de baja al que sobra:
 *  1. lo saca de la cuenta de Chatwoot (`quitarDeCuenta`), salvo que sea el
 *     usuario de servicio o el último admin humano (`bloqueoDeBaja`);
 *  2. cierra a la fuerza sus sesiones y rota su token de API (`cerrarSesionesAgente`,
 *     paso 2.7). Si el cierre falla, el vínculo queda y la próxima corrida lo
 *     reintenta (ya fuera de la cuenta, así que no ve nada mientras tanto);
 *  3. anota la baja con su fecha (0508), para borrar el usuario de Chatwoot a
 *     los 12 meses. Sin la 0508 avisa y sigue: no se frena una baja por eso;
 *  4. borra el vínculo.
 *
 * Después aplica la matriz del 2.7 (`aplicarMatriz`) a los vínculos que
 * quedan: «Studio manda» en roles, bandejas y equipos.
 *
 * Si Chatwoot no responde no hay baja: sin la lista de la cuenta no se puede
 * comprobar el candado, y borrar solo el vínculo dejaría al agente en la cuenta
 * sin que nada vuelva a mirarlo. El vínculo queda y la próxima corrida reintenta.
 *
 * Lo llaman Usuarios (al desactivar o cambiar el rol, solo ese usuario) y el
 * cron diario `chatwoot-agentes` (todos, más la salud y el aviso). Corre con
 * service_role en UN tenant. Los logs llevan solo códigos.
 */

export interface ContextoAgentes {
  admin: SupabaseClient;
  tenantId: string;
  cfg: ChatwootConfig;
  servicioId: number | null;
}

export interface ResultadoSincronizacion {
  revisados: number;
  bajas: number;
  bloqueadas: number;
  fallidas: number;
  /** Bajas que ya salieron de la cuenta pero cuyo cierre de sesiones falló. */
  cierresPendientes: number;
  matriz?: Omit<ResultadoMatriz, "miembrosCuenta">;
  salud: SaludBandeja;
  /** Sin la 0503 (no hay vínculos que revisar): no se toca nada. */
  omitido?: true;
  /**
   * SDD-0675: bajas «sin_bandeja» que esperan porque no se pudieron leer los
   * accesos adicionales. Las de «desactivado» y «fuera_del_tenant» sí se aplican.
   */
  sinBandejaEnEspera?: number;
  /**
   * SDD-0675 (absorbe la SDD-0677): no se pudieron leer los miembros
   * (`user_tenants`) o los desvíos por rol. Sin eso todos parecerían fuera del
   * tenant o con los permisos por defecto: no se aplica ninguna baja ni la matriz.
   */
  sinEstado?: true;
}

type FilaVinculo = { user_id: string; chatwoot_user_id: number };
type FilaMiembro = { user_id: string; role: StudioUserRole; disabled_at: string | null };
type FilaOverride = { role: string; module_id: string; can_view: boolean; can_edit: boolean };

/**
 * Estado de cada miembro en Studio. SDD-0675: `puedeBandeja` suma el acceso
 * adicional vigente de la persona (`studio_user_module_grants`, 0538), igual que
 * `canAccessModule` en la pantalla. Si esa lectura falla, `accesosLeidos` es
 * false: el ciclo aplica igual las bajas que no dependen del acceso
 * (desactivado, fuera del tenant) y deja en espera las «sin_bandeja».
 *
 * Si falla la lectura de los miembros o de los desvíos por rol, `estadoLeido`
 * es false: un mapa vacío haría que todos parecieran «fuera_del_tenant» (baja
 * masiva) y sin desvíos se decidiría con los permisos por defecto.
 */
async function estadoEnStudio(
  ctx: ContextoAgentes,
): Promise<{ mapa: Map<string, EstadoMiembroStudio>; accesosLeidos: boolean; estadoLeido: boolean }> {
  const [{ data: miembros, error: errorMiembros }, { data: overridesFilas, error: errorOverrides }, accesos] = await Promise.all([
    ctx.admin.from("user_tenants").select("user_id, role, disabled_at").eq("tenant_id", ctx.tenantId),
    ctx.admin.from("studio_role_module_overrides").select("role, module_id, can_view, can_edit").eq("tenant_id", ctx.tenantId),
    ctx.admin
      .from("studio_user_module_grants")
      .select(DECISION_COLUMNS)
      .eq("tenant_id", ctx.tenantId)
      .eq("module_id", "bandeja"),
  ]);
  const estadoLeido = !errorMiembros && !errorOverrides;
  if (!estadoLeido) {
    console.warn(
      `[chatwoot-agentes] estado de Studio no disponible: miembros ${errorMiembros?.code ?? "ok"}, desvíos ${errorOverrides?.code ?? "ok"}`,
    );
  }
  const accesosLeidos = !accesos.error;
  if (accesos.error) {
    console.warn(`[chatwoot-agentes] accesos por persona no disponibles: ${accesos.error.code ?? "sin código"}`);
  }
  const filasAcceso = accesosLeidos ? ((accesos.data ?? []) as GrantDecisionRow[]) : [];
  const overrides: Record<string, { view: boolean; edit: boolean }> = {};
  for (const o of (overridesFilas ?? []) as FilaOverride[]) {
    overrides[`${o.role}:${o.module_id}`] = { view: o.can_view, edit: o.can_edit };
  }
  const mapa = new Map<string, EstadoMiembroStudio>();
  for (const fila of (miembros ?? []) as FilaMiembro[]) {
    const grants = grantsFromRows(filasAcceso.filter((g) => g.user_id === fila.user_id && g.module_id === "bandeja"));
    const porRol = canAccessModule(fila.role, "bandeja", overrides as RoleModuleOverrides);
    const conAcceso = canAccessModule(fila.role, "bandeja", overrides as RoleModuleOverrides, grants);
    mapa.set(fila.user_id, {
      userId: fila.user_id,
      activo: fila.disabled_at === null,
      puedeBandeja: conAcceso,
      rol: fila.role,
      porAcceso: conAcceso && !porRol,
    });
  }
  return { mapa, accesosLeidos, estadoLeido };
}

export async function sincronizarAgentes(
  ctx: ContextoAgentes,
  opciones: { soloUsuario?: string } = {},
): Promise<ResultadoSincronizacion> {
  let consulta = ctx.admin.from("chatwoot_agent_links").select("user_id, chatwoot_user_id").eq("tenant_id", ctx.tenantId);
  if (opciones.soloUsuario) consulta = consulta.eq("user_id", opciones.soloUsuario);
  const { data: filas, error } = await consulta;
  if (error) {
    console.warn(`[chatwoot-agentes] vínculos no disponibles: ${error.code ?? "sin código"}`);
    return {
      revisados: 0,
      bajas: 0,
      bloqueadas: 0,
      fallidas: 0,
      cierresPendientes: 0,
      salud: { alertas: [], adminsHumanos: null, vinculosFueraDeCuenta: [] },
      omitido: true,
    };
  }
  const vinculos: VinculoAgente[] = ((filas ?? []) as FilaVinculo[]).map((f) => ({
    userId: f.user_id,
    chatwootUserId: f.chatwoot_user_id,
  }));
  const [{ mapa: estado, accesosLeidos, estadoLeido }, cuenta] = await Promise.all([
    estadoEnStudio(ctx),
    listarMiembrosCuenta(ctx.cfg),
  ]);
  let miembrosCuenta: MiembroCuenta[] = cuenta.ok ? [...cuenta.data] : [];
  const quedan: VinculoAgente[] = [];
  let bajas = 0;
  let bloqueadas = 0;
  let fallidas = 0;
  let cierresPendientes = 0;
  let sinBandejaEnEspera = 0;

  for (const v of vinculos) {
    // Sin el estado de Studio no se decide ninguna baja: todos se quedan.
    if (!estadoLeido) {
      quedan.push(v);
      continue;
    }
    const motivo = decidirBaja(estado.get(v.userId));
    if (motivo === null) {
      quedan.push(v);
      continue;
    }
    // Sin los accesos no se sabe si le falta la Bandeja o la tiene por un extra: espera.
    if (motivo === "sin_bandeja" && !accesosLeidos) {
      sinBandejaEnEspera += 1;
      quedan.push(v);
      continue;
    }
    if (!cuenta.ok) {
      fallidas += 1;
      quedan.push(v);
      continue;
    }
    if (bloqueoDeBaja(v.chatwootUserId, miembrosCuenta, ctx.servicioId)) {
      bloqueadas += 1;
      quedan.push(v);
      continue;
    }
    if (miembrosCuenta.some((mc) => mc.userId === v.chatwootUserId)) {
      const quitado = await quitarDeCuenta(v.chatwootUserId, ctx.cfg);
      if (!quitado.ok) {
        console.warn(`[chatwoot-agentes] no se pudo sacar de la cuenta: ${quitado.error}`);
        fallidas += 1;
        quedan.push(v);
        continue;
      }
      miembrosCuenta = miembrosCuenta.filter((mc) => mc.userId !== v.chatwootUserId);
    }
    const cierre = await cerrarSesionesAgente(v.chatwootUserId, ctx.cfg);
    // Un usuario que ya no existe en Chatwoot no tiene sesiones que cerrar.
    const yaNoExiste = !cierre.ok && cierre.paso === "token" && cierre.error === "no_encontrado";
    if (!cierre.ok && !yaNoExiste) {
      console.warn(`[chatwoot-agentes] cierre forzado pendiente: ${cierre.paso} ${cierre.error}`);
      cierresPendientes += 1;
      quedan.push(v);
      continue;
    }
    const { error: errorBaja } = await ctx.admin
      .from("chatwoot_agent_bajas")
      .upsert(
        { tenant_id: ctx.tenantId, chatwoot_user_id: v.chatwootUserId, baja_at: new Date().toISOString() },
        { onConflict: "tenant_id,chatwoot_user_id" },
      );
    if (errorBaja) console.warn(`[chatwoot-agentes] baja sin fecha (¿falta la 0508?): ${errorBaja.code ?? "sin código"}`);
    const { error: errorBorrar } = await ctx.admin
      .from("chatwoot_agent_links")
      .delete()
      .eq("tenant_id", ctx.tenantId)
      .eq("user_id", v.userId);
    if (errorBorrar) {
      console.warn(`[chatwoot-agentes] no se pudo borrar el vínculo: ${errorBorrar.code ?? "sin código"}`);
      fallidas += 1;
      quedan.push(v);
      continue;
    }
    bajas += 1;
  }

  let matriz: ResultadoMatriz | undefined;
  // Sin los accesos, la matriz sacaría de sus bandejas a quien entra por un extra: espera.
  // Ni sin el estado de Studio: degradaría roles con datos incompletos.
  if (cuenta.ok && accesosLeidos && estadoLeido) {
    const agentes = await agentesDeLaMatriz(ctx, opciones.soloUsuario ? null : quedan, estado);
    if (agentes) {
      matriz = await aplicarMatriz(ctx, agentes, miembrosCuenta);
      miembrosCuenta = matriz.miembrosCuenta;
    }
  }

  const salud = evaluarSalud({
    miembrosCuenta: cuenta.ok ? { ok: true, data: miembrosCuenta } : cuenta,
    servicioId: ctx.servicioId,
    vinculos: quedan,
  });
  if (bloqueadas > 0) salud.alertas.push("baja_bloqueada");
  if (cierresPendientes > 0) salud.alertas.push("cierre_pendiente");
  if (matriz && matriz.bloqueadas > 0) salud.alertas.push("degradacion_bloqueada");
  if (matriz && matriz.fallidas > 0) salud.alertas.push("matriz_incompleta");
  if (!estadoLeido) salud.alertas.push("miembros_no_leidos");
  else if (!accesosLeidos) salud.alertas.push("accesos_no_leidos");
  const resumenMatriz = matriz
    ? { roles: matriz.roles, bloqueadas: matriz.bloqueadas, bandejas: matriz.bandejas, equipos: matriz.equipos, fallidas: matriz.fallidas }
    : undefined;
  return {
    revisados: vinculos.length,
    bajas,
    bloqueadas,
    fallidas,
    cierresPendientes,
    matriz: resumenMatriz,
    salud,
    ...(accesosLeidos || !estadoLeido ? {} : { sinBandejaEnEspera }),
    ...(estadoLeido ? {} : { sinEstado: true as const }),
  };
}

/**
 * Los vínculos que se quedan, con su rol de Studio. Con `soloUsuario` la lista
 * de arriba es de una sola persona y la matriz necesita a todos (las bandejas
 * se fijan con la lista completa): se vuelven a leer, ya sin las bajas.
 */
async function agentesDeLaMatriz(
  ctx: ContextoAgentes,
  vinculos: VinculoAgente[] | null,
  estado: Map<string, EstadoMiembroStudio>,
): Promise<AgenteMatriz[] | null> {
  let lista = vinculos;
  if (!lista) {
    const { data, error } = await ctx.admin
      .from("chatwoot_agent_links")
      .select("user_id, chatwoot_user_id")
      .eq("tenant_id", ctx.tenantId);
    if (error) return null;
    lista = ((data ?? []) as FilaVinculo[]).map((f) => ({ userId: f.user_id, chatwootUserId: f.chatwoot_user_id }));
  }
  const agentes: AgenteMatriz[] = [];
  for (const v of lista) {
    const m = estado.get(v.userId);
    if (!m?.rol || decidirBaja(m) !== null) continue;
    // porAcceso solo viaja cuando es verdadero: quien la tiene por rol queda igual que antes.
    agentes.push({ chatwootUserId: v.chatwootUserId, rol: m.rol, ...(m.porAcceso === true ? { porAcceso: true } : {}) });
  }
  return agentes;
}

const TEXTO_ALERTA: Record<AlertaSalud, string> = {
  chatwoot_no_responde: "el servidor de mensajes no responde",
  sin_admin_humano: "la cuenta no tiene ningún administrador humano",
  servicio_sin_configurar: "falta configurar el usuario de servicio",
  vinculo_fuera_de_cuenta: "hay vínculos a agentes que ya no están en la cuenta",
  baja_bloqueada: "una baja quedó bloqueada para no dejar la cuenta sin administrador",
  cierre_pendiente: "una baja salió de la cuenta pero sus sesiones siguen abiertas",
  degradacion_bloqueada: "un cambio de rol quedó bloqueado para no dejar la cuenta sin administrador",
  matriz_incompleta: "no se pudieron aplicar todos los permisos de la matriz",
  accesos_no_leidos: "no se pudieron leer los accesos adicionales de la Bandeja",
  miembros_no_leidos: "no se pudieron leer los usuarios o los permisos por rol del Studio",
  webhook_falta: "falta el webhook de cuenta hacia el Studio",
  webhook_sin_mensajes: "el webhook de cuenta no recibe los mensajes",
  webhook_sin_ip_publica: "el webhook de cuenta apunta a un servidor sin IP pública",
  webhook_no_medido: "no se pudo revisar el webhook de cuenta",
};

/** Push a los admins activos del tenant. Sin datos personales: solo qué revisar. */
export async function avisarSaludAAdmins(ctx: ContextoAgentes, salud: SaludBandeja): Promise<number> {
  if (salud.alertas.length === 0) return 0;
  const { data } = await ctx.admin
    .from("user_tenants")
    .select("user_id")
    .eq("tenant_id", ctx.tenantId)
    .eq("role", "admin")
    .is("disabled_at", null);
  const cuerpo = `La Bandeja necesita revisión: ${salud.alertas.map((a) => TEXTO_ALERTA[a]).join("; ")}.`;
  let encolados = 0;
  for (const fila of (data ?? []) as { user_id: string }[]) {
    const id = await enqueueUserPush(ctx.admin, ctx.tenantId, fila.user_id, {
      title: "Bandeja · salud",
      body: cuerpo,
      url: "/studio/bandeja",
      tag: "chatwoot-salud",
    });
    if (id) encolados += 1;
  }
  if (encolados > 0) await drainOperarioPushOutbox(ctx.admin);
  return encolados;
}
