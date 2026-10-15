# Handoff · SDD-0525 · Modelos de Anthropic vacíos caen a su respaldo

| Campo | Valor |
|---|---|
| Fecha | 2026-10-15 (UTC 05:50 a 06:20 aprox.; Caracas 01:50 a 02:20) |
| Task ID / owner | `0525-modelos-anthropic-vacios` / sesión Worker de Claude, iniciada por la sesión de la 0523 |
| Claim del harness | `f27c7d81-c2dd-4629-85bf-1ded3f6f7ed6` (el worktree no tenía claim previo) |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTDCARGO\.claude\worktrees\funny-chatterjee-390769` |
| Rama | `claude/nostalgic-grothendieck-e4f689` (nombre que le dio la app; sin upstream hasta el push) |
| Base | `origin/main` `a8d99acf` (merge de la #223) |
| SDD | [0525](../../docs/specs/0525-modelos-anthropic-vacios/spec.md), `in-progress`. Reservada con `corepack pnpm sdd:next --reserve modelos-anthropic-vacios` (rama local `codex/sdd-reserve-0525-modelos-anthropic-vacios`, commit `9edbfd15`, traída aquí por cherry-pick como `cb024acb`). Sin migración. |
| Estado de la tarea | lista para revisión (PR contra main, sin fusionar) |
| Permisos | commits selectivos, push de la rama propia y PR contra main, sin fusionar. Sin producción, sin servidor, sin variables de entorno, sin datos ni migraciones. `pnpm verify` no se corre sin turno del Director. |

## Objetivo

Que `BITACORA_ACTA_MODEL`, `BITACORA_ESCUCHA_MODEL` y `CONVERSATION_DIGEST_MODEL`
definidas pero vacías, o con sólo espacios, caigan a su respaldo en vez de dejar
el modelo en `""` y romper la llamada a Anthropic. Es el caso que la 0523 dejó en
su FUERA DE ALCANCE porque no son secretos.

## Qué se hizo

- Helper `lib/runtime/server-setting.ts` (`firstConfiguredSetting`): primer valor
  no vacío ni de sólo espacios, **devuelto recortado**; `null` si no hay.
- Tres sitios: `extract.ts` (acta), `escucha-extract.ts` (Escucha Activa, cascada
  escucha → acta → default) y `digest-extract.ts` (resumen mensual interno y para
  el cliente, cascada digest → acta → default). Orden y defaults sin cambios.
- Tres archivos de prueba nuevos, 40 casos: vacía, con espacios, definida (con y
  sin espacios alrededor) y sin definir, en cada eslabón de cada cascada.
- Runbook `servidor-contabo.md:589` y dos comentarios de `.env.example` ajustados
  a lo que hace el código ahora.

### Decisión: helper propio y no el de la 0523

La PR #225 (SDD-0523) sigue abierta, así que `lib/runtime/server-secret.ts` no
está en main; depender de ella apilaría esta PR. Además su regla es no recortar
(un secreto recortado cambia la clave), y aquí conviene recortar (un ID de
modelo con un espacio al final no existe). Los dos helpers viven en archivos
nuevos y distintos: las dos PR sólo coinciden en el índice `docs/specs/README.md`.
`lib/runtime/app-env.ts:48-51` tiene un `nonEmpty` privado con la misma regla;
no se tocó.

## Impacto documental y conocimiento

- Documentos actualizados: spec 0525 (nueva), `docs/specs/README.md` (regenerado
  con `pnpm docs:index`), `docs/runbooks/servidor-contabo.md:589` (la frase
  «vacío = `claude-sonnet-4-6`» ahora es cierta y se extiende a las otras dos
  variables) y `.env.example` (raíz: comentarios de `BITACORA_ACTA_MODEL` y del
  bloque de modelos por tarea).
- No se tocó `infra/dtd-cargo/.env.example:116-118`: ya dice que las variables
  sin usar quedan vacías y la app «degrada con gracia», que con esta rama pasa a
  ser cierto para los modelos.
- `pnpm knowledge:status` (exit 0, `ok: false`, revisión `c9047b2f`): structural
  INVALID con 4577 pendientes y 0 drifted, semantic INVALID con 1208 pendientes,
  archify PENDING, obsidian PENDING (0 conflictos, 42 advertencias). Igual que en
  la 0523: el worktree no tiene `graphify-out/` y todo el repo figura pendiente;
  no es efecto de este cambio. La spec 0525, el helper y las pruebas nuevas
  aparecen entre los pendientes.
- Graphify `update`, `knowledge:visual`, `knowledge:visual:check` y
  `knowledge:publish --preview`: NO EJECUTADOS. Validación liviana por encargo;
  el grafo lo publica el Director desde main integrado. Pendiente global: la
  estructura de Graphify debe incorporar el helper, las tres pruebas y la spec
  0525 después de integrar.

## Cierre

**OBJETIVO ORIGINAL:** reservar la SDD; que los tres modelos de Anthropic vacíos o
con sólo espacios caigan a su respaldo, usando el valor recortado; reutilizar
`server-secret.ts` si la #225 ya estaba en main o decidir en la spec; pruebas con
la variable vacía, con espacios, definida y sin definir; control rojo contra
origin/main y mutantes; pruebas focalizadas, typecheck, lint, docs:check y
sdd:check; spec, handoff, push y PR sin fusionar.

**COMPLETADO:**
- SDD-0525 reservada y escrita, con la decisión sobre el helper.
- Los tres sitios corregidos con un helper que recorta.
- 40 pruebas nuevas, control rojo y 10 mutantes muertos.
- Runbook y `.env.example` alineados con el código.
- Criterios de aceptación de la spec cumplidos (los siete marcados).

**VALIDACIÓN** (código sobre `c9047b2f`; documentación en el commit siguiente):

| Comprobación | Resultado |
|---|---|
| Control rojo: pruebas de los tres sitios contra el código de `a8d99acf` (los tres archivos de origin/main, helper presente) | FALLÓ, como se esperaba: 18 de 32. Fallan los casos vacía, sólo espacios y espacios alrededor; pasan los 14 de variable definida sin espacios o sin definir |
| Pruebas nuevas con el arreglo (3 archivos) | PASÓ 40/40 |
| Mutantes (10, sobre líneas del diff; control 40/40; archivos restaurados y comprobados con `git diff --stat` y lectura) | PASÓ: 10 muertos. Cada uno cuenta como muerto sólo si la salida trae la línea `Tests` con fallos. Detalle en la spec |
| Suites vecinas: `lib/runtime`, `lib/studio/bitacora`, `lib/studio/conversaciones` (incluye `extract.test.ts`, `escucha-extract.test.ts` y `digest-extract.test.ts` existentes) | PASÓ: 26 archivos, 415 pruebas |
| `pnpm typecheck` (salida a archivo, sin tubería) | PASÓ: exit 0 |
| `pnpm lint` completo (salida a archivo) | PASÓ: exit 0, 0 errores y 15 advertencias, ninguna en archivos de esta tarea |
| `pnpm docs:check` | PASÓ: índice sincronizado con 508 specs |
| `pnpm sdd:check` | PASÓ: «numbering: sin números repetidos»; los ⏸ son choques históricos ya aplicados |
| `git diff --check` | PASÓ |
| `pnpm verify` completo | NO EJECUTADO: el encargo pide no correrlo sin turno del Director |
| e2e, Docker y build | NO EJECUTADO: fuera de la validación pedida |
| Llamada real a Anthropic con `model: ""` | NO EJECUTADO: no hay clave en el worktree y no se gasta una llamada; el SDK está doblado en las pruebas |
| `/ui-check` | NO EJECUTADO, no aplica: no hay cambio visual |
| `revisar-datos-ve` | NO EJECUTADO, no aplica: no cambia qué datos se capturan ni a dónde van |

**COMMITS:**
- `cb024acb` — chore(sdd): reserva SDD-0525 (cherry-pick del stub).
- `c9047b2f` — fix(studio): helper, tres sitios y tres archivos de prueba.
- Commit de documentación: spec 0525, índice regenerado, runbook y `.env.example`.
- Commit de este handoff.

**PR / BRANCH:** PR contra `main` desde `claude/nostalgic-grothendieck-e4f689`,
sin fusionar. La URL va en el reporte a la sesión que encargó la tarea y se
obtiene con `gh pr list --head claude/nostalgic-grothendieck-e4f689`; no se
empuja otro commit sólo para anotarla.

**PENDIENTES DE ESTA TAREA:**
- Revisión del Director y CI de la PR. Según el encargo, no se fusiona nada
  hasta después del corte de Vercel al servidor propio.
- Estado SDD `done` después de integrar.
- *No verificado:* el `.env` vivo del servidor (no se leyó). Con esta rama ya no
  importa si las tres variables están vacías o ausentes.

**FUERA DE ALCANCE DETECTADO:**
- **`DOCUMENT_IMPORT_MODEL` con sólo espacios** (`lib/studio/document-import/anthropic.ts:37`):
  `""` ya apaga la lectura asistida con `configuration_missing` por el `!model`,
  pero `"  "` pasa y la llamada falla. No tiene default. Remedio: el mismo
  helper, sin respaldo, para que espacios cuenten como no configurado.
- **`CF_WHISPER_MODEL` con sólo espacios** (`lib/studio/bitacora/transcribe.ts:60`):
  usa `||`, así que `""` ya cae al default; `"  "` no. Es Cloudflare.
- **`ANTHROPIC_API_KEY` con sólo espacios** en los tres extractores: `!apiKey`
  descarta `""` (cae al mock), pero `"  "` pasaría como clave y daría error de
  autenticación en vez del mock. Es un secreto: le corresponde el helper de la
  0523 cuando esté en main, no este.
- Cuando la 0523 y la 0525 estén en main, `lib/runtime/` tendrá
  `firstConfiguredSecret` (no recorta) y `firstConfiguredSetting` (recorta), más
  el `nonEmpty` privado de `app-env.ts` (recorta). Si se quiere una sola fuente,
  `app-env.ts` podría usar `firstConfiguredSetting`; es un cambio de forma, no
  de conducta.

**HANDOFF AL DIRECTOR:**
- Siguiente acción: revisar la PR. Toca tres archivos de código con el mismo
  cambio de una expresión, un helper nuevo, pruebas y tres líneas de
  documentación operativa. No toca `lib/shared/`, contratos, migraciones ni
  infraestructura.
- Al integrar: el índice (`docs/specs/README.md`) tiene el driver de merge; si la
  0523 o la 0524 entran antes, regenerarlo con `pnpm docs:index`. Con la 0523 no
  hay otro archivo en común.
- La rama de reserva `codex/sdd-reserve-0525-modelos-anthropic-vacios` quedó
  local y sin publicar, como las anteriores; se borra con `-D` cuando la spec
  esté en main, con la comprobación de siempre.
- Sesiones consumidoras: ninguna aparte de esta. El claim se libera después del
  push y la PR. No se eliminan el worktree ni la rama.
