# CI · Los contratos de SQL corren en GitHub Actions (handoff de Worker)

- **Owner:** Worker de Claude Code, sesión `95191146-c154-4468-af0e-d46ad5a1e391`. Lo encargó el Director General y lo trasladó el Subdirector de Chatwoot (`local_535053f4-40c2-4124-a280-63f4fc882820`), el 2026-11-07.
- **Ruta:** `C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\ci-sql-tests`.
- **Rama:** `codex/ci-sql-tests`, desde `main` en `2ceeff9dd`. PR [#426](https://github.com/SoftAgentes/DTDCARGO/pull/426), en borrador.
- **SDD:** ninguna. Es un cambio de harness y entra como `ci:`, igual que otros cambios de `quality.yml`. Lo decidió el Subdirector de Chatwoot el 2026-11-07: AGENTS pide SDD para cambios de comportamiento del Studio y, para los de harness, pruebas de sus guiones y documentación. Si el Director General pide número, la allowlist pasa a esa spec antes de publicar.

## OBJETIVO ORIGINAL Y MOTIVO

El hueco del portón, medido el 2026-11-07 por el Subdirector:
- `git grep -E "run-sql-tests|sql-tests|image: *postgres|services:" origin/main -- .github/workflows` no devolvía nada: ningún workflow levantaba Postgres ni corría `scripts/run-sql-tests.mjs`.
- Los 263 `supabase/tests/*.test.sql` corrían solo en el paso `sql-tests` de `pnpm verify` (`scripts/verify.mjs:497`).
- Desde que el portón es solo el CI, los contratos de SQL de las PR nuevas (RLS, GRANT, triggers y las carreras con dblink) no los corría nadie.

El objetivo: un job de Actions que los corra, que dé rojo si un contrato falla y que no cuente un SKIP como verde.

## COMPLETADO

- **`.github/workflows/sql-tests.yml`, «Contratos SQL».**
  - Corre en las PR que tocan `supabase/migrations/**`, `supabase/tests/**`, `scripts/run-sql-tests.mjs`, los dos guiones nuevos o el propio workflow, y también a mano.
  - ubuntu-24.04, `permissions: contents: read`, sin secretos y Node 24.22.1, como en `quality.yml`.
  - `postgres:17` va por etiqueta, igual que en `pnpm verify`; el log anota su digest.
  - **`timeout-minutes: 10`**, por lo medido (abajo).
- **`scripts/ci-sql-tests.sh`:** corre `run-sql-tests.mjs` y solo da verde con código 0, sin `[SKIP]`, sin ✗ y con un ✓ por contrato. El código 3 (SKIP) da rojo, con el aviso de que un salto no cuenta como verde.
- **`scripts/ci-sql-tests-control.sh`,** el paso de control antes de la corrida completa, sobre 0310 y 0327 con las migraciones del repo:
  - C0: verde.
  - C1: mutante en el contrato 0327 → rojo.
  - C2: la migración 0327 sin el REVOKE de `sync_boxes` → rojo con «sync_boxes público».
  - C3: `VERIFY_SKIP_SQL=1` → código 3 y rojo.
- **`docs/engineering/project-rules.md`, «Comandos»:** una línea que dice qué job corre los `.test.sql` y cuándo.

## Allowlist

- `.github/workflows/sql-tests.yml`
- `scripts/ci-sql-tests.sh`
- `scripts/ci-sql-tests-control.sh`
- `docs/engineering/project-rules.md` (una línea en «Comandos»)
- `.agents/handoffs/ci-sql-tests.md`
- `supabase/tests/0327_internal_function_grants.test.sql` y `supabase/tests/0329_user_profiles_tenant_scope.test.sql`: solo mutantes temporales, cada uno revertido en un commit propio. Contra `main` no cambian.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| `bash -n` de los dos guiones | PASÓ |
| `ci-sql-tests.sh` con runners falsos, en la PC | PASÓ: verde da 0; un contrato roto da 1; un SKIP (código 3) da 1, con «un salto no cuenta como verde»; código 0 con menos ✓ que contratos da 1. No cuenta los auxiliares `_*.sql` |
| `ci-sql-tests.sh` con el runner real en la PC, sin Docker (Docker Desktop apagado; `docker info` solo falla) | PASÓ como control: cuenta los 263 contratos, run-sql-tests da SKIP con código 3 y el guion sale con 1 |
| Run 42413378934 sobre `937ba19b0` (log leído con `gh api`) | **PASÓ.** Control: C0 verde; C1 y C2 rojos con código 1; C3 rojo por SKIP. **263 de 263** contratos en verde, con las 16 carreras con dblink (de la 0365 a la 0497). La imagen fue `postgres@sha256:ff87138949ad9a46f32ff23bd6852b52ce024a13dffe9b4087be98292cdd3b4f`. Duración: 1,6 min el job (20:55:43Z → 20:57:19Z), 53 s los contratos, 8 s el control y 17 s bajar la imagen |
| Primer mutante temporal, run 42413620010 sobre `2dd89e0c4`, con la 0327 mutada en el repo | FALLÓ, pero en el **control** y no en la corrida: el control usa la 0327 del repo, así que C0 cayó, C1 no encontró qué mutar y C2 dio 0. «Contratos SQL» quedó en skipped. **No es la evidencia pedida.** Sirve igual: un contrato del control roto en el repo también tumba el job |
| Segundo mutante temporal, run 42413756998 sobre `9c20ef736`, con la 0329 mutada en el repo (acepta ver un perfil de otro tenant) **FALLÓ, como se esperaba.** El control quedó en verde (C0 a C3). «Contratos SQL» cayó con código 1: `✗ 0329_user_profiles_tenant_scope.test.sql`, «esperaba propia + tenant compartido, obtuvo 2», **262 de 263** en verde y `[FAIL] 1 contrato(s) de SQL roto(s)`. Duró 1,6 min (21:00:33Z → 21:02:08Z). Los dos mutantes se revirtieron después, en `da258b018` y `6e9a214b8` |
| Run final sobre la cabeza, con el tope en 10 y la línea de docs | Ver la PR |
| `node scripts/build-docs-index.mjs --check` y `node scripts/check-numbering.mjs` | PASÓ |
| `pnpm verify` | NO EJECUTADO: es un cambio de harness y de CI, sin producto. Lo que corre el job es lo mismo que el paso `sql-tests` de verify |

## Conocimiento

`docs/engineering/project-rules.md` es una de las 16 fuentes del piloto semántico (`scripts/knowledge-policy.json`). La línea nueva deja **pendiente su recibo semántico**. No se emite desde un worktree, así que lo emite el Director General desde `main` al integrar. `knowledge:status` no se corrió aquí: en estos worktrees da NO DISPONIBLE, porque el adaptador de Graphify no responde.

## FUERA DE ALCANCE DETECTADO

- `postgres:17` va por etiqueta, en `pnpm verify` y en este job. Un cambio de la imagen podría cambiar un resultado sin que el repo cambie. Fijarla por digest en los dos lugares sería una PR aparte. El digest de hoy queda arriba.

## HANDOFF AL DIRECTOR

PR en borrador. No se fusiona desde aquí. Nada en producción ni en el VPS.
