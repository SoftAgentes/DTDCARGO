/**
 * SDD-0561 · el candado de las migraciones aplicadas (scripts/migrations-lock.mjs).
 *
 * - El repo real: cada migración sellada en supabase/migrations.lock.json conserva
 *   su identidad, ninguna se borró ni se renombró, y el conjunto sellado al crearlo
 *   sigue intacto (ancla de abajo, que no necesita git: el CI hace un checkout
 *   superficial y no tiene origin/main).
 * - El control rojo en memoria sobre el repo real: un byte cambiado, un archivo
 *   borrado y uno renombrado.
 * - Cada regla sobre copias temporales: FORMATO, FALTA, CAMBIADA, ESPERA,
 *   SIN_SELLO y HISTORIA; sellar, excepcion y crear; los códigos de la CLI.
 *
 * Nada de esto toca una base ni edita una migración del repo.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as L from "../migrations-lock.mjs";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SCRIPT = path.join(RAIZ, "scripts", "migrations-lock.mjs");

/**
 * ANCLA DE CREACIÓN (2026-10-19, origin/main 3f3a52cc): las 483 migraciones hasta la
 * 0491, sin las esperas 0422 y 0423. El digest es el sha256 de las líneas
 * «nombre sha256 md5 bytes\n» de sus identidades selladas, en orden. Si alguien
 * borra una entrada o reescribe un sello de este conjunto, cambia. Las excepciones no
 * lo tocan (no cambian la identidad sellada) y los sellos nuevos tampoco (quedan
 * fuera del conjunto). NO se actualiza para conseguir verde: un cambio aceptado va
 * como excepción en el candado (SDD-0561).
 */
const ANCLA = {
  hasta: 491,
  esperasFuera: ["0422_payment_report_command_boundary", "0423_payment_report_historical_identity"],
  selladas: 483,
  digest: "10d5eb209ba9b9441c589200c0d425fec9bca99bf3fc88b16045640bdd12545e",
};

function digestDeCreacion(candado) {
  const fuera = new Set(ANCLA.esperasFuera);
  const nombres = Object.keys(candado.selladas)
    .filter((n) => L.numero(n) <= ANCLA.hasta && !fuera.has(n))
    .sort();
  const texto = nombres.map((n) => {
    const e = candado.selladas[n];
    return `${n} ${e.sha256} ${e.md5} ${e.bytes}\n`;
  }).join("");
  return { selladas: nombres.length, digest: crypto.createHash("sha256").update(texto).digest("hex") };
}

const tipos = (r) => r.errores.map((e) => `${e.tipo}${e.nombre ? ` ${e.nombre}` : ""}`).sort();
const md5 = (s) => crypto.createHash("md5").update(s).digest("hex");

// ─── Fixture: cinco migraciones inventadas ───────────────────────────────────
const M = {
  "0100_dos_mismo_numero": "create table dos ();\n",
  "0100_uno": "create table uno ();\n",
  "0101b_letra": "select 1;\r\n", // CRLF terminal, como las que reparan el ledger
  "0102_espera": "select 2;\n",
  "0103_ultima": "select 3;\n",
};

function armar({ archivos = M, esperas = ["0102_espera"], hasta = 103, conCandado = true } = {}) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "sdd0561-"));
  fs.mkdirSync(path.join(d, "supabase", "migrations"), { recursive: true });
  for (const [n, t] of Object.entries(archivos)) fs.writeFileSync(path.join(d, "supabase", "migrations", `${n}.sql`), t);
  const baseline = { $doc: ["x"], cutoff: 238, pendingBelowCutoff: Object.fromEntries(esperas.map((n) => [n, "espera"])) };
  fs.writeFileSync(path.join(d, L.BASELINE), JSON.stringify(baseline, null, 2) + "\n");
  if (conCandado) L.crear({ raiz: d, hasta });
  return d;
}
const borrar = (d) => fs.rmSync(d, { recursive: true, force: true });
const mig = (d, n) => path.join(d, "supabase", "migrations", `${n}.sql`);
const leerCandado = (d) => JSON.parse(fs.readFileSync(path.join(d, L.CANDADO), "utf8"));
const textoCandado = (d) => fs.readFileSync(path.join(d, L.CANDADO), "utf8");
const escribirCandado = (d, o, texto = L.formato(o)) => fs.writeFileSync(path.join(d, L.CANDADO), texto);
const verif = (d, base = null) => L.verificarRepo({ raiz: d, base });
const cli = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8" });

