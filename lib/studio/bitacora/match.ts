/**
 * lib/studio/bitacora/match.ts · SDD-0146 Fase 2 — post-proceso determinista.
 *
 * PURO (sin red, sin reloj, sin LLM) → testeable 1:1. Convierte la salida cruda
 * del LLM (RawActa) en un borrador listo para revisión humana:
 *
 *   - Matching de `responsable_nombre` contra el equipo real: normalización sin
 *     acentos, cascada exacto → contención bidireccional → primer token.
 *   - **Regla de oro**: sin match → `assignee_user_id: null` con el nombre crudo
 *     conservado (nunca se inventa un asignado).
 *   - Fechas: sólo `^\d{4}-\d{2}-\d{2}$` reales pasan; el resto → null.
 *   - Prioridad fuera de enum → 'media'.
 *   - `entregables_cliente` → tareas `tipo:"entregable_cliente"`, título
 *     `Recibir de {cliente}: {descripcion}`, dueño
 *     `resolve(responsable_seguimiento) ?? quienRegistró ?? null`.
 *
 * Cada tarea sale marcada `{ matched, suggestedName }` para que la UI muestre
 * "la IA sugirió «X», sin match" en ámbar cuando corresponda.
 */

import type { RawActa } from "./extract";
import type { AssignableProfile } from "./bitacora-queries";
import {
  isBitacoraPrioridad,
  type ActaDuda,
  type ActaHilo,
  type ActaProxima,
  type BitacoraPrioridad,
  type BitacoraTaskTipo,
  type MeetingTipo,
} from "./bitacora-types";
import { isIsoDate } from "./dates";

export interface ResolveOpts {
  tipo: MeetingTipo;
  clienteNombre?: string | null;
  /** Dueño por defecto de los entregables del cliente (quien registró el acta). */
  quienRegistroId?: string | null;
  /** Fecha del acta (para el título por defecto). */
  fechaISO?: string | null;
}

export interface ResolvedTask {
  titulo: string;
  descripcion: string | null;
  prioridad: BitacoraPrioridad;
  tipo: BitacoraTaskTipo;
  due_date: string | null;
  para_agente: boolean;
  checklist: string[];
  /** user_id del dueño resuelto, o null (sin asignar — regla de oro). */
  assignee_user_id: string | null;
  /** Nombre crudo que sugirió la IA (se conserva aunque no matchee). */
  responsable_nombre: string | null;
  /** ¿Quedó con dueño? (`assignee_user_id != null`). */
  matched: boolean;
  /** Nombre sugerido por la IA sin match (para el aviso ámbar). null si matcheó. */
  suggestedName: string | null;
}

export interface ResolvedActa {
  titulo: string;
  resumen: string;
  puntos: string[];
  hablaron: string[];
  decisiones: string[];
  pendientes: string[];
  proxima_reunion: ActaProxima;
  hilos: ActaHilo[];
  dudas_clasificacion: ActaDuda[];
  tasks: ResolvedTask[];
}

/** Normaliza para comparar: sin acentos, minúsculas, sin espacios de sobra. */
export function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function nameTokens(s: string): string[] {
  return normalizeName(s).split(/\s+/).filter(Boolean);
}

/**
 * Resuelve un nombre crudo contra el pool del equipo. Cascada:
 *   (a) igualdad exacta (normalizada),
 *   (b) contención bidireccional,
 *   (c) primer token del nombre presente como palabra del display_name.
 * Sin match → null (nunca se inventa).
 */
export function resolveName(
  rawName: string | null | undefined,
  profiles: readonly AssignableProfile[],
): string | null {
  const name = normalizeName(rawName ?? "");
  if (!name) return null;

  // (a) exacto — barre TODO el pool antes de bajar de nivel.
  for (const p of profiles) {
    if (normalizeName(p.display_name) === name) return p.user_id;
  }
  // (b) contención bidireccional.
  for (const p of profiles) {
    const pn = normalizeName(p.display_name);
    if (pn === "") continue;
    if (pn.includes(name) || name.includes(pn)) return p.user_id;
  }
  // (c) primer token del nombre buscado como palabra del display_name.
  const first = nameTokens(rawName ?? "")[0];
  if (first) {
    for (const p of profiles) {
      if (nameTokens(p.display_name).includes(first)) return p.user_id;
    }
  }
  return null;
}

function isoOrNull(v: string | null | undefined): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return isIsoDate(t) ? t : null;
}

