// @vitest-environment node
/**
 * SDD-0626 §3.0 · Paso 0 del cable: infra/ops/cable-oficina/prueba-paso0.mjs.
 *
 * El script corre de verdad, como proceso hijo, contra un runtime de mentira en
 * 127.0.0.1 que imita al API server de Hermes (GET /v1/models: 200 con la llave
 * correcta y la lista de perfiles, 401 sin llave). Cada mutante reproduce una
 * falla que la prueba real tiene que cazar: el runtime acepta sin llave, falta el
 * perfil, responde 500, tarda más que el tope, no hay nada escuchando (túnel caído)
 * o el túnel acepta y corta. En ningún caso la salida puede traer la llave.
 */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createServer as createTcpServer } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const SCRIPT = resolve(ROOT, "infra/ops/cable-oficina/prueba-paso0.mjs");
const LLAVE = "llave-de-mentira-7f3a9c2e5b81d4f6";

const abiertos = [];
afterEach(async () => {
  await Promise.all(abiertos.splice(0).map((s) => new Promise((r) => s.close(() => r()))));
});

function escuchar(servidor) {
  abiertos.push(servidor);
  return new Promise((r) => servidor.listen(0, "127.0.0.1", () => r(servidor.address().port)));
}

/** Runtime de mentira. `modo` elige el mutante. */
function runtime(modo = "sano") {
  return createServer((req, res) => {
    const conLlave = req.headers.authorization === `Bearer ${LLAVE}`;
    if (req.url !== "/v1/models") {
      res.writeHead(404).end();
      return;
    }
    if (modo === "lento") {
      setTimeout(() => res.writeHead(200, { "content-type": "application/json" }).end("{}"), 2_000).unref();
      return;
    }
    if (modo === "error") {
      res.writeHead(500).end("boom");
      return;
    }
    if (!conLlave && modo !== "sin-auth") {
      res.writeHead(401, { "content-type": "application/json" }).end('{"error":"unauthorized"}');
      return;
    }
    if (modo === "no-json") {
      res.writeHead(200, { "content-type": "text/html" }).end("<html>soporte-chatwoot</html>");
      return;
    }
    const ids = modo === "sin-perfil" ? ["otro-agente"] : ["soporte-chatwoot"];
    // El runtime de mentira devuelve la llave en el cuerpo: la prueba nunca debe mostrarla.
    const cuerpo = { object: "list", data: ids.map((id) => ({ id, object: "model", eco: req.headers.authorization })) };
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(cuerpo));
  });
}

function correr(env) {
  const base = { ...process.env };
  for (const k of Object.keys(base)) if (/^(OFICINA_RUNTIME_|CABLE_PRUEBA_)/.test(k)) delete base[k];
  return new Promise((r) => {
    const hijo = spawn(process.execPath, [SCRIPT], { env: { ...base, ...env }, stdio: ["ignore", "pipe", "pipe"] });
    let salida = "";
    hijo.stdout.on("data", (d) => (salida += d));
    hijo.stderr.on("data", (d) => (salida += d));
    hijo.on("close", (codigo) => r({ codigo, salida }));
  });
}

async function contra(modo, extra = {}) {
  const puerto = await escuchar(runtime(modo));
  return correr({ OFICINA_RUNTIME_URL: `http://127.0.0.1:${puerto}`, OFICINA_RUNTIME_TOKEN: LLAVE, ...extra });
}

function sinFuga({ salida }) {
  expect(salida).not.toContain(LLAVE);
  expect(salida).not.toMatch(/Bearer\s+\S/);
}

