# Cierre técnico · SDD-0349 CI de calidad sin secretos

Fecha: 2026-09-02

Rol: worker
Estado: LISTO PARA PUBLICAR · WORKFLOW TODAVIA NO ACTIVO EN GITHUB

## Identidad Git

- Repositorio: `https://github.com/hailuwaycom-sketch/DTDCARGO.git`
- Worktree:
  `C:\Users\Trabajo\Desktop\Developer\software\DTD-worktrees\codex-saneamiento-integral`
- Rama: `codex/saneamiento-integral`
- Base: `origin/main@2a2e81bf554dbe7bd4f05170847e8f02e988d320`.
- HEAD anterior: `e735632f101d04418f511507e987ff9167673f60`.
- Este cierre agrega un único commit selectivo; no integra `main`.

## Cambio

- Se agrega `.github/workflows/quality.yml` para pull requests y pushes a
  `main`, además de ejecución manual.
- El job usa Ubuntu 24.04, Node 24, pnpm 11.19.0, lockfile congelado y Deno 2.
- `actions/checkout`, `pnpm/setup` y `denoland/setup-deno` están fijadas a SHA
  completo y el token sólo recibe `contents: read`.
- Checkout no persiste credenciales; el workflow no referencia secretos.
- Se ejecutan ESLint, frontera RSC, TypeScript, Edge Functions, unitarios, docs,
  numeración, constantes, componentes, gobernanza, build y diff reproducible.
- SQL/rebuild con Docker, Playwright E2E y Cloud quedan deliberadamente fuera.

## Verificación

- Contrato focal: 1 archivo / 5 pruebas, verde.
- Suite completa: 524 archivos / 5.947 pruebas, verde.
- ESLint y TypeScript: verde.
- Edge Functions: 4 entradas compilan con Deno 2.
- Docs y numeración: 341 specs / 403 migraciones, verde; 11 colisiones
  históricas declaradas permanecen sin renumerar.
- Componentes: 5 fuentes, verde.
- Gobernanza: 28 políticas aprobadas, cápsula vigente.
- Build sin secretos: 158 páginas, verde; `tsconfig.json` restaurado.
- `git diff --check`: verde.

## Gates no cruzados

- El workflow no puede correr en GitHub hasta que su commit se publique e
  integre en `main`.
- No se hizo push, merge, deploy, Cloud, migración ni escritura en Producción.
- La primera corrida alojada y la configuración de required checks siguen
  pendientes después de integrar.

## Allowlist cerrada

- `.github/workflows/quality.yml`
- `scripts/__tests__/ci-workflow-contract.test.mjs`
- `docs/specs/0349-ci-calidad-sin-secretos/spec.md`
- `docs/specs/README.md`
- `docs/audits/2026-09-02-codex-arranque-checklist.md`
- `.agents/handoffs/2026-09-02-ci-calidad-close.md`
- `.agents/handoffs/2026-09-02-saneamiento-integral-close.md`
