# Handoff 0485 — anon y authenticated pierden los privilegios residuales sobre las tablas de public

- Fecha: 2026-09-18 (cierre 2026-09-19, 00:2x UTC). Estado de la tarea: **lista para revisión**;
  PR draft contra `main` después del reporte al Director. SDD `in-progress`: pasa a `done` sólo
  cuando la 0465 esté aplicada y verificada en producción.
- Owner/sesión: `claude-75393e` (Claude Opus 5, Worker, sesión «Quitar a anon los privilegios
  residuales de public»). Director: `dtdcargo-18`, que asignó SDD y migración y leyó el catálogo.
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/anon-privilegios-residuales`.
- Rama: `codex/anon-privilegios-residuales`, creada con `harness-worktree start` desde `origin/main` =
  `1d80c18a`. Main se trajo después, a pedido de Sam: merge de `3f810366` en `0e6885d6`.
- SDD: [0485](../../docs/specs/0485-anon-privilegios-residuales/spec.md). La reserva es
  `codex/sdd-reserve-0485-anon-privilegios-residuales` (`3a94aa20`), incorporada por cherry-pick
  como `99bf135d`. El stub traía front-matter inválido (`status: reserved`, sin `sdd`, `title` ni
  `confidencialidad`): el Director lo corrigió en `a205ecdb`, y esta rama lo reemplaza por la spec
  completa con front-matter válido.
- Migración asignada: `0465_anon_privilegios_residuales.sql`. `sdd:next` ofrece 0462, pero
  0462–0464 ya estaban asignadas.
- Aislamiento: toplevel y rama comprobados; `guard` dio «Guard OK»; claim adquirido con el owner de
  arriba.
- Permisos del encargo: commits en esta rama; reportar al Director antes de abrir la PR; PR contra
  `main`. Sam pidió en esta sesión «sigue, corre verify y abre la PR». **No merge.** Producción:
  sólo lectura de catálogo, sin filas de negocio. La migración no se aplica sin OK nominal de Sam;
  la aplica el Director según `docs/runbooks/aplicar-migraciones-prod.md`.

## OBJETIVO ORIGINAL

Retirar a `anon` los privilegios residuales sobre las tablas de `public` sin romper nada (MAINTAIN,
REFERENCES y TRIGGER en 180 relaciones; SELECT en 5). Revisar también `authenticated` y los
`ALTER DEFAULT PRIVILEGES`. No quitar el SELECT de las 5 tablas sin revisar sus consumidores.
Migración nueva con preflight de catálogo, `lock_timeout` y `statement_timeout`, probada en PGlite
o en Postgres local.

## COMPLETADO

- **Lectura de catálogo de producción.** Esta sesión no tiene conector de Supabase. El Director
  corrió las consultas A–I (`docs/specs/0485-…/assets/catalogo.sql`, probadas antes en
  `supabase/postgres:17.6.1.165` local) el 2026-09-18 a las 22:3x UTC. Resultado resumido en la
  spec: 264 tablas y 2 vistas, todas de `postgres`; `anon` con M/R/T en 179+1 y SELECT en 5;
  `authenticated` con M/R/T en 195+1; default de `postgres` ya limpio; el de `supabase_admin` no.
- **Hallazgo que fijó el diseño:** `postgres` no puede cambiar los default privileges de
  `supabase_admin`. Medido en local (`ERROR: permission denied to change default privileges`) y
  confirmado por la lectura A (identidad `postgres`, no actúa como `supabase_admin`). La 0465 no
  los toca: incluirlos la haría abortar entera. Queda como límite residual documentado; hoy hay 0
  objetos de `supabase_admin` en `public`.
- **Consumidores de las 5 tablas** (código, archivo:línea en la spec): `news_posts` y
  `ve_locality_catalog` se leen como `anon` (`/noticias` con `getAnonClient()`; `/registro` antes
  del login). Las tres `back_*` no tienen consumidor `anon`. Por condición del Director, la 0465
  conserva el SELECT en las 5.
- **Migración `0465`**, sin aplicar. Un solo bloque DO con preflight de 8 chequeos, foto de ACL
  por OID (tabla y columna), `revoke maintain, references, trigger on all tables in schema public
  from anon, authenticated` y postflight. Tiene `set lock_timeout = '5s'` y
  `set statement_timeout = '30s'`. Si falla, no deja nada a medias, con o sin transacción externa.
- **Contrato** `supabase/tests/0465_anon_privilegios_residuales.test.sql`, con control positivo y
  5 contratos.
- **Prueba PGlite** `__tests__/anon-privilegios-residuales.migration.test.ts`, con 26 casos: el
  contrato, su control rojo, 11 preflights negativos, la atomicidad en autocommit, 6 mutantes del
  bloque, 2 de privilegios heredados, la guarda de timeouts y la cadena de L14 con su control rojo.
  Incluye un mini intérprete de psql (`\set`, `\if`, `\ir`) y monta en `/sb/` los archivos que los
  contratos leen con `pg_read_file`.
- **Espera declarada** en `supabase/migrations-baseline.json` (`pendingBelowCutoff`), con motivo,
  preflight, orden, locks, vuelta atrás y quién la destraba.
- **Spec 0485** completa e índice regenerado con `docs:index`.

## VALIDACIÓN

Corrida sobre el árbol de trabajo de esta rama (base `1d80c18a`), 2026-09-18.

| Comprobación | Resultado |
| --- | --- |
| Contrato 0465 en `postgres:17.11` (superusuario), con psql real | **PASÓ** |
| Contrato 0465 en `supabase/postgres:17.6.1.165`, como `postgres` **sin superusuario**, con los roles y defaults reales de la plataforma | **PASÓ** |
| Control rojo del contrato, sin la 0465, en la imagen de Supabase | **PASÓ** (falla en «CONTRATO 1 ROTO», como debe) |
| Cadena L14 con psql real en `postgres:17`: contratos completos de 0422 y 0423 con la 0465 después de 0371 | **PASÓ** (exit 0 los dos) |
| Control rojo L14 con psql real: sin SELECT de authenticated en user_tenants | **PASÓ** (0422 aborta con «0422 requiere SELECT de membresías propio/activo de0001/0200») |
| Prueba PGlite completa (26 casos) | **PASÓ**: dentro del paso `test` de `verify` sobre `415502e2`, y antes en corridas focales (L14 incluida) |
| Campaña de mutantes sobre el `.sql` (23 mutantes, pruebas PGlite sin L14, `--bail=1`) | **22 muertos, 1 sobrevive.** Sobrevive el chequeo de versión PG17: es equivalente en PG17/18, porque antes de PG17 el `REVOKE MAINTAIN` falla igual por sintaxis y la guarda sólo da un mensaje más claro. Mueren los mutantes de identidad, roles, dueño, grant option, los inventarios de anon/PUBLIC por tabla y por columna, las 5 tablas con y sin RLS, el default de postgres (por schema y global), los 7 chequeos del postflight, el revoke sin `authenticated` o sin MAINTAIN, y cada timeout de la cabecera. `.sql` restaurado: md5 `e87d4969…` igual antes y después |
| `scripts/check-schema-rebuild.mjs`: todas las migraciones desde cero en `postgres:17` | **PASÓ**: primero con una versión anterior de la 0465, después en `verify` con la final (440 aplicadas desde cero, 0465 incluida) |
| Locks y duración a escala de producción (264 tablas y 2 vistas, mismos conteos), `supabase/postgres` sin superusuario | **MEDIDO:** DO en 110–170 ms, COMMIT en 4–9 ms. Sólo AccessShareLock de catálogos; ningún lock en tablas de `public`. SELECT, INSERT y DELETE concurrentes no esperan; un ALTER concurrente espera hasta el COMMIT |
| `lock_timeout` contra un `ALTER TABLE` abierto, en autocommit | **MEDIDO:** corta a los 5,1 s y el residuo queda idéntico (180/196) |
| `docs:index` / `docs:check` / `sdd:check` | **PASÓ** (468 specs, sin números repetidos) |
| `check-pending-migration-symbols` | **PASÓ** (0 ROJO · 0 AMARILLO) |
| ESLint del archivo de prueba y `tsc --noEmit` del proyecto | **PASÓ** (exit 0) |
| `pnpm verify` sobre `415502e2` (2026-09-18, 23:30–00:16 UTC; con otro `verify` corriendo en paralelo en la máquina, según el Director) | ver filas siguientes |
| › harness, lint, rsc-boundary, typecheck, edge-functions (4) | **PASÓ** |
| › test | **FALLÓ por el flake de saturación conocido, no por una aserción.** Pasaron 7922 (los 26 casos PGlite de esta tarea incluidos). Cayó 1 en el intento y en el reintento: `app/p/[token]/PackingListProductsStep.test.tsx › adds another group…`, con `Test timed out in 20000ms`; el archivo tardó 83–90 s. No se tocó ni se marcó skip |
| › el flake, aislado sobre `415502e2` | **PASÓ**: `vitest run app/p/[token]/PackingListProductsStep.test.tsx`, 9 de 9 (66 s). Esta rama no cambia ningún archivo de `app/p/` |
| › docs:check, numbering, feature-constants, components:check, governance:check | **PASÓ** |
| › migrations-applied | **NO EJECUTADO**: `[SKIP]` sin credenciales, y no se copian credenciales de producción. La 0465 queda como espera declarada; `verify` lo marca como crítico sin medir |
| › pending-migration-symbols | **PASÓ** (0 ROJO · 0 AMARILLO) |
| › sql-tests | **PASÓ**: 199 contratos en `postgres:17` efímero, `0465_anon_privilegios_residuales.test.sql` incluido |
| › schema-rebuild | **PASÓ**: 440 migraciones desde cero, la 0465 final incluida; 18 sólo-ledger y aislamiento multi-tenant verificados |
| › e2e | **PASÓ con aviso**: 163 pasaron, 5 flaky, 18 omitidas y ninguna falló. El proceso salió ≠0 por el worker de WebKit que no cierra en Windows (aviso del propio gate) |
| › build | **PASÓ** |
| **Veredicto de `verify`** | **exit 1.** Su único fallo es el `test` de arriba, por el flake. Tiene además `migrations-applied` sin medir. Un exit 0 tampoco habría sido cierre completo, y el exit 1 no es un fallo de esta rama |
| **Merge de `origin/main`** (`3f810366`: PR #145, #147, #148 y #149) → `0e6885d6`, pedido por Sam y avisado al Director | **PASÓ**, sin conflictos. El driver de main resolvió `docs/specs/README.md`; después de regenerar con `build-docs-index.mjs` el árbol quedó limpio (470 specs). Main trajo una sola migración, la 0461 (retira el trigger de 0447, sin grants ni tablas), y dos contratos |
| Después del merge: `docs:check` / `sdd:check` / `pending-migration-symbols` | **PASÓ** (470 specs, sin números repetidos, 0 ROJO · 0 AMARILLO; siguen las esperas de 0422, 0423 y 0465) |
| Después del merge: contrato 0465 suelto en `postgres:17` y en `supabase/postgres` sin superusuario | **PASÓ** |
| Después del merge: `__tests__/anon-privilegios-residuales.migration.test.ts`, archivo único, sobre `0e6885d6` | **PASÓ**: 26 de 26, con la cadena de L14 corrida contra los contratos 0422/0423 de main |
| Compatibilidad con 0462 y 0464 (en sus ramas, sin integrar; la 0465 se aplica después de la 0462) | **REVISADO en lectura.** La 0462 crea `client_profile_blocked_attempts` con dueño `postgres`, `revoke all` y SELECT sólo para `service_role`; la 0464 sólo cambia el dueño de una función. Ninguna concede nada a `anon` ni saca tablas de `postgres`: el preflight de la 0465 sigue pasando después de ellas |
| `verify` completo después del merge | **NO EJECUTADO**, por indicación del Director: el merge sólo trajo archivos ajenos, y rige un turno a la vez para corridas pesadas. El CI de la PR corre sobre el head publicado |
| CI de la PR sobre `7bc92e30` (primer merge) | **PASÓ**: «Calidad local sin secretos», run 35409763272, success en 19 min 52 s, todos los pasos en verde. Vercel: pass |
| **Segundo merge de `origin/main`** (`26983062`, PR #150) → `b94bb96a`, pedido por Sam después de que entrara la #150 | **PASÓ**, sin conflictos. El driver dejó en el baseline las cuatro esperas (0422, 0423, 0464 y 0465); el índice regenerado quedó limpio (471 specs). La 0464 sólo cambia el dueño y el EXECUTE de `payment_private.run_report_command`: no toca privilegios de tablas ni el inventario de la 0465 |
| Después del segundo merge: `docs:check` / `sdd:check` / `pending-migration-symbols` / contrato 0465 suelto en `postgres:17` y `supabase/postgres` / prueba PGlite (26 casos) | **PASÓ** todo sobre `b94bb96a` |

## COMMITS

- `99bf135d` docs(SDD-0485): la reserva del Director (cherry-pick de `3a94aa20`).
- `61f5570f` docs(SDD-0485): spec, `assets/catalogo.sql` e índice regenerado.
- `d3eb1b96` fix(db): migración 0465 y su espera en `migrations-baseline.json`.
- `415502e2` test(db): contrato SQL y prueba PGlite con la cadena de L14.
- `e5d6c07a` docs(handoff): primer cierre del Worker.
- `0e6885d6` merge de `origin/main` (`3f810366`).
- `7bc92e30` docs(handoff): chequeos después del primer merge.
- `b94bb96a` merge de `origin/main` (`26983062`, con la #150).
- El commit que contiene este documento: registro del segundo merge.

## PR / BRANCH

- PR draft [#151](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/151): rama
  `codex/anon-privilegios-residuales` → base `main`, desde el worktree de arriba. Se abrió después
  del reporte al Director, por pedido explícito de Sam («sigue, corre verify y abre la PR»).
- Antes del merge, GitHub la marcaba `CONFLICTING` sólo por el índice generado (GitHub no tiene el
  driver semántico), y el CI de calidad no arrancaba. La #150 entra antes que esta: cuando entre,
  hay que traer main otra vez con el driver y repetir el push. `update-branch` no sirve.

## PENDIENTES DE ESTA TAREA

1. **Aplicación a producción**, fuera del alcance de esta sesión. La hace el Director con OK
   nominal de Sam que nombre `0465_anon_privilegios_residuales`, sola y con `name` exacto. Pasos:
   V0 (releer el inventario), V1 (guardar la lista para la vuelta atrás) y V2 (verificar), en la
   sección «Aplicación» de la spec. El Director la ordenó después de la 0462, sin urgencia, y la
   aprobó para pedir el OK cuando el CI de la PR esté en verde. Después: sacar la espera de
   `pendingBelowCutoff` y pasar SDD-0485 a `done`.
2. **Si otra PR entra antes que esta**, traer main otra vez igual que con la #150: con el driver
   de main, regenerar con `build-docs-index.mjs`, repetir `docs:check`, `sdd:check`, el contrato
   suelto y la prueba PGlite, y hacer un solo push. `update-branch` de GitHub no sirve, porque no
   usa el driver.

## FUERA DE ALCANCE DETECTADO

1. **`back_servicios`, `back_noticias`, `back_glosario`: SELECT y policy para `anon` sin
   consumidor.** Vienen de `0030_back_content_admin.sql:275-277` y de las policies de 339-413. El
   comentario de 272-274 decía que el sitio las leería «eventualmente». El único lector es
   `app/back/(app)/page.tsx:16-18`, como `authenticated`. Sólo muestran filas `is_published`; si
   se retiran, que sea una SDD aparte, después de confirmar que no hay consumidor externo con la
   anon key.
2. **Default privileges de `supabase_admin` en `public`** (tablas, funciones y secuencias para
   `anon` y `authenticated`). `postgres` no los puede cambiar. Hoy no afectan nada, pero un objeto
   que cree `supabase_admin` en `public` (por ejemplo, una extensión instalada ahí) nacería abierto.
   Se resuelve con soporte de Supabase o con la regla de no instalar extensiones en `public`.
3. **Default privileges de `postgres` en `storage`** (lectura F): tablas, funciones y secuencias
   para `anon` y `authenticated`. Es un schema administrado por Supabase; la 0399 también lo dejó
   fuera.
4. **El contrato de 0399 no está en main.** La cabecera de la migración 0399 cita «el contrato que
   acompaña a esta migración», pero
   `supabase/tests/0399_revoke_truncate_anon_authenticated.test.sql` sólo existe en
   `origin/codex/saneamiento-integral` (commit `5dde643f`).
5. **Comentarios que no cuadran con el código:**
   - `eslint.config.mjs:57-58` dice que `app/registro/` usa el admin client con el visitante
     anónimo. Es cierto para `actions.ts`, pero `page.tsx:52,75` lee `ve_locality_catalog` como
     `anon`.
   - `lib/news/queries.ts:6` y `app/noticias/[slug]/opengraph-image.tsx:23` dicen `createClient()`
     con cookies; hoy es `getAnonClient()` (`lib/public/news-queries.ts`).
   - `lib/news/slugify.ts:56-58` dice que para borradores «el admin policy aplica», pero `0055`
     no tiene policy SELECT de admin (sólo insert/update/delete): el `dedupSlug` del Studio sólo
     ve filas publicadas. El UNIQUE de `news_posts.slug` sigue siendo la guarda final.

## HANDOFF AL DIRECTOR

- Siguiente acción: revisar la PR; integrar con main cuando corresponda. La aplicación de 0465
  queda para después, con OK nominal de Sam.
- Cambios compartidos: `supabase/migrations-baseline.json` (una clave nueva en
  `pendingBelowCutoff`) y `docs/specs/README.md` (índice generado). No toca código de producto.
- L14: la 0465 es independiente del orden de 0422/0423 y sus preflights siguen pasando
  (PGlite y psql real).
- Regla del Director recibida durante el `verify`: una sola corrida pesada a la vez (verify
  completo, suite completa de vitest, suites Docker), con turno pedido antes. Este `verify` ya
  estaba en marcha; queda registrada para lo que sigue.
- Sesiones consumidoras: ninguna. Ownership: se libera el claim `claude-75393e` al terminar la
  escritura; el worktree y la rama se conservan.

## Impacto documental y conocimiento

- Documentos canónicos: la spec 0485 (nueva, con `assets/catalogo.sql`), el índice de specs y la
  espera en el baseline. No cambian runbooks ni AGENTS. La regla «revoke explícito» y el runbook
  de migraciones siguen vigentes tal como están.
- `knowledge:status` sobre `415502e2` (JSON, sólo lectura) da:
  - estructura **INVALID**: este worktree nuevo no tiene `graphify-out`, con 3124 faltantes y
    4228 pendientes;
  - semántica **INVALID**, aunque ninguna fuente del piloto `semanticPilot` cambió, así que no hace
    falta recibo semántico;
  - Archify **PENDING** (`ARCHIFY_RUNTIME_MISSING`);
  - Obsidian **PENDING**: la bóveda sigue en `30a9f890`.
- `graphify update .`: **NO EJECUTADO**. Es una corrida pesada sobre todo el repo y, por la regla
  de un turno a la vez, no se lanzó sin turno. El derivado es ignorado; el Director actualiza
  Graphify desde main integrado.
- `knowledge:visual` / `knowledge:visual:check`: **NO EJECUTADO**, no aplica. Ninguna fuente de
  `knowledge-lifecycle.archify.json` ni de `scripts/knowledge-visual-evidence.json` cambió, y en
  este worktree falta el runtime de Archify v2.16.0.
- `knowledge:publish --preview`: **NO EJECUTADO**. Sin estructura Graphify local, la preview no
  mostraría nada revisable de esta tarea.