// ─── El repo real ────────────────────────────────────────────────────────────

test("repo real: cada migración sellada conserva su identidad y ninguna falta", (t) => {
  const r = L.verificarRepo({ raiz: RAIZ });
  t.diagnostic(`${r.selladas} selladas, la mayor ${r.frontera}; historia ${r.historia}`);
  assert.deepEqual(r.errores, [], r.errores.map((e) => `${e.tipo} ${e.nombre ?? ""}: ${e.mensaje}`).join("\n"));
  assert.ok(r.selladas >= ANCLA.selladas, `el candado tiene ${r.selladas} selladas y al crearlo tenía ${ANCLA.selladas}`);
});

test("repo real: el conjunto sellado al crear el candado sigue intacto (ancla sin git)", () => {
  const candado = JSON.parse(fs.readFileSync(path.join(RAIZ, L.CANDADO), "utf8"));
  assert.deepEqual(digestDeCreacion(candado), { selladas: ANCLA.selladas, digest: ANCLA.digest });
});

test("repo real: las esperas no están selladas y todo lo demás hasta la mayor sellada sí", () => {
  const candado = JSON.parse(fs.readFileSync(path.join(RAIZ, L.CANDADO), "utf8"));
  const esperas = L.leerEsperas(RAIZ);
  const archivos = L.leerArchivos(RAIZ);
  const frontera = Math.max(...Object.keys(candado.selladas).map(L.numero));
  for (const n of esperas) assert.ok(!Object.hasOwn(candado.selladas, n), `${n} es espera y está sellada`);
  const sinSello = [...archivos.keys()].filter((n) => L.numero(n) <= frontera && !Object.hasOwn(candado.selladas, n) && !esperas.includes(n));
  assert.deepEqual(sinSello, []);
});

test("control rojo en memoria sobre el repo real: un byte, un borrado y un renombre", () => {
  const texto = fs.readFileSync(path.join(RAIZ, L.CANDADO), "utf8");
  const candado = JSON.parse(texto);
  const esperas = L.leerEsperas(RAIZ);
  const archivos = L.leerArchivos(RAIZ);
  const nombre = Object.keys(candado.selladas).find((n) => n.startsWith("0467_"));
  assert.ok(nombre, "la 0467 tiene que estar sellada");
  assert.deepEqual(L.verificar({ candado, texto, esperas, archivos }).errores, []);

  const unByte = new Map(archivos);
  const buf = Buffer.from(archivos.get(nombre));
  buf[buf.length - 2] ^= 0x01;
  unByte.set(nombre, buf);
  assert.deepEqual(tipos(L.verificar({ candado, texto, esperas, archivos: unByte })), [`CAMBIADA ${nombre}`]);

  const sinArchivo = new Map(archivos);
  sinArchivo.delete(nombre);
  assert.deepEqual(tipos(L.verificar({ candado, texto, esperas, archivos: sinArchivo })), [`FALTA ${nombre}`]);

  const renombrado = new Map(sinArchivo);
  const otro = `${nombre}_v2`;
  renombrado.set(otro, archivos.get(nombre));
  assert.deepEqual(tipos(L.verificar({ candado, texto, esperas, archivos: renombrado })), [`FALTA ${nombre}`, `SIN_SELLO ${otro}`].sort());
});

// ─── Las reglas, sobre copias ────────────────────────────────────────────────

test("crear sella hasta el número pedido, sin las esperas, en orden y con el formato exacto", () => {
  const d = armar({ hasta: 101 });
  try {
    const c = leerCandado(d);
    assert.deepEqual(Object.keys(c.selladas), ["0100_dos_mismo_numero", "0100_uno", "0101b_letra"]);
    const crlf = Buffer.from(M["0101b_letra"]);
    assert.deepEqual(c.selladas["0101b_letra"], L.identidad(crlf));
    assert.equal(c.selladas["0101b_letra"].bytes, 11);
    assert.equal(textoCandado(d), L.formato(c));
    const r = verif(d);
    assert.deepEqual(r.errores, []);
    assert.deepEqual(r.avisos.map((a) => `${a.tipo} ${a.nombre}`), ["ESPERA 0102_espera", "NUEVA 0103_ultima"]);
    assert.equal(r.frontera, 101);
  } finally {
    borrar(d);
  }
});

