/**
 * SDD-0626 §3.6 (Paso 4) · La mini-vista: lo que hay en las 4 tablas del cable, SOLO LECTURA.
 *
 * - **Qué lee.** La bandera (`office_paused`), la cola (`office_tasks`), los eventos (`event_inbox`) y la bitácora
 *   (`task_events`), más el gasto del mes (`office_gasto_del_mes()`, 0548). No escribe nada y no llama a ningún
 *   servicio de fuera: ni Chatwoot ni el runtime del agente.
 * - **Con qué permiso.** Las 4 tablas tienen RLS sin policies y solo las lee `service_role` (0541). Por eso se leen con
 *   el cliente de servicio, y ESE cliente solo se crea después de que la base contestó que quien mira es
 *   `is_platform_admin()`: el candado va aquí adentro, no en quien llama. Sin ese «sí», `crearAdmin` ni se invoca.
 * - **Qué columnas.** Solo las que la regla del cable deja sin datos personales (R5 · AUD-01 §5): identificadores,
 *   referencias, estados, horas, costos y los textos que pasan por `exigirTextosDelCable` (`titulo`, `resumen`).
 *   Nunca `meta_datos` ni `clave_dedupe`, y nunca el borrador ni el texto del cliente (eso vive en
 *   `/studio/admin/oficina-virtual`, con su propio candado en la base).
 * - **Cuánto.** Las últimas filas de cada tabla (`LIMITES`), de lo nuevo a lo viejo, y un conteo por estado.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { faltaLaMigracion } from "./escritura";

export const LIMITES = { pausa: 10, cola: 50, eventos: 50, bitacora: 100 } as const;

export const ESTADOS_TAREA = ["borrador", "listo", "en-ejecución", "auditoría", "aprobación", "terminada"] as const;
export const ESTADOS_EVENTO = ["nuevo", "triaje", "convertido", "descartado"] as const;
export type EstadoTarea = (typeof ESTADOS_TAREA)[number];
export type EstadoEvento = (typeof ESTADOS_EVENTO)[number];

/** Las columnas que se piden, y ninguna más (la prueba las fija). */
export const COLUMNAS = {
  office_paused: "pausada, cambiado_por, cambiado_en, motivo",
  office_tasks: "id, titulo, estado, asignado_a, prioridad, entidad_ref, origen, creado_en",
  event_inbox: "id, tipo, origen, prioridad, payload_ref, estado, ts",
  task_events: "id, task_id, run_id, tipo, actor, resumen, costo_usd, modelo_usado, ts",
} as const;

export interface CambioDePausa {
  pausada: boolean;
  cambiadoEn: string;
  /** `persona:<uuid>` de quien la cambió, o `sistema` (la migración o la auto-pausa: `cambiado_por` vacío). */
  quien: string;
  motivo: string;
}

export interface TareaEnCola {
  id: string;
  titulo: string;
  estado: string;
  asignadoA: string | null;
  prioridad: number;
  /** El número de conversación de Chatwoot, si la referencia es de una conversación. */
  conversacion: number | null;
  origen: string | null;
  creadoEn: string;
}

export interface EventoEntrante {
  id: string;
  tipo: string;
  origen: string;
  prioridad: number;
  payloadRef: string | null;
  estado: string;
  ts: string;
}

export interface PasoDeBitacora {
  id: string;
  taskId: string;
  runId: string | null;
  tipo: string;
  actor: string;
  /** Vacío después de 90 días (el vaciado diario). */
  resumen: string | null;
  costoUsd: number;
  modelo: string | null;
  ts: string;
}

export interface MiniVista {
  pausa: { vigente: CambioDePausa | null; historial: CambioDePausa[] };
  cola: { porEstado: Record<EstadoTarea, number | null>; filas: TareaEnCola[] };
  eventos: { porEstado: Record<EstadoEvento, number | null>; filas: EventoEntrante[] };
  bitacora: { filas: PasoDeBitacora[] };
  /** Suma de `task_events.costo_usd` del mes (UTC). `null` si la 0548 no está o la función falló. */
  gastoMesUsd: number | null;
}

export type LecturaVista =
  | { ok: true; datos: MiniVista }
  | { ok: false; motivo: "sin_permiso" | "sin_migracion" | "error" };

export interface DependenciasVista {
  /** ¿La base dice que quien mira es `is_platform_admin()`? Cualquier fallo cuenta como «no». */
  esAdmin: () => Promise<boolean>;
  /** El cliente de servicio. Solo se llama después de un «sí» de `esAdmin`. */
  crearAdmin: () => SupabaseClient;
  registrar?: (mensaje: string) => void;
}

type Fila = Record<string, unknown>;
type ErrorPg = { code?: string | null } | null;

class LecturaFallida extends Error {
  constructor(
    readonly tabla: string,
    readonly codigo: string | null,
    readonly sinMigracion: boolean,
  ) {
    super(`mini-vista: no se pudo leer ${tabla}`);
  }
}

function revisar(tabla: string, error: ErrorPg): void {
  if (!error) return;
  throw new LecturaFallida(tabla, error.code ?? null, faltaLaMigracion(error));
}

const texto = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);

