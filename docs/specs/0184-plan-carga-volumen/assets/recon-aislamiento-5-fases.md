# Informe de aislamiento — SDD-0184 (5 fases) frente a la sesión de gobernanza (Codex)

Raíz del worktree (todas las rutas de abajo cuelgan de acá):
`C:\Users\Trabajo\Desktop\Claude\DTDCargo\container-loading-design-plan-db597c`

---

## 1. Veredicto de aislamiento

**SÍ.** Las 5 fases se pueden correr en un worktree separado sin chocar con la sesión de gobernanza, con tres condiciones duras que no son negociables.

**Evidencia (todo VERIFICADO en vivo):**

- El worktree actual ya es dedicado y está limpio: rama `claude/container-loading-design-plan-db597c`, HEAD `341070fc` — **exactamente igual** a `origin/main` y a `main` local. `git status --porcelain` vacío. Tiene `.env.local` (3034 B) y `node_modules` propio (`require.resolve('next/package.json')` cae adentro de esta carpeta, no en otra). **No hace falta crear un worktree nuevo.**
- La gobernanza **no descubre código**: `scripts/build-component-registry.mjs:9,65` solo lee `docs/governance/components/`; nunca hace `readdir` sobre `app/` ni `components/`. `scripts/build-governance-capsule.mjs` solo lee `policies/*.md`. Los corrí ahora: `CMP-01 válido: 4 fuente(s)`, `Gobernanza: 27 política(s) aprobada(s) · cápsula vigente`, `docs:check` verde. Crear componentes nuevos en Fases 3, 4 y 5 **no toca nada de gobernanza**.
- Precedente consumado: la Fase 1 ya está en `main` (3 commits) y tocó cero archivos de `docs/governance/`.

**El punto de contacto no es uno solo — son dos archivos, y hay que nombrarlos:**

1. `docs/specs/README.md` — generado por `scripts/build-docs-index.mjs`. Las dos sesiones lo reescriben al cerrar cualquier SDD. Conflicto de una línea, se resuelve regenerando.
2. `supabase/migrations-baseline.json` — obligatorio tocarlo si una migración de 0184 queda sin aplicar a prod. Codex ya tiene su entrada `0270_audit_governed_query_rbac` ahí (VERIFICADO leyendo el archivo).

Un tercero, opcional según cómo se cierre: `docs/architecture/module-sdd-map.md` (línea 49 = Naviera → SDD-0047; línea 66 = `app/m/cn/`). Solo se toca al cerrar fases.

**Las tres condiciones:**

- **No registrar ningún componente en CMP-01.** Está explícitamente permitido: `docs/governance/policies/cmp-01.md:32` dice que crear un componente no lo hace canónico. Registrarlo cascadearía a 6 archivos que Codex está editando hoy, dos con conteos quemados (`scripts/__tests__/component-registry.test.ts:18` espera exactamente 4).
- **Numerar migraciones desde 0294, no desde 0289.**
- **No editar `playwright.config.ts` ni `.claude/settings.json`** (ambos trackeados; el primero ya está modificado en `codex/governance-roadmap-batch`).

---

## 2. Fuentes de choque reales

