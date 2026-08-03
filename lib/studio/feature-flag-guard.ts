/**
 * Guard de RUTA por feature flag (SDD-0240 §6, decisión del founder 2026-08-02).
 *
 * Hasta hoy un flag apagado sólo escondía el link del sidebar
 * (`isModuleEnabled` en `StudioSidebar`). La URL seguía abriendo: apagar
 * "Aduana SENIAT" no cerraba `/studio/seniat`, sólo lo hacía más difícil de
 * encontrar. Eso convertía al panel de flags en una promesa que el sistema no
 * cumplía — la misma clase de hueco que cerró SDD-0085 con RBAC.
 *
 * Este guard cierra la ruta de verdad.
 *
 * **Un flag NO es un permiso.** Para negar acceso por rol está
 * `requireModuleView` (RBAC). Este guard responde otra pregunta: "¿esta
 * empresa usa esta feature?". Por eso van los dos, en este orden:
 *
 *   await requireModuleView("qrqueue");     // ¿tu rol puede verlo?
 *   await requireFeatureEnabled("qrqueue"); // ¿está encendido acá?
 *
 * El redirect usa `?off=` en vez de `?denied=` a propósito: el motivo es
 * distinto y el aviso también. "No tienes acceso" manda al usuario a pedirle
 * permiso a un admin; "está desactivado" le dice al admin que puede prenderlo
 * él mismo desde Ajustes.
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { listFeatureFlags } from "@/lib/studio/feature-flags-queries";
import { MODULE_FLAG_MAP } from "@/lib/studio/feature-flags-types";

/**
 * Corta la ruta si el módulo está apagado para el tenant.
 *
 * Un módulo sin entrada en `MODULE_FLAG_MAP` es "core": siempre pasa. Y si la
 * consulta falla, `listFeatureFlags` cae a `FEATURE_FLAG_DEFAULTS` —
 * **fail-open a propósito**: un problema de base no puede dejar al equipo sin
 * módulos. Cerrar el acceso es trabajo de RBAC, que sí es fail-closed.
 */
export async function requireFeatureEnabled(moduleId: string): Promise<void> {
  const flagKey = MODULE_FLAG_MAP[moduleId];
  if (!flagKey) return; // módulo core

  const supabase = await createClient();
  const flags = await listFeatureFlags(supabase);
  if (!flags[flagKey]) {
    redirect(`/studio/dashboard?off=${encodeURIComponent(moduleId)}`);
  }
}
