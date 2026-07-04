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
