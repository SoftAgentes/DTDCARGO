# Handoff · SDD-0536 · Contrato 0480: el último evento se elige por guardado, no por hora

| Campo | Valor |
|---|---|
| Fecha | 2026-10-15, Caracas 13:55 a 14:30 aprox. (UTC 17:55 a 18:30) |
| Task ID / owner | `contrato-0480-desempate-eventos` / sesión Worker `claude-gallant-pare-63349c` |
| Claim del harness | `claude-gallant-pare-63349c` (se libera al cerrar) |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTDCARGO\.claude\worktrees\gallant-pare-63349c` |
| Rama | `claude/gallant-pare-63349c` |
| Base | `origin/main` `5d98ef62` (merge de la #236) |
| SDD | [0536](../../docs/specs/0536-contrato-0480-desempate-eventos/spec.md), `in-progress`. Reserva local `codex/sdd-reserve-0536-contrato-0480-desempate-eventos` (`e97c416b`), sin push; el commit de reserva está en esta rama |
| Estado de la tarea | lista para revisión |
| Permisos | commits selectivos, push de la rama propia y PR contra `main` sin fusionar. Sin producción ni base de datos. `pnpm verify` completo no ejecutado: requiere turno del Director |

## Objetivo

El CI «Calidad continua» de la PR #239 (run 38771102511, SHA `fb949002`) cayó en
`operarios-editar-por-region.migration.test.ts` › «mutante sin bloquear la fila:
muere donde debe»: murió en «TEST 0480: le da el modo del rol nuevo» en vez de
«TEST 0480: pero sí bloqueó la fila mientras comparaba». Pedido: verificar la
causa (empate en `pg_temp.last_event`, que ordena por `occurred_at`), reproducirla
de forma determinista, corregir sólo el contrato con un desempate monótono, buscar
el patrón en otros contratos y no tocar la migración 0480.

## Qué se hizo

- **Causa verificada, con una corrección.** La hipótesis de partida era el
  `default now()` de `occurred_at`. No aplica: `append_audit_event` escribe
  `clock_timestamp()` (`0267_audit_contract_append_only.sql:619`). El empate viene
  del reloj de PGlite, que no tiene microsegundos (20.000 lecturas, 9 valores
  distintos, ninguno con microsegundos). Los dos últimos guardados de `cn-viejo`
  quedan a 1–3 ms en local; en el CI la prueba tardó 1052 ms contra 2,8–3,8 s aquí.
- **Reproducción determinista.** Un trigger que fija la misma hora a los eventos
  desde el bloque 8 deja los dos guardados de `cn-viejo` empatados con el viejo
  primero en la tabla; con el orden por hora el contrato cae en «TEST 0480: le da
  el modo del rol nuevo», el mensaje del CI.
- **Arreglo.** `pg_temp.last_event` ordena por `e.xmin::text::bigint desc`: cada
  guardado corre en su subtransacción (`run_as`) y su xid crece con cada una. Un
  bloque 12 nuevo comprueba la premisa (ningún par de eventos de edición comparte
  xmin). Descartados, con motivo en la spec: transacciones separadas, columna
  creciente (no existe), `ctid`, esperar al reloj.
- **Envoltorio PGlite.** Describe SDD-0536 con tres pruebas: la disposición
  infeliz en verde, el control rojo del desempate y el control rojo de la premisa.
- **0480 intacta.** Blob `96ef04e0` igual en la rama y en `origin/main`.

## VALIDACIÓN

Todo sobre el worktree de arriba, base `5d98ef62`.

| Comprobación | Alcance | Resultado |
|---|---|---|
| Fallo del CI | `gh run view 38771102511 --attempt 1 --log-failed` (job 116547450948) | VERIFICADO: «Expected: "TEST 0480: pero sí bloqueó la fila mientras comparaba"» / «Received: "TEST 0480: le da el modo del rol nuevo"». El run está en su intento 4, relanzado por otra sesión; los intentos 2 y 3 salieron cancelados |
| Resolución del reloj | sonda PGlite 0.5.8, 20.000 `clock_timestamp()` | 9 valores distintos, 0 con microsegundos |
| Separación entre guardados | sonda, 3 corridas del contrato verde | `cn-viejo` 2→3: 1–3 ms; `cn-bruno` 2→3: 1–2 ms; `ve-multi` 1→2: 1–2 ms; `ve-luis` > 50 ms |
| Disposición infeliz | sonda con trigger de misma hora desde el bloque 8, contrato de main | `last_event('cn-viejo')` devolvió `{"cambios": ["display_name"]}` (el viejo); el contrato cayó en «TEST 0480: le da el modo del rol nuevo» |
| `vitest run lib/studio/__tests__/operarios-editar-por-region.migration.test.ts` | archivo completo | PASÓ: `Tests 46 passed (46)` (43 de antes + 3 nuevas), exit 0, reporter por defecto |
| Control rojo del desempate | dentro del vitest: misma hora + `order by e.occurred_at desc` | PASÓ como control: cae en «TEST 0480: le da el modo del rol nuevo» |
| Control rojo de la premisa | dentro del vitest: dos `admin_update_operario` en el mismo `do`, sin `run_as` | PASÓ como control: cae en el bloque 12 |
| `corepack pnpm docs:check` | índice de specs | PASÓ tras `pnpm docs:index` (520 specs) |
| `corepack pnpm sdd:check` | numeración | PASÓ («sin números repetidos»; choques históricos de migraciones ya conocidos) |
| `eslint` | el envoltorio | PASÓ (exit 0, sin salida) |
| `corepack pnpm typecheck` | repo completo | PASÓ (exit 0) |
| `git diff --check` | diff de la tarea | PASÓ |
| Contrato en Docker (`psql`) | camino de `verify` | NO EJECUTADO: Docker pide turno del Director. El cambio es SQL plano (cast de `xmin`, `count(distinct …)`); la semántica de subtransacciones de plpgsql es la misma |
| `pnpm verify` | completo | NO EJECUTADO: requiere turno del Director (una corrida pesada a la vez) |

## Impacto documental y conocimiento

- Canónicos actualizados: spec 0536, `docs/specs/README.md` (índice). El índice
  lista 0534 y 0535 como huecos: son specs de otras ramas que aún no están en
  main; el driver de merge del índice lo resuelve al integrar.
- La spec 0529 y su handoff quedan como evidencia fechada; no se editaron.
- `corepack pnpm knowledge:status` (exit 0, `ok: false`): estructural `INVALID`,
  semántico `INVALID`, `mainRevision` y `origin/main` en `5d98ef62`. Es el estado
  de un worktree sin derivados de Graphify, como en la SDD-0533; no lo causa esta
  tarea. No se reconstruyó aquí (corrida pesada; la publica el Director desde main).
- `knowledge:visual` / `knowledge:visual:check`: NO EJECUTADO, dependen de un grafo
  estructural válido. El cambio no altera la arquitectura que mapea Archify.
- Obsidian: sin cambios; la publicación es del Director desde main integrado.

## COMMITS

| Hash | Propósito |
|---|---|
| `e97c416b` | reserva SDD-0536 (commit del script de reserva, sobre `5d98ef62`) |
| `76f5bf57` | `test(studio)`: desempate por xmin, bloque 12 y pruebas del envoltorio |
| `2181ad4b` | `docs(sdd)`: spec e índice |
| commit que contiene este documento | handoff |

## PR / BRANCH

Rama `claude/gallant-pare-63349c`, base `main`. La URL de la PR queda en su
descripción y en el cierre de la sesión. Sin fusionar.

## PENDIENTES DE ESTA TAREA

- `pnpm verify` completo (incluye el contrato en Docker), con turno del Director.
- Estado SDD a `done` al integrar, si la revisión acepta.
- La PR #239 no toca archivos de la 0480 (26 archivos en `fb949002`, ninguno con
  `0480` ni `operarios-editar`): cayó por este empate, no por su cambio. Al
  integrar esta PR, relanzar su CI o mergear main en su rama. Que quede verde no
  está verificado.

## FUERA DE ALCANCE DETECTADO

- **`0475_pin_operarios_endurecer.test.sql:568` y `:575`** ordenan con
  `order by occurred_at desc, id desc limit 1`, sin filtrar por tipo, después de
  dos restablecimientos seguidos de `cn-2` en el mismo `do`. El desempate `id desc`
  es un uuid aleatorio. Riesgo bajo medido: los eventos que leen esas líneas
  quedaron a 61–110 ms y 18–28 ms del anterior (tres corridas con sonda). El mismo
  arreglo (orden por xmin) aplicaría; propuesto como tarea aparte.
- `0455_borrado_cliente_auditado.test.sql:244`, `:250` y
  `0460_retencion_vinculo_portal_revocado.test.sql:251` usan el mismo orden, pero
  cada lectura encuentra un solo evento por entidad y tipo (el contrato afirma
  `= 1`). Sin riesgo; no requieren cambio.

## HANDOFF AL DIRECTOR

1. Revisar la PR: el diagnóstico corrige la hipótesis (`clock_timestamp()` en
   milisegundos, no `now()`), y el desempate es xmin por subtransacción.
2. Dar turno para `pnpm verify` o correrlo al integrar.
3. Integrar con autorización; después relanzar el CI de la #239.
4. Decidir si 0475 recibe el mismo desempate en una SDD propia.
5. Al integrar: estado SDD `done`, índice y Graphify desde main; la reserva local
   `codex/sdd-reserve-0536-contrato-0480-desempate-eventos` se puede borrar una
   vez la spec esté en main.

Sesiones consumidoras: ninguna. Ownership liberado al cerrar esta sesión.
