#!/usr/bin/env node
/**
 * scripts/check-edge-functions.mjs — chequeo estático de las Edge Functions (Deno).
 *
 * POR QUÉ EXISTE: hasta hoy `supabase/functions/**` NO lo miraba NADIE.
 *   · `tsconfig.json` las tiene en `exclude` → `pnpm typecheck` pasa de largo.
 *   · `verify.mjs` no tenía ningún paso que las tocara.
 *   · Vitest sólo ejecuta los módulos puros de `_shared/`, y **transpila sin
 *     chequear tipos** — un error de tipos ahí sale verde.
 * O sea: el código que escribe a Kommo (`kommo-writeback`, LIVE con dry-run
 * apagado) y el que **borra filas del espejo** (`kommo-sync`, que poda embudos y
 * etapas) viajaba a producción sin una sola verificación estática. Este paso
 * cierra ese hueco.
 *
 * QUÉ CHEQUEA: las 4 entradas `supabase/functions/<fn>/index.ts`. Deno sigue el
 * grafo de imports, así que de rebote cubre `kommo-sync/{sync,kommo-client,types}.ts`
 * y los 5 módulos de `_shared/` (todos son alcanzables desde alguna entrada).
 *
 * QUÉ **NO** CHEQUEA (a conciencia): `_shared/__tests__/*.test.ts`. Son tests de
 * Vitest y sus imports van sin extensión (`from "../kommo-mapping"`), que es
 * ilegal en Deno. No los alcanza ninguna entrada, así que quedan fuera. Vitest
 * los ejecuta, pero tampoco les chequea tipos. Hueco conocido y acotado.
 *
 * CÓMO CONSIGUE DENO: si hay `deno` en el PATH lo usa; si no, `npx --yes deno@2`
 * (queda en la caché de npm; no instala nada permanente ni toca package.json).
 * Se puede forzar con `VERIFY_DENO_BIN=/ruta/a/deno`.
 *
 * Y EN CI: hoy NO hay CI. `.github` sólo tiene una plantilla de issue, y Vercel
 * únicamente construye y despliega — nadie corre `verify.mjs` fuera de la
 * máquina de cada ventana. Por eso el camino por defecto es npx: funciona en
 * cualquier máquina que ya tenga Node (requisito para correr el gate) sin pedir
 * una instalación previa. ⚠️ Si algún día SE agrega CI: instalar Deno de verdad
 * ahí (`denoland/setup-deno`) — este script lo prefiere sobre npx — porque en un
 * runner sin red el SKIP taparía el chequeo en silencio, que es justo el modo de
 * falla que este paso existe para eliminar.
 *
 * DOS BANDERAS QUE IMPORTAN, y por qué:
 *   · `--no-lock`          → sin esto Deno deja un `deno.lock` en la RAÍZ del
 *                            repo, que nadie versiona ni quiere.
 *   · `--node-modules-dir=none` → sin esto Deno ve el `package.json` de la raíz,
 *                            se cree un proyecto Node y baja el árbol ENTERO de
 *                            dependencias a `node_modules/.deno` de cada
 *                            worktree (42 s la primera vez, y ~38 worktrees).
 *                            Con `none` resuelve `jsr:@supabase/supabase-js@2`
 *                            desde la caché global de Deno (DENO_DIR),
 *                            compartida entre worktrees: ~7 s en frío, ~2 s en
 *                            caliente, y cero basura en el árbol del repo.
 *
 * DEGRADA CON GRACIA, igual que `e2e`, `sql-tests` y `migrations-applied`: si no
 * se puede conseguir Deno (sin red y sin caché) imprime SKIP y sale 0.
 *
 * Pero el SKIP está ACOTADO A PROPÓSITO — un paso que se omite solo, en silencio
 * y para siempre no verifica nada. Cuando `deno check` sale ≠0 NO se asume nada:
 * se prueba `deno --version` en ese momento y el resultado decide. Arranca →
 * el ≠0 era un error de tipos de verdad → **ROJO**. No arranca → nunca hubo
 * chequeo → **SKIP**. Las dos causas jamás se confunden, que es justo el modo de
 * falla que este paso existe para eliminar. `VERIFY_SKIP_EDGE=1` lo omite a
 * pedido (probado: las tres ramas — verde, rojo y skip — se disparan).
 *
 * Uso:  node scripts/check-edge-functions.mjs
 * Exit: 0 = verde (o SKIP) · 1 = al menos una función no compila.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const C = { green: "\x1b[32m", red: "\x1b[31m", dim: "\x1b[2m", yellow: "\x1b[33m", nc: "\x1b[0m" };

const FUNCTIONS_DIR = path.resolve(process.cwd(), "supabase/functions");

function skip(reason) {
  console.log(`${C.yellow}[SKIP]${C.nc} edge-functions: ${reason}`);
  process.exit(0);
}

// En Windows `npx` es `npx.cmd`: spawnSync no lo resuelve sin shell. Y con
// shell, una ruta con espacios (el típico `C:\Program Files\deno.exe` de
// VERIFY_DENO_BIN) se parte en dos argumentos → hay que citarla a mano.
const needsShell = process.platform === "win32";
function run(cmd, args, opts = {}) {
  const bin = needsShell && /\s/.test(cmd) ? `"${cmd}"` : cmd;
  return spawnSync(bin, args, { encoding: "utf8", shell: needsShell, ...opts });
}

if (process.env.VERIFY_SKIP_EDGE === "1") skip("VERIFY_SKIP_EDGE=1 (omitido a pedido)");
if (!fs.existsSync(FUNCTIONS_DIR)) skip("no hay supabase/functions/");

// Entradas = supabase/functions/<fn>/index.ts. `_shared` no tiene index.ts (y no
// es una función desplegable): entra por el grafo de imports, no como entrada.
const entries = fs
  .readdirSync(FUNCTIONS_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith("_") && !d.name.startsWith("."))
  .map((d) => `supabase/functions/${d.name}/index.ts`)
  .filter((rel) => fs.existsSync(path.resolve(process.cwd(), rel)))
  .sort();

if (entries.length === 0) skip("ninguna carpeta de supabase/functions/ tiene index.ts");

// ── ¿Con qué Deno? ────────────────────────────────────────────────────────────
// Un binario LOCAL (VERIFY_DENO_BIN / PATH) se prueba antes de usarlo: `--version` es
// instantáneo y, si no existe, falla al toque. `npx` NO se prueba antes — cada
// invocación de npx en Windows cuesta ~10 s, y hacerlo dos veces duplicaría el
// paso en el camino feliz. Se usa directo y, SÓLO si el check falla, se prueba
// después (ver `deno` más abajo) para distinguir "no conseguí Deno" (→ SKIP) de
// "el código tiene un error de tipos" (→ ROJO). Nunca se confunden.
const local = [];
if (process.env.VERIFY_DENO_BIN) local.push({ cmd: process.env.VERIFY_DENO_BIN, pre: [], label: "VERIFY_DENO_BIN" });
local.push({ cmd: "deno", pre: [], label: "deno del PATH" });

let runner = null;
for (const c of local) {
  const probe = run(c.cmd, [...c.pre, "--version"], { timeout: 30_000 });
  if (probe.status === 0) {
    const v = (probe.stdout || "").split("\n").find((l) => l.startsWith("deno ")) ?? "deno ?";
    runner = { ...c, version: v.trim() };
    break;
  }
}
// Sin Deno local → npx lo baja a la caché de npm (~40 MB la PRIMERA vez).
runner ??= { cmd: "npx", pre: ["--yes", "deno@2"], label: "npx deno@2", version: "deno 2.x" };

console.log(
  `${C.dim}   ${entries.length} función(es) · ${runner.version} vía ${runner.label}${C.nc}`,
);

// ── El chequeo ────────────────────────────────────────────────────────────────
// Una sola invocación con las 4 entradas: Deno comparte el grafo, así que sale
// ~4x más rápido que llamarlo una vez por función, y los errores igual vienen
// con `archivo:línea`. `stdio: inherit` → la salida se ve tal cual, en vivo.
const r = run(runner.cmd, [...runner.pre, "check", "--no-lock", "--node-modules-dir=none", ...entries], {
  stdio: "inherit",
  encoding: undefined,
  timeout: 600_000,
});

if (r.status === 0) {
  console.log(`${C.green}[OK]${C.nc}   edge-functions: ${entries.length} función(es) compilan`);
  process.exit(0);
}

// Falló. ¿Es un error de tipos, o es que ni siquiera arrancó Deno? Ahora sí vale
// la pena el probe: sólo se paga cuando algo ya salió mal.
const post = run(runner.cmd, [...runner.pre, "--version"], { timeout: 300_000 });
if (post.status !== 0) {
  skip(
    `no se pudo obtener Deno vía ${runner.label} ` +
      `(${post.error?.code ?? `exit ${post.status ?? post.signal}`}) → ` +
      `instala Deno, o corre el gate con red la primera vez. No bloquea el gate.`,
  );
}

console.log(
  `${C.red}[FAIL]${C.nc} edge-functions: \`deno check\` salió ${r.status ?? `señal ${r.signal}`} → ` +
    `hay un error de tipos en supabase/functions/`,
);
process.exit(1);