test("crear se niega si el candado ya existe (3) o sin --hasta (2)", () => {
  const d = armar();
  try {
    const antes = textoCandado(d);
    assert.throws(() => L.crear({ raiz: d, hasta: 103 }), { codigo: 3 });
    assert.equal(textoCandado(d), antes);
  } finally {
    borrar(d);
  }
  const e = armar({ conCandado: false });
  try {
    assert.throws(() => L.crear({ raiz: e, hasta: undefined }), { codigo: 2 });
    assert.equal(L.crear({ raiz: e, hasta: 103, enSeco: true }).selladas, 4);
    assert.ok(!fs.existsSync(path.join(e, L.CANDADO)), "en seco no escribe");
  } finally {
    borrar(e);
  }
});

test("CAMBIADA: un byte de una migración sellada; también un salto de línea CRLF→LF", () => {
  const d = armar();
  try {
    assert.deepEqual(verif(d).errores, []);
    fs.writeFileSync(mig(d, "0100_uno"), "create table uno ( );\n");
    fs.writeFileSync(mig(d, "0101b_letra"), "select 1;\n");
    assert.deepEqual(tipos(verif(d)), ["CAMBIADA 0100_uno", "CAMBIADA 0101b_letra"]);
  } finally {
    borrar(d);
  }
});

test("FALTA: borrar una sellada; renombrarla da FALTA y SIN_SELLO", () => {
  const d = armar();
  try {
    fs.rmSync(mig(d, "0100_uno"));
    assert.deepEqual(tipos(verif(d)), ["FALTA 0100_uno"]);
    fs.writeFileSync(mig(d, "0100_uno_renombrada"), M["0100_uno"]);
    assert.deepEqual(tipos(verif(d)), ["FALTA 0100_uno", "SIN_SELLO 0100_uno_renombrada"]);
  } finally {
    borrar(d);
  }
});

test("SIN_SELLO: una nueva con número viejo o igual a la mayor sellada; una mayor es solo aviso", () => {
  const d = armar();
  try {
    fs.writeFileSync(mig(d, "0050_colada_en_el_pasado"), "select 50;\n");
    fs.writeFileSync(mig(d, "0103b_colada_en_la_frontera"), "select 103;\n");
    fs.writeFileSync(mig(d, "0104_nueva"), "select 104;\n");
    fs.writeFileSync(path.join(d, "supabase", "migrations", "LEEME.txt"), "no es una migración\n");
    const r = verif(d);
    assert.deepEqual(tipos(r), ["SIN_SELLO 0050_colada_en_el_pasado", "SIN_SELLO 0103b_colada_en_la_frontera"]);
    assert.deepEqual(r.avisos.map((a) => `${a.tipo} ${a.nombre}`), ["ESPERA 0102_espera", "NUEVA 0104_nueva"]);
  } finally {
    borrar(d);
  }
});

test("ESPERA: una sellada que vuelve a pendingBelowCutoff", () => {
  const d = armar();
  try {
    const b = JSON.parse(fs.readFileSync(path.join(d, L.BASELINE), "utf8"));
    b.pendingBelowCutoff["0103_ultima"] = "otra vez espera";
    fs.writeFileSync(path.join(d, L.BASELINE), JSON.stringify(b, null, 2) + "\n");
    assert.deepEqual(tipos(verif(d)), ["ESPERA 0103_ultima"]);
  } finally {
    borrar(d);
  }
});

