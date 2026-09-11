# Handoff — pending-symbols-do-blocks

- Fecha: 2026-09-11
- Owner: sesión Worker `claude-e5b69cae-891c-42a0-9943-5b8668816f0e` (Claude Code), encargo de Sam en el chat
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/pending-symbols-do-blocks`
- Rama: `codex/pending-symbols-do-blocks`, creada con `node scripts/harness-worktree.mjs start pending-symbols-do-blocks`
  - Base: `origin/main` = `07d000970011ee12364e31124ebe4b301f064b40`, que ya incluye la PR #79 (merge `b7e8b484`, corrección UTF-16).
  - Actualizada con dos merges de `origin/main`, ambos sin conflictos:
    - `47fca2224e9ecebdc3d2a1cb2e2548954b719075` (#70 y #72);
    - `bbc7493f92b762900346e62d96db32c37e5792da` (#73, #74, #81 y #85).
  - Publicada en `origin` como `codex/pending-symbols-do-blocks`, sin force push. Head publicado: `aff9d8c16b4ca643be165edeac3872532f1014fc`.
- SDD: `docs/specs/0450-codigo-contra-migraciones-eximidas/spec.md` (`done`)
  - Enmienda «Corrección 2026-09-11: DDL en bloques DO».
  - Frontmatter intacto: `updated` ya era 2026-09-11. No se reservó número nuevo.
- Estado de tarea: lista-para-revision.
- PR: https://github.com/hailuwaycom-sketch/DTDCARGO/pull/90 (draft, base `main`).
- Dependencias: ninguna para integrar. Cambia el veredicto de la PR #80 (L17); ver HANDOFF AL DIRECTOR.
- Permisos: commits selectivos. Sam autorizó en el chat publicar la rama a sí misma y abrir la PR draft. Sin merge, producción ni migraciones.
- Evidencia local, fuera de Git: `C:/Users/AKX generator/AppData/Local/Temp/claude/C--Users-AKX-generator-Desktop-Developer-DTDCARGO--claude-worktrees-lucid-ellis-58ec99/e5b69cae-891c-42a0-9943-5b8668816f0e/scratchpad/`
  - `old-checker.mjs`: copia del checker de `07d00097`.
  - `survey.mjs`, con los informes `survey-main.json` (`07d00097`), `survey-main-47fca222.json`, `survey-main-bbc7493f.json` y `survey-l17.json`.
  - `l17/`: extracción `git archive` de `07e54dfc`.
  - `mutations.mjs`, `impact.mjs`, `impact-open-prs.json` e `impact/`.
  - Logs: `harness-test.log`, `harness-test-merged.log`, `harness-test-bbc7493f.log` y `lint.log`.
  - Cuerpo de la PR: `pr-body.md`.
- Último resultado: corrección, pruebas, enmienda y validación completas. Rama publicada y PR draft #90 abierta.
- Siguiente paso: revisión del Director e integración en el orden que él decida. Este Worker no fusiona.

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
5. Commits selectivos. Push y PR draft solo con autorización de Sam. Sin merge.
6. Este handoff, con el cierre del runbook.

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
- `git diff origin/main HEAD` muestra solo los tres archivos de harness; este handoff es el cuarto.

## COMPLETADO

### Alternativa elegida

1. **Elegida: extraer el DDL que corre en bloques DO.**
   - Se lee el código del cuerpo de cada `DO [LANGUAGE plpgsql]`.
   - Dentro de ese cuerpo se leen los literales pasados directamente a `EXECUTE`, solos o como plantilla de `[pg_catalog.]format()`.
   - Sigue siendo repo contra repo: sin credenciales, red, Docker ni SKIP.
   - No depende de que el autor recuerde anotar nada.
2. **Descartada: anotación en la migración, validada contra el catálogo efímero de `check-schema-rebuild`.**
   - `schema-rebuild` sale con SKIP sin Docker o con `VERIFY_SKIP_SQL=1` (`scripts/check-schema-rebuild.mjs:25,111-118`). La validación heredaría ese SKIP y rompería la propiedad «sin SKIP» de SDD-0450.
   - Hoy solo mide una huella de esquema para `LEDGER_ONLY` (`:255-290`).
   - Si alguien olvida la anotación, el punto ciego sigue igual.
3. **Descartada: desenmascarar todo el dollar-quoting.**
   - Leería el DDL de los cuerpos de función, que solo corre al invocarlos.
   - La prueba Vitest existente exige ignorar `execute 'create table public.dynamic_only…'` dentro de una función (`scripts/check-pending-migration-symbols.test.mjs:21-43`).

### Corrección del checker

Todo el cambio está en `scripts/check-pending-migration-symbols.mjs`:

- `scanSql(sql)`, privado, es la misma máscara por unidades UTF-16 de antes. Además devuelve cada literal con su posición y su texto sin comillas; en los simples, `''` pasa a `'`.
  - `maskSqlNonCode` conserva su export y su contrato (`scanSql(sql).code`).
  - La etiqueta dollar se lee con una regex *sticky*, equivalente a la anterior.
