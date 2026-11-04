/**
 * Matriz de permisos de Chatwoot (SDD-0585, paso 2.7). Pura.
 *
 * Aprobada por Sam el 2026-10-30 («Apruebo la matriz (Recomendado)»):
 *
 * | Rol de Studio | Rol en Chatwoot | Bandejas            | Equipos            |
 * |---------------|-----------------|---------------------|--------------------|
 * | admin         | administrator   | todas las de config | todos los de config|
 * | commercial    | agent           | Leads               | Leads («Comercial») |
 * | support       | agent           | Clientes            | Clientes («Atención») |
 * | resto con override de la Bandeja | agent | ninguna     | ninguno            |
 *
 * Y «Studio manda» (decisión 3): el cron corrige lo que se cambie a mano en
 * Chatwoot. Dos candados, como en el 2.5:
 *  - el usuario de servicio nunca cambia de rol ni sale de una bandeja o equipo;
 *  - una degradación de `administrator` a `agent` que dejaría la cuenta sin
 *    admin humano no se hace (queda «bloqueada» y la salud avisa). Sin el id del
 *    usuario de servicio no se puede contar a los humanos: no se degrada a nadie.
 *
 * Los miembros de una bandeja o equipo que no tienen vínculo en Studio salen
 * de ella: Studio manda. No se los saca de la cuenta (eso es una baja, y sin
 * vínculo Studio no sabe de quién es); la salud los cuenta.
 *
 * Bandeja Clientes = número nuevo (+58 412-1605202, ya en Chatwoot). Bandeja
 * Leads = número viejo, que llega de Kommo en el corte: hasta entonces su id no
 * está configurado y esa parte de la matriz no hace nada.
 */

import type { StudioUserRole } from "@/lib/studio/user-types";
import type { MiembroCuenta, RolCuenta } from "./platform-api";

export interface ConfigMatriz {
  bandejaClientes: number | null;
  bandejaLeads: number | null;
  equipoClientes: number | null;
  equipoLeads: number | null;
}

const ID = /^[1-9][0-9]{0,9}$/;
const leerId = (v: string | undefined) => {
  const t = (v ?? "").trim();
  return ID.test(t) ? Number(t) : null;
};

/**
 * Ids de bandejas y equipos. Los nombres de equipo son los de E10 (SDD-0586),
 * que se apila sobre esta rama y ya los lee: una sola configuración.
 */
export function configMatriz(env: Record<string, string | undefined> = process.env): ConfigMatriz {
  return {
    bandejaClientes: leerId(env.CHATWOOT_INBOX_CLIENTES_ID),
    bandejaLeads: leerId(env.CHATWOOT_INBOX_LEADS_ID),
    equipoClientes: leerId(env.CHATWOOT_TEAM_CLIENTES_ID),
    equipoLeads: leerId(env.CHATWOOT_TEAM_LEADS_ID),
  };
}

export function rolChatwootDe(rol: StudioUserRole): RolCuenta {
  return rol === "admin" ? "administrator" : "agent";
}

const presentes = (...ids: (number | null)[]) => ids.filter((id): id is number => id !== null);

export function destinosDe(rol: StudioUserRole, cfg: ConfigMatriz): { bandejas: number[]; equipos: number[] } {
  if (rol === "admin") {
    return {
      bandejas: presentes(cfg.bandejaClientes, cfg.bandejaLeads),
      equipos: presentes(cfg.equipoClientes, cfg.equipoLeads),
    };
  }
  if (rol === "commercial") return { bandejas: presentes(cfg.bandejaLeads), equipos: presentes(cfg.equipoLeads) };
  if (rol === "support") return { bandejas: presentes(cfg.bandejaClientes), equipos: presentes(cfg.equipoClientes) };
  return { bandejas: [], equipos: [] };
}

/** Un vínculo que se queda (activo y con la Bandeja), con su rol de Studio. */
export interface AgenteMatriz {
  chatwootUserId: number;
  rol: StudioUserRole;
}

