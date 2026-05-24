/**
 * Registry global de tools del runtime (SDD-0020 Fase 2D).
 *
 * Map populado al import desde los modules tools/. El orchestrator
 * resuelve los tool_keys que la skill declara en `tools_required`
 * contra este registry para armar la lista que pasa al LLM.
 *
 * Si una skill requiere un tool que no está acá → SkillNotFoundError
 * (literalmente: "skill rota porque referencia un tool inexistente").
 */

import { SHIPMENT_TOOLS } from "../tools/shipment-tools";
import type { AnyToolDef, ToolDef } from "./types";

const ALL_TOOLS: AnyToolDef[] = [
  ...(SHIPMENT_TOOLS as AnyToolDef[]),
];

const REGISTRY: Map<string, AnyToolDef> = new Map(
  ALL_TOOLS.map((t) => [t.key, t]),
);

export function getTool(key: string): AnyToolDef | undefined {
  return REGISTRY.get(key);
}

export function listAvailableTools(): string[] {
  return Array.from(REGISTRY.keys()).sort();
}

/**
 * Resuelve un array de tool_keys → array de ToolDef.
 * Si algún key falta, lo omite silenciosamente — el orchestrator decide
 * si es fatal (depende de si la skill lo declaraba en tools_required).
 */
export function resolveTools(keys: string[]): AnyToolDef[] {
  const out: AnyToolDef[] = [];
  for (const k of keys) {
    const t = REGISTRY.get(k);
    if (t) out.push(t);
  }
  return out;
}

export type { ToolDef };
