# Handoff · SDD-0570 — pruebas PGlite sin initdb por caso

| Campo | Valor |
|---|---|
| Task ID | `2026-10-20-sdd-0570-pglite-plantilla` |
| Owner / sesión | Worker (Claude Code) · claim `claude-sharp-ellis-7c6126-pglite` |
| Worktree | `DTD-worktrees/pglite-snapshot-esquema` |
| Rama | `codex/pglite-snapshot-esquema`, base `origin/main` `d50aa3e7` (incluye la #298) |
| SDD | [0570](../../docs/specs/0570-pglite-plantilla-por-archivo/spec.md), `in-progress` |
| Estado | implementado y probado en local por archivo; falta la corrida completa (turno del Director) y el CI |
| Permisos | commits selectivos, push de la rama propia y PR en borrador. Sin merge. |

## Autorizaciones (literales)

- Sam: «Haz esta tarea aquí: “Pruebas PGlite: snapshot del esquema base por worker”».
- Director, en su sesión: la 0570 queda para esta tarea (la había prometido a Contabilidad, que
  pasa a la 0571). Hoy la máquina la usa Contabilidad: validar con el CI de GitHub y pedir turno
  local cuando se libere.

## OBJETIVO ORIGINAL

Bajar el costo de las pruebas `*.migration.test.*` (PGlite) sin debilitar ninguna aserción, control
rojo, mutante ni contrato:

1. Medir primero qué parte de cada caso es levantar PGlite y qué parte es el contrato.
2. Si conviene, una plantilla del esquema base.
3. SDD con el Director.
4. Medición antes/después y este handoff.

## Hallazgo

La hipótesis inicial era que el costo estaba en aplicar migraciones. **Era el initdb.**

| Arranque (máquina de Sam, mediana de 5) | ms |
|---|---|
| `new PGlite({ extensions: { pgcrypto } })` | 1.321 |
| `new PGlite()` | 1.186 |
| `new PGlite({ loadDataDir })` desde un dump post-initdb | 322 |

Cada contrato aplica solo su puñado de migraciones (`\ir`) dentro de su transacción; lo caro es el
cluster nuevo de cada caso. `new PGlite()` hace el initdb en otra instancia, la vuelca y la carga.

## COMPLETADO

- `48ac8439`: reserva de la SDD-0570 con `sdd:next --reserve`, traída por cherry-pick.
- `08c0dc7b`: `vitest/pglite-limpio.ts` y su prueba.
  - Hace un initdb por juego de extensiones y por archivo, y da a cada caso una instancia propia
    cargada del dump.
  - Si la plantilla falla, sale del caché.
- `4b05a262`: 36 sitios en 27 archivos pasan a `await pgliteLimpio(...)`, con las mismas
  extensiones. Son 26 archivos de prueba y `r3-correlation-contract.ts`, que usan 7 archivos más.
  - Solo cambian la línea de construcción y los imports.
  - Quedan con `new PGlite()`: los seis `beforeAll` de una instancia por archivo y
    `pin-operarios-endurecer.migration.test.ts:1159`.
- `14e88ef1`: spec e índice de specs regenerado.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| Guard, claim y `git diff --check` | PASÓ |
| `vitest/pglite-limpio.test.ts` | PASÓ, 6/6 |
| Huella fresco contra cargado (script aparte, con y sin pgcrypto) | PASÓ: 11 de 11 medidas iguales, incluidos txid (752) y OID siguiente |
| Mutantes del helper (TAP, control sin mutar: 8 ok) | 6 de 6 mueren; un equivalente documentado (`txid_current()` sin checkpoint no llega al dump) |
| A/B `cobro-factura-atomico` (7 casos) | PASÓ: 11,2 y 11,7 s → 7,3 y 8,0 s |
| A/B `portal-bandeja-avisos` (48 casos) | PASÓ: 66,2 s → 27,1 s, 48/48 |
| ESLint sobre los archivos cambiados | PASÓ: 0 errores; los 20 imports `PGlite` sin uso se quitaron (más el del `.mjs`, que ESLint ignora) |
| `pnpm docs:index`, `docs:check` y `sdd:check` | PASÓ |
| Corrida local de los 34 archivos afectados | NO EJECUTADO: el Director no dio turno (la máquina la usa Contabilidad) |
| `pnpm typecheck` | NO EJECUTADO en local por la misma razón; lo corre el CI |
| `pnpm verify` | NO EJECUTADO: es un cambio de prueba, sin código de producto. Lo cubren el CI de calidad (lint, typecheck, test, build) y la corrida local cuando haya turno. |
| CI de la PR | PENDIENTE |

Con qué se compara el CI: la rama no trae la #302 (2 workers), así que su CI corre en serie, igual
que el run 39417924823. Los tiempos por archivo de los dos runs se comparan directo:
`borrado-embarques-recepciones` 198 s, `pin-operarios-endurecer` 179 s, `portal-bandeja-avisos`
88 s, y en total 25,4 min de `*.migration.test.*`.

## COMMITS

- `48ac8439` chore(sdd): reserva SDD-0570 — pglite-plantilla-por-archivo
- `08c0dc7b` test: SDD-0570 — pgliteLimpio carga un cluster recién inicializado sin initdb
- `4b05a262` test: SDD-0570 — los contratos PGlite toman cada caso de la plantilla
- `14e88ef1` docs(sdd): SDD-0570 — pruebas PGlite sin initdb por caso
- este handoff

## PR / BRANCH

Rama `codex/pglite-snapshot-esquema`, PR en borrador contra `main`; el número se registra al
abrirla. La reserva `codex/sdd-reserve-0570-pglite-plantilla-por-archivo` y
`refs/dtd/reservations/0570` siguen locales. El Director la publica o la descarta: la spec entra por
esta PR.

## PENDIENTES DE ESTA TAREA

- Registrar el CI de la PR: verde, tiempos por archivo y total contra el run 39417924823. Pasar la
  tabla a «Medición después del cambio» de la spec.
- Corrida local de los 34 archivos cuando el Director dé turno.
- Al integrarse con la #302 (2 workers), medir el efecto combinado en el primer CI de `main`.

## FUERA DE ALCANCE DETECTADO

- **Caché entre archivos.** Un `globalSetup` que deje el dump en disco ahorraría además un initdb
  por archivo (~1,3 s × 33). No hace falta para el objetivo.
- **Contratos con SQL caro de verdad.** En `cobro-factura-atomico` el caso sigue en 1,2 a 2,8 s
  después del cambio: ahí pesa el contrato, no el arranque. Si algún archivo sigue arriba, el paso
  siguiente es medir su SQL, no tocar la plantilla.

## Impacto documental

- Nueva spec 0570 e índice regenerado. No cambia ningún runbook.
- Graphify y Archify: sin cambios en fuentes de `semanticPilot`; `knowledge:status` NO EJECUTADO
  (la máquina está en turno de Contabilidad).

## HANDOFF AL DIRECTOR

Son tres commits de test-infra más la spec. Hay que revisar el CI de la PR contra el run
39417924823, por archivo. Para la corrida local de los 34 archivos sigo esperando el turno.
