/**
 * SDD-0626 §3.4 (Paso 3a) · El almacén del despachador: las funciones de la 0548 sobre Supabase (service_role).
 *
 * Toda la lógica que tiene que ser atómica (convertir la bandeja, tomar UNA tarea por agente, entregar o soltar
 * una corrida, recuperar las caídas, auto-pausar) vive en la base. Aquí solo se llaman.
 *
 * Sin la 0548 (o sin la 0541/0544) la función no existe: se lanza `SinMigracion` y el despachador lo anota UNA
 * vez y no hace nada. Los errores de la base solo llevan su código (el mensaje puede traer valores).
 * Toda escritura de texto pasa antes por `exigirTextosDelCable` (escribirEnElCable).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { escribirEnElCable, faltaLaMigracion } from "./escritura";

export class SinMigracion extends Error {
  constructor() {
    super("falta la 0548 (o la 0541/0544) en esta base");
    this.name = "SinMigracion";
  }
}

export class ErrorDelAlmacen extends Error {
  readonly code: string;
  constructor(code: string | null | undefined) {
    super(`el almacén del despachador no respondió (${code ?? "sin código"})`);
    this.name = "ErrorDelAlmacen";
    this.code = code ?? "desconocido";
  }
}

export interface TareaTomada {
  taskId: string;
  runId: string;
  entidadRef: string | null;
  prioridad: 1 | 2 | 3;
}

export interface PasoDeBitacora {
  taskId: string;
  runId: string;
  tipo: string;
  actor: string;
  resumen: string;
  costoUsd?: number;
  modelo?: string | null;
  /** SDD-0704 (0570): tokens de la llamada. Solo se escriben si vienen (sin la 0570 la columna no existe). */
  tokens?: { entrada: number; salida: number };
}

export type Entrega =
  | { taskId: string; runId: string; tipo: "respuesta"; texto: string; guion: string; actor: string; resumen: string }
  | { taskId: string; runId: string; tipo: "escalado"; motivo: string; prioridad: 1 | 2 | 3; actor: string; resumen: string };

export interface AlmacenDespachador {
  tomarTurno(dueno: string, segundos: number): Promise<boolean>;
  soltarTurno(dueno: string): Promise<void>;
  estaPausada(): Promise<boolean>;
  autopausar(topeUsd: number, umbral: number): Promise<boolean>;
  recuperar(agente: string, topeS: number): Promise<number>;
  convertir(agente: string, limite: number): Promise<number>;
  tomarTarea(agente: string, pausaS: number, topeS: number): Promise<TareaTomada | null>;
  anotar(paso: PasoDeBitacora): Promise<void>;
  entregar(entrega: Entrega): Promise<boolean>;
  soltar(taskId: string, runId: string, resumen: string): Promise<boolean>;
  // Paso 3b (0549). Opcionales: sin la 0549 lanzan SinMigracion y el despachador sigue como en el 3a.
  anotarSesionPorBorrar?(sesionId: string, minutos: number): Promise<void>;
  sesionesPorBorrar?(): Promise<Array<{ sesionId: string; vencida: boolean }>>;
  quitarSesionPorBorrar?(sesionId: string): Promise<boolean>;
  contarPendientes?(): Promise<number>;
  // SDD-0704 F1-A (0570). Opcionales: sin la 0570 lanzan SinMigracion y el despachador sigue con el entorno.
  leerCostoOficina?(): Promise<unknown>;
  autopausarPorLlamadas?(tope: number, umbral: number): Promise<boolean>;
}

type ErrorPg = { code?: string | null } | null;

function revisar(error: ErrorPg): void {
  if (!error) return;
  if (faltaLaMigracion(error)) throw new SinMigracion();
  throw new ErrorDelAlmacen(error.code);
}

/** Un texto que la regla del cable rechaza no se escribe: se cambia por una marca sin el dato. */
export async function textoSeguro(texto: string): Promise<string> {
  const r = await escribirEnElCable({ resumen: texto }, async () => texto, () => {});
  return r.escrito ? texto : "[texto retenido: la regla del cable vio datos personales]";
}

