#!/usr/bin/env node
/**
 * scripts/migrations-lock.mjs — el candado de las migraciones aplicadas (SDD-0561).
 *
 * `supabase/migrations.lock.json` guarda, por cada migración ya aplicada en
 * producción, la identidad de su archivo: sha256, md5 y bytes. Sin el candado,
 * editar una migración aplicada (una cabecera «corregida», un comentario) pasaba el
 * CI y el repo dejaba de describir lo que corrió en la base, sin que nada fallara
 * (hallazgo MIG-05 de docs/audits/2026-10-18-contabilidad-anexo-hallazgos.md).
 *
 * La verificación falla con:
 *   FORMATO    el candado no tiene el formato de JSON.stringify(…, null, 2), las
 *              claves no están ordenadas o un campo está mal formado;
 *   FALTA      una migración sellada no existe: se borró o se renombró;
 *   CAMBIADA   el archivo no tiene la identidad sellada (ni la de su última
 *              excepción registrada);
 *   ESPERA     una migración sellada sigue en pendingBelowCutoff: o está aplicada
 *              o es una espera, no las dos cosas;
 *   SIN_SELLO  un archivo sin sellar y que no es espera, con número menor o igual
 *              al de la mayor sellada: una migración nueva con número viejo, que el
 *              corte (238) y la puerta de la publicación no verían nunca;
 *   HISTORIA   contra el candado del punto de partida (merge-base de HEAD con
 *              origin/main): una identidad sellada cambió o desapareció, o una
 *              excepción registrada se borró o se reescribió. Sin git, sin
 *              origin/main o sin candado en ese punto no se compara, y lo dice.
 *
 * Una migración nueva entra al candado cuando se aplica: retirar-espera.mjs la sella
 * al retirar su espera, con el md5 que dio la verificación del apply. Un cambio
 * aceptado de un archivo sellado se registra con `excepcion`, con su motivo y su
 * autorización; la identidad sellada no se reescribe nunca.
 *
 * Uso:
 *   node scripts/migrations-lock.mjs [verificar] [--raiz <checkout>] [--base <ref> | --sin-base]
 *   node scripts/migrations-lock.mjs sellar <NNNN_nombre> --md5 <md5 del ledger> [--raiz <checkout>] [--en-seco]
 *   node scripts/migrations-lock.mjs excepcion <NNNN_nombre> --motivo "…" --autorizacion "…"
 *       [--fecha AAAA-MM-DD] [--raiz <checkout>] [--en-seco]
 *   node scripts/migrations-lock.mjs crear --hasta <NNNN> [--raiz <checkout>] [--en-seco]
 *
 * Códigos: 0 listo · 1 la verificación encontró errores · 2 uso inválido o archivo
 * ilegible · 3 rechazado (ya sellada, md5 distinto, espera sin retirar, candado ya
 * creado, excepción que no cambia nada).
 *
 * No se conecta a ninguna base. Pruebas: scripts/tests/migrations-lock.node.mjs.
 * Procedimiento: docs/runbooks/aplicar-migraciones-prod.md §6 y §8.
 */
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const CANDADO = "supabase/migrations.lock.json";
export const BASELINE = "supabase/migrations-baseline.json";
export const MIGRACIONES = "supabase/migrations";
export const ESQUEMA = 1;
export const NOMBRE_RE = /^[0-9]{4}[a-z]?_[a-z0-9_]+$/;
export const MD5_RE = /^[0-9a-f]{32}$/;
const SHA256_RE = /^[0-9a-f]{64}$/;
const FECHA_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
/** Un motivo o una autorización de menos caracteres no explica nada. */
export const TEXTO_MINIMO = 10;
const CLAVES_RAIZ = new Set(["$doc", "schemaVersion", "selladas"]);
const CLAVES_ENTRADA = new Set(["sha256", "md5", "bytes", "excepciones"]);
const CLAVES_EXCEPCION = ["fecha", "motivo", "autorizacion", "sha256", "md5", "bytes"];

