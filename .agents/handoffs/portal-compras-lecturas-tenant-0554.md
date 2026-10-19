# Portal — lecturas de compras por tenant del principal (SDD-0554)

Task ID: `portal-compras-lecturas-tenant-0554`.

- **Fecha:** 2026-10-18 (inicio) y 2026-10-19 (cierre, retomado por el Director a las 00:41Z).
- **Owner / sesión escritora:** `claude-worker-af365a63818c06031`, Worker lanzado por el Director como subagente de Claude Code. Sin otras sesiones escritoras ni subagentes en este árbol.
- **Worktree:** `C:/Users/AKX generator/Desktop/Developer/DTDCARGO/.claude/worktrees/agent-af365a63818c06031`.
- **Rama:** `worktree-agent-af365a63818c06031`. Base `origin/main` = `77035907`. Al retomar, `git merge origin/main` dio «Already up to date»: la #276 ya era la base.
- **SDD:** `docs/specs/0554-portal-compras-lecturas-tenant/spec.md`. Reserva con `--expect 0554 --push`:
  - publicada en `refs/heads/codex/sdd-reserve-0554`;
  - la local deja además `refs/heads/codex/sdd-reserve-0554-portal-compras-lecturas-tenant` (stub `c0b53fb4`).

  `sdd:check` pasó después de reservar. Sin migración.
- **Estado de tarea:** lista-para-revision. La SDD queda `in-progress` hasta que el Director decida con el resultado de `verify`.
- **Autorización:** encargo del Director del 2026-10-18. Pedido de Sam al Director, literal: «arranca la de las lecturas de compras». Son palabras de Sam al Director, no a esta sesión; las registro a su nombre.
  - Autorizados: commits en esta rama, push de esta rama y de la reserva, y una PR en borrador.
  - Fuera: merge, producción, servidor, base de prueba y datos.
- **Interrupción:** la sesión se cortó después de los mutantes, mientras escribía la spec. Al retomar, `git status` mostró el árbol limpio salvo este documento: ningún mutante quedó aplicado. El script restaura cada archivo en un `finally`, y su salida registró el control final en verde.

## OBJETIVO ORIGINAL

Cerrar el FUERA DE ALCANCE 4 de la SDD-0552. El Portal llama lecturas de compras del Studio sólo con
el Shipping Mark: `listPrealertas`, `listSuppliers`, `listPrealertaDocuments`,
`listPrealertaServiceRequests` y vecinas. Deben filtrar además por el `tenant_id` del principal, sin
cambiar el comportamiento del Studio.

## COMPLETADO

1. **Inventario por valor** (`app/portal`, `lib/portal`, sobre `77035907`). La tabla completa está en la spec:
   - **sin tenant:** `listPrealertas` (4 pantallas), `listSuppliers` (6) y `listPrealertaDocuments` (2);
   - **ya cumplía:** `listPrealertaServiceRequests`, por la SDD-0381. Resuelve el vínculo y filtra por su tenant. La 0552 la había listado por error, así que no cambia;
   - **no aplica:** `listPredeclaredBoxes` y `listPackingListSubmissions` van por el id de una compra ya resuelta con el tenant; `listActivePrealertaAddons` ya recibe el `tenantId`.
2. **Decisión sobre la firma** (justificada en la spec):
   - `listPrealertaDocuments` exige `markbox` y `tenantId`. Sólo la llama el Portal, igual que `getPrealertaByCode`;
   - `listPrealertas` y `listSuppliers` usan el tipo discriminado `StudioPurchaseScope | PortalPurchaseScope`. El modo Portal exige los dos juntos; el Studio, sin opciones, no cambia;
   - en ejecución, un ámbito Portal incompleto devuelve `[]` sin consultar.
