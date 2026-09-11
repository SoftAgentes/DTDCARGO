# Handoff — pending-symbols-do-blocks

- Fecha: 2026-09-11
- Owner: sesión Worker `claude-e5b69cae-891c-42a0-9943-5b8668816f0e` (Claude Code), encargo de Sam en el chat
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/pending-symbols-do-blocks`
- Rama: `codex/pending-symbols-do-blocks`, creada con `node scripts/harness-worktree.mjs start pending-symbols-do-blocks`
  - Base: `origin/main` = `07d000970011ee12364e31124ebe4b301f064b40`, que ya incluye la PR #79 (merge `b7e8b484`, corrección UTF-16).
  - Actualizada con merge de `origin/main` = `47fca2224e9ecebdc3d2a1cb2e2548954b719075` (#70 y #72), sin conflictos.
- SDD: `docs/specs/0450-codigo-contra-migraciones-eximidas/spec.md` (`done`)
  - Enmienda «Corrección 2026-09-11: DDL en bloques DO».
  - Frontmatter intacto: `updated` ya era 2026-09-11. No se reservó número nuevo.
- Estado de tarea: lista-para-revision, solo local. No hay push ni PR.
- Dependencias: ninguna para integrar. Cambia el veredicto de la PR #80 (L17); ver HANDOFF AL DIRECTOR.
- Permisos: commits locales selectivos. Publicar la rama y abrir la PR draft requiere autorización explícita de Sam, que el encargo condiciona y aún no se dio. Sin merge, producción ni migraciones.
- Evidencia local, fuera de Git: `C:/Users/AKX generator/AppData/Local/Temp/claude/C--Users-AKX-generator-Desktop-Developer-DTDCARGO--claude-worktrees-lucid-ellis-58ec99/e5b69cae-891c-42a0-9943-5b8668816f0e/scratchpad/`
  - `old-checker.mjs`: copia del checker de `07d00097`.
  - `survey.mjs` con `survey-main.json` (`07d00097`), `survey-main-47fca222.json` y `survey-l17.json`.
  - `l17/`: extracción `git archive` de `07e54dfc`.
  - `mutations.mjs`, `impact.mjs`, `impact-open-prs.json` e `impact/`.
  - Logs: `harness-test.log`, `harness-test-merged.log` y `lint.log`.
- Último resultado: corrección, pruebas, enmienda y validación completas.
- Siguiente paso: autorización de publicación y revisión del Director.

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
6. Este handoff con el cierre del runbook.

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
- `git diff origin/main HEAD` muestra solo los tres archivos de producto de harness; este handoff es el cuarto.

## COMPLETADO

### Alternativa elegida

1. **Elegida: extraer el DDL que corre en bloques DO.**
   - Se lee el código del cuerpo de cada `DO [LANGUAGE plpgsql]` y, dentro de él, los literales pasados directamente a `EXECUTE`, solos o como plantilla de `[pg_catalog.]format()`.
   - Sigue siendo repo contra repo: sin credenciales, red, Docker ni SKIP.
   - No depende de que el autor recuerde anotar nada.
2. **Descartada: anotación en la migración validada contra el catálogo efímero de `check-schema-rebuild`.**
   - `schema-rebuild` sale con SKIP sin Docker o con `VERIFY_SKIP_SQL=1` (`scripts/check-schema-rebuild.mjs:25,111-118`). La validación heredaría ese SKIP y rompería la propiedad «sin SKIP» de SDD-0450.
   - Hoy solo mide una huella de esquema para `LEDGER_ONLY` (`:255-290`).
   - Si alguien olvida la anotación, el punto ciego sigue igual.
3. **Descartada: desenmascarar todo el dollar-quoting.**
   - Leería el DDL de cuerpos de función, que solo corre al invocarlos.
   - La prueba Vitest existente exige ignorar `execute 'create table public.dynamic_only…'` dentro de una función (`scripts/check-pending-migration-symbols.test.mjs:21-43`).

### Corrección del checker

Todo el cambio está en `scripts/check-pending-migration-symbols.mjs`:

- `scanSql(sql)`, privado, es la misma máscara por unidades UTF-16 de antes. Además devuelve cada literal con su posición y su texto sin comillas; en los simples, `''` pasa a `'`.
  - `maskSqlNonCode` conserva su export y su contrato (`scanSql(sql).code`).
  - La etiqueta dollar se lee con una regex *sticky*, equivalente a la anterior.
