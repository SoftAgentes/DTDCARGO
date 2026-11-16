/**
 * lib/studio/asistente/contenido/guias/index.ts · Estante 2 del minicerebro de
 * Faro (SDD-0637 §5): una guía por módulo.
 *
 * Una guía pertenece a UN solo módulo. Lo que cruza varias pantallas va al
 * estante de procesos (fase posterior), que solo se entrega a quien puede abrir
 * todos los módulos que cruza (§6.1).
 */

import type { GuiaModulo } from "../tipos";

import { GUIA_ACCOUNTING } from "./accounting";
import { GUIA_CLIENTS } from "./clients";
import { GUIA_COLLECTIONS } from "./collections";
import { GUIA_EXPENSES } from "./expenses";
import { GUIA_INVOICES } from "./invoices";
import { GUIA_MIS_BUGS } from "./mis-bugs";
import { GUIA_QUOTES } from "./quotes";
import { GUIA_REPORTS } from "./reports";
import { GUIA_SHIPMENTS } from "./shipments";
import { GUIA_TREASURY } from "./treasury";

export const GUIAS: readonly GuiaModulo[] = [
  GUIA_COLLECTIONS,
  GUIA_INVOICES,
  GUIA_TREASURY,
  GUIA_EXPENSES,
  GUIA_ACCOUNTING,
  GUIA_REPORTS,
  GUIA_CLIENTS,
  GUIA_QUOTES,
  GUIA_SHIPMENTS,
  GUIA_MIS_BUGS,
];

const POR_MODULO: ReadonlyMap<string, GuiaModulo> = new Map(
  GUIAS.map((guia) => [guia.modulo, guia]),
);

/** Guía de un módulo, o `undefined` si todavía no tiene. */
export function guiaDe(modulo: string): GuiaModulo | undefined {
  return POR_MODULO.get(modulo);
}