export function crearAlmacenDespachador(admin: SupabaseClient): AlmacenDespachador {
  const rpc = async <T>(fn: string, args: Record<string, unknown>): Promise<T> => {
    const { data, error } = await admin.rpc(fn, args);
    revisar(error);
    return data as T;
  };
  return {
    tomarTurno: (dueno, segundos) => rpc<boolean>("office_despachador_turno", { p_dueno: dueno, p_segundos: segundos }),
    async soltarTurno(dueno) {
      await rpc<boolean>("office_despachador_soltar", { p_dueno: dueno });
    },
    estaPausada: async () => (await rpc<boolean>("office_esta_pausada", {})) !== false,
    autopausar: (topeUsd, umbral) => rpc<boolean>("office_autopausar_por_tope", { p_tope_usd: topeUsd, p_umbral: umbral }),
    recuperar: (agente, topeS) => rpc<number>("office_recuperar_corridas", { p_agente: agente, p_tope_s: topeS }),
    convertir: (agente, limite) => rpc<number>("office_convertir_triaje", { p_agente: agente, p_limite: limite }),
    async tomarTarea(agente, pausaS, topeS) {
      const filas = await rpc<Array<Record<string, unknown>> | null>("office_tomar_tarea", {
        p_agente: agente,
        p_pausa_s: pausaS,
        p_tope_s: topeS,
      });
      const f = filas?.[0];
      if (!f || typeof f.task_id !== "string" || typeof f.run_id !== "string") return null;
      const p = Number(f.prioridad);
      return {
        taskId: f.task_id,
        runId: f.run_id,
        entidadRef: typeof f.entidad_ref === "string" ? f.entidad_ref : null,
        prioridad: p === 3 || p === 2 ? p : 1,
      };
    },
    async anotar(paso) {
      const fila = (resumen: string | null) => ({
        task_id: paso.taskId,
        run_id: paso.runId,
        tipo: paso.tipo,
        actor: paso.actor,
        resumen,
        costo_usd: paso.costoUsd ?? 0,
        modelo_usado: paso.modelo ?? null,
        ...(paso.tokens ? { tokens_entrada: paso.tokens.entrada, tokens_salida: paso.tokens.salida } : {}),
      });
      const r = await escribirEnElCable({ resumen: paso.resumen, actor: paso.actor }, async () => {
        const { error } = await admin.from("task_events").insert(fila(paso.resumen));
        revisar(error);
      });
      if (!r.escrito) {
        // El paso queda igual (tipo, actor, costo, modelo, tokens), sin el resumen rechazado.
        const { error } = await admin.from("task_events").insert(fila(null));
        revisar(error);
      }
    },
    entregar: (e) =>
      rpc<boolean>("office_entregar_corrida", {
        p_tarea: e.taskId,
        p_run: e.runId,
        p_tipo: e.tipo,
        p_texto: e.tipo === "respuesta" ? e.texto : null,
        p_guion: e.tipo === "respuesta" ? e.guion : null,
        p_motivo: e.tipo === "escalado" ? e.motivo : null,
        p_prioridad: e.tipo === "escalado" ? e.prioridad : null,
        p_actor: e.actor,
        p_resumen: e.resumen,
      }),
    soltar: (taskId, runId, resumen) => rpc<boolean>("office_soltar_corrida", { p_tarea: taskId, p_run: runId, p_resumen: resumen }),
    async anotarSesionPorBorrar(sesionId, minutos) {
      await rpc<null>("office_anotar_sesion_por_borrar", { p_sesion: sesionId, p_minutos: minutos });
    },
    async sesionesPorBorrar() {
      const filas = await rpc<Array<Record<string, unknown>> | null>("office_sesiones_por_borrar", {});
      return (filas ?? [])
        .filter((f) => typeof f.sesion_id === "string")
        .map((f) => ({ sesionId: f.sesion_id as string, vencida: f.vencida === true }));
    },
    quitarSesionPorBorrar: (sesionId) => rpc<boolean>("office_quitar_sesion_por_borrar", { p_sesion: sesionId }),
    contarPendientes: async () => Number((await rpc<number>("office_pendientes_conteo", {})) ?? 0),
    leerCostoOficina: () => rpc<unknown>("ia_costo_oficina", {}),
    autopausarPorLlamadas: (tope, umbral) =>
      rpc<boolean>("ia_oficina_autopausar_por_llamadas", { p_tope: tope, p_umbral: umbral }),
  };
}
