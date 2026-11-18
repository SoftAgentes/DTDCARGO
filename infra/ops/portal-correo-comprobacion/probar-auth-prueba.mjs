// infra/ops/portal-correo-comprobacion/probar-auth-prueba.mjs
//
// SDD-0646 (D-1, opción C) · prueba contra el Auth REAL del entorno de prueba,
// pendiente antes de aplicar la 0559. No depende de la 0559: solo habla con
// GoTrue (por el gateway) y con Mailpit. Nunca toca producción.
//
// Comprueba, con cuentas sintéticas que crea y borra:
//   1. Auth acepta una cuenta con la dirección interna (`c-<32 hex>@sin-comprobar.invalid`).
//   2. El enlace de entrada (magiclink) se acuña para esa dirección y da sesión.
//   3. Con el correo real, que todavía no está en Auth, los caminos propios de
//      Auth para pedir un código o recuperar no crean ninguna cuenta ni mandan
//      correo.
//   4. Pasar la cuenta al correo real (y de vuelta) no corta la sesión.
//   5. Control: con el correo real ya en la cuenta, el pedido de código SÍ llega
//      a Mailpit. Sin este control, el «no llegó nada» del punto 3 no prueba nada.
//   6. El status y el código exactos cuando el correo ya es de otra cuenta
//      (la app espera `email_exists`).
// Al final borra sus cuentas aunque algo haya fallado a mitad, y comprueba que
// no quedó ninguna.
//
// Salida: solo PASÓ / FALLÓ con el paso, el status y el código. Nunca imprime
// claves, tokens, enlaces ni correos.
// Código de salida: 0 si todo pasó y se limpió · 1 si algo falló o no se pudo
// limpiar · 2 si una guarda no pudo probar que esto es el entorno de prueba.
//
// Guardas (todas tienen que pasar; ante la duda, no corre):
//   · APP_ENV=staging, DISABLE_SIGNUP=true, STUDIO_DEFAULT_PROJECT o
//     POOLER_TENANT_ID terminado en `-staging`.
//   · SUPABASE_PUBLIC_URL con un host de prueba (`prueba` o `staging` en el
//     primer segmento) y nunca de Supabase Cloud.
//   · PROBAR_AUTH_URL: el gateway interno (`http://api-gw:8000`) o el mismo host
//     de SUPABASE_PUBLIC_URL. Nunca un host de Cloud.
//   · Claves de servicio y anónima presentes, con el rol que dicen tener.
//   · Sin claves de envío real de correo (RESEND_API_KEY) en el entorno.
//   · Ya en red: /auth/v1/settings dice que el registro está cerrado.
//
// Uso (en el VPS, por la sesión con SSH; el secreto no sale del servidor):
//   docker run -i --rm --network <red interna del proyecto de prueba> \
//     --env-file /srv/dtd-cargo-staging/.env \
//     -e PROBAR_AUTH_URL=http://api-gw:8000 \
//     -e PROBAR_MAILPIT_URL=http://mailpit:8025/correo \
//     node:24 node - [--ensayo] < infra/ops/portal-correo-comprobacion/probar-auth-prueba.mjs
//
// `--ensayo` (o PROBAR_AUTH_ENSAYO=1): solo corre las guardas, sin una sola
// llamada de red, y sale con 0 si pasan.
//
// Sin dependencias: solo lo que trae node:24 (fetch nativo, node:crypto).
// Pruebas: scripts/tests/probar-auth-prueba.node.mjs.

import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DOMINIO_INTERNO = "sin-comprobar.invalid";
const PREFIJO = "prueba-0646-";

// ─── guardas ────────────────────────────────────────────────────────────────

