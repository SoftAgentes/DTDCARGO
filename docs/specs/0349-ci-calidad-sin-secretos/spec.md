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

## Aceptacion

- Pull requests y pushes a `main` disparan el mismo job de calidad.
- El token de GitHub queda limitado a `contents: read` y checkout no conserva
  credenciales.
- Las actions externas usan SHAs completos con la version humana documentada.
- ESLint, frontera RSC, TypeScript, Edge Functions, unitarios, docs, numeracion,
  constantes, componentes, gobernanza y build corren sin secretos.
- Una prueba de contrato falla si se elimina un gate, se agrega un secreto o se
  habilita un evento privilegiado.

## Fuera de alcance

- SQL/rebuild con Docker, Playwright E2E o consultas a Cloud.
- Deploy, branch protection o configuracion de required checks en GitHub.
- Aplicar migraciones o modificar datos/configuracion alojada.
