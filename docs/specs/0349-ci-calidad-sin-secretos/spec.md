---
sdd: 0349
title: Automatizar calidad local sin secretos en GitHub Actions
status: done
author: Codex
created: 2026-09-02
updated: 2026-09-02
supersedes: null
superseded_by: null
related:
  - SDD-0280
  - SDD-0320
  - SDD-0321
confidencialidad: interno
---

# SDD-0349 — CI de calidad sin secretos

## Estado real

El repositorio no tenia workflows de GitHub Actions. Vercel construia y
desplegaba, pero lint, TypeScript, unitarios, documentacion y gobernanza
dependian de que cada ventana ejecutara el gate local antes de publicar.

## Decision

1. Ejecutar CI en cada pull request y push a `main`, con disparo manual
   adicional.
2. Usar Node 24 y pnpm 11.19.0, igual que el contrato versionado del repo, e
   instalar con lockfile congelado.
3. Instalar Deno 2 de forma explicita para que `edge:check` no pueda degradar a
   `SKIP` por falta del runtime.
4. Fijar cada action externa a un SHA completo, mantener permisos de solo
   lectura y no persistir credenciales de checkout.
5. Ejecutar gates locales sin secretos y terminar con el build de produccion y
   una comprobacion de arbol reproducible.
6. Fijar `NODE_OPTIONS=--max-old-space-size=4096` únicamente en TypeScript y
   build. El primer runner alojado agotó el heap implícito de unos 2 GiB con
   exit 134 antes de terminar `tsc`; no fue un diagnóstico de tipos. El límite
   no reserva 4 GiB y no se extiende a todos los procesos/workers del job.

## Gobernanza

- `cumplimiento`: el workflow no recibe secretos ni usa eventos privilegiados.
- `cumplimiento`: el lockfile es obligatorio y las actions quedan fijadas por
  SHA completo.
- `cumplimiento`: el build usa el wrapper aislado que restaura `tsconfig.json`.
- `no aplica`: UI, datos personales, migraciones, Cloud o Produccion.

## Allowlist exacta

- `.github/workflows/quality.yml`
- `scripts/__tests__/ci-workflow-contract.test.mjs`
- `docs/specs/0349-ci-calidad-sin-secretos/spec.md`
- `docs/specs/README.md`
- `docs/audits/2026-09-02-codex-arranque-checklist.md`
- `.agents/handoffs/2026-09-02-ci-calidad-close.md`
- `.agents/handoffs/2026-09-02-saneamiento-integral-close.md`
- `docs/audits/2026-09-02-codex-publicacion-y-preflight.md`

## Aceptacion

- Pull requests y pushes a `main` disparan el mismo job de calidad.
- El token de GitHub queda limitado a `contents: read` y checkout no conserva
  credenciales.
- Las actions externas usan SHAs completos con la version humana documentada.
- ESLint, frontera RSC, TypeScript, Edge Functions, unitarios, docs, numeracion,
  constantes, componentes, gobernanza y build corren sin secretos.
- Una prueba de contrato falla si se elimina un gate, se agrega un secreto o se
  habilita un evento privilegiado.
- El contrato exige el heap explícito sólo en TypeScript/build y rechaza
  `continue-on-error` o `ignoreBuildErrors`.

## Primer CI alojado y corrección de memoria

El [run 33659251763](https://github.com/hailuwaycom-sketch/DTDCARGO/actions/runs/33659251763)
del PR #21 instaló dependencias, pasó ESLint/frontera RSC y falló en TypeScript:
`JavaScript heap out of memory`, exit 134, cerca de 2.040 MiB. Los pasos
posteriores no se ejecutaron; no se presenta ese resultado como verde.

La regresión nueva falló antes del ajuste (1 fallo / 5 pases) y pasó después
(6/6). El arreglo mantiene todos los comandos, versiones, timeout y permisos.
`tsc --noEmit --incremental false --extendedDiagnostics`, con old-space 4096,
pasó: 3.889 archivos, 2.898.635 K de memoria y 48,84 s. El consumo excede el
límite implícito con el que falló CI. El build aislado con el mismo ajuste pasó
158 páginas y restauró `tsconfig.json`. Falta confirmar una nueva corrida real
del PR; no se transforma el pase local en evidencia alojada.

Referencias: [límite V8 en Node 24](https://r2.nodejs.org/dist/v24.8.0/docs/api/cli.html#--max-old-space-sizesize-in-mib)
y [runner estándar privado](https://docs.github.com/en/actions/reference/runners/github-hosted-runners#standard-github-hosted-runners-for-private-repositories).

## Fuera de alcance

- SQL/rebuild con Docker, Playwright E2E o consultas a Cloud.
- Deploy, branch protection o configuracion de required checks en GitHub.
- Aplicar migraciones o modificar datos/configuracion alojada.
