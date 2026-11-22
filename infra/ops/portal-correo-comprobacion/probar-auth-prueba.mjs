// infra/ops/portal-correo-comprobacion/probar-auth-prueba.mjs
//
// SDD-0646 (D-1, opción C) · prueba contra el Auth REAL del entorno de prueba,
// pendiente antes de aplicar la 0559. No depende de la 0559: solo habla con
// GoTrue (por el gateway interno) y con Mailpit. Nunca toca producción.
//
// Comprueba, con cuentas sintéticas que crea y borra:
//   1. Auth acepta una cuenta con la dirección interna (`c-<32 hex>@sin-comprobar.invalid`).
//   2. El enlace de entrada (magiclink) se acuña para esa dirección y da sesión.
//   3. Con el correo real, que todavía no está en Auth, los caminos propios de
//      Auth para pedir un código o recuperar no crean ninguna cuenta ni mandan
//      correo. Control en la MISMA ventana de espera: a una cuenta de control
//      nueva sí le llega exactamente un correo. Sin el control, el «no llegó
//      nada» no prueba nada.
//   4. Pasar la cuenta al correo real (y de vuelta) no corta la sesión.
//   5. El status y el código exactos cuando el correo ya es de otra cuenta.
//      Dos formas conocidas y válidas: `422 email_exists` (lo que documenta
//      Auth) o `500 23505` (violación de unicidad: lo que respondió el Auth de
//      prueba el 2026-11-18). La salida anota cuál salió; otra cosa es FALLÓ.
// Cada cuenta que crea la anota con su id apenas la crea (un id no es un dato
// personal): si el proceso muere a mitad, la salida ya dice qué borrar a mano.
// Al final borra SOLO lo suyo: las cuentas que creó (por id) y, como resto de
// una corrida anterior, las que tengan exactamente la forma de sus correos
// sintéticos. Nunca lista todas las cuentas del Auth de prueba: busca acotado
// al correo sintético.
//
// Salida: solo PASÓ / FALLÓ con el paso, el status y el código. Nunca imprime
// claves, tokens, enlaces ni correos.
// Código de salida: 0 si todo pasó y se limpió · 1 si algo falló o no se pudo
// limpiar · 2 si una guarda no pudo probar que esto es el entorno de prueba
// (no se escribió nada).
//
// Guardas (todas tienen que pasar; ante la duda, no corre):
//   Sin red:
//   · APP_ENV=staging, DISABLE_SIGNUP=true, STUDIO_DEFAULT_PROJECT o
//     POOLER_TENANT_ID terminado en `-staging`.
//   · SUPABASE_PUBLIC_URL con un host de prueba (`prueba` o `staging` en el
//     primer segmento) y nunca de Supabase Cloud.
//   · PROBAR_AUTH_URL con host exactamente `api-gw` y PROBAR_MAILPIT_URL con
//     host exactamente `mailpit` (los servicios de la red interna de prueba).
//   · Claves de servicio y anónima presentes, con el rol que dicen tener.
//   · Sin claves de envío real de correo (RESEND_API_KEY) en el entorno.
//   Con red, antes de la primera escritura:
//   · `api-gw` resuelve a exactamente UNA dirección. En `dtd_edge`, la red
//     compartida, resuelve a los gateways de los dos proyectos: ahí no corre.
//   · Y al menos uno de sus alias `kong` o `envoy`, que sólo existen en la red
//     interna del proyecto, resuelve a esa MISMA dirección.
//   · Mailpit responde `/api/v1/info` con 200 (producción no tiene Mailpit).
//   · /auth/v1/settings dice que el registro está cerrado.
//
// Uso (en el VPS, por la sesión con SSH; el secreto no sale del servidor).
// La red es la INTERNA del proyecto de prueba: `dtd-cargo-staging_dtd_internal`
// (compose la arma con el proyecto `dtd-cargo-staging` y la red `dtd_internal`;
// confírmalo con `docker network ls`). NUNCA `dtd_edge`. Es una red sin salida a
// internet: la imagen `node:24` tiene que estar ya descargada.
//
//   docker run -i --rm --network dtd-cargo-staging_dtd_internal \
//     --env-file /srv/dtd-cargo-staging/.env \
//     -e PROBAR_AUTH_URL=http://api-gw:8000 \
//     -e PROBAR_MAILPIT_URL=http://mailpit:8025/correo \
//     node:24 node - [--ensayo] < infra/ops/portal-correo-comprobacion/probar-auth-prueba.mjs
//
// `--ensayo` (o PROBAR_AUTH_ENSAYO=1): solo corre las guardas sin red, sin una
// sola llamada, y sale con 0 si pasan.
//
// GoTrue manda a lo sumo un correo por cuenta cada GOTRUE_SMTP_MAX_FREQUENCY
// (60 s por omisión). Por eso el control usa una cuenta propia, a la que no se
// le acuñó nada antes. Si aun así Auth responde 429, la salida lo dice aparte:
// no es un fallo de la regla; se espera y se vuelve a correr.
//
// Sin dependencias: solo lo que trae node:24 (fetch nativo, node:crypto, node:dns).
// Pruebas: scripts/tests/probar-auth-prueba.node.mjs.

