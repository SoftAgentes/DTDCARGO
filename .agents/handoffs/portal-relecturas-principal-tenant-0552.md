# Portal — relecturas de tenant con el admin, por principal de sesión (SDD-0552)

Task ID: `portal-relecturas-principal-tenant-0552`.

- **Fecha:** 2026-10-18.
- **Owner / sesión escritora:** `claude-worker-ab3d96fdb96d0d74c`, Worker lanzado por el Director como subagente de Claude Code. Sin otras sesiones escritoras ni subagentes en este árbol.
- **Worktree:** `C:/Users/AKX generator/Desktop/Developer/DTDCARGO/.claude/worktrees/agent-ab3d96fdb96d0d74c`.
- **Rama:** `worktree-agent-ab3d96fdb96d0d74c`. Base `origin/main` = `e27c6747aa33f58fa6e916435a7b033586c67a70`, sin cambios hasta el fetch de las 15:52Z.
- **SDD:** `docs/specs/0552-portal-relecturas-principal-tenant/spec.md`. Reserva publicada en `refs/heads/codex/sdd-reserve-0552` (`df6761a8`), hecha con `--expect 0552`. La local deja además `refs/heads/codex/sdd-reserve-0552-portal-relecturas-principal-tenant`. `sdd:check` pasó después de reservar. Sin migración.
- **Estado de tarea:** lista-para-revision. La SDD sigue `in-progress` porque `verify` no salió verde; la causa es ajena (ver VALIDACIÓN).
- **Autorización:** encargo del Director del 2026-10-18. Pedido de Sam al Director, literal: «arranca la de las 13 lecturas del Portal». Son palabras de Sam al Director, no a esta sesión; las registro a su nombre. Autorizados: commits en esta rama, push de esta rama y de la reserva, y una PR en borrador. Sin merge, sin producción, sin servidor, sin base de prueba y sin datos.
- **Interrupción:** el límite de la API cortó la sesión después de la primera vuelta de mutantes. El Director avisó del reinicio a las 15:52Z. Retomé con `git status` y `git log origin/main..HEAD`: árbol limpio salvo este documento, y 5 commits propios.

## OBJETIVO ORIGINAL

Llevar al principal de sesión (`getPortalClientPrincipal`) los hallazgos FUERA DE ALCANCE 1, 2 y 3 del handoff de la SDD-0549, sin cambiar lo que ve un cliente Portal normal:

1. las ~13 lecturas que releen `clients.tenant_id` con el admin;
2. `portalMarkbox` en `lib/portal/portal-queries.ts`;
3. `getPrealertaByCode`, que no filtra por tenant cuando lo llama el Portal.

Quedan fuera las RPC `next_*_seq` (0105) y la restricción de base del catálogo de la Academia, porque piden migración.

## COMPLETADO

1. **Las 13 relecturas** (líneas en `e27c6747`; la tabla completa está en la spec):
   - `page.tsx:105` (zarpe) y `:193` (órdenes por aceptar): ahora usan `principal.tenantId` y `loadPendingAcceptanceForClient(principal)`, el loader de la 0549;
   - `envios/page.tsx:188`, `envios/[code]/page.tsx:144` y `layout.tsx:123`: tenant del principal;
   - `cotizaciones/actions.ts:69`, `reclamos/actions.ts:76` y `referidos/actions.ts:47`: tenant del principal. Además, el reclamo busca el embarque con el tenant del principal y toma `created_by` de `principal.userId`;
   - `perfil/actions.ts:80,139,257`, `perfil/avatar-actions.ts:62` y `perfil/billing-actions.ts:81`: la identidad sale del principal, y no de la RPC `get_portal_client_id`. El admin sólo lee lo que el principal no trae: el puntero de la foto, el avatar y el asesor. La reconciliación de la foto (SDD-0481) resuelve otra vez el principal y exige el mismo cliente, tenant y Shipping Mark.
2. **`portalMarkbox` → `portalScope`:** `listMyShipments`, `getMyShipment`, `listMyDocuments`, `getPortalActivation` y `getNextArrival` filtran por tenant y Shipping Mark del principal. La activación lee la aprobación con `client.id` del principal.
3. **`getPrealertaByCode` con `tenantId` obligatorio.** La decisión está justificada en la spec. Lo pasan los 6 llamadores. El detalle de la compra y «Completar detalle», que no comparaban el tenant después, pasan a `getPortalClientPrincipal`.
4. **Columnas comprobadas en `supabase/migrations/`:** `shipments` (0002), `clients` (0006), `shipment_documents` (0086), `sailings` (0096) y `prealertas` (0105) tienen `tenant_id not null` desde su origen. No hubo que omitir ningún filtro.
5. **Pruebas:**
   - 7 archivos nuevos y 8 adaptados. Al doble de la 0549 le agregué `gte`.
   - **Control rojo:** con los 17 archivos de producto de `e27c6747`, caen 29 de 43 pruebas nuevas. Las 14 que pasan cubren lo que no debía cambiar.
   - **Mutantes:** 16 de 16 mueren, con control de 89 de 89 antes y después. En la primera vuelta sobrevivió «próximo arribo sin Shipping Mark» porque la fixture era feliz. Lo corregí en `fe9095ec`.

