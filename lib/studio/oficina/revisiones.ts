/**
 * SDD-0626 Paso 3b (D2 y D4) · La revisión de Sam de cada borrador del agente.
 *
 * - Las 5 casillas son las de eval.md (Anexo A §A.7), fijas: no hay texto libre fuera del motivo.
 * - La página (`/studio/admin/oficina`) llama a las funciones de la 0549 con la sesión del usuario
 *   (authenticated). La base exige `is_platform_admin()` en cada una; aquí no se decide nada de permisos.
 * - El borrador y el motivo se muestran SIEMPRE como texto plano (React los escapa; nunca HTML ni Markdown).
 * - Sin la 0549 las funciones no existen: se devuelve `sin_migracion` y la página lo dice.
 */
import { createHash } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { faltaLaMigracion } from "./escritura";

export const CASILLAS = [
  { clave: "acuse", campo: "p_acuse", texto: "Acuse en la primera respuesta" },
  { clave: "guion_o_escalado", campo: "p_guion_o_escalado", texto: "Usa un guion aprobado o escala" },
  { clave: "cero_inventados", campo: "p_cero_inventados", texto: "Cero datos inventados" },
  { clave: "pii_no_repetida", campo: "p_pii_no_repetida", texto: "No repite datos personales fuera de contexto" },
  { clave: "cierre_3", campo: "p_cierre_3", texto: "Cierre o escalado en 3 intercambios o menos" },
] as const;

export type ClaveCasilla = (typeof CASILLAS)[number]["clave"];
export type Veredicto = "aprobado" | "rechazado";

export interface BorradorPendiente {
  borradorId: string;
  taskId: string;
  tipo: "respuesta" | "escalado";
  texto: string | null;
  guion: string | null;
  motivo: string | null;
  prioridad: number | null;
  creadoEn: string;
  conversacion: number | null;
}

export interface ConteoEtapa {
  etapa: 1 | 2;
  conversaciones: number;
  correctas: number;
  conInventados: number;
  minimo: number;
  minimoCorrectas: number;
  cumple: boolean;
}

/** La misma cuenta que `office_huella_borrador` (0549): sha256 de «tipo \n texto \n guion \n motivo \n prioridad». */
export function huellaBorrador(b: {
  tipo: string;
  texto: string | null;
  guion: string | null;
  motivo: string | null;
  prioridad: number | null;
}): string {
  const partes = [b.tipo, b.texto ?? "", b.guion ?? "", b.motivo ?? "", b.prioridad === null ? "" : String(b.prioridad)];
  return createHash("sha256").update(partes.join("\n"), "utf8").digest("hex");
}

/** La etapa de AC-1 en la que se cuenta la revisión. Hoy, 1 (prueba). `OFICINA_ETAPA=2` solo cuando Sam firme el paso. */
export function etapaActual(env: Readonly<Record<string, string | undefined>> = process.env): 1 | 2 {
  return (env.OFICINA_ETAPA ?? "").trim() === "2" ? 2 : 1;
}

export type Lectura<T> = { ok: true; datos: T } | { ok: false; motivo: "sin_migracion" | "sin_permiso" | "error" };

type ErrorPg = { code?: string | null; message?: string | null } | null;

function fallo(error: ErrorPg): { ok: false; motivo: "sin_migracion" | "sin_permiso" | "error" } {
  if (faltaLaMigracion(error)) return { ok: false, motivo: "sin_migracion" };
  if (error?.code === "42501") return { ok: false, motivo: "sin_permiso" };
  return { ok: false, motivo: "error" };
}

/** `chatwoot:conversations/<id>/messages/<id>` → el id de la conversación (solo para mostrarlo). */
function conversacion(ref: unknown): number | null {
  const m = /^chatwoot:conversations\/([0-9]{1,12})\//.exec(typeof ref === "string" ? ref : "");
  return m ? Number(m[1]) : null;
}

export async function leerPendientes(supabase: SupabaseClient): Promise<Lectura<BorradorPendiente[]>> {
  const { data, error } = await supabase.rpc("office_borradores_pendientes");
  if (error) return fallo(error);
  const filas = (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
  return {
    ok: true,
    datos: filas.map((f) => ({
      borradorId: String(f.borrador_id),
      taskId: String(f.task_id),
      tipo: f.tipo === "escalado" ? "escalado" : "respuesta",
      texto: typeof f.texto === "string" ? f.texto : null,
      guion: typeof f.guion === "string" ? f.guion : null,
      motivo: typeof f.motivo === "string" ? f.motivo : null,
      prioridad: f.prioridad === null || f.prioridad === undefined ? null : Number(f.prioridad),
      creadoEn: String(f.creado_en ?? ""),
      conversacion: conversacion(f.entidad_ref),
    })),
  };
}

export async function leerConteo(supabase: SupabaseClient, etapa: 1 | 2): Promise<Lectura<ConteoEtapa>> {
  const { data, error } = await supabase.rpc("office_conteo_revisiones", { p_etapa: etapa });
  if (error) return fallo(error);
  const f = ((Array.isArray(data) ? data[0] : data) ?? {}) as Record<string, unknown>;
  return {
    ok: true,
    datos: {
      etapa,
      conversaciones: Number(f.conversaciones ?? 0),
      correctas: Number(f.correctas ?? 0),
      conInventados: Number(f.con_inventados ?? 0),
      minimo: Number(f.minimo ?? (etapa === 1 ? 10 : 20)),
      minimoCorrectas: Number(f.minimo_correctas ?? (etapa === 1 ? 9 : 18)),
      cumple: f.cumple === true,
    },
  };
}

export interface Revision {
  borradorId: string;
  veredicto: Veredicto;
  casillas: Record<ClaveCasilla, boolean>;
  motivo: string;
  etapa: 1 | 2;
}

export type ResultadoRevision =
  | { ok: true }
  | { ok: false; codigo: "sin_migracion" | "sin_permiso" | "ya_revisado" | "no_en_aprobacion" | "no_aprobable" | "invalido" | "error" };

export async function guardarRevision(supabase: SupabaseClient, r: Revision): Promise<ResultadoRevision> {
  const args: Record<string, unknown> = {
    p_borrador: r.borradorId,
    p_veredicto: r.veredicto,
    p_motivo: r.motivo,
    p_etapa: r.etapa,
  };
  for (const c of CASILLAS) args[c.campo] = r.casillas[c.clave] === true;
  const { error } = await supabase.rpc("office_revisar_borrador", args);
  if (!error) return { ok: true };
  if (faltaLaMigracion(error)) return { ok: false, codigo: "sin_migracion" };
  switch (error.code) {
    case "42501":
      return { ok: false, codigo: "sin_permiso" };
    case "23505":
      return { ok: false, codigo: "ya_revisado" };
    case "55000":
      return { ok: false, codigo: "no_en_aprobacion" };
    case "23514":
      return { ok: false, codigo: "no_aprobable" };
    case "22023":
    case "22004":
    case "P0002":
      return { ok: false, codigo: "invalido" };
    default:
      return { ok: false, codigo: "error" };
  }
}