import { randomBytes } from "node:crypto";
import { lookup } from "node:dns/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DOMINIO_INTERNO = "sin-comprobar.invalid";
const PREFIJO = "prueba-0646-";
/** La forma EXACTA de los correos sintéticos de esta prueba (real, otro y control). */
export const CORREO_SINTETICO = /^prueba-0646-[0-9a-f]{8}-[roc]@example\.test$/;
/** Ventana de espera de Mailpit: la misma para la negativa y para el control. */
const VENTANA_MS = 20000;
const PASO_MS = 2000;

// ─── guardas sin red ────────────────────────────────────────────────────────

function host(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function protocoloHttp(url) {
  try {
    return /^https?:$/.test(new URL(url).protocol);
  } catch {
    return false;
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
  g(protocoloHttp(authUrl) && host(authUrl) === "api-gw", "PROBAR_AUTH_URL no es el gateway interno (api-gw)");
  const mailpitUrl = env.PROBAR_MAILPIT_URL ?? "";
  g(protocoloHttp(mailpitUrl) && host(mailpitUrl) === "mailpit", "PROBAR_MAILPIT_URL no es el Mailpit interno (mailpit)");

  const service = env.SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || "";
  const anon = env.ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  g(rolDelJwt(service) === "service_role", "la clave de servicio falta o no es de service_role");
  g(rolDelJwt(anon) === "anon", "la clave anónima falta o no es anon");
  g(!env.RESEND_API_KEY, "hay una clave de envío real de correo (RESEND_API_KEY)");

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
  if (c === undefined || c === null) return "-";
  return typeof c === "string" && /^[a-z0-9_]{1,64}$/.test(c) ? c : "otro";
}

function cliente(config, fetchImpl) {
  async function pedir(url, init) {
    try {
      const res = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(15000) });
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

  function llamar(metodo, ruta, { clave = "service", bearer, cuerpo } = {}) {
    const apikey = clave === "service" ? config.service : config.anon;
    const headers = { apikey, Authorization: `Bearer ${bearer ?? apikey}` };
    if (cuerpo !== undefined) headers["content-type"] = "application/json";
    return pedir(`${config.authUrl}${ruta}`, {
      method: metodo,
      headers,
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
  }

  const mailpit = (metodo, ruta) => pedir(`${config.mailpitUrl}${ruta}`, { method: metodo });

  return { llamar, mailpit };
}

// ─── la prueba ──────────────────────────────────────────────────────────────

/**
 * Corre la prueba completa. Devuelve el código de salida.
 * `deps`: { env, fetch, resolver(host) → direcciones[], log, aleatorio(bytes) → hex, esperar(ms), ensayo }.
 */
export async function probar(deps) {
  const log = deps.log ?? ((m) => console.log(m));
  const aleatorio = deps.aleatorio ?? ((n) => randomBytes(n).toString("hex"));
  const esperar = deps.esperar ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const resolver = deps.resolver ?? (async (h) => (await lookup(h, { all: true })).map((d) => d.address));

  const g = guardas(deps.env ?? {});
  if (!g.ok) {
    for (const f of g.fallas) log(`FALLÓ guarda · ${f}`);
    log("No se pudo probar que esto es el entorno de prueba: no se llamó a nada.");
    return 2;
  }
  log("PASÓ guardas sin red");
  if (deps.ensayo) {
    log("Ensayo: no se llamó a Auth ni a Mailpit.");
    return 0;
  }

  const { llamar, mailpit } = cliente(g.config, deps.fetch ?? fetch);
  const noEsPrueba = (motivo) => {
    log(`FALLÓ guarda · ${motivo}`);
    log("No se pudo probar que esto es el entorno de prueba: no se escribió nada.");
    return 2;
  };

  // ── Guardas con red, antes de la primera escritura ──
  let direcciones = null;
  try {
    direcciones = await resolver("api-gw");
  } catch {
    direcciones = null;
  }
  if (!Array.isArray(direcciones) || direcciones.length !== 1) {
    return noEsPrueba(
      `api-gw no resuelve a exactamente una dirección (${Array.isArray(direcciones) ? direcciones.length : "no resuelve"}): ¿no es la red interna de prueba?`,
    );
  }
  log("PASÓ guarda · api-gw resuelve a una sola dirección");
  let alias = 0;
  for (const nombre of ["kong", "envoy"]) {
    let d = null;
    try {
      d = await resolver(nombre);
    } catch {
      d = null;
    }
    if (!Array.isArray(d) || d.length === 0) continue;
    if (d.length !== 1 || d[0] !== direcciones[0]) {
      return noEsPrueba(`el alias ${nombre} no resuelve a la misma dirección que api-gw`);
    }
    alias += 1;
  }
  if (alias === 0) return noEsPrueba("no resuelve kong ni envoy: no es la red interna del proyecto");
  log("PASÓ guarda · los alias de la red interna resuelven al mismo gateway");
  const info = await mailpit("GET", "/api/v1/info");
  if (info.status !== 200) return noEsPrueba(`Mailpit no responde /api/v1/info · status ${info.status}`);
  log("PASÓ guarda · Mailpit responde");
  const settings = await llamar("GET", "/auth/v1/settings", { clave: "anon" });
  if (!(settings.status === 200 && settings.body?.disable_signup === true)) {
    return noEsPrueba(`Auth no dice que el registro esté cerrado · status ${settings.status}`);
  }
  log("PASÓ guarda · el registro de Auth está cerrado");

  // ── Datos sintéticos de esta corrida ──
  const sufijo = aleatorio(4);
  const interna = `c-${aleatorio(16)}@${DOMINIO_INTERNO}`;
  const real = `${PREFIJO}${sufijo}-r@example.test`;
  const otro = `${PREFIJO}${sufijo}-o@example.test`;
  const control = `${PREFIJO}${sufijo}-c@example.test`;
  const creados = [];
  /** Anota la cuenta creada por su id, apenas se crea. */
  const anotar = (id, cual) => {
    if (!id) return;
    creados.push(id);
    log(`cuenta de prueba creada (${cual}) · id ${String(id).replace(/[^0-9A-Za-z-]/g, "").slice(0, 64)}`);
  };

  let fallo = false;
  const paso = (ok, nombre, r) => {
    if (!ok) fallo = true;
    const detalle = r ? ` · status ${r.status} · código ${r.codigo}` : "";
    log(`${ok ? "PASÓ" : "FALLÓ"} ${nombre}${detalle}`);
    return ok;
  };

  /**
   * Cuentas cuyo correo es EXACTAMENTE `correo`, buscando acotado (`filter` de
   * GoTrue) en vez de listar el Auth entero. Si Auth ignora el filtro y devuelve
   * cuentas que no lo contienen, no se sigue: `null` (no se sabe).
   */
  const buscar = async (filtro, coincide) => {
    const r = await llamar("GET", `/auth/v1/admin/users?filter=${encodeURIComponent(filtro)}&page=1&per_page=100`);
    if (r.status !== 200 || !Array.isArray(r.body?.users)) return null;
    if (r.body.users.length >= 100) return null;
    // Entradas nulas o sin correo no cuentan (ni para borrar ni para juzgar el filtro).
    const users = r.body.users.filter((u) => u && u.id && typeof u.email === "string" && u.email);
    const correos = users.map((u) => u.email.toLowerCase());
    if (correos.some((e) => !e.includes(filtro))) return null;
    return users.filter((_, i) => coincide(correos[i])).map((u) => u.id);
  };
  const conCorreo = (correo) => buscar(correo, (e) => e === correo);
  const restos = () => buscar(PREFIJO, (e) => CORREO_SINTETICO.test(e));

  const emailDe = async (id) => {
    const r = await llamar("GET", `/auth/v1/admin/users/${id}`);
    return r.status === 200 ? String(r.body?.email ?? "").toLowerCase() : null;
  };

  const cuantosEnMailpit = async (correo) => {
    const r = await mailpit("GET", `/api/v1/search?query=${encodeURIComponent(`to:"${correo}"`)}`);
    if (r.status !== 200 || !r.body) return null;
    const n = r.body.messages_count ?? r.body.count ?? r.body.messages?.length;
    return typeof n === "number" ? n : null;
  };

  let codigo = 1;
  try {
    codigo = await pasos();
  } catch {
    log("FALLÓ inesperado: la prueba se cortó a mitad (sin detalle, para no imprimir datos)");
    codigo = 1;
  }

  const limpio = await limpiar();
  log(`${limpio.ok ? "PASÓ" : "FALLÓ"} limpieza · ${limpio.borradas} cuenta(s) de prueba borrada(s)`);
  return codigo === 0 && limpio.ok && !fallo ? 0 : 1;

  async function pasos() {
    // 1. La cuenta con la dirección interna.
    const crear = await llamar("POST", "/auth/v1/admin/users", { cuerpo: { email: interna, email_confirm: true } });
    const idA = crear.body?.id;
    anotar(idA, "dirección interna");
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
    let refresh = verificar.body?.refresh_token;
    const access = verificar.body?.access_token;
    if (!paso(verificar.status === 200 && Boolean(access) && Boolean(refresh), "canjear el enlace y tener sesión", verificar)) {
      return 1;
    }

    // 3. Con el correo real, que todavía no está en Auth; y el control, en la
    //    misma ventana, con una cuenta nueva a la que no se le acuñó nada.
    const crearC = await llamar("POST", "/auth/v1/admin/users", { cuerpo: { email: control, email_confirm: true } });
    anotar(crearC.body?.id, "control");
    if (!paso((crearC.status === 200 || crearC.status === 201) && Boolean(crearC.body?.id), "crear la cuenta de control", crearC)) {
      return 1;
    }
    const otp = await llamar("POST", "/auth/v1/otp", { clave: "anon", cuerpo: { email: real, create_user: true } });
    paso(true, "pedir código con el correo real (se anota la respuesta)", otp);
    const recover = await llamar("POST", "/auth/v1/recover", { clave: "anon", cuerpo: { email: real } });
    paso(true, "pedir recuperación con el correo real (se anota la respuesta)", recover);
    const otpControl = await llamar("POST", "/auth/v1/otp", { clave: "anon", cuerpo: { email: control, create_user: false } });
    if (otpControl.status === 429) {
      paso(false, "control: Auth limitó la frecuencia de correo (429), no es un fallo de la regla; espera y vuelve a correr", otpControl);
      return 1;
    }
    paso(otpControl.status === 200, "control: pedir código para la cuenta de control", otpControl);

    let enControl = null;
    for (let t = 0; t < VENTANA_MS; t += PASO_MS) {
      await esperar(PASO_MS);
      enControl = await cuantosEnMailpit(control);
      if (typeof enControl === "number" && enControl > 0) break;
    }
    // Lo que tuvo para llegar al control, también lo tuvo para llegar al real.
    paso(enControl === 1, "control: a la cuenta de control le llegó exactamente un correo");
    paso((await cuantosEnMailpit(real)) === 0, "en la misma ventana no llegó ningún correo para el correo real");
    const conReal = await conCorreo(real);
    if (conReal) for (const id of conReal) if (!creados.includes(id)) anotar(id, "creada por Auth con el correo real");
    paso(Array.isArray(conReal) && conReal.length === 0, "Auth no creó ninguna cuenta con el correo real");
    paso((await emailDe(idA)) === interna, "la cuenta sigue con la dirección interna");

    // 4. Pasar la cuenta al correo real: la sesión sigue viva.
    const pasar = await llamar("PUT", `/auth/v1/admin/users/${idA}`, { cuerpo: { email: real, email_confirm: true } });
    paso(pasar.status === 200 && (await emailDe(idA)) === real, "pasar la cuenta al correo real", pasar);
    const yo = await llamar("GET", "/auth/v1/user", { clave: "anon", bearer: access });
    paso(yo.status === 200, "la sesión sigue válida después del cambio", yo);
    const renovar = await llamar("POST", "/auth/v1/token?grant_type=refresh_token", { clave: "anon", cuerpo: { refresh_token: refresh } });
    if (renovar.body?.refresh_token) refresh = renovar.body.refresh_token;
    paso(renovar.status === 200 && Boolean(renovar.body?.refresh_token), "la sesión se renueva después del cambio", renovar);

    // De vuelta a la dirección interna: la sesión sigue.
    const volver = await llamar("PUT", `/auth/v1/admin/users/${idA}`, { cuerpo: { email: interna, email_confirm: true } });
    paso(volver.status === 200 && (await emailDe(idA)) === interna, "devolver la cuenta a la dirección interna", volver);
    const renovar2 = await llamar("POST", "/auth/v1/token?grant_type=refresh_token", { clave: "anon", cuerpo: { refresh_token: refresh } });
    paso(renovar2.status === 200, "la sesión se renueva después de volver", renovar2);

    // 5. El correo ya es de otra cuenta.
    const crearB = await llamar("POST", "/auth/v1/admin/users", { cuerpo: { email: otro, email_confirm: true } });
    anotar(crearB.body?.id, "segunda cuenta");
    if (paso((crearB.status === 200 || crearB.status === 201) && Boolean(crearB.body?.id), "crear la segunda cuenta", crearB)) {
      const choque = await llamar("PUT", `/auth/v1/admin/users/${idA}`, { cuerpo: { email: otro, email_confirm: true } });
      const forma =
        choque.status === 422 && choque.codigo === "email_exists"
          ? "422 email_exists"
          : choque.status === 500 && choque.codigo === "23505"
            ? "500 23505"
            : null;
      paso(forma !== null, `el correo ocupado da un rechazo conocido (forma: ${forma ?? "desconocida"})`, choque);
      paso((await emailDe(idA)) === interna, "después del choque la cuenta sigue con la dirección interna");
    }
    return fallo ? 1 : 0;
  }

  /** Borra SOLO lo suyo, pase lo que pase. Tolera entradas nulas y fallos sueltos. */
  async function limpiar() {
    let ok = true;
    const porBorrar = new Set(creados.filter(Boolean));
    try {
      for (const correo of [real, otro, control]) {
        const ids = await conCorreo(correo);
        if (ids === null) ok = false;
        else for (const id of ids) porBorrar.add(id);
      }
      const viejos = await restos();
      if (viejos === null) ok = false;
      else for (const id of viejos) porBorrar.add(id);
    } catch {
      ok = false;
    }
    let borradas = 0;
    for (const id of porBorrar) {
      try {
        const r = await llamar("DELETE", `/auth/v1/admin/users/${id}`);
        if (r.status === 200 || r.status === 204) borradas += 1;
        else if (r.status !== 404) ok = false;
        const despues = await llamar("GET", `/auth/v1/admin/users/${id}`);
        if (despues.status !== 404) ok = false;
      } catch {
        ok = false;
      }
    }
    try {
      for (const correo of [real, otro, control]) {
        const ids = await conCorreo(correo);
        if (ids === null || ids.length > 0) ok = false;
      }
      for (const correo of [interna, real, otro, control]) {
        await mailpit("DELETE", `/api/v1/search?query=${encodeURIComponent(`to:"${correo}"`)}`);
      }
    } catch {
      ok = false;
    }
    return { ok, borradas };
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
