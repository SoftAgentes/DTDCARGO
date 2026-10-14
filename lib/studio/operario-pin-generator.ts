/**
 * Generador del PIN de operario · SDD-0513. SOLO servidor.
 *
 * Usa `crypto.randomInt` de Node (CSPRNG). Nunca `Math.random`: no es
 * criptográfico y su estado se puede reconstruir a partir de salidas previas.
 * El PIN se genera dentro de la server action, después del candado de rol, y
 * no se escribe en ningún log, tabla, URL ni almacenamiento del navegador.
 *
 * SDD-0515: desde 0475 la base rechaza (P0018) un PIN que ya usa otro operario
 * activo del mismo tenant y región. `saveWithGeneratedOperarioPin` es el
 * generador con reintento: sortea otro PIN distinto y vuelve a guardar.
 */

import "server-only";
import { randomInt } from "node:crypto";
import { drawOperarioPin, saveWithFreshOperarioPin, type OperarioPinSave } from "./operario-pin";

export function generateOperarioPin(): string {
  return drawOperarioPin(randomInt);
}

/**
 * Guarda un PIN generado aquí y, si la base dice que está repetido, genera
 * otro. `save` recibe cada candidato; el resultado trae el PIN guardado o el
 * último rechazo, nunca un PIN rechazado.
 */
export function saveWithGeneratedOperarioPin<E extends { code?: string }>(
  save: (pin: string) => PromiseLike<{ error: E | null }>,
): Promise<OperarioPinSave<E>> {
  return saveWithFreshOperarioPin(generateOperarioPin, save);
}
