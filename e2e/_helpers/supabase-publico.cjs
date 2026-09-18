/**
 * e2e/_helpers/supabase-publico.cjs — SDD-0470.
 *
 * ¿El `next dev` que mide el e2e puede crear el cliente Supabase de `proxy.ts`?
 *
 * `proxy.ts` llama a `createServerClient(NEXT_PUBLIC_SUPABASE_URL!,
 * NEXT_PUBLIC_SUPABASE_ANON_KEY!)` en cada ruta de su `matcher` (/studio,
 * /back, /portal, /m/erp, /m/emp, /entrar y /registro). Sin esas dos
 * variables lanza «Your project's URL and Key are required» y la ruta responde
 * con la página de error del dev server. Las pruebas que dependen de esas
 * pantallas fallan, se reintentan y no miden nada del cambio.
 *
 * Esta es la ÚNICA detección. La usan los specs (vía `supabase.ts`) y
 * `scripts/verify.mjs`. Es CommonJS sin dependencias a propósito: el loader de
 * Playwright 1.60 compila un `.mjs` importado desde un spec como si fuera CJS,
 * y Node lo rechaza con «exports is not defined in ES module scope» (medido el
 * 2026-09-15). Un `.cjs` lo cargan igual Playwright (require) y el gate (import).
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const SUPABASE_PUBLIC_VARS = Object.freeze([
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
]);

/**
 * Los archivos que carga `next dev`, en su orden (`loadEnvConfig` de
 * @next/env 16.2.11 con dev=true). Mismas reglas que Next:
 * - una clave definida en el entorno del proceso gana, aunque esté vacía;
 * - si no, gana el primer archivo que la define;
 * - una ruta que no es un archivo se ignora (`!isFile()` → continue). En el
 *   checkout principal `.env.local` es un DIRECTORIO: cuenta como ausente.
 */
const ARCHIVOS_ENV_DEV = Object.freeze([
  ".env.development.local",
  ".env.local",
  ".env.development",
  ".env",
]);

/**
 * Con `NODE_ENV=test`, @next/env usa el modo `test` aunque sea `next dev`:
 * `next/dist/bin/next` conserva un NODE_ENV estándar heredado
 * (`process.env.NODE_ENV || defaultEnv`), y `loadEnvConfig` arma la lista
 * `.env.test.local`, `.env.test` y `.env`. En ese modo `.env.local` queda
 * EXCLUIDO a propósito.
 */
const ARCHIVOS_ENV_TEST = Object.freeze([".env.test.local", ".env.test", ".env"]);

/** La lista de `.env*` que cargará el `next dev` que herede `env`. */
function archivosEnvNextDev(env = process.env) {
  return env.NODE_ENV === "test" ? ARCHIVOS_ENV_TEST : ARCHIVOS_ENV_DEV;
}

/**
 * Prefijo del motivo de omisión. `scripts/verify-e2e.mjs` lo busca en el
 * reporte JSON de Playwright para contar las pruebas omitidas: un cambio acá
 * sin cambiar allá dejaría la omisión sin reportar, y hay una prueba del
 * harness que lo impide.
 */
const MARCA_SIN_SUPABASE = "SIN SUPABASE PÚBLICO";

/** Raíz del repositorio: donde corre `next dev` y donde Next busca los `.env*`. */
const RAIZ_REPO = path.resolve(__dirname, "..", "..");