function cleanList(v: string[] | undefined): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((s) => s.trim()).filter((s) => s.length > 0);
}

/**
 * Convierte el acta cruda + el pool en un borrador revisable. Determinista.
 */
export function resolveActa(
  raw: RawActa,
  profiles: readonly AssignableProfile[],
  opts: ResolveOpts,
): ResolvedActa {
  const cliente = (opts.clienteNombre ?? "").trim();
  const fecha = isoOrNull(opts.fechaISO);
  const titulo =
    opts.tipo === "cliente"
      ? `Conversación con ${cliente || "cliente"}${fecha ? ` · ${fecha}` : ""}`
      : `Reunión${fecha ? ` · ${fecha}` : ""}`;

  const tasks: ResolvedTask[] = [];

  // Tareas del equipo (tipo empleado).
  for (const t of raw.tareas ?? []) {
    const titWork = (t.titulo ?? "").trim();
    if (!titWork) continue;
    const rawResp = (t.responsable_nombre ?? "").trim() || null;
    const assignee = resolveName(rawResp, profiles);
    const matched = assignee != null;
    tasks.push({
      titulo: titWork,
      descripcion: null,
      prioridad: isBitacoraPrioridad(t.prioridad) ? t.prioridad : "media",
      tipo: "empleado",
      due_date: isoOrNull(t.due_date),
      para_agente: t.para_agente === true,
      checklist: cleanList(t.checklist),
      assignee_user_id: assignee,
      responsable_nombre: rawResp,
      matched,
      suggestedName: matched ? null : rawResp,
    });
  }

  // Entregables del cliente → tareas de seguimiento internas.
  for (const e of raw.entregables_cliente ?? []) {
    const desc = (e.descripcion ?? "").trim();
    if (!desc) continue;
    const rawSeg = (e.responsable_seguimiento ?? "").trim() || null;
    const resolvedSeg = resolveName(rawSeg, profiles);
    const assignee = resolvedSeg ?? opts.quienRegistroId ?? null;
    const matched = assignee != null;
    tasks.push({
      titulo: cliente
        ? `Recibir de ${cliente}: ${desc}`
        : `Recibir del cliente: ${desc}`,
      descripcion: null,
      prioridad: "media",
      tipo: "entregable_cliente",
      due_date: isoOrNull(e.due_date),
      para_agente: false,
      checklist: [],
      assignee_user_id: assignee,
      responsable_nombre: rawSeg,
      matched,
      // Sólo avisamos "sin match" si de verdad quedó sin dueño con un nombre crudo.
      suggestedName: matched ? null : rawSeg,
    });
  }

  const prox = raw.proxima_reunion ?? {};
  return {
    titulo,
    resumen: (raw.resumen ?? "").trim(),
    puntos: cleanList(raw.puntos),
    hablaron: cleanList(raw.hablaron),
    decisiones: cleanList(raw.decisiones),
    pendientes: cleanList(raw.pendientes),
    proxima_reunion: {
      fecha: isoOrNull(prox.fecha),
      foco: (prox.foco ?? "").trim() || null,
    },
    hilos: resolveHilos(raw.hilos),
    dudas_clasificacion: resolveDudas(raw.dudas_clasificacion),
    tasks,
  };
}

/** RawActaHilo[] → ActaHilo[] (descarta los sin tema; normaliza null). */
function resolveHilos(raw: RawActa["hilos"]): ActaHilo[] {
  if (!Array.isArray(raw)) return [];
  const out: ActaHilo[] = [];
  for (const h of raw) {
    const tema = (h?.tema ?? "").trim();
    if (!tema) continue;
    out.push({
      tema,
      estado_final: (h.estado_final ?? "").trim() || null,
      contradiccion_sin_resolver: h.contradiccion_sin_resolver === true,
    });
  }
  return out;
}

/** RawActaDuda[] → ActaDuda[] (descarta las sin texto; normaliza null). */
function resolveDudas(raw: RawActa["dudas_clasificacion"]): ActaDuda[] {
  if (!Array.isArray(raw)) return [];
  const out: ActaDuda[] = [];
  for (const d of raw) {
    const texto = (d?.texto ?? "").trim();
    if (!texto) continue;
    out.push({
      texto,
      hablante: (d.hablante ?? "").trim() || null,
      opciones: cleanList(d.opciones),
    });
  }
  return out;
}