export const DOC = [
  "Candado de las migraciones aplicadas (SDD-0561). Lo verifica scripts/migrations-lock.mjs,",
  "que corre en scripts/tests/migrations-lock.node.mjs (pnpm harness:test, CI y pnpm verify).",
  "",
  "Cada entrada de `selladas` es una migración ya aplicada en producción y la identidad de",
  "su archivo: sha256, md5 y bytes de supabase/migrations/<nombre>.sql. Si el archivo",
  "cambia, se borra o se renombra, la verificación falla. El md5 y los bytes son los mismos",
  "que compara el ledger (md5 de statements): la identidad sellada no se reescribe nunca.",
  "",
  "QUÉ ENTRÓ AL CREARLO (2026-10-19, origin/main 3f3a52cc): todas las migraciones del repo",
  "hasta la 0491, menos las esperas de pendingBelowCutoff (0422 y 0423), que no están",
  "aplicadas. Se sellaron los archivos tal como estaban en main; el candado no comparó",
  "esos md5 contra el ledger de producción (motivo y alcance en la SDD-0561).",
  "",
  "UNA MIGRACIÓN NUEVA se sella cuando se aplica, en la rama de cierre:",
  "infra/ops/migraciones/retirar-espera.mjs <NNNN_nombre> --md5 <md5 del ledger> retira la",
  "espera y la sella; se niega si el archivo no tiene ese md5. Sin espera que retirar:",
  "scripts/migrations-lock.mjs sellar <NNNN_nombre> --md5 <md5>.",
  "",
  "UN CAMBIO ACEPTADO de una migración sellada (por ejemplo, un comentario corregido con",
  "decisión explícita) NO se tapa reescribiendo el sello: scripts/migrations-lock.mjs",
  "excepcion <nombre> --motivo \"…\" --autorizacion \"…\" agrega a la entrada una excepción",
  "con la identidad nueva, la fecha, el motivo y quién lo aceptó. El archivo tiene que",
  "tener la identidad de la última excepción; la de la raíz sigue siendo la sellada.",
  "Las excepciones solo se agregan. Editar una migración aplicada sigue prohibido por",
  "docs/runbooks/aplicar-migraciones-prod.md §8: la excepción registra una salida",
  "autorizada, no la habilita.",
];

export class Rechazo extends Error {
  constructor(mensaje, codigo) {
    super(mensaje);
    this.codigo = codigo;
  }
}

export const formato = (o) => JSON.stringify(o, null, 2) + "\n";
export const numero = (nombre) => Number.parseInt(String(nombre).slice(0, 4), 10);
const esObjeto = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const corto = (h) => `${String(h).slice(0, 12)}…`;
const comparar = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const hoy = () => new Date().toISOString().slice(0, 10);
const pad = (n) => String(n).padStart(4, "0");

/** sha256, md5 y bytes de los bytes exactos de un archivo. */
export function identidad(buf) {
  return {
    sha256: crypto.createHash("sha256").update(buf).digest("hex"),
    md5: crypto.createHash("md5").update(buf).digest("hex"),
    bytes: buf.length,
  };
}

/** La identidad que el archivo tiene que tener hoy: la de su última excepción, o la sellada. */
export function identidadVigente(entrada) {
  const excepciones = Array.isArray(entrada.excepciones) ? entrada.excepciones : [];
  const fuente = excepciones.length ? excepciones[excepciones.length - 1] : entrada;
  return { sha256: fuente.sha256, md5: fuente.md5, bytes: fuente.bytes };
}

const mismaIdentidad = (a, b) => a.sha256 === b.sha256 && a.md5 === b.md5 && a.bytes === b.bytes;
const mismaExcepcion = (a, b) => esObjeto(a) && esObjeto(b) && CLAVES_EXCEPCION.every((k) => a[k] === b[k]);

function erroresDeIdentidad(o, donde) {
  const e = [];
  if (typeof o.sha256 !== "string" || !SHA256_RE.test(o.sha256)) e.push(`${donde}: sha256 tiene que ser 64 hex en minúscula`);
  if (typeof o.md5 !== "string" || !MD5_RE.test(o.md5)) e.push(`${donde}: md5 tiene que ser 32 hex en minúscula`);
  if (!Number.isSafeInteger(o.bytes) || o.bytes < 0) e.push(`${donde}: bytes tiene que ser un entero mayor o igual a 0`);
  return e;
}

