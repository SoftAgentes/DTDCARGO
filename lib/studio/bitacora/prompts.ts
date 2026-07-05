/**
 * lib/studio/bitacora/prompts.ts · SDD-0146 Fase 2 — "secretario de actas".
 *
 * Builder PURO del prompt que convierte una transcripción en acta estructurada.
 * Portado VERBATIM del origen (Loop3D · PROMPT-BITACORA.md §5.2), con las
 * adaptaciones deliberadas del spec:
 *   - la línea de puntos clave se llama `puntos` (no "bitácora" — evita colisión
 *     con el nombre del módulo);
 *   - ancla DURA de HOY en America/Caracas (día + fecha ISO) inyectada
 *     server-side: sin ella "mañana" / "el viernes 10" caen en años pasados;
 *   - mapeo contra los nombres REALES del equipo (display_name de
 *     bitacora_assignable_profiles());
 *   - 2 variantes: reunión interna vs conversación con cliente (el cliente NO
 *     usa el sistema ni ejecuta tareas: sus compromisos van en
 *     entregables_cliente);
 *   - instrucción "NO inventes tareas ni entregables".
 *
 * Sin red, sin reloj (hoyISO/hoyDia inyectados) → testeable en Vitest. La
 * estructura de salida la fuerza el tool-use de extract.ts; este prompt da la
 * guía semántica de cada campo.
 */

import type { MeetingTipo } from "./bitacora-types";

export interface BuildActaPromptOpts {
  /** Transcripción cruda (se trimmea acá). */
  transcript: string;
  tipo: MeetingTipo;
  /** Nombre del cliente (solo variante "cliente"). */
  clienteNombre?: string | null;
  /** display_name de los asignables reales del equipo. */
  teamNames: string[];
  /** HOY en Caracas como YYYY-MM-DD (ancla dura). */
  hoyISO: string;
  /** Día de la semana de HOY en es-VE ("sábado"…). */
  hoyDia: string;
  /**
   * Resumen que el humano corrigió en la revisión (mejora "volver a generar
   * tareas"). Si viene no-vacío, se inyecta como GUÍA PRIORITARIA de qué tareas
   * extraer — sin autorizar a inventar nada fuera de la transcripción. Vacío /
   * ausente en el flujo normal → prompt idéntico al de antes.
   */
  resumenGuia?: string | null;
}

/**
 * Bloque COMÚN compartido por ambas secretarias (default ERP y — a futuro —
 * Escucha Activa). Núcleo que no debe desincronizarse: qué campos extraer,
 * clasificación empleado-vs-externo, hilos, dudas de clasificación, mapeo al
 * equipo real y la regla anti-alucinación de audio. NO incluye el intro por-tipo
 * ni la transcripción (los agrega cada builder). Instrucción de CONCISIÓN
 * explícita: el detalle va en los campos estructurados, no en prosa larga.
 *
 * `incluyeEntregables` = true en conversaciones con cliente (el externo no
 * ejecuta tareas: sus compromisos van en `entregables_cliente`).
 */