- `executedSqlViews(sql)` devuelve las vistas de código que corren al aplicar la migración:
  - el texto enmascarado;
  - el contenido de un literal precedido por `do` o por `do language plpgsql`;
  - dentro de PL/pgSQL, el literal precedido por `execute`, `execute (`, `execute format (` o `execute pg_catalog . format (`.
  - `tokensBefore` decide el contexto sobre la vista ya enmascarada. Se siguen hasta cuatro niveles de anidamiento.
- Las cuatro formas DDL se aplican a cada vista.
- La guarda de nombre completo (`NAME_END`) exige que al nombre no le siga ninguno de estos: un carácter de identificador, `"`, `%`, un punto o el fin del fragmento. Además, `if [not] exists` y `only` no pueden ser el nombre.
- No cambian la API exportada, el grafo, las declaraciones, los niveles ni el formato de salida.

### Pruebas del harness

`scripts/tests/pending-migration-symbols-do-blocks.node.mjs` tiene seis casos:

1. **ROJO exacto.** Una RPC creada con `EXECUTE pg_catalog.format($ddl$ … $ddl$, v_body)` dentro de `do $migration$` (forma de 0426, con astrales) se llama desde `lib/public/fixture-throttle.ts:5`, alcanzable desde `app/verificar/page.tsx`. `revoke`, `grant`, `comment` y `to_regclass` no crean símbolos.
2. **AMARILLO.** La declaración anclada a `:5`, con evidencia en `:10`, pasa como AMARILLO.
3. **DDL extraído.** Se extrae el DDL estático de un DO (tabla, `add column` y función), el de `do language plpgsql`, el de un literal simple con comillas escapadas y el de `format()` sin marcadores.
4. **Redefinición.** Una función creada en un DO aplicado y redefinida por una pendiente no cuenta como ausencia.
5. **Guarda: literales que no se ejecutan.** No crean símbolos los cuerpos de función, las asignaciones, `raise`, `perform format()`, los comentarios, `comment on … is` ni los datos con `on conflict do nothing`.
6. **Guarda: nombres calculados.** No producen símbolos falsos `%I.%I`, `public.%I`, `if not exists %I`, `fixture_%s`, `alter table if exists only %I` ni `'…_' || sufijo`.

Las pruebas distinguen el checker anterior del nuevo:

- Contra el checker de `07d00097` (copia aislada), los casos 1 a 4 FALLAN y el 5 y el 6 pasan:
  - caso 1: la extracción da `[]`;
  - caso 2: falla con «no identifica un único símbolo pendiente ausente»;
  - caso 3: `[]` en lugar de cinco símbolos;
  - caso 4: ausencia falsa.
- Contra el checker nuevo: 6/6 PASAN.
- Mutaciones del checker nuevo:
  - sin la guarda de nombre completo, falla el 6;
  - entrando en todo literal (desenmascarado ingenuo), falla el 5;
  - entrando en cualquier literal de un DO, falla el 5;
  - sin bloques DO, fallan los casos 1 a 4.

### Extracción antes y después, en todas las migraciones

