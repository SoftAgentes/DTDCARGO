# Handoff 0480 — El recargo de baterías del respaldo vuelve a espejar el ERP

- Fecha: 2026-09-18. Estado de tarea: lista para revisión. Este documento sale en el único push de
  la rama, que precede a la PR contra `main` autorizada por Sam; sin merge.
- Owner/sesión actual: `worker-respaldo-bateria-15-d5-20260918` (Claude Opus 5, Worker; sesión
  `dtdcargo-d5`). **Retomó la tarea** de `dtdcargo-c9` (`worker-respaldo-bateria-15-opus5-20260918`),
  que cerró sin terminarla: dejó el código commiteado y publicado en `218a2caf`, pero sin commitear
  la fila nueva de la spec ni este handoff, y sin PR.
- Traspaso del claim (autorizado por Sam en esta sesión, condicionado a la evidencia): a las
  22:15 UTC `dtdcargo-c9` no figuraba en `ListAgents`, ningún proceso tenía la ruta del worktree en
  su línea de comandos y la última escritura en el árbol era de las 16:30 UTC. Con eso se liberó
  el claim de c9 y se reclamó a nombre de la sesión actual; `guard --owner` OK.
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/respaldo-bateria-15`.
- Rama: `codex/respaldo-bateria-15`. Nació con `harness-worktree start` desde `origin/main`
  `56fa2ae0`; se le trajo el stub de la SDD (`365ff53e`, fast-forward) y después `origin/main`
  `b43a39a5` (con la PR #138 de marketing) en el merge `257aff03`, antes de editar. Al retomarla,
  con el turno que dio `dtdcargo-18` después de integrar la #145, se trajo `origin/main`
  `cc15e48c` en el merge `a002b459`; después, cuando entró la #147 (solo textos), `1b64bdae` en el
  merge `c0ae30c7`, que es la base de la PR.
- SDD: [0480](../../docs/specs/0480-respaldo-bateria-espeja-erp/spec.md), reservada por
  `dtdcargo-18` en `codex/sdd-reserve-0480-respaldo-bateria-espeja-erp`. No se corrió `sdd:next`.
- Asignación: la propuso `dtdcargo-18` (coordinación) después de integrar la PR #136, y amplió el
  alcance a la guía y al README de marketing para que todo lo de baterías vaya en una sola PR.
  El cierre lo encargó Sam a esta sesión.
- Permisos: editar en este worktree, commits selectivos, handoff, push de la rama sobre sí misma y
  PR contra `main`. Autorización de Sam en esta sesión, textual: «Autorizo el push de la rama y
  abrir la PR contra main.» Antes, en la sesión de c9, Sam había autorizado la publicación
  («autorizo publicar la rama de baterías de dtdcargo-c9» y «Sí, publica»). No hay merge (lo hace
  `dtdcargo-18`), ni producción, ni migración.

## OBJETIVO ORIGINAL

Que `CONFIG.recargoBateriaMult`, el respaldo del calculador ante una caída de Supabase, espeje el
recargo de baterías que cobra el ERP. Que lo ancle un test y que ningún test, e2e ni documento de
atención al cliente quede con ×1,3.

## COMPLETADO

### Primero se verificó, y apareció una decisión contradictoria (sesión c9)

- La RPC pública `public_calculator_config`, leída como `anon` (lo mismo que ve el sitio, sin
  filas de negocio), dio `recargo_bateria_mult = 1.500`. Coincide con la lectura de coordinación.
  Los otros nueve campos coinciden con `CONFIG`; `public_cbm_rate` da 850/50, también iguales.
- Pero el commit `535aa0ec` del **2026-08-05**, de Sam, dice textual que el ERP cobraba ×1,3 desde
  el 2026-07-06 y por eso bajó el respaldo de ×1,5 a ×1,3. Ninguna migración reescribió el valor
  después: 0103, 0274, 0283, 0287 y 0448 tienen `default 1.5`, pero son
  `create table if not exists` con `insert … on conflict do nothing`. El cambio a ×1,5 se hizo
  editando el ERP.
- **Se paró antes de editar** y se le preguntó a Sam. Respuesta en la de coordinación, textual:
  «Sí, ×1,5 es correcto — Lo subí a propósito. Alineen el código y el marketing a ×1,5. El sitio
  está cobrando bien.» Lo reconfirmó al encargar el cierre: «Sí, ×1,5 es correcto». La decisión no
  se reabre.

### Cambios

| Archivo | Cambio | Commit |
|---|---|---|
| `lib/calculadora.ts` | `recargoBateriaMult` 1.3 → **1.5**; el comentario deja la historia completa (535aa0ec → ERP subido a propósito → vuelta a 1,5) | `5e95f963` |
| `__tests__/calculadora-respaldo-alineado.test.ts` | **Quinto valor anclado** con literal: `expect(CONFIG.recargoBateriaMult).toBe(1.5)`, con la historia al lado; la cabecera nombra tres espejos y «pasó tres veces» | `5e95f963` |
| `__tests__/calculadora.test.ts` | 1 m³ con baterías (usa `CONFIG`): recargo 255 → **425**, total 1105 → **1275**. 10 m³ con params explícitos «igual que prod»: 1740 → **2900**, 7540 → **8700**. Las dos descripciones pasan a ×1.5 | `5e95f963` |
| `docs/specs/0480-…/spec.md` | La SDD completa, que reemplaza el stub. `status: done` | `5e95f963` |
| `docs/specs/README.md` | Regenerado con `node scripts/build-docs-index.mjs` | `5e95f963` |
| `docs/marketing/calculadora-explicada.html` | Tabla: ×1,3 (+30%) → **×1,5 (+50%)**. Ejemplo con baterías: $1.700 × 1,5 = **$2.550**, «+$850». El pie ya no dice «en revisión», nombra el ×1,5 entre los valores vigentes y dice que todos los ejemplos salieron del motor | `4f354608` |
| `docs/marketing/README.md` | El pendiente «baterías en revisión» pasa a ✅ resuelto, con la cita de Sam y el enlace a la SDD-0480 | `4f354608` |
| `scripts/__tests__/sdd-0168-fixture.test.ts` | La traducción de `DEFAULT_PARAMS` a `calculator_settings`, que es lo que escribe el seed de e2e: `recargo_bateria_mult` 1.3 → **1.5**. La encontró `pnpm verify`, no la búsqueda inicial. Las filas «previas» del test de registro auditable (líneas 230 y 251) no se tocan: son una entrada inventada que el test compara con `not.toEqual` contra los defaults vigentes | `218a2caf` |
| `docs/specs/0480-…/spec.md` | La tabla de literales recalculados suma la fila del fixture e2e y explica por qué las filas «previas» siguen en 1.3. La escribió c9; esta sesión la revisó contra el test antes de commitearla | `a989b906` |

### Revisado sin cambios

- **`e2e/`**: ninguna prueba menciona baterías, tampoco entre las omitidas.
- `lib/faqs.ts` (la FAQ pública ya decía «recargo del 50%»), la ayuda del Admin
  (`calculator-settings-types.ts`, «1.5 = +50%») y `estimate.test.ts` (usa 1,5 propio).
- `public/guias/comprar-en-alibaba.html` y `public/interno/guia-peso.html`: nombran las
  baterías sin el multiplicador.
- `components/CalculadoraForm.tsx`: la insignia se arma con `params.recargoBateriaMult`, sin
  literal.

### Barrido por valor después del merge con main (esta sesión)

Sobre el árbol fusionado `a002b459`, en todo el repo y no por carpeta: `recargo_bateria_mult` o
`recargoBateriaMult` asignados a 1.3, «bater…» cerca de ×1,3 o de +30 %, y los totales derivados
1105 y 7540. No queda ningún literal vivo de ×1,3. Lo que aparece es historia fechada (la cabecera
del test de anclaje, esta SDD, el README de marketing tachado, handoffs), la entrada inventada del
registro auditable y dos falsos positivos (la batería «al 30 % de carga» de
`equipo-crm/DTDCARGO-baterias-CRM.md` y rangos Unicode del Brand Book). `lib/calculadora.ts` sigue
en `recargoBateriaMult: 1.5` después del merge. De los archivos que trajo main, solo
`lib/studio/document-import/estimate.ts` y su test mencionan baterías, y sus cambios no las tocan.

### Ejemplo de marketing corrido en el motor (sesión c9)

`lib/calculadora.ts` con los defaults nuevos, ejecutado con `tsx`: 2 m³ · 800 kg · Caracas → 1700;
con baterías → **2550**, recargo **850**; 2 m³ · 2.600 kg → 2900. Los dos sin baterías coinciden
con la guía, así que la base de $1.700 está comprobada, no copiada.

## VALIDACIÓN

| Comprobación | Alcance / SHA | Resultado |
|---|---|---|
| RPC `public_calculator_config` como `anon` = 1.500 | producción, solo lectura (c9) | PASÓ |
| vitest: calculadora, respaldo, mínimo en cajas, calculator-settings, guía Alibaba, estimate, cotizador, DocumentCalculator | árbol de `4f354608` (c9) | PASÓ (8 archivos, 149 tests) |
| `git diff --check` (árbol y `origin/main...HEAD`) | `a002b459` | PASÓ |
| `corepack pnpm typecheck` | `a002b459` | PASÓ |
| vitest focal: `calculadora.test.ts`, `calculadora-respaldo-alineado.test.ts`, `sdd-0168-fixture.test.ts` (`--pool=threads`) | `a002b459` | PASÓ (3 archivos, 122 tests) |
| **Control rojo**: `recargoBateriaMult` vuelto a 1.3 un momento | árbol de `a002b459`, restaurado sin diff | PASÓ: caen exactamente el ancla, el test de `CONFIG` con baterías y el fixture e2e (3 de 122) |
| `corepack pnpm docs:check` | `a002b459` | PASÓ (469 specs; el índice regenerado no cambió nada) |
| `corepack pnpm sdd:check` | `a002b459` | PASÓ (sin números repetidos; los choques históricos ya aplicados siguen marcados, no se renumeran) |
| `node scripts/check-pending-migration-symbols.mjs` | `a002b459` | PASÓ (0 ROJO, 0 AMARILLO) |
| `corepack pnpm verify` (corrida completa, CPU compartida con otras sesiones) | `a002b459` | FALLÓ en tres pasos, ninguno por este cambio: ver el desglose abajo. 16 de 17 pasos corrieron |
| · harness | `a002b459` | FALLÓ dentro de verify (190 de 191): `verify-watchdog.node.mjs:248`, «nivel 1 (PID 41320) sigue vivo». **Aislada: PASÓ** (14 de 14; ese caso en 5,6 s) |
| · lint, rsc-boundary, typecheck, edge-functions | `a002b459` | PASÓ |
| · test | `a002b459` | FALLÓ dentro de verify (7.912 de 7.915; 1 omitido): timeout de `app/p/[token]/PackingListProductsStep.test.tsx` (20 s) y de `scripts/__tests__/invoice-read-boundary.test.mjs` (60 s), las dos intermitentes conocidas, en la corrida y en su reintento. **Aisladas: PASÓ** (2 archivos, 12 tests) |
| · docs:check, numbering, feature-constants, components:check, governance:check, pending-migration-symbols, sql-tests, schema-rebuild | `a002b459` | PASÓ |
| · migrations-applied | `a002b459` | NO DISPONIBLE (SKIP: el worktree no tiene `.env.local`; esta tarea no tiene migración) |
| · e2e | `a002b459` | PASÓ con aviso: 164 pasaron, 4 flaky que pasaron al reintento (`attachments-gastos-pilot` en chromium y tres de `calculadora-semantic-colors` en mobile-chrome, que miden colores y teclado, no montos), 18 omitidos, 0 fallos. El exit ≠0 es el worker de WebKit que no cierra en Windows |
| · build | `a002b459` | FALLÓ dentro de verify por un corte propio: el `timeout 3000` con que se lanzó verify lo mató en pleno build (exit 143) y dejó `tsconfig.json` con el `distDir` inyectado, que se devolvió a HEAD. **`node scripts/check-build.mjs` aislado: PASÓ** (build de producción OK, `tsconfig.json` restaurado por el propio script, árbol limpio) |
| Merge de `origin/main` `1b64bdae` (#147): `git merge-tree --write-tree` antes de fusionar | `c0ae30c7` | PASÓ (exit 0, sin conflictos) |
| `git diff --check` (árbol y `origin/main...HEAD`) y `docs:check` después de ese merge | `c0ae30c7` | PASÓ (469 specs). La #147 trae cinco archivos; en `lib/public/rates-queries.ts` y `app/api/public/cbm-rate/route.ts` solo cambian comentarios (comprobado: ninguna línea de código en el diff). `recargoBateriaMult` sigue en 1.5. Por indicación de `dtdcargo-18`, verify no se repite por este merge |

## COMMITS

- `5e95f963`: fix(web): SDD-0480 — el recargo de baterías del respaldo vuelve a espejar el ERP
  (código, tests, SDD e índice). Sesión c9.
- `4f354608`: fix(marketing): SDD-0480 — las baterías pasan a ×1,5, decisión confirmada por Sam.
  Sesión c9.
- `218a2caf`: fix(web): SDD-0480 — el fixture e2e traduce el recargo de baterías vigente (×1,5).
  Sesión c9.
- `a989b906`: docs(SDD-0480): la spec registra el literal del fixture e2e (×1,5). Esta sesión.
- `a002b459`: merge de `origin/main` `cc15e48c`, con el driver de registros generados de main.
  Esta sesión.
- `c0ae30c7`: merge de `origin/main` `1b64bdae` (#147), con el mismo driver. Esta sesión.
- El commit que contiene este documento: docs(handoff). Esta sesión.
- Base: `365ff53e` (stub de coordinación) y `257aff03` (merge de `origin/main` `b43a39a5`).

## PR / BRANCH

Rama `codex/respaldo-bateria-15`: un único push de la rama sobre sí misma y PR contra `main`, con
autorización de Sam. La URL queda en la propia PR y en el reporte a `dtdcargo-18`; este documento no
la incluye para no crear un commit recursivo. El merge lo decide `dtdcargo-18`.

## PENDIENTES DE ESTA TAREA

- CI de la PR y merge (coordinación).
- Semántica de `docs/marketing/README.md` (ver Conocimiento): el Director aplica en `main` el
  fragmento revisado que deja esta sesión.

## FUERA DE ALCANCE DETECTADO

- `docs/specs/0474-guia-alibaba-shipping-mark-y-costo-real/spec.md:130` dice que el disclaimer de
  la guía nombra «baterías (×1,3)». La guía real (`public/guias/comprar-en-alibaba.html:1062`) ya no
  nombra el multiplicador, así que la frase describe un texto que no existe. Es la spec fechada de
  otra tarea: no se tocó.
- `.agents/handoffs/0478-tarifa-programada-a-futuro.md:158`, que llegó con main, anota como
  hallazgo que `CONFIG.recargoBateriaMult = 1.3` no coincide con el ERP. Esta PR lo resuelve; el
  handoff ajeno queda como evidencia fechada, sin editar.
- La prueba del harness `scripts/tests/verify-watchdog.node.mjs:248` («un árbol que calla se corta
  entero por inactividad, y sólo ese árbol») falló dentro de `pnpm verify`: «nivel 1 (PID 41320)
  sigue vivo». Esta rama no toca el harness y aislada pasó 14 de 14, así que se registra como
  intermitente bajo carga (la CPU estaba al 100 % con decenas de procesos node de otras sesiones).
  No figura en la lista de intermitentes conocidas; conviene sumarla si se repite.
- La alineación general de los respaldos depende de que alguien se acuerde. Un test que compare
  `CONFIG` con las RPC públicas necesitaría red y credenciales en CI; hoy el ancla es literal.

## HANDOFF AL DIRECTOR

Rama con cuatro commits de la tarea y este handoff, más el stub de la SDD y tres merges de main,
el último con `1b64bdae`. Toca `lib/calculadora.ts`, tres tests y la documentación de marketing; coordinación ya
sabía que después de esta tarea va a asignar otras sobre `lib/calculadora.ts`, y conviene que entren
después de ésta. No toca `migrations-baseline.json` ni tiene migración. Sin acciones en producción
en esta sesión. Sesiones consumidoras: `dtdcargo-18` (integración). `dtdcargo-53`, que c9 anotó
como supervisión, no figuraba en `ListAgents` a las 22:15 UTC. El claim se libera al terminar la
escritura; el worktree y la rama se conservan.

### Conocimiento

Estado de las capas en este worktree:

- **Impacto documental:** SDD-0480 nueva; `docs/marketing/README.md` (una de las 16 fuentes del
  piloto semántico) y `docs/marketing/calculadora-explicada.html` actualizados; este handoff.
- **Graphify 0.9.61, estructural:** `graphify update .` sobre `a002b459`, en 311 s: 35.256 nodos,
  65.779 aristas, 2.292 comunidades, 0 pendientes y 0 faltantes. Los dos `deleted` son los nodos
  virtuales `react` y `@testing-library/react`, el problema conocido. Después del merge
  `c0ae30c7` quedan 2 pendientes estructurales, los dos Markdown que trajo la #147
  (`textos-0447-0458-aplicadas.md` y la spec 0476). No se volvió a correr Graphify: es una corrida
  pesada y la regla de coordinación es una a la vez. Al integrar, el Director lo corre sobre main.
- **Semántica:** en este árbol da 0 de 16 en el piloto y 0 de 1.107 en total, porque los recibos
  viven en el `graphify-out` de cada checkout, fuera de Git. En el checkout principal
  (`cc15e48c`, leído sin escribir) el piloto estaba 15 de 16. Faltaba justo
  `docs/marketing/README.md`, **ya PENDING antes de esta rama** por la #138: su fragmento
  (sha del README `720205cb…`) se armó pero no se aplicó.
- **Fragmento para el Director** (el importador rechaza en worktrees por los dos nodos virtuales,
  y el recibo no viajaría con la PR): `lote-readme-marketing-0480.json`, en `graphify-out/` de este
  worktree y en el scratchpad de la sesión `04f944e5…`, junto con el script que lo arma
  (`fragmento-readme-0480.cjs`, reproducible). Parte del lote de la #138 (17 nodos, 17 aristas) y
  aplica solo lo que cambia esta rama, que en el README toca L229-L241: el nodo de pendientes y el
  de la revisión por la tarifa de $850 pasan a terminar en L241 y dejan de decir «×1,3 en
  revisión», y se suman el nodo `docs_marketing_readme_recargo_baterias_confirmado` (L233-L238) y
  su arista desde la revisión por $850. Resultado: 18 nodos, 18 aristas, IDs únicos, ningún extremo
  colgante, `fragmentSha256` `3d7adb3b8efc35bd8f4be72594f404bcd761e4e1542099482046a7505496c109`,
  README `744a5bff72d0c83382d0f43941681756af7fed88287b13e2a1d627e4968fd017`. El README se leyó
  completo; no tiene frontmatter YAML. El Director lo aplica en `main` al integrar, regenerando la
  review con el `head` de main (el sha del README no cambia al integrar) y con `--check` primero.
  Reemplaza al lote de la #138, que queda obsoleto.
- **Archify:** no aplica. El mapa `knowledge-lifecycle` sale de fuentes que esta rama no toca, y el
  runtime no está en el worktree (`ARCHIFY_RUNTIME_MISSING`).
- **Obsidian:** `knowledge:publish --preview` dio `ok: true`, estado PREVIEW en `c0ae30c7`, en
  `graphify-out/obsidian-preview` del worktree: 1.106 documentos, 0 conflictos y 39 avisos de
  enlaces (37 destinos faltantes y 2 fuera del repo), ninguno en archivos de esta rama. Un primer
  intento dio `SOURCE_CHANGED` porque main pasó a `1b64bdae` mientras corría. La bóveda compartida
  no se tocó: la publica el Director desde main integrado.
