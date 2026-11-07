# CI · Los contratos de SQL corren en GitHub Actions (handoff de Worker)

- **Owner:** Worker de Claude Code, sesión `95191146-c154-4468-af0e-d46ad5a1e391`. Encargo del Director General, relayado por el Subdirector de Chatwoot (`local_535053f4-40c2-4124-a280-63f4fc882820`), el 2026-11-07.
- **Ruta:** `C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\ci-sql-tests`.
- **Rama:** `codex/ci-sql-tests`, desde `main` en `2ceeff9dd`.
- **SDD:** pendiente de respuesta del Subdirector: número nuevo de harness, o sin SDD como otros `ci:` de `quality.yml`. Mientras tanto, la allowlist queda en este handoff.

## OBJETIVO ORIGINAL

Ningún workflow levantaba Postgres ni corría `scripts/run-sql-tests.mjs`. Los 263 `supabase/tests/*.test.sql` corrían solo en el paso `sql-tests` de `pnpm verify` (`scripts/verify.mjs:497`). Desde que el portón es el CI, los contratos de SQL de las PR nuevas no los corría nadie. El objetivo es un job de Actions que los corra, con las carreras con dblink incluidas, que dé rojo si un contrato falla y que no cuente un SKIP como verde.

## Qué queda

- **`.github/workflows/sql-tests.yml`, «Contratos SQL».**
  - Corre en las PR que tocan `supabase/migrations/**`, `supabase/tests/**`, `scripts/run-sql-tests.mjs`, los dos guiones nuevos o el propio workflow, y también a mano.
  - ubuntu-24.04, `permissions: contents: read` y sin secretos. Node 24.22.1, como en `quality.yml`.
  - `postgres:17` va por etiqueta, igual que en `pnpm verify`; el log anota su digest.
- **`scripts/ci-sql-tests.sh`:** corre `run-sql-tests.mjs` y solo da verde con código 0, sin `[SKIP]`, sin ✗ y con un ✓ por contrato. Con el código 3 (SKIP) sale con 1 y dice que un salto no cuenta como verde.
- **`scripts/ci-sql-tests-control.sh`,** el paso de control antes de la corrida completa, sobre 0310 y 0327 con las migraciones del repo:
  - C0: verde.
  - C1: mutante en el contrato 0327 → rojo.
  - C2: la migración 0327 sin el REVOKE de `sync_boxes` → rojo con «sync_boxes público».
  - C3: `VERIFY_SKIP_SQL=1` → código 3 y rojo.

## Allowlist

- `.github/workflows/sql-tests.yml`
- `scripts/ci-sql-tests.sh`
- `scripts/ci-sql-tests-control.sh`
- `.agents/handoffs/ci-sql-tests.md`

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| `bash -n` de los dos guiones | PASÓ |
| `ci-sql-tests.sh` con runners falsos, en la PC | PASÓ: verde da 0; un contrato roto da 1; un SKIP (código 3) da 1, con «un salto no cuenta como verde»; código 0 con menos ✓ que contratos da 1. No cuenta los auxiliares `_*.sql` |
| `ci-sql-tests.sh` con el runner real en la PC, sin Docker (Docker Desktop apagado; `docker info` solo falla) | PASÓ como control: cuenta los 263 contratos, run-sql-tests da SKIP con código 3 y el guion sale con 1 |
| El job en Actions: control y los 263 contratos | Pendiente del CI de la PR |
| Duración y `timeout-minutes` | Pendiente: arranca en 30 y se ajusta a lo medido, con la regla del Director General |

## FUERA DE ALCANCE DETECTADO

(ninguno todavía)

## HANDOFF AL DIRECTOR

PR en borrador. No se fusiona desde aquí.
