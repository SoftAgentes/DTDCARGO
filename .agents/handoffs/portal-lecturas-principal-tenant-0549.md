# Portal — lecturas restantes por principal y tenant (SDD-0549)

Task ID: `portal-lecturas-principal-tenant-0549`.

- **Fecha:** 2026-10-17.
- **Owner / sesión escritora:** `claude-worker-a0019fba180f8661a`, Worker lanzado por el Director como subagente de Claude Code. Sin otras sesiones escritoras ni subagentes en este árbol.
- **Worktree:** `C:/Users/AKX generator/Desktop/Developer/DTDCARGO/.claude/worktrees/agent-a0019fba180f8661a`.
- **Rama:** `worktree-agent-a0019fba180f8661a`. Base de arranque `origin/main` = `cdb7ff762deedd1db62a42235cbd1331f4a2d0a6`; después mezclé `origin/main` = `811659b2636e92157026aaecd4a981ac9844c4e0` (PR #267, sólo docs del Director, sin solapamiento).
- **SDD:** `docs/specs/0549-portal-lecturas-principal-tenant/spec.md`, `status: done`. Todos sus criterios se cumplieron; PR, merge y release van aparte. Reserva publicada en `refs/heads/codex/sdd-reserve-0549` (`1160932b`); la local también deja `refs/dtd/reservations/0549`. La 0548 la ganó otra sesión entre mi inventario y mi reserva (`fatal: cannot lock ref 'refs/dtd/reservations/0548': reference already exists`); volví a inventariar y reservé con `--expect 0549`. `sdd:check` pasó después. Sin migración.
- **Estado de tarea:** lista-para-revision.
- **Autorización:** encargo del Director del 2026-10-17. Cita a Sam, literal, al Director: «Haz una tarea continua sin detenerte… trata de hacer todos los trabajos pendientes». Son palabras de Sam al Director, no a esta sesión; las registro a su nombre. Autorizados: commits en esta rama, push de esta rama y de la reserva, PR en borrador. Sin merge, sin producción, sin servidor, sin datos.

## OBJETIVO ORIGINAL

Unificar con `getPortalClientPrincipal(session)` los hallazgos FUERA DE ALCANCE 1, 2 y 4 que dejó la PR #114 (SDD-0390/0397), sin cambiar lo que ve un cliente Portal coherente, con pruebas cuyos dobles apliquen los filtros y que fallen con el código anterior. El punto 4 del encargo (medida sellada con varios embarques) no se cambia: queda como pregunta para Sam en la spec.

## COMPLETADO

1. **`lib/portal/pending-acceptance.ts`** ya no relee `clients.tenant_id` con el admin client. `loadPendingAcceptanceForClient(principal, admin?)` y `loadPendingAcceptanceDetailForClient(principal, code, admin?)` reciben el principal; sin tenant o Shipping Mark fallan cerrado. Sus dos llamadores (`facturas/page.tsx`, `facturas/[code]/page.tsx`) resuelven el principal una vez.
2. **`facturas/[code]/aceptar/page.tsx`** usa `getPortalClientPrincipal`. Con el tenant del principal lee la orden, los documentos vigentes y la aceptación previa; sin principal redirige a `/entrar` antes de crear el admin client.
3. **Filtro por `tenant_id` del principal** en:
   - `portal-academy-queries.ts`: inscripciones, diplomas, progreso y catálogo;
   - `academia/actions.ts`: inscripción, upsert y delete del progreso, con el tenant del upsert tomado del principal;
   - `portal-claims.ts`: `listMyClaims`;
   - `proveedores/actions.ts`: duplicado, edición, borrado, conteo, alta y detalle. Las compras leídas por código se comprueban contra el tenant, y el catálogo de servicios recibe `{ tenantId }` como en las páginas (SDD-0402).

   Comprobé las columnas en `supabase/migrations/`: todas las tablas tienen `tenant_id not null` desde su migración de origen (tabla de la spec). No hubo que omitir ningún filtro.
4. **Pruebas.** Agregué el doble `lib/portal/__tests__/portal-tenant-double.ts`, que aplica `eq/neq/is/in` en lecturas, UPDATE y DELETE, devuelve copias y no acepta filtros antes de `select()`. Hay 5 archivos de prueba nuevos y 3 adaptados.
   - Una prueba existente, `proveedores/__tests__/update-prealerta-detalle.test.ts` (SDD-0173), atendía las RPC legadas. La adapté: el principal llega por mock, la compra trae `tenant_id` y gana una aserción y un caso nuevo. No relajé ninguna aserción.
   - **Al revés:** con los 8 archivos de producto de `origin/main` caen 29 de 41 pruebas nuevas o adaptadas. Las 12 que pasan cubren comportamiento que no debía cambiar.
   - **Mutantes:** quité los filtros de tenant de a uno, 24 mutantes. Mueren 23, con control 31/31 verde antes y después. Sobrevive el UPDATE del WeChat del proveedor en `createPrealertaAction`, redundante por construcción: el id es PK global y ya se validó contra el tenant en la misma acción.
5. **Pregunta para Sam** redactada en la spec (opciones A/B/C), con el gate de emisión de Facturación (`evaluateLegalGate`) como dato.

## VALIDACIÓN

| Comprobación | Alcance / SHA | Resultado |
|---|---|---|
| Pruebas nuevas y adaptadas (7 archivos, `--pool=threads`) | `fd937f8e` | PASÓ |
| Mismas pruebas contra el código de `origin/main` (al revés) | código `cdb7ff76` + pruebas `adb75175` | FALLÓ como se esperaba: 29 de 41 rojas |
| Mutantes de tenant (`mutantes.cjs` en el scratchpad de la sesión) | `fd937f8e` | 23 de 24 mueren; control 31/31 antes y después |
| Focalizadas `vitest run lib/portal app/portal --maxWorkers=2` | `fd937f8e` | PASÓ: 100 archivos, 1252 pruebas. La primera corrida en `22300596` FALLÓ en 7 casos de `update-prealerta-detalle.test.ts`, que corregí en `fd937f8e` |
| `corepack pnpm typecheck` | `fd937f8e` | PASÓ |
| `eslint lib/portal app/portal` | `fd937f8e` | PASÓ: 0 errores, 6 warnings heredados en `compras/nueva/*.test.tsx`, archivos que no toqué |
| `docs:index` + `docs:check` | `d40f4afd` | PASÓ (534 specs) |
| `sdd:check` | después de reservar y en `d40f4afd` | PASÓ |
| `governance:check` / `components:check` | `22300596` | PASÓ / PASÓ |
| `git diff --check` | cada commit | PASÓ |
| `pnpm verify` | `d40f4afd` | PASÓ en lo medido (16/17, exit 0); `migrations-applied` NO DISPONIBLE. Detalle abajo |
| `docs:check` + `sdd:check` sobre el head final | commit que contiene este documento | PASÓ / PASÓ |
| E2E autenticado, smoke en producción, ledger de producción | — | NO DISPONIBLE: sin credenciales ni autorización en este worktree, y no corresponde antes de aprobar la PR |

### `pnpm verify` (una sola corrida)

- **SHA:** `d40f4afd7cedfdb8b1bb53304c523505b0e2a1dc`.
- **Corrida:** `timeout 3600 node scripts/verify.mjs`, de 17:46:22 a 18:05:09 hora de Caracas (19 min). Exit 0.
- **Turno:** la arranqué cuando ya no quedaba el `verify` ajeno ni otro vitest, Playwright o `next build` en la máquina.
- **Resumen del propio verify:** «16 de 17 pasos corrieron de verdad». CIERRE INCOMPLETO por `migrations-applied` sin medir, sin fallos en lo medido.

| Paso | Resultado |
|---|---|
| harness | PASÓ: 24 archivos, 214 pruebas |
| lint | PASÓ |
| rsc-boundary | PASÓ: 1687 módulos, sin cruces |
| typecheck | PASÓ |
| edge-functions | PASÓ: 4 funciones compilan |
| test | PASÓ: 795 archivos (1 omitido), 11175 pruebas (1 omitida), sin reintento del paso |
| docs:check | PASÓ: 534 specs |
| numbering / feature-constants / components:check / governance:check | PASÓ / PASÓ (6 banderas) / PASÓ / PASÓ |
| migrations-applied | NO DISPONIBLE: SKIP «sin NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY». Esta SDD no trae migración, y no copié credenciales |
| pending-migration-symbols | PASÓ: 0 ROJO · 0 AMARILLO |
| sql-tests | PASÓ: 242 contratos, postgres:17 efímero |
| schema-rebuild | PASÓ: 485 migraciones, 467 aplicadas desde cero, 18 sólo de ledger; barrido multi-tenant de 219 tablas |
| e2e | PASÓ: 177 pasaron y 20 omitidas. 1 flaky: `e2e/auth.spec.ts:81`, «Acceso: un token inválido renderiza el mismo error las dos veces», falló y pasó en el reintento #1. Ajeno al Portal tocado aquí. Corrió contra el Supabase sintético deny-only (SDD-0479) |
| build | PASÓ: `tsconfig.json` restaurado |

El árbol quedó limpio después de la corrida. Los commits posteriores a `d40f4afd` sólo cambian la spec (casilla y `status: done`), el índice y este handoff. Sobre el head final repetí `docs:check` y `sdd:check`.

## COMMITS

- `05813b33` chore(sdd): reserva SDD-0549 (cherry-pick del stub `1160932b`).
- `434cb4bf` fix(portal): facturas por aceptar con el principal de sesión, más el doble.
- `13843704` fix(portal): Academia, Reclamos y Compras filtran por tenant del principal.
- `adb75175` test(portal): casos que aíslan cada filtro de tenant.
- `22300596` docs(sdd): spec e índice.
- `fd937f8e` test(portal): el detalle de compra (0173) toma el principal de sesión.
- `54231034` merge de `origin/main` `811659b2`.
- `d40f4afd` docs(sdd): allowlist con la prueba de 0173 y mutantes 23 de 24.
- Commit que contiene este documento: `status: done` de la spec, índice y este handoff con el resultado de `verify`.

## PR / BRANCH

- Rama `worktree-agent-a0019fba180f8661a` → base `main`, publicada con un único push, ya con este documento adentro. La PR se abre en borrador después del push. Su URL queda en la PR misma y en el informe al Director; no la escribo aquí para no hacer un segundo push sólo por ella.

## PENDIENTES DE ESTA TAREA

- Ninguno de código. La decisión de la medida sellada es de Sam y no forma parte de la aceptación de esta SDD.

## FUERA DE ALCANCE DETECTADO

1. **Más relecturas de `clients.tenant_id` con admin en el Portal**, mismo patrón y no listadas en el encargo:
   - `app/portal/(app)/page.tsx:105` (próximo zarpe) y `:193` (`loadPendingAcceptance` de la portada);
   - `app/portal/(app)/envios/[code]/page.tsx:144` y `envios/page.tsx:188`;
   - `app/portal/(app)/layout.tsx:123`;
   - `cotizaciones/actions.ts:69`, `reclamos/actions.ts:76` y `referidos/actions.ts:47`;
   - `perfil/actions.ts:80,139,257`, `perfil/avatar-actions.ts:62` y `perfil/billing-actions.ts:81`. En perfil también se leen `markbox` y otros campos.
2. **`lib/portal/portal-queries.ts:48` (`portalMarkbox`)** sigue con la RPC `get_portal_client_markbox`. La usan `listMyShipments`, `getMyShipment` y otras lecturas de ese archivo, que filtran sólo por Shipping Mark. Ya estaba anotado en la ronda 1 de la PR #114.
3. **`getPrealertaByCode` (`lib/studio/prealertas/queries.ts:203`)** filtra sólo por código y Shipping Mark. Si dos tenants tienen la misma compra con el mismo Shipping Mark, `maybeSingle` falla y el cliente legítimo ve «Esa compra no es válida». Los llamadores Portal comprueban el tenant después; no toqué el módulo Studio.
4. **RPC `next_supplier_seq` / `next_order_seq` (`0105`)** resuelven el tenant con `coalesce(get_portal_client_tenant(), get_user_tenant_id())`. Esa es la forma de `0105`, con `limit 1` y sin la coherencia de `0453`. Para un vínculo coherente coincide con el principal.
5. **Catálogo de la Academia sin restricción de coherencia en datos.** Nada impide un módulo o lección de un tenant colgado del curso de otro. Las policies 0418 y ahora la aplicación lo excluyen; una FK compuesta lo cerraría en la base.
6. **Medida sellada con varios embarques** (SDD-0543). Es la pregunta para Sam en la spec; no la convertí en pendiente propio.
7. **El scratchpad lo comparten los subagentes de una misma sesión del Director.** Otro Worker (el de la SDD-0548) escribió su `pr-body.md` en la misma ruta y pisó el mío. No toqué su archivo; rehíce el mío con nombre único. Conviene que el prompt de asignación pida nombres de archivo con el número de SDD (`msg-0549-*.txt`, `verify-0549.log`). Si no, dos Workers pueden publicar o commitear con el texto del otro.

## Impacto documental y conocimiento

- **Documentos canónicos:** la spec 0549 nueva y el índice `docs/specs/README.md` regenerado. Ningún runbook ni regla cambia.
- **Piloto semántico y Archify:** ninguna fuente tocada aparece en `scripts/knowledge-policy.json`. No hace falta recibo semántico ni `knowledge:visual`.
- **`knowledge:status`** en este worktree: `ok: false`.
  - Estructura: INVALID y semántica: INVALID, porque falta `graphify-out` en este worktree nuevo.
  - Archify: PENDING (`ARCHIFY_RUNTIME_MISSING`).
  - Obsidian: PENDING.

  Es estado del worktree, no de esta PR. No reconstruí derivados aquí; la estructura se actualiza con la publicación del Director desde `main` integrado.

## HANDOFF AL DIRECTOR

- **Siguiente acción:** revisar la PR en borrador. Fusionar publica en producción a los ~5 min. No hay migración que aplicar antes, ni cambio de UI, RLS o RPC.
- **Revisión sugerida:**
  - firma nueva de los dos loaders de `pending-acceptance.ts`, que no tienen otros llamadores;
  - comprobación `pre.tenant_id !== tenantId` en dos acciones de compras;
  - `listActivePrealertaAddons(…, { tenantId })` en las acciones.
- **Smoke sugerido después de integrar** (no lo corrí): un cliente Portal real abre Mis facturas, el detalle de un borrador, la aceptación de T&C, Academia (curso y lección), Soporte (reclamos), Proveedores (crear, editar, borrar) y Compras (alta y detalle).
- **Pregunta para Sam:** medida sellada con varios embarques (spec, sección «Pregunta para Sam»).
- **Sesiones:** sin subagentes. Había un `verify` ajeno del worktree `agent-a8727444e64047c32`, que arrancó a las 17:17 hora de Caracas. Mis dos corridas focalizadas de `lib/portal` + `app/portal` (17:20–17:26 y 17:30–17:36, `--pool=threads --maxWorkers=2`) coincidieron con él. Si ese `verify` salió con rojos de tiempo, puede ser por contención. Para mi `verify` esperé a que terminara.
- **Ownership:** lo libero con `node scripts/harness-worktree.mjs release --owner claude-worker-a0019fba180f8661a` después del último push. Worktree y rama se conservan.