describe("SDD-0626 · prueba del Paso 0 del cable", () => {
  it("runtime sano: 3 llamadas con llave dan 200 con el perfil, la de sin llave 401, y sale 0", async () => {
    const r = await contra("sano");
    expect(r.codigo).toBe(0);
    expect(r.salida.match(/^\[\d\/3\] GET \/v1\/models con llave → 200 · \d+ ms · soporte-chatwoot presente · PASA$/gm)).toHaveLength(3);
    expect(r.salida).toMatch(/^\[sin llave\] GET \/v1\/models sin llave → 401 · \d+ ms · rechazada · PASA$/m);
    expect(r.salida).toMatch(/^RESULTADO: PASA \(4 de 4\)$/m);
    expect(r.salida).toMatch(/^Llave: presente \(no se muestra\)$/m);
    expect(r.salida).toMatch(/^Contexto: uid=-?\d+ usuario=.+ · host=.+ · node v\d+/m);
    sinFuga(r);
  });

  it("mutante: el runtime acepta sin llave → FALLA y sale 1", async () => {
    const r = await contra("sin-auth");
    expect(r.codigo).toBe(1);
    expect(r.salida).toMatch(/^\[sin llave\] .* → 200 · \d+ ms · se esperaba 401 · FALLA$/m);
    expect(r.salida).toMatch(/^RESULTADO: FALLA \(3 de 4\)$/m);
    sinFuga(r);
  });

  it("mutante: el perfil no está en la lista → FALLA", async () => {
    const r = await contra("sin-perfil");
    expect(r.codigo).toBe(1);
    expect(r.salida).toMatch(/soporte-chatwoot NO está en la lista \(1 perfiles\) · FALLA/);
    expect(r.salida).toMatch(/^RESULTADO: FALLA \(1 de 4\)$/m);
    sinFuga(r);
  });

  it("mutante: el nombre del perfil aparece en un cuerpo que no es la lista JSON → FALLA", async () => {
    const r = await contra("no-json");
    expect(r.codigo).toBe(1);
    expect(r.salida).toMatch(/la respuesta no es una lista de modelos en JSON · FALLA/);
    sinFuga(r);
  });

  it("mutante: el runtime responde 500 → FALLA y no se confunde con túnel caído", async () => {
    const r = await contra("error");
    expect(r.codigo).toBe(1);
    expect(r.salida).toMatch(/→ 500 · \d+ ms · se esperaba 200 · FALLA/);
    expect(r.salida).not.toMatch(/TÚNEL CAÍDO/);
    sinFuga(r);
  });

  it("mutante: tarda más que el tope → FALLA por tiempo", async () => {
    const r = await contra("lento", { CABLE_PRUEBA_TOPE_MS: "300", CABLE_PRUEBA_LLAMADAS: "1" });
    expect(r.codigo).toBe(1);
    expect(r.salida).toMatch(/→ sin respuesta · \d+ ms · FALLA · sin respuesta en 300 ms/);
    expect(r.salida).toMatch(/^RESULTADO: FALLA \(0 de 2\)$/m);
    sinFuga(r);
  });

  it("túnel caído (nada escucha): lo dice con un mensaje claro y sale 3", async () => {
    const puerto = await escuchar(createTcpServer());
    await new Promise((r) => abiertos.pop().close(() => r()));
    const r = await correr({ OFICINA_RUNTIME_URL: `http://127.0.0.1:${puerto}`, OFICINA_RUNTIME_TOKEN: LLAVE });
    expect(r.codigo).toBe(3);
    expect(r.salida).toMatch(/ECONNREFUSED: nada responde en la dirección del túnel/);
    expect(r.salida).toMatch(/^TÚNEL CAÍDO · .*oficina-cable-tunel.*~16 s/m);
    expect(r.salida).toMatch(/^RESULTADO: FALLA \(0 de 4\)$/m);
    sinFuga(r);
  });

  it("túnel que acepta y corta (la oficina no contesta por el túnel): túnel caído, sale 3", async () => {
    const puerto = await escuchar(createTcpServer((s) => s.destroy()));
    const r = await correr({ OFICINA_RUNTIME_URL: `http://127.0.0.1:${puerto}`, OFICINA_RUNTIME_TOKEN: LLAVE });
    expect(r.codigo).toBe(3);
    expect(r.salida).toMatch(/el túnel aceptó la conexión y la cerró sin respuesta/);
    expect(r.salida).toMatch(/^TÚNEL CAÍDO · /m);
    sinFuga(r);
  });

  it.each([
    ["sin URL", { OFICINA_RUNTIME_TOKEN: LLAVE }, /OFICINA_RUNTIME_URL falta/],
    ["URL con usuario", { OFICINA_RUNTIME_URL: "http://yo:clave@127.0.0.1:1", OFICINA_RUNTIME_TOKEN: LLAVE }, /OFICINA_RUNTIME_URL falta o no es/],
    ["URL que no es http", { OFICINA_RUNTIME_URL: "ftp://127.0.0.1:1", OFICINA_RUNTIME_TOKEN: LLAVE }, /OFICINA_RUNTIME_URL falta o no es/],
    ["sin llave", { OFICINA_RUNTIME_URL: "http://127.0.0.1:1" }, /OFICINA_RUNTIME_TOKEN falta o está vacía/],
    ["llave en blanco", { OFICINA_RUNTIME_URL: "http://127.0.0.1:1", OFICINA_RUNTIME_TOKEN: "   " }, /OFICINA_RUNTIME_TOKEN falta o está vacía/],
  ])("configuración inválida (%s): sale 2 sin llamar a nadie", async (_n, env, mensaje) => {
    const r = await correr(env);
    expect(r.codigo).toBe(2);
    expect(r.salida).toMatch(mensaje);
    expect(r.salida).not.toMatch(/GET \/v1\/models/);
    sinFuga(r);
  });
});