## VALIDACIÓN

| Comprobación | Alcance / SHA | Resultado |
|---|---|---|
| `sdd:check` después de reservar | `e28bea4c` | PASÓ |
| `corepack pnpm typecheck` | producto `4cd9ce29`; con pruebas `acb7cbfc` | PASÓ / PASÓ (la primera corrida con pruebas FALLÓ por dos `any` implícitos en una prueba nueva; los corregí antes del commit) |
| `eslint lib/portal app/portal lib/studio/prealertas/queries.ts` | `acb7cbfc` | PASÓ: 0 errores, 6 warnings heredados en `compras/nueva/*.test.tsx`, archivos que no toqué |
| Suite existente con el producto nuevo, antes de adaptar | `4cd9ce29` | FALLÓ como se esperaba: 60 pruebas en 8 archivos, todas por la fuente de identidad o por la firma nueva |
| Las 8 adaptadas | `0e311a36` | PASÓ: 91 de 91 |
| Control rojo: pruebas nuevas contra el producto de `e27c6747` | pruebas `fe9095ec` | FALLÓ como se esperaba: 29 de 43 rojas |
| Mutantes (`mutantes-0552.cjs` en el scratchpad de la sesión) | `acb7cbfc` + prueba de `fe9095ec` | PASÓ: 16 de 16 mueren; control 89/89 antes y después |
| Focalizadas `vitest run lib/portal app/portal --pool=threads --maxWorkers=2` | `fe9095ec` | PASÓ: 107 archivos, 1295 pruebas |
| `docs:index` + `docs:check` / `sdd:check` | `d5d7e9a1` | PASÓ (539 specs) / PASÓ |
| `governance:check` / `components:check` | `d5d7e9a1` | PASÓ / PASÓ |
| `git diff --check` | cada commit | PASÓ |
| `pnpm verify` | `d5d7e9a1` | FALLÓ: exit 1, con 16 de 17 pasos medidos. El único rojo es `test`, por una prueba ajena que vence bajo carga y pasa aislada. `migrations-applied` quedó NO DISPONIBLE. Detalle abajo |
| Los 2 archivos rojos de `test`, aislados y sin carga | `d5d7e9a1` | PASÓ: 27 de 27 en 16,6 s; la prueba que venció tarda 1,41 s |
| `knowledge:status` | `d5d7e9a1` | `ok: false`: estado del worktree, no de esta PR. Ver «Impacto documental» |
| E2E autenticado, smoke en producción, ledger de producción | — | NO DISPONIBLE: sin credenciales ni autorización, y no corresponde antes de aprobar la PR |

### `pnpm verify` (una sola corrida)

- **SHA:** `d5d7e9a1fed6c65b2a4514c77934b09db8813848`.
- **Corrida:** `timeout 3600 node scripts/verify.mjs`, de 16:02:43Z a 16:35:39Z (33 min, 12:02 a 12:35 hora de Caracas). Exit 1.
- **Turno:** antes de arrancar comprobé que no hubiera otra corrida. Los node vivos pesaban menos de 135 MB, Docker no tenía contenedores y no había navegadores sin cabeza. Durante la corrida sólo vi procesos grandes en la fase e2e, que eran los del propio `verify`.
- **Resumen del propio verify:** «16 de 17 pasos corrieron de verdad · 1 fallo(s) → test · CRÍTICOS SIN MEDIR: migrations-applied».