- `executedSqlViews(sql)` devuelve las vistas de código que corren al aplicar la migración:
  - el texto enmascarado;
  - el cuerpo de un literal precedido por `do` o `do language plpgsql`;
  - dentro de PL/pgSQL, el literal precedido por `execute`, `execute (`, `execute format (` o `execute pg_catalog . format (`.
  - El contexto se decide con `tokensBefore`, sobre la vista ya enmascarada. Sigue hasta cuatro niveles.
- Las cuatro formas DDL se aplican a cada vista.
- La guarda de nombre completo (`NAME_END`) exige que al nombre no le sigan un carácter de identificador, `"`, `%`, un punto ni el fin del fragmento. `if [not] exists` y `only` no pueden ser el nombre.
- La API exportada, el grafo, las declaraciones, los niveles y el formato de salida no cambian.

### Pruebas del harness

`scripts/tests/pending-migration-symbols-do-blocks.node.mjs` tiene seis casos:

1. Una RPC creada con `EXECUTE pg_catalog.format($ddl$ … $ddl$, v_body)` dentro de `do $migration$` (forma de 0426, con astrales) y llamada desde `lib/public/fixture-throttle.ts:5`, alcanzable desde `app/verificar/page.tsx`, da un ROJO exacto. `revoke`, `grant`, `comment` y `to_regclass` no crean símbolos.
2. La declaración anclada a `:5`, con evidencia en `:10`, pasa como AMARILLO.
3. Se extrae el DDL estático en un DO (tabla, `add column` y función), en `do language plpgsql`, en un literal simple con comillas escapadas y en `format()` sin marcadores.
4. Una función creada en un DO aplicado y redefinida por una pendiente no cuenta como ausencia.
5. Guarda: cuerpos de función, asignaciones, `raise`, `perform format()`, comentarios, `comment on … is` y datos con `on conflict do nothing` no crean símbolos.
6. Guarda: los nombres calculados no dan símbolos falsos: `%I.%I`, `public.%I`, `if not exists %I`, `fixture_%s`, `alter table if exists only %I` y `'…_' || sufijo`.

Las pruebas distinguen el checker anterior del nuevo:

- Contra el checker de `07d00097` (copia aislada): 1-4 FALLAN y 5-6 pasan.
  - Caso 1: la extracción da `[]`.
  - Caso 2: la declaración falla con «no identifica un único símbolo pendiente ausente».
  - Caso 3: `[]` en lugar de cinco símbolos.
  - Caso 4: da ausencia falsa.
- Contra el checker nuevo: 6/6 PASAN.
- Mutaciones del checker nuevo:
  - sin guarda de nombre completo, falla el 6;
  - entrando en todo literal (desenmascarado ingenuo), falla el 5;
  - entrando en cualquier literal de un DO, falla el 5;
  - sin bloques DO, fallan 1-4.

### Extracción antes y después, en todas las migraciones

| Árbol | Migraciones / con DO / cuerpos DO | Símbolos extraídos | Pendientes-únicos (antes → después) | Gate |
|---|---|---|---|---|
| main `07d00097` + corrección | 421 / 140 / 215 | 1081 → 1082, sin pérdidas | ninguno → ninguno | `0 ROJO · 0 AMARILLO` en ambos |
| main `47fca222` + corrección (`75d818b2`) | 423 / 142 / 219 | 1082 → 1083, sin pérdidas | `portal_can_read_conversation_message` (0433) → igual, en silencio | `0 ROJO · 0 AMARILLO`, exit 0 |
| L17 `07e54dfc` (`git archive`) | 421 / 140 / 214 | 1080 → 1082 | ninguno → `reserve_public_verify_attempt` (0426) | anterior `0 ROJO`, exit 0 → nuevo `1 ROJO`, exit 1 |

- **Único símbolo nuevo en main:** `column:public.fiscal_settings.iva_withholding_agent`. Viene de `0141_fiscal_module_v2_seniat.sql:98-99`, un `add column` condicional dentro de un DO. La migración está aplicada, así que suma a los símbolos existentes y no crea ausencias.
  - Ninguna migración sin DO cambia su extracción.
  - Los módulos alcanzables siguen siendo 1637.
- **Inventario de DO en main `47fca222`:**
  - Hay siete literales de `EXECUTE` en DO y ninguno contiene DDL cubierto. Ninguna plantilla con DDL quedó sin símbolo.
  - Hay un único `EXECUTE` de variable: `0296_audit_d4_empty_search_path.sql:68`, `execute v_after`. Reescribe `operario_action` a partir de `pg_get_functiondef`: es una redefinición, no un símbolo nuevo.
  - Hay dos literales con DDL no seguidos: las etiquetas `'CREATE TABLE'` y `'CREATE TABLE AS'` del event trigger de 0277. Es correcto no seguirlos.
