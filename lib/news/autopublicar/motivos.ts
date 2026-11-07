/**
 * SDD-0611 §4.11 · Motivos de retiro: lista cerrada, con nota libre.
 *
 * La misma lista que el CHECK `news_exit_reason` de la migración 0518.
 */

import { tieneDatosPersonales } from "./control";

export const MOTIVOS_RETIRO = {
  dato_incorrecto: "Una cifra, fecha o hecho está mal",
  sin_fuente: "Afirma algo que no se puede respaldar",
  linea_roja: "Cruzó una línea roja (di cuál)",
  suena_a_ia: "No suena humano o no es la voz de DTD Cargo",
  tono: "Acusa, suena técnico o le pide al lector que compre menos",
  no_es_el_publico: "No le sirve al lector de DTD Cargo",
  repetida: "Dice lo mismo que otra noticia",
  forma: "Titular, imagen, formato o enlaces mal",
  otro: "Otra cosa; la nota es obligatoria",
} as const;

export type MotivoRetiro = keyof typeof MOTIVOS_RETIRO;

export const NOTA_MAX = 1000;

export type ErrorRetiro = "motivo_obligatorio" | "nota_obligatoria" | "nota_larga";

/** Valida motivo y nota antes de retirar. `null` = vale. */
export function validarRetiro(motivo: unknown, nota: unknown): ErrorRetiro | null {
  if (typeof motivo !== "string" || !(motivo in MOTIVOS_RETIRO)) return "motivo_obligatorio";
  const n = typeof nota === "string" ? nota.trim() : "";
  if (motivo === "otro" && n === "") return "nota_obligatoria";
  if (n.length > NOTA_MAX) return "nota_larga";
  return null;
}

/**
 * La nota la escribe una persona y viaja a la oficina. Antes de entregarla pasa
 * por el control de datos personales: si encuentra algo, no se entrega (`null`)
 * y quien llama avisa.
 */
export function notaParaOficina(nota: string | null | undefined): string | null {
  const n = (nota ?? "").trim();
  if (n === "") return "";
  return tieneDatosPersonales(n) ? null : n;
}
