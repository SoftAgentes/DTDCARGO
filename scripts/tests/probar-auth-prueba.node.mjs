// Pruebas de infra/ops/portal-correo-comprobacion/probar-auth-prueba.mjs (SDD-0646, D-1).
// Auth, Mailpit y el DNS van doblados con estado y con un reloj falso: aquí no hay red.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { CORREO_SINTETICO, guardas, probar } from "../../infra/ops/portal-correo-comprobacion/probar-auth-prueba.mjs";

const script = fileURLToPath(new URL("../../infra/ops/portal-correo-comprobacion/probar-auth-prueba.mjs", import.meta.url));

const jwt = (role) =>
  ["e30", Buffer.from(JSON.stringify({ role, iss: "supabase" })).toString("base64url"), "firma"].join(".");

const ENV = Object.freeze({
  APP_ENV: "staging",
  DISABLE_SIGNUP: "true",
  STUDIO_DEFAULT_PROJECT: "dtd-cargo-staging",
  POOLER_TENANT_ID: "dtd-cargo-staging",
  SUPABASE_PUBLIC_URL: "https://supabase-prueba.dtdcargo.com",
  PROBAR_AUTH_URL: "http://api-gw:8000",
  PROBAR_MAILPIT_URL: "http://mailpit:8025/correo",
  SERVICE_ROLE_KEY: jwt("service_role"),
  ANON_KEY: jwt("anon"),
});

/** Cuentas que NO son de la prueba: tienen que seguir ahí después de cualquier corrida. */
const AJENAS = Object.freeze([
  `c-${"9".repeat(32)}@sin-comprobar.invalid`,
  "cliente@example.test",
  "prueba-0646x@gmail.com",
  "prueba-0646-abcd-r@example.test",
  "prueba-0646-0123abcd-r@example.test.ve",
  "Prueba-0646-ZZZZZZZZ-o@example.test",
  // Contiene la forma exacta, pero no empieza con ella (el `^` del patrón).
  "xprueba-0646-0123abcd-r@example.test",
  // Contiene el correo real de ESTA corrida (con `aleatorio` fijo): la búsqueda
  // acotada la devuelve, pero no es exacta.
  "zzprueba-0646-abababab-r@example.test",
]);

const ESCRITURAS = /^(POST|PUT|DELETE) \/auth\/v1\/admin|^POST \/auth\/v1\/(otp|recover)/;