- **Tiempo de extracción:** unos 0,5 s para 423 migraciones, similar al anterior.

### L17, sin tocar su worktree

- El worktree de L17 está en la rama `codex/c-l17-verificar-throttle`, con HEAD `07e54dfc` igual al remoto y status limpio. Se comprobó en solo lectura.
- En la extracción:
  - **Checker anterior:** `0 ROJO · 0 AMARILLO`, exit 0.
  - **Checker nuevo:** `[ROJO] reserve_public_verify_attempt (function; 0426_public_verify_atomic_reservation)` en `lib/public/verify-throttle.ts:27`, exit 1.
- **Declaración de demostración** en la copia descartable (llamada `:27`, evidencia `:42`, `Control de intentos no disponible; verificación bloqueada.`):
  - checker anterior: exit 2, «no identifica un único símbolo pendiente ausente». Reproduce el bloqueo reportado.
  - checker nuevo: `0 ROJO · 1 AMARILLO`, exit 0.
  - Después se restauró el archivo de declaraciones de la copia y `cmp` confirmó que es idéntico al blob de L17.

### Impacto en PRs abiertas

Se analizaron los 13 heads abiertos tras `git fetch origin`: #21, #73, #74, #75, #76, #77, #78, #80, #81, #82, #83, #84 y #85. De cada uno se extrajo `supabase/` con `git archive`.

- El conjunto de pendientes-únicos, con clave y migraciones, solo cambia en #80: suma `function:public.reserve_public_verify_attempt@0426_public_verify_atomic_reservation`.
- En las otras doce es idéntico. Con las mismas fuentes y declaraciones, su veredicto no puede cambiar.
- En #21 la extracción suma 0141 y 0426, pero su única pendiente es 0017.

## VALIDACIÓN

Sobre `def82b65` (base `07d00097`) y, tras el merge, sobre `75d818b2` (main `47fca222` + corrección). Node 24.20.0, pnpm 12.3.4 vía Corepack, sin credenciales ni `.env`.

- **PASÓ** `harness-worktree start`, `guard`, `claim --owner claude-e5b69cae-891c-42a0-9943-5b8668816f0e` y `guard --owner`. Se revalidaron el guard y la rama antes de cada commit.
- **PASÓ** `corepack pnpm install --frozen-lockfile` (36,3 s): lockfile y `package.json` intactos, status limpio.
- **PASÓ** `corepack pnpm harness:test`: 8 archivos, 39/39 (33 previas y 6 nuevas), 0 omitidas, exit 0. Se corrió en `def82b65` y en `75d818b2`.
- **PASÓ** la prueba nueva contra el checker nuevo: 6/6.
- **FALLÓ, como se esperaba,** la prueba nueva contra el checker anterior: 4 de 6. Las dos guardas pasan.
- **PASÓ** la prueba de mutaciones: cada guarda cae con su mutación (M1-M4).
- **PASÓ** el Vitest focal existente (`scripts/check-pending-migration-symbols.test.mjs` y `scripts/__tests__/ci-workflow-contract.test.mjs`): 29/29 en ambos SHA.
- **PASÓ** `node scripts/check-pending-migration-symbols.mjs` en el árbol: `0 ROJO · 0 AMARILLO`, exit 0, en `def82b65` y en `75d818b2`.
- **PASÓ** la comparación sobre la extracción de L17: el anterior da exit 0 y el nuevo, 1 ROJO en `:27` (exit 1). Con la declaración de demostración, el anterior da exit 2 y el nuevo, AMARILLO (exit 0).
- **PASÓ** `corepack pnpm lint` en `def82b65`: 0 errores y 8 avisos preexistentes en `NewPurchaseWizard.test.tsx`, `PurchaseStepDetalle.test.tsx`, `KommoBoardView.tsx` y `KommoClient.tsx`, archivos ajenos. El merge no trajo archivos lintables.
- **PASÓ** ESLint focal sobre el script y la prueba nueva.
- **PASÓ** `corepack pnpm docs:check`: 416 specs en `def82b65`, 418 tras el merge. No exige regenerar el índice.
- **PASÓ** `corepack pnpm sdd:check`: sin números repetidos, solo avisos históricos.
- **PASÓ** `git diff --check`, `git diff --cached --check` y `git diff --check origin/main HEAD`.
- **NO EJECUTADO** `pnpm verify`. El cambio es solo de harness: el script del gate, su prueba y la documentación. AGENTS pide para ese caso las pruebas de sus scripts, los docs y la validación listadas arriba. No toca producto, build, SQL, schema ni E2E, y el propio gate se ejecutó directamente.
- **NO DISPONIBLE** el CI alojado: no hay push.

