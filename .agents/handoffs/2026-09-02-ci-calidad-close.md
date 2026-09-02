# Cierre técnico · SDD-0349 CI de calidad sin secretos

Fecha: 2026-09-02

Rol: worker
Estado: PUBLICADO EN PR #21 · MEMORIA VALIDADA · REGRESIÓN UI EN SDD-0360

## Identidad Git

- Repositorio: `https://github.com/hailuwaycom-sketch/DTDCARGO.git`
- Worktree:
  `C:\Users\Trabajo\Desktop\Developer\software\DTD-worktrees\codex-saneamiento-integral`
- Rama: `codex/saneamiento-integral`
- Base: `origin/main@2a2e81bf554dbe7bd4f05170847e8f02e988d320`.
- HEAD anterior: `e735632f101d04418f511507e987ff9167673f60`.
- El cierre inicial agregó un commit selectivo; la continuación corrige el
  primer fallo alojado dentro de SDD-0349. No integra `main`.

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

## Verificación del cierre inicial

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

## Primera corrida alojada y corrección

- La rama se publicó y el PR #21 en borrador activó el
  [run 33659251763](https://github.com/hailuwaycom-sketch/DTDCARGO/actions/runs/33659251763).
  No hacía falta integrar el workflow a `main` para el evento de PR; la nota
  anterior de este handoff era incorrecta.
- Instalación, ESLint y frontera RSC pasaron. TypeScript agotó el heap implícito
  cerca de 2 GiB: `JavaScript heap out of memory`, exit 134. Los demás pasos no
  se ejecutaron, por lo que no se afirma que CI esté verde.
- Se fija `NODE_OPTIONS=--max-old-space-size=4096` sólo en TypeScript/build,
  conservando comandos, timeout, runtime, permisos y fallos bloqueantes.
- Regresión: primero 1 fallo / 5 pases; después del ajuste, 6/6 pases.
- TypeScript sin caché incremental: 3.889 archivos, 2.898.635 K de memoria,
  48,84 s, exit 0 con old-space 4096. Build aislado con el mismo ajuste: 158
  páginas, postbuild y restauración de `tsconfig.json` correctos. Docs, ESLint
  focal y `git diff --check` pasaron.
- La [segunda corrida, 33660502119](https://github.com/hailuwaycom-sketch/DTDCARGO/actions/runs/33660502119)
  sobre `726a7118` pasó TypeScript y Edge: la memoria queda validada en el
  runner. Unitarios detectó una carrera real de `DestinoCombobox` (1 fallo /
  5.957 pases); se corrige por separado en SDD-0360, sin relajar el test.
- El CI completo y required checks siguen pendientes. No se cambió branch
  protection ni se amplió el runner a un plan de pago.
- Publicación, preview automático y lectura Cloud están documentados en
  `docs/audits/2026-09-02-codex-publicacion-y-preflight.md`. No hubo merge,
  promoción de producción, migración ni escritura de datos alojados.

## Allowlist cerrada

- `.github/workflows/quality.yml`
- `scripts/__tests__/ci-workflow-contract.test.mjs`
- `docs/specs/0349-ci-calidad-sin-secretos/spec.md`
- `docs/specs/README.md`
- `docs/audits/2026-09-02-codex-arranque-checklist.md`
- `.agents/handoffs/2026-09-02-ci-calidad-close.md`
- `.agents/handoffs/2026-09-02-saneamiento-integral-close.md`
- `docs/audits/2026-09-02-codex-publicacion-y-preflight.md`
