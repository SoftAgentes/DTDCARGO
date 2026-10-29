// Pruebas del verificador de Cloudflare Access (SDD-0583). Solo datos sintéticos.
//   node --test infra/chatwoot/cf-access/verificador.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { verificarToken, crearCacheJwks, crearServidor, configDesdeEntorno } from "./verificador.mjs";

const EQUIPO = "https://dtd-prueba.cloudflareaccess.com";
const AUD = "aud-sintetica-0583";
const AHORA = 1_800_000_000;

function par(kid) {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  return { kid, privateKey, jwk: { ...publicKey.export({ format: "jwk" }), kid, alg: "RS256", use: "sig" } };
}
const A = par("kid-a"), B = par("kid-b");
const JWKS = { keys: [A.jwk] };

function firmar(carga, { clave = A, cabecera = {} } = {}) {
  const h = Buffer.from(JSON.stringify({ alg: "RS256", kid: clave.kid, typ: "JWT", ...cabecera })).toString("base64url");
  const p = Buffer.from(JSON.stringify(carga)).toString("base64url");
  return `${h}.${p}.${sign("RSA-SHA256", Buffer.from(`${h}.${p}`), clave.privateKey).toString("base64url")}`;
}
const BUENA = { aud: [AUD], iss: EQUIPO, email: "sam.sintetico@example.test", exp: AHORA + 3600, iat: AHORA - 10, nbf: AHORA - 10, type: "app" };
const ver = (token, extra = {}) => verificarToken(token, { jwks: JWKS, aud: AUD, iss: EQUIPO, ahora: AHORA, ...extra });

test("acepta un token válido y devuelve el correo", () => {
  assert.deepEqual(ver(firmar(BUENA)), { ok: true, email: "sam.sintetico@example.test" });
});

test("acepta aud como string y la lista de correos sin importar mayúsculas", () => {
  assert.equal(ver(firmar({ ...BUENA, aud: AUD, email: "Sam.Sintetico@Example.test" }), { emails: ["sam.sintetico@example.test"] }).ok, true);
});

const rechazos = [
  ["token ilegible", "no-es-un-jwt", {}],
  ["algoritmo no admitido", firmar(BUENA, { cabecera: { alg: "HS256" } }), {}],
  ["kid desconocido", firmar(BUENA, { clave: B }), {}],
  ["firma inválida", (() => { const t = firmar(BUENA).split("."); t[1] = Buffer.from(JSON.stringify({ ...BUENA, email: "otro@example.test" })).toString("base64url"); return t.join("."); })(), {}],
  ["firma inválida", (() => { const t = firmar(BUENA, { clave: B }).split("."); return [firmar(BUENA).split(".")[0], t[1], t[2]].join("."); })(), {}],
  ["aud distinta", firmar({ ...BUENA, aud: ["otra-app"] }), {}],
  ["iss distinto", firmar({ ...BUENA, iss: "https://otro-equipo.cloudflareaccess.com" }), {}],
  ["vencido", firmar({ ...BUENA, exp: AHORA - 120 }), {}],
  ["vencido", firmar({ ...BUENA, exp: undefined }), {}],
  ["todavía no vale", firmar({ ...BUENA, nbf: AHORA + 600 }), {}],
  ["emitido en el futuro", firmar({ ...BUENA, iat: AHORA + 600 }), {}],
  ["correo no admitido", firmar({ ...BUENA, email: "intruso@example.test" }), { emails: ["sam.sintetico@example.test"] }],
];
for (const [razon, token, extra] of rechazos) {
  test(`rechaza: ${razon}`, () => assert.deepEqual(ver(token, extra), { ok: false, razon }));
}

test("respeta la holgura de 60 s en exp", () => {
  assert.equal(ver(firmar({ ...BUENA, exp: AHORA - 30 })).ok, true);
});

