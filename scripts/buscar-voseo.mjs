#!/usr/bin/env node
/**
 * SDD-0296 · Busca voseo en el COPY (texto que ve el usuario).
 *
 *     node scripts/buscar-voseo.mjs
 *
 * ⚠️ **NO está cableado a `verify.mjs` a propósito.** Meter una lista de
 * palabras en el gate compartido es decisión del founder: un falso positivo
 * ahí frena a las 15-20 ventanas que trabajan en paralelo. Esto se corre a
 * mano. Sale 1 si encuentra algo, para que sirva en un hook si algún día se
 * decide.
 *
 * ## Por qué NO usa `grep` ni una expresión regular sobre el archivo crudo
 *
 * Se intentó, y se equivocó de tres maneras distintas:
 *
 *  1. **El `\n` escrito en el fuente es la letra `n`.** En
 *     `` `…</untrusted_content>\n\nUsá las tools…` `` el carácter pegado a
 *     "Usá" es una **ene**, así que cualquier guarda de límite de palabra
 *     (`\b`, `(?<!\w)`) la toma por letra y descarta la coincidencia. Un
 *     parser resuelve el escape; un grep, no.
 *  2. **Un comentario no es copy.** `// tenés permiso` no le llega a nadie.
 *     El primer barrido devolvió 45 resultados y ~40 eran comentarios.
 *  3. **En Git Bash el locale no trata los acentos como caracteres de
 *     palabra**, así que `\bescribí\b` matchea DENTRO de «escribían».
 *
 * Por eso recorre el AST y mira solo `StringLiteral`, plantillas y `JsxText`.
 *
 * ## Y por qué la lista es explícita, no morfológica
 *
 * "Verbo agudo terminado en á/é/í" matchea inglés en masa: `create`, `update`,
 * `template`, `delete`. Lista a mano, siempre.
 *
 * **Los imperativos en `-í` quedan afuera** (abrí, escribí, seguí, subí, vení):
 * coinciden con el pretérito de 1ª persona. «Abrí tu caso y lo estoy
 * revisando» es «yo abrí» — castellano correcto, no voseo.
 */

import ts from "typescript";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";

/** Presente de indicativo voseo. Inequívocas. */
const PRESENTE = [
  "tenés", "podés", "querés", "necesitás", "sabés", "hacés", "ponés",
  "venís", "decís", "vivís", "salís", "seguís", "conocés", "debés",
  "creés", "tomás", "mandás", "buscás", "usás", "llevás",
];

/**
 * Imperativos en `-á` de verbos `-ar`. La 1ª persona del pretérito de esos
 * verbos termina en `-é` (yo capturé), así que no hay colisión posible.
 */
const IMPERATIVO = [
  "cotizá", "pagá", "mirá", "andá", "revisá", "capturá", "ingresá",
  "seleccioná", "buscá", "guardá", "agregá", "cargá", "enviá", "confirmá",
  "verificá", "completá", "tocá", "dejá", "cerrá", "actualizá", "descargá",
  "recordá", "usá", "creá", "aplicá", "fijá", "probá", "quedá", "llamá",
  "entrá", "sumá", "restá", "calculá", "apretá", "escuchá", "esperá",
  "empezá", "terminá", "contactá", "escribinos", "llamanos", "contactanos",
  "avisá", "marcá", "anotá", "copiá", "pegá", "arrastrá", "soltá", "elegí",
];

/**
 * Enclíticos. En tuteo llevan tilde (mándame, cuéntame, fíjate) porque quedan
 * esdrújulas; en voseo son llanas y van sin tilde. La grafía sola los separa.
 * No terminan en `-á/-és`, así que ninguna lista de terminaciones los agarra.
 */
const ENCLITICO = [
  "mandame", "contame", "decime", "devolveme", "escribime", "avisame",
  "llamame", "dejame", "esperame", "mostrame", "traeme", "pedime",
  "fijate", "acordate", "quedate", "sentate", "andate",
  "mirame", "buscame", "guardame", "pasame", "contactame",
];

const FORMAS = [...PRESENTE, ...IMPERATIVO, ...ENCLITICO];
const RX = new RegExp(`(?<![\\p{L}])(${FORMAS.join("|")})(?![\\p{L}])`, "giu");

/** Archivos que NOMBRAN las formas para prohibirlas o probarlas. */
const PERMITIDOS = new Set([
  "lib/studio/agents/skills/service-advisor.ts",
  "lib/portal/verify-gate.test.ts",
]);

const RAICES = ["app", "components", "lib"];

const esTest = (p) => /[\\/]__tests__[\\/]|\.test\.[tj]sx?$/.test(p);

function* archivos(dir) {
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e);
    if (statSync(p).isDirectory()) {
      if (e === "node_modules" || e === ".next") continue;
      yield* archivos(p);
    } else if (/\.tsx?$/.test(p) && !esTest(p)) {
      yield p;
    }
  }
}

/** Texto que ve el usuario dentro de un archivo. */
function copyDe(archivo) {
  const texto = readFileSync(archivo, "utf8");
  const sf = ts.createSourceFile(
    archivo, texto, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX,
  );
  const out = [];
  const visitar = (n) => {
    let valor = null;
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) valor = n.text;
    else if (ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) valor = n.text;
    else if (ts.isJsxText(n)) valor = n.text;
    if (valor) {
      const { line } = sf.getLineAndCharacterOfPosition(n.getStart(sf));
      out.push({ valor, linea: line + 1 });
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return out;
}

const hallazgos = [];
for (const raiz of RAICES) {
  if (!existsSync(raiz)) continue;
  for (const archivo of archivos(raiz)) {
    const rel = archivo.split(path.sep).join("/");
    if (PERMITIDOS.has(rel)) continue;
    for (const { valor, linea } of copyDe(archivo)) {
      for (const m of valor.matchAll(RX)) {
        hallazgos.push({ rel, linea, forma: m[0], muestra: valor.trim().slice(0, 80) });
      }
    }
  }
}

for (const h of hallazgos) {
  console.log(`  ${h.rel}:${h.linea}  ${h.forma.padEnd(12)} | ${h.muestra}`);
}

if (hallazgos.length === 0) {
  console.log(`[OK] sin voseo en copy · ${FORMAS.length} formas buscadas en ${RAICES.join(", ")}`);
  process.exit(0);
}
console.log(`\n[VOSEO] ${hallazgos.length} aparición(es). Regla: castellano VE neutro, TUTEO.`);
process.exit(1);