/** GoTrue + Mailpit de mentira, con reloj. `o` cambia un comportamiento para un caso. */
function doble(o = {}) {
  let ahora = 0;
  const users = new Map();
  const correos = []; // { para, visible }
  const llamadas = [];
  const enviadoA = new Map(); // id → último envío (frecuencia de GoTrue)
  let n = 0;
  const tokens = new Set();
  const porEmail = (e) => [...users.entries()].find(([, u]) => u.email === e)?.[0];
  const crear = (email) => {
    const id = `u-${++n}`;
    users.set(id, { email });
    return id;
  };
  for (const e of [...AJENAS, ...(o.ajenasExtra ?? [])]) crear(e);
  const resp = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body });
  const mandar = (para, demora = o.demoraCorreo ?? 3000) => {
    correos.push({ para, visible: ahora + demora });
    if (o.correoDoble) correos.push({ para, visible: ahora + demora });
  };
  const limitada = (id) => enviadoA.has(id) && ahora - enviadoA.get(id) < 60000;

  async function fetchFalso(url, init = {}) {
    const u = new URL(url);
    const metodo = init.method ?? "GET";
    const cuerpo = init.body ? JSON.parse(init.body) : {};
    llamadas.push(`${metodo} ${u.pathname}${u.search && u.pathname.endsWith("/admin/users") ? "?" + [...u.searchParams.keys()].join("&") : ""}`);
    if (u.hostname === "mailpit") {
      if (u.pathname.endsWith("/api/v1/info")) return resp(o.sinMailpit ? 404 : 200, { Version: "v1.31.3" });
      const q = u.searchParams.get("query") ?? "";
      const para = /to:"(.*)"/.exec(q)?.[1];
      if (metodo === "DELETE") {
        for (let i = correos.length - 1; i >= 0; i -= 1) if (correos[i].para === para) correos.splice(i, 1);
        return resp(200, {});
      }
      const cuantos = o.mailpitCiego ? 0 : correos.filter((c) => c.para === para && c.visible <= ahora).length;
      return resp(200, { messages_count: cuantos });
    }
    const p = u.pathname;
    if (p === "/auth/v1/settings") return resp(200, { disable_signup: o.registroAbierto ? false : true });
    if (p === "/auth/v1/admin/users" && metodo === "POST") {
      if (porEmail(cuerpo.email)) return resp(422, { error_code: "email_exists", msg: `${cuerpo.email} ya existe` });
      const id = crear(cuerpo.email);
      return resp(200, { id, email: cuerpo.email });
    }
    if (p === "/auth/v1/admin/users" && metodo === "GET") {
      if (o.listarFalla) return resp(500, {});
      const filtro = (u.searchParams.get("filter") ?? "").toLowerCase();
      if (o.restosFalla && filtro === "prueba-0646-") return resp(500, {});
      // Como GoTrue: ILIKE '%filtro%' sobre el correo.
      let lista = [...users.entries()].map(([id, x]) => ({ id, email: x.email }));
      if (!o.ignoraFiltro) lista = lista.filter((x) => x.email.toLowerCase().includes(filtro));
      if (o.listaConNulos) lista = [null, { id: null, email: null }, ...lista];
      if (o.cienRestos && filtro === "prueba-0646-") {
        lista = [...lista, ...Array.from({ length: 100 }, (_, i) => ({ id: `x-${i}`, email: `prueba-0646-${String(i).padStart(8, "0")}-r@example.test` }))];
      }
      return resp(200, { users: lista });
    }
    const m = /^\/auth\/v1\/admin\/users\/(.+)$/.exec(p);
    if (m) {
      const id = m[1];
      if (metodo === "GET") return users.has(id) ? resp(200, { id, email: users.get(id).email }) : resp(404, {});
      if (metodo === "DELETE") {
        if (o.borrarFalla) return resp(500, {});
        if (!users.has(id)) return resp(404, {});
        // Auth dice que borró, pero la cuenta interna sigue ahí.
        if (o.noBorraInterna && users.get(id).email.endsWith(".invalid")) return resp(200, {});
        users.delete(id);
        return resp(200, {});
      }
      if (metodo === "PUT") {
        const duenio = porEmail(cuerpo.email);
        if (duenio && duenio !== id) {
          return resp(o.ocupado?.status ?? 422, { error_code: o.ocupado?.codigo ?? "email_exists", msg: `${cuerpo.email} ocupado` });
        }
        users.get(id).email = cuerpo.email;
        return resp(200, { id, email: cuerpo.email });
      }
    }
    if (p === "/auth/v1/admin/generate_link") {
      const t = `h-${n}-secreto`;
      tokens.add(t);
      const id = porEmail(cuerpo.email);
      if (id) enviadoA.set(id, ahora); // GoTrue cuenta el acuñado para la frecuencia
      return resp(200, { action_link: `https://supabase-prueba.dtdcargo.com/auth/v1/verify?token=${t}`, properties: { hashed_token: t } });
    }
    if (p === "/auth/v1/verify") {
      if (o.verifyFalla || !tokens.has(cuerpo.token_hash)) return resp(403, { error_code: "otp_expired" });
      return resp(200, { access_token: "eyJacceso", refresh_token: "r-1" });
    }
    if (p === "/auth/v1/otp") {
      const id = porEmail(cuerpo.email);
      if (id) {
        if (o.limiteControl || limitada(id)) return resp(429, { error_code: "over_email_send_rate_limit" });
        enviadoA.set(id, ahora);
        mandar(cuerpo.email);
        return resp(200, {});
      }
      if (o.otpCreaCuenta && cuerpo.create_user) {
        crear(cuerpo.email);
        mandar(cuerpo.email);
        return resp(200, {});
      }
      return resp(422, { error_code: cuerpo.create_user ? "signup_disabled" : "otp_disabled" });
    }
    if (p === "/auth/v1/recover") {
      if (porEmail(cuerpo.email) || o.recoverMandaIgual) mandar(cuerpo.email, o.demoraRecover);
      return resp(200, {});
    }
    if (p === "/auth/v1/user") return o.sesionCortada ? resp(401, { error_code: "bad_jwt" }) : resp(200, { id: "u-1" });
    if (p === "/auth/v1/token") return resp(200, { access_token: "eyJnuevo", refresh_token: "r-2" });
    return resp(404, {});
  }
  return {
    fetch: fetchFalso,
    users,
    correos,
    llamadas,
    esperar: async (ms) => {
      ahora += ms;
    },
    correosDeUsuarios: () => [...users.values()].map((x) => x.email),
  };
}

