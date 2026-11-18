import "server-only";

import type { ContextoAgentes } from "./agentes-ciclo";
import { configMatriz, destinosDe, planificarMiembros, planificarRoles, type AgenteMatriz, type ConfigMatriz } from "./matriz";
import {
  fijarMiembrosBandeja,
  fijarMiembrosEquipo,
  leerMiembrosBandeja,
  leerMiembrosEquipo,
} from "./miembros-api";
import { agregarACuenta, obtenerTokenAgente, type MiembroCuenta } from "./platform-api";

/**
 * Aplica la matriz del 2.7 (`matriz.ts`) sobre Chatwoot: «Studio manda».
 *
 *  1. Roles: alta en la cuenta de quien tenga vínculo y no esté, y el rol que le
 *     toca (`account_users#create` lo cambia si ya estaba). Nunca el usuario de
 *     servicio; nunca la degradación del último admin humano.
 *  2. Bandejas y equipos configurados: la lista completa de miembros, con el
 *     token del usuario de servicio. Sin su id o sin bandejas y equipos
 *     configurados, este paso no hace nada.
 *
 * Nunca lanza. Devuelve cuentas y la lista de la cuenta ya corregida, para que
 * la salud no avise de algo que se acaba de arreglar.
 */

export interface ResultadoMatriz {
  roles: number;
  bloqueadas: number;
  bandejas: number;
  equipos: number;
  fallidas: number;
  miembrosCuenta: MiembroCuenta[];
}

export async function aplicarMatriz(
  ctx: ContextoAgentes,
  agentes: readonly AgenteMatriz[],
  miembrosCuenta: readonly MiembroCuenta[],
  cfgMatriz: ConfigMatriz = configMatriz(),
): Promise<ResultadoMatriz> {
  const resultado: ResultadoMatriz = { roles: 0, bloqueadas: 0, bandejas: 0, equipos: 0, fallidas: 0, miembrosCuenta: [...miembrosCuenta] };
  const plan = planificarRoles({ agentes, miembrosCuenta, servicioId: ctx.servicioId });
  resultado.bloqueadas = plan.bloqueadas.length;
  for (const cambio of plan.cambios) {
    const r = await agregarACuenta(cambio.chatwootUserId, ctx.cfg, cambio.rol);
    if (!r.ok) {
      console.warn(`[chatwoot-matriz] no se pudo fijar el rol: ${r.error}`);
      resultado.fallidas += 1;
      continue;
    }
    resultado.roles += 1;
    resultado.miembrosCuenta = [
      ...resultado.miembrosCuenta.filter((m) => m.userId !== cambio.chatwootUserId),
      { userId: cambio.chatwootUserId, rol: cambio.rol },
    ];
  }

  const bandejas = [cfgMatriz.bandejaClientes, cfgMatriz.bandejaLeads].filter((id): id is number => id !== null);
  const equipos = [cfgMatriz.equipoClientes, cfgMatriz.equipoLeads].filter((id): id is number => id !== null);
  if (ctx.servicioId === null || (bandejas.length === 0 && equipos.length === 0)) return resultado;

  const token = await obtenerTokenAgente(ctx.servicioId, ctx.cfg);
  if (!token.ok) {
    console.warn(`[chatwoot-matriz] sin token del usuario de servicio: ${token.error}`);
    resultado.fallidas += 1;
    return resultado;
  }
  const enCuenta = new Set(resultado.miembrosCuenta.map((m) => m.userId));

  const grupos = [
    { tipo: "bandejas" as const, ids: bandejas, leer: leerMiembrosBandeja, fijar: fijarMiembrosBandeja, destinos: (rol: AgenteMatriz["rol"]) => destinosDe(rol, cfgMatriz).bandejas },
    { tipo: "equipos" as const, ids: equipos, leer: leerMiembrosEquipo, fijar: fijarMiembrosEquipo, destinos: (rol: AgenteMatriz["rol"]) => destinosDe(rol, cfgMatriz).equipos },
  ];
  for (const g of grupos) {
    const actuales = new Map<number, number[]>();
    for (const id of g.ids) {
      const r = await g.leer(ctx.cfg, token.data, id);
      if (!r.ok) {
        console.warn(`[chatwoot-matriz] no se pudieron leer los miembros (${g.tipo}): ${r.error}`);
        resultado.fallidas += 1;
        continue;
      }
      actuales.set(id, r.data);
    }
    const cambios = planificarMiembros({ agentes, enCuenta, servicioId: ctx.servicioId, actuales, destinos: g.destinos });
    for (const c of cambios) {
      const r = await g.fijar(ctx.cfg, token.data, c.id, c.userIds);
      if (!r.ok) {
        console.warn(`[chatwoot-matriz] no se pudieron fijar los miembros (${g.tipo}): ${r.error}`);
        resultado.fallidas += 1;
        continue;
      }
      resultado[g.tipo] += 1;
    }
  }
  return resultado;
}
