#!/usr/bin/env node
/**
 * SDD-0260 · ¿Los botones del Portal que ejecutan una acción declaran `aria-busy`?
 *
 * BTN-01 v1.1 §5 (política APROBADA), fila "Loading", exige cuatro cosas al botón
 * que está trabajando: bloquear repetición, conservar ancho, mostrar el verbo en
 * progreso y `aria-busy`. Las tres primeras el portal ya las cumple; la cuarta no
 * existía en NINGÚN botón (medido el 2026-08-14: 0 de 27).
 *
 * QUÉ MIRA Y QUÉ NO. No busca por nombre de archivo ni cuenta ocurrencias sueltas
 * de "aria-busy" en el texto: parsea el bloque de apertura de cada `<button ...>`
 * respetando llaves anidadas, y se queda sólo con los que tienen `disabled={...}`
 * gobernado por un estado de carga. Ésa es la diferencia entre medir el contrato y
 * medir un grep.
 *
 * LOS "CANCELAR" NO CUENTAN. Un botón de salida deshabilitado durante el `pending`
 * NO es candidato: no está ejecutando nada, y marcarlo `aria-busy` sería anunciar
 * ocupado sobre un control ocioso. Se listan aparte para que la exclusión sea
 * visible y no un silencio.
 *
 * NO ESTÁ EN EL GATE todavía, a propósito: se promueve a `verify.mjs` recién
 * cuando el arreglo del SDD-0260 esté adentro, para que no nazca en rojo.
 *
 * Uso:
 *   node scripts/check-portal-aria-busy.mjs           # informe legible
 *   node scripts/check-portal-aria-busy.mjs --strict  # sale 1 si falta alguno
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const RAIZ = "app/portal";
/** Nombres que en este repo significan "hay una mutación en vuelo". */
const EN_CURSO = /\b(pending|isPending|submitting|isSubmitting|loading|isLoading|busy)\b/;
const ESTRICTO = process.argv.includes("--strict");

function archivosTsx(dir) {
  const out = [];
  for (const entrada of readdirSync(dir)) {
    const p = join(dir, entrada);
    if (statSync(p).isDirectory()) out.push(...archivosTsx(p));
    else if (p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

/** Devuelve el bloque de apertura `<button ... >` completo desde `inicio`. */
function etiquetaDeApertura(src, inicio) {
  let profundidad = 0;
  let texto = "";
  for (let i = inicio; i < src.length; i++) {
    const c = src[i];
    texto += c;
    if (c === "{") profundidad++;
    else if (c === "}") profundidad--;
    else if (c === ">" && profundidad === 0) break;
  }
  return texto;
}

const candidatos = [];
const excluidos = [];

for (const archivo of archivosTsx(RAIZ)) {
  const src = readFileSync(archivo, "utf8");
  const lineas = src.split(/\r?\n/);

  for (let i = 0; i < src.length; i++) {
    if (!src.startsWith("<button", i)) continue;

    const etiqueta = etiquetaDeApertura(src, i);
    const disabled = etiqueta.match(/disabled=\{[^}]*\}/s)?.[0];
    if (!disabled || !EN_CURSO.test(disabled)) continue;

    const linea = src.slice(0, i).split(/\r?\n/).length;
    const tieneAriaBusy = /aria-busy/.test(etiqueta);

    // ¿Muestra un verbo en progreso? Es lo que separa al que ejecuta del que
    // sólo se bloquea (los "Cancelar"). Se busca en el cuerpo cercano.
    const cuerpo = lineas.slice(linea - 1, linea + 12).join(" ");
    const etiquetaCarga = cuerpo.match(/"([^"]*…)"/)?.[1] ?? null;
    // El botón reutilizable de PortalAddresses recibe sus labels por prop.
    const labelPorProp = /\{\s*\w+\s*\?\s*\w+\s*:\s*\w+\s*\}/.test(cuerpo);

    const fila = {
      ruta: `${archivo.replace(/\\/g, "/")}:${linea}`,
      etiquetaCarga: etiquetaCarga ?? (labelPorProp ? "(por prop)" : null),
      tieneAriaBusy,
    };

    if (fila.etiquetaCarga) candidatos.push(fila);
    else excluidos.push({ ...fila, texto: cuerpo.match(/>\s*([A-ZÁÉÍÓÚÑ][^<{]{2,40})/)?.[1]?.trim() ?? "?" });
  }
}

candidatos.sort((a, b) => a.ruta.localeCompare(b.ruta));
excluidos.sort((a, b) => a.ruta.localeCompare(b.ruta));

const faltan = candidatos.filter((c) => !c.tieneAriaBusy);

console.log(`SDD-0260 · aria-busy en el Portal del Cliente\n`);
console.log(`  botones que EJECUTAN (candidatos): ${candidatos.length}`);
console.log(`    con aria-busy: ${candidatos.length - faltan.length}`);
console.log(`    SIN aria-busy: ${faltan.length}`);
console.log(`  botones de salida deshabilitados (excluidos a propósito): ${excluidos.length}\n`);

for (const c of candidatos) {
  console.log(`  ${c.tieneAriaBusy ? "OK  " : "FALTA"} ${c.ruta}  "${c.etiquetaCarga}"`);
}

if (excluidos.length) {
  console.log(`\n  Excluidos — no ejecutan, sólo se bloquean:`);
  for (const e of excluidos) console.log(`    –  ${e.ruta}  "${e.texto}"`);
}

if (faltan.length && ESTRICTO) {
  console.error(`\n[ERROR] ${faltan.length} botón(es) sin aria-busy — BTN-01 v1.1 §5.`);
  process.exit(1);
}
if (faltan.length) {
  console.log(`\n[AVISO] ${faltan.length} sin aria-busy. Con --strict esto sale 1.`);
}