## COMMITS

- `def82b65`: `fix(harness): SDD-0450 — DDL de bloques DO en símbolos pendientes`. Script, prueba del harness y enmienda SDD.
- `75d818b2`: `Merge branch 'main' into codex/pending-symbols-do-blocks`. Incorpora `origin/main` `47fca222` sin conflictos.
- `265d4f80`: `docs(spec): SDD-0450 — revalidar bloques DO sobre main 47fca222 y PRs abiertas`.
- El commit que contiene este documento: cierre del handoff.

## PR / BRANCH

- Sin push ni PR. El encargo condiciona la publicación a una autorización de Sam que aún no se dio.
- Rama local `codex/pending-symbols-do-blocks`, sin upstream; base prevista `main`.
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/pending-symbols-do-blocks`.
- Si se autoriza:
  - `git push -u origin codex/pending-symbols-do-blocks:codex/pending-symbols-do-blocks`;
  - `gh pr create --base main --head codex/pending-symbols-do-blocks --draft --body-file <cuerpo>`.
- No se hizo: merge, producción, migraciones, force push ni limpieza.

## PENDIENTES DE ESTA TAREA

- Publicar la rama y abrir la PR draft, solo con autorización explícita de Sam. Después, registrar aquí la URL y el resultado del CI alojado.
- De implementación: ninguno.

## FUERA DE ALCANCE DETECTADO

- **Complemento con catálogo.** `schema-rebuild` podría comparar lo que cada migración pendiente crea en el catálogo efímero (`pg_proc`, `pg_class`, `pg_attribute`) con `extractCreatedSymbols`. Así fallaría ante cualquier punto ciego residual, como un `EXECUTE` de variable o un nombre calculado. Suma Docker como fuente de verdad y cambia otro gate crítico: requiere SDD propia.
- **Cadenas `E'…'`.** El escáner no interpreta escapes con barra invertida, una limitación previa del masker, y no reconoce `EXECUTE E'…'` como plantilla. En las 423 migraciones no hay `execute E'` ni literales `E'…\'`.
- **Título de un caso Vitest.** El caso existente se titula «no lee DDL comentado o dinámico» (`scripts/check-pending-migration-symbols.test.mjs:21`). Su fixture, DDL dinámico dentro de un cuerpo de función, sigue siendo correcto. Pero el título ahora es más amplio que el contrato, porque el DDL literal de un DO sí se lee. No se renombró para no ampliar el alcance.

## HANDOFF AL DIRECTOR

- **Revisión.** Revisa el diff: el escáner, las vistas ejecutadas y la guarda de nombre del checker, más la prueba y la enmienda. Luego decide si se publica/marca ready y en qué orden se integra.
  - El contrato compartido se vuelve más estricto: el gate crítico `pending-migration-symbols` ahora lee DDL de bloques DO.
  - La API y el formato de salida no cambian.
- **L17 / PR #80.** Cuando L17 incorpore main con esta corrección, su gate dará `1 ROJO` (`reserve_public_verify_attempt` en `lib/public/verify-throttle.ts:27`, exit 1). Fallarán ese paso de `pnpm verify` y el de «Calidad local sin secretos». Es la señal correcta para un consumidor migrate-first.
  - Opción a: conservar el ROJO como bloqueo hasta aplicar 0426 y retirar su espera del baseline. El símbolo deja de ser pendiente y el gate queda verde sin declaración.
  - Opción b: declarar el degradado, que ahora es verificable. Pero es fail-closed total: sin la RPC se bloquea toda verificación con `?c=`.
  - Esa decisión es del Director y de L17. El handoff de L17 dice que una declaración haría fallar `validateDeclarations`; esa frase queda vencida tras integrar esta PR.
- **Orden.** Conviene integrar esta PR antes que #80, para evaluar #80 con el gate correcto. Si #80 se integra primero, después de aplicar 0426 y retirar su espera, esta PR no le cambia nada.
- **Otras PRs.** Las otras doce PRs abiertas conservan su veredicto (análisis de pendientes-únicos idéntico).
- **Compartidos.** No toca baseline, índice ni declaraciones, así que no hay solapamiento con las PRs del bloque C.
- **Ownership.** El claim de `claude-e5b69cae-891c-42a0-9943-5b8668816f0e` sigue retenido mientras se decide la publicación, porque publicar exige actualizar este handoff. Se libera con `node scripts/harness-worktree.mjs release --owner claude-e5b69cae-891c-42a0-9943-5b8668816f0e` al terminar la escritura. El worktree y la rama se conservan. No hay sesiones consumidoras conocidas.