test("FORMATO: orden, texto canónico, campos y claves desconocidas", () => {
  const d = armar();
  try {
    const c = leerCandado(d);
    const desordenado = { ...c, selladas: Object.fromEntries(Object.entries(c.selladas).reverse()) };
    escribirCandado(d, desordenado);
    assert.deepEqual(tipos(verif(d)), ["FORMATO"]);

    escribirCandado(d, c, JSON.stringify(c) + "\n");
    assert.deepEqual(tipos(verif(d)), ["FORMATO"]);

    const malo = structuredClone(c);
    malo.selladas["0100_uno"].sha256 = "ABC";
    malo.selladas["0100_uno"].md5 = 5;
    malo.selladas["0100_uno"].bytes = -1;
    malo.selladas["0100_uno"].nota = "x";
    malo.extra = true;
    malo.schemaVersion = 2;
    escribirCandado(d, malo);
    const r = verif(d);
    assert.equal(r.errores.filter((e) => e.tipo === "FORMATO").length, 6, JSON.stringify(r.errores, null, 1));
    assert.ok(r.errores.some((e) => e.tipo === "CAMBIADA" && e.nombre === "0100_uno"));

    escribirCandado(d, { schemaVersion: 1 });
    assert.deepEqual(tipos(verif(d)), ["FORMATO"]);

    const nombreMalo = structuredClone(c);
    nombreMalo.selladas = { "0100_uno.sql": c.selladas["0100_uno"], ...c.selladas };
    escribirCandado(d, nombreMalo);
    assert.deepEqual(tipos(verif(d)), ["FORMATO", "FORMATO 0100_uno.sql"]);

    const noObjeto = structuredClone(c);
    noObjeto.selladas["0100_uno"] = c.selladas["0100_uno"].sha256;
    escribirCandado(d, noObjeto);
    assert.deepEqual(tipos(verif(d)), ["FORMATO 0100_uno"]);
  } finally {
    borrar(d);
  }
});

test("excepcion: registra el cambio aceptado sin tocar el sello; las excepciones se encadenan", () => {
  const d = armar();
  try {
    const antes = leerCandado(d).selladas["0100_uno"];
    fs.writeFileSync(mig(d, "0100_uno"), "-- comentario corregido\ncreate table uno ();\n");
    assert.deepEqual(tipos(verif(d)), ["CAMBIADA 0100_uno"]);
    const r = L.exceptuar({ raiz: d, nombre: "0100_uno", motivo: "comentario engañoso corregido", autorizacion: "Sam, 2026-10-19, en la PR de prueba", fecha: "2026-10-19" });
    assert.deepEqual(r.anterior, antes);
    const e = leerCandado(d).selladas["0100_uno"];
    assert.deepEqual({ sha256: e.sha256, md5: e.md5, bytes: e.bytes }, antes, "la identidad sellada no cambia");
    assert.equal(e.excepciones.length, 1);
    assert.deepEqual(Object.keys(e.excepciones[0]), ["fecha", "motivo", "autorizacion", "sha256", "md5", "bytes"]);
    assert.deepEqual(verif(d).errores, []);
    assert.equal(textoCandado(d), L.formato(leerCandado(d)));

    fs.writeFileSync(mig(d, "0100_uno"), "-- otra vez\ncreate table uno ();\n");
    assert.deepEqual(tipos(verif(d)), ["CAMBIADA 0100_uno"]);
    L.exceptuar({ raiz: d, nombre: "0100_uno", motivo: "segunda corrección aceptada", autorizacion: "Director, revisión de la PR", fecha: "2026-10-20" });
    assert.equal(leerCandado(d).selladas["0100_uno"].excepciones.length, 2);
    assert.deepEqual(verif(d).errores, []);

    fs.writeFileSync(mig(d, "0100_uno"), M["0100_uno"]);
    assert.deepEqual(tipos(verif(d)), ["CAMBIADA 0100_uno"], "volver al original también es un cambio: lo vigente es la última excepción");
  } finally {
    borrar(d);
  }
});

test("excepcion se niega sin cambio (3), sin sello (3), sin archivo (2) o sin motivo y autorización (2)", () => {
  const d = armar();
  try {
    const antes = textoCandado(d);
    const ok = { motivo: "motivo suficiente", autorizacion: "autorización suficiente", fecha: "2026-10-19" };
    assert.throws(() => L.exceptuar({ raiz: d, nombre: "0100_uno", ...ok }), { codigo: 3 });
    assert.throws(() => L.exceptuar({ raiz: d, nombre: "0102_espera", ...ok }), { codigo: 3 });
    fs.writeFileSync(mig(d, "0100_uno"), "cambio\n");
    assert.throws(() => L.exceptuar({ raiz: d, nombre: "0100_uno", ...ok, motivo: "corto" }), { codigo: 2 });
    assert.throws(() => L.exceptuar({ raiz: d, nombre: "0100_uno", ...ok, autorizacion: "   " }), { codigo: 2 });
    assert.throws(() => L.exceptuar({ raiz: d, nombre: "0100_uno", ...ok, fecha: "19/10/2026" }), { codigo: 2 });
    fs.rmSync(mig(d, "0100_uno"));
    assert.throws(() => L.exceptuar({ raiz: d, nombre: "0100_uno", ...ok }), { codigo: 2 });
    assert.equal(textoCandado(d), antes);
  } finally {
    borrar(d);
  }
});