export function buildActaCommonBlock(opts: {
  teamNames: string[];
  incluyeEntregables: boolean;
}): string {
  const nombres =
    opts.teamNames.filter((n) => n.trim() !== "").join(", ") || "(sin lista)";

  const tareasInstr = opts.incluyeEntregables
    ? `- tareas: tareas CONCRETAS para los EMPLEADOS — lo que debe hacer quien atendió al cliente y otros empleados relacionados. NO le asignes tareas al cliente. Cada una con responsable (un empleado), fecha límite (YYYY-MM-DD si es deducible), prioridad y sub-pasos (checklist) si aplica.
- entregables_cliente: lo que el CLIENTE quedó en ENTREGAR o ENVIAR para avanzar o para la próxima llamada (ej: adelanto, logo en vector, medidas, aprobación, referencia de pago). Cada uno con: descripcion breve, responsable_seguimiento (empleado que lo persigue, si se menciona) y due_date (YYYY-MM-DD si se deduce).`
    : `- tareas: lista de tareas CONCRETAS con responsable, fecha límite (YYYY-MM-DD si es deducible), prioridad y sub-pasos (checklist) si aplica.`;

  return `A partir de la transcripción, extrae lo esencial — sé BREVE y concreto: el detalle va en los campos estructurados, no en prosa larga.
- resumen: 2-4 frases con lo esencial.
- puntos: puntos clave hablados (bullets).
- hablaron: nombres de quienes participaron.
- decisiones: acuerdos tomados.
- pendientes: temas que quedaron en el aire para la próxima vez.
- hilos: cuando un tema se tocó en partes separadas y se retomó, cóselo en un solo hilo; anota el estado FINAL (si un dato se corrigió, vale el último) y si quedó una contradicción sin resolver.
- dudas_clasificacion: cuando no quede claro si alguien es del equipo o externo (y eso cambia si va como tarea o como pendiente), NO lo decidas: anótalo como duda con las opciones.
- vinculo_cliente: si se habló con un externo (cliente/proveedor/contratista), detecta CON QUIÉN (nombre, empresa o apodo tal como se dijo). Solo el nombre — NO inventes un cliente; el sistema lo cruza con la tabla y el humano confirma. Marca posible_cliente_nuevo si actúa como cliente pero no parece uno ya conocido.
- proxima_reunion: fecha (YYYY-MM-DD si es deducible) y foco, si se menciona.
${tareasInstr}

Mapea cada responsable a uno de estos nombres reales del equipo cuando sea posible: ${nombres}.
Analiza solo lo transcrito; no inventes tono, pausas ni gestos que no estén en el texto.
NO inventes tareas ni entregables que no se hayan hablado. Responde en español.`;
}

/**
 * Arma el prompt de la SECRETARIA BITÁCORA ERP (default de la oficina).
 * Puro: todo dato temporal / contextual entra por parámetro. Usa el bloque
 * común + el intro por-tipo + la transcripción.
 */
export function buildActaErpPrompt(opts: BuildActaPromptOpts): string {
  const { tipo, hoyISO, hoyDia } = opts;
  const clean = opts.transcript.trim();
  const cliente = (opts.clienteNombre ?? "").trim() || "el cliente";

  // Guía del líder (regenerar): el humano ya corrigió el resumen → lo usamos
  // como norte de qué tareas importan, ANTES de la transcripción. Sin guía el
  // bloque es "" y el prompt queda idéntico al de sin-guía.
  const guia = (opts.resumenGuia ?? "").trim();
  const guiaBloque = guia
    ? `\nEl líder ya revisó esta conversación y corrigió el resumen para reflejar lo que realmente importa. Usa este resumen como GUÍA PRIORITARIA de qué tareas extraer (sin inventar nada que no esté en la transcripción):\n${guia}\n`
    : "";

  const contexto =
    tipo === "cliente"
      ? `Esto es una CONVERSACIÓN CON EL CLIENTE "${cliente}" (por ejemplo una llamada telefónica). El cliente NO usa nuestro sistema ni ejecuta tareas: sus compromisos van en entregables_cliente, nunca como tareas.`
      : `Esto es una reunión interna de trabajo del equipo.`;

  const common = buildActaCommonBlock({
    teamNames: opts.teamNames,
    incluyeEntregables: tipo === "cliente",
  });

  return `Eres el secretario que documenta esta conversación de trabajo. ${contexto} HOY es ${hoyDia} ${hoyISO}. Toda fecha relativa o sin año ("mañana", "el viernes 10", "el 15 de julio") se resuelve contra HOY, hacia el presente o futuro cercano — nunca hacia años pasados. ${common}
${guiaBloque}
--- TRANSCRIPCIÓN ---
${clean}`;
}

/** Alias de compatibilidad: el call site histórico y los tests usan este nombre. */
export const buildActaPrompt = buildActaErpPrompt;
