---
sdd: "0329"
title: "Aislar la caché de Next usada por el gate E2E"
status: done
author: "Codex"
created: 2026-09-02
updated: 2026-09-02
supersedes: null
superseded_by: null
related: ["0277", "0280", "0321"]
confidencialidad: interno
---

# SDD-0329 · Aislar la caché de Next usada por el gate E2E

## Problema

El build de verificación ya usa `.next-verify`, pero el E2E iniciado por
`verify.mjs` todavía ejecutaba `next dev` contra `.next`. Después de corridas
consecutivas, dos casos de `/acceso` recibieron un error interno de Webpack
(`__webpack_require__.C`) antes de cargar la aplicación; ambos pasaron al
reintento y también pasaron 2/2 al borrar manualmente `.next` y arrancar en frío.

El resultado funcional era verde, pero el gate seguía mezclando su salida con
la caché normal del desarrollador y podía fabricar flakiness ajena al cambio.

## Decisión

1. El E2E ejecutado por `verify.mjs` usa el `distDir` exclusivo
   `.next-verify-e2e` mediante el mismo override soportado por `next.config.ts`.
2. Un wrapper elimina únicamente esa ruta conocida antes y después de la suite.
3. El wrapper conserva y restaura `tsconfig.json` byte por byte si Next añade la
   carpeta temporal a `include`.
4. La caché normal `.next` no se elimina ni modifica.
5. Los fallos del wrapper o de limpieza usan exit 2 y no pueden confundirse con
   el teardown conocido de WebKit que Playwright reporta con exit 1.
6. Si el gate reutiliza un dev server ya activo, mantiene su comportamiento:
   no inicia otro servidor ni interviene su caché.

## Criterios de aceptación

- Un residuo previo de `.next-verify-e2e` desaparece antes de arrancar.
- `.next` sobrevive intacta al preflight aislado.
- `tsconfig.json` recupera exactamente sus bytes originales.
- La salida aislada desaparece al terminar.
- Los contratos focales, typecheck, lint y una corrida E2E iniciada por el
  wrapper pasan localmente.

## Fuera de alcance

- Borrar la caché de un servidor de desarrollo administrado por el usuario.
- Cambiar reintentos, workers, timeouts o casos funcionales de Playwright.
- Modificar Cloud, datos, despliegues o Producción.