test("FORMATO de una excepción: campos cortos y una que no cambia la identidad", () => {
  const d = armar();
  try {
    const c = leerCandado(d);
    const id = c.selladas["0100_uno"];
    c.selladas["0100_uno"] = { ...id, excepciones: [{ fecha: "ayer", motivo: "x", autorizacion: "", sha256: id.sha256, md5: id.md5, bytes: id.bytes, otra: 1 }] };
    escribirCandado(d, c);
    const r = verif(d);
    assert.equal(r.errores.filter((e) => e.tipo === "FORMATO" && e.nombre === "0100_uno").length, 5, JSON.stringify(r.errores, null, 1));
    c.selladas["0100_uno"] = { ...id, excepciones: [] };
    escribirCandado(d, c);
    assert.deepEqual(tipos(verif(d)), ["FORMATO 0100_uno"]);
  } finally {
    borrar(d);
  }
});

test("sellar: agrega en orden con el md5 aplicado; se niega con espera, md5 distinto, ya sellada o sin md5", () => {
  const d = armar();
  try {
    const antes = textoCandado(d);
    assert.throws(() => L.sellar({ raiz: d, nombre: "0102_espera", md5: md5(M["0102_espera"]) }), { codigo: 3 });
    const b = JSON.parse(fs.readFileSync(path.join(d, L.BASELINE), "utf8"));
    b.pendingBelowCutoff = {};
    fs.writeFileSync(path.join(d, L.BASELINE), JSON.stringify(b, null, 2) + "\n");
    assert.throws(() => L.sellar({ raiz: d, nombre: "0102_espera", md5: md5("otro texto") }), { codigo: 3 });
    assert.throws(() => L.sellar({ raiz: d, nombre: "0102_espera" }), { codigo: 2 });
    assert.throws(() => L.sellar({ raiz: d, nombre: "0100_uno", md5: md5(M["0100_uno"]) }), { codigo: 3 });
    assert.throws(() => L.sellar({ raiz: d, nombre: "0102_espera.sql", md5: md5(M["0102_espera"]) }), { codigo: 2 });
    assert.equal(textoCandado(d), antes, "un rechazo no escribe");
    assert.equal(L.sellar({ raiz: d, nombre: "0102_espera", md5: md5(M["0102_espera"]).toUpperCase(), enSeco: true }).enSeco, true);
    assert.equal(textoCandado(d), antes, "en seco no escribe");

    L.sellar({ raiz: d, nombre: "0102_espera", md5: md5(M["0102_espera"]) });
    const c = leerCandado(d);
    assert.deepEqual(Object.keys(c.selladas), ["0100_dos_mismo_numero", "0100_uno", "0101b_letra", "0102_espera", "0103_ultima"]);
    assert.equal(textoCandado(d), L.formato(c));
    assert.deepEqual(verif(d).errores, []);
  } finally {
    borrar(d);
  }
});

test("un candado con otro formato no se reescribe (un diff de todo el archivo esconde el cambio)", () => {
  const d = armar();
  try {
    fs.writeFileSync(mig(d, "0104_nueva"), "select 104;\n");
    const c = leerCandado(d);
    escribirCandado(d, c, JSON.stringify(c) + "\n");
    assert.throws(() => L.sellar({ raiz: d, nombre: "0104_nueva", md5: md5("select 104;\n") }), { codigo: 2 });
  } finally {
    borrar(d);
  }
});