test("la caché recarga por kid nuevo, pero no más de una vez cada 30 s", async () => {
  let llamadas = 0, actual = { keys: [A.jwk] };
  const obtener = async () => { llamadas++; return { ok: true, json: async () => actual }; };
  const claves = crearCacheJwks("https://x/cdn-cgi/access/certs", { obtener, minRecargaMs: 0 });
  await claves("kid-a"); assert.equal(llamadas, 1);
  await claves("kid-a"); assert.equal(llamadas, 1);
  actual = { keys: [A.jwk, B.jwk] };
  const j = await claves("kid-b"); assert.equal(llamadas, 2); assert.equal(j.keys.length, 2);
  const lenta = crearCacheJwks("https://x", { obtener, minRecargaMs: 60_000 });
  await lenta("kid-a"); await lenta("kid-zzz"); await lenta("kid-zzz");
  assert.equal(llamadas, 3);
});

test("la caché falla si los certs no responden 200 (y el servidor cierra)", async () => {
  const claves = crearCacheJwks("https://x", { obtener: async () => ({ ok: false, status: 503 }) });
  await assert.rejects(() => claves("kid-a"));
});

test("configuración: exige team domain https y AUD", () => {
  assert.throws(() => configDesdeEntorno({}));
  assert.throws(() => configDesdeEntorno({ CF_ACCESS_TEAM_DOMAIN: "http://x", CF_ACCESS_AUD: "a" }));
  assert.deepEqual(configDesdeEntorno({ CF_ACCESS_TEAM_DOMAIN: "https://x.cloudflareaccess.com/", CF_ACCESS_AUD: " a ", CF_ACCESS_EMAILS: "A@x.test, b@x.test" }),
    { equipo: "https://x.cloudflareaccess.com", aud: "a", emails: ["a@x.test", "b@x.test"], puerto: 8080 });
  assert.equal(configDesdeEntorno({ CF_ACCESS_TEAM_DOMAIN: "http://jwks:8080", CF_ACCESS_AUD: "a", CF_ACCESS_PERMITIR_HTTP: "1" }).equipo, "http://jwks:8080");
});

test("servidor HTTP: 200/403/404, cierra si las claves fallan y no escribe token ni correo en el log", async () => {
  const lineas = [];
  let fallar = false;
  const claves = async () => { if (fallar) throw new Error("red"); return JWKS; };
  const srv = crearServidor({ equipo: EQUIPO, aud: AUD, emails: [], claves, log: (l) => lineas.push(l) });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  // El servidor usa el reloj real: un token que vence en una hora.
  const ahora = Math.floor(Date.now() / 1000);
  const valido = firmar({ ...BUENA, exp: ahora + 3600, iat: ahora - 5, nbf: ahora - 5 });
  const pedir = (ruta, cab = {}) => fetch(base + ruta, { headers: cab }).then((r) => r.status);
  try {
    assert.equal(await pedir("/salud"), 200);
    assert.equal(await pedir("/otra"), 404);
    assert.equal(await pedir("/verificar"), 403);
    assert.equal(await pedir("/verificar", { "Cf-Access-Jwt-Assertion": valido }), 200);
    assert.equal(await pedir("/verificar", { "Cf-Access-Jwt-Assertion": firmar({ ...BUENA, aud: "otra" }) }), 403);
    // Cabecera con JSON cortado: razón «token ilegible», no «claves».
    assert.equal(await pedir("/verificar", { "Cf-Access-Jwt-Assertion": "eyJhbGciOiJSUzI1NiIsImtpZCI6Ingi.eyJhdWQiOiJ4In0.YWJj" }), 403);
    fallar = true;
    assert.equal(await pedir("/verificar", { "Cf-Access-Jwt-Assertion": valido }), 403);
  } finally { srv.close(); }
  assert.deepEqual(lineas, ["denegado: sin cabecera", "permitido", "denegado: aud distinta", "denegado: token ilegible", "denegado: no se pudieron leer las claves"]);
  assert.ok(lineas.every((l) => !l.includes("example.test") && !l.includes(valido.slice(0, 20))));
});