| Archivo / recurso | Por qué chocaría | Gravedad | Cómo se evita |
|---|---|---|---|
| **Numeración de migraciones 0289–0293** | VERIFICADO: `origin/main` llega a **0288**, pero las ramas locales `codex/governance-roadmap-batch` y `codex/governance-roadmap-integration` ya tienen `0289_audit_d1_access_configuration.sql` … `0293_audit_d5_residual_and_writer_retirement.sql`. `git ls-tree origin/main` **no las ve**. La spec de 0184 reserva 0289/0290/0291. | **Alta** | Arrancar en **0294**. Barrer `git for-each-ref refs/heads refs/remotes` (no solo `origin/main`) justo antes de crear cada `.sql`. Renumerar §5 del spec en el mismo commit. |
| `supabase/migrations-baseline.json` | Una migración con número > cutoff (238) que no esté en el ledger de prod pone **rojo** el paso `migrations-applied` para toda ventana con `.env.local`. Codex edita el mismo archivo. | **Alta** | Editar SOLO la entrada nueva dentro de `pendingBelowCutoff`, con motivo explícito, copiando la forma de la entrada `0270`. `findMissing` (`scripts/check-migrations-applied.mjs:120-126`) acepta esperas por encima del corte ("raro pero válido"). Commit selectivo del archivo. |
| **Base de datos de producción** (`xpfuzqombmjmxvprjgmi`) | Es el ÚNICO estado realmente compartido. `.env.local` apunta a prod, no a local. Codex está publicando 0289–0293 sobre tablas de auditoría. | **Alta** | Nunca `pnpm seed` ni `pnpm seed:e2e`. Migraciones quedan como archivo en la rama; aplicar solo con el runbook `docs/runbooks/aplicar-migraciones-prod.md`, de a UNA, con OK del founder nombrando el archivo. |
| **Alcance REV-SGE-009** (`docs/governance/reviews/adoption-plan-sge-btn-vis-avs-2026-07-29.md`) | El Slice C1 "estibar/desestibar" y el E1 "una ruta `app/m/`" ya están reservados por gobernanza. La Fase 4 aterriza exactamente ahí. Choque de alcance, no de texto. | **Alta** | Decisión del founder, no técnica. Ver pregunta 2 de la sección 7. |
| `docs/specs/README.md` | Generado; ambas sesiones lo reescriben. | Media | Nunca editarlo a mano. Ante conflicto: tomar el de `origin/main`, correr `node scripts/build-docs-index.mjs`, commitear. |
| `playwright.config.ts` | Modificado en `codex/governance-roadmap-batch` (timeout 60 s + `--webpack`), sin mergear. | Media | No tocarlo. Todo por variable de entorno (`E2E_PORT`, `BASE_URL`). |
| `docs/governance/generated/*.json` | Generados y editados por Codex. Un merge de `origin/main` con políticas nuevas y cápsula desfasada pone `governance:check` rojo por algo ajeno. | Media | No resolver a mano: `git checkout --theirs` + regenerar con `node scripts/build-governance-capsule.mjs`. |
| **Puerto E2E** | `e2ePort()` (`scripts/verify.mjs:107-110`) mapea `sha1(cwd)` a un rango de 700. VERIFICADO: este worktree cae en **3419**, y es **único** entre los 37 worktrees vivos. Hay 2 colisiones reales, pero entre carpetas ajenas (3506 lo comparten `aliados-white-label-a0a7a0`, `sdd-0166-tenant-lifecycle-design` y `shipment-public-timeout-gate`; 3655 lo comparten `fix-portal-calc-intent` y `governance-mp01-decisions`). | **Baja si te quedás acá** | Quedarse en este worktree. Si se crea uno nuevo, recalcular el puerto antes y fijar `E2E_PORT` a mano. Corrección al dossier: el número 3549 que circulaba **no es** el de este worktree. |
| **Contenedores Docker del gate** | `dtd_sqltest_<hash8>` y `dtd_rebuild_<hash8>` se derivan de `sha1(cwd)` y corren **sin `-p`** (no publican puerto). No chocan. El costo es RAM: 2 Postgres 17 + un `next dev` por corrida. | Baja | Nada que arreglar en código. No correr el gate completo al mismo tiempo que Codex si la máquina va justa. |
| **Hook `Stop`** (`.claude/settings.json` → `scripts/harness-verify-hook.mjs`) | VERIFICADO: timeout 180 s, dispara `verify.mjs` completo si hay cambios sin commitear en `app/`, `lib/` o `supabase/`. Las fases 2–5 tocan los tres. El gate completo no entra en 180 s. | Media | `VERIFY_SKIP_SQL=1` y `VERIFY_SKIP_E2E=1` durante el desarrollo iterativo (degradan a SKIP por diseño). Gate completo a mano una vez por fase. **No editar `.claude/settings.json`**: es trackeado y compartido. |
| **`.git` compartido por 37 worktrees** | Dos `git fetch` simultáneos pueden fallar con lock transitorio sobre `refs/remotes`. | Baja | Reintentar. No correr `git worktree prune` desde esta ventana. |

