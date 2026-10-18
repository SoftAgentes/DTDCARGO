/**
 * Entorno de ejecución de la app, sin depender de Vercel (SDD-0505).
 *
 * Hasta esta spec, saber "dónde estoy corriendo" era leer `VERCEL_ENV`,
 * `VERCEL_URL` y `VERCEL_GIT_COMMIT_SHA` directo de `process.env`. En Docker
 * sobre el servidor propio ninguna de esas variables existe, y el efecto era
 * el peor posible: el candado del bot de deploy (`deployActions.ts`) leía
 * "sin VERCEL_ENV ⇒ local" y quedaba ABIERTO en producción (M1 de la
 * auditoría 2026-07-31). Este módulo es la única fuente de verdad y FALLA
 * CERRADO: cuando no hay señal explícita, `NODE_ENV=production` significa
 * producción, nunca local.
 *
 * Orden de resolución de `resolveAppEnv`:
 *   1. `APP_ENV` (lo fija el `.env` del servidor) — fuente primaria. Un valor
 *      desconocido (una errata como `prod`) NO cae a local ni a preview: se
 *      trata como `production`, que es el entorno con más candados.
 *      Excepción de fallo cerrado: `APP_ENV=local` NO gana cuando `VERCEL_ENV`
 *      está definida. Vercel la fija en todos sus despliegues, así que un
 *      `APP_ENV=local` puesto por error en el proyecto de Vercel abriría en
 *      producción lo que solo vale en local (hasta la SDD-0551, el bot de
 *      deploy); en ese caso se ignora y decide `VERCEL_ENV`.
 *      `production`/`staging`/`preview` explícitos sí ganan sobre `VERCEL_ENV`.
 *   2. `VERCEL_ENV` — fallback mientras el despliegue siga en Vercel.
 *      `production` ⇒ production; cualquier otro valor (`preview`, y también
 *      `development` de `vercel dev`, que este repo no usa) ⇒ preview. Nunca
 *      local: conserva el candado histórico "si hay VERCEL_ENV, no es local".
 *   3. Sin ninguna de las dos: `NODE_ENV=production` ⇒ production (fallo
 *      cerrado); `development`/`test`/vacío ⇒ local. La comparación ignora
 *      mayúsculas por la misma razón: `PRODUCTION` tampoco puede caer a local.
 *
 * Puro a propósito: recibe el `env` como parámetro (por defecto
 * `process.env`) para que las pruebas no tengan que mutar el entorno global,
 * y no importa nada de Next para poder usarse también desde `next.config.ts`.
 */

export type AppEnv = "production" | "staging" | "preview" | "local";

/** Cualquier bolsa de variables de entorno; `process.env` cumple la forma. */
export type EnvSource = Readonly<Record<string, string | undefined>>;

const APP_ENVS: ReadonlySet<string> = new Set<AppEnv>([
  "production",
  "staging",
  "preview",
  "local",
]);

/** `undefined`, `""` y espacios cuentan como "no definida" (Compose pasa `VAR=` como cadena vacía). */
function nonEmpty(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function resolveAppEnv(env: EnvSource = process.env): AppEnv {
  const declared = nonEmpty(env.APP_ENV)?.toLowerCase();
  const vercel = nonEmpty(env.VERCEL_ENV)?.toLowerCase();
  if (declared) {
    if (!APP_ENVS.has(declared)) return "production";
    // `local` solo vale fuera de Vercel; adentro lo decide `VERCEL_ENV` (ver cabecera).
    if (declared !== "local" || !vercel) return declared as AppEnv;
  }
  if (vercel) {
    return vercel === "production" ? "production" : "preview";
  }
  return nonEmpty(env.NODE_ENV)?.toLowerCase() === "production" ? "production" : "local";
}

/**
 * `true` solo cuando el runtime es la máquina de quien desarrolla (`pnpm dev`,
 * Vitest).
 *
 * Lo usaba el candado del bot de deploy del Studio, retirado en la SDD-0551.
 * Hoy no lo llama ningún camino de la app; se conserva como primitiva del
 * módulo, con sus pruebas de fallo cerrado. No sirve para reabrir un camino que
 * ejecute git: eso lo prohíbe `__tests__/sin-git-desde-la-app.test.ts`, en
 * local y en el servidor.
 */
export function isLocalRuntime(env: EnvSource = process.env): boolean {
  return resolveAppEnv(env) === "local";
}

/**
 * SHA del build que está corriendo. `NEXT_PUBLIC_BUILD_SHA` la inyecta el
 * Dockerfile como build arg (y Vercel la puede definir a mano); si falta, el
 * `VERCEL_GIT_COMMIT_SHA` automático de Vercel. Una cadena vacía (build arg
 * sin valor) cuenta como ausente para no mostrar un SHA de cero caracteres.
 */
export function resolveBuildSha(env: EnvSource = process.env): string | null {
  return (
    nonEmpty(env.NEXT_PUBLIC_BUILD_SHA) ??
    nonEmpty(env.VERCEL_GIT_COMMIT_SHA) ??
    null
  );
}

/**
 * URL pública del despliegue, con esquema y sin barra final. `APP_URL` gana;
 * `VERCEL_URL` (que Vercel entrega sin esquema) se completa con `https://`.
 * `null` cuando no hay ninguna o cuando el valor no es una URL http(s) válida
 * (un `APP_URL=ftp://x` no se convierte en `https://ftp://x`: el resultado
 * termina como enlace de baja en un correo, mejor ninguno que uno roto). El
 * caller decide su canónica (por ejemplo `NEXT_PUBLIC_SITE_URL`).
 */
export function resolveDeploymentUrl(env: EnvSource = process.env): string | null {
  const appUrl = nonEmpty(env.APP_URL);
  if (appUrl) return withScheme(appUrl);
  const vercelUrl = nonEmpty(env.VERCEL_URL);
  if (vercelUrl) return withScheme(vercelUrl.replace(/^https?:\/\//i, ""));
  return null;
}

function withScheme(value: string): string | null {
  // Sin esquema (`host`, `host:puerto`) se asume https, que es lo que hace
  // Vercel con `VERCEL_URL`. Con esquema, solo http(s): `URL` acepta `ftp:` o
  // `javascript:` y acá no sirven. Tampoco credenciales en la URL: un
  // `mailto:x@y` sin `//` se volvería `https://mailto:x@y`, que `URL` acepta.
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  return candidate.replace(/\/+$/, "");
}