/**
 * Errores de forma del candado. Con `texto`, exige además que sea exactamente
 * `formato(candado)`: así los scripts lo reescriben sin ruido y un diff muestra solo
 * la entrada que cambió.
 */
export function erroresDeFormato(candado, texto = null) {
  const errores = [];
  const e = (mensaje, nombre = null) => errores.push({ tipo: "FORMATO", nombre, mensaje });
  if (!esObjeto(candado)) {
    e("el candado no es un objeto JSON");
    return errores;
  }
  for (const k of Object.keys(candado)) if (!CLAVES_RAIZ.has(k)) e(`clave desconocida en la raíz: ${k}`);
  if (candado.schemaVersion !== ESQUEMA) e(`schemaVersion tiene que ser ${ESQUEMA}`);
  if (!esObjeto(candado.selladas)) {
    e("falta el objeto selladas");
    return errores;
  }
  const nombres = Object.keys(candado.selladas);
  const ordenados = [...nombres].sort(comparar);
  if (nombres.some((n, i) => n !== ordenados[i])) e("las claves de selladas no están en orden");
  for (const nombre of nombres) {
    const entrada = candado.selladas[nombre];
    if (!NOMBRE_RE.test(nombre)) e("nombre inválido: tiene que ser NNNN_nombre, sin .sql", nombre);
    if (!esObjeto(entrada)) {
      e("la entrada no es un objeto", nombre);
      continue;
    }
    for (const k of Object.keys(entrada)) if (!CLAVES_ENTRADA.has(k)) e(`clave desconocida: ${k}`, nombre);
    for (const m of erroresDeIdentidad(entrada, "identidad sellada")) e(m, nombre);
    if (entrada.excepciones === undefined) continue;
    if (!Array.isArray(entrada.excepciones) || entrada.excepciones.length === 0) {
      e("excepciones tiene que ser una lista con al menos una", nombre);
      continue;
    }
    let anterior = entrada;
    entrada.excepciones.forEach((x, i) => {
      const donde = `excepción ${i + 1}`;
      if (!esObjeto(x)) {
        e(`${donde}: no es un objeto`, nombre);
        return;
      }
      for (const k of Object.keys(x)) if (!CLAVES_EXCEPCION.includes(k)) e(`${donde}: clave desconocida: ${k}`, nombre);
      if (typeof x.fecha !== "string" || !FECHA_RE.test(x.fecha)) e(`${donde}: la fecha tiene que ser AAAA-MM-DD`, nombre);
      for (const campo of ["motivo", "autorizacion"]) {
        if (typeof x[campo] !== "string" || x[campo].trim().length < TEXTO_MINIMO) {
          e(`${donde}: ${campo} vacío o de menos de ${TEXTO_MINIMO} caracteres`, nombre);
        }
      }
      for (const m of erroresDeIdentidad(x, donde)) e(m, nombre);
      if (x.sha256 === anterior.sha256) e(`${donde}: tiene la misma identidad que la anterior, no registra ningún cambio`, nombre);
      anterior = x;
    });
  }
  if (texto !== null && texto !== formato(candado)) {
    e("el texto no tiene el formato de JSON.stringify(…, null, 2) con salto final");
  }
  return errores;
}

/**
 * Compara contra el candado del punto de partida: lo sellado no cambia ni se va, y
 * las excepciones solo se agregan al final.
 */
export function erroresContraBase(base, actual) {
  const errores = [];
  if (!esObjeto(base) || !esObjeto(base.selladas)) return errores;
  const ahoraSelladas = esObjeto(actual?.selladas) ? actual.selladas : {};
  for (const [nombre, antes] of Object.entries(base.selladas)) {
    const ahora = ahoraSelladas[nombre];
    if (!esObjeto(ahora)) {
      errores.push({ tipo: "HISTORIA", nombre, mensaje: "estaba sellada en el punto de partida y ya no está en el candado" });
      continue;
    }
    if (!mismaIdentidad(antes, ahora)) {
      errores.push({
        tipo: "HISTORIA",
        nombre,
        mensaje: "cambió su identidad sellada: un cambio aceptado se registra con «excepcion», no reescribiendo el sello",
      });
    }
    const exAntes = Array.isArray(antes.excepciones) ? antes.excepciones : [];
    const exAhora = Array.isArray(ahora.excepciones) ? ahora.excepciones : [];
    if (exAntes.some((x, i) => !mismaExcepcion(x, exAhora[i]))) {
      errores.push({ tipo: "HISTORIA", nombre, mensaje: "se borró o se reescribió una excepción ya registrada: las excepciones solo se agregan" });
    }
  }
  return errores;
}