| Paso | Resultado |
|---|---|
| harness | PASÓ: 24 archivos, 215 pruebas |
| lint | PASÓ |
| rsc-boundary | PASÓ: 1683 módulos, sin cruces |
| typecheck | PASÓ |
| edge-functions | PASÓ: 4 funciones compilan |
| test | **FALLÓ** (detalle abajo) |
| docs:check | PASÓ: 539 specs |
| numbering / feature-constants / components:check / governance:check | PASÓ / PASÓ (6 banderas) / PASÓ / PASÓ |
| migrations-applied | NO DISPONIBLE: SKIP «sin NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY». Esta SDD no trae migración, y no copié credenciales |
| pending-migration-symbols | PASÓ: 0 ROJO · 0 AMARILLO |
| sql-tests | PASÓ: 242 contratos, postgres:17 efímero |
| schema-rebuild | PASÓ: 485 migraciones, 467 desde cero y 18 sólo de ledger; barrido multi-tenant de 219 tablas |
| e2e | PASÓ: 177 pasaron y 20 omitidas. 1 flaky: `e2e/calculadora-semantic-colors.spec.ts:53` [mobile-chrome], «Selector combinado: teclado, Escape, clic y cursor en light». Recibió «Valencia (sede)mara» en vez de «mara» y pasó en el reintento. Es la calculadora pública, ajena a esta PR |
| build | PASÓ: `tsconfig.json` restaurado; el árbol quedó limpio |

**El paso `test`, en detalle:**

- **Primera corrida:** 2 fallos en 803 archivos y 11.269 pruebas.
  - `app/p/[token]/standard-format.test.tsx` › «starts guided and exposes Product then Code before Brand in the canonical standard table»: venció el tope global de 20 s a los 22,5 s.
  - `app/studio/(app)/admin/_components/calculator/__tests__/TransportistasPanel.test.tsx` › «si falla, el panel queda abierto con el error y la selección se conserva»: el foco quedó en el diálogo y no en la alerta.
- **Reintento del propio verify** («flaky conocido»): `TransportistasPanel` pasó. `standard-format` volvió a vencer, a los 23,6 s.
- **Aislados y sin carga, sobre el mismo SHA:** los dos archivos pasan, 27 de 27. La prueba que venció tarda 1,41 s: un factor de 16 bajo la carga de `verify`.
- **Relación con esta PR:** ninguna. `standard-format.test.tsx` renderiza `ProviderShareClient` (la página pública del proveedor) con helpers de packing list, y no importa ningún archivo de esta PR. `TransportistasPanel` es del Studio.
- Es el patrón que describe la SDD-0550 (in-progress): pruebas que pasan aisladas y vencen dentro de `verify`. Lo anoto como FUERA DE ALCANCE 6. No subí el tope ni toqué la prueba: es ajena y debilitarla no corresponde.

Los commits posteriores a `d5d7e9a1` sólo cambian la spec (la casilla de `verify`) y este documento. Sobre el head final repetí `docs:check` y `sdd:check`.

## COMMITS

- `e28bea4c` chore(sdd): reserva SDD-0552 (cherry-pick del stub `df6761a8`).
- `b321e1ad` fix(portal): envíos y compras por tenant del principal (puntos 2 y 3).
- `4cd9ce29` fix(portal): el admin ya no relee `clients.tenant_id` (punto 1).
- `0e311a36` test(portal): las pruebas existentes toman el principal de sesión.
- `acb7cbfc` test(portal): sesión híbrida y tenant legado en las lecturas.
- `fe9095ec` test(portal): próximo arribo con otro cliente del tenant primero (mata al mutante M10).
- `d5d7e9a1` docs(sdd): spec e índice.
- Commit que contiene este documento: handoff y resultado de `verify`.

## PR / BRANCH

- Rama `worktree-agent-ab3d96fdb96d0d74c` → base `main`. Se publica con un único push, con este documento adentro, y la PR se abre en borrador. La URL queda en la PR y en el informe al Director.

## PENDIENTES DE ESTA TAREA

- **`pnpm verify` en verde.** La corrida única salió en rojo sólo por `test`, por una prueba ajena que vence bajo carga y pasa aislada. Decide el Director: aceptar esa evidencia o pedir otra corrida cuando la máquina esté quieta. Por eso la spec sigue en `in-progress`.
- Ninguno de código. La revisión, el merge y el smoke son del Director.

## FUERA DE ALCANCE DETECTADO

1. **RPC `next_supplier_seq` / `next_order_seq` (`0105`).** Resuelven el tenant con `coalesce(get_portal_client_tenant(), get_user_tenant_id())`. Piden migración y el OK nominal de Sam (encargo).
2. **Catálogo de la Academia sin restricción de coherencia en la base.** Una FK compuesta lo cerraría. Pide migración y el OK nominal de Sam (encargo).
3. **`app/portal/(app)/estimados/actions.ts:63-71` y `:96-102`** (`advanceEstimateToCotizacionAction`). Es el más serio de los nuevos.
   - Con el **admin** lee el estimado por `quote_code` + `client_markbox`, sin tenant, y lo actualiza a `source='studio'` por `id` + Shipping Mark. Después avisa al asesor del `q.tenant_id` de la fila.
   - El admin no tiene RLS, así que no hace falta una sesión híbrida: basta un cliente de otro tenant con el mismo Shipping Mark y un código que exista allí. El código es único por tenant y la serie `EST-AAAA-NNNN` se repite entre tenants.
   - Inferencia, no medida: si el código existe en los dos tenants, `maybeSingle` falla y el cliente legítimo ve «No pudimos avanzar tu estimado».
   - No relee `clients.tenant_id`, por eso no entró. El arreglo es el mismo patrón: el principal, más `.eq("tenant_id", principal.tenantId)` en la lectura y en el UPDATE.