/** `chatwoot:conversations/<id>/…` → el id de la conversación (solo para mostrarlo). */
export function conversacionDe(ref: unknown): number | null {
  const m = /^chatwoot:conversations\/([0-9]{1,12})(?:\/|$)/.exec(typeof ref === "string" ? ref : "");
  return m ? Number(m[1]) : null;
}

function cambioDePausa(f: Fila): CambioDePausa {
  const quien = texto(f.cambiado_por);
  return {
    pausada: f.pausada !== false, // lo que no es un «false» explícito cuenta como pausada (falla cerrado)
    cambiadoEn: String(f.cambiado_en ?? ""),
    quien: quien ? `persona:${quien}` : "sistema",
    motivo: String(f.motivo ?? ""),
  };
}

async function ultimas(admin: SupabaseClient, tabla: keyof typeof COLUMNAS, orden: string, limite: number): Promise<Fila[]> {
  const { data, error } = await admin.from(tabla).select(COLUMNAS[tabla]).order(orden, { ascending: false }).limit(limite);
  revisar(tabla, error);
  return (Array.isArray(data) ? data : []) as unknown as Fila[];
}

/** Cuántas filas hay en cada estado. Un conteo que falla queda en `null` (se muestra «?»): no tumba la vista. */
async function contarPorEstado<E extends string>(
  admin: SupabaseClient,
  tabla: "office_tasks" | "event_inbox",
  estados: readonly E[],
): Promise<Record<E, number | null>> {
  const pares = await Promise.all(
    estados.map(async (estado) => {
      const { count, error } = await admin.from(tabla).select("id", { count: "exact", head: true }).eq("estado", estado);
      return [estado, error || typeof count !== "number" ? null : count] as const;
    }),
  );
  return Object.fromEntries(pares) as Record<E, number | null>;
}

async function gastoDelMes(admin: SupabaseClient): Promise<number | null> {
  const { data, error } = await admin.rpc("office_gasto_del_mes");
  if (error) return null; // sin la 0548 la función no existe: la vista sigue sin el gasto
  const n = Number(data);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export async function leerMiniVista(deps: DependenciasVista): Promise<LecturaVista> {
  // EL CANDADO: sin el «sí» de la base no se crea el cliente de servicio.
  let admite = false;
  try {
    admite = (await deps.esAdmin()) === true;
  } catch {
    admite = false;
  }
  if (!admite) return { ok: false, motivo: "sin_permiso" };

  const registrar = deps.registrar ?? ((m: string) => console.error(m));
  try {
    const admin = deps.crearAdmin();
    const [pausa, tareas, eventos, pasos, tareasPorEstado, eventosPorEstado, gastoMesUsd] = await Promise.all([
      ultimas(admin, "office_paused", "id", LIMITES.pausa),
      ultimas(admin, "office_tasks", "creado_en", LIMITES.cola),
      ultimas(admin, "event_inbox", "ts", LIMITES.eventos),
      ultimas(admin, "task_events", "ts", LIMITES.bitacora),
      contarPorEstado(admin, "office_tasks", ESTADOS_TAREA),
      contarPorEstado(admin, "event_inbox", ESTADOS_EVENTO),
      gastoDelMes(admin),
    ]);
    const historial = pausa.map(cambioDePausa);
    return {
      ok: true,
      datos: {
        pausa: { vigente: historial[0] ?? null, historial },
        cola: {
          porEstado: tareasPorEstado,
          filas: tareas.map((f) => ({
            id: String(f.id),
            titulo: String(f.titulo ?? ""),
            estado: String(f.estado ?? ""),
            asignadoA: texto(f.asignado_a),
            prioridad: Number(f.prioridad ?? 1),
            conversacion: conversacionDe(f.entidad_ref),
            origen: texto(f.origen),
            creadoEn: String(f.creado_en ?? ""),
          })),
        },
        eventos: {
          porEstado: eventosPorEstado,
          filas: eventos.map((f) => ({
            id: String(f.id),
            tipo: String(f.tipo ?? ""),
            origen: String(f.origen ?? ""),
            prioridad: Number(f.prioridad ?? 1),
            payloadRef: texto(f.payload_ref),
            estado: String(f.estado ?? ""),
            ts: String(f.ts ?? ""),
          })),
        },
        bitacora: {
          filas: pasos.map((f) => ({
            id: String(f.id),
            taskId: String(f.task_id ?? ""),
            runId: texto(f.run_id),
            tipo: String(f.tipo ?? ""),
            actor: String(f.actor ?? ""),
            resumen: texto(f.resumen),
            costoUsd: Number(f.costo_usd ?? 0) || 0,
            modelo: texto(f.modelo_usado),
            ts: String(f.ts ?? ""),
          })),
        },
        gastoMesUsd,
      },
    };
  } catch (e) {
    if (e instanceof LecturaFallida) {
      if (e.sinMigracion) return { ok: false, motivo: "sin_migracion" };
      // Solo la tabla y el código: el mensaje del error puede repetir un valor de la fila.
      registrar(`[oficina-vista] no se pudo leer ${e.tabla} (código ${e.codigo ?? "?"})`);
      return { ok: false, motivo: "error" };
    }
    // Sin el mensaje: puede traer la URL o un valor de configuración.
    registrar("[oficina-vista] no se pudo abrir la lectura (¿falta la configuración del cliente de servicio?)");
    return { ok: false, motivo: "error" };
  }
}