async function correr(o = {}, extra = {}) {
  const d = doble(o);
  const lineas = [];
  const codigo = await probar({
    env: { ...ENV, ...(extra.env ?? {}) },
    fetch: d.fetch,
    resolver: extra.resolver ?? (async (h) => (h === "envoy" && extra.sinEnvoy ? [] : ["172.20.0.5"])),
    aleatorio: extra.aleatorio ?? ((n) => "ab".repeat(n)),
    log: (m) => lineas.push(m),
    esperar: d.esperar,
    ensayo: extra.ensayo,
  });
  return { codigo, salida: lineas.join("\n"), d };
}

/** La salida nunca lleva correos, claves, tokens ni enlaces. */
function sinFugas(salida) {
  assert.doesNotMatch(salida, /@/);
  assert.doesNotMatch(salida, /eyJ/);
  assert.doesNotMatch(salida, /secreto|r-1|r-2|https?:/);
  assert.doesNotMatch(salida, /example|invalid|gmail/);
}

/** ⭐ Las cuentas ajenas siguen ahí, todas, y no se tocó nada más que lo de la prueba. */
function ajenasIntactas(d) {
  assert.deepEqual(d.correosDeUsuarios().sort(), [...AJENAS].sort());
  // Nunca listó el Auth entero: toda lectura de la lista va con filtro.
  for (const l of d.llamadas.filter((x) => x.startsWith("GET /auth/v1/admin/users?") || x === "GET /auth/v1/admin/users")) {
    assert.match(l, /filter/, `listó sin filtro: ${l}`);
  }
}

test("⭐ camino feliz: todo PASÓ, sale con 0, borra solo lo suyo y deja intactas las ajenas", async () => {
  const { codigo, salida, d } = await correr();
  assert.equal(codigo, 0, salida);
  assert.doesNotMatch(salida, /FALLÓ/);
  assert.match(salida, /PASÓ el correo ocupado da un rechazo conocido \(forma: 422 email_exists\) · status 422 · código email_exists/);
  assert.match(salida, /cuenta de prueba creada \(dirección interna\) · id u-\d+/);
  assert.match(salida, /pedir código con el correo real .* status 422 · código signup_disabled/);
  assert.match(salida, /PASÓ control: a la cuenta de control le llegó exactamente un correo/);
  assert.match(salida, /PASÓ en la misma ventana no llegó ningún correo para el correo real/);
  assert.match(salida, /PASÓ limpieza · 3 cuenta\(s\)/);
  ajenasIntactas(d);
  assert.equal(d.correos.length, 0, "también limpia Mailpit");
  sinFugas(salida);
});

test("⭐ --ensayo solo corre las guardas: ninguna llamada de red (ni DNS) y sale con 0", async () => {
  let dns = 0;
  const { codigo, salida, d } = await correr({}, { ensayo: true, resolver: async () => (dns += 1, ["1.2.3.4"]) });
  assert.equal(codigo, 0);
  assert.equal(d.llamadas.length, 0);
  assert.equal(dns, 0);
  assert.match(salida, /Ensayo/);
});

test("⭐ si una guarda sin red no prueba que es el entorno de prueba: sale con 2 sin llamar a nada", async () => {
  const casos = [
    { APP_ENV: "production" },
    { APP_ENV: undefined },
    { DISABLE_SIGNUP: "false" },
    { STUDIO_DEFAULT_PROJECT: "dtd-cargo" },
    { POOLER_TENANT_ID: "dtd-cargo" },
    { STUDIO_DEFAULT_PROJECT: undefined, POOLER_TENANT_ID: undefined },
    { SUPABASE_PUBLIC_URL: "https://supabase.dtdcargo.com" },
    { SUPABASE_PUBLIC_URL: "https://prueba-abc.supabase.co" },
    { PROBAR_AUTH_URL: undefined },
    { PROBAR_AUTH_URL: "https://supabase-prueba.dtdcargo.com" },
    { PROBAR_AUTH_URL: "https://supabase.dtdcargo.com" },
    { PROBAR_AUTH_URL: "https://abcd.supabase.co" },
    { PROBAR_AUTH_URL: "ftp://api-gw:8000" },
    { PROBAR_AUTH_URL: "http://api-gw.evil.example:8000" },
    { PROBAR_MAILPIT_URL: undefined },
    { PROBAR_MAILPIT_URL: "https://correo.dtdcargo.com" },
    { PROBAR_MAILPIT_URL: "http://mailpit-prueba.dtdcargo.com" },
    { SERVICE_ROLE_KEY: undefined },
    { SERVICE_ROLE_KEY: jwt("anon") },
    { ANON_KEY: jwt("service_role") },
    { RESEND_API_KEY: "re_algo" },
  ];
  for (const env of casos) {
    const { codigo, salida, d } = await correr({}, { env });
    assert.equal(codigo, 2, `${JSON.stringify(Object.keys(env))}\n${salida}`);
    assert.equal(d.llamadas.length, 0, "no llamó a nada");
    assert.match(salida, /FALLÓ guarda/);
    sinFugas(salida);
  }
  for (const env of [{ ...ENV, APP_ENV: "x" }, {}]) assert.equal(guardas(env).ok, false);
});

test("⭐ guardas con red: sin una sola escritura si api-gw no resuelve a UNA dirección, sin Mailpit o con el registro abierto", async () => {
  const casos = [
    [{}, { resolver: async () => ["172.20.0.5", "172.21.0.7"] }, /exactamente una dirección \(2\)/],
    [{}, { resolver: async () => [] }, /exactamente una dirección \(0\)/],
    [{}, { resolver: async () => { throw new Error("ENOTFOUND"); } }, /no resuelve/],
    [{ sinMailpit: true }, {}, /Mailpit no responde/],
    [{ registroAbierto: true }, {}, /registro esté cerrado/],
  ];
  for (const [o, extra, msg] of casos) {
    const { codigo, salida, d } = await correr(o, extra);
    assert.equal(codigo, 2, salida);
    assert.match(salida, msg);
    assert.equal(d.llamadas.filter((l) => ESCRITURAS.test(l)).length, 0, `escribió: ${d.llamadas.join(", ")}`);
    ajenasIntactas(d);
  }
});

test("⭐ un fallo a mitad igual borra lo que creó, deja las ajenas y sale distinto de 0", async () => {
  const { codigo, salida, d } = await correr({ verifyFalla: true });
  assert.equal(codigo, 1);
  assert.match(salida, /FALLÓ canjear el enlace y tener sesión · status 403 · código otp_expired/);
  assert.match(salida, /PASÓ limpieza · 1 cuenta/);
  ajenasIntactas(d);
  sinFugas(salida);
});

test("⭐ si no pudo limpiar, sale distinto de 0 y no toca las ajenas", async () => {
  const { codigo, salida, d } = await correr({ borrarFalla: true });
  assert.equal(codigo, 1);
  assert.match(salida, /FALLÓ limpieza/);
  for (const e of AJENAS) assert.ok(d.correosDeUsuarios().includes(e));
});

test("⭐ si Auth ignora el filtro de búsqueda, no borra por lo que devuelve: FALLÓ y las ajenas siguen", async () => {
  const { codigo, salida, d } = await correr({ ignoraFiltro: true });
  assert.equal(codigo, 1);
  assert.match(salida, /FALLÓ/);
  for (const e of AJENAS) assert.ok(d.correosDeUsuarios().includes(e), `borró ${e}`);
});

test("⭐ si Auth dice que borró pero la cuenta sigue (se mira por id), la limpieza FALLÓ", async () => {
  const { codigo, salida } = await correr({ noBorraInterna: true });
  assert.equal(codigo, 1);
  assert.match(salida, /FALLÓ limpieza/);
});