function host(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

const esCloud = (h) => h === "supabase.co" || h.endsWith(".supabase.co") || h.endsWith(".supabase.com");
const esHostDePrueba = (h) => /(^|-)(prueba|staging)(-|$)/.test(h.split(".")[0] ?? "");

/** Rol que dice el payload de un JWT (sin verificar la firma: solo para no equivocarse de clave). */
function rolDelJwt(jwt) {
  try {
    const partes = String(jwt).split(".");
    if (partes.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(partes[1], "base64url").toString("utf8"));
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

/**
 * Las guardas que no necesitan red. Devuelve la configuración si todas pasan.
 * Los mensajes nombran variables, nunca valores.
 */
export function guardas(env) {
  const fallas = [];
  const g = (ok, paso) => {
    if (!ok) fallas.push(paso);
  };

  g(env.APP_ENV === "staging", "APP_ENV no es staging");
  g(env.DISABLE_SIGNUP === "true", "DISABLE_SIGNUP no es true");
  const proyecto = [env.STUDIO_DEFAULT_PROJECT, env.POOLER_TENANT_ID].filter(Boolean);
  g(proyecto.length > 0 && proyecto.every((p) => /-staging$/.test(p)), "el proyecto no termina en -staging");

  const publico = host(env.SUPABASE_PUBLIC_URL ?? "");
  g(Boolean(publico) && esHostDePrueba(publico) && !esCloud(publico), "SUPABASE_PUBLIC_URL no es un host de prueba");

  const authUrl = env.PROBAR_AUTH_URL ?? "";
  const authHost = host(authUrl);
  const authEsInterno = authHost === "api-gw";
  g(
    Boolean(authHost) && /^https?:$/.test(new URL(authUrl || "http://x").protocol) && !esCloud(authHost) &&
      (authEsInterno || authHost === publico),
    "PROBAR_AUTH_URL no es el gateway interno ni el host público de prueba",
  );

  const service = env.SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || "";
  const anon = env.ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  g(rolDelJwt(service) === "service_role", "la clave de servicio falta o no es de service_role");
  g(rolDelJwt(anon) === "anon", "la clave anónima falta o no es anon");
  g(!env.RESEND_API_KEY, "hay una clave de envío real de correo (RESEND_API_KEY)");

  const mailpitUrl = env.PROBAR_MAILPIT_URL || "http://mailpit:8025/correo";
  const mailpitHost = host(mailpitUrl);
  g(mailpitHost === "mailpit" || (Boolean(mailpitHost) && esHostDePrueba(mailpitHost)), "PROBAR_MAILPIT_URL no es el Mailpit de prueba");

  if (fallas.length > 0) return { ok: false, fallas };
  return {
    ok: true,
    config: {
      authUrl: authUrl.replace(/\/+$/, ""),
      mailpitUrl: mailpitUrl.replace(/\/+$/, ""),
      service,
      anon,
    },
  };
}

// ─── piezas de red ──────────────────────────────────────────────────────────

/** Solo un código con forma de código: nunca el mensaje (puede traer el correo). */
function codigoDe(body) {
  const c = body?.error_code ?? body?.code ?? body?.error;
  return typeof c === "string" && /^[a-z0-9_]{1,64}$/.test(c) ? c : c === undefined || c === null ? "-" : "otro";
}

function cliente(config, fetchImpl) {
  async function llamar(metodo, ruta, { clave = "service", bearer, cuerpo } = {}) {
    const apikey = clave === "service" ? config.service : config.anon;
    const headers = { apikey, Authorization: `Bearer ${bearer ?? apikey}` };
    if (cuerpo !== undefined) headers["content-type"] = "application/json";
    try {
      const res = await fetchImpl(`${config.authUrl}${ruta}`, {
        method: metodo,
        headers,
        body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
        signal: AbortSignal.timeout(15000),
      });
      let body = null;
      try {
        body = await res.json();
      } catch {
        body = null;
      }
      return { status: res.status, body, codigo: res.ok ? "-" : codigoDe(body) };
    } catch {
      return { status: 0, body: null, codigo: "sin_respuesta" };
    }
  }

  async function mailpit(metodo, ruta) {
    try {
      const res = await fetchImpl(`${config.mailpitUrl}${ruta}`, {
        method: metodo,
        signal: AbortSignal.timeout(15000),
      });
      let body = null;
      try {
        body = await res.json();
      } catch {
        body = null;
      }
      return { status: res.status, body };
    } catch {
      return { status: 0, body: null };
    }
  }

  return { llamar, mailpit };
}

// ─── la prueba ──────────────────────────────────────────────────────────────

/**
 * Corre la prueba completa. Devuelve el código de salida.
 * `deps`: { env, fetch, log, aleatorio(bytes) → hex, esperar(ms) }.
 */
export async function probar(deps) {
  const log = deps.log ?? ((m) => console.log(m));
  const aleatorio = deps.aleatorio ?? ((n) => randomBytes(n).toString("hex"));
  const esperar = deps.esperar ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const ensayo = Boolean(deps.ensayo);

  const g = guardas(deps.env ?? {});
  if (!g.ok) {
    for (const f of g.fallas) log(`FALLÓ guarda · ${f}`);
    log("No se pudo probar que esto es el entorno de prueba: no se llamó a nada.");
    return 2;
  }
  log("PASÓ guardas sin red");
  if (ensayo) {
    log("Ensayo: no se llamó a Auth ni a Mailpit.");
    return 0;
  }

  const { llamar, mailpit } = cliente(g.config, deps.fetch ?? fetch);
  let fallo = false;
  const paso = (ok, nombre, r) => {
    if (!ok) fallo = true;
    const detalle = r ? ` · status ${r.status} · código ${r.codigo}` : "";
    log(`${ok ? "PASÓ" : "FALLÓ"} ${nombre}${detalle}`);
    return ok;
  };

  // Guarda en red: el registro de Auth está cerrado.
  const settings = await llamar("GET", "/auth/v1/settings", { clave: "anon" });
  if (!(settings.status === 200 && settings.body?.disable_signup === true)) {
    log(`FALLÓ guarda · Auth no dice que el registro esté cerrado · status ${settings.status}`);
    log("No se pudo probar que esto es el entorno de prueba: no se creó nada.");
    return 2;
  }
  log("PASÓ guarda · el registro de Auth está cerrado");

  const sufijo = aleatorio(4);
  const interna = `c-${aleatorio(16)}@${DOMINIO_INTERNO}`;
  const real = `${PREFIJO}${sufijo}-r@example.test`;
  const otro = `${PREFIJO}${sufijo}-o@example.test`;
  const sinteticos = [interna, real, otro];
  const creados = [];

  const correosEnMailpit = async (correo) => {
    const r = await mailpit("GET", `/api/v1/search?query=${encodeURIComponent(`to:"${correo}"`)}`);
    if (r.status !== 200 || !r.body) return null;
    const n = r.body.messages_count ?? r.body.count ?? r.body.messages?.length;
    return typeof n === "number" ? n : null;
  };

  const usuariosSinteticos = async () => {
    const encontrados = [];
    for (let pagina = 1; pagina <= 20; pagina += 1) {
      const r = await llamar("GET", `/auth/v1/admin/users?page=${pagina}&per_page=200`);
      if (r.status !== 200 || !Array.isArray(r.body?.users)) return null;
      for (const u of r.body.users) {
        const e = String(u.email ?? "").toLowerCase();
        // También los restos de corridas anteriores (mismo prefijo).
        if (sinteticos.includes(e) || e.startsWith(PREFIJO)) encontrados.push({ id: u.id, email: e });
      }
      if (r.body.users.length < 200) return encontrados;
    }
    return null;
  };

  const emailDe = async (id) => {
    const r = await llamar("GET", `/auth/v1/admin/users/${id}`);
    return r.status === 200 ? String(r.body?.email ?? "").toLowerCase() : null;
  };

  let codigo = 1;
  try {
    codigo = await pasos();
  } catch {
    log("FALLÓ inesperado: la prueba se cortó a mitad (sin detalle, para no imprimir datos)");
    codigo = 1;
  }

  // Limpieza, pase lo que pase arriba.
  let limpio = true;
  const porBorrar = new Set(creados);
  const quedaban = await usuariosSinteticos();
  if (quedaban === null) limpio = false;
  else for (const u of quedaban) porBorrar.add(u.id);
  for (const id of porBorrar) {
    const r = await llamar("DELETE", `/auth/v1/admin/users/${id}`);
    if (r.status !== 200 && r.status !== 204 && r.status !== 404) limpio = false;
  }
  const despues = await usuariosSinteticos();
  if (despues === null || despues.length > 0) limpio = false;
  for (const correo of sinteticos) {
    await mailpit("DELETE", `/api/v1/search?query=${encodeURIComponent(`to:"${correo}"`)}`);
  }
  log(`${limpio ? "PASÓ" : "FALLÓ"} limpieza · ${porBorrar.size} cuenta(s) de prueba borrada(s)`);

  return codigo === 0 && limpio && !fallo ? 0 : 1;

  async function pasos() {
    // 1. La cuenta con la dirección interna.
    const crear = await llamar("POST", "/auth/v1/admin/users", { cuerpo: { email: interna, email_confirm: true } });
    const idA = crear.body?.id;
    if (idA) creados.push(idA);
    if (!paso((crear.status === 200 || crear.status === 201) && Boolean(idA), "crear la cuenta con la dirección interna", crear)) {
      return 1;
    }

    // 2. El enlace de entrada para esa dirección, y su sesión.
    const enlace = await llamar("POST", "/auth/v1/admin/generate_link", { cuerpo: { type: "magiclink", email: interna } });
    const hash = enlace.body?.properties?.hashed_token ?? enlace.body?.hashed_token;
    if (!paso(enlace.status === 200 && Boolean(hash), "acuñar el enlace de entrada para la dirección interna", enlace)) {
      return 1;
    }
    const verificar = await llamar("POST", "/auth/v1/verify", { clave: "anon", cuerpo: { type: "magiclink", token_hash: hash } });
    let access = verificar.body?.access_token;
    let refresh = verificar.body?.refresh_token;
    if (!paso(verificar.status === 200 && Boolean(access) && Boolean(refresh), "canjear el enlace y tener sesión", verificar)) {
      return 1;
    }

    // 3. Con el correo real, que todavía no está en Auth.
    const otp = await llamar("POST", "/auth/v1/otp", { clave: "anon", cuerpo: { email: real, create_user: true } });
    paso(true, "pedir código con el correo real (se anota la respuesta)", otp);
    const recover = await llamar("POST", "/auth/v1/recover", { clave: "anon", cuerpo: { email: real } });
    paso(true, "pedir recuperación con el correo real (se anota la respuesta)", recover);
    await esperar(3000);
    const correosAntes = await correosEnMailpit(real);
    paso(correosAntes === 0, "no llegó ningún correo para el correo real");
    const sueltos = await usuariosSinteticos();
    const conReal = sueltos === null ? null : sueltos.filter((u) => u.email === real);
    if (conReal) for (const u of conReal) if (!creados.includes(u.id)) creados.push(u.id);
    paso(Array.isArray(conReal) && conReal.length === 0, "Auth no creó ninguna cuenta con el correo real");
    paso((await emailDe(idA)) === interna, "la cuenta sigue con la dirección interna");

    // 4. Pasar la cuenta al correo real: la sesión sigue viva.
    const pasar = await llamar("PUT", `/auth/v1/admin/users/${idA}`, { cuerpo: { email: real, email_confirm: true } });
    paso(pasar.status === 200 && (await emailDe(idA)) === real, "pasar la cuenta al correo real", pasar);
    const yo = await llamar("GET", "/auth/v1/user", { clave: "anon", bearer: access });
    paso(yo.status === 200, "la sesión sigue válida después del cambio", yo);
    const renovar = await llamar("POST", "/auth/v1/token?grant_type=refresh_token", { clave: "anon", cuerpo: { refresh_token: refresh } });
    if (renovar.body?.access_token) access = renovar.body.access_token;
    if (renovar.body?.refresh_token) refresh = renovar.body.refresh_token;
    paso(renovar.status === 200 && Boolean(renovar.body?.refresh_token), "la sesión se renueva después del cambio", renovar);

    // 5. Control: ahora el pedido de código con el correo real SÍ tiene que llegar.
    const otpControl = await llamar("POST", "/auth/v1/otp", { clave: "anon", cuerpo: { email: real, create_user: false } });
    let correosDespues = null;
    for (let i = 0; i < 8; i += 1) {
      await esperar(2000);
      correosDespues = await correosEnMailpit(real);
      if (typeof correosDespues === "number" && correosDespues > 0) break;
    }
    paso(
      otpControl.status === 200 && typeof correosDespues === "number" && correosDespues > 0,
      "control: con el correo en la cuenta, el código sí llega a Mailpit",
      otpControl,
    );

    // De vuelta a la dirección interna: la sesión sigue.
    const volver = await llamar("PUT", `/auth/v1/admin/users/${idA}`, { cuerpo: { email: interna, email_confirm: true } });
    paso(volver.status === 200 && (await emailDe(idA)) === interna, "devolver la cuenta a la dirección interna", volver);
    const renovar2 = await llamar("POST", "/auth/v1/token?grant_type=refresh_token", { clave: "anon", cuerpo: { refresh_token: refresh } });
    paso(renovar2.status === 200, "la sesión se renueva después de volver", renovar2);

    // 6. El correo ya es de otra cuenta.
    const crearB = await llamar("POST", "/auth/v1/admin/users", { cuerpo: { email: otro, email_confirm: true } });
    if (crearB.body?.id) creados.push(crearB.body.id);
    if (paso((crearB.status === 200 || crearB.status === 201) && Boolean(crearB.body?.id), "crear la segunda cuenta", crearB)) {
      const choque = await llamar("PUT", `/auth/v1/admin/users/${idA}`, { cuerpo: { email: otro, email_confirm: true } });
      paso(choque.status === 422 && choque.codigo === "email_exists", "el correo ocupado da 422 email_exists", choque);
      paso((await emailDe(idA)) === interna, "después del choque la cuenta sigue con la dirección interna");
    }
    return fallo ? 1 : 0;
  }
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  const ensayo = argv.includes("--ensayo") || env.PROBAR_AUTH_ENSAYO === "1";
  return probar({ env, ensayo });
}

/** Corre solo si es la entrada: archivo propio, o `node -` por la entrada estándar. */
function esEntrada() {
  const a = process.argv[1];
  if (a === undefined || a === "-") return true;
  try {
    return resolve(a) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (esEntrada()) {
  main().then(
    (c) => process.exit(c),
    () => {
      console.log("FALLÓ inesperado: la prueba se cortó (sin detalle, para no imprimir datos).");
      process.exit(1);
    },
  );
}