3. **Lecturas cambiadas** (punta de la rama):
   - `lib/studio/prealertas/queries.ts`: `:113` y `:124` (ámbito), `:141` (`listSuppliers`), `:179` (`listPrealertas`) y `:447` (`listPrealertaDocuments`);
   - `compras/page.tsx:37-38`, que pasa además a `getPortalClientPrincipal`;
   - `compras/nueva/page.tsx:39-40` y `proveedores/page.tsx:35-36`;
   - `envios/page.tsx:54-55` y `:86`. Los ids que llegan al admin en `prealertasConPackingList` quedan acotados al tenant;
   - `compras/[code]/page.tsx:93` y `compras/[code]/etiquetas/page.tsx:67` y `:104`.
4. **Llamadores Studio revisados uno por uno**, todos sin opciones y sin cambio:
   - `app/studio/(app)/etiquetas/page.tsx:93`;
   - `ordenes-compra/page.tsx:36-37` y `ordenes-venta/page.tsx:36`;
   - `proveedores/page.tsx:56-57`.

   `tesoreria` y `financiero-china` usan otro `listSuppliers`, el de `lib/studio/treasury/supplier-queries.ts`.
5. **Columnas:** `suppliers_cn`, `prealertas` (0105), `prealerta_documents` (0118), `packing_list_submissions` (0147) y `prealerta_service_requests` (0150) tienen `tenant_id uuid not null` desde su origen, y ninguna migración la elimina.
6. **Pruebas:** 5 archivos nuevos (47 pruebas). Al doble de la 0549 le agregué `range`. No relajé ninguna aserción.

## VALIDACIÓN

| Comprobación | Alcance / SHA | Resultado |
|---|---|---|
| `sdd:check` después de reservar | `54d56769` | PASÓ |
| `tsc --noEmit` con la firma nueva, antes de corregir llamadores | árbol de trabajo | FALLÓ como se esperaba: 12 llamadas en 6 archivos, todas del Portal, ninguna del Studio |
| Las 5 pruebas nuevas | `fcd83dc4` | PASÓ: 47 de 47 |
| Control rojo: pruebas nuevas con los 7 archivos de producto de `77035907` | pruebas `fcd83dc4` | FALLÓ como se esperaba: 40 de 47 rojas, todas por aserción. Las 7 verdes son 5 «sin principal» y 2 «el Studio conserva su consulta» |
| Mutantes (`mutantes-0554.mjs`, scratchpad de la sesión) | `fcd83dc4` | PASÓ: 23 de 23 mueren; control 47/47 antes y después |
| Focalizadas `vitest run lib/portal app/portal lib/studio/prealertas` + 4 carpetas Studio | `fcd83dc4` | PASÓ: 122 archivos, 1530 pruebas |
| Studio y vecinos (`etiquetas`, `ordenes-compra`, `ordenes-venta`, `proveedores`, `lib/studio/document-import`, `app/p/[token]/packlist`) | `fcd83dc4` (antes del corte) | PASÓ: 489 pruebas y 1 omitida (`corpus.test.ts`, corpus real ausente, ajena) |
| `corepack pnpm typecheck` | `fcd83dc4` | PASÓ |
| `eslint lib/studio/prealertas lib/portal app/portal` | `fcd83dc4` | PASÓ: 0 errores. Hay 6 warnings heredados en `compras/nueva/NewPurchaseWizard.test.tsx` y `PurchaseStepDetalle.test.tsx`, que no toqué |
| `docs:index` + `docs:check` / `sdd:check` | `104bb416` | PASÓ (541 specs) / PASÓ |
| `governance:check` / `components:check` | `104bb416` | PASÓ / PASÓ |
| `git diff --check` | cada commit | PASÓ |
| `pnpm verify` | `104bb416` | PASÓ en lo medido: exit 0, 14 de 17 pasos. Los 3 críticos restantes quedaron NO DISPONIBLE. CIERRE INCOMPLETO según el propio verify. Detalle abajo |
| `knowledge:status` | `104bb416` | `ok: false`: estado del worktree, no de esta PR. Ver «Impacto documental» |
| E2E autenticado, smoke en producción, ledger de producción | — | NO DISPONIBLE: sin credenciales ni autorización. No corresponde antes de aprobar la PR |

### `pnpm verify` (una sola corrida)