/**
 * La verificación, sin leer disco.
 * @param {object} p
 * @param {object} p.candado          el candado ya leído
 * @param {string|null} [p.texto]     su texto, para el formato; null no lo mira
 * @param {string[]} [p.esperas]      las claves de pendingBelowCutoff
 * @param {Map<string, Buffer>} p.archivos  nombre sin .sql → bytes del archivo
 * @param {object|null} [p.base]      el candado del punto de partida; null no compara
 */
export function verificar({ candado, texto = null, esperas = [], archivos, base = null }) {
  const errores = erroresDeFormato(candado, texto);
  const avisos = [];
  if (!esObjeto(candado) || !esObjeto(candado.selladas)) return { errores, avisos, selladas: 0, frontera: null };
  const selladas = candado.selladas;
  const nombres = Object.keys(selladas).filter((n) => NOMBRE_RE.test(n) && esObjeto(selladas[n]));
  const enEspera = new Set(esperas);
  for (const nombre of nombres) {
    const buf = archivos.get(nombre);
    if (!buf) {
      errores.push({ tipo: "FALTA", nombre, mensaje: `${MIGRACIONES}/${nombre}.sql no existe: una migración aplicada no se borra ni se renombra` });
      continue;
    }
    const vigente = identidadVigente(selladas[nombre]);
    const actual = identidad(buf);
    if (!mismaIdentidad(actual, vigente)) {
      errores.push({
        tipo: "CAMBIADA",
        nombre,
        mensaje: `el archivo cambió: sha256 ${corto(actual.sha256)} (${actual.bytes} bytes) y el candado espera ${corto(vigente.sha256)} (${vigente.bytes} bytes)`,
      });
    }
    if (enEspera.has(nombre)) {
      errores.push({ tipo: "ESPERA", nombre, mensaje: "está sellada y sigue en pendingBelowCutoff: o está aplicada o es una espera" });
    }
  }
  const frontera = nombres.length ? Math.max(...nombres.map(numero)) : null;
  for (const nombre of [...archivos.keys()].sort(comparar)) {
    if (Object.hasOwn(selladas, nombre)) continue;
    if (enEspera.has(nombre)) {
      avisos.push({ tipo: "ESPERA", nombre, mensaje: "espera declarada: se sella al aplicarla" });
    } else if (frontera !== null && numero(nombre) <= frontera) {
      errores.push({
        tipo: "SIN_SELLO",
        nombre,
        mensaje: `no está sellada ni es espera y su número no pasa de ${pad(frontera)}, la mayor sellada: el corte y la puerta de la publicación no la verían`,
      });
    } else {
      avisos.push({ tipo: "NUEVA", nombre, mensaje: "sin sellar: se sella al aplicarla (retirar-espera.mjs)" });
    }
  }
  if (base) errores.push(...erroresContraBase(base, candado));
  return { errores, avisos, selladas: nombres.length, frontera };
}

/** Un candado nuevo con las migraciones hasta `hasta`, menos las esperas. */
export function crearCandado({ archivos, esperas = [], hasta, doc = DOC }) {
  const enEspera = new Set(esperas);
  const selladas = {};
  for (const nombre of [...archivos.keys()].sort(comparar)) {
    if (!NOMBRE_RE.test(nombre) || numero(nombre) > hasta || enEspera.has(nombre)) continue;
    selladas[nombre] = identidad(archivos.get(nombre));
  }
  return { $doc: doc, schemaVersion: ESQUEMA, selladas };
}

