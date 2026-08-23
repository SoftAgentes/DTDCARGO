#!/usr/bin/env node
/**
 * Paso `build` del gate (SDD-0280) — corre el build de PRODUCCIÓN.
 *
 * Por qué hace falta: `tsc --noEmit` y el e2e (que corre contra `next dev`) NO
 * son un build de producción. No ejercitan el prerender de rutas estáticas, la
 * recolección de páginas ni la resolución de `next/font`. Hasta hoy el gate
 * cerraba "TODO VERDE" sin haber construido nunca: un build roto sólo aparecía
 * en Vercel, después del push (medido el 2026-08-19, SDD-0271).
 *
 * Replica lo que corre Vercel: `next build` + el `postbuild` (`norte.mjs`). Si
 * cualquiera de los dos falla, Vercel también fallaría.
 *
 * ⚠️ **Construye en `.next-verify`, no en `.next`.** `next build` y `next dev`
 * comparten carpeta, y un residuo ahí ya costó un rojo falso: typecheck
 * reventando con TS2307 contra `.next/dev/types/` de un dev server viejo
 * (SDD-0277). Con carpeta propia, el `.next` del dev queda intacto.
 *
 * ⚠️ **Y deshace los dos rastros que deja Next**, que si no ensucian el árbol:
 *   1. Inyecta el `distDir` en los `include` de `tsconfig.json` — y lo reescribe
 *      con CRLF, que en este repo es un problema conocido aparte.
 *   2. Deja la carpeta de salida. Se borra siempre, también si el build falla:
 *      si sobreviviera, el `typecheck` de la corrida SIGUIENTE la miraría (va
 *      antes que este paso) y podría reventar contra tipos viejos — exactamente
 *      la trampa del SDD-0277 que este aislamiento viene a cerrar.
 *
 * No necesita credenciales: medido el 2026-08-23, el build cierra en verde sin
 * `.env.local` (76 s). Por eso NO degrada con gracia — un build roto es rojo.
 */

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import path from "node:path";
import { podarTiposDeRuta, notaDePoda } from "./prune-next-types.mjs";

const ROOT = process.cwd();
const DIST = ".next-verify";
const TSCONFIG = path.join(ROOT, "tsconfig.json");

/** Contenido EXACTO del tsconfig antes de tocar nada, bytes incluidos. */
const tsconfigAntes = existsSync(TSCONFIG)
  ? readFileSync(TSCONFIG)
  : null;

function limpiar() {
  // El tsconfig se compara por bytes: así se detecta también el cambio de
  // fin de línea, que un compare de strings normalizado dejaría pasar.
  if (tsconfigAntes && existsSync(TSCONFIG)) {
    const ahora = readFileSync(TSCONFIG);
    if (!ahora.equals(tsconfigAntes)) {
      writeFileSync(TSCONFIG, tsconfigAntes);
      console.log("[build] tsconfig.json restaurado (Next le inyectó el distDir)");
    }
  }
  rmSync(path.join(ROOT, DIST), { recursive: true, force: true });
}

function correr(argv, etiqueta) {
  const r = spawnSync(process.execPath, argv, {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, VERIFY_DIST_DIR: DIST },
  });
  if (r.error) {
    console.error(`[build] no se pudo ejecutar ${etiqueta}:`, r.error.message);
    return 1;
  }
  return r.status ?? 1;
}

// `next build` typechequea con el MISMO `tsconfig.json`, que apunta a
// `.next/**/types`. O sea: aislar la SALIDA en `.next-verify` (SDD-0280) no
// alcanzaba — la ENTRADA seguía siendo el árbol de tipos del dev, y si tenía
// una ruta borrada el build reventaba con TS2307 por código sano. Ver
// scripts/prune-next-types.mjs.
{
  const nota = notaDePoda(podarTiposDeRuta({ raiz: ROOT }));
  if (nota) console.log(`[build] ${nota}`);
}

let code = correr(["node_modules/next/dist/bin/next", "build"], "next build");

// El postbuild sólo corre si el build pasó — es lo que hace `pnpm build`.
if (code === 0) {
  code = correr(["scripts/norte.mjs"], "postbuild (norte.mjs)");
  if (code !== 0) console.error("[build] el postbuild falló — Vercel también fallaría");
}

limpiar();

if (code === 0) console.log("[build] build de producción OK");
process.exit(code);
