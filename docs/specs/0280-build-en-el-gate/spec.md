---
sdd: "0280"
title: "El gate construye la app: 14/14 en verde ya no significa que compile"
status: in-progress
author: "Sam (founder) + Claude Code"
created: 2026-08-23
updated: 2026-08-23
supersedes: null
superseded_by: null
related: ["0271", "0277"]
confidencialidad: interno
---

# DTD-0280 — El gate construye la app

## 1. El hueco

`node scripts/verify.mjs` cerraba **"TODO VERDE ✓ (14/14 pasos medidos)"** sin
haber construido nunca la app. Ninguno de los 14 pasos era `build`.

`tsc --noEmit` y el e2e **no** lo cubren: el primero sólo tipa, y el segundo corre
contra `next dev`. Ninguno ejercita el prerender de rutas estáticas, la
recolección de páginas ni la resolución de `next/font`. **Un build roto pasaba el
gate y sólo aparecía en Vercel, después del push** (se descubrió el 2026-08-19
con SDD-0271: 14/14 verde, push aceptado, y producción sirviendo el commit
anterior media hora después — sin un `pnpm build` a mano no había forma de
separar "build roto" de "Vercel no desplegó").

## 2. Qué se agrega

Un paso 15, **`build`**, al final del gate — por lo mismo que el e2e va último:
es el más lento (~110 s) y no tiene sentido construir si el lint ya rompió.

Corre lo mismo que Vercel: `next build` **y** el `postbuild` (`norte.mjs`). Si
cualquiera de los dos falla, Vercel también fallaría.

**No degrada con gracia.** Un build roto es rojo, punto. Medido el 2026-08-23:
el build cierra en verde **sin `.env.local`** (76 s), así que un worktree sin
credenciales no genera un rojo falso.

## 3. Por qué construye en `.next-verify` y no en `.next`

`next build` y `next dev` comparten carpeta. Un residuo ahí **ya costó un rojo
falso**: typecheck reventando con TS2307 contra `.next/dev/types/` de un dev
server viejo (SDD-0277). Con carpeta propia, el `.next` del dev queda intacto.

El `distDir` sale de `VERIFY_DIST_DIR` en `next.config.ts`, con default `.next`.
**Vercel no define esa variable**, así que su build no cambia.

## 4. Los dos rastros que Next deja, y que el paso deshace

Medidos, no supuestos:

1. **Inyecta el `distDir` en los `include` de `tsconfig.json`** — y lo reescribe
   con **CRLF**, que en este repo es un problema aparte. El paso guarda el
   archivo en bytes antes y lo restaura si cambió (comparar bytes, no strings:
   un compare normalizado dejaría pasar justo el cambio de fin de línea).
2. **Deja la carpeta de salida.** Se borra siempre, también si el build falla.
   Si sobreviviera, el `typecheck` de la corrida SIGUIENTE la miraría —va antes
   que este paso— y podría reventar contra tipos viejos: exactamente la trampa
   que este aislamiento viene a cerrar.

## 5. Evidencia — validado por mutación

Se le metió al repo un error que **`tsc` no ve y el build sí**: un `export const`
en un archivo `"use server"` (`app/entrar/actions.ts`).

| Paso | Resultado |
|---|---|
| `typecheck` | **exit 0** — ciego, como se esperaba |
| `build` (el paso nuevo) | **exit 1** · *"Only async functions are allowed to be exported in a `use server` file"* |

Sin este paso, ese commit habría salido del gate en verde y roto el deploy.
Tras el fallo se verificó que `.next-verify` quedó borrado igual.

## 6. Lo que esta spec NO cierra

- **El gate pasa de ~7 a ~9 min.** Es el costo de construir de verdad; no se
  buscó paralelizarlo.
- **No mide el `ignoreCommand` de Vercel.** Que el build compile no dice que
  Vercel vaya a desplegarlo — eso sigue siendo el predicado de `HEAD^ HEAD`, un
  problema distinto.