- **SHA:** `104bb4166e6fefdca7d51b865d4f979d8c7b5020`.
- **Corrida:** `timeout 3600 node scripts/verify.mjs`, de 00:54:37Z a 01:24:30Z del 2026-10-19 (30 min, 20:54 a 21:24 hora de Caracas del 18). Exit 0.
- **Turno:**
  - a las 00:53Z vi un node ajeno (PID 22932) que llegó a 2,6 GB y 44 s de CPU, y no arranqué;
  - lo vigilé hasta que terminó, a las 00:54:01Z;
  - después los node vivos llevaban 4 s de CPU como máximo, sin navegadores sin cabeza.

  No pude ver las líneas de comando: `wmic` no existe en la máquina y la guarda de aislamiento no deja usar PowerShell. Medí CPU y memoria.
- **Resumen del propio verify:** «14 de 17 pasos corrieron de verdad · CIERRE INCOMPLETO — CRÍTICOS SIN MEDIR: migrations-applied, sql-tests, schema-rebuild. No hubo fallos en lo medido (14/17); exit 0 NO equivale a cierre verde completo.»

| Paso | Resultado |
|---|---|
| harness / lint / rsc-boundary / typecheck | PASÓ / PASÓ / PASÓ / PASÓ |
| edge-functions | PASÓ: 4 funciones compilan |
| test | PASÓ en el reintento. La primera corrida dio 1 fallo en 809 archivos y 11.325 pruebas. El reintento del propio verify («flaky conocido») dio 11.324 pasadas y 1 omitida |
| docs:check / numbering / feature-constants / components:check / governance:check | PASÓ / PASÓ / PASÓ (6 banderas) / PASÓ / PASÓ |
| migrations-applied | NO DISPONIBLE: SKIP «sin NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY». Esta SDD no trae migración, y no copié credenciales |
| pending-migration-symbols | PASÓ: 0 ROJO · 0 AMARILLO |
| sql-tests | NO DISPONIBLE: SKIP «Docker no disponible». Docker Desktop estaba apagado y no lo encendí en la máquina compartida. Esta SDD no toca SQL, RLS ni RPC |
| schema-rebuild | NO DISPONIBLE: SKIP «Docker no disponible». Sin migración nueva |
| e2e | PASÓ con aviso: 177 pasaron, 20 omitidas y 1 flaky. El aviso del propio verify: «el proceso salió ≠0 — es el worker de WebKit que no cierra en Windows, no una regresión» |
| build | PASÓ: `tsconfig.json` restaurado; el árbol quedó limpio |

**Lo que falló una vez y pasó en el reintento** (ajeno a esta PR):

- **`test`:** `app/studio/(app)/admin/_components/calculator/__tests__/TransportistasPanel.test.tsx` › «cambio en lote › si falla, el panel queda abierto con el error y la selección se conserva». Es el mismo flaky que anotó la 0552 (FUERA DE ALCANCE 7). Es del Studio y no importa nada de esta PR.
- **`e2e`:** `e2e/auth.spec.ts:81` [chromium] › «Tier 1 · logins (render + negativos) › Acceso: un token inválido renderiza el mismo error las dos veces». Son los logins, ajenos a esta PR.

## COMMITS

- `54d56769` chore(sdd): reserva SDD-0554 (cherry-pick del stub `c0b53fb4`).
- `8367a184` fix(portal): lecturas de compras por tenant del principal.
- `fcd83dc4` test(portal): sesión híbrida en las lecturas de compras.
- `104bb416` docs(sdd): spec e índice.
- Commit que contiene este documento: handoff y resultado de `verify`.

## PR / BRANCH

- Rama `worktree-agent-af365a63818c06031` → base `main`, PR en borrador. La URL queda en el informe al Director.

## PENDIENTES DE ESTA TAREA

- **Cierre de `verify` completo.** Quedaron sin medir `sql-tests` y `schema-rebuild`, porque Docker Desktop estaba apagado, y `migrations-applied`, porque no hay credenciales. Esta SDD no trae SQL ni migración. Decide el Director: aceptar esta evidencia o pedir esos dos pasos con Docker encendido. Por eso la spec sigue en `in-progress`.
- Ninguno de código. La revisión, el merge y el smoke son del Director.

