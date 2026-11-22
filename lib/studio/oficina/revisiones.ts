/**
 * SDD-0626 Paso 3b (D2 y D4) · La revisión de Sam de cada borrador del agente.
 *
 * - Los criterios son los de eval.md (Anexo A §A.7), fijos: no hay texto libre fuera del motivo.
 * - Desde la 0558 (decisión del DG por delegación de Sam, 17/11/2026) cada mensaje se revisa con 4 criterios de
 *   TRES estados: «cumple» (sin marca), «falló» (marcado) y «no evaluado» (null). «Cierre o escalado en 3
 *   intercambios o menos» no se juzga por mensaje: se registra una vez por conversación (`registrarCierre`).
 * - La página (`/studio/admin/oficina-virtual`) llama a las funciones de la 0549 y la 0558 con la sesión del usuario
 *   (authenticated). La base exige `is_platform_admin()` en cada una; aquí no se decide nada de permisos.
 * - El borrador y el motivo se muestran SIEMPRE como texto plano (React los escapa; nunca HTML ni Markdown).
 * - Sin la 0549 las funciones no existen: se devuelve `sin_migracion`. Sin la 0558, revisar y cerrar devuelven
 *   `sin_0558` y la página lo dice; no se guarda nada con la regla vieja.
 */
import { createHash } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { faltaLaMigracion } from "./escritura";

/** Los 4 criterios que se juzgan en cada mensaje (0558). */
export const CASILLAS = [
  { clave: "acuse", campo: "p_acuse", texto: "Acuse en la primera respuesta" },
  { clave: "guion_o_escalado", campo: "p_guion_o_escalado", texto: "Usa un guion aprobado o escala" },
  { clave: "cero_inventados", campo: "p_cero_inventados", texto: "Cero datos inventados" },
  { clave: "pii_no_repetida", campo: "p_pii_no_repetida", texto: "No repite datos personales fuera de contexto" },
] as const;

/** El quinto criterio de eval.md: una vez por conversación, al cerrarla o escalarla (0558, `office_cierres`). */
export const CRITERIO_CIERRE = "Cierre o escalado en 3 intercambios o menos";

export type ClaveCasilla = (typeof CASILLAS)[number]["clave"];
export type Veredicto = "aprobado" | "rechazado";
/** Tres estados: en la base, true / false / null. */
export type EstadoCriterio = "cumple" | "fallo" | "no_evaluado";

/**
 * Lo que marcó Sam en un criterio → su estado. La pantalla dice «marca lo que falló»: sin marcas = cumple.
 * «Falló» y «No evaluado» a la vez no tiene sentido → null (la acción lo rechaza como inválido).
 */
export function estadoDeMarcas(fallo: boolean, noEvaluado: boolean): EstadoCriterio | null {
  if (fallo && noEvaluado) return null;
  if (fallo) return "fallo";
  if (noEvaluado) return "no_evaluado";
  return "cumple";
}

const VALOR: Record<EstadoCriterio, boolean | null> = { cumple: true, fallo: false, no_evaluado: null };

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
  criterios: Record<ClaveCasilla, EstadoCriterio>;
  motivo: string;
  etapa: 1 | 2;
}

export type CodigoRevision =
  | "sin_migracion"
  | "sin_0558"
  | "sin_permiso"
  | "ya_revisado"
  | "no_en_aprobacion"
  | "no_aprobable"
  | "rechazo_sin_fallo"
  | "invalido"
  | "error";

export type ResultadoRevision = { ok: true } | { ok: false; codigo: CodigoRevision };

/**
 * Lo que la acción decide sola antes de la base: un rechazo marca al menos un fallo (la base lo repite con OFR01 y un
 * check). La aprobación NO se comprueba aquí: la base exige «cumple» en «Cero datos inventados» y en «No repite datos
 * personales» y responde 23514 («no_aprobable»), porque solo ella sabe si el borrador es una respuesta o un escalado.
 */
export function revisionValida(r: Pick<Revision, "veredicto" | "criterios">): ResultadoRevision {
  const estados = CASILLAS.map((c) => r.criterios[c.clave]);
  if (r.veredicto === "rechazado" && !estados.includes("fallo")) return { ok: false, codigo: "rechazo_sin_fallo" };
  return { ok: true };
}

export async function guardarRevision(supabase: SupabaseClient, r: Revision): Promise<ResultadoRevision> {
  const args: Record<string, unknown> = {
    p_borrador: r.borradorId,
    p_veredicto: r.veredicto,
    p_motivo: r.motivo,
    p_etapa: r.etapa,
  };
  for (const c of CASILLAS) args[c.campo] = VALOR[r.criterios[c.clave]];
  const { error } = await supabase.rpc("office_revisar_borrador_v2", args);
  if (!error) return { ok: true };
  // Sin la 0558 la función no existe: no se guarda nada (ni con la regla vieja de la 0549).
  if (faltaLaMigracion(error)) return { ok: false, codigo: "sin_0558" };
  switch (error.code) {
    case "42501":
      return { ok: false, codigo: "sin_permiso" };
    case "23505":
      return { ok: false, codigo: "ya_revisado" };
    case "55000":
      return { ok: false, codigo: "no_en_aprobacion" };
    case "23514":
      return { ok: false, codigo: "no_aprobable" };
    case "OFR01":
      return { ok: false, codigo: "rechazo_sin_fallo" };
    case "22023":
    case "22004":
    case "P0002":
      return { ok: false, codigo: "invalido" };
    default:
      return { ok: false, codigo: "error" };
  }
}

export interface ConversacionPorCerrar {
  conversacion: string;
  revisiones: number;
  ultimaRevision: string;
}

/** Las conversaciones revisadas (criterio 2) sin cierre en la etapa. Sin la 0558: `sin_migracion`. */
export async function leerPorCerrar(supabase: SupabaseClient, etapa: 1 | 2): Promise<Lectura<ConversacionPorCerrar[]>> {
  const { data, error } = await supabase.rpc("office_conversaciones_por_cerrar", { p_etapa: etapa });
  if (error) return fallo(error);
  const filas = (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
  return {
    ok: true,
    datos: filas.map((f) => ({
      conversacion: String(f.conversacion ?? ""),
      revisiones: Number(f.revisiones ?? 0),
      ultimaRevision: String(f.ultima_revision ?? ""),
    })),
  };
}

export type ResultadoCierre =
  | { ok: true }
  | { ok: false; codigo: "sin_0558" | "sin_permiso" | "ya_cerrada" | "invalido" | "error" };

/** El cierre de una conversación: una vez por conversación y etapa (0558). */
export async function registrarCierre(
  supabase: SupabaseClient,
  c: { conversacion: string; cumple: boolean; motivo: string; etapa: 1 | 2 },
): Promise<ResultadoCierre> {
  const { error } = await supabase.rpc("office_registrar_cierre", {
    p_conversacion: c.conversacion,
    p_cumple: c.cumple,
    p_motivo: c.motivo,
    p_etapa: c.etapa,
  });
  if (!error) return { ok: true };
  if (faltaLaMigracion(error)) return { ok: false, codigo: "sin_0558" };
  switch (error.code) {
    case "42501":
      return { ok: false, codigo: "sin_permiso" };
    case "23505":
      return { ok: false, codigo: "ya_cerrada" };
    case "22023":
    case "22004":
    case "P0002":
      return { ok: false, codigo: "invalido" };
    default:
      return { ok: false, codigo: "error" };
  }
}
