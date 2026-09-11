# Handoff — pending-symbols-do-blocks

- Fecha: 2026-09-11
- Owner: sesión Worker `claude-e5b69cae-891c-42a0-9943-5b8668816f0e` (Claude Code), encargo de Sam en el chat
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/pending-symbols-do-blocks`
- Rama: `codex/pending-symbols-do-blocks`, creada con `node scripts/harness-worktree.mjs start pending-symbols-do-blocks`
  - Base: `origin/main` = `07d000970011ee12364e31124ebe4b301f064b40`, que ya incluye la PR #79 (merge `b7e8b484`, corrección UTF-16).
  - Merges de `origin/main`, todos sin conflictos:
    - `47fca222…` (#70 y #72);
    - `bbc7493f…` (#73, #74, #81 y #85);
    - `4eedeb8a322c1a722c66bb81aa94faa00a4bee95` (#84 y #92), pedido por la revisión del Director.
  - Publicada en `origin` sin force push. El head validado es `a78efa53`; el publicado es el commit que contiene este documento.
- SDD: `docs/specs/0450-codigo-contra-migraciones-eximidas/spec.md` (`done`)
  - Enmienda «Corrección 2026-09-11: DDL en bloques DO», con su apartado «Revisión de #90».
  - Frontmatter intacto: `updated` ya era 2026-09-11. No se reservó número nuevo.
- Estado de tarea: lista-para-revision.
  - Revisión del Director sobre `fd2cb77a`: LISTA TRAS ACTUALIZAR ([comentario](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/90#issuecomment-5639376158)).
  - La actualización y los opcionales H1, H2, H4 y H6 ya están aplicados.
- PR: https://github.com/hailuwaycom-sketch/DTDCARGO/pull/90, draft, base `main`. No se pasa a ready: el CI está bloqueado por la facturación de GitHub Actions.
- Dependencias: ninguna para integrar. Cambia el veredicto de la PR #80 (L17); ver HANDOFF AL DIRECTOR.
- Permisos:
  - commits selectivos;
  - publicación de la rama propia y PR draft, autorizadas por Sam en el chat;
  - Auto-fix de la PR activado por Sam;
  - actualización pedida por el Director.
  - Sin merge, producción ni migraciones.
- Evidencia local, fuera de Git: `C:/Users/AKX generator/AppData/Local/Temp/claude/C--Users-AKX-generator-Desktop-Developer-DTDCARGO--claude-worktrees-lucid-ellis-58ec99/e5b69cae-891c-42a0-9943-5b8668816f0e/scratchpad/`
  - Copias de checkers: `old-checker.mjs` (versión de `07d00097`) y `prev-checker.mjs` (versión de `fd2cb77a`, sin H1).
  - `survey.mjs`, con los informes `survey-main.json` (`07d00097`), `survey-main-47fca222.json`, `survey-main-bbc7493f.json`, `survey-main-4eedeb8a.json` y `survey-l17.json`.
  - `l17/`: extracción `git archive` de `07e54dfc`.
  - Scripts de mutación e impacto: `mutations.mjs`, `impact.mjs`, `impact-open-prs.json` e `impact/`.
  - Logs `harness-test*.log` y `lint.log`.
  - `pr-body.md`.
- Último resultado: revisión aplicada, validada y publicada.
- Siguiente paso: que el Director revise el delta desde `fd2cb77a` e integre en el orden que decida. Este Worker no fusiona.

## OBJETIVO ORIGINAL

El gate `pending-migration-symbols` (SDD-0450) debe detectar, o permitir declarar de forma verificable, los símbolos creados con DDL dinámico en bloques DO de migraciones pendientes. Sin falsos positivos masivos y sin debilitar el contrato.

Caso real: `0426_public_verify_atomic_reservation` de L17 (PR #80).
- `maskSqlNonCode` enmascaraba el cuerpo `DO $migration$`, así que el gate daba 0 ROJO en falso.
- Declarar el símbolo daba exit 2.

La alternativa elegida se documenta en una enmienda de SDD-0450.

## ACEPTACIÓN ASIGNADA

1. Prueba en `scripts/tests/*.node.mjs`: una migración pendiente con una función creada en un bloque DO y llamada desde TS da ROJO.
2. `corepack pnpm harness:test` en verde.
3. `node scripts/check-pending-migration-symbols.mjs` sobre main sigue en 0 ROJO.
4. Comparación sobre la rama de L17 extraída con `git archive`, sin tocar su worktree.
5. Commits selectivos; push y PR draft solo con autorización de Sam; sin merge.
6. Este handoff, con el cierre del runbook.

La revisión del Director añadió:

- como obligatorio: merge de `origin/main` sin rebase; `harness:test`, checker, `docs:check`, `sdd:check` y `diff --check`; push sin force;
- como opcionales, en commit aparte: H1, H2, H4 y H6.

## ALCANCE

- Tocados:
  - `scripts/check-pending-migration-symbols.mjs`;
  - `scripts/tests/pending-migration-symbols-do-blocks.node.mjs` (nuevo);
  - `docs/specs/0450-codigo-contra-migraciones-eximidas/spec.md`;
  - este handoff.
- Sin tocar:
  - `supabase/**`: migraciones, baseline y declaraciones;
  - `app/**` y `lib/**`;
  - `scripts/verify*.mjs`, `.github/**` y el Vitest existente;
  - `docs/specs/README.md`, porque `docs:check` sigue sincronizado.
- `git diff origin/main HEAD` muestra solo los tres archivos de harness, más este handoff.

## COMPLETADO

### Alternativa elegida

1. **Elegida: extraer el DDL que corre en bloques DO.**
   - Se lee el código del cuerpo de cada `DO [LANGUAGE plpgsql]`.
   - Dentro de él se leen los literales pasados directamente a `EXECUTE`, solos o como plantilla de `[pg_catalog.]format()`.
   - Sigue siendo repo contra repo: sin credenciales, red, Docker ni SKIP.
   - No depende de que el autor recuerde anotar nada.
2. **Descartada: anotación en la migración, validada contra el catálogo efímero de `check-schema-rebuild`.**
   - `schema-rebuild` sale con SKIP sin Docker o con `VERIFY_SKIP_SQL=1` (`scripts/check-schema-rebuild.mjs:25,111-118`). La validación heredaría ese SKIP y rompería la propiedad «sin SKIP» de SDD-0450.
   - Hoy solo mide una huella de esquema para `LEDGER_ONLY` (`:255-290`).
   - Si alguien olvida la anotación, el punto ciego sigue igual.
3. **Descartada: desenmascarar todo el dollar-quoting.**
   - Leería el DDL de cuerpos de función, que solo corre al invocarlos.
   - La prueba Vitest existente exige ignorar `execute 'create table public.dynamic_only…'` dentro de una función (`scripts/check-pending-migration-symbols.test.mjs:21-43`).

### Corrección del checker

Todo el cambio está en `scripts/check-pending-migration-symbols.mjs`:

- **`scanSql(sql)`**, privado, es la misma máscara por unidades UTF-16 de antes.
  - Además devuelve cada literal con su posición y su texto sin comillas; en los simples, `''` pasa a `'`.
  - `maskSqlNonCode` conserva su export y su contrato (`scanSql(sql).code`).
  - La etiqueta dollar se lee con una regex *sticky*, equivalente a la anterior.
- **`executedSqlViews(sql)`** devuelve las vistas de código que corren al aplicar la migración:
  - el texto enmascarado;
  - el cuerpo de un literal precedido por `do` o por `do language plpgsql`;
  - dentro de PL/pgSQL, el literal precedido por `execute`, `execute (`, `execute format (` o `execute pg_catalog . format (`.
  - Sigue hasta cuatro niveles de anidamiento.
- **H1:** un `execute` precedido por `.` es una función de usuario (`esquema.execute(…)`), no la sentencia.
  - `tokensBefore` mira siete tokens: los de la forma más larga, más el anterior a `execute`.
- **Formas DDL:** las cuatro se aplican a cada vista.
- **Guarda de nombre completo (`NAME_END`):** al nombre no puede seguirle ningún carácter de identificador, `"`, `%`, un punto ni el fin del fragmento. Tampoco cuentan como nombre `if [not] exists` ni `only`.
- **Sin cambios:** la API exportada, el grafo, las declaraciones, los niveles y el formato de salida.

### Pruebas del harness

`scripts/tests/pending-migration-symbols-do-blocks.node.mjs` tiene ocho casos:

1. **ROJO exacto.** Una RPC creada con `EXECUTE pg_catalog.format($ddl$ … $ddl$, v_body)` dentro de `do $migration$` (forma de 0426, con astrales) se llama desde `lib/public/fixture-throttle.ts:5`, alcanzable desde `app/verificar/page.tsx`. `revoke`, `grant`, `comment` y `to_regclass` no crean símbolos.
2. **AMARILLO.** La declaración anclada a `:5`, con evidencia en `:10`, pasa como AMARILLO.
3. **DDL estático.** Se extrae el de un DO (tabla, `add column` y función), el de `do language plpgsql`, un literal simple con comillas escapadas y `format()` sin marcadores.
4. **Redefinición.** Una función creada en un DO aplicado y redefinida por una pendiente no es ausencia.
5. **Formas adicionales (H4).** Anidamiento DO → EXECUTE → DO, `execute (…)`, palabras clave en mayúsculas y un DO con cuerpo entre comillas simples.
6. **Guarda de literales no ejecutados.** Cuerpos de función, asignaciones, `raise`, `perform format()`, comentarios, `comment on … is` y datos con `on conflict do nothing` no crean símbolos.
7. **Guarda de nombres calculados.** No dan símbolos falsos: `%I.%I`, `public.%I`, `if not exists %I`, `fixture_%s`, `alter table if exists only %I` ni `'…_' || sufijo`.
8. **Guarda de `esquema.execute(…)` (H1).** `public.execute('…')`, `ops.execute(pg_catalog.format('…'))` y `"Ops".execute('…')` no crean símbolos.

Resultados por versión del checker:

| Checker | Pasan | Fallan |
|---|---|---|
| `07d00097` (copia aislada, anterior a la corrección) | las guardas 6-8 | los casos de extracción 1-5 |
| `fd2cb77a` (primera versión, sin H1) | 7 de 8 | solo el caso 8 |
| nuevo | 8 de 8 | ninguno |

Mutaciones del checker nuevo:

- sin la guarda de nombre completo, falla el 7;
- entrando en todo literal (desenmascarado ingenuo), fallan el 6 y el 8;
- entrando en cualquier literal de un DO, fallan el 6 y el 8;
- sin bloques DO, fallan los casos 1 a 5.

### Revisión del Director y seguimiento

- **Obligatorio.**
  - Merge `d765da1b` de `origin/main` `4eedeb8a`, sin rebase y sin conflictos.
  - Validaciones listadas en VALIDACIÓN.
  - Push sin force.
- **H1.** `esquema.execute(…)` deja de leerse como `EXECUTE`, con su caso de prueba (8).
- **H4.** Caso 5: anidamiento, `execute (…)`, mayúsculas y DO entre comillas simples.
- **H2.** «Límites que persisten» de la enmienda suma cinco puntos:
  - `do language '…'`;
  - `execute concat(…)`;
  - `E'…'`;
  - nombres cortados con `||`;
  - una función `execute` invocada sin esquema.
  - Ninguno aparece hoy en las 428 migraciones de `4eedeb8a`.
- **H6.** Esta versión del handoff: head actualizado y CI verificado.

### Extracción antes y después, en todas las migraciones

| Árbol | Migraciones / con DO / cuerpos DO | Símbolos extraídos | Pendientes-únicos (antes → después) | Gate |
|---|---|---|---|---|
| main `07d00097` + corrección | 421 / 140 / 215 | 1081 → 1082, sin pérdidas | ninguno → ninguno | `0 ROJO · 0 AMARILLO` en ambos |
| main `47fca222` + corrección (`75d818b2`) | 423 / 142 / 219 | 1082 → 1083, sin pérdidas | `portal_can_read_conversation_message` (0433) → igual, en silencio | `0 ROJO · 0 AMARILLO`, exit 0 |
| main `bbc7493f` + corrección (`aff9d8c1`) | 427 / 146 / 226 | 1083 → 1084, sin pérdidas | igual, en silencio | `0 ROJO · 0 AMARILLO`, exit 0 |
| main `4eedeb8a` + corrección y revisión (`a78efa53`) | 428 / 147 / 228 | 1083 → 1084, sin pérdidas | igual, en silencio | `0 ROJO · 0 AMARILLO`, exit 0 |
| L17 `07e54dfc` (`git archive`) | 421 / 140 / 214 | 1080 → 1082 | ninguno → `reserve_public_verify_attempt` (0426) | anterior `0 ROJO`, exit 0 → nuevo `1 ROJO`, exit 1 |

- **Único símbolo nuevo en main:** `column:public.fiscal_settings.iva_withholding_agent`, en todos los árboles.
  - Viene de `0141_fiscal_module_v2_seniat.sql:98-99`, un `add column` condicional dentro de un DO.
  - La migración está aplicada, así que suma a los símbolos existentes y no crea ausencias.
  - Ninguna migración sin DO cambia su extracción. Los módulos alcanzables siguen siendo 1637.
- **Inventario de DO**, igual en `47fca222`, `bbc7493f` y `4eedeb8a`:
  - Hay siete literales de `EXECUTE` en DO y ninguno contiene DDL cubierto.
  - Hay un único `EXECUTE` de variable: `0296_audit_d4_empty_search_path.sql:68`, `execute v_after`. Es una redefinición de `operario_action`.
  - Dos literales con DDL no se siguen, y es correcto: las etiquetas `'CREATE TABLE'` y `'CREATE TABLE AS'` del event trigger de 0277.
- **Tiempo de extracción:** entre 0,1 y 0,5 s para 421-428 migraciones, según la carga de la máquina. Es del mismo orden que el checker anterior.

### L17, sin tocar su worktree

- Comprobado en solo lectura: el worktree de L17 está en la rama `codex/c-l17-verificar-throttle`, con HEAD `07e54dfc` igual al remoto y status limpio.
- Sobre la extracción:
  - **Checker anterior:** `0 ROJO · 0 AMARILLO`, exit 0.
  - **Checker nuevo, incluido el final `a78efa53`:** `[ROJO] reserve_public_verify_attempt (function; 0426_public_verify_atomic_reservation)` en `lib/public/verify-throttle.ts:27`, exit 1.
- **Declaración de demostración** en la copia descartable (llamada en `:27`, evidencia en `:42`):
  - checker anterior: exit 2, «no identifica un único símbolo pendiente ausente»;
  - checker nuevo: `0 ROJO · 1 AMARILLO`, exit 0.
  - Después se restauró el archivo de la copia, y `cmp` confirmó que es idéntico al blob de L17.

### Impacto en PRs abiertas

Se analizaron los 13 heads que estaban abiertos tras `git fetch origin`: #21, #73, #74, #75, #76, #77, #78, #80, #81, #82, #83, #84 y #85. De cada uno se extrajo `supabase/` con `git archive`.

- **#80:** es el único cuyo conjunto de pendientes-únicos (clave y migraciones) cambia. Suma `function:public.reserve_public_verify_attempt@0426_public_verify_atomic_reservation`.
- **Las otras doce:** el conjunto es idéntico. Con las mismas fuentes y declaraciones, su veredicto no puede cambiar.
- **Ya fusionadas:** #73, #74, #81, #84 y #85, además de #92. Su estado integrado queda cubierto por la revalidación sobre `4eedeb8a`.

## VALIDACIÓN

SHA validados: `def82b65` (base `07d00097`), `75d818b2` (main `47fca222`), `aff9d8c1` (main `bbc7493f`) y `a78efa53` (main `4eedeb8a` + revisión). Node 24.20.0, pnpm 12.3.4 vía Corepack, sin credenciales ni `.env`.

- **PASÓ** el protocolo del worktree:
  - `harness-worktree start`, `guard`, `claim --owner claude-e5b69cae-891c-42a0-9943-5b8668816f0e` y `guard --owner`;
  - antes de cada commit y cada push se revalidaron el guard y la rama;
  - al retomar por la revisión se reclamó de nuevo.
- **PASÓ** `corepack pnpm install --frozen-lockfile` (36,3 s): lockfile y `package.json` intactos, status limpio.
- **PASÓ** `corepack pnpm harness:test`, con 8 archivos, 0 omitidas y exit 0:
  - 39/39 en `def82b65`, `75d818b2` y `aff9d8c1`;
  - 41/41 en `a78efa53`.
- **PASÓ** la prueba nueva contra el checker nuevo: 8/8.
  - Contra la versión `fd2cb77a` pasa 7/8: falla solo el caso 8, como se esperaba.
  - Contra la de `07d00097` pasa 3/8: fallan los cinco de extracción, como se esperaba.
- **PASÓ** la prueba de mutaciones (M1-M4): cada guarda cae con su mutación.
- **PASÓ** el Vitest focal existente en los cuatro SHA: 29/29 (`scripts/check-pending-migration-symbols.test.mjs` y `scripts/__tests__/ci-workflow-contract.test.mjs`).
- **PASÓ** `node scripts/check-pending-migration-symbols.mjs` en el árbol, en los cuatro SHA: `0 ROJO · 0 AMARILLO`, exit 0.
- **PASÓ** la comparación sobre la extracción de L17:
  - checker anterior: exit 0;
  - checker nuevo, también el final: 1 ROJO en `:27`, exit 1;
  - con la declaración de demostración: el anterior da exit 2 y el nuevo, AMARILLO con exit 0.
- **PASÓ** `corepack pnpm lint` en `def82b65`: 0 errores y 8 avisos preexistentes en archivos ajenos (`NewPurchaseWizard.test.tsx`, `PurchaseStepDetalle.test.tsx`, `KommoBoardView.tsx` y `KommoClient.tsx`).
- **PASÓ** ESLint focal en `a78efa53`:
  - el script y la prueba nueva;
  - los archivos lintables que trajeron los merges de `bbc7493f` y `4eedeb8a`: `lib/studio/prealertas/queries.ts` y dos de sus tests, tres páginas de `app/portal/(app)` y `lib/portal/__tests__/portal-addon-consumers-tenant-scope.test.ts`.
- **PASÓ** `corepack pnpm docs:check`: 416, 418, 422 y 423 specs según el SHA. No exige regenerar el índice.
- **PASÓ** `corepack pnpm sdd:check`: sin números repetidos; solo avisos históricos.
- **PASÓ** `git diff --check`, `git diff --cached --check` y `git diff --check origin/main HEAD`.
- **NO EJECUTADO** `pnpm verify`.
  - El cambio es solo de harness: el script del gate, su prueba y la documentación.
  - Para ese caso AGENTS pide las pruebas de sus scripts, los docs y la validación listadas arriba.
  - No toca producto, build, SQL, schema ni E2E, y el propio gate se ejecutó directamente.
- **CI alojado de #90:**
  - «Calidad continua», [run 34631400599](https://github.com/hailuwaycom-sketch/DTDCARGO/actions/runs/34631400599): PASÓ. Es un evento `pull_request` sobre el head `fd2cb77a`; el Director lo cita sobre `e8f1e75`, el merge commit que GitHub prueba para la PR.
  - «Vercel Preview Comments»: PASÓ. Según el bot de Vercel, el preview de la rama quedó «Ready».
  - Head nuevo: **NO DISPONIBLE**. Según el Director, el CI está bloqueado por la facturación de GitHub Actions hasta que Sam lo resuelva, y él relanza los runs.

## COMMITS

- `def82b65`: `fix(harness): SDD-0450 — DDL de bloques DO en símbolos pendientes`. Script, prueba del harness y enmienda SDD.
- `75d818b2`: merge de `origin/main` `47fca222`.
- `265d4f80`: `docs(spec): SDD-0450 — revalidar bloques DO sobre main 47fca222 y PRs abiertas`.
- `3b44f1b7`: `docs(handoff): SDD-0450 — cerrar pending-symbols-do-blocks con evidencia`.
- `aff9d8c1`: merge de `origin/main` `bbc7493f`. Es el head con el que se abrió la PR.
- `fd2cb77a`: `docs(handoff): SDD-0450 — registrar PR #90 y revalidación sobre main bbc7493f`. Es el head que revisó el Director.
- `d765da1b`: merge de `origin/main` `4eedeb8a`, pedido en la revisión.
- `a78efa53`: `fix(harness): SDD-0450 — revisión de #90: esquema.execute(), más casos y límites` (H1, H4 y H2).
- El commit que contiene esta versión del documento: H6.

## PR / BRANCH

- PR draft: https://github.com/hailuwaycom-sketch/DTDCARGO/pull/90, base `main`. Título: «fix(harness): SDD-0450 — DDL de bloques DO en símbolos pendientes».
- Rama `codex/pending-symbols-do-blocks`, publicada a sí misma.
  - Primer push: rama nueva.
  - Los siguientes: fast-forward, sin force.
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/pending-symbols-do-blocks`.
- No se hizo: pasar a ready, merge, producción, migraciones, force push ni limpieza.

## PENDIENTES DE ESTA TAREA

- Ninguno de implementación ni de publicación.
- No pasar a ready mientras el CI siga bloqueado. Revisar, integrar y cualquier release corresponden al Director, con autorizaciones separadas.

## FUERA DE ALCANCE DETECTADO

- **Complemento con catálogo.** `schema-rebuild` podría comparar lo que crea cada migración pendiente en el catálogo efímero (`pg_proc`, `pg_class`, `pg_attribute`) con `extractCreatedSymbols`. Así fallaría ante cualquier punto ciego residual, como un `EXECUTE` de variable o un nombre calculado. Pero suma Docker como fuente de verdad y cambia otro gate crítico: requiere SDD propia.
- **Título de un caso Vitest.** El caso existente se llama «no lee DDL comentado o dinámico» (`scripts/check-pending-migration-symbols.test.mjs:21`). Su fixture sigue siendo correcto: DDL dinámico dentro de un cuerpo de función. Pero el título ahora es más amplio que el contrato, porque el DDL literal de un DO sí se lee. No se renombró para no ampliar el alcance.
- Las cadenas `E'…'` pasaron a los «Límites que persisten» de la SDD (H2).

## HANDOFF AL DIRECTOR

- **Delta desde el head revisado `fd2cb77a`:**
  - `d765da1b`: merge de `4eedeb8a`;
  - `a78efa53`: H1 en el checker (12 líneas), dos casos de prueba y H2 en la spec;
  - este handoff (H6).
  - La API y el formato de salida no cambian. El contrato compartido sigue siendo más estricto: el gate crítico `pending-migration-symbols` lee el DDL de los bloques DO.
- **L17 / PR #80.** Cuando L17 incorpore main con esta corrección, su gate dará `1 ROJO`: `reserve_public_verify_attempt` en `lib/public/verify-throttle.ts:27`, con exit 1. Es la señal correcta para un consumidor migrate-first.
  - Opción a: conservar el ROJO como bloqueo hasta aplicar 0426 y retirar su espera del baseline.
  - Opción b: declarar el degradado, que ahora es verificable. Es fail-closed total: sin la RPC se bloquea toda verificación con `?c=`.
  - La decisión es del Director y de L17. Además, queda vencida la frase del handoff de L17 que dice que una declaración haría fallar `validateDeclarations`.
- **Orden.** #90 antes que #80, como confirmó la revisión.
- **CI.** Está bloqueado por la facturación de GitHub Actions; los runs los relanza el Director. La PR sigue en draft.
- **Otras PRs.** Conservan su veredicto. Las ya fusionadas (#73, #74, #81, #84, #85 y #92) quedan cubiertas por la revalidación sobre `4eedeb8a`.
- **Compartidos.** La PR no toca baseline, índice ni declaraciones.
- **Ownership.** El claim de `claude-e5b69cae-891c-42a0-9943-5b8668816f0e` se libera después de publicar este cierre. El worktree y la rama se conservan. El Auto-fix de #90 sigue activo en esta sesión: si vuelvo a escribir en el worktree, primero reclamo el claim.