## FUERA DE ALCANCE DETECTADO

1. **`prealertasConPackingList`** (`lib/portal/packing-list-queries.ts:164`) lee con el **admin** por ids y Shipping Mark, sin tenant.
   - Con esta SDD los ids ya salen acotados al tenant, y el id de compra es PK global.
   - Un `.eq("tenant_id")` sería otra valla, porque `packing_list_submissions` tiene la columna (0147). No lo agregué.
2. **Comentarios vencidos:** `lib/portal/packing-list-queries.ts:41` y `lib/portal/purchase-reception-queries.ts:23` describen `getPrealertaByCode(userClient, code, { markbox })`. La firma exige `tenantId` desde la SDD-0552. Es sólo el relato.
3. **`listPrealertaServiceRequests` resuelve su propio vínculo** (`portalServiceRequestTenant`, SDD-0381) en vez de recibir el principal. Es consistencia, no aislamiento: ya filtra por tenant.
4. **RPC `next_supplier_seq` / `next_order_seq` (0105).** Lo anotó la 0552 y sigue abierto: resuelven el tenant con `coalesce(get_portal_client_tenant(), get_user_tenant_id())`. Piden migración y el OK nominal de Sam.
5. **Otras pantallas con `getPortalClient`:** academia, cotizaciones/nueva, facturas (comprobante y estado de cuenta), finanzas, perfil/address-actions y soporte. Devuelven el cliente del principal coherente, sin el tenant. No revisé si sus lecturas filtran por tenant; está fuera de compras.
6. Los 6 warnings de eslint heredados en `compras/nueva/*.test.tsx`.

## Impacto documental y conocimiento

- **Documentos canónicos:** la spec 0554 nueva y el índice `docs/specs/README.md` regenerado. Ningún runbook ni regla cambia.
- **Piloto semántico y Archify:** ninguna fuente tocada aparece en `scripts/knowledge-policy.json` (`semanticPilot` ni `topics`). No hace falta recibo semántico ni `knowledge:visual`.
- **`knowledge:status`** en este worktree (`104bb416`): `ok: false`. Es el mismo estado que registraron la 0549 y la 0552 en sus worktrees:
  - estructura INVALID y semántica INVALID (`graph_missing_or_invalid`, `graph_empty`), porque falta `graphify-out` aquí;
  - Archify PENDING (`ARCHIFY_RUNTIME_MISSING`);
  - Obsidian PENDING.

  Es estado del worktree, no de esta PR. No reconstruí derivados: la estructura se actualiza con la publicación del Director desde `main` integrado.

## HANDOFF AL DIRECTOR

- **Siguiente acción:** revisar la PR en borrador. Fusionar publica en producción en unos 5 minutos. No hay migración que aplicar antes, ni cambio de UI, RLS o RPC.
- **Revisión sugerida:**
  - `portalPurchaseScope` y los tipos `StudioPurchaseScope | PortalPurchaseScope` en `queries.ts`;
  - `listPrealertaDocuments` con el ámbito obligatorio;
  - `compras/page.tsx`, que pasa de `getPortalClient` al principal;
  - la nota de la spec sobre `listPrealertaServiceRequests`, que ya cumplía.
- **Smoke sugerido después de integrar** (no lo corrí). Con un cliente Portal real: Mis compras, Nueva compra, Tus proveedores, Mis envíos (chips de documentos), el detalle de una compra y sus etiquetas (adjuntos). En el Studio: Proveedores, Órdenes de compra, Órdenes de venta y Etiquetas.
- **Sesiones:** sin subagentes. Antes de las corridas pesadas comprobé que no hubiera otra corrida; esperé a que terminara la del PID 22932. El Director avisó de otro Worker (el asistente de borrado) y de la sesión «Contabilidad»; no toqué sus árboles.
- **Ownership:** lo libero con `node scripts/harness-worktree.mjs release --owner claude-worker-af365a63818c06031` después del último push. Worktree, rama y reserva se conservan.