/** El candado con una migración más sellada, en orden. No escribe. */
export function agregarSello(candado, nombre, ident) {
  if (Object.hasOwn(candado.selladas, nombre)) {
    throw new Rechazo(`${nombre} ya está sellada: una migración aplicada se sella una sola vez`, 3);
  }
  const entradas = [...Object.entries(candado.selladas), [nombre, { sha256: ident.sha256, md5: ident.md5, bytes: ident.bytes }]];
  return { ...candado, selladas: Object.fromEntries(entradas.sort(([a], [b]) => comparar(a, b))) };
}

/** El candado con una excepción más en la entrada `nombre`. No escribe. */
export function agregarExcepcion(candado, nombre, ident, { fecha, motivo, autorizacion }) {
  const entrada = candado.selladas[nombre];
  if (!esObjeto(entrada)) throw new Rechazo(`${nombre} no está sellada: no hay identidad que exceptuar`, 3);
  if (typeof fecha !== "string" || !FECHA_RE.test(fecha)) throw new Rechazo("uso: --fecha AAAA-MM-DD", 2);
  for (const [campo, valor] of [["motivo", motivo], ["autorizacion", autorizacion]]) {
    if (typeof valor !== "string" || valor.trim().length < TEXTO_MINIMO) {
      throw new Rechazo(`uso: --${campo} con al menos ${TEXTO_MINIMO} caracteres: la excepción tiene que explicarse sola`, 2);
    }
  }
  if (mismaIdentidad(identidadVigente(entrada), ident)) {
    throw new Rechazo(`${nombre} tiene la identidad que el candado espera: no hay cambio que registrar`, 3);
  }
  const excepcion = { fecha, motivo: motivo.trim(), autorizacion: autorizacion.trim(), sha256: ident.sha256, md5: ident.md5, bytes: ident.bytes };
  const nueva = { ...entrada, excepciones: [...(Array.isArray(entrada.excepciones) ? entrada.excepciones : []), excepcion] };
  return { ...candado, selladas: { ...candado.selladas, [nombre]: nueva } };
}

// ─── disco y git ─────────────────────────────────────────────────────────────

function leerJson(f, etiqueta) {
  let texto;
  try {
    texto = fs.readFileSync(f, "utf8");
  } catch (e) {
    throw new Rechazo(`${etiqueta}: ${e.code === "ENOENT" ? "no existe" : e.message}`, 2);
  }
  try {
    return { valor: JSON.parse(texto), texto };
  } catch (e) {
    throw new Rechazo(`${etiqueta}: JSON inválido (${e.message})`, 2);
  }
}

/** Los .sql de supabase/migrations: nombre sin .sql → bytes exactos. */
export function leerArchivos(raiz) {
  const dir = path.join(raiz, MIGRACIONES);
  const archivos = new Map();
  for (const f of fs.readdirSync(dir).sort(comparar)) {
    if (f.endsWith(".sql")) archivos.set(f.slice(0, -4), fs.readFileSync(path.join(dir, f)));
  }
  return archivos;
}

export function leerEsperas(raiz) {
  const { valor } = leerJson(path.join(raiz, BASELINE), BASELINE);
  return Object.keys(valor.pendingBelowCutoff ?? {});
}

