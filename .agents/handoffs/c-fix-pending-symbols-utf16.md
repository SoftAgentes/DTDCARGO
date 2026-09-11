# Handoff — c-fix-pending-symbols-utf16

- Fecha: 2026-09-11
- Owner: sesión Worker `c-fix-symbols-worker-20260911-claude`, asignada por el Director
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/c-fix-pending-symbols-utf16`
- Rama: `codex/c-fix-pending-symbols-utf16`, publicada en `origin` sin force push
- Base asignada: `origin/main` = `3c6107012f754953323202a7386b3e7811593814`; no había avanzado al publicar
- SDD: `docs/specs/0450-codigo-contra-migraciones-eximidas/spec.md` (`done`)
  - Enmienda «Corrección 2026-09-11: enmascarado por unidades UTF-16».
  - En el frontmatter solo cambió `updated: 2026-09-11`; no se reservó número nuevo.
- Estado de tarea: lista-para-revision
- PR: https://github.com/hailuwaycom-sketch/DTDCARGO/pull/79 (draft, base `main`)
- Dependencias: ninguna. La evidencia del Worker L06 (`codex/c-l06-portal-documentos`) se usó solo como dato; su worktree no se tocó.
- Permisos: commits selectivos; push de la rama a sí misma y PR draft contra `main` autorizados. No merge ni producción.
- Evidencia local, fuera de Git: `C:/Users/AKX generator/AppData/Local/Temp/claude/C--Users-AKX-generator-Desktop-Developer-DTDCARGO/454d97be-b1e0-4fc9-97e9-c6bb621ba84c/scratchpad/c-fix-pending-symbols-utf16/`. Contiene logs, `compare-main.json`, `compare-l06.json`, `quote-desync.json` y la extracción `l06-tree/`.
- Último resultado: corrección, regresiones, enmienda y validación completas; PR draft abierta.
- Siguiente paso: revisión del Director e integración según su orden. Este Worker no fusiona.

## OBJETIVO ORIGINAL

Corregir el gate `pending-migration-symbols` (`scripts/check-pending-migration-symbols.mjs`).

El enmascarado de comentarios y strings construía arrays de code points (`[...sql]`, `[...source]`), pero operaba con índices UTF-16. Un carácter astral desalineaba la máscara: el gate reportaba líneas erróneas y omitía símbolos.

El enmascarado debe conservar longitud e índices UTF-16, con pruebas de regresión en la suite del harness.

## ACEPTACIÓN ASIGNADA

1. El texto enmascarado conserva longitud e índices UTF-16 en los dos puntos (SQL y JS/TS). Hay que revisar el mismo patrón en el resto del script.
2. Regresiones en `scripts/tests/*.node.mjs` que fallan con el código anterior y pasan con el nuevo:
   - un TS con un astral antes de `.rpc("x")` reporta la línea exacta;
   - un SQL con un astral en un comentario antes de `create function` extrae el símbolo;
   - una declaración anclada a la línea real pasa.
3. Checker en este árbol (main + fix): se espera `0 ROJO · 0 AMARILLO`. Hay que comparar la extracción antes y después en todas las migraciones y confirmar que no aparecen ROJO nuevos.
4. Checker corregido sobre una extracción (`git archive`) del head remoto de L06: se espera `0 ROJO · 1 AMARILLO` con el sitio `:231`, sin tocar el worktree de L06.
5. Listar como FUERA DE ALCANCE otros scripts de `scripts/` con el mismo patrón.

## ALCANCE

- Permitido: `scripts/check-pending-migration-symbols.mjs`, la prueba del harness (nueva o extendida), la enmienda de SDD-0450, `docs/specs/README.md` solo si el generador lo exige y este handoff.
- Excluido: `supabase/**`, `app/**`, `lib/**`, otras reglas del checker y cualquier cambio de política de declaraciones.
- Tocados: exactamente cuatro archivos, todos dentro del alcance. `docs/specs/README.md` no se tocó porque el generador no lo exige.

## COMPLETADO

### Corrección del checker

- `scripts/check-pending-migration-symbols.mjs` tiene un helper privado y documentado, `utf16Units(text)`, que devuelve `text.split("")`.
- `maskSqlNonCode` y `maskJavaScriptComments` lo usan en lugar de `[...sql]` y `[...source]`.
- La máscara solo sustituye unidades UTF-16 por espacios, así que conserva longitud, índices y saltos de línea.
- En el resto del script no hay otro spread de texto con índices. Los demás spreads recorren Sets o arrays (`found`, `modulePaths`, `roots`, `symbols.values()`, entre otros).
- No cambian las formas DDL cubiertas, el grafo, las declaraciones ni los niveles ROJO/AMARILLO/silencio. La API exportada es la misma.

### Regresiones en el harness

El archivo `scripts/tests/pending-migration-symbols-utf16.node.mjs` corre en `pnpm harness:test` y tiene 7 casos. Todos verifican además el invariante de máscara.

1. Un par sustituto enmascarado ocupa dos espacios.
2. Criterio a: un TS con astrales en un comentario de línea, un literal, un JSDoc y un comentario interno reporta la llamada `.rpc()` en `:11`, con LF y con CRLF, y da el ROJO exacto.
3. Criterio b: un SQL con astrales en un comentario justo antes de `create function` extrae el símbolo.
4. Forma de 0090: los astrales previos en literales de un CHECK no hacen perder la función posterior.
5. Forma de 0128: los astrales en comentarios no hacen perder `ALTER TABLE ... ADD COLUMN`.
6. Criterio c: una declaración anclada a la línea real pasa como AMARILLO.
7. Un import tras un comentario con astrales conserva la arista y el ROJO. Con la máscara anterior, ese ROJO pasaba a silencio.

Nota sobre el criterio b: con un solo astral en el comentario adyacente, la máscara anterior no llegaba a perder el `create`, porque el salto de línea preservado absorbía el desplazamiento. Por eso el fixture usa dos astrales, el mínimo que reproduce la pérdida. Los casos 4 y 5 reproducen astrales acumulados en otras posiciones, como en las migraciones reales.

### Enmienda de SDD-0450

La enmienda fechada documenta el defecto, la corrección, la regresión, el impacto medido, el caso de L06, sus criterios y la validación.

### Las regresiones distinguen el código anterior del nuevo

- Sobre el código original (copia aislada de la base con la prueba nueva): FALLAN 7/7.
- Mutación sin el invariante de máscara, solo con las aserciones semánticas, sobre el original: FALLAN 7/7. Los fallos son:
  - sitio `:6` en lugar de `:11`;
  - `[]` en lugar de la función;
  - falta `fixture_freeze_immutable`;
  - falta la columna;
  - declaración rechazada con «declara [:11] pero hoy llama desde [:6]»;
  - import perdido.
- Sobre el código corregido: PASAN 7/7.

### Extracción antes y después (main + fix, 420 migraciones)

| Migración | Símbolos solo con la corrección | Línea que la máscara anterior dañaba |
|---|---|---|
| Total | 1076 → 1080 (+4, ninguna pérdida) | — |
| `0090_comments` | `function:public.comments_freeze_immutable` | L223 → `eate or replace function …` |
| `0128_sales_order_invoicing_hardening` | `column:public.sales_orders.invoicing_total_boxes` | L58 → `ter table public.sales_orders` |
| `0128_sales_order_invoicing_hardening` | `function:public.prealerta_sales_order_in_tenant` | L69 → `eate or replace function …` |
| `0128_sales_order_invoicing_hardening` | `function:public.sales_order_claim_and_invoice` | L134 → `eate or replace function …` |

- **Migraciones con astrales:** 9 (0090, 0128, 0355, 0367, 0369, 0381, 0388, 0391 y 0394). Con la máscara anterior, 8 producían texto enmascarado de otra longitud; ahora ninguna. Ninguna migración sin astrales cambia su extracción.
- **Símbolos pendientes-únicos:** los pendientes son 0409, 0418, 0419 y 0430; hay 0 antes y 0 después.
- **Fuentes JS/TS:** 130 de 2480 contienen astrales.
  - Con la máscara anterior, 120 desalineaban sus líneas; ahora ninguna.
  - Antes se perdían dos imports externos, `react` en `app/studio/_components/ui/DataTable.tsx` y `node:fs` en `scripts/norte.mjs`, sin efecto en las aristas.
  - Los módulos alcanzables siguen siendo 1637.
- **Gate:** `0 ROJO · 0 AMARILLO` antes y después; no aparecen ROJO nuevos.

### Comprobación contra L06

- **Head remoto:** `origin/codex/c-l06-portal-documentos` = `1b655967010c64542532d9fb4e1beebd62950bcf`. Lo extraje con `git archive | tar -x` en `l06-tree/`, dentro de la carpeta de evidencia. Su copia del checker es idéntica a la de la base.
- **Checker original:** exit 2, con `get_portal_packing_list_documents declara [lib/portal/packing-list-queries.ts:231] pero hoy llama desde [lib/portal/packing-list-queries.ts:125]`.
- **Checker corregido** (script del worktree, con cwd en la extracción): exit 0, `0 ROJO · 1 AMARILLO`, con `function get_portal_packing_list_documents → lib/portal/packing-list-queries.ts:231`. La línea real de la llamada es la 231.
- **Extracción SQL en L06:** las mismas diferencias que en main (0090 +1 y 0128 +3). El símbolo pendiente de su 0406 no cambia.

## VALIDACIÓN

Observada sobre el árbol del commit `a6b2081b`, con base `3c610701`.

- **PASÓ** `node scripts/harness-worktree.mjs guard` y `claim --owner c-fix-symbols-worker-20260911-claude`. Revalidé `guard --owner` y la rama antes de cada commit.
- **PASÓ** `corepack pnpm install --frozen-lockfile`: pnpm 12.3.4, sin cambios en el lockfile.
- **PASÓ** `corepack pnpm harness:test`: 7 archivos descubiertos, 33/33 pruebas, 0 omitidas.
- **PASÓ** el Vitest focal existente (`scripts/check-pending-migration-symbols.test.mjs` y `scripts/__tests__/ci-workflow-contract.test.mjs`): 29/29.
- **PASÓ** `node scripts/check-pending-migration-symbols.mjs` en este árbol: `0 ROJO · 0 AMARILLO`, exit 0.
- **PASÓ** el checker corregido sobre la extracción de L06: `0 ROJO · 1 AMARILLO` en `:231`, exit 0.
- **PASÓ** `corepack pnpm lint`: 0 errores y 8 avisos preexistentes en archivos ajenos.
- **PASÓ** ESLint focal sobre el script y la prueba nueva.
- **PASÓ** `corepack pnpm docs:check`: 415 specs. El índice no exige regenerar `docs/specs/README.md`, porque el generador no usa `updated`.
- **PASÓ** `corepack pnpm sdd:check`: sin números repetidos; solo avisos históricos.
- **PASÓ** `git diff --check`, `git diff --cached --check` y la allowlist: 4 archivos, ninguno fuera del alcance.
- **NO EJECUTADO** `pnpm verify`. El cambio es solo de harness: el script del gate, su prueba y documentación. Para ese caso AGENTS pide las pruebas de sus scripts, los docs y la validación, todas listadas arriba. No toca producto, build, SQL, schema ni E2E, y el propio gate se ejecutó directamente.
- **NO DISPONIBLE** al escribir este documento: el resultado de los checks hospedados de la PR #79. Lo verifica el Director.

## COMMITS

- `a6b2081b`: `fix(harness): SDD-0450 — enmascarado por unidades UTF-16 en símbolos pendientes`. Incluye el script, la prueba del harness y la enmienda SDD.
- Cierre documental: el commit que contiene este documento.

## PR / BRANCH

- PR draft: https://github.com/hailuwaycom-sketch/DTDCARGO/pull/79
- Base `main`; rama `codex/c-fix-pending-symbols-utf16`; worktree `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/c-fix-pending-symbols-utf16`.
- No se autorizó ni se hizo: merge, producción, migraciones, force push ni limpieza.

## PENDIENTES DE ESTA TAREA

- Ninguno de implementación. Revisar, marcar ready, fusionar y cualquier release corresponden al Director, con autorizaciones separadas.

## FUERA DE ALCANCE DETECTADO

- **Patrón `[...x]` con índices en `scripts/`.** No hay ningún otro caso fuera de este checker.
  - Revisé todos los spreads de identificadores y llamadas: recorren arrays, Sets o Maps. Por ejemplo, `check-numbering.mjs:228`, `next-number.mjs:78`, `upload-brand-proyecto.ts:118-180` y `check-migrations-applied.mjs:174`.
  - Los `for…of` recorren colecciones, como `check-edge-functions.mjs:182`, y los `Array.from` envuelven `matchAll`.
  - No existe otro enmascarador por índices.
- **Estado de comillas de `maskJavaScriptComments`.** Es otra regla del mismo script; no se tocó. El masker no reconoce regex literales ni `${…}` anidados en templates.
  - En 47 de 2480 fuentes el estado de comillas termina abierto al final del archivo; 25 son alcanzables desde `app/**`. Ejemplos: `app/api/cron/alta-health/route.ts:115` (`.replace(/"/g, …)`) y `app/studio/(app)/bugs/_components/BugsAdminClient.tsx:605`.
  - Tras el desfase, los comentarios pueden quedar sin enmascarar y producir referencias falsas. Además, un `//` dentro de un string real puede ocultar el resto de su línea.
  - Hoy el veredicto no cambia, porque main no tiene símbolos pendientes-únicos. Resolverlo con un tokenizer real requiere una decisión propia.
- **`IGNORED_DIRECTORIES` no incluye `.claude`.** Ejecutado desde el checkout principal, el checker también lee su worktree anidado: `.claude/worktrees/dtd-cargo-director-checklist-2f1d6f`, con 2423 fuentes. ESLint y Vitest sí excluyen `.claude/**`.
  - No altera el veredicto: las raíces son `app/**` y los alias resuelven a la raíz. Solo cuesta tiempo y memoria.
- **Checkout principal.** Está en `main` local `e580e774`, detrás de `origin/main`, con cambios preexistentes sin commit:
  - borrado de `.agents/skills/agentation*/SKILL.md`;
  - `docs/runbooks/restauracion-laptop-2026-09-05.md` y `docs/runbooks/assets/` sin trackear.
  - No se tocaron.

## HANDOFF AL DIRECTOR

- **Revisión.** Revisa el diff (el helper más los dos puntos de uso), la prueba y la enmienda, y decide si se marca ready y se integra. No se alteran contratos compartidos: la API exportada y el formato de salida del checker son los mismos.
- **L06.** `codex/c-l06-portal-documentos` hoy sale con exit 2 en este gate por el defecto. Después de integrar esta PR y actualizar L06 desde `main`, su declaración a `:231` pasa como AMARILLO sin tocar su código. Otras ramas con astrales en código alcanzable verán sitios corregidos (líneas reales). En main no se detectaron más casos.
- **Cambio de clasificación.** 0090 y 0128 aportan 4 símbolos más a las migraciones no eximidas. Si una migración pendiente los redefine, ahora cuenta como redefinición, no como ausencia.
- **Sesiones consumidoras.** No conozco ninguna de este worktree. El claim se libera después de publicar este cierre; el worktree y la rama se conservan.
