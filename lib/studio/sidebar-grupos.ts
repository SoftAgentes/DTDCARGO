/**
 * Menú lateral cerrado (SDD-0709): un icono por grupo, no uno por módulo.
 *
 * Data pura (sin React) para poder probarla y compartirla. El icono de cada grupo
 * es un nombre del objeto `Icon`; los grupos y su orden salen de `modules.ts`.
 */

import type { IconName } from "@/app/studio/_components/icons";
import type { Group } from "./modules";

export const GROUP_ICONS: Record<Group, IconName> = {
  "OPERACIÓN": "truck",
  "COMERCIAL": "users",
  "FINANZAS": "invoice",
  "MARKETING": "spark",
  "SISTEMA": "cog",
};

/**
 * Módulo que va suelto arriba del menú cerrado, fuera de los grupos: el Dashboard
 * es la pantalla de inicio y se usa varias veces al día; un clic menos que abrir
 * un grupo. Los cinco grupos siguen siendo los únicos que agrupan.
 */
export const MODULO_SUELTO_CERRADO = "dashboard";