/** El punto de partida: merge-base de HEAD con `contra`. null sin git o sin ese ref (CI superficial). */
export function refBase(raiz, contra = "origin/main") {
  try {
    const r = execFileSync("git", ["-C", raiz, "merge-base", "HEAD", contra], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return r.trim() || null;
  } catch {
    return null;
  }
}

/** El candado en un ref. null si git no lo encuentra (sin git, ref inexistente o el candado no estaba). */
export function candadoEnRef(raiz, ref) {
  let texto;
  try {
    texto = execFileSync("git", ["-C", raiz, "show", `${ref}:${CANDADO}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return null;
  }
  try {
    return JSON.parse(texto);
  } catch (e) {
    throw new Rechazo(`${CANDADO} en ${ref}: JSON inválido (${e.message})`, 2);
  }
}

/**
 * Verifica el checkout. `base`: "auto" (merge-base con origin/main), un ref, o null
 * para no comparar la historia.
 */
export function verificarRepo({ raiz = ".", base = "auto" } = {}) {
  const { valor: candado, texto } = leerJson(path.join(raiz, CANDADO), CANDADO);
  const ref = base === "auto" ? refBase(raiz) : base;
  const candadoBase = ref ? candadoEnRef(raiz, ref) : null;
  let historia;
  if (base === null) historia = "no comparada: --sin-base";
  else if (!ref) historia = "no comparada: sin git o sin origin/main (checkout superficial)";
  else if (!candadoBase) historia = `no comparada: ${ref.slice(0, 12)} no tiene ${CANDADO}`;
  else historia = `comparada contra ${ref.slice(0, 12)}`;
  const r = verificar({ candado, texto, esperas: leerEsperas(raiz), archivos: leerArchivos(raiz), base: candadoBase });
  return { ...r, historia, historiaComparada: Boolean(candadoBase) };
}

function leerCandadoParaEscribir(raiz) {
  const { valor, texto } = leerJson(path.join(raiz, CANDADO), CANDADO);
  const errores = erroresDeFormato(valor, texto);
  if (errores.length) throw new Rechazo(`${CANDADO} no pasa su propio formato (${errores[0].mensaje}): no lo reescribo`, 2);
  return valor;
}

function validarNombre(nombre) {
  if (typeof nombre !== "string" || !NOMBRE_RE.test(nombre)) {
    throw new Rechazo("uso: el nombre tiene que ser el exacto, sin .sql (NNNN_nombre)", 2);
  }
}

function leerMigracion(raiz, nombre) {
  const f = path.join(raiz, MIGRACIONES, `${nombre}.sql`);
  if (!fs.existsSync(f)) throw new Rechazo(`${MIGRACIONES}/${nombre}.sql no existe`, 2);
  return fs.readFileSync(f);
}

/**
 * Lee el candado y el archivo y devuelve el candado con el sello nuevo, sin escribir.
 * Exige que el md5 del archivo sea el aplicado. Lo usa también retirar-espera.mjs.
 */
export function prepararSello({ raiz = ".", nombre, md5 }) {
  validarNombre(nombre);
  const esperado = typeof md5 === "string" ? md5.toLowerCase() : "";
  if (!MD5_RE.test(esperado)) {
    throw new Rechazo("uso: falta --md5 con el md5 aplicado (32 hex): el blob_md5 de IDENTIDAD.txt en la evidencia del apply, que la verificación comparó con el ledger", 2);
  }
  const candado = leerCandadoParaEscribir(raiz);
  const ident = identidad(leerMigracion(raiz, nombre));
  if (ident.md5 !== esperado) {
    throw new Rechazo(
      `el md5 del archivo (${ident.md5}) no es el aplicado (${esperado}): o el archivo cambió después del apply o el md5 es de otra migración. No sello`,
      3,
    );
  }
  return { nuevo: agregarSello(candado, nombre, ident), ident };
}

export function sellar({ raiz = ".", nombre, md5, enSeco = false }) {
  validarNombre(nombre);
  if (leerEsperas(raiz).includes(nombre)) {
    throw new Rechazo(`${nombre} sigue en pendingBelowCutoff: retírala con infra/ops/migraciones/retirar-espera.mjs, que también la sella`, 3);
  }
  const { nuevo, ident } = prepararSello({ raiz, nombre, md5 });
  if (!enSeco) fs.writeFileSync(path.join(raiz, CANDADO), formato(nuevo));
  return { nombre, enSeco, ...ident };
}

export function exceptuar({ raiz = ".", nombre, motivo, autorizacion, fecha = hoy(), enSeco = false }) {
  validarNombre(nombre);
  const candado = leerCandadoParaEscribir(raiz);
  const ident = identidad(leerMigracion(raiz, nombre));
  const nuevo = agregarExcepcion(candado, nombre, ident, { fecha, motivo, autorizacion });
  if (!enSeco) fs.writeFileSync(path.join(raiz, CANDADO), formato(nuevo));
  return { nombre, enSeco, anterior: identidadVigente(candado.selladas[nombre]), nueva: ident };
}

export function crear({ raiz = ".", hasta, enSeco = false }) {
  if (!Number.isSafeInteger(hasta) || hasta < 1) throw new Rechazo("uso: --hasta NNNN", 2);
  const f = path.join(raiz, CANDADO);
  if (fs.existsSync(f)) {
    throw new Rechazo(`${CANDADO} ya existe: se crea una sola vez. Una migración aplicada se sella con «sellar»; un cambio aceptado, con «excepcion»`, 3);
  }
  const esperas = leerEsperas(raiz);
  const archivos = leerArchivos(raiz);
  const nuevo = crearCandado({ archivos, esperas, hasta });
  if (!enSeco) fs.writeFileSync(f, formato(nuevo));
  return {
    enSeco,
    hasta: pad(hasta),
    selladas: Object.keys(nuevo.selladas).length,
    esperasSinSellar: esperas.filter((n) => archivos.has(n) && numero(n) <= hasta),
  };
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

function imprimirVerificacion(r) {
  const esperas = r.avisos.filter((a) => a.tipo === "ESPERA").map((a) => a.nombre);
  const nuevas = r.avisos.filter((a) => a.tipo === "NUEVA").map((a) => a.nombre);
  console.log(
    `migrations-lock: ${r.selladas} selladas (la mayor: ${r.frontera === null ? "ninguna" : pad(r.frontera)}) · ` +
      `${esperas.length} espera(s) sin sellar${esperas.length ? ` (${esperas.join(", ")})` : ""} · ` +
      `${nuevas.length} nueva(s) sin sellar${nuevas.length ? ` (${nuevas.join(", ")})` : ""} · historia ${r.historia}`,
  );
  for (const e of r.errores) console.log(`[FALLÓ] ${e.tipo}${e.nombre ? ` ${e.nombre}` : ""}: ${e.mensaje}`);
  if (r.errores.length) {
    console.log(
      "Una migración aplicada no se edita, no se borra ni se renombra (docs/runbooks/aplicar-migraciones-prod.md §8). " +
        "Si cambiaste el archivo por error, devuélvelo a su contenido (git checkout <base> -- <archivo>). " +
        "Si el cambio está aceptado por quien corresponde: node scripts/migrations-lock.mjs excepcion <nombre> --motivo \"…\" --autorizacion \"…\".",
    );
  }
}

function principal(args) {
  const comandos = new Set(["verificar", "sellar", "excepcion", "crear"]);
  const comando = comandos.has(args[0]) ? args.shift() : "verificar";
  const o = { raiz: ".", enSeco: false, base: "auto" };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const valor = () => {
      if (i + 1 >= args.length) throw new Rechazo(`uso: ${a} necesita un valor`, 2);
      return args[++i];
    };
    if (a === "--raiz") o.raiz = valor();
    else if (a === "--en-seco") o.enSeco = true;
    else if (a === "--base") o.base = valor();
    else if (a === "--sin-base") o.base = null;
    else if (a === "--md5") o.md5 = valor();
    else if (a === "--motivo") o.motivo = valor();
    else if (a === "--autorizacion") o.autorizacion = valor();
    else if (a === "--fecha") o.fecha = valor();
    else if (a === "--hasta") o.hasta = Number.parseInt(valor(), 10);
    else if (!a.startsWith("--") && o.nombre === undefined) o.nombre = a.replace(/\.sql$/, "");
    else throw new Rechazo(`uso: argumento desconocido ${a}`, 2);
  }
  if (comando === "verificar") {
    const r = verificarRepo({ raiz: o.raiz, base: o.base });
    imprimirVerificacion(r);
    return r.errores.length ? 1 : 0;
  }
  let r;
  if (comando === "sellar") r = sellar(o);
  else if (comando === "excepcion") r = exceptuar({ ...o, fecha: o.fecha ?? hoy() });
  else r = crear(o);
  console.log(JSON.stringify(r, null, 1));
  return 0;
}

function esPrincipal() {
  try {
    return Boolean(process.argv[1]) && fs.realpathSync.native(path.resolve(process.argv[1])) === fs.realpathSync.native(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (esPrincipal()) {
  try {
    process.exitCode = principal(process.argv.slice(2));
  } catch (e) {
    if (e instanceof Rechazo) {
      console.error(`migrations-lock: ${e.message}`);
      process.exitCode = e.codigo;
    } else {
      throw e;
    }
  }
}
