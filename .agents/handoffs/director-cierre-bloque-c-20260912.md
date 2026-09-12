# director-cierre-bloque-c — Objetivo único: cerrar el bloque C y el aislamiento de aliados

- Fecha: 2026-09-12.
- Owner / sesión escritora: `director-cierre-bloque-c-20260912` (Claude Code, Opus 5), sesión Director.
- Repositorio: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO`.
- Worktree de coordinación: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/director-cierre-bloque-c`.
- Rama: `codex/director-cierre-bloque-c`, creada desde `origin/main` `74b7fe34a32ea30b05393dfd9a88391aab36b540`.
- Estado de tarea: en-progreso (coordinación); los tramos de producto se ejecutan en Workers aislados.
- SDD: no aplica a esta rama de coordinación. La reserva nueva del tramo 1 es SDD-0461.
- Permisos del encargo (Sam, 2026-09-12): avanzar con todas las tareas como un objetivo único;
  publicar las ramas propias y sus PRs en borrador; limpieza de worktrees y ramas locales
  integradas. **Sin merge, sin despliegue, sin aplicar migraciones, sin borrar ramas remotas.**

## OBJETIVO ORIGINAL

Sam pidió avanzar «en un solo objetivo con todas las tareas» sobre el backlog del briefing del
2026-09-12: los tres lotes que faltan del bloque C, el aislamiento multi-tenant de la cadena de
aliados, la limpieza acumulada, el dictamen de las ramas viejas y el documento de restauración de
la laptop que llevaba siete días sin commitear en el checkout principal.

## Estado de partida verificado