// Línea de dotenv 16 (la que usa @next/env): `export` opcional, comillas
// simples, dobles o invertidas, valores multilínea entre comillas y comentarios.
const LINEA_DOTENV =
  /(?:^|^)\s*(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#.*)?(?:$|$)/gm;

/** Claves y valores de un `.env`, con la semántica de dotenv. Sin expansión de `$VAR`. */
function parsearEnv(texto) {
  const vars = {};
  let fuente = String(texto ?? "");
  if (fuente.charCodeAt(0) === 0xfeff) fuente = fuente.slice(1);
  fuente = fuente.replace(/\r\n?/g, "\n");
  for (const m of fuente.matchAll(LINEA_DOTENV)) {
    let valor = (m[2] ?? "").trim();
    const comilla = valor[0];
    valor = valor.replace(/^(['"`])([\s\S]*)\1$/gm, "$2");
    if (comilla === '"') valor = valor.replace(/\\n/g, "\n").replace(/\\r/g, "\r");
    vars[m[1]] = valor;
  }
  return vars;
}

/**
 * Lee un `.env*` como lo haría Next. `estado`:
 * - `ausente`: no existe;
 * - `archivo`: se leyó;
 * - `no-es-archivo`: existe pero es un directorio u otra cosa, y Next lo ignora;
 * - `ilegible`: existe y no se pudo leer, y Next también lo descarta.
 */
function leerArchivoEnv(ruta) {
  let st;
  try {
    st = fs.statSync(ruta);
  } catch (error) {
    return { estado: error?.code === "ENOENT" ? "ausente" : "ilegible", vars: {} };
  }
  if (!st.isFile()) return { estado: "no-es-archivo", vars: {} };
  try {
    return { estado: "archivo", vars: parsearEnv(fs.readFileSync(ruta, "utf8")) };
  } catch {
    return { estado: "ilegible", vars: {} };
  }
}

/**
 * ¿Tendrá el `next dev` de `raiz` las dos variables públicas de Supabase?
 *
 * Devuelve:
 * - `configurado`;
 * - `faltan`: las claves ausentes o vacías;
 * - `vacias`: clave → fuente que la definió vacía;
 * - `fuentes`: clave presente → «entorno» o nombre del archivo;
 * - `ignorados`: `.env*` presentes que Next no carga;
 * - `archivos`: la lista que se miró, según `NODE_ENV` (`archivosEnvNextDev`).
 *
 * Nunca devuelve valores: sólo nombres y fuentes.
 */
function detectarSupabasePublico({ env = process.env, raiz = RAIZ_REPO } = {}) {
  const lista = archivosEnvNextDev(env);
  const archivos = lista.map((nombre) => ({
    nombre,
    ...leerArchivoEnv(path.join(raiz, nombre)),
  }));
  const faltan = [];
  const vacias = {};
  const fuentes = {};
  for (const clave of SUPABASE_PUBLIC_VARS) {
    let valor;
    let fuente = null;
    if (env[clave] !== undefined) {
      valor = env[clave];
      fuente = "entorno";
    } else {
      const archivo = archivos.find((a) => a.vars[clave] !== undefined);
      if (archivo) {
        valor = archivo.vars[clave];
        fuente = archivo.nombre;
      }
    }
    if (String(valor ?? "").trim()) {
      fuentes[clave] = fuente;
    } else {
      faltan.push(clave);
      if (fuente) vacias[clave] = fuente;
    }
  }
  const ignorados = archivos
    .filter((a) => a.estado === "no-es-archivo" || a.estado === "ilegible")
    .map(({ nombre, estado }) => ({ nombre, estado }));
  return { configurado: faltan.length === 0, faltan, vacias, fuentes, ignorados, archivos: [...lista] };
}

/** El motivo visible de la omisión, o `null` si Supabase público está configurado. */
function motivoSinSupabase(deteccion) {
  if (deteccion.configurado) return null;
  const faltan = deteccion.faltan
    .map((clave) => (deteccion.vacias[clave] ? `${clave} (vacía en ${deteccion.vacias[clave]})` : clave))
    .join(", ");
  const ignorados = deteccion.ignorados.length
    ? `; se ignora ${deteccion.ignorados
        .map((i) => `${i.nombre} (${i.estado === "no-es-archivo" ? "no es un archivo" : "ilegible"})`)
        .join(", ")}`
    : "";
  return (
    `${MARCA_SIN_SUPABASE}: falta ${faltan} en el entorno y en ${(deteccion.archivos ?? ARCHIVOS_ENV_DEV).join(", ")}${ignorados}. ` +
    "proxy.ts no puede crear el cliente Supabase y esta prueba no mediría el cambio (SDD-0470)."
  );
}

const HOSTS_LOCALES = new Set(["localhost", "127.0.0.1", "[::1]", "0.0.0.0"]);

/**
 * ¿El destino es un servidor de ESTA máquina? Sólo ahí la configuración del
 * servidor sale de este entorno y de estos archivos. Un Preview o un destino
 * que no se puede leer conserva el comportamiento de siempre: no se omite nada.
 */
function destinoEsLocal(baseURL) {
  if (typeof baseURL !== "string" || !baseURL.trim()) return false;
  let host;
  try {
    host = new URL(baseURL).hostname.toLowerCase();
  } catch {
    return false;
  }
  return HOSTS_LOCALES.has(host) || host.endsWith(".localhost");
}

/** Motivo para omitir una prueba que necesita Supabase contra `baseURL`, o `null` si debe correr. */
function omisionSinSupabase({ env = process.env, raiz = RAIZ_REPO, baseURL } = {}) {
  if (!destinoEsLocal(baseURL)) return null;
  return motivoSinSupabase(detectarSupabasePublico({ env, raiz }));
}

// ── SDD-0479 · Supabase sintético deny-only ──────────────────────────────────

/**
 * Anon key del Supabase sintético. Es visible a propósito: no es un secreto,
 * no pertenece a ningún proyecto y el servidor deny-only la ignora.
 */
const ANON_KEY_SINTETICA = "e2e-supabase-sintetico-deny-only-no-es-un-secreto";

/** Única ruta del servidor deny-only que responde 200; Playwright la espera. */
const RUTA_SALUD_SINTETICO = "/__health";

/** Distancia entre el puerto de la app y el del deny-only cuando nadie lo fija. */
const DESFASE_PUERTO_SINTETICO = 10_000;

/**
 * Puerto del servidor deny-only. `E2E_SUPABASE_SINTETICO_PORT` gana (verify lo
 * fija después de comprobar que está libre); si no, el de la app ± 10000. Un
 * valor inválido, o igual al de la app, es un error: no se adivina otro.
 */
function puertoSupabaseSintetico({ env = process.env, puertoApp } = {}) {
  const fijado = String(env.E2E_SUPABASE_SINTETICO_PORT ?? "").trim();
  const puerto = fijado
    ? Number(fijado)
    : puertoApp + DESFASE_PUERTO_SINTETICO <= 65_535
      ? puertoApp + DESFASE_PUERTO_SINTETICO
      : puertoApp - DESFASE_PUERTO_SINTETICO;
  if (!Number.isInteger(puerto) || puerto < 1_024 || puerto > 65_535) {
    throw new Error("E2E_SUPABASE_SINTETICO_PORT debe ser un entero entre 1024 y 65535.");
  }
  if (puerto === puertoApp) {
    throw new Error("E2E_SUPABASE_SINTETICO_PORT debe ser distinto del puerto de la app.");
  }
  return puerto;
}

/**
 * ¿Qué Supabase público verá el `next dev` del e2e? Una sola decisión para
 * `playwright.config.ts`, para `requiereSupabase()` (vía la metadata de la
 * config) y para `scripts/verify.mjs`.
 *
 * `modo`:
 * - `remoto`: el destino no es local; su configuración es del servidor
 *   desplegado. No se toca nada (igual que en SDD-0470).
 * - `configurado`: el entorno o un `.env*` que carga Next ya define las dos
 *   variables. Se usa lo real y nunca se pisa.
 * - `parcial`: define una sola. Nunca se mezcla un valor real con uno
 *   sintético: las pruebas se omiten con el motivo de SDD-0470.
 * - `ausente`: faltan las dos, pero el `next dev` no lo levanta Playwright
 *   (un servidor reusado, cuya configuración no se controla) o es un branch
 *   efímero, que tiene su propio Supabase. Omisión con motivo, como en 0470.
 * - `sintetico`: faltan las dos, el destino es local, Playwright levanta su
 *   propio `next dev` y no es un branch efímero. Ese `next dev` recibe la URL
 *   de un servidor deny-only local y `ANON_KEY_SINTETICA`, y las pruebas que
 *   lo necesitan corren en vez de omitirse.
 *
 * Nunca devuelve valores reales: la detección sólo lleva nombres y fuentes, y
 * en modo `sintetico` los únicos valores son los sintéticos.
 */
function planSupabaseE2E({ env = process.env, raiz = RAIZ_REPO, baseURL, levantaServidor, puertoApp } = {}) {
  const deteccion = detectarSupabasePublico({ env, raiz });
  if (!destinoEsLocal(baseURL)) return { modo: "remoto", deteccion };
  if (deteccion.configurado) return { modo: "configurado", deteccion };
  if (deteccion.faltan.length < SUPABASE_PUBLIC_VARS.length) return { modo: "parcial", deteccion };
  if (!levantaServidor || String(env.E2E_ENVIRONMENT_KIND ?? "").trim() === "ephemeral") {
    return { modo: "ausente", deteccion };
  }
  const puerto = puertoSupabaseSintetico({ env, puertoApp });
  const url = `http://127.0.0.1:${puerto}`;
  return {
    modo: "sintetico",
    deteccion,
    puerto,
    url,
    entorno: { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_KEY_SINTETICA },
  };
}

/**
 * La detección que ve el `next dev` una vez aplicado el plan: en modo
 * `sintetico` las dos variables existen (fuente «sintético»); en los demás, la
 * detección tal cual. Es la que el gate usa para decidir la cobertura parcial.
 */
function deteccionEfectiva(plan) {
  if (plan.modo !== "sintetico") return plan.deteccion;
  return {
    ...plan.deteccion,
    configurado: true,
    faltan: [],
    vacias: {},
    fuentes: Object.fromEntries(SUPABASE_PUBLIC_VARS.map((clave) => [clave, "sintético"])),
  };
}

// Una asignación por nombre: así Node expone cada export con nombre al `import`
// de un módulo ESM (cjs-module-lexer).
exports.SUPABASE_PUBLIC_VARS = SUPABASE_PUBLIC_VARS;
exports.ARCHIVOS_ENV_DEV = ARCHIVOS_ENV_DEV;
exports.ARCHIVOS_ENV_TEST = ARCHIVOS_ENV_TEST;
exports.archivosEnvNextDev = archivosEnvNextDev;
exports.MARCA_SIN_SUPABASE = MARCA_SIN_SUPABASE;
exports.RAIZ_REPO = RAIZ_REPO;
exports.parsearEnv = parsearEnv;
exports.leerArchivoEnv = leerArchivoEnv;
exports.detectarSupabasePublico = detectarSupabasePublico;
exports.motivoSinSupabase = motivoSinSupabase;
exports.destinoEsLocal = destinoEsLocal;
exports.omisionSinSupabase = omisionSinSupabase;
exports.ANON_KEY_SINTETICA = ANON_KEY_SINTETICA;
exports.RUTA_SALUD_SINTETICO = RUTA_SALUD_SINTETICO;
exports.puertoSupabaseSintetico = puertoSupabaseSintetico;
exports.planSupabaseE2E = planSupabaseE2E;
exports.deteccionEfectiva = deteccionEfectiva;