| Árbol | Migraciones / con DO / cuerpos DO | Símbolos extraídos | Pendientes-únicos (antes → después) | Gate |
|---|---|---|---|---|
| main `07d00097` + corrección | 421 / 140 / 215 | 1081 → 1082, sin pérdidas | ninguno → ninguno | `0 ROJO · 0 AMARILLO` en ambos |
| main `47fca222` + corrección (`75d818b2`) | 423 / 142 / 219 | 1082 → 1083, sin pérdidas | `portal_can_read_conversation_message` (0433) → igual, en silencio | `0 ROJO · 0 AMARILLO`, exit 0 |
| main `bbc7493f` + corrección (`aff9d8c1`, head publicado) | 427 / 146 / 226 | 1083 → 1084, sin pérdidas | `portal_can_read_conversation_message` (0433) → igual, en silencio | `0 ROJO · 0 AMARILLO`, exit 0 |
| L17 `07e54dfc` (`git archive`) | 421 / 140 / 214 | 1080 → 1082 | ninguno → `reserve_public_verify_attempt` (0426) | anterior `0 ROJO`, exit 0 → nuevo `1 ROJO`, exit 1 |

- **Único símbolo nuevo en main:** `column:public.fiscal_settings.iva_withholding_agent`, en los tres árboles.
  - Viene de `0141_fiscal_module_v2_seniat.sql:98-99`, un `add column` condicional dentro de un DO.
  - La migración está aplicada, así que suma a los símbolos existentes y no crea ausencias.
  - Ninguna migración sin DO cambia su extracción. Los módulos alcanzables siguen siendo 1637.
- **Inventario de DO en main `47fca222` y `bbc7493f`** (igual en ambos):
  - Hay siete literales de `EXECUTE` en DO y ninguno contiene DDL cubierto. Ninguna plantilla con DDL quedó sin símbolo.
  - Hay un único `EXECUTE` de variable: `0296_audit_d4_empty_search_path.sql:68`, `execute v_after`. Reescribe `operario_action` a partir de `pg_get_functiondef`: es una redefinición, no un símbolo nuevo.
  - Hay dos literales con DDL que no se siguen: las etiquetas `'CREATE TABLE'` y `'CREATE TABLE AS'` del event trigger de 0277. Es correcto no seguirlos.
- **Tiempo de extracción:** entre 0,1 y 0,5 s para 421-427 migraciones, según la carga de la máquina; del mismo orden que el checker anterior.

### L17, sin tocar su worktree

- El worktree de L17 está en la rama `codex/c-l17-verificar-throttle`, con HEAD `07e54dfc` igual al remoto y status limpio. Se comprobó en solo lectura.
- En la extracción:
  - **Checker anterior:** `0 ROJO · 0 AMARILLO`, exit 0.
  - **Checker nuevo:** `[ROJO] reserve_public_verify_attempt (function; 0426_public_verify_atomic_reservation)` en `lib/public/verify-throttle.ts:27`, exit 1.
- **Declaración de demostración** en la copia descartable: llamada en `:27`, evidencia en `:42` (`Control de intentos no disponible; verificación bloqueada.`).
  - Checker anterior: exit 2, «no identifica un único símbolo pendiente ausente». Reproduce el bloqueo reportado.
  - Checker nuevo: `0 ROJO · 1 AMARILLO`, exit 0.
  - Después se restauró el archivo de declaraciones de la copia, y `cmp` confirmó que es idéntico al blob de L17.

### Impacto en PRs abiertas

Se analizaron los 13 heads abiertos tras `git fetch origin`: #21, #73, #74, #75, #76, #77, #78, #80, #81, #82, #83, #84 y #85. De cada uno se extrajo `supabase/` con `git archive`.

- El conjunto de pendientes-únicos, con clave y migraciones, solo cambia en #80: suma `function:public.reserve_public_verify_attempt@0426_public_verify_atomic_reservation`.
- En las otras doce es idéntico. Con las mismas fuentes y declaraciones, su veredicto no puede cambiar.
- En #21 la extracción suma 0141 y 0426, pero su única pendiente es 0017.
- Después de la medición se fusionaron #73, #74, #81 y #85. Su estado integrado queda cubierto por la revalidación sobre `bbc7493f`.

## VALIDACIÓN

SHA validados:

- `def82b65`, sobre la base `07d00097`;
- `75d818b2`, que es main `47fca222` más la corrección;
- `aff9d8c1`, que es main `bbc7493f` más la corrección y el head publicado.

Entorno: Node 24.20.0 y pnpm 12.3.4 vía Corepack, sin credenciales ni `.env`.