- `main` = `origin/main` = `74b7fe34` (merge de la PR #100, 2026-09-12T10:16:24Z). Cero PRs abiertas
  (`gh pr list --state open` vacío).
- Ledger de producción: 441 entradas según el registro en Git de la PR #95 tras aplicar de a una
  `0419→0430→0432→0434→0417→0429→0424→0431→0433→0408→0450` el 2026-09-12. En esta sesión el ledger
  en vivo queda **NO VERIFICADO**: sin credenciales, `migrations-applied` sale NO DISPONIBLE.
- Localmente `supabase/migrations-baseline.json` tiene `pendingBelowCutoff` vacío con `cutoff` 238,
  y `supabase/pending-migration-symbol-declarations.json` tiene `degradations` vacío. Ninguna
  migración nueva entró después de ese lote.
- Numeración: `pnpm sdd:next` → spec siguiente 0461, migración siguiente 0451. `pnpm sdd:check` →
  sin números repetidos; los choques 0336/0342/0362/0363/0394 son históricos ya aplicados y exentos.

## El objetivo, en cuatro tramos secuenciales

Una tarea, una rama, un worktree y una PR **por tramo**. El orden no es preferencia: el tramo 1 es
riesgo de datos entre tenants, y los tramos 2 a 4 son el resto del bloque C, donde L07 va último
porque exige un despliegue intermedio entre su SQL y sus facades.

| Tramo | Objetivo | SQL | Specs | Estado de arranque |
|---|---|---|---|---|
| 1 | Aislamiento de tenant en la cadena de aliados | `0451` nueva | SDD-0461 (reservada) | **listo para asignar** |
| 2 | Bloque C · L14 comandos, confirmación y recibos del Portal | `0420`→`0421`→`0422`→`0423` | 0364–0366 (importar de PR #21) | listo; L18 ya entregó el principal (#66) |
| 3 | Bloque C · L10 recordatorios y Cobranzas | `0410`→`0415` | 0353, 0358 (importar) | listo; `0399` ya está en `main` |
| 4 | Bloque C · L07 fidelización, conversations y sales-orders | 4 productores → `0414` | 0350, 0354–0357 (importar) | último: exige despliegue intermedio |

Fuente de los tramos 2 a 4: `origin/codex/saneamiento-integral` = `refs/dtd/pr/21` = `ea9952a4`
(158 commits y 803 archivos de divergencia sobre `main`). El plan por lotes vive en
[docs/audits/c-analisis-bloque-c.md](../../docs/audits/c-analisis-bloque-c.md); los lotes L01–L06,
L08, L09, L11–L13 y L15–L22 ya se extrajeron en las PRs #63 a #84.

Ninguno de los cuatro tramos se solapa en archivos con los otros: el tramo 1 vive en SQL de
`aliados` y `price_books`, L14 en los comandos y recibos del Portal, L10 en Cobranzas y L07 en
conversations y sales-orders. Aun así se ejecutan en serie por decisión de Sam.

## Cleanup ejecutado en esta sesión

Evidencia previa a cada borrado: PR MERGED con base correcta, HEAD respaldado en `origin`,
ancestralidad comprobada en `main`, status completamente limpio incluidos untracked, sin `.env`
real (solo `.env.example` versionado), y ninguna sesión viva. La herramienta de sesiones de la app
listó 21 sesiones: ninguna con `isRunning`, y las dos que usaron estos árboles están archivadas con
PR MERGED (`local_cafbe605…` → PR #99, `local_284d5d0e…` → PR #100).

- **Removido:** worktree `DTD-worktrees/skills-agentation-retirar`, rama
  `codex/skills-agentation-retirar` `cf234269`, PR #100 MERGED. `git worktree remove` exit 0.
- **Parcial:** worktree `DTDCARGO/.claude/worktrees/nervous-tharp-418741`, HEAD `f2c47091`
  (PR #99 MERGED). `git worktree remove` **desregistró** el árbol pero falló al borrarlo:
  `error: failed to delete … Filename too long`, exit 255 — MAX_PATH sobre su `node_modules`.
  El registro de Git quedó limpio (`git worktree list` solo muestra el checkout principal) y el
  directorio quedó huérfano, sin nada que preservar. Conforme al runbook se conserva y se
  diagnostica: no se usó `--force`, ni `prune` global, ni `robocopy /MIR`. Purgarlo necesita una
  autorización puntual de Sam.
- **Ramas locales:** 62 ramas ya integradas borradas con `git branch -d`, cero rechazos.
- **Conservadas:** las ocho reservas stub `codex/sdd-reserve-0444/0451/0452/0456/0457/0458/0459/0460`.
  Sus specs están en `main`, pero entraron por cherry-pick, así que los commits stub no son
  ancestros y `-d` los rechaza; el runbook prohíbe `-D`. Quedan seis ramas locales de tareas más
  `main`, todas en el dictamen de abajo.

## Dictamen de ramas sin integrar

Ninguna rama remota se borra en esta sesión: el runbook exige autorización específica y
verificación adicional de consumidores. Medida de contenido propio: `main...rama`.

| Rama | Propio | Último commit | Dictamen |
|---|---|---|---|
| `codex/saneamiento-integral` | 158 commits · 803 arch. | 2026-09-04 | **CONSERVAR. Es la PR #21**, fuente de L07/L10/L14. No tocar. |
| `archive/radiografia-erp-20260802` | 32 · 123 | 2026-08-03 | CONSERVAR: ya declarada archivo por su prefijo. |
| `codex/remove-agentation-20260910` | 3 · 10 | 2026-09-10 | **DESCARTE recomendado**: PR #55 cerrada sin merge y sustituida por la #100. |
| `codex/pr28-e2e-harness-validation-20260906` | 6 · 10 | 2026-09-10 | **DESCARTE recomendado**: su cierre documental ya está en `main` (PR #56). Confirmar equivalencia antes de borrar. |
| `codex/portal-colors-reception-integration-20260906` | 7 · 101 | 2026-09-06 | REVISIÓN PROPIA: QA local de colores y recepción; no se comprobó si su contenido entró por otra vía. |
| `codex/governance-final-100` | 20 · 101 | 2026-08-01 | REVISIÓN PROPIA: su último commit es producto («alinear RBAC de entrega manual VE»). |
| `codex/audit-hardening-20260801` | 5 · 42 | 2026-08-01 | REVISIÓN PROPIA. |
| `feat/no-olvidar` | 23 · 52 | 2026-07-29 | REVISIÓN PROPIA: SDD-0025 sigue `approved` en `main`. |
| `feat/sdd-0286-api-alcance-por-modulo` | 1 · 10 | 2026-08-24 | REVISIÓN PROPIA: SDD-0286 ya cerró por otra vía; verificar antes de descartar. |
| `claude/jolly-proskuriakova-3da0aa` | 2 · 24 | 2026-07-17 | REVISIÓN PROPIA: origen de la colisión ADVISORY de la spec 0068. |
| `preview/portal-nueva-compra` | 1 · 1 | 2026-07-29 | REVISIÓN PROPIA: rama SOLO-PREVIEW; origen de la colisión ADVISORY de la spec 0172. |

Locales sin integrar, además de las ocho reservas: `codex/c-integracion-ola1`,
`codex/pr33-schema-validation-20260907`, `codex/profile-integration-validation-20260906`,
`codex/portal-colors-reception-integration-20260906`, `codex/pr28-e2e-harness-validation-20260906`
y `codex/remove-agentation-20260910`. Las dos colisiones ADVISORY de specs seguirán apareciendo en
`sdd:next` mientras existan `claude/jolly-proskuriakova-3da0aa` y `preview/portal-nueva-compra`.

## Documento de restauración de la laptop

`docs/runbooks/restauracion-laptop-2026-09-05.md` y su adjunto
`docs/runbooks/assets/restauracion-laptop-2026-09-05/message.txt` llevaban siete días sin commit en
el checkout principal. Revisados antes de versionar: el adjunto contiene hashes SHA-256 de los
respaldos, nombres de rama y SHAs de Git; **no contiene secretos, tokens, credenciales ni datos
personales**. Se versionan en esta rama sin modificar su contenido. Las copias del checkout
principal se conservan hasta que esta PR se integre; retirarlas de `main` queda pendiente.

## Deudas registradas que no entran en los cuatro tramos

Quedan a la espera de un encargo propio; ninguna se convierte en pendiente de este documento.

- `skills-lock.json` declara ocho skills que no existen en `.agents/skills/` (`find-skills`, siete
  `higgsfield-*`) y omite las dos de `.claude/skills/` (`revisar-datos-ve`, `ui-pro`).
- `scripts/verify.mjs` conserva la lista manual de cuatro archivos Node: E1 y discovery corren en
  `harness:test` y CI, pero no en el paso harness de verify.
- Lint: 8 warnings, 0 errores — render impuro en `KommoBoardView.tsx:124`, setState en efecto en
  `KommoClient.tsx:553` y seis variables sin usar en dos tests de compras.
- Imports de `/m` desde Studio cruzando espacio de nombres (recomendación 5 de
  `d1-bucle-modulos-m-erp`, con el seguimiento asignado al Director).
- Cuatro ACL `no_olvidar` que difieren con la 0017, detectadas en el análisis del bloque C.
- E2E autenticado: 15 fallos basales en `auth.spec.ts` y `global-search.spec.ts` más 18 casos
  omitidos, repetidos en toda corrida sin configuración Supabase. El gate nunca cierra completo por
  ahí. Ya tiene watchdog (SDD-0454) pero no cobertura.

## Prompts de asignación

### Tramo 1 — Aislamiento de tenant en la cadena de aliados (SDD-0461, migración 0451)

```text
$worker
Objetivo: que la cadena de aliados no pueda cruzar tenants, de modo que ningún cliente se cotice
con la lista de precios de otro tenant ni cuelgue de un aliado ajeno.
Task ID / owner: aliados-cadena-tenant / la sesión que tome este encargo.
Repositorio: C:/Users/AKX generator/Desktop/Developer/DTDCARGO.
Worktree / rama / base: crea el aislamiento con `node scripts/harness-worktree.mjs start
aliados-cadena-tenant`; la rama es codex/aliados-cadena-tenant sobre origin/main 74b7fe34.
SDD: 0461, reservada por el Director en la rama local codex/sdd-reserve-0461-aliados-cadena-tenant
(commit 3818905b). Incorpórala por cherry-pick a tu rama y completá el stub
docs/specs/0461-aliados-cadena-tenant/spec.md; no reserves otro número. Migración libre: 0451.
Aceptación:
  1. FK compuesta `aliados (tenant_id, parent_aliado_id) → aliados (tenant_id, id)` que reutilice
     el índice `aliados_tenant_id_id_key`, con preflight de conteo que falle cerrado.
  2. `unique (tenant_id, id)` en `clients` y FK compuesta
     `aliados (tenant_id, client_id) → clients (tenant_id, id)`, con su propio preflight.
  3. `get_portal_brand()` redefinida con `and a.tenant_id = c.tenant_id` en una migración nueva,
     sin modificar la 0401 ya aplicada.
  4. `createClientAction` (app/studio/(app)/clientes/actions.ts:224) traduce el 23503 de las FK
     nuevas como ya traduce el 23505 vecino, sin cambiar la regla.
  5. Tests SQL en supabase/tests/ que demuestren el rechazo cruzado y la aceptación del mismo
     tenant. Cero cambios de comportamiento fuera de lo anterior.
Alcance: supabase/migrations/0451_*.sql, supabase/tests/, docs/specs/0461-*/spec.md, el sitio exacto
de actions.ts:224 y tu handoff. Exclusiones: no modificar 0362, 0382, 0401 ni 0450; no tocar el
Portal; no renumerar; no aplicar nada a producción.
Dependencias / orden: ninguna. 0450 ya está aplicada, así que el join de clientes ya es coherente;
esto cierra los dos huecos que quedaron en la cadena.
Contratos compartidos / riesgos: `aliado_prefix_chain` (0362:159-179) y `resolve_price_book`
(0382:292-328) suben por la cadena; hoy pueden tomar la lista del raíz sin filtrar tenant. Las FK
nuevas toman locks sobre `aliados` y `clients`: documentá el impacto como hizo
.agents/handoffs/aliado-tenant-coherence.md.
Validación: `corepack pnpm verify` con veredicto por paso (PASÓ / FALLÓ / NO EJECUTADO / NO
DISPONIBLE), más sql-tests y schema-rebuild. No debilites tests.
Autorización: commits locales selectivos; publicar tu rama y abrir PR en borrador, sí. Sin merge,
sin deploy, sin aplicar migraciones, sin leer filas de negocio.
Handoff: .agents/handoffs/aliados-cadena-tenant.md.
Ejecuta hasta completar; separa hallazgos ajenos y reporta bloqueos reales.
```

### Tramo 2 — Bloque C · L14 (migraciones 0420–0423, specs 0364–0366)

```text
$worker
Objetivo: extraer el lote L14 del bloque C — comandos, confirmación y recibos del Portal — desde la
PR #21 a una rama propia, con su SQL, sus specs y sus tests.
Task ID / owner: c-l14-portal-comandos-recibos / la sesión que tome este encargo.
Repositorio: C:/Users/AKX generator/Desktop/Developer/DTDCARGO.
Worktree / rama / base: `node scripts/harness-worktree.mjs start c-l14-portal-comandos-recibos`
sobre origin/main. Fuente de extracción: refs/dtd/pr/21 (= origin/codex/saneamiento-integral,
ea9952a4), en modo lectura; no la modifiques ni la publiques.
SDD: importá 0364, 0365 y 0366 con su numeración de la PR #21; no reserves números nuevos.
Migraciones: 0420, 0421, 0422 y 0423, también con su numeración de origen.
Aceptación: el lote entra completo según docs/audits/c-analisis-bloque-c.md — comandos,
queries/types/proof, actions de Portal y Studio, formularios, confirmación, recibos y los tests del
manifest 0365. Reutiliza el principal que L18 ya entregó en main (PR #66); no lo redefinas.
El orden de aplicación queda escrito en la PR: 0420+0421 → despliegue y smoke de comandos → 0422 →
0423. Ninguna migración se aplica en esta tarea.
Alcance: las cuatro migraciones, las tres specs, el código de producto del lote y sus tests.
Exclusiones: nada de los lotes L07 y L10; no absorbas los 111 archivos mezclados que el análisis
declaró ajenos; no toques el cutoff ni pendingBelowCutoff.
Dependencias / orden: L18 ya está en main, así que este lote está desbloqueado. No arranques L10 ni
L07 desde esta rama.
Contratos compartidos / riesgos: los solapamientos del lote están en
docs/audits/c-analisis-bloque-c-solapamientos.md y ninguno está resuelto; resolvé los de L14 en tu
rama y dejá constancia de cuál elegiste y por qué.
Validación: `corepack pnpm verify` con veredicto por paso, más sql-tests y schema-rebuild.
Autorización: commits locales selectivos; publicar rama y PR en borrador, sí. Sin merge, sin
deploy, sin aplicar migraciones.
Handoff: .agents/handoffs/c-l14-portal-comandos-recibos.md.
Ejecuta hasta completar; separa hallazgos ajenos y reporta bloqueos reales.
```

### Tramo 3 — Bloque C · L10 (migraciones 0410 y 0415, specs 0353 y 0358)

```text
$worker
Objetivo: extraer el lote L10 del bloque C — recordatorios y Cobranzas — desde la PR #21 a una rama
propia, con su SQL, sus specs y su test.
Task ID / owner: c-l10-recordatorios-cobranzas / la sesión que tome este encargo.
Repositorio: C:/Users/AKX generator/Desktop/Developer/DTDCARGO.
Worktree / rama / base: `node scripts/harness-worktree.mjs start c-l10-recordatorios-cobranzas`
sobre origin/main. Fuente: refs/dtd/pr/21 en lectura.
SDD: importá 0353 y 0358 con su numeración de origen. Migraciones: 0410 y 0415.
Aceptación: entra `recordatorios-queries` con su test y el manifest 0410, según el plan de lotes.
El orden queda escrito en la PR: 0410 → despliegue y verificación de Cobranzas → 0415. La 0399, que
este lote exige de base, ya está en main.
Alcance: las dos migraciones, las dos specs, recordatorios-queries y su test. Exclusiones: nada de
L07 ni L14; este lote no depende de L08 y no debe arrastrarlo.
Dependencias / orden: arranca después de que el tramo 2 tenga su PR publicada, para no cruzar dos
despliegues de Cobranzas con los del Portal.
Validación: `corepack pnpm verify` con veredicto por paso, más sql-tests y schema-rebuild.
Autorización: commits locales selectivos; publicar rama y PR en borrador, sí. Sin merge, sin
deploy, sin aplicar migraciones.
Handoff: .agents/handoffs/c-l10-recordatorios-cobranzas.md.
Ejecuta hasta completar; separa hallazgos ajenos y reporta bloqueos reales.
```

### Tramo 4 — Bloque C · L07 (migraciones 0407 y 0411–0414, specs 0350 y 0354–0357)

```text
$worker
Objetivo: extraer el lote L07 del bloque C — fidelización y reports, conversations y sales-orders —
desde la PR #21 a una rama propia, respetando su secuencia de despliegue.
Task ID / owner: c-l07-fidelizacion-conversations / la sesión que tome este encargo.
Repositorio: C:/Users/AKX generator/Desktop/Developer/DTDCARGO.
Worktree / rama / base: `node scripts/harness-worktree.mjs start c-l07-fidelizacion-conversations`
sobre origin/main. Fuente: refs/dtd/pr/21 en lectura.
SDD: importá 0350, 0354, 0355, 0356 y 0357 con su numeración de origen. Migraciones: 0407, 0411,
0412, 0413 y 0414.
Aceptación: entran fidelización/reports, conversations queries/types y su API, sales-orders queries
y los tests exactos de esos manifests. Los cuatro productores preceden a la 0414 y eso queda
escrito en la PR como secuencia: SQL de expansión → desplegar facades consumidoras → smoke por
roles → cierre con 0414. No es un único paso de base de datos y la PR debe decirlo.
Alcance: las cinco migraciones, las cinco specs, el código de producto del lote y sus tests.
Exclusiones: nada de L10 ni L14; no absorbas los 111 archivos ajenos del análisis.
Dependencias / orden: último de los cuatro tramos. Arranca cuando el tramo 3 tenga su PR publicada.
Validación: `corepack pnpm verify` con veredicto por paso, más sql-tests y schema-rebuild.
Autorización: commits locales selectivos; publicar rama y PR en borrador, sí. Sin merge, sin
deploy, sin aplicar migraciones.
Handoff: .agents/handoffs/c-l07-fidelizacion-conversations.md.
Ejecuta hasta completar; separa hallazgos ajenos y reporta bloqueos reales.
```

## COMPLETADO

- Estado reconstruido desde Git, GitHub, specs y handoffs, con `git fetch origin` y
  `node scripts/director-status.mjs`.
- Cleanup ejecutado y registrado arriba: un worktree removido, uno desregistrado con residuo
  diagnosticado, 62 ramas locales borradas, ocho reservas conservadas con motivo.
- SDD-0461 reservada en `codex/sdd-reserve-0461-aliados-cadena-tenant` (`3818905b`), sin publicar y
  sin tocar el árbol de `main`: el commit se construyó con plumbing sobre el árbol de `main`.
- Dictamen de las once ramas remotas y las seis locales sin integrar, sin borrar ninguna.
- Documento de restauración de la laptop versionado en esta rama tras revisarlo por secretos y PII.
- Los cuatro prompts de asignación, sin placeholders.

## VALIDACIÓN

- PASÓ: `git fetch origin`; `git worktree list`; ancestralidad en `main` de `cf234269` y `f2c47091`.
- PASÓ: `node scripts/director-status.mjs` — 3 worktrees al inicio, 217 refs, 0 PRs, 0 solapamientos.
- PASÓ: `corepack pnpm sdd:check` — sin números repetidos.
- PASÓ: `corepack pnpm sdd:next` — spec siguiente 0461, migración siguiente 0451.
- PASÓ: revisión del adjunto `message.txt` contra patrones de secretos y PII — sin hallazgos.
- PASÓ: `git worktree remove` de `skills-agentation-retirar`, exit 0.
- FALLÓ: `git worktree remove` de `.claude/worktrees/nervous-tharp-418741`, exit 255,
  `Filename too long`. Desregistró el árbol; el directorio quedó huérfano.
- PASÓ: `git branch -d` sobre 62 ramas integradas, cero rechazos.
- NO EJECUTADO: `git branch -d` de las ocho reservas stub — no son ancestros y `-D` está prohibido.
- NO DISPONIBLE: ledger de producción y `migrations-applied`, sin credenciales en esta sesión.
- NO EJECUTADO: `corepack pnpm verify` — esta rama solo agrega documentación de dirección; el gate
  de producto corresponde a cada tramo. Las pruebas de producto no aplican a este contenido.

## COMMITS

- Commit que contiene este documento y el runbook de restauración; el SHA final se registra en la PR.

## PR / BRANCH

Rama `codex/director-cierre-bloque-c` sobre base `main` `74b7fe34`, en el worktree indicado arriba.
PR en borrador con la autorización de publicación de este encargo. Sin merge.

## PENDIENTES DE ESTA TAREA

- Asignar el tramo 1 y, en cadena, los tramos 2 a 4. Cada uno con su Worker, su rama y su PR.
- Retirar de `main` las dos copias sin commitear del runbook de restauración cuando esta PR se
  integre.
- Purga del directorio huérfano `.claude/worktrees/nervous-tharp-418741`: necesita autorización
  puntual de Sam, porque la vía que funciona en Windows (`robocopy /MIR` desde PowerShell) es
  justamente la que el runbook excluye como fallback automático.
- Descarte de `codex/remove-agentation-20260910` y `codex/pr28-e2e-harness-validation-20260906`:
  recomendado, pendiente de autorización de borrado remoto.
- Revisión propia de las seis ramas marcadas REVISIÓN PROPIA, incluidas las dos que sostienen las
  colisiones ADVISORY de specs.

## FUERA DE ALCANCE DETECTADO

- Las seis deudas de la sección «Deudas registradas»: manifiesto de skills, lista manual de verify,
  ocho warnings de lint, imports de `/m`, cuatro ACL `no_olvidar` y el E2E autenticado.
- El destino del resto de la PR #21 después de L07, L10 y L14: el análisis dejó 111 archivos que
  mezclan accesibilidad, CSP, observabilidad y SDD ajenos, y 39 colisiones textuales o estructurales
  sin resolver. Merece una decisión de dirección propia, no un lote más.

## HANDOFF AL DIRECTOR

Siguiente acción: asignar el tramo 1 con el prompt de arriba. La reserva SDD-0461 está creada pero
sin publicar, así que no excluye a otro equipo hasta que salga a `origin`. El cleanup dejó dos
cosas abiertas que necesitan una autorización puntual de Sam: la purga del directorio huérfano y el
borrado de las dos ramas remotas recomendadas para descarte. Ownership de esta rama de coordinación:
`director-cierre-bloque-c-20260912`, sin liberar mientras el objetivo siga abierto.