export interface CambioRol {
  chatwootUserId: number;
  rol: RolCuenta;
  /** true: no estaba en la cuenta y entra. */
  alta: boolean;
}

/**
 * Qué roles cambiar. Las degradaciones se cuentan en orden: si dos admins de
 * Studio pasan a comercial a la vez, el primero baja y el segundo queda
 * bloqueado si era el último admin humano.
 */
export function planificarRoles(entrada: {
  agentes: readonly AgenteMatriz[];
  miembrosCuenta: readonly MiembroCuenta[];
  servicioId: number | null;
}): { cambios: CambioRol[]; bloqueadas: number[] } {
  const rolActual = new Map(entrada.miembrosCuenta.map((m) => [m.userId, m.rol]));
  let adminsHumanos = entrada.miembrosCuenta.filter(
    (m) => m.rol === "administrator" && m.userId !== entrada.servicioId,
  ).length;
  // Las altas y promociones cuentan antes que cualquier degradación.
  const deseados = entrada.agentes
    .filter((a) => a.chatwootUserId !== entrada.servicioId)
    .map((a) => ({ id: a.chatwootUserId, rol: rolChatwootDe(a.rol) }));
  for (const d of deseados) {
    if (d.rol === "administrator" && rolActual.get(d.id) !== "administrator") adminsHumanos += 1;
  }
  const cambios: CambioRol[] = [];
  const bloqueadas: number[] = [];
  for (const d of deseados) {
    const actual = rolActual.get(d.id);
    if (actual === d.rol) continue;
    if (actual === "administrator" && d.rol === "agent") {
      // Sin el id de servicio no se sabe quién es humano: no se degrada a nadie.
      if (entrada.servicioId === null || adminsHumanos <= 1) {
        bloqueadas.push(d.id);
        continue;
      }
      adminsHumanos -= 1;
    }
    cambios.push({ chatwootUserId: d.id, rol: d.rol, alta: actual === undefined });
  }
  // Se aplican en este orden: primero quien pasa a admin, después quien baja.
  cambios.sort((x, y) => Number(y.rol === "administrator") - Number(x.rol === "administrator"));
  return { cambios, bloqueadas };
}

export interface CambioMiembros {
  id: number;
  userIds: number[];
}

/**
 * La lista completa de cada bandeja o equipo configurado, para un PATCH que la
 * reemplaza (`inbox_members#update`, `team_members#update` de 4.19.1). Solo
 * entran los agentes que están en la cuenta (Chatwoot rechaza el PATCH entero si
 * un id no es de la cuenta), más el usuario de servicio si ya estaba. Si la
 * lista no cambia, no hay cambio.
 */
export function planificarMiembros(entrada: {
  agentes: readonly AgenteMatriz[];
  enCuenta: ReadonlySet<number>;
  servicioId: number | null;
  actuales: ReadonlyMap<number, readonly number[]>;
  destinos: (rol: StudioUserRole) => number[];
}): CambioMiembros[] {
  const cambios: CambioMiembros[] = [];
  for (const [id, actuales] of entrada.actuales) {
    const deseados = new Set<number>();
    for (const a of entrada.agentes) {
      if (a.chatwootUserId === entrada.servicioId) continue;
      if (!entrada.enCuenta.has(a.chatwootUserId)) continue;
      if (entrada.destinos(a.rol).includes(id)) deseados.add(a.chatwootUserId);
    }
    if (entrada.servicioId !== null && actuales.includes(entrada.servicioId)) deseados.add(entrada.servicioId);
    const lista = [...deseados].sort((x, y) => x - y);
    const antes = [...new Set(actuales)].sort((x, y) => x - y);
    if (lista.length === antes.length && lista.every((v, i) => v === antes[i])) continue;
    cambios.push({ id, userIds: lista });
  }
  return cambios;
}