- **PASÓ** `harness-worktree start`, `guard`, `claim --owner claude-e5b69cae-891c-42a0-9943-5b8668816f0e` y `guard --owner`. Antes de cada commit y del push se revalidaron el guard y la rama.
- **PASÓ** `corepack pnpm install --frozen-lockfile` (36,3 s). El lockfile y `package.json` quedaron intactos y el status, limpio.
- **PASÓ** `corepack pnpm harness:test` en los tres SHA: 8 archivos, 39/39 (33 previas y 6 nuevas), 0 omitidas, exit 0.
- **PASÓ** la prueba nueva contra el checker nuevo: 6/6.
- **FALLÓ, como se esperaba,** la prueba nueva contra el checker anterior: 4 de 6. Las dos guardas pasan.
- **PASÓ** la prueba de mutaciones: cada guarda cae con su mutación (M1-M4).
- **PASÓ** el Vitest focal existente (`scripts/check-pending-migration-symbols.test.mjs` y `scripts/__tests__/ci-workflow-contract.test.mjs`) en los tres SHA: 29/29.
- **PASÓ** `node scripts/check-pending-migration-symbols.mjs` en el árbol, en los tres SHA: `0 ROJO · 0 AMARILLO`, exit 0.
- **PASÓ** la comparación sobre la extracción de L17:
  - checker anterior: exit 0;
  - checker nuevo: 1 ROJO en `:27`, exit 1;
  - con la declaración de demostración: el anterior da exit 2 y el nuevo, AMARILLO con exit 0.
- **PASÓ** `corepack pnpm lint` en `def82b65`: 0 errores y 8 avisos preexistentes, todos en archivos ajenos: `NewPurchaseWizard.test.tsx`, `PurchaseStepDetalle.test.tsx`, `KommoBoardView.tsx` y `KommoClient.tsx`.
  - El merge de `47fca222` no trajo archivos lintables.
  - El de `bbc7493f` trajo dos: `lib/studio/prealertas/queries.ts` y su test. En `aff9d8c1` pasaron ESLint focal junto con el script y la prueba nueva.
- **PASÓ** `corepack pnpm docs:check`: 416 specs en `def82b65`, 418 en `75d818b2` y 422 en `aff9d8c1`. No exige regenerar el índice.
- **PASÓ** `corepack pnpm sdd:check`: sin números repetidos; solo avisos históricos.
- **PASÓ** `git diff --check`, `git diff --cached --check` y `git diff --check origin/main HEAD`.
- **NO EJECUTADO** `pnpm verify`.
  - El cambio es solo de harness: el script del gate, su prueba y la documentación.
  - Para ese caso, AGENTS pide las pruebas de sus scripts, los docs y la validación, que están listadas arriba.
  - No toca producto, build, SQL, schema ni E2E, y el propio gate se ejecutó directamente.