---

## 3. Cómo se crea el worktree

**Recomendación: no lo crees.** El worktree actual ya está provisto y verificado — `.env.local` presente, `node_modules` propio, HEAD igual a `origin/main`, árbol limpio, puerto E2E sin colisión. Crear otro cuesta un `pnpm install` completo y agrega una carpeta más a las 37 que ya cuelgan del mismo `.git`.

Si aun así lo querés, el procedimiento oficial es uno solo:

```bash
node scripts/harness-worktree.mjs start sdd-0184-plan-carga
```

Eso hace las tres cosas de golpe (VERIFICADO con `--dry-run`): crea el worktree en `C:\Users\Trabajo\Desktop\Developer\software\DTD-worktrees\sdd-0184-plan-carga` sobre rama `feat/sdd-0184-plan-carga` a partir de `main` local, corre `git branch --unset-upstream` (evita el push accidental a `main`), copia `.env.local` desde el worktree principal y corre `pnpm install` con `cwd` dentro de la carpeta destino.

Ojo con el runbook: `docs/runbooks/git-worktrees-multiventana.md` §2 dice `C:\Users\Trabajo\Desktop\DTD-worktrees\`. **Está desactualizado** — el script calcula la ruta desde el padre del worktree principal, que hoy es `Developer\software\`.

Para que sea funcional, verificá después:

```bash
test -f .env.local && echo OK env || echo FALTA env
node -e "console.log(require.resolve('next/package.json'))"   # tiene que caer DENTRO de la carpeta
node -e "const c=require('crypto');const h=c.createHash('sha1').update(process.cwd()).digest();console.log('E2E_PORT',3100+(h.readUInt16BE(0)%700))"
```

Dos firmas de falso-rojo que se leen mal: **todos** los pasos en `MODULE_NOT_FOUND` = falta `pnpm install`; **solo** los e2e de auth/global-search en rojo = falta `.env.local`. Ninguna de las dos es código roto.

⚠️ `pnpm install` SIEMPRE con el `cd` adentro de la carpeta destino. Correrlo con el cwd cruzado deja el `node_modules` apuntando al `.pnpm` de otro worktree, y el síntoma es Turbopack muriendo con "Next.js inferred your workspace root" — un error que no se parece en nada a la causa. Cura: `CI=true pnpm install` en la carpeta afectada. **No** tocar `turbopack.root`.

Limpieza al cerrar: solo `node scripts/harness-worktree.mjs finish <slug>` (trae el fallback robocopy para el `Filename too long` de Windows y aborta si hay cambios sin commitear).

---

## 4. Las 5 fases: superficie real

### Fase 2 — Catálogo de contenedores

**Migración:** `supabase/migrations/0294_container_types_activos.sql` (número tentativo, revalidar). Patrón a calcar: `0269_prealertas_client_note.sql` (`lock_timeout`/`statement_timeout`, bloque `do $$ if not exists (select 1 from pg_constraint)` para el CHECK) y `0241_estiba_por_zonas.sql:44-58` (mismo objeto, misma tabla). `add column if not exists`, UPDATE **por `code`** nunca por id, idempotente para sobrevivir a `check-schema-rebuild.mjs`. Escribir con **LF** (`.gitattributes` marca `supabase/migrations/*.sql -text`).

**Crear:** `supabase/tests/0294_container_types_activos.test.sql` · entrada nueva en `supabase/migrations-baseline.json`.

**Modificar:** `lib/studio/naviera/types.ts` (constante `CONTAINER_TYPES:47-51`, `40HC` de 76 → 68; tipo `ContainerType` gana `active` y `cbm_alert_ceiling`) · `lib/studio/naviera/queries.ts` (`CONTAINER_TYPE_COLUMNS:48-49`, `listContainerTypes:216-229` gana `activeOnly` copiando el patrón de `listCarriers:188-202`) · `app/studio/(app)/naviera/page.tsx:42,81` · `lib/studio/naviera/__tests__/container-stats.test.ts:96` (aserción literal `cbm: 76` → 68) · `lib/studio/naviera/__tests__/capacity-guard.test.ts:20` (comentario) · `app/m/cn/estibar/_components/AbrirContenedorButton.tsx:13,115` (el select del operario usa `CONTAINER_TYPE_OPTIONS` **hardcodeado**, no la DB).

**Orden interno:** (1) migración + test SQL + baseline; (2) constante `types.ts` y tests en el **mismo commit** — si no, la DB dice 68, el WMS lee 68 y Naviera sigue calculando sobre 76 en la misma sesión; (3) filtro `activeOnly` en las dos listas; (4) capturar la utilización antes/después que pide §9 del spec.

**Regla que no se rompe:** `active` filtra SOLO listas de opciones. Los validadores (`isContainerTypeCode` → `validateBookingInput:574`, `validateConsolidationInput:633`) y `containerStats` siguen aceptando cualquier code del catálogo, o se rompe la edición de consolidaciones históricas con 40GP. Dejarlo escrito como comentario en `types.ts`.

### Fase 3 — Plan + planta 2D en el Studio

**Migración:** `supabase/migrations/0295_consolidation_plans.sql`. Patrón exacto: `0147_supplier_packing_uploads.sql` — `version_no` + `is_current` (:42-43), unique index parcial `where is_current and deleted_at is null` (:76-78), RLS por tenant con `deleted_at is null` en el `using` (:88-107), RPC atómica con `pg_advisory_xact_lock` (:159-241), `revoke execute from public/anon`.

**Crear:** `lib/studio/naviera/plan-queries.ts` · `lib/studio/naviera/plan-types.ts` · `app/studio/(app)/naviera/_components/PlantaCargaView.tsx` (puro, sin hooks, como `ContainerIsoView`) · `app/studio/(app)/naviera/_components/PlanCargaPanel.tsx` (`"use client"`) · `lib/studio/naviera/__tests__/plan-queries.test.ts` · `supabase/tests/0295_consolidation_plans.test.sql`.

**Modificar:** `app/studio/(app)/naviera/page.tsx` (sumar `getZoneLayouts` + plan vigente + lotes, mapeados por `consolidationId` como ya se hace con los snapshots :65-71) · `app/studio/(app)/naviera/actions.ts` (server action `recalcularPlanCarga`, calcando `authorizeConsolidation:568-632`: `moduleEditDenial(supabase,'naviera')` → `resolveTenant()` → validador propio sin Zod → guard de estado → `revalidate()`) · `app/studio/(app)/naviera/_components/NavieraClient.tsx` (diff **mínimo**: un import y un bloque de render) · `app/studio/(app)/naviera/_components/UtilizationBar.tsx` (prop opcional para marcar el techo 66,4).

**Dato duro que cambia el plan:** el detalle del contenedor **no es un drawer** — vive inline en `ContainerDetail` dentro de `NavieraClient.tsx` (1809 líneas). `ConsolidationDrawer.tsx` es solo el alta. No existe patrón de tabs dentro de drawer en naviera.

**Fuente de los lotes:** `consolidation_items` como primaria (tiene `cbm`/`pieces` reales y es la misma que alimenta las barras). El camino del hub (agrupar `warehouse_boxes` por `prealerta_id`) da la cantidad de cajas correcta y **CBM 0**: `0244:147-164` crea la caja "esperada" sin `cbm`, y `0245:126-141` crea el receipt con `boxes=0` y sin `total_cbm`.

**Orden interno:** migración + test SQL → `plan-queries.ts`/`plan-types.ts` + su test → `PlantaCargaView` → `PlanCargaPanel` → enganche en `NavieraClient` → `/ui-check`.

**Nota de gobernanza:** si el plan entra como 5º tab, los 4 tabs actuales (`NavieraClient.tsx:201-236`) son `<button>` planos **sin `role="tablist"`**. A11Y-01 regla 11 + SGE-00 §5 lo alcanzan. O se implementa el contrato copiando lo que hizo SDD-0180 en `FiscalClient.tsx` (~30 líneas), o se declara como no conformidad heredada en el spec. Meterlo como bloque dentro de `ContainerDetail` (entre las barras y la estiba) esquiva el tema por completo.

### Fase 4 — El lazo plan ↔ realidad

**Migración:** `supabase/migrations/0296_estiba_plan_vs_real.sql`. Agrega `plan_id` + `siguio_plan` a `consolidation_box_positions`. **Crítico:** `CREATE OR REPLACE` sobre `stuff_lot_as_operario` crea una **sobrecarga**, no un reemplazo — quedan vivas las dos firmas y la nueva nace sin los `revoke` de `0246:256-259`, que apuntan a la aridad vieja. Hay que crear la firma nueva, `drop function if exists public.stuff_lot_as_operario(uuid,uuid,text,int,int);` y re-emitir `revoke public/anon/authenticated` + `grant service_role` sobre la nueva.

**Crear:** `app/m/ve/bodeguero/descarga/page.tsx` · `app/m/ve/bodeguero/descarga/[consolidationId]/page.tsx` · `app/m/ve/bodeguero/descarga/_components/DescargaClient.tsx` · `supabase/tests/0296_estiba_plan_vs_real.test.sql` (que no queden dos entradas en `pg_proc`) · la ruta imprimible (`.../[consolidationId]/imprimir/page.tsx`, molde: `app/studio/(app)/cola-qr/[id]/imprimir/page.tsx` + `PrintButton.tsx`).

**Modificar:** `app/m/cn/estibar/[consolidationId]/page.tsx` (hoy :60-69 solo lee `load_order`; cargar el plan vigente) · `app/m/cn/estibar/_components/EstibaClient.tsx` (paso sugerido, confirmación de un toque con el lado pre-seleccionado desde el plan, toggle Plan/Real; y migrar el `<input type="number">` crudo de :347 a `NumericInput`, que `app/m/CLAUDE.md` ya prohíbe) · `app/m/cn/estibar/actions.ts` (`lookupLotAction:195-268` **lee** `box.prealerta_id` en :210 y lo descarta — hay que exponerlo, o no se puede decir "la caja que escaneaste es el paso 3"; `stuffLotAction` suma `p_plan_id` y `p_siguio_plan`; `humanizeStuffError:365-383` suma los errcodes nuevos) · `app/m/cn/estibar/page.tsx` (badge "Plan v3 · 4 de 7 lotes").

**Orden interno:** migración + test SQL → exponer `prealerta_id` en lookup y RPC → paso sugerido en `EstibaClient` → toggle Plan/Real → reporte imprimible → vista VE (solo lectura).

**Hueco de modelo:** `warehouse_receipt_ve_boxes` es una tabla **distinta** de `warehouse_boxes`, sin `consolidation_id` ni FK a `consolidations`. El único vínculo es `source_receipt_cn_id` → `warehouse_receipts_cn`, que no llega a la consolidación. La vista VE arranca como guía de solo lectura; el puente real es alcance nuevo.

### Fase 5 — Calculadora pública de llenado

**Sin migración. Es la única fase inmune al riesgo de numeración.**

**Crear:** `lib/shared/container-catalog.ts` (la pieza que falta: el catálogo tipado como `EspacioCarga`, con 68 y 66,4 — `CONTAINER_TYPES` vive en `lib/studio` y está prohibido por ESLint) · `app/<ruta>/page.tsx` (nombre a definir; `/calculadora` ya está tomado por un 301 a `/tarifas` en `next.config.ts:336`) · `components/LlenadoCalculator.tsx`.

**Modificar:** `eslint.config.mjs` (agregar el glob de la ruta nueva al array de `files`, líneas 46-65) · `app/sitemap.ts` · `components/Nav.tsx` (dropdown "recursos" :20-25, no un 5º link de nivel 1) · `app/recursos.css` si hacen falta clases nuevas.

**Corrección al spec:** `docs/specs/0184-plan-carga-volumen/spec.md:286` afirma que "`pnpm lint` valida por sí solo la frontera". **Es falso.** VERIFICADO leyendo `eslint.config.mjs:43-85`: la frontera es una **allowlist explícita de globs**, no una regla global. La lista ya está desactualizada — nombra `app/track/**`, que **no existe en disco** (verificado con `ls`), y omite `app/estimacion`, `app/registro`, `app/privacidad`, `app/terminos`, `app/cookies`, `app/verificar`. Una ruta nueva sin su glob queda **sin vigilancia**. Hay que corregir esa línea del spec.

**Orden interno:** (1) glob en `eslint.config.mjs` + **mutación de prueba** (meter a propósito un `import "@/lib/studio/..."` en la página nueva, correr `pnpm lint`, confirmar rojo, revertir — sin eso el gate es decorado); (2) `container-catalog.ts` + tests; (3) `LlenadoCalculator.tsx` (vive en `components/`, ya cubierto por la allowlist :64); (4) página + sitemap + Nav.

**Patrón SVG obligatorio** (`components/CbmExplicador.tsx:128-152`): relleno por `style={{fill:'var(--color-wine)'}}`, **nunca** `fill="var(--x)"` como atributo — no resuelve en Safari, bug ya cazado y corregido en el commit 2bd21155.

---

## 5. Orden de corrida y puntos de verificación

**Orden recomendado: 5 → 2 → 3 → 4.**

La Fase 5 primero porque no crea migraciones, no depende de nada y define `lib/shared/container-catalog.ts` como fuente única desde el arranque — así la Fase 2 hace que `lib/studio/naviera/types.ts` **importe** de shared en vez de duplicar la cifra (studio → shared es dirección permitida). Si preferís el orden natural 2 → 3 → 4 → 5, funciona igual; lo que no funciona es hacer la 3 antes que la 2 (la 3 necesita `active`, `cbm_alert_ceiling` y la capacidad corregida).

**Al cerrar cada fase:**

- **Fase 5:** `pnpm lint` con la mutación de import del ERP (rojo esperado, después revertir) · `pnpm test` · `pnpm build` · `/ui-check` · voltear el estado de la fase en `docs/specs/0184-plan-carga-volumen/spec.md` §7 + corregir la línea 286 · `node scripts/build-docs-index.mjs`.
- **Fase 2:** `node scripts/run-sql-tests.mjs` (el test nuevo validado **por mutación**: romperlo a propósito y confirmar que se pone rojo) · `node scripts/check-schema-rebuild.mjs` · `pnpm test` (los dos tests de `lib/studio/naviera/__tests__/` con el literal 76) · captura de la utilización que reporta el Studio antes y después.
- **Fase 3:** gate completo · verificación de que solo existe un `is_current` por consolidación · `/ui-check` sobre la planta 2D.
- **Fase 4:** `node scripts/run-sql-tests.mjs` confirmando que no quedaron dos entradas en `pg_proc` para `stuff_lot_as_operario` · medición de contraste **en navegador** de la planta 2D sobre navy · `/ui-pro`.

**Gate completo, una sola vez por fase:**
```
VERIFY_SKIP_SQL= VERIFY_SKIP_E2E= E2E_PORT=3419 node scripts/verify.mjs
```
Durante el desarrollo iterativo, `VERIFY_SKIP_SQL=1 VERIFY_SKIP_E2E=1` para que el hook `Stop` entre en sus 180 s.

**Antes de CADA commit:** `git fetch origin && git merge origin/main` · `git branch --show-current` · commits **selectivos por ruta**, nunca `git add -A`.

**Dónde NO se puede seguir sin el OK del founder** (tres paradas duras, una por migración):

1. Antes de aplicar `0294_container_types_activos.sql` a producción.
2. Antes de aplicar `0295_consolidation_plans.sql`.
3. Antes de aplicar `0296_estiba_plan_vs_real.sql`.

En las tres rige `docs/runbooks/aplicar-migraciones-prod.md`: OK del founder **nombrando el archivo**, de a UNA (nunca en bundle), `name` = basename exacto. Mientras no se apliquen, cada una necesita su entrada en `supabase/migrations-baseline.json` con motivo explícito, o el paso `migrations-applied` se pone rojo **en todas las ventanas que tengan `.env.local`**, no solo en la nuestra.

⚠️ Matiz importante que contradice al dossier: el `$doc` del baseline dice literalmente que `pendingBelowCutoff` **nunca** se use para tapar una migración nueva sin aplicar. Mecánicamente sí funciona (`findMissing:123` acepta esperas por encima del corte, y las entradas `0257` y `0270` ya lo hacen), pero la entrada tiene que declarar el motivo y el gate humano que la destraba — exactamente como la de `0270`. No es una excusa para dejar tres migraciones colgadas indefinidamente.

Y hay una cuarta parada, que no es técnica: **el alcance de la Fase 4** (ver pregunta 2).

---

## 6. Lo que puede salir mal en una corrida larga

1. **Codex acuña 0294 mientras vos escribís 0294.** Ya pasó con este patrón: el repo arrastra duplicados reales (`0243` x2, `0247` x2, `0261`/`0261b`, `0277` x2). El barrido hay que repetirlo **justo antes de crear cada archivo**, y sobre `refs/heads` **y** `refs/remotes` — un `git ls-tree origin/main` no ve las ramas locales de Codex, que es exactamente cómo 0289–0293 se volvieron invisibles. Si choca, renumerar es barato mientras no esté aplicada.

2. **Aplicás la migración de Fase 2 y las barras del Studio no se mueven.** `containerStats` (`lib/studio/naviera/types.ts:344-365`) y `evaluateCapacity` (:386-406) leen la constante hardcodeada, **nunca** la DB. El único que sí lee la DB es `containerCapacityCbm` (`lib/studio/inventory/queries.ts:311-321`, WMS). Resultado: en la misma sesión el WMS diría 68 y Naviera 76 — peor que la contradicción de hoy. Migración y constante van en **un solo commit**.

3. **El 76 → 68 mueve números en pantallas vivas y parece un bug.** Un contenedor con 70 CBM que leía 92% pasa a leer 103% y dispara el aviso de sobre-capacidad (`NavieraClient.tsx:599-609`, `:1031-1044`, `:1086-1098` con el umbral literal `freeCbm > 3`; `AssignCargoDrawer.tsx:173-189`). El WMS cambia **sin tocar código**, al aplicar la migración. Hay que anunciarlo como cambio de lectura esperado, y revisar si ese `> 3` sigue teniendo sentido.

4. **El plan reparte todo al mismo tramo porque los lotes vienen con CBM 0.** Si la consulta de lotes va por el camino del hub, `warehouse_boxes.cbm` es NULL para toda caja nacida de prealerta. El motor lo tolera (`estiba-plan.ts:391-396`) pero el plan sale inútil y **en silencio**. Usar `consolidation_items` como primaria y avisar en pantalla cuando un lote llega sin volumen.

5. **La planta 2D coloreada por cliente sale ilegible en el teléfono.** `app/m/layout.tsx:68` fuerza `data-theme="light"` en toda la PWA, pero estibar pinta sobre `--bg-sidebar` (#0F1E3D). Medido en el dossier: `--cat-2` (#3A4E8C) sobre ese navy da ~2,08:1, contra el 3:1 que pide WCAG 1.4.11 para componentes no textuales. Se descubre tarde si se mira a ojo. O la planta vive sobre superficie clara, o se agregan tokens `--cat-*-on-navy`. Medir en navegador.

6. **La firma vieja del RPC queda viva y sin `revoke`.** Con `CREATE OR REPLACE` conviven las dos aridades, cada una con sus propios grants, y la nueva nace sin los `revoke` de `public`/`anon`. Es literalmente la deuda que el repo ya cerró una vez. El test contractual SQL tiene que contar entradas en `pg_proc`.

7. **El gate se pone rojo por algo que no es tuyo.** Si Codex mergea una política nueva a `main` sin regenerar la cápsula, `governance:check` cae del lado ajeno. Se cura con `git merge origin/main` + regenerar, nunca resolviendo el JSON a mano.

8. **El hook `Stop` te come el turno.** Levanta 2 Postgres + un `next dev` cada vez que hay cambios sin commitear en `app/`, `lib/` o `supabase/` — o sea, casi siempre en las fases 2 a 5. Con Codex haciendo lo mismo son 4 Postgres y 2 dev servers. Y bloquea el cierre con `exit 2` si queda rojo.

9. **El e2e de Fase 4 escribe en producción.** El ciclo completo que pide §9 del spec crea consolidaciones reales vía `request_consolidation_as_operario` → `next_consolidation_ref`, y un correlativo `DTD-CONSOL-NNNN` quemado **no se recicla**. `pnpm dev` en este repo apunta siempre a la nube de producción. No hay precedente de e2e que escriba: los 4 specs actuales son de lectura o se auto-omiten. Hay que decidirlo antes de escribirlo.

10. **`main` se mueve bajo los pies.** Durante el reconocimiento el worktree principal hizo fast-forward y otro worktree cambió de rama. Hay ventanas vivas manipulando refs compartidas. `fetch` + `merge` al arrancar cada fase y antes de cada commit, no una sola vez al inicio.

11. **Mover `ZoneLayout` de `lib/studio/naviera/zones.ts` a `lib/shared` toca 4 consumidores, dos en la PWA en producción** (`app/m/cn/estibar/actions.ts:18`, `EstibaClient.tsx:21`). Hacerlo como re-export puro, sin borrar símbolos. Si hay fricción, diferirlo: no es requisito funcional de la Fase 3.

---

## 7. Preguntas para el founder

1. **Fase 4 y el Slice C1/E1 de gobernanza.** `docs/governance/reviews/adoption-plan-sge-btn-vis-avs-2026-07-29.md` (REV-SGE-009) ya tiene reservado el Slice C1 "Operación logística: estibar/desestibar" (línea 71) y el E1 "Móvil: una mutación crítica, una ruta `app/m/`" (línea 74). La Fase 4 aterriza exactamente ahí. ¿0184 **absorbe** esos dos slices y se anota en el spec, o la Fase 4 espera a que Codex los cierre? Si dos SDD tocan `/m/cn/estibar` a la vez, el choque es de verdad. **Esta es la única pregunta que puede detener la corrida.**

2. **Alcance de la Fase 2.** ¿Es solo la migración + unificación de constantes (recomendado, ⭐), o incluye pantalla de administración del catálogo? No existe dónde ponerla hoy: `app/studio/(app)/ajustes/page.tsx` es un placeholder de 46 líneas y la sección `masterdata` de `admin/page.tsx:141-149` no tiene `href` (SDD-0125 sin construir). Con panel, la Fase 2 pasa de "una migración" a "un módulo de admin" y entra en territorio de gobernanza.

3. **Nombre de la ruta pública de la Fase 5.** `/calculadora` ya está tomado (301 a `/tarifas`, `next.config.ts:336`), y sería la **cuarta** calculadora de la web (`/tarifas`, `/fcl`, `/calculadora-terrestre`). ¿`/llenado`? ¿`/contenedor`? ¿Y va embebible en el FAB del portal? Si va, hay que registrar su `/embed` en `next.config.ts:273-288` o el iframe sale en blanco por el catch-all `DENY`.

4. **`zone_layout` del 40HC.** El default de la migración 0241 es `{nx:3, ny:2, nz:3}` (18 áreas), pero SDD-0155 dejó el modelo por lotes semánticamente en `ny=1`. ¿La Fase 2 lo normaliza a `{nx:3, ny:1, nz:3}`? El §4.4 del spec dice que la altura no se muestra, así que planificar sobre niveles que no existen es ruido.