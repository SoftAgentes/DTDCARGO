// Pruebas de infra/ops/portal-correo-comprobacion/probar-auth-prueba.mjs (SDD-0646, D-1).
// Auth y Mailpit van doblados con estado: aquí no hay red.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { guardas, probar } from "../../infra/ops/portal-correo-comprobacion/probar-auth-prueba.mjs";

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

/** GoTrue + Mailpit de mentira. `o` cambia un comportamiento para un caso. */
function doble(o = {}) {
  const users = new Map();
  const correos = [];
  const llamadas = [];
  let n = 0;
  const tokens = new Set();
  const porEmail = (e) => [...users.entries()].find(([, u]) => u.email === e)?.[0];
  const crear = (email) => {
    const id = `u-${++n}`;
    users.set(id, { email });
    return id;
  };
  const resp = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body });

  async function fetchFalso(url, init = {}) {
    const u = new URL(url);
    const metodo = init.method ?? "GET";
    const cuerpo = init.body ? JSON.parse(init.body) : {};
    llamadas.push(`${metodo} ${u.pathname}`);
    if (u.hostname === "mailpit") {
      const q = u.searchParams.get("query") ?? "";
      const para = /to:"(.*)"/.exec(q)?.[1];
      if (metodo === "DELETE") {
        for (let i = correos.length - 1; i >= 0; i -= 1) if (correos[i] === para) correos.splice(i, 1);
        return resp(200, {});
      }
      const cuantos = o.mailpitCiego ? 0 : correos.filter((c) => c === para).length;
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
      const pagina = Number(u.searchParams.get("page"));
      const lista = pagina === 1 ? [...users.entries()].map(([id, x]) => ({ id, email: x.email })) : [];
      return resp(200, { users: lista });
    }
    const m = /^\/auth\/v1\/admin\/users\/(.+)$/.exec(p);
    if (m) {
      const id = m[1];
      if (metodo === "GET") return users.has(id) ? resp(200, { id, email: users.get(id).email }) : resp(404, {});
      if (metodo === "DELETE") {
        if (o.borrarFalla) return resp(500, {});
        users.delete(id);
        return resp(200, {});
      }
      if (metodo === "PUT") {
        const duenio = porEmail(cuerpo.email);
        if (duenio && duenio !== id) return resp(o.ocupado?.status ?? 422, { error_code: o.ocupado?.codigo ?? "email_exists", msg: `${cuerpo.email} ocupado` });
        users.get(id).email = cuerpo.email;
        return resp(200, { id, email: cuerpo.email });
      }
    }
    if (p === "/auth/v1/admin/generate_link") {
      const t = `h-${n}-secreto`;
      tokens.add(t);
      return resp(200, { action_link: `https://supabase-prueba.dtdcargo.com/auth/v1/verify?token=${t}`, properties: { hashed_token: t } });
    }
    if (p === "/auth/v1/verify") {
      if (o.verifyFalla || !tokens.has(cuerpo.token_hash)) return resp(403, { error_code: "otp_expired" });
      return resp(200, { access_token: "eyJacceso", refresh_token: "r-1" });
    }
    if (p === "/auth/v1/otp") {
      if (porEmail(cuerpo.email)) {
        correos.push(cuerpo.email);
        return resp(200, {});
      }
      if (o.otpCreaCuenta && cuerpo.create_user) {
        crear(cuerpo.email);
        correos.push(cuerpo.email);
        return resp(200, {});
      }
      return resp(422, { error_code: cuerpo.create_user ? "signup_disabled" : "otp_disabled" });
    }
    if (p === "/auth/v1/recover") {
      if (porEmail(cuerpo.email) || o.recoverMandaIgual) correos.push(cuerpo.email);
      return resp(200, {});
    }
    if (p === "/auth/v1/user") return o.sesionCortada ? resp(401, { error_code: "bad_jwt" }) : resp(200, { id: "u-1" });
    if (p === "/auth/v1/token") return resp(200, { access_token: "eyJnuevo", refresh_token: "r-2" });
    return resp(404, {});
  }
  return { fetch: fetchFalso, users, correos, llamadas };
}

async function correr(o = {}, extra = {}) {
  const d = doble(o);
  const lineas = [];
  const codigo = await probar({
    env: { ...ENV, ...(extra.env ?? {}) },
    fetch: d.fetch,
    log: (m) => lineas.push(m),
    esperar: async () => {},
    ensayo: extra.ensayo,
  });
  return { codigo, salida: lineas.join("\n"), d };
}

/** La salida nunca lleva correos, claves, tokens ni enlaces. */
function sinFugas(salida) {
  assert.doesNotMatch(salida, /@/);
  assert.doesNotMatch(salida, /eyJ/);
  assert.doesNotMatch(salida, /secreto|r-1|r-2|https?:/);
  assert.doesNotMatch(salida, /example|invalid/);
}

test("⭐ camino feliz: todo PASÓ, sale con 0 y no queda ninguna cuenta", async () => {
  const { codigo, salida, d } = await correr();
  assert.equal(codigo, 0, salida);
  assert.doesNotMatch(salida, /FALLÓ/);
  assert.match(salida, /PASÓ el correo ocupado da 422 email_exists · status 422 · código email_exists/);
  assert.match(salida, /pedir código con el correo real .* status 422 · código signup_disabled/);
  assert.match(salida, /PASÓ control: con el correo en la cuenta, el código sí llega a Mailpit/);
  assert.match(salida, /PASÓ limpieza · 2 cuenta\(s\)/);
  assert.equal(d.users.size, 0);
  assert.equal(d.correos.length, 0, "también limpia Mailpit");
  sinFugas(salida);
});

test("⭐ --ensayo solo corre las guardas: ninguna llamada de red y sale con 0", async () => {
  const { codigo, salida, d } = await correr({}, { ensayo: true });
  assert.equal(codigo, 0);
  assert.equal(d.llamadas.length, 0);
  assert.match(salida, /Ensayo/);
});

test("⭐ si una guarda no prueba que es el entorno de prueba: sale con 2 sin llamar a nada", async () => {
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
    { PROBAR_AUTH_URL: "https://supabase.dtdcargo.com" },
    { PROBAR_AUTH_URL: "https://abcd.supabase.co" },
    { PROBAR_AUTH_URL: "ftp://api-gw:8000" },
    { SERVICE_ROLE_KEY: undefined },
    { SERVICE_ROLE_KEY: jwt("anon") },
    { ANON_KEY: jwt("service_role") },
    { RESEND_API_KEY: "re_algo" },
    { PROBAR_MAILPIT_URL: "https://correo.dtdcargo.com" },
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

test("si Auth dice que el registro está abierto: sale con 2 sin crear nada", async () => {
  const { codigo, d } = await correr({ registroAbierto: true });
  assert.equal(codigo, 2);
  assert.deepEqual(d.llamadas, ["GET /auth/v1/settings"]);
});

test("⭐ un fallo a mitad igual borra lo que creó y sale distinto de 0", async () => {
  const { codigo, salida, d } = await correr({ verifyFalla: true });
  assert.equal(codigo, 1);
  assert.match(salida, /FALLÓ canjear el enlace y tener sesión · status 403 · código otp_expired/);
  assert.match(salida, /PASÓ limpieza · 1 cuenta/);
  assert.equal(d.users.size, 0);
  sinFugas(salida);
});

test("⭐ si no pudo limpiar, sale distinto de 0 aunque lo demás haya pasado", async () => {
  const { codigo, salida } = await correr({ borrarFalla: true });
  assert.equal(codigo, 1);
  assert.match(salida, /FALLÓ limpieza/);
});

test("si no puede listar las cuentas para revisar la limpieza, tampoco da 0", async () => {
  const { codigo, salida } = await correr({ listarFalla: true });
  assert.equal(codigo, 1);
  assert.match(salida, /FALLÓ limpieza/);
});

test("⭐ si Auth crea una cuenta con el correo real al pedir código, lo marca y la borra", async () => {
  const { codigo, salida, d } = await correr({ otpCreaCuenta: true });
  assert.equal(codigo, 1);
  assert.match(salida, /FALLÓ Auth no creó ninguna cuenta con el correo real/);
  assert.match(salida, /FALLÓ no llegó ningún correo para el correo real/);
  assert.equal(d.users.size, 0);
});

test("si la recuperación manda algo al correo real, FALLÓ", async () => {
  const { codigo, salida } = await correr({ recoverMandaIgual: true });
  assert.equal(codigo, 1);
  assert.match(salida, /FALLÓ no llegó ningún correo para el correo real/);
});

test("⭐ sin el control de Mailpit, el «no llegó nada» no vale: FALLÓ", async () => {
  const { codigo, salida } = await correr({ mailpitCiego: true });
  assert.equal(codigo, 1);
  assert.match(salida, /FALLÓ control: con el correo en la cuenta, el código sí llega a Mailpit/);
});

test("si el cambio de correo corta la sesión, FALLÓ", async () => {
  const { codigo, salida } = await correr({ sesionCortada: true });
  assert.equal(codigo, 1);
  assert.match(salida, /FALLÓ la sesión sigue válida después del cambio · status 401 · código bad_jwt/);
});

test("⭐ un correo ocupado con otro status o código: FALLÓ y anota los exactos", async () => {
  const { codigo, salida } = await correr({ ocupado: { status: 400, codigo: "user_already_exists" } });
  assert.equal(codigo, 1);
  assert.match(salida, /FALLÓ el correo ocupado da 422 email_exists · status 400 · código user_already_exists/);
  sinFugas(salida);
});

test("restos de una corrida anterior se borran y no cuentan como cuenta creada por Auth", async () => {
  const d = doble();
  d.users.set("viejo", { email: "prueba-0646-aaaa-r@example.test" });
  const lineas = [];
  const codigo = await probar({ env: ENV, fetch: d.fetch, log: (m) => lineas.push(m), esperar: async () => {} });
  assert.equal(codigo, 0, lineas.join("\n"));
  assert.equal(d.users.size, 0);
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

test("importarlo no lo ejecuta", async () => {
  // Si se ejecutara al importar, este archivo ya habría salido con process.exit.
  assert.equal(typeof probar, "function");
});
