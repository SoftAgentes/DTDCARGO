/**
 * Reglas del ciclo de vida de los agentes de Chatwoot (SDD-0585, paso 2.5). Puro.
 *
 *  - `decidirBaja`: un vínculo sobra si su usuario de Studio está desactivado,
 *    ya no es del tenant o perdió el acceso al módulo `bandeja`.
 *  - `bloqueoDeBaja`: hay dos que nunca se sacan de la cuenta. Uno es el usuario
 *    de servicio de E1, que Studio usa por la Platform API. El otro es el ÚLTIMO
 *    administrador humano: sin él nadie puede administrar la cuenta (Director,
 *    2026-10-30: el superadmin no es de ninguna cuenta y hasta hoy el único admin
 *    de la cuenta 1 era la cuenta de servicio).
 *  - `evaluarSalud`: alerta si Chatwoot no responde, si la cuenta no tiene un
 *    admin humano, si falta el id del usuario de servicio o si hay vínculos a
 *    agentes que ya no están en la cuenta (el SSO entraría a una cuenta vacía).
 */

import type { StudioUserRole } from "@/lib/studio/user-types";
import type { ChatwootError } from "./chatwoot-types";
import type { MiembroCuenta } from "./platform-api";

export interface EstadoMiembroStudio {
  userId: string;
  activo: boolean;
  puedeBandeja: boolean;
  /** Para la matriz del 2.7. */
  rol?: StudioUserRole;
}

export interface VinculoAgente {
  userId: string;
  chatwootUserId: number;
}

export type MotivoBaja = "desactivado" | "fuera_del_tenant" | "sin_bandeja";
export type BloqueoBaja = "servicio" | "ultimo_admin_humano";
export type AlertaSalud =
  | "chatwoot_no_responde"
  | "sin_admin_humano"
  | "servicio_sin_configurar"
  | "vinculo_fuera_de_cuenta"
  | "baja_bloqueada"
  | "cierre_pendiente"
  | "degradacion_bloqueada"
  | "matriz_incompleta";

export interface SaludBandeja {
  alertas: AlertaSalud[];
  /** Admins de la cuenta sin el de servicio; null si no se pudo medir. */
  adminsHumanos: number | null;
  /** Chatwoot ids de vínculos cuyo agente ya no está en la cuenta. */
  vinculosFueraDeCuenta: number[];
  error?: ChatwootError;
}

export function decidirBaja(miembro: EstadoMiembroStudio | undefined): MotivoBaja | null {
  if (!miembro) return "fuera_del_tenant";
  if (!miembro.activo) return "desactivado";
  if (!miembro.puedeBandeja) return "sin_bandeja";
  return null;
}

export function bloqueoDeBaja(
  chatwootUserId: number,
  miembrosCuenta: readonly MiembroCuenta[],
  servicioId: number | null,
): BloqueoBaja | null {
  if (servicioId !== null && chatwootUserId === servicioId) return "servicio";
  const propio = miembrosCuenta.find((m) => m.userId === chatwootUserId);
  if (propio?.rol !== "administrator") return null;
  // Sin el id de servicio no se sabe quién es humano: se cuenta a todos los
  // demás admins, que es lo conservador (puede bloquear una baja de más, nunca
  // dejar la cuenta sin admin).
  const otrosHumanos = miembrosCuenta.filter(
    (m) => m.rol === "administrator" && m.userId !== chatwootUserId && m.userId !== servicioId,
  );
  return otrosHumanos.length === 0 ? "ultimo_admin_humano" : null;
}

export function evaluarSalud(entrada: {
  miembrosCuenta: { ok: true; data: readonly MiembroCuenta[] } | { ok: false; error: ChatwootError };
  servicioId: number | null;
  vinculos: readonly VinculoAgente[];
}): SaludBandeja {
  if (!entrada.miembrosCuenta.ok) {
    return {
      alertas: ["chatwoot_no_responde"],
      adminsHumanos: null,
      vinculosFueraDeCuenta: [],
      error: entrada.miembrosCuenta.error,
    };
  }
  const miembros = entrada.miembrosCuenta.data;
  const alertas: AlertaSalud[] = [];
  let adminsHumanos: number | null = null;
  if (entrada.servicioId === null) {
    alertas.push("servicio_sin_configurar");
  } else {
    adminsHumanos = miembros.filter((m) => m.rol === "administrator" && m.userId !== entrada.servicioId).length;
    if (adminsHumanos === 0) alertas.push("sin_admin_humano");
  }
  const enCuenta = new Set(miembros.map((m) => m.userId));
  const vinculosFueraDeCuenta = entrada.vinculos.map((v) => v.chatwootUserId).filter((id) => !enCuenta.has(id));
  if (vinculosFueraDeCuenta.length > 0) alertas.push("vinculo_fuera_de_cuenta");
  return { alertas, adminsHumanos, vinculosFueraDeCuenta };
}
