#!/usr/bin/env node
/**
 * Base canónica de conocimiento de `dtd-bot` (SDD-0618 §5.2, fila 7.4 de SDD-0582).
 *
 * Genera `lib/studio/chatwoot/bot/conocimiento/base.json` desde la base v7 del repo
 * (`docs/specs/0062-crm-erp-cierres-automaticos/assets/faq-knowledge-base.md`), que es la
 * misma fuente del DOCX que hoy usa Kommo. Una sola fuente: el JSON no se edita a mano.
 *
 * Qué toma y qué deja:
 *  - toma las secciones numeradas (`### N.` y `### N-bis.`) de los bloques A a F;
 *  - separa las preguntas (`**Preguntas:**`) del texto;
 *  - QUITA las notas internas (citas `>`): son para el equipo, no para el cliente;
 *  - en la sección 28 corta el «Paso 2» (la dirección completa con el teléfono y el nombre
 *    del contacto de bodega): el bot nunca la da, y si el cliente insiste pasa a una persona
 *    (regla dura `direccion_completa`).
 *
 * Uso: `node scripts/bot-conocimiento.mjs` escribe; `--check` falla si el JSON no está al día.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const FUENTE = "docs/specs/0062-crm-erp-cierres-automaticos/assets/faq-knowledge-base.md";
export const DESTINO = "lib/studio/chatwoot/bot/conocimiento/base.json";

const PASO_2 = /^\*\*Paso 2\b/;
const ESCALA_28 =
  "Si después de ofrecerle el registro insiste en la dirección completa de recepción, no la des: pasa la conversación a una persona del equipo.";

/** Normaliza saltos de línea y espacios finales; colapsa líneas vacías repetidas. */
function limpiar(lineas) {
  const out = [];
  for (const l of lineas.map((x) => x.replace(/\s+$/, ""))) {
    if (l === "" && (out.length === 0 || out[out.length - 1] === "")) continue;
    out.push(l);
  }
  while (out.length && out[out.length - 1] === "") out.pop();
  return out.join("\n");
}

/** Las fichas de la fuente. Puro: recibe el texto del Markdown. */
export function extraerFichas(markdown) {
  const lineas = markdown.replace(/\r\n?/g, "\n").split("\n");
  const fichas = [];
  let grupo = null;
  let actual = null;

  const cerrar = () => {
    if (!actual) return;
    const texto = limpiar(actual.cuerpo);
    fichas.push({ id: actual.id, grupo: actual.grupo, titulo: actual.titulo, preguntas: actual.preguntas, texto, fuente: `${FUENTE}#${actual.id}` });
    actual = null;
  };

  for (const linea of lineas) {
    const g = /^## ([A-F]) · /.exec(linea);
    if (g) {
      cerrar();
      grupo = g[1];
      continue;
    }
    if (/^## /.test(linea)) {
      cerrar();
      grupo = null;
      continue;
    }
    const s = /^### (\d+(?:-bis)?)\. (.+)$/.exec(linea);
    if (s) {
      cerrar();
      if (grupo) actual = { id: s[1], grupo, titulo: s[2].replace(/\*\*/g, "").trim(), preguntas: [], cuerpo: [], cortado: false };
      continue;
    }
    if (/^### /.test(linea) || /^---\s*$/.test(linea)) {
      cerrar();
      continue;
    }
    if (!actual || actual.cortado) continue;
    if (/^\s*>/.test(linea)) continue; // nota interna
    const p = /^\*\*Preguntas:\*\*\s*(.*)$/.exec(linea);
    if (p) {
      actual.preguntas = p[1].split("·").map((x) => x.trim()).filter(Boolean);
      continue;
    }
    if (actual.id === "28" && PASO_2.test(linea)) {
      actual.cuerpo.push("", ESCALA_28);
      actual.cortado = true;
      continue;
    }
    actual.cuerpo.push(linea);
  }
  cerrar();
  return fichas;
}

export function generar(raiz = RAIZ) {
  const md = readFileSync(resolve(raiz, FUENTE), "utf8");
  const base = {
    $comentario: `Generado por scripts/bot-conocimiento.mjs desde ${FUENTE}. No editar a mano.`,
    fuente: FUENTE,
    fuenteSha256: createHash("sha256").update(md.replace(/\r\n?/g, "\n")).digest("hex"),
    fichas: extraerFichas(md),
  };
  return `${JSON.stringify(base, null, 2)}\n`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const nuevo = generar();
  const ruta = resolve(RAIZ, DESTINO);
  if (process.argv.includes("--check")) {
    let viejo = "";
    try {
      viejo = readFileSync(ruta, "utf8").replace(/\r\n?/g, "\n");
    } catch {
      /* falta */
    }
    if (viejo !== nuevo) {
      console.error(`${DESTINO} no está al día con ${FUENTE}: corre node scripts/bot-conocimiento.mjs`);
      process.exit(1);
    }
    console.log(`${DESTINO} al día`);
  } else {
    writeFileSync(ruta, nuevo);
    console.log(`${DESTINO} escrito (${JSON.parse(nuevo).fichas.length} fichas)`);
  }
}