test("HISTORIA: contra el candado del punto de partida en git", () => {
  const d = armar();
  const git = (...a) => {
    const r = spawnSync("git", ["-C", d, "-c", "core.autocrlf=false", "-c", "user.email=prueba@example.invalid", "-c", "user.name=prueba", ...a], { encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout.trim();
  };
  try {
    git("init", "-q");
    git("add", "-A");
    git("commit", "-q", "-m", "base");
    const base = git("rev-parse", "HEAD");
    const r0 = verif(d, base);
    assert.deepEqual(r0.errores, []);
    assert.equal(r0.historiaComparada, true);

    // Un sello reescrito junto con el archivo: el archivo «cuadra», la historia no.
    fs.writeFileSync(mig(d, "0100_uno"), "editada\n");
    const c = leerCandado(d);
    c.selladas["0100_uno"] = L.identidad(Buffer.from("editada\n"));
    escribirCandado(d, c);
    assert.deepEqual(tipos(verif(d)), [], "sin base no se ve");
    assert.deepEqual(tipos(verif(d, base)), ["HISTORIA 0100_uno"]);

    // Una entrada borrada junto con su archivo.
    git("checkout", "-q", "--", ".");
    fs.rmSync(mig(d, "0100_uno"));
    const sin = leerCandado(d);
    delete sin.selladas["0100_uno"];
    escribirCandado(d, sin);
    assert.deepEqual(tipos(verif(d, base)), ["HISTORIA 0100_uno"]);

    // Una excepción agregada pasa; borrarla después, no.
    git("checkout", "-q", "--", ".");
    fs.writeFileSync(mig(d, "0103_ultima"), "select 33;\n");
    L.exceptuar({ raiz: d, nombre: "0103_ultima", motivo: "cambio aceptado de prueba", autorizacion: "prueba automatizada", fecha: "2026-10-19" });
    assert.deepEqual(verif(d, base).errores, []);
    git("add", "-A");
    git("commit", "-q", "-m", "excepcion");
    const conExcepcion = git("rev-parse", "HEAD");
    const reescrita = leerCandado(d);
    reescrita.selladas["0103_ultima"].excepciones[0].motivo = "otro motivo cualquiera";
    escribirCandado(d, reescrita);
    assert.deepEqual(tipos(verif(d, conExcepcion)), ["HISTORIA 0103_ultima"]);
    const borrada = leerCandado(d);
    delete borrada.selladas["0103_ultima"].excepciones;
    escribirCandado(d, borrada);
    fs.writeFileSync(mig(d, "0103_ultima"), M["0103_ultima"]);
    assert.deepEqual(tipos(verif(d, conExcepcion)), ["HISTORIA 0103_ultima"]);

    // Un sello nuevo no es historia rota.
    git("checkout", "-q", "--", ".");
    fs.writeFileSync(mig(d, "0104_nueva"), "select 104;\n");
    L.sellar({ raiz: d, nombre: "0104_nueva", md5: md5("select 104;\n") });
    assert.deepEqual(verif(d, conExcepcion).errores, []);
    assert.equal(L.candadoEnRef(d, "no-existe"), null);

    // «auto»: sin origin/main no compara y lo dice; con origin/main usa el merge-base.
    const sinOrigen = L.verificarRepo({ raiz: d });
    assert.equal(sinOrigen.historiaComparada, false);
    assert.match(sinOrigen.historia, /no comparada/);
    git("update-ref", "refs/remotes/origin/main", conExcepcion);
    const conOrigen = L.verificarRepo({ raiz: d });
    assert.equal(conOrigen.historiaComparada, true);
    assert.deepEqual(conOrigen.errores, []);
    const pisado = leerCandado(d);
    pisado.selladas["0100_uno"].md5 = "0".repeat(32);
    escribirCandado(d, pisado);
    assert.deepEqual(tipos(L.verificarRepo({ raiz: d })), ["CAMBIADA 0100_uno", "HISTORIA 0100_uno"]);
  } finally {
    borrar(d);
  }
});

test("CLI: 0 en verde, 1 con un byte cambiado (y nombra el archivo), 2 sin candado, 3 al crear de nuevo", () => {
  const d = armar();
  try {
    const verde = cli("verificar", "--raiz", d, "--sin-base");
    assert.equal(verde.status, 0, verde.stdout + verde.stderr);
    assert.match(verde.stdout, /4 selladas \(la mayor: 0103\)/);
    fs.writeFileSync(mig(d, "0103_ultima"), "select 4;\n");
    const rojo = cli("--raiz", d, "--sin-base");
    assert.equal(rojo.status, 1);
    assert.match(rojo.stdout, /\[FALLÓ\] CAMBIADA 0103_ultima/);
    assert.match(rojo.stdout, /excepcion <nombre>/);
    assert.equal(cli("crear", "--hasta", "103", "--raiz", d).status, 3);
    assert.equal(cli("verificar", "--raiz", d, "--desconocido").status, 2);
    fs.rmSync(path.join(d, L.CANDADO));
    assert.equal(cli("verificar", "--raiz", d, "--sin-base").status, 2);
  } finally {
    borrar(d);
  }
});
