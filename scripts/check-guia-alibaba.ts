#!/usr/bin/env node
/**
 * Verifica la guía interactiva de Alibaba (SDD-0099 · SDD-0474).
 *
 * POR QUÉ EXISTE: `public/guias/comprar-en-alibaba.html` es un HTML suelto en
 * `/public`. No pasa por el build de Next, ni por ESLint, ni por tsc — es el
 * único artefacto del repo que se sirve tal cual, con 700+ líneas de JS
 * inline. Un string mal cerrado no rompe ninguna compilación: rompe la página
 * en blanco, en producción, para todo el que abra el enlace.
 *
 * Esto pasó durante SDD-0474 (un `<a href="...">` con comillas dobles dentro
 * de un string delimitado por comillas dobles), y sólo se vio porque se corrió
 * este check. De ahí que viva en el repo y no en un scratchpad.
 *
 * Qué comprueba:
 *   1. Que cada bloque `<script>` sea JavaScript sintácticamente válido.
 *   2. Los invariantes del contrato con la app (el mark del portal, el token
 *      {MARK}, la dirección en chino).
 *   3. Que no reaparezca lo que se retiró a propósito (el término MARKBOX, el
 *      CTA de WhatsApp de los bloques de servicio).
 *
 * Uso: `corepack pnpm tsx scripts/check-guia-alibaba.ts` — exit 1 si algo falla.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const GUIA = "public/guias/comprar-en-alibaba.html";

/** Tiene que estar: es el contrato con la app o con el proveedor chino. */
export const INVARIANTES: ReadonlyArray<readonly [string, string]> = [
  ['PARAMS.get("mark")', "lee el Shipping Mark que le pasa el portal"],
  ["lead.markbox", "persiste el mark entre etapas"],
  ["function conMark", "resuelve el token {MARK} en render"],
  ["义乌港二期直通仓2栋2号", "la dirección de la bodega en chino"],
  ["林冠", "el destinatario chino que exige Alibaba"],
  ["/api/public/cbm-rate", "pide la tarifa viva al ERP (SDD-0474)"],
];

/** No puede volver: se retiró con una decisión detrás. */
export const PROHIBIDOS: ReadonlyArray<readonly [string, string]> = [
  ["MARKBOX", "el término viejo — la política es «Shipping Mark» (BD-029)"],
  ["Pedirlo por WhatsApp", "el CTA que interrumpía en los bloques de servicio (SDD-0474)"],
];

/** Devuelve la lista de problemas; vacía si la guía está bien. */
export function revisar(html: string): string[] {
  const problemas: string[] = [];

  const bloques = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];
  if (bloques.length === 0) problemas.push("no hay ningún <script> en la guía");

  bloques.forEach((m, i) => {
    const tmp = join(tmpdir(), `guia-alibaba-check-${process.pid}-${i}.js`);
    writeFileSync(tmp, m[1], "utf8");
    try {
      execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" });
    } catch (e) {
      const err = e as { stderr?: unknown; stdout?: unknown; message?: unknown };
      const detalle = String(err.stderr || err.stdout || err.message)
        .split("\n")
        .filter((l) => l.trim())
        .slice(0, 4)
        .join(" · ");
      problemas.push(`script #${i}: sintaxis inválida → ${detalle}`);
    }
  });

  for (const [aguja, que] of INVARIANTES) {
    if (!html.includes(aguja)) problemas.push(`falta (${que}): ${aguja}`);
  }
  for (const [aguja, que] of PROHIBIDOS) {
    if (html.includes(aguja)) problemas.push(`reapareció (${que}): ${aguja}`);
  }

  return problemas;
}

// Ejecutado directo (no importado por el test).
if (process.argv[1] && process.argv[1].endsWith("check-guia-alibaba.ts")) {
  const html = readFileSync(GUIA, "utf8");
  const problemas = revisar(html);
  if (problemas.length) {
    console.error(`✗ ${GUIA}`);
    for (const p of problemas) console.error("  · " + p);
    process.exit(1);
  }
  console.log(`✓ ${GUIA} — sintaxis e invariantes OK`);
}