4. **Lecturas Studio que el Portal llama sólo con Shipping Mark:** `listPrealertas`, `listSuppliers`, `listPrealertaDocuments` y `listPrealertaServiceRequests` (`lib/studio/prealertas/queries.ts`), desde `envios/page.tsx`, `compras/[code]/page.tsx` y `etiquetas/page.tsx`.
   - Usan la sesión, así que el cruce sólo lo ve una sesión híbrida, igual que el hallazgo 2.
   - `envios/page.tsx` pasa además esos ids a `prealertasConPackingList` con el **admin**. Sólo devuelve presencia de packing list, sin contenido.
   - Mismo arreglo que `getPrealertaByCode`.
5. **`get_portal_client_id` (forma 0080, sin coherencia vínculo/cliente) sigue en `getProfileCompleteness` y `cancelDataChangeRequestAction`.** No releen tenant ni Shipping Mark, y el id es PK global; pasarlos al principal sería consistencia, no aislamiento.
6. **`app/p/[token]/standard-format.test.tsx` vence bajo la carga de `verify`.** Tarda 22,5 s y 23,6 s con un tope de 20 s, y 1,41 s aislada. Es un caso nuevo del patrón de la SDD-0550, que no está en su tabla. Fue el único rojo del `verify` de esta PR.
7. **Flakies vistos en esta corrida, ajenos:**
   - `TransportistasPanel.test.tsx` › foco tras el error del cambio en lote (Studio): falló una vez y pasó en el reintento;
   - `e2e/calculadora-semantic-colors.spec.ts:53` [mobile-chrome]: escritura sobre un valor previo del combobox, pasó en el reintento.

## Impacto documental y conocimiento

- **Documentos canónicos:** la spec 0552 nueva y el índice `docs/specs/README.md` regenerado. Ningún runbook ni regla cambia.
- **Piloto semántico y Archify:** ninguna fuente tocada aparece en `scripts/knowledge-policy.json` (`semanticPilot` ni `topics`). No hace falta recibo semántico ni `knowledge:visual`.
- **`knowledge:status`** en este worktree (`d5d7e9a1`): `ok: false`. Es el mismo estado que registró la 0549 en su worktree nuevo:
  - estructura INVALID y semántica INVALID, porque falta `graphify-out` aquí;
  - Archify PENDING (`ARCHIFY_RUNTIME_MISSING`);
  - Obsidian PENDING.

  Es estado del worktree, no de esta PR. No reconstruí derivados: la estructura se actualiza con la publicación del Director desde `main` integrado.

## HANDOFF AL DIRECTOR

- **Siguiente acción:** revisar la PR en borrador. Fusionar publica en producción en unos 5 minutos. No hay migración que aplicar antes, ni cambio de UI, RLS o RPC.
- **Revisión sugerida:**
  - `portalScope` en `portal-queries.ts`;
  - la firma nueva de `getPrealertaByCode`;
  - la reconciliación de la foto en `perfil/actions.ts` (SDD-0481), con su prueba `IdentityPhotoAction.test.ts`: los casos de tenant y markbox concurrentes pasaron de «lectura» a «identidad»;
  - el reclamo, que ya no vincula un embarque de otro tenant.
- **Smoke sugerido después de integrar** (no lo corrí). Con un cliente Portal real:
  - portada (zarpe y tarjeta por aceptar), píldora de zarpe, Mis envíos (banner) y un detalle de envío;
  - detalle de una compra y «Completar detalle»;
  - pedir una cotización, reportar un reclamo e invitar un referido;
  - en Perfil: subir la foto de cédula, cambiar el avatar y editar un dato.
- **Sesiones:** sin subagentes. Antes de las corridas pesadas comprobé que no hubiera vitest, verify, Playwright ni contenedores de Docker de otra sesión (la «Contabilidad» que avisó el Director). Los node vivos pesaban menos de 135 MB.
- **Ownership:** lo libero con `node scripts/harness-worktree.mjs release --owner claude-worker-ab3d96fdb96d0d74c` después del último push. Worktree, rama y reserva se conservan.
