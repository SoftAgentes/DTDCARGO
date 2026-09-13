---
sdd: "0464"
title: "Gate de símbolos pendientes por relación y deudas de arnés del bloque C"
status: in-progress
author: "Codex"
created: 2026-09-13
updated: 2026-09-13
supersedes: null
superseded_by: null
related: ["0450", "0444", "0440"]
confidencialidad: interno
---

# SDD-0464 — Gate de símbolos pendientes por relación y deudas de arnés del bloque C

> Solo arnés: no cambia comportamiento de producto, migraciones ni datos.

## Problema

Cuatro deudas quedaron registradas como FUERA DE ALCANCE durante el bloque C:

1. `scripts/check-pending-migration-symbols.mjs` (SDD-0450) asociaba las
   columnas pendientes solo por su nombre. En L14 (PR #104) la 0421 agrega a
   `payment_reports` tres columnas homónimas de `dispatch_orders`,
   `qr_print_orders` y `expense_alerts`; la declaración tuvo que enumerar 15
   sitios de siete módulos que no dependen de 0421, con 7 evidencias «Sin
   degradado», y cualquier cambio de línea en esos módulos la invalidaba
   (exit 2).
2. El paso `harness` de `scripts/verify.mjs` conservaba una lista manual de
   cinco archivos; `pnpm harness:test` y CI descubrían catorce.
3. `skills-lock.json` declara ocho skills ausentes de `.agents/skills/` y no
   nombra las dos de `.claude/skills/`; ningún check decía cuál es la regla.
4. `docs/specs/0440-e2e-harness-general-determinista/spec.md` sigue
   `in-progress` aunque el rescate documentó que el arnés ya está en `main`.

## Decisión

### Deuda 1 · asociación columna → relación (ADR-0003)

- Un modelo de columnas por relación se lee de todas las migraciones, en orden
  de nombre y sobre las mismas vistas de código ejecutado que el extractor:
  cuerpos de `create table (…)`, `add column`, `drop column`, `rename column` y
  `drop table`; las vistas se registran sin columnas. Es evidencia positiva:
  lo que no se lee no consta.
- `create function … returns [setof] relación` asocia la función a la relación;
  nombrarla (`.rpc("confirm_payment_report")`) equivale a nombrar la tabla.
- El ámbito de un módulo son sus tokens identificador más los de sus vecinos
  directos alcanzables (lo que importa y quien lo importa).
- Una mención alcanzable del nombre de una columna pendiente `R.c` cuenta si el
  ámbito nombra `R` o una función que devuelve `R`; se descarta como homónima
  solo si, sin nombrar `R`, el ámbito nombra otra relación con columna `c`
  según el modelo; en cualquier otro caso cuenta. Sin evidencia de otra dueña,
  el gate falla cerrado.
- Funciones, tablas y vistas siguen asociándose por nombre. El contrato de
  `supabase/pending-migration-symbol-declarations.json` no cambia
  (`schemaVersion: 1`, `$doc` idéntico para el driver de merge); cambia lo que
  el gate exige en `callSites`. Los homónimos descartados se imprimen en gris
  con su relación dueña y la línea final los cuenta.

### Deuda 2 · un solo descubrimiento del harness

- `scripts/tests/run-harness.mjs` exporta `discoverHarnessTests()` y corre solo
  como CLI. `scripts/verify.mjs` construye el paso `harness` con ese mismo
  descubrimiento (`--test` más cada `scripts/tests/*.node.mjs`), avisa cuántos
  archivos descubrió y rompe al cargar si no hay ninguno.
- La ejecución de `verify.mjs` vive detrás de una frontera CLI/import
  (`export async function main()`, `export const STEPS`): importarlo desde una
  prueba expone los pasos sin lanzar el gate. El entry `node scripts/verify.mjs`
  no cambia de comportamiento.
- `scripts/tests/verify-harness-discovery.node.mjs` fija la igualdad de
  conjuntos y la frontera; `verify-critical-coverage.node.mjs` contrasta ahora
  su lista esperada con los `STEPS` reales, sin fixture duplicado.

### Deuda 3 · manifiesto de skills con regla verificable

`.gitignore` (líneas 184–189) y los commits `5d74c626` y `b4cb0866` definen el
diseño vigente: `skills-lock.json` es el registro de reinstalación
(`npx skills install`) de skills de terceros cuyo contenido se ignora a
propósito, y las skills propias se versionan con su `SKILL.md`. Retirar las
ocho entradas rompería ese registro; añadir las propias haría que una
reinstalación las sobrescribiera. La alineación se vuelve una regla explícita
en `scripts/check-skills-manifest.mjs` (`pnpm skills:check`, exit 0/1/2):

1. lock válido (`version: 1`, `skills{}` con `source`, `sourceType` y
   `skillPath` a `SKILL.md`);
2. cada entrada del lock apunta a un directorio que git ignora, nunca a una
   skill versionada ni a una que quedaría versionada por accidente;
3. cada skill versionada tiene frontmatter `name` igual al directorio y
   `description` no vacía, y no aparece en el lock;
4. cada directorio ignorado presente en `.agents/skills/` tiene entrada en el
   lock.

`scripts/tests/skills-manifest.node.mjs` reproduce la alineación y cada
desalineación en repos git temporales y corre el checker sobre este
repositorio. El manifiesto no se edita: retirar las ocho entradas de terceros es
una decisión del Director que el checker acepta sin cambios.

### Deuda 4 · estado de SDD-0440

Se contrastó cada criterio con `main` `76797beb`: `playwright.config.ts`
(`resolvePlaywrightWorkers`, trim del kind, `resolveWebkitProjectWorkers`),
`scripts/seed-e2e.ts` (estado previo y postcondición),
`scripts/e2e/sdd-0168-fixture.ts` (origen canónico) y
`e2e/_helpers/hidratacion.ts` (`cause`), con sus pruebas focales 65/65. El único
criterio abierto, la corrida hospedada de los 168 E2E, no tiene evidencia en
`main`: ningún workflow ejecuta Playwright y ningún handoff la registra. La
spec permanece `in-progress`; no se edita. El detalle criterio por criterio
está en el handoff.

## Seguridad y datos

Sin credenciales, red, producción ni PII. El gate sigue siendo repo contra repo;
el checker de skills solo consulta git local. No hay migración.

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| SGE-00 | cumplimiento | Los tres checks fallan cerrados: sin evidencia de otra dueña la columna se exige; sin pruebas descubiertas verify no arranca; un lock que git no ignora sale 1. |
| AUD-01 | no aplica | No cambia eventos de producto ni auditoría de negocio. |
| MP-01 | no aplica | No se tratan datos personales. |

## Allowlist exacta

- `docs/specs/0464-harness-gate-simbolos-por-relacion/spec.md`
- `docs/specs/README.md` (generado)
- `docs/architecture/decisions/0003-gate-simbolos-pendientes-por-relacion.md`
- `scripts/check-pending-migration-symbols.mjs`
- `scripts/check-pending-migration-symbols.test.mjs`
- `scripts/verify.mjs`
- `scripts/tests/run-harness.mjs`
- `scripts/tests/verify-critical-coverage.node.mjs`
- `scripts/tests/verify-harness-discovery.node.mjs`
- `scripts/tests/verify-watchdog.node.mjs` (una aserción: ya no hay lista manual)
- `scripts/check-skills-manifest.mjs`
- `scripts/tests/skills-manifest.node.mjs`
- `package.json` (script `skills:check`)
- `.agents/handoffs/harness-gate-simbolos-por-relacion.md`

## Criterios de aceptación

- [x] Una columna homónima de otra relación no se exige: el caso L14 en su
      forma real queda fijado en Vitest y la extracción del head `93f1cbed` de
      la PR #104 pasa de 25 sitios exigidos a los 10 de
      `lib/portal/payment-report-queries.ts`.
- [x] La columna de su propia relación sigue exigiéndose: mapper importado por
      el módulo que nombra la relación, módulo sin relación nombrada, módulo
      con ambas relaciones, consumidor de una RPC que devuelve la relación, dos
      saltos de otra dueña y columna borrada por otra migración aplicada.
- [x] `kind: function` se exige por nombre aunque el módulo solo nombre otra
      relación; `kind: column` cubre `create table`, `add/drop/rename column`,
      `drop table` y funciones `returns [setof] relación`.
- [x] Control rojo: con el checker de `main` fallan los tres casos L14, el de
      columna borrada y el de RPC por nombre.
- [x] El contrato de declaraciones conserva `schemaVersion: 1` y su `$doc`;
      ADR-0003 documenta la semántica nueva, sus límites y el rollback.
- [x] El paso `harness` de verify corre exactamente los archivos que descubre
      `harness:test`; controles rojos: lista manual restaurada (la prueba de
      igualdad falla con el diff 5 contra 14) y frontera retirada (importar
      lanza el gate).
- [x] `skills-lock.json` y el árbol responden a una regla explícita con checker
      y pruebas; control rojo: sin la regla 2 la prueba de entrada no ignorada
      falla.
- [x] SDD-0440 contrastada criterio por criterio con `main`; decisión y faltante
      exacto registrados en el handoff, sin editar otras specs.
- [ ] `pnpm verify` completo sobre el head de código con veredicto por paso.

## Fuera de alcance

- Editar `skills-lock.json`, borrar o instalar skills.
- Cambiar `supabase/pending-migration-symbol-declarations.json` de `main` o de
  otras ramas; la PR #104 recorta su declaración al fusionar esta.
- Reordenar o reclasificar pasos de verify; agregar `skills:check` como paso
  del gate (corre en `harness:test` y en CI por el paso «Harness Director
  Worker»).
- La corrida hospedada de los 168 E2E de SDD-0440.

## Validación

- **PASÓ** `node scripts/check-pending-migration-symbols.mjs` sobre el árbol:
  `0 ROJO · 0 AMARILLO`, exit 0, en 1,2 s; el modelo lee 258 relaciones con
  3546 columnas.
- **PASÓ** el caso real: extracción `git archive` del head `93f1cbed` de
  `origin/codex/c-l14-portal-comandos-recibos`. Checker anterior: `0 ROJO · 2
  AMARILLO`. Nuevo: exit 2 con la lista real de 10 sitios; con la declaración
  recortada (10 sitios, sin las 7 evidencias «Sin degradado»): `0 ROJO · 2
  AMARILLO · 15 homónimo(s) descartado(s)`, exit 0.
- **PASÓ** `vitest run scripts/check-pending-migration-symbols.test.mjs`:
  20/20 (7 previas, 13 nuevas).
- **PASÓ** el control rojo de la deuda 1: con el script de `main` (stash) y la
  prueba sin los tres imports nuevos, 6 fallos / 5 pasos en el filtro
  `caso L14|propia relación|por nombre`.
- **PASÓ** `node --test` de `verify-harness-discovery`, `verify-critical-coverage`
  y `harness-discovery`: 12/12; controles rojos de la deuda 2 registrados en el
  handoff.
- **PASÓ** `pnpm skills:check` sobre el repositorio: 8 de terceros registradas
  (0 presentes en disco) y 4 propias versionadas; suite
  `skills-manifest.node.mjs` 9/9 tras corregir un regex propio.
- **PASÓ** ESLint focal sobre los archivos tocados.
- `pnpm harness:test` completo, `docs:check`, `sdd:check`, `governance:check`,
  `git diff --check` y `pnpm verify` completo: resultados en el handoff.

## Estado

Implementación y pruebas por deuda en commits separados sobre
`codex/harness-gate-simbolos-por-relacion` (base `origin/main` `76797beb`).
El cierre documental posterior no cambia el código medido.
