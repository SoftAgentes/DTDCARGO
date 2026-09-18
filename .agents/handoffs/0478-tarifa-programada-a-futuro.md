# Handoff 0478 — Programar la próxima tarifa pública sin dejar el sitio sin tarifa

- Fecha: 2026-09-18. Estado de la tarea: **lista para revisión** (PR draft). SDD `in-progress`: pasa
  a `done` cuando la 0459 esté aplicada y ocurra el primer relevo real.
- Owner/sesión: `worker-tarifa-programada-0478-dtdcargo-2e-20260918` (Claude Opus 5, Worker,
  sesión `dtdcargo-2e`, «Tareas pendientes del worker»). Asignó el Director `dtdcargo-18`;
  supervisa `dtdcargo-53`.
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/tarifa-programada-a-futuro`.
- Rama: `codex/tarifa-programada-a-futuro`, desde `origin/main` = `78410913`.
- SDD: [0478](../../docs/specs/0478-tarifa-programada-a-futuro/spec.md), reservado por el Director
  (`codex/sdd-reserve-0478-tarifa-programada-a-futuro`, stub incorporado por cherry-pick).
  Migración asignada: `0459_tarifa_programada_a_futuro.sql`.
- Aislamiento comprobado antes de editar: rama y toplevel correctos, `guard` → `Guard OK`, claim
  adquirido con el owner de arriba.
- Permisos del encargo: commits en esta rama, push de la rama propia y PR **draft** contra `main`,
  reportando al Director antes de abrirla. **No merge. No producción. No aplicar la 0459.**
  No tocar `lib/calculadora.ts` ni `__tests__/calculadora-respaldo-alineado.test.ts` (los tiene
  `dtdcargo-c9`).

## OBJETIVO ORIGINAL

Cerrar la ventana en que el sitio queda sin tarifa al programar una a futuro (FUERA DE ALCANCE nº 1
del handoff de SDD-0476), con su propia SDD. La tarifa DDP vigente ($850) vale hasta el
2026-11-29 y la siguiente tiene que poder cargarse antes sin abrir el hueco.

## COMPLETADO

- **Diseño (B) elegido y documentado en la spec:** una ranura **programada** al lado de la pública
  (`rates.publica_programada`) y un relevo atómico en la base (`promover_tarifas_programadas()`),
  que corre `pg_cron` cada hora al minuto 5 y decide con el **día de Caracas**. Se descartó (A)
  indexar `valid_from` porque apagaba el aviso de segunda pública, dejaba relevadas públicas para
  siempre y relevaba a las 20:00 de Venezuela. **El índice singleton de 0255 no se tocó**, ni
  `public_cbm_rate` (0458, aplicada), ni `rates_guard_price_book` (0382).
- **Migración 0459** (sin aplicar): columna, check, índice «una programada por modalidad», guard
  (archivar/borrar suelta la programación; borrador y aliado se rechazan), función de relevo
  `security definer` sólo para `service_role`, y job `tarifas-programadas-relevo`. Espera declarada
  en `migrations-baseline.json` con preflight, locks y vuelta atrás.
- **Studio** (`/studio/tarifas`): casilla «Programada: reemplaza a la pública en su fecha»,
  excluyente con «Tarifa pública del calculador» al marcar; validación en el servidor (futura, por
  CBM, no pública a la vez, con fecha); badge en la lista («Programada · 30/11», «· hoy», «· no
  entró» en rojo); rechazos de la base traducidos; el aviso de segunda pública sigue y ahora propone
  programar (y pasa de voseo a tuteo).
- **Degradación migrate-first:** la ranura se lee en una consulta aparte; sin la 0459 la pantalla no
  se cae, la opción no aparece y el guardado no nombra la columna. Declarada para el gate de
  símbolos pendientes (0 ROJO · 1 AMARILLO).
- `/ui-check`: midió el badge en Nunito Sans 700 a 10,5 px; «Programada · entra el 30/11» ocupaba
  173 px en una columna de 170 → corregido a «Programada · 30/11» (131 px). Techo medido: 146 px.

## VALIDACIÓN

| Comprobación | Resultado |
| --- | --- |
| `lib/studio/tarifa-programada.migration.test.ts` (0459 real sobre PGlite, con el índice de 0255, el guard de 0382, la RPC de 0458 y los privilegios por defecto de Supabase) | **PASÓ** — 19 casos, incluido el **control rojo** sin la 0459 |
| Mutantes del `.sql` (23) | **21 muertos.** Sobreviven: el `grant` a `service_role` (equivalente: los defaults de Supabase ya se lo dan; explícito como en 0336) y el `for update` (concurrencia entre dos corridas, no medible con la única conexión de PGlite). `.sql` restaurado: md5 igual antes y después |
| Mutantes del Studio (13) | **13 muertos**, archivos restaurados |
| Pruebas nuevas y afectadas del Studio (`tarifa-programada.test.ts`, `actions.programada.test.ts`, `RateDrawer.test.tsx`, `rate-types.test.ts`, `rate-import.test.ts`) | **PASÓ** |
| `pnpm verify` — lanzado sobre `cb9b30bc`; el ajuste de `/ui-check` (`46673236`) se escribió durante el paso `harness`, **antes** de `lint`, así que los pasos siguientes midieron el árbol final | ver filas siguientes |
| › harness | **PASÓ** |
| › lint | **PASÓ** |
| › rsc-boundary | **PASÓ** |
| › typecheck | **PASÓ** |
| › edge-functions | **PASÓ** (4) |
| › test | **FALLÓ por el flake de saturación conocido, no por aserciones**: 7837 pasaron, 1 cayó en intento y reintento: `app/p/[token]/PackingListProductsStep.test.tsx › adds another group…` (`Test timed out in 20000ms`, 22,6 s y 30,7 s). El Director lo anticipó; esta rama no toca `app/p/`. No se tocó ni se marcó skip |
| › docs:check / numbering | **PASÓ** (465 specs) |
| › migrations-applied | **NO EJECUTADO** — `[SKIP]` sin credenciales; no se copian credenciales de producción |
| › pending-migration-symbols | **PASÓ** — 0 ROJO · 1 AMARILLO declarado |
| › sql-tests | **PASÓ** — 197 contratos en `postgres:17` efímero (esta vez **sí** había Docker) |
| › schema-rebuild | **PASÓ** — 456 migraciones desde cero sobre `postgres:17`, **0459 incluida** (no está en `LEDGER_ONLY`; `pg_cron` con los stubs de plataforma); aislamiento multi-tenant verificado |
| › e2e | **PASÓ con cobertura PARCIAL** — 153 en verde, 0 caídas, 33 omitidas (15 por falta de Supabase público; el gate lo declara crítico con cobertura parcial) |
| › build | **PASÓ** — build de producción OK; el paso restauró `tsconfig.json` después de que Next le inyectara el `distDir` |
| **Veredicto de `verify`** | **exit 1**, con un solo fallo: `test`, por el flake de arriba. 16 de 17 pasos se midieron de verdad; `migrations-applied` quedó sin medir y `e2e` con cobertura parcial. **Exit 0 no habría equivalido a cierre completo, y exit 1 no es un fallo de esta rama** |
| El flake, aislado sobre esta rama | **PASÓ** — `vitest run app/p/[token]/PackingListProductsStep.test.tsx`: 9 de 9. `git diff origin/main...HEAD -- app/p/` vacío |
| **Merge de `origin/main`** (`56fa2ae0`, PR #136: 0458 aplicada y fuera del baseline) → `1f061f9d` | **PASÓ** — sin conflictos. El driver semántico resolvió `migrations-baseline.json`: queda la espera de la 0459 y ya no la de la 0458 |
| Después del merge: `docs:check` / `sdd:check` / `pending-migration-symbols` / `typecheck` | **PASÓ** — 465 specs, sin números repetidos, 0 ROJO · 1 AMARILLO, exit 0 |
| Después del merge: pruebas afectadas (0459 sobre PGlite, Studio de tarifas, `rate-types`, la 0458 sobre PGlite, el anclaje del respaldo que tocó la #136) | **PASÓ** — 8 archivos, 100 casos |
| `git diff --check` | **PASÓ** |
| CI alojado de la PR | Se reporta al Director por mensaje (la rama se congela al publicar) |
| Aplicación de la 0459 a producción | **NO EJECUTADO** — prohibido por el encargo |
| Lectura de filas de negocio en producción | **NO EJECUTADO**. Sí se leyó metadata: `list_migrations` (ledger: 0255 aplicada `20260720194914`, 0458 aplicada `20260918040814`) y la API pública `/api/public/cbm-rate` |

## COMMITS

| Commit | Propósito |
| --- | --- |
| `882bdbcf` | stub de reserva de SDD-0478 (cherry-pick de `1da82c8f` del Director) |
| `101173c1` | `feat(db)`: migración 0459 y su espera en el baseline |
| `9c6a3d1c` | `test(db)`: la 0459 sobre PGlite, control rojo y mutantes; se quita `p.id <> v_row.id` (sobraba) |
| `559db511` | `feat(studio)`: programar desde `/studio/tarifas`, degradación declarada |
| `cb9b30bc` | `docs(SDD-0478)`: la spec y el índice (465) |
| `46673236` | `fix(studio)`: el badge cabe en su columna (hallazgo de `/ui-check`) |
| `1f061f9d` | merge de `origin/main` (`56fa2ae0`), sin rebase |
| el commit que contiene este documento | `docs(handoff)`: este handoff |

## PR / BRANCH

- Rama `codex/tarifa-programada-a-futuro`, base `main`, worktree de arriba. La rama se publicó
  temprano (sólo `101173c1`) para que el número 0459 fuera visible fuera de este clon.
- PR draft: se abre después de reportar al Director.

## PENDIENTES DE ESTA TAREA

1. **Aplicar la 0459** — Sam, nombrándola, con `docs/runbooks/aplicar-migraciones-prod.md`, y
   confirmando antes con el Director que no haya otra aplicación en curso. Preflight: el propio
   archivo aborta si faltan sus dependencias.
2. Verificar en producción: ledger, columna, check, índice, trigger, función sólo para
   `service_role` y el job en `cron.job`.
3. **Integrar la PR después de aplicar** (migrate-first) y retirar la espera del baseline y la
   degradación declarada.
4. Cargar la tarifa que rija después del 2026-11-29 como programada antes de esa fecha; la spec
   pasa a `done` con el primer relevo real verificado en `/api/public/cbm-rate`.

## FUERA DE ALCANCE DETECTADO

1. **AUD-01: `rates` no es entidad de auditoría.** Ni la edición del Studio ni el relevo de la 0336
   dejan evento; el relevo nuevo tampoco (deja su resumen en `cron.job_run_details`, que no es un
   evento AUD-01). Arreglarlo es dar de alta la entidad `rate` y auditar ediciones y relevos: tarea
   propia con su SDD.
2. **Nadie avisa fuera del Studio si un relevo no corre.** El cron `rate-expiry-alert` que ya
   existe podría sumar «programada que no entró»; hoy sólo la lista lo marca en rojo.
3. **El recargo de baterías no coincide: `CONFIG.recargoBateriaMult = 1.3`
   (`lib/calculadora.ts:142`) contra 1,5 en el ERP** (props públicas de `dtdcargo.com/tarifas`,
   2026-09-18). **No se sabe cuál es el correcto.** `535aa0ec` (Sam, 2026-08-05) dejó ×1,3 como
   lo que cobraba el ERP, y ninguna migración lo cambió después. O sea que el 1,5 se editó a mano, y
   puede ser una decisión o un error (en ese caso el sitio cobra las baterías un 15 % por encima).
   El Director se lo pregunta a Sam; `dtdcargo-c9`, dueño del archivo, espera esa decisión. No se
   tocó.
4. **El drawer no pone foco en el primer error** (FRM-01): preexistente, de todo el formulario.

## TAREA 3 (asignada aparte por el Director): la cabecera de la 0255 — NO APLICA

Hallazgo nº 2 del handoff de SDD-0476: la cabecera de `0255_rates_public_calc_modo.sql` dice
«⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en … pendingBelowCutoff», y es falso.

- **Aplicada:** ledger de producción `20260720194914 · 0255_rates_public_calc_modo`
  (`list_migrations`, 2026-09-18, sólo metadata). El Director lo verificó por su lado.
- **El baseline ya no la declara:** en `pendingBelowCutoff` la 0255 no es clave. Al comprobarlo, en
  `main 78410913`, las esperas eran 0415, 0414, 0422, 0423 y 0458, y la 0255 solo aparecía
  *citada* en el texto de la espera de la 0458. Hoy, con la #136 integrada, son 0415, 0414, 0422
  y 0423, más la 0459 que agrega esta rama.
  Salió del registro el 2026-07-20 con `1b394b63` («0255 y 0256 aplicadas a prod — fuera del
  registro de esperas»), el mismo día que la escribió `fa82d4cf`. `cutoff` es 238, así que con
  credenciales el gate `migrations-applied` la exige aplicada, y lo está.
- **El `.sql` NO se edita**, por orden del Director: una migración aplicada es inmutable
  (precedente de la 0473) y la aplicación se verifica comparando md5 y bytes del blob contra el
  ledger; tocar un comentario rompe esa identidad.
- **Resultado:** no aplica. No hay nada que corregir en el baseline. La cabecera sigue diciendo
  lo contrario de la verdad: quien lea la 0255 tiene que contrastarla con el ledger o con este
  registro.

## IMPACTO DOCUMENTAL

- Canónicos: la spec 0478 (nueva) y `docs/specs/README.md` (regenerado por script, 465 specs).
  Documentación en código: cabecera de la 0459 y comentarios de `rate-queries.ts`/`rate-types.ts`.
- No aplica: `BRAND.md`/`docs/design/**` (sin tokens ni componentes nuevos; `/ui-check` corrido),
  `docs/marketing/**`, `docs/governance/**` (clasificación en la spec, sin política nueva).
- Handoffs históricos: ninguno editado.
- **Graphify 0.9.61, estructural:** `graphify update .` sobre `1f061f9d` (34.900 nodos, 65.280
  aristas). En
  `knowledge:status` queda 0 pendientes y 0 faltantes, pero el estado es PENDING por dos nodos
  virtuales de módulos externos (`react`, `@testing-library/react`) que aparecen en
  `structural.deleted`. Es el mismo estado que registró la 0475 y el que muestra hoy el checkout
  principal. No se «reparó»: el runbook prohíbe descartar rutas externas sin investigarlas.
- **Semántica:** ninguna de las 16 fuentes del piloto está en el diff, así que esta tarea no debe
  recibo. La cobertura global sigue PENDING (1.093), que es el backlog de siempre.
- **Archify:** NO DISPONIBLE (`ARCHIFY_RUNTIME_MISSING` en el worktree). El mapa
  `knowledge-lifecycle` no depende de estas fuentes.
- **Obsidian:** `knowledge:publish --preview` dio `ok: true` en `1f061f9d`, con 0 conflictos y 39
  avisos de enlaces, todos ajenos a esta rama. El primer intento lo cortó un `timeout` de 400 s
  que puse yo (exit 124) con la máquina saturada; el segundo, sin límite, terminó bien. La bóveda
  compartida no se tocó: la publica el Director desde `main` integrado.

## HANDOFF AL DIRECTOR

- **Siguiente acción:** revisar la PR draft; la decisión de diseño primero (B contra A, en la
  spec). Después, pedirle a Sam la 0459 nombrándola; integrar **después** de aplicarla.
- **Cambios compartidos:** `supabase/migrations-baseline.json` (la espera 0459; la de la 0458 ya
  la retiró la #136, y el merge `1f061f9d` lo resolvió con el driver semántico),
  `supabase/pending-migration-symbol-declarations.json` y `docs/specs/README.md`.
- **Sesiones consumidoras:** ninguna fuera de esta. El claim se libera al terminar la escritura;
  worktree y rama se conservan.