- **CI alojado de #90 sobre `aff9d8c1`**, al abrir la PR:
  - «Vercel Preview Comments»: PASÓ.
  - «Calidad local sin secretos» ([run 34631055761](https://github.com/hailuwaycom-sketch/DTDCARGO/actions/runs/34631055761)) y el preview automático de «Vercel»: en curso. Su resultado era **NO DISPONIBLE** al escribir.
  - El commit que contiene este documento dispara una corrida nueva; su resultado se consulta en la PR.

## COMMITS

- `def82b65`: `fix(harness): SDD-0450 — DDL de bloques DO en símbolos pendientes`. Script, prueba del harness y enmienda SDD.
- `75d818b2`: `Merge branch 'main' into codex/pending-symbols-do-blocks`. Incorpora `origin/main` `47fca222` sin conflictos.
- `265d4f80`: `docs(spec): SDD-0450 — revalidar bloques DO sobre main 47fca222 y PRs abiertas`.
- `3b44f1b7`: `docs(handoff): SDD-0450 — cerrar pending-symbols-do-blocks con evidencia`. Primera versión de este handoff.
- `aff9d8c1`: `Merge branch 'main' into codex/pending-symbols-do-blocks`. Incorpora `origin/main` `bbc7493f` sin conflictos; es el head con el que se abrió la PR.
- El commit que contiene esta versión del documento registra la publicación, la PR #90 y la revalidación sobre `bbc7493f`.

## PR / BRANCH

- PR draft: https://github.com/hailuwaycom-sketch/DTDCARGO/pull/90, base `main`. Título: «fix(harness): SDD-0450 — DDL de bloques DO en símbolos pendientes».
- Rama `codex/pending-symbols-do-blocks`, publicada a sí misma con `git push -u origin codex/pending-symbols-do-blocks:codex/pending-symbols-do-blocks`: rama nueva, sin force.
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/pending-symbols-do-blocks`.
- No se hizo: merge, producción, migraciones, force push ni limpieza.

## PENDIENTES DE ESTA TAREA

- Ninguno de implementación ni de publicación.
- Revisar, marcar ready, fusionar y cualquier release corresponden al Director, con autorizaciones separadas.

## FUERA DE ALCANCE DETECTADO

- **Complemento con catálogo.** `schema-rebuild` podría comparar lo que cada migración pendiente crea en el catálogo efímero (`pg_proc`, `pg_class`, `pg_attribute`) con `extractCreatedSymbols`. Así fallaría ante cualquier punto ciego residual, como un `EXECUTE` de variable o un nombre calculado. Pero suma Docker como fuente de verdad y cambia otro gate crítico: requiere SDD propia.
- **Cadenas `E'…'`.** El escáner no interpreta escapes con barra invertida (limitación previa del masker) y no reconoce `EXECUTE E'…'` como plantilla. En las 427 migraciones no hay `execute E'` ni literales `E'…\'`.
- **Título de un caso Vitest.** El caso existente se titula «no lee DDL comentado o dinámico» (`scripts/check-pending-migration-symbols.test.mjs:21`). Su fixture, DDL dinámico dentro de un cuerpo de función, sigue siendo correcto. Pero el título quedó más amplio que el contrato, porque el DDL literal de un DO ahora sí se lee. No se renombró para no ampliar el alcance.

## HANDOFF AL DIRECTOR

- **Revisión.** Revisa el diff de la PR #90: en el checker, el escáner, las vistas ejecutadas y la guarda de nombre; además, la prueba y la enmienda. Luego decide si se marca ready y en qué orden se integra.
  - El contrato compartido se vuelve más estricto: el gate crítico `pending-migration-symbols` ahora lee DDL de bloques DO.
  - La API y el formato de salida no cambian.
- **L17 / PR #80.** Cuando L17 incorpore main con esta corrección, su gate dará `1 ROJO` (`reserve_public_verify_attempt` en `lib/public/verify-throttle.ts:27`, exit 1). Fallarán ese paso de `pnpm verify` y el de «Calidad local sin secretos». Es la señal correcta para un consumidor migrate-first. Hay dos salidas:
  - Opción a: conservar el ROJO como bloqueo hasta aplicar 0426 y retirar su espera del baseline. El símbolo deja de ser pendiente y el gate queda verde sin declaración.
  - Opción b: declarar el degradado, que ahora es verificable. Pero es fail-closed total: sin la RPC se bloquea toda verificación con `?c=`.
  - La decisión es del Director y de L17. Tras integrar esta PR queda vencida la frase del handoff de L17 que dice que una declaración haría fallar `validateDeclarations`.
- **Orden.** Conviene integrar esta PR antes que #80, para evaluar #80 con el gate correcto. Si #80 se integra primero, después de aplicar 0426 y retirar su espera, esta PR no le cambia nada.
- **Otras PRs.** Las otras PRs abiertas conservan su veredicto, porque su análisis de pendientes-únicos es idéntico. #73, #74, #81 y #85 ya están en main y quedan cubiertas por la revalidación sobre `bbc7493f`.
- **Compartidos.** No toca baseline, índice ni declaraciones, así que no se solapa con las PRs del bloque C.
- **CI y previews.** El push dispara los checks automáticos del proveedor: CI y, según `vercel.json`, posiblemente un preview de Vercel. No hubo deploy manual.
- **Ownership.** El claim de `claude-e5b69cae-891c-42a0-9943-5b8668816f0e` se libera después de publicar este cierre, con `node scripts/harness-worktree.mjs release --owner claude-e5b69cae-891c-42a0-9943-5b8668816f0e`. El worktree y la rama se conservan. No hay sesiones consumidoras conocidas.
