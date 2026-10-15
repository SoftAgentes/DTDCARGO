# Handoff · SDD-0538 · Contrato 0475: el bloque 5 lee el último restablecimiento por guardado, no por hora

| Campo | Valor |
|---|---|
| Fecha | 2026-10-15, Caracas 14:20 a 14:50 aprox. (UTC 18:20 a 18:50) |
| Task ID / owner | `contrato-0475-desempate-eventos` / sesión Worker `local_blissful-boyd-d8600b`, abierta desde la sesión `local_4780bed2` |
| Claim del harness | `local_blissful-boyd-d8600b` (se libera al cerrar) |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTDCARGO\.claude\worktrees\blissful-boyd-d8600b` |
| Rama | `claude/blissful-boyd-d8600b` |
| Base | `origin/main` `5d98ef62` (merge de la #236); el 2026-10-15 se mergeó `origin/main` `d9bbdb28` (#242 y #240) en la rama (`adb3ddc1`), y después `7232e28d` (#239, SDD-0534) (`c27c458e`), ver «Merge de main» |
| SDD | [0538](../../docs/specs/0538-contrato-0475-desempate-eventos/spec.md), `in-progress`. Reserva local `codex/sdd-reserve-0538-contrato-0475-desempate-eventos` (`ea106741`), sin push; su contenido entró a esta rama por cherry-pick (`adedac59`) |
| Estado de la tarea | lista para revisión |
| Permisos | commits selectivos, push de la rama propia y PR contra `main` sin fusionar. Sin producción ni base de datos. `pnpm verify` completo no ejecutado: requiere turno del Director |

## Objetivo

La SDD-0536 (PR hailuwaycom-sketch/DTDCARGO#242) dejó como fuera de alcance que
las dos lecturas del bloque `$motivo$` del contrato 0475
(`supabase/tests/0475_pin_operarios_endurecer.test.sql:568` y `:575` en main)
desempatan con `id desc`, un uuid aleatorio. Pedido: que ordenen por
`xmin::text::bigint desc` como `pg_temp.last_event` en el contrato 0480,
comprobar antes que cada restablecimiento corre en su propia subtransacción,
agregar la premisa si conviene, y probarlo en el envoltorio PGlite con la
disposición infeliz en verde y un control rojo determinista. Sin tocar la
migración 0475.

## Qué se hizo

- **Premisa comprobada antes de cambiar.** `pg_temp.run_as` ejecuta la sentencia
  dentro de `begin … exception when others … end` (`:284–288`), y `read_as`
  igual (`:299–304`): cada llamada es una subtransacción. Ni la 0475, ni 0267, ni
  0294 tienen `exception when`: las RPC y el writer de auditoría no abren
  subtransacciones propias, así que el xmin de cada evento es el xid de su
  `run_as`. Todos los eventos de `cn-2` del contrato nacen dentro de `run_as` o
  `read_as`.
- **Arreglo.** Las dos lecturas del bloque 5 (ahora `:573` y `:580`) ordenan por
  `xmin::text::bigint desc`, con un comentario que explica por qué. Un bloque 14
  nuevo, antes del `GREEN`, comprueba la premisa: los eventos de `cn-2` son más de
  uno y ninguno comparte xmin.
- **Envoltorio PGlite.** Describe «SDD-0538 · el bloque 5 lee el último
  restablecimiento aunque la hora empate», con cuatro pruebas:
  - disposición infeliz en verde: un trigger BEFORE INSERT, instalado antes del
    bloque 4, fija `occurred_at` a `2100-01-01` y da a cada evento un uuid que
    baja (`…-0000000f423f`, `…-0000000f423e`, …). Los tres restablecimientos de
    `cn-2` que ve el bloque 5 empatan en la hora y el viejo gana cualquier
    desempate por id. El contrato pasa;
  - un control rojo por lectura: con esa disposición y la lectura con el orden
    viejo (`occurred_at desc, id desc`), la primera cae en «con «Otro» la
    auditoría guarda el código y el texto» y la segunda en «con un código fijo la
    auditoría guarda sólo el código, no el texto». Al forzar el uuid, el control
    cae siempre, no la mitad de las veces;
  - control rojo de la premisa: dos `admin_reset_operario_pin` de `cn-2` en el
    mismo `do`, sin `run_as`, hacen caer el bloque 14.
  El trigger se instala antes del bloque 4 y no antes del 5 para que el evento
  del bloque 4 también empate: si no, la primera lectura nunca vería un empate.
- **0475 intacta.** Blob `0d7492ce` igual en la rama y en `origin/main`; el
  envoltorio ya fija su md5 `1273d8a4…` y sus 61685 bytes.

## VALIDACIÓN

Todo sobre el worktree de arriba, base `5d98ef62`.

| Comprobación | Alcance | Resultado |
|---|---|---|
| Sonda: orden viejo con la hora empatada y uuid aleatorio | prueba temporal en el envoltorio (borrada antes del commit), 18 corridas por orden, trigger sólo de hora desde el bloque 4 | orden viejo: 6 verdes, 8 caídas en la primera lectura, 4 en la segunda. Orden por xmin: 18 verdes de 18 |
| `vitest run lib/studio/__tests__/pin-operarios-endurecer.migration.test.ts` | archivo completo, `--reporter=verbose` | PASÓ: `Tests 87 passed (87)` (83 de antes + 4 nuevas), exit 0, 141 s (UTC 18:35–18:37) |
| Disposición infeliz en verde | dentro del vitest | PASÓ: `TEST 0475 GREEN` |
| Controles rojos de cada lectura | dentro del vitest | PASÓ como control: cada uno cae en el mensaje de su lectura |
| Control rojo de la premisa | dentro del vitest | PASÓ como control: cae en el bloque 14 |
| `corepack pnpm docs:check` | índice de specs | PASÓ tras `docs:index` (520 specs) |
| `corepack pnpm sdd:check` | numeración | PASÓ («sin números repetidos»; choques históricos de migraciones ya conocidos) |
| `corepack pnpm governance:check` | cápsula | PASÓ (28 políticas, cápsula vigente) |
| `vitest run scripts/__tests__/spec-migration-refs.test.ts` | migraciones citadas en specs | PASÓ (5/5) |
| `eslint` | el envoltorio | PASÓ (exit 0, sin salida) |
| `corepack pnpm typecheck` | repo completo | PASÓ (exit 0, UTC 18:37–18:38) |
| `git diff --check` | diff de la tarea | PASÓ |
| Contrato en Docker (`psql`) | camino de `verify` | NO EJECUTADO: Docker pide turno del Director. El cambio es SQL plano (cast de `xmin`, `count(distinct …)`); la semántica de subtransacciones de plpgsql es la misma |
| `pnpm verify` | completo | NO EJECUTADO: requiere turno del Director (una corrida pesada a la vez) |

## Impacto documental y conocimiento

- Canónicos actualizados: spec 0538, `docs/specs/README.md` (índice). Tras los
  merges de main, el índice lista 522 specs y 0535 y 0537 como huecos: son
  specs de otras ramas que aún no están en main.
- La spec 0536 y su handoff entraron a main con la #242; no se tocaron.
- `corepack pnpm knowledge:status` (exit 0, `ok: false`): estructural `INVALID`,
  semántico `INVALID`, `mainRevision` y `origin/main` en `5d98ef62`. Es el estado
  de un worktree sin derivados de Graphify, igual que en la SDD-0536; no lo causa
  esta tarea. No se reconstruyó aquí (corrida pesada; la publica el Director
  desde main).
- `knowledge:visual` / `knowledge:visual:check`: NO EJECUTADO, dependen de un
  grafo estructural válido. El cambio no altera la arquitectura que mapea Archify.
- Obsidian: sin cambios; la publicación es del Director desde main integrado.

## Merge de main

Auto-fix avisó que la PR quedó en conflicto con `main` tras fusionarse la #242
(SDD-0536) y la #240. Se mergeó `origin/main` `d9bbdb28` con el driver de
`scripts/merge-generated-records.mjs` tomado de main, sin rebase ni force push.
El único conflicto era `docs/specs/README.md` y el driver lo resolvió: después de
`docs:index` el árbol quedó limpio. Los archivos que trajo main (0480, su
envoltorio, el workflow de calidad y su contrato) no se cruzan con los de esta
tarea.

| Comprobación tras el merge | Resultado |
|---|---|
| `corepack pnpm docs:check` | PASÓ (521 specs) |
| `corepack pnpm sdd:check` | PASÓ |
| `vitest run lib/studio/__tests__/pin-operarios-endurecer.migration.test.ts` | PASÓ: 87/87 (UTC 19:55–19:57) |
| `corepack pnpm typecheck` | PASÓ (exit 0) |

Segundo aviso, misma tarde: se fusionó la #239 (SDD-0534, migraciones
0483–0489 y sus pruebas) y la PR volvió a chocar en el índice. Se mergeó
`origin/main` `7232e28d` igual que antes; el driver resolvió el índice y
`docs:index` dejó el árbol limpio. Nada de lo que trajo toca lo que lee el
contrato 0475 (sus `\ir`, `migrations-baseline.json` ni
`pending-migration-symbol-declarations.json`).

| Comprobación tras el segundo merge | Resultado |
|---|---|
| `corepack pnpm docs:check` | PASÓ (522 specs) |
| `corepack pnpm sdd:check` | PASÓ |
| `vitest run lib/studio/__tests__/pin-operarios-endurecer.migration.test.ts` | PASÓ: 87/87 (UTC 20:30–20:32) |
| `corepack pnpm typecheck` | PASÓ (exit 0) |

## COMMITS

| Hash | Propósito |
|---|---|
| `adedac59` | reserva SDD-0538 (cherry-pick del commit de reserva `ea106741`) |
| `52d5f64b` | `test(studio)`: orden por xmin, bloque 14 y pruebas del envoltorio |
| `80bbdb13` | `docs(sdd)`: spec e índice |
| `7cacad13` | handoff |
| `adb3ddc1` | merge de `origin/main` `d9bbdb28` (#242 y #240), índice resuelto por el driver |
| `40aac85c` | handoff: merge de main y revalidación |
| `c27c458e` | merge de `origin/main` `7232e28d` (#239), índice resuelto por el driver |
| commit que contiene este cambio | handoff: segundo merge de main |

## PR / BRANCH

Rama `claude/blissful-boyd-d8600b`, base `main`. La URL de la PR queda en su
descripción y en el cierre de la sesión. Sin fusionar.

## PENDIENTES DE ESTA TAREA

- `pnpm verify` completo (incluye el contrato en Docker), con turno del Director.
- Estado SDD a `done` al integrar, si la revisión acepta.

## FUERA DE ALCANCE DETECTADO

- Ningún hallazgo nuevo. `occurred_at desc` en `supabase/tests/*.test.sql`, fuera
  de índices: `0455_borrado_cliente_auditado.test.sql:244` y `:250` y
  `0460_retencion_vinculo_portal_revocado.test.sql:251` encuentran un solo evento
  por entidad y tipo (ya anotado por la 0536, sin riesgo);
  el de la 0480 ya lo corrigió la #242, fusionada en main.
- Las lecturas del bloque 5 filtran sólo por `entity_id`, sin `entity_type`. Hoy
  no importa (`fixture_id` es un md5 por etiqueta); no se cambió porque no es
  parte del desempate.

## HANDOFF AL DIRECTOR

1. Revisar la PR: el desempate es xmin por subtransacción, como en la 0536; el
   trigger del control fuerza el uuid para que el rojo sea determinista.
2. Dar turno para `pnpm verify` o correrlo al integrar.
3. Integrar con autorización. La rama ya trae main con la #242; si entra otra
   spec antes, el índice vuelve a chocar en GitHub y lo resuelve el driver de
   merge del índice (o `docs:index` tras el merge).
4. Al integrar: estado SDD `done`, índice y Graphify desde main; la reserva local
   `codex/sdd-reserve-0538-contrato-0475-desempate-eventos` se puede borrar una
   vez la spec esté en main.

Sesiones consumidoras: ninguna. Ownership liberado al cerrar esta sesión.
