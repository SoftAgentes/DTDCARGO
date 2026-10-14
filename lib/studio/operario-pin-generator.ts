/**
 * Generador del PIN de operario · SDD-0513. SOLO servidor.
 *
 * Usa `crypto.randomInt` de Node (CSPRNG). Nunca `Math.random`: no es
 * criptográfico y su estado se puede reconstruir a partir de salidas previas.
 * El PIN se genera dentro de la server action, después del candado de rol, y
 * no se escribe en ningún log, tabla, URL ni almacenamiento del navegador.
 */

import "server-only";
import { randomInt } from "node:crypto";
import { drawOperarioPin } from "./operario-pin";

export function generateOperarioPin(): string {
  return drawOperarioPin(randomInt);
}