test("⭐ si no puede buscar los restos de corridas anteriores, la limpieza no se da por buena", async () => {
  const { codigo, salida, d } = await correr({ restosFalla: true, ajenasExtra: ["prueba-0646-deadbeef-r@example.test"] });
  assert.equal(codigo, 1);
  assert.match(salida, /FALLÓ limpieza/);
  for (const e of AJENAS) assert.ok(d.correosDeUsuarios().includes(e));
});

test("si no puede buscar para revisar la limpieza, tampoco da 0", async () => {
  const { codigo, salida, d } = await correr({ listarFalla: true });
  assert.equal(codigo, 1);
  assert.match(salida, /FALLÓ limpieza/);
  for (const e of AJENAS) assert.ok(d.correosDeUsuarios().includes(e));
});

test("tolera entradas nulas en la búsqueda sin cortarse", async () => {
  const { codigo, salida, d } = await correr({ listaConNulos: true });
  assert.equal(codigo, 0, salida);
  ajenasIntactas(d);
});

test("⭐ si Auth crea una cuenta con el correo real al pedir código, lo marca y la borra", async () => {
  const { codigo, salida, d } = await correr({ otpCreaCuenta: true });
  assert.equal(codigo, 1);
  assert.match(salida, /FALLÓ Auth no creó ninguna cuenta con el correo real/);
  assert.match(salida, /FALLÓ en la misma ventana no llegó ningún correo para el correo real/);
  ajenasIntactas(d);
});

test("⭐ un correo al real que llega tarde, dentro de la ventana, también se ve: FALLÓ", async () => {
  const { codigo, salida } = await correr({ recoverMandaIgual: true, demoraRecover: 3000 });
  assert.equal(codigo, 1);
  assert.match(salida, /FALLÓ en la misma ventana no llegó ningún correo para el correo real/);
});

test("⭐ sin el control de Mailpit, el «no llegó nada» no vale: FALLÓ", async () => {
  const { codigo, salida } = await correr({ mailpitCiego: true });
  assert.equal(codigo, 1);
  assert.match(salida, /FALLÓ control: a la cuenta de control le llegó exactamente un correo/);
});

test("⭐ el control pide exactamente un correo: dos también es FALLÓ", async () => {
  const { codigo, salida } = await correr({ correoDoble: true });
  assert.equal(codigo, 1);
  assert.match(salida, /FALLÓ control: a la cuenta de control le llegó exactamente un correo/);
});

test("⭐ un 429 de frecuencia en el control se dice aparte, no como fallo de la regla", async () => {
  const { codigo, salida, d } = await correr({ limiteControl: true });
  assert.equal(codigo, 1);
  assert.match(salida, /FALLÓ control: Auth limitó la frecuencia de correo \(429\), no es un fallo de la regla.* status 429 · código over_email_send_rate_limit/);
  assert.doesNotMatch(salida, /no llegó ningún correo/);
  ajenasIntactas(d);
});

test("el control no choca con la frecuencia de GoTrue: usa una cuenta a la que no se le acuñó nada", async () => {
  // El doble aplica 60 s por cuenta después de acuñar; el camino feliz pasa igual.
  const { codigo, salida } = await correr();
  assert.equal(codigo, 0, salida);
  assert.doesNotMatch(salida, /429/);
});

test("si el cambio de correo corta la sesión, FALLÓ", async () => {
  const { codigo, salida } = await correr({ sesionCortada: true });
  assert.equal(codigo, 1);
  assert.match(salida, /FALLÓ la sesión sigue válida después del cambio · status 401 · código bad_jwt/);
});

test("⭐ un correo ocupado con otro status o código: FALLÓ y anota los exactos", async () => {
  for (const ocupado of [
    { status: 400, codigo: "user_already_exists" },
    { status: 500, codigo: "unexpected_failure" },
    { status: 422, codigo: "23505" },
  ]) {
    const { codigo, salida } = await correr({ ocupado });
    assert.equal(codigo, 1, salida);
    assert.match(
      salida,
      new RegExp(`FALLÓ el correo ocupado da un rechazo conocido \\(forma: desconocida\\) · status ${ocupado.status} · código ${ocupado.codigo}`),
    );
    sinFugas(salida);
  }
});

