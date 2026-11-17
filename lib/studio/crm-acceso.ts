/**
 * CRM como lugar único de la comunicación (SDD-0655).
 *
 * La Bandeja de Chatwoot (SDD-0585) deja el menú lateral y pasa a ser una
 * pestaña del CRM. La ruta sigue siendo `/studio/bandeja`: ahí viven la CSP con
 * `frame-src` del chat y el micrófono delegado (`next.config.ts`), y a ella
 * apuntan los `?c=N` de las fichas y de los avisos push ya entregados. CRM la
 * muestra como pestaña; no se mueve ni se redirige.
 *
 * Cada pestaña conserva su permiso:
 *  - Embudos → módulo `kommo` (rol) — el CRM de siempre.
 *  - Bandeja → módulo `bandeja` (rol) + flag `chatwoot_inbox`.
 * Quien ve CRM y no la Bandeja no ve la pestaña. Quien ve la Bandeja y no CRM
 * (hoy, `support`) entra por el mismo ítem «CRM» del menú y solo ve la pestaña
 * Bandeja: sin esto perdería su único acceso al quitarla del menú.
 *
 * DATA PURA: importable desde client y server (sidebar, páginas, pruebas).
 */
import { canAccessModule, type RoleModuleOverrides, type UserModuleGrants } from "./rbac";
import { isModuleEnabled, type FeatureFlags } from "./feature-flags-types";
import type { StudioUserRole } from "./user-types";

export const RUTA_CRM = "/studio/crm";
export const RUTA_BANDEJA = "/studio/bandeja";
/** «Agentes vinculados» (SDD-0585, E2-D10) vive en Usuarios › Bandeja desde SDD-0655. */
export const RUTA_AGENTES_VINCULADOS = "/studio/usuarios?tab=bandeja";

export interface AccesoCrm {
  /** Ve la pestaña Embudos (módulo `kommo`). */
  embudos: boolean;
  /** Ve la pestaña Bandeja (módulo `bandeja` + flag `chatwoot_inbox`). */
  bandeja: boolean;
}

export function accesoCrm(
  role: StudioUserRole | null | undefined,
  flags: FeatureFlags,
  overrides?: RoleModuleOverrides,
  grants?: UserModuleGrants,
): AccesoCrm {
  return {
    embudos: isModuleEnabled("kommo", flags) && canAccessModule(role, "kommo", overrides, grants),
    bandeja: isModuleEnabled("bandeja", flags) && canAccessModule(role, "bandeja", overrides, grants),
  };
}

/** A dónde lleva el ítem «CRM» del menú: Embudos si lo ve; si no, la Bandeja; si nada, no hay ítem. */
export function destinoCrm(acceso: AccesoCrm): string | null {
  if (acceso.embudos) return RUTA_CRM;
  if (acceso.bandeja) return RUTA_BANDEJA;
  return null;
}

function bajo(pathname: string, ruta: string): boolean {
  return pathname === ruta || pathname.startsWith(`${ruta}/`);
}

/** El ítem «CRM» del menú queda activo en sus dos pestañas (y en sus subrutas). */
export function esRutaCrm(pathname: string): boolean {
  const ruta = pathname.split(/[?#]/, 1)[0];
  return bajo(ruta, RUTA_CRM) || bajo(ruta, RUTA_BANDEJA);
}
