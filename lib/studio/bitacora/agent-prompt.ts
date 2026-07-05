/**
 * Armado del prompt "Copiar para Claude Code" (SDD-0146 · Fase 6, del piloto
 * del founder · flag `para_agente`). PURO → testeable.
 *
 * Toma título + descripción + checklist de una tarea marcada `para_agente` y
 * devuelve texto plano listo para pegar en Claude Code. La automatización real
 * (ejecutar el agente) es V2; esto solo arma y copia el texto.
 */

export interface AgentPromptTask {
  titulo: string;
  descripcion?: string | null;
  checklist?: { texto: string; done?: boolean }[];
}

/**
 * Prompt de texto plano: encabezado con el título, la descripción (si hay), los
 * pasos del checklist marcando lo hecho, y una línea de contexto. Los bloques
 * se separan con doble salto de línea (legible al pegar).
 */
export function buildAgentPrompt(task: AgentPromptTask): string {
  const parts: string[] = [];

  parts.push(`Tarea: ${task.titulo.trim()}`);

  const desc = (task.descripcion ?? "").trim();
  if (desc) parts.push(desc);

  const items = (task.checklist ?? []).filter((c) => c.texto.trim() !== "");
  if (items.length > 0) {
    const lines = items.map((c) => `- [${c.done ? "x" : " "}] ${c.texto.trim()}`);
    parts.push(["Pasos:", ...lines].join("\n"));
  }

  parts.push(
    "Contexto: tarea de Bitácora (DTD Cargo) marcada para ejecutar con Claude Code.",
  );

  return parts.join("\n\n");
}

/** Divisor legible entre prompts al copiar varias tareas de una sola vez. */
export const AGENT_PROMPT_DIVIDER = "\n\n──────────\n\n";

/**
 * Junta los prompts de varias tareas `para_agente` en un solo texto listo para
 * pegar: un encabezado con el conteo arriba y cada prompt (reusa
 * `buildAgentPrompt`) separado por un divisor legible. Lista vacía → "" (no hay
 * nada que copiar). PURA → testeable. No filtra: recibe las tareas ya elegidas.
 */
export function buildAllAgentPrompts(
  tasks: readonly AgentPromptTask[],
): string {
  if (tasks.length === 0) return "";
  const header = `# ${tasks.length} tarea${
    tasks.length === 1 ? "" : "s"
  } para Claude Code — Bitácora DTD`;
  const bodies = tasks.map((t) => buildAgentPrompt(t));
  return [header, bodies.join(AGENT_PROMPT_DIVIDER)].join("\n\n");
}