test("⭐ la forma real del Auth de prueba (500 · 23505) es un resultado válido y lo anota", async () => {
  const { codigo, salida } = await correr({ ocupado: { status: 500, codigo: "23505" } });
  assert.equal(codigo, 0, salida);
  assert.match(salida, /PASÓ el correo ocupado da un rechazo conocido \(forma: 500 23505\) · status 500 · código 23505/);
});

test("⭐ alias de la red interna: sin kong ni envoy, o resolviendo a otro gateway, no escribe nada", async () => {
  const casos = [
    [async (h) => (h === "api-gw" ? ["172.20.0.5"] : []), /no resuelve kong ni envoy/],
    [async (h) => (h === "api-gw" ? ["172.20.0.5"] : ["172.21.0.9"]), /alias kong no resuelve a la misma dirección/],
    [async (h) => (h === "api-gw" ? ["172.20.0.5"] : h === "kong" ? [] : ["172.20.0.5", "172.21.0.9"]), /alias envoy no resuelve a la misma/],
    [async (h) => { if (h === "api-gw") return ["172.20.0.5"]; throw new Error("ENOTFOUND"); }, /no resuelve kong ni envoy/],
  ];
  for (const [resolver, msg] of casos) {
    const { codigo, salida, d } = await correr({}, { resolver });
    assert.equal(codigo, 2, salida);
    assert.match(salida, msg);
    assert.equal(d.llamadas.filter((l) => ESCRITURAS.test(l)).length, 0);
  }
  // Con uno solo de los dos alias alcanza.
  const { codigo } = await correr({}, { sinEnvoy: true });
  assert.equal(codigo, 0);
});

test("⭐ si el proceso muere a mitad, la salida ya anotó el id de la cuenta interna", async () => {
  const { salida } = await correr({ verifyFalla: true });
  const iCreada = salida.indexOf("cuenta de prueba creada (dirección interna) · id u-");
  const iFallo = salida.indexOf("FALLÓ canjear el enlace");
  assert.ok(iCreada >= 0 && iCreada < iFallo, salida);
});

test("⭐ con 100 o más resultados la búsqueda de restos no se usa para borrar: FALLÓ y no borra", async () => {
  const { codigo, salida, d } = await correr({ cienRestos: true });
  assert.equal(codigo, 1);
  assert.match(salida, /FALLÓ limpieza/);
  ajenasIntactas(d);
});

test("⭐ restos de una corrida anterior con la forma exacta se borran; los parecidos no", async () => {
  const viejos = ["prueba-0646-deadbeef-r@example.test", "prueba-0646-deadbeef-o@example.test", "prueba-0646-deadbeef-c@example.test"];
  const { codigo, salida, d } = await correr({ ajenasExtra: viejos });
  assert.equal(codigo, 0, salida);
  ajenasIntactas(d);
});

test("la forma exacta de los correos sintéticos", () => {
  for (const e of ["prueba-0646-0123abcd-r@example.test", "prueba-0646-0123abcd-o@example.test", "prueba-0646-0123abcd-c@example.test"]) {
    assert.match(e, CORREO_SINTETICO);
  }
  for (const e of AJENAS) assert.doesNotMatch(e, CORREO_SINTETICO);
});

test("⭐ por la entrada estándar (`node -`): corre solo, respeta --ensayo y las guardas", () => {
  const fuente = readFileSync(script, "utf8");
  const base = { PATH: process.env.PATH ?? "", SystemRoot: process.env.SystemRoot ?? "" };
  const ok = spawnSync(process.execPath, ["-", "--ensayo"], { input: fuente, env: { ...base, ...ENV }, encoding: "utf8" });
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  assert.match(ok.stdout, /Ensayo: no se llamó a Auth ni a Mailpit/);
  const mal = spawnSync(process.execPath, ["-", "--ensayo"], { input: fuente, env: base, encoding: "utf8" });
  assert.equal(mal.status, 2, mal.stdout + mal.stderr);
  assert.match(mal.stdout, /FALLÓ guarda/);
});

test("importarlo no lo ejecuta", () => {
  // Si se ejecutara al importar, este archivo ya habría salido con process.exit.
  assert.equal(typeof probar, "function");
});
