# L11 — Prealertas y solicitudes de servicio del Portal

Fecha: 2026-09-11. Task ID: `c-l11-portal-prealertas-servicios`.
Owner / sesión escritora: `c-l11-worker-20260911-claude` (Worker Claude Code, sesión `454d97be-b1e0-4fc9-97e9-c6bb621ba84c`). Sin subagentes.
Estado de tarea: lista-para-revision en PR borrador. Importación y adopción completas; E2E autenticado y ledger real NO DISPONIBLES.
Repositorio: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO` (checkout principal no tocado).
Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/c-l11-portal-prealertas-servicios`.
Rama: `codex/c-l11-portal-prealertas-servicios`. Base real: `3c6107012f754953323202a7386b3e7811593814` (origin/main al iniciar y al cerrar; sin merges de actualización).
Origen de solo lectura: `ea9952a47f4adf14c48c91e6d0147597beb94aa7`, head de la PR #21. No se modificó.

## OBJETIVO ORIGINAL

Preparar el lote L11 del bloque C como PR draft contra main: migraciones `0417_portal_prealertas_tenant_boundary` (SDD-0361) y `0429_portal_service_requests_principal_tenant` (SDD-0381) con contratos y specs; adopción focal del cambio 0381 sobre la versión vigente de `lib/studio/prealertas/queries.ts` más su test de scope; esperas 0417 → 0429 en el baseline; clasificación migrate-first con evidencia, auditoría de consumidores y revisión focal de datos.

## COMPLETADO

- Seis archivos de origen importados. Las dos migraciones y los dos contratos son idénticos por blob. Las dos specs llevan una nota de importación fechada bajo el título (forma de 0363 en main); frontmatter intacto (`done` en 0361, `in-progress` en 0381) e igualdad byte a byte con el origen al retirar sólo la nota.
- `queries.ts`: un único hunk frente a main (+39/−2), limitado a la región de solicitudes de servicio. Esa región es byte a byte la del origen (3807 B); el resto del archivo queda como en main.
- `lib/studio/prealertas/__tests__/service-request-scope.test.ts` importado sin adaptación.
- Baseline: sólo dos esperas nuevas, en orden numérico, con «bloque C L11 / SDD-0361» y «bloque C L11 / SDD-0381», orden 0417 → 0429, «Sin MIGRATE-FIRST», OK nominal de Sam, runbook y name exacto. `cutoff: 238`, `$doc` y las esperas 0409/0418/0419/0430 intactos: sin las dos líneas nuevas el archivo es idéntico por bytes a la base.
- Índice regenerado con `corepack pnpm docs:index`: 417 specs; 0361 y 0381 salen de la lista de huecos.
- `supabase/pending-migration-symbol-declarations.json` sin cambios: el gate da 0 ROJO / 0 AMARILLO porque 0417 y 0429 sólo usan `ALTER POLICY` y bloques `DO`; el extractor del gate devuelve 0 símbolos para ambas. El defecto UTF-16 conocido del checker no aplica: 0 caracteres fuera del BMP en `queries.ts` y en el test.

### Identidad por blob

| Archivo | Origen `ea9952a4` | Rama | Bytes |
|---|---|---|---|
| `supabase/migrations/0417_portal_prealertas_tenant_boundary.sql` | `2ca99fcb677f1cca803aa182c61ff7f1ebd4bff6` | idéntico | 7767 |
| `supabase/tests/0417_portal_prealertas_tenant_boundary.test.sql` | `38c9b75981e0038c6731e957c31bcfb283ec4960` | idéntico | 29691 |
| `supabase/migrations/0429_portal_service_requests_principal_tenant.sql` | `79c70e644853ffdec54da7c70476f5a88d599e36` | idéntico | 3941 |
| `supabase/tests/0429_portal_service_requests_principal_tenant.test.sql` | `f18c0688244fa386b0b9caf23b5df2aefab29605` | idéntico | 30982 |
| `docs/specs/0361-portal-prealertas-tenant-boundary/spec.md` | `f28e783dc99bebb7ef9ddf3740a3500002183fa7` (5954 B) | `0d2ba1cd96fbbae09a8138eb7441359024d982fa` con nota | 6659 |
| `docs/specs/0381-portal-service-requests-principal-tenant/spec.md` | `fc646db01cce62c8aa3d418821f02ca799d22702` (3702 B) | `d23ef08a0d3ddef07798c72035e8e73f79069f1e` con nota | 4533 |
| `lib/studio/prealertas/__tests__/service-request-scope.test.ts` | `c9cf1d2ece82a7c9faa6efc23ad5e25bb263cd1a` | idéntico | 7638 |
| `lib/studio/prealertas/queries.ts` | main `9fc37d02907a9040324d8ed12cfcc5ab59796c8a` (24584 B); #21 `ac66eed8b011beeabc43501a1ce737c070698dc3` (28544 B) | `e7bbdbbbdabfdd01a95509516ed2da05a6e81258` | 26340 |

OID obtenidos con `git ls-tree -l ea9952a4 -- <ruta>` y comparados con `git hash-object --no-filters` del árbol y `git ls-files -s` del índice antes de cada commit.

### Diff focal de `queries.ts` frente a main

| Zona (líneas en la rama) | Cambio | Justificación (spec 0381) |
|---|---|---|
| JSDoc 536-542 | Texto del origen | Documenta que la propiedad `markbox` activa el modo Portal y que sin ella se conserva Studio (L42-47). Queda sobre el helper, como en el origen, para mantener la región idéntica. |
| `portalServiceRequestTenant` 543-546 | Nuevo, privado | Sin export ni cambios a helpers globales (L48-49). |
| 547-548 | `auth.getUser()` | Identidad desde la sesión; falla cerrado (L42). |
| 549-554 | `client_users` activo con `clients!inner(id, tenant_id, markbox, deleted_at)` | Proyección mínima; `unique (auth_user_id)` (0080:30) hace válido `maybeSingle`. |
| 555-562 | Relación embebida única | Rechaza relación ausente o múltiple (test «relación múltiple»). |
| 563-567 | Coherencia y retorno | Tenant/cliente no vacíos, cliente del vínculo, mismo tenant, vivo y con el Shipping Mark pedido (L42-45). |
| `listPrealertaServiceRequests` 572 | `tenantId?` | Tenant explícito (L44). |
| 575-581 | Modo Portal si la propiedad `markbox` existe, aunque sea `undefined` | Vacío o no string → `[]`; principal inválido → `[]`; tenant explícito distinto → `[]` (L45). |
| 588 | `.eq("tenant_id", portalTenant)` | La policy de equipo de una sesión híbrida no ensancha el resultado Portal (L44). |
| 582-587 y 589-597 | Sin cambio | Filtro por compra, límite 500, orden, mapeo y fallback vacío (L46-47). |

Intactas byte a byte respecto de main: `listSuppliers`, `listPrealertas`, `cbmByPrealerta`, `getPrealertaByCode`, `listPredeclaredBoxes` (243; consumidor Portal de `warehouse_boxes` señalado por L20), `getProviderShareByToken` (264; proyección minimizada en 303/306), `getPrealertaIdsByToken`, `listPrealertaDocuments`, `prealertaStats`, `listActivePrealertaAddons`, `listPrealertaAddonsConfig`, `coercePsr`, `listDisabledSharePrealertaIds` y `listPackingListSubmissions`.

Hunks de #21 no adoptados, por ser ajenos a 0381: `fetchAllByIds` y `listPrealertaDocumentPresence` (hub 0402/presencia documental); `tenantId` en `listSuppliers`, `listPrealertas`, `getPrealertaByCode` y `listPrealertaDocuments` (defensa de SDD 0388/0389/0399, fuera del inventario y sin sus callers); `tenantId` en `listActivePrealertaAddons` (0434/L22); `ProviderShareData`/`getProviderShareByToken` de #21, que **revertiría la minimización vigente** de main al volver a leer `clients.name` y `description`.

## Clasificación migrate-first: NO es migrate-first

- **Objetos que alcanza el código adoptado:** `auth.getUser()` (plataforma); `client_users` (0080:13-31), legible por el propio usuario vía «client_users self or tenant read» (0080:68-70); `clients` embebido por la FK `client_id` (0080:16), legible vía «clients portal self read» (0080:74-76), que 0430 pendiente endurece sin quitar la lectura propia coherente; `prealerta_service_requests` (0150:68-91). Ninguno nace en 0417 ni en 0429: ambas sólo sustituyen expresiones de policies existentes (0417:55-161; 0429:47-93).
- **Si faltan 0417/0429:** la policy vieja «psr portal self select» (0150:203-208) filtra sólo por `get_portal_client_markbox()`. El código ya exige principal válido, tenant derivado y Shipping Mark (queries.ts:576-590), así que devuelve lo mismo que devolverá la policy nueva. Una sesión híbrida, que hoy vería todo el tenant por «psr tenant read» (0150:230-232), queda acotada por el código. 0417 no interviene en esta lectura.
- **Si se aplican antes o después del merge:** mismo resultado; la base impone el mismo predicado. Un fallo de Auth o del vínculo devuelve `[]` (falla cerrado), igual que `getPortalClient` (portal-queries.ts:59-129) ya deja la página sin cliente.
- **Coste:** una llamada extra a `auth.getUser()` y una lectura de `client_users` por invocación Portal (compras, compras/[code] y etiquetas).
- **Conclusión:** es seguro fusionar antes de aplicar; el título de la PR no lleva «[NO FUSIONAR ANTES DE APLICAR 0417+0429]». Aplicar sigue exigiendo autorización nominal separada, de a una y en orden 0417 → 0429 (el contrato de 0429 incluye 0417: `supabase/tests/0429_…test.sql` L41).

## Auditoría de consumidores de las policies 0417/0429

Sólo cambian las policies «portal self». Las de equipo y `service_role` quedan intactas y el preflight exige su inventario exacto (0417:6-53; 0429:5-45). Si producción tuviera policies fuera de banda en estas tablas, la migración aborta sin cambios parciales.

| Superficie y cliente | Sitios | Efecto |
|---|---|---|
| Portal, **sesión** (`createClient`) | `app/portal/(app)/proveedores/actions.ts`: duplicado 325-335; alta de proveedor 358-360 y 377-391 (`.select("id")`); edición 423-440; conteo 462-472; baja lógica 481-486; proveedor de la compra 532-547; alta de prealerta 569-586 (`.select("id, share_token")`); wechat 593-598; solicitudes 293-295 (desde 610-616) y 681-689 (`consent_accepted: true`); detalle 719-766 | Se conserva. El tenant sale de `get_portal_client_tenant()` = `client_users.tenant_id` (0105:44-49) y el Shipping Mark de `get_portal_client_markbox()` (0080:49-55): cumplen los `WITH CHECK` nuevos (0417:67-99, 113-145; 0429:59-93) para un principal coherente. El `UPDATE` no exige `deleted_at` nulo, igual que antes (0105:265-270, 302-308), así que la baja lógica sigue permitida. |
| Portal, **admin** | `proveedores/actions.ts:96-105` (adjunto tras crear la prealerta con sesión; admin en 149) | Sin RLS; no cambia. |
| Portal, páginas con **sesión** y principal L18 | `compras/page.tsx:26-33`; `compras/[code]/page.tsx:73-85`; `compras/[code]/etiquetas/page.tsx:48-57, 85-102` (firma admin 110-124 sólo de paths devueltos por la lectura de sesión); `compras/[code]/detalle/page.tsx:50-54`; `compras/nueva/page.tsx:32-38`; `proveedores/page.tsx:28-34`; `envios/page.tsx:43-50, 84-87` | Se conserva. `getPortalClient` (portal-queries.ts:59-129) ya exige el mismo principal coherente; los adjuntos se leen sólo de compras vivas del propio cliente. |
| Studio, **sesión de equipo** | `app/studio/(app)/proveedores/page.tsx:38, 55-61`; `proveedores/actions.ts:49/79, 186/225, 263/279`; `proveedores/scorecard-actions.ts:69`; `cn/actions.ts:135/261, 369-392`; `etiquetas/page.tsx:93`; `ordenes-compra/page.tsx:36-37`; `ordenes-venta/page.tsx:36`; `lib/studio/client-queries.ts:323`; `lib/studio/legal/expediente-queries.ts:184, 206` (sesión desde `app/studio/(app)/legal/expediente/[code]/page.tsx:235-265`); `lib/studio/purchase-orders/actions.ts:352/404`; `lib/studio/sales-orders/actions.ts:337/363-373, 387/410-414`; `lib/studio/sales-orders/queries.ts:162, 192` | Sin cambio: rigen las policies de equipo (0105:274-276, 310-312; 0229:29-36; 0118:59-63; 0150:230-238). Una sesión híbrida conserva la unión legítima de equipo. |
| Studio, **admin** | `lib/studio/sales-orders/actions.ts:453` | Sin RLS; no cambia. |
| Móvil m/cn, **admin** | `app/m/cn/servicios/page.tsx:14-20` (acota por `session.tenant_id` en código); `recibir/actions.ts:72/100/121, 185/221`; `estibar/actions.ts:205/226` | Sin RLS; no cambia. |
| Enlace público del proveedor, **admin** | `app/p/[token]/page.tsx:37`; `packlist/route.ts:47, 150, 213`; `upload/route.ts:75, 158` | Sin RLS; no cambia. |

`tesoreria/page.tsx:30` y `financiero-china/page.tsx:64` usan otro `listSuppliers` (`lib/studio/treasury/supplier-queries.ts`, tabla `suppliers`): fuera de 0417.

**Veredicto: sin impacto en flujos legítimos.** Sólo pierden acceso principales revocados, invitados, con cliente retirado o vínculo incoherente; filas de otro tenant con el mismo Shipping Mark; y adjuntos cuyo padre esté retirado o sea incoherente. El renombrado de Shipping Mark mantiene coherentes las cuatro tablas (0367:368-391; 0371:208-230), así que la regla padre-adjunto de 0417:147-161 no rompe datos legítimos renombrados.

## Revisión focal `revisar-datos-ve`

Resumen: CORRECTO 6 · ENCONTRADO 2 (preexistentes, no introducidos por L11) · NO VERIFICABLE 4. L11 no captura, mueve ni borra datos personales: restringe lectura y escritura y añade un chequeo de aplicación.

| tabla.campo | Qué es | Finalidad | Quién lo ve |
|---|---|---|---|
| `suppliers_cn.name/city/wechat/contact/notes` (0105:63-67); `legal_name_cn/address_cn/contact_name/contact_name_cn/contact_phone/contact_email` (0228:28-34); `source_origin/source_origin_note/purchase_history/comm_method` (0266:37-40) | Proveedor y su contacto en China: titulares que no son usuarios | Documentada en parte (0228:37-44; 0266:73-79) | Cliente dueño (Portal, sesión); equipo del tenant (Studio); recepción CN con admin (`m/cn/recibir/actions.ts:121`); el enlace público sólo lee `name, wechat` (queries.ts:289-295) |
| `prealertas.description/tracking_cn/boxes/est_value_usd` (0105:89-92); `client_note` (0269:33) | Datos comerciales del cliente; texto libre | Operación de la compra | Portal dueño; equipo; admin en m/cn; enlace público sin descripción ni nombre del cliente (queries.ts:303, 306) |
| `prealerta_documents.storage_path/file_name/doc_type/content_type/size_bytes` (0118:29-34); bucket privado `prealerta-docs` (0118:84-87) | Facturas, fotos, packing y capturas de WhatsApp | Respaldo documental de la compra | Portal dueño lista con sesión y la firma admin dura 120 s (`etiquetas/page.tsx:99-116`); equipo por tenant (0118:59-63); proveedor sube por enlace (`upload/route.ts:75`) |
| `prealerta_service_requests.trackings/consent_accepted/notes/quoted_amount_usd` (0150:82-85) | Trackings, consentimiento, texto libre y cotización | Servicios de recepción | Portal dueño (queries.ts:570-598); equipo (`app/studio/(app)/proveedores/page.tsx:59`, `actions.ts:79`); recepción CN con admin sólo `id, addon_code, status, client_markbox, prealertas.code` (`m/cn/servicios/page.tsx:15-20`) |
| `client_users.client_id/tenant_id` y `clients.id/tenant_id/markbox/deleted_at` (queries.ts:551) | Identificadores técnicos del principal | Autorizar el modo Portal | Sólo el servidor, con la sesión del propio usuario |

**CORRECTO**

1. Frontera por principal, tenant y Shipping Mark propio en SELECT/INSERT/UPDATE Portal; UPDATE valida origen y resultado (0417:55-161; 0429:47-93). CRBV arts. 28 y 60; PIPL art. 51. Verificado con contratos SQL efímeros, no en producción.
2. Defensa de aplicación que falla cerrado (queries.ts:576-590), con 25/25 tests y RED 21/25 contra main.
3. Minimización del principal (queries.ts:551): no lee nombre, correo, teléfono ni RIF, a diferencia del principal L18 que los necesita para mostrar (portal-queries.ts:69). SC 332/2001 (finalidad y calidad); PIPL art. 6.
4. Proyección minimizada del enlace del proveedor preservada (queries.ts:303, 306): no se adopta la versión de #21 que la revertía.
5. Proyección mínima en recepción móvil (`m/cn/servicios/page.tsx:16`).
6. Firma de adjuntos sólo tras la lectura de sesión (`etiquetas/page.tsx:99-116`), que 0417 acota a padre vivo y coherente (0417:147-161).

**ENCONTRADO** (preexistentes; fuera del alcance de L11)

1. Titulares que no son usuarios (punto 12): el contacto del proveedor (0228:31-34) se captura desde el Portal (`proveedores/actions.ts:366-391`) y el Studio (`app/studio/(app)/proveedores/actions.ts:225`), y el esquema no registra aviso ni retención para esas personas (0105:58-67; 0228:28-35). CRBV arts. 28 y 60; SC 332/2001; Ley Especial contra los Delitos Informáticos art. 20. Arreglo concreto, en SDD propio: aviso visible en el formulario del proveedor y regla de retención con borrado de los campos de contacto.
2. Texto libre sin restricción (punto 1): `suppliers_cn.notes` (0105:67), `prealertas.description` (0105:89), `client_note` (0269:33) y `prealerta_service_requests.notes` (0150:84) pueden recibir datos personales o sensibles. CRBV art. 28; PIPL arts. 5-7. Arreglo, en SDD propio: guía y límite de uso en el formulario, más revisión de retención.

**NO VERIFICABLE**

1. Estado real de estas policies y del ledger en producción: no consultado; `migrations-applied` NO DISPONIBLE.
2. Región de alojamiento de Supabase y transferencia internacional de datos de proveedores chinos tratados también por el equipo de Yiwu (`m/cn/servicios/page.tsx:13`): PIPL arts. 38-40; no se deduce del repositorio.
3. Retención o purga de estas tablas y del bucket (se usa `deleted_at`; no se buscó un job de purga).
4. Comportamiento con datos reales y E2E autenticado.

Fuera de alcance, para un abogado: base de licitud, textos de aviso y política, contratos con proveedores y plazos legales de conservación. Esta revisión no es asesoría legal; conviene una segunda opinión de otro modelo.

## Gobernanza

Cumplimiento: SGE-00.05 (contrato SQL de tenant, propietario y vínculo), SGE-00.06 (preflight de drift), SGE-00.07 (evidencia local separada de producción) y SGE-00.12 (sin aplicar ni desplegar). No aplica: pantallas, formularios, botones y componentes (sin cambio visual ni acciones nuevas; `/ui-check` no aplica). La no conformidad histórica de aislamiento sólo se corrige en la base tras la aplicación autorizada. Las allowlists históricas de 0361/0381 (auditorías y handoffs de #21) ceden al corte del plan y no se importan.

## VALIDACIÓN

Producto validado en `f63d77f69d4a6f7b65a492cc7a6823559ac0ad37` sobre base `3c610701`. Node 24.20.0, pnpm 12.3.4 (Corepack), Docker 29.7.2, `postgres:17`. Recibos fuera de Git en `C:/Users/AKXGEN~1/AppData/Local/Temp/claude/C--Users-AKX-generator-Desktop-Developer-DTDCARGO/454d97be-b1e0-4fc9-97e9-c6bb621ba84c/scratchpad/c-l11-portal-prealertas-servicios/`.

| Comprobación | Estado y evidencia |
|---|---|
| `harness-worktree guard` / `claim --owner` | PASÓ; guard revalidado con `--owner` y rama antes de cada commit. |
| `corepack pnpm install --frozen-lockfile` | PASÓ en 57,4 s; lockfile y `package.json` intactos. |
| Blobs de origen y rama | PASÓ; tabla de identidad arriba. Specs sin nota idénticas byte a byte; baseline sin las dos líneas nuevas idéntico a base. |
| `node scripts/install-merge-drivers.mjs --check` | PASÓ. |
| `corepack pnpm sdd:check` | PASÓ; conserva las colisiones históricas declaradas (0336, 0342, 0362, 0363, 0394). |
| `corepack pnpm docs:index` y `docs:check` | PASÓ; 417 specs. |
| `node scripts/check-schema-rebuild.mjs` | PASÓ en 31 s: inventario 422, 404 aplicadas desde cero, 18 sólo-ledger sin tocar el esquema, barrido de 219 tablas con 2 tenants. |
| `node scripts/run-sql-tests.mjs` | PASÓ en 70 s: 164 contratos, incluidos 0417 y 0429; rollback total. El de 0417 carga 0080/0105/0118/0229 (L61-64) y reproduce el RED de tres lecturas ajenas y dos apropiaciones con las policies originales (L128-129) más drift del inventario (L170); el de 0429 carga 0006/0080/0105/0118/0150/0229/0230 y **0417** (L34-41), con RED causal (L3, L250). Fixtures sintéticos, no datos reales. |
| `node scripts/check-pending-migration-symbols.mjs` | PASÓ: 0 ROJO · 0 AMARILLO; sin declaraciones. |
| `vitest run lib/studio/prealertas` | PASÓ: 7 archivos, 146 tests. |
| `service-request-scope.test.ts` | PASÓ 25/25 con L11; RED 21/25 contra el `queries.ts` de main (restaurado y verificado por hash). |
| `eslint` focal y `corepack pnpm typecheck` | PASÓ. |
| `git diff --check`, `--cached --check` y allowlist | PASÓ: 11 archivos exactos, incluido este handoff. |
| `corepack pnpm verify` | **NO COMPLETADO, no es verde.** 16 de 17 pasos iniciados: 14 PASÓ, `migrations-applied` NO DISPONIBLE y E2E FALLÓ en la primera pasada; el reintento automático de verify quedó COLGADO y se detuvo sin reintentar. Build NO EJECUTADO dentro de verify; lo cubre el CI de la PR. Sin `verify.exit` propio. Detalle abajo. |
| E2E autenticado y `migrations-applied` real | NO DISPONIBLE: sin credenciales ni entorno Supabase; no se consultó producción. |
| `/ui-check` | NO EJECUTADO: no aplica, sin cambio visual. |

Detalle del gate canónico `corepack pnpm verify` sobre `f63d77f6` (inicio 2026-09-11T09:51:01Z; detenido por cuelgue a las 10:37:33Z):

| Paso | Estado y evidencia |
|---|---|
| harness | PASÓ, 18 tests. |
| lint | PASÓ, 0 errores y 8 advertencias en archivos intactos (`NewPurchaseWizard.test.tsx` 4, `PurchaseStepDetalle.test.tsx` 2, `KommoBoardView.tsx` 1, `KommoClient.tsx` 1); ninguna en archivos de L11. |
| rsc-boundary | PASÓ, 1597 módulos escaneados. |
| typecheck | PASÓ. |
| edge-functions | PASÓ, 4 funciones compilan con Deno. |
| test | PASÓ, 6709 tests en 527 archivos (235,8 s). |
| docs:check | PASÓ, 417 specs sincronizadas. |
| numbering | PASÓ, conserva las colisiones históricas declaradas. |
| feature-constants | PASÓ, 5 banderas. |
| components:check | PASÓ. |
| governance:check | PASÓ. |
| migrations-applied | NO DISPONIBLE: SKIP sin `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`; no se midió el ledger real. |
| pending-migration-symbols | PASÓ, 0 ROJO · 0 AMARILLO. |
| sql-tests | PASÓ, 164 contratos, rollback total. |
| schema-rebuild | PASÓ, 404 migraciones aplicadas desde cero, 18 migraciones sólo-ledger, barrido de 219 tablas con 2 tenants de la base efímera. |
| e2e | NO DISPONIBLE (colgado). Primera pasada FALLÓ (exit 1) en 11,2 min: 152 pasaron, 15 fallaron, 1 flaky y 18 omitidos. Los 15 fallos son `auth.spec.ts:21/91/98/105` y `global-search.spec.ts:22` en chromium, mobile-chrome y mobile-safari, con el servidor sin URL/clave Supabase (`proxy.ts:67`): los mismos fallos ambientales de L13 y L16. Flaky: `auth.spec.ts:74` (chromium). El reintento automático de verify llegó a 53 ok, 0 fallos y 6 omitidos (hasta el test 168) y dejó de escribir a las 10:18:06Z. El vigilante marcó COLGADO. Detenido entre 10:37:31Z y 10:37:33Z con `taskkill /PID <pid> /T /F` sobre 21904 (bash de verify y conhost 15248) y sobre 18836, raíz de la cadena huérfana de 30 procesos: sh 18836 → corepack 40916 → pnpm-native 10612 → cmd 19712 → `verify.mjs` 15532 → Playwright 3988 → `next dev` en el puerto 3101 (35228/18692/33472), los workers 43384/47952/37564/28688/46020/43360 y 15 `chrome-headless-shell`. Sin reintento manual; puerto 3101 libre y sin restos. No se tocaron procesos de otros Workers ni servicios Supabase ajenos. |
| build | NO EJECUTADO dentro de verify (el cuelgue ocurrió antes). Cubierto por el CI de la PR: «Calidad local sin secretos», run 34587473927 sobre `f63d77f6`, con «Build de produccion sin secretos» y «Confirmar arbol reproducible» en success (10:05:24Z–10:19:19Z). `tsconfig.json` intacto. |

## COMMITS

- `afc3c1dddd866cbc320627ac2fbec307708f1624` — SDD-0361/0381: migraciones, contratos, specs con nota, dos esperas del baseline e índice generado.
- `f63d77f69d4a6f7b65a492cc7a6823559ac0ad37` — SDD-0381: región focal de `queries.ts` y test de scope.
- Commit que contiene este documento: cierre durable del handoff; SHA final en la PR.

## PR / BRANCH

[PR #81 en borrador](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/81), base `main`, rama `codex/c-l11-portal-prealertas-servicios`, publicada con push explícito de la rama a sí misma. Sin merge, sin aplicar migraciones y sin despliegue manual.

## PENDIENTES DE ESTA TAREA

- Ninguno de extracción ni de adopción.
- Revisión del Director y CI «Calidad continua» del SHA final en la PR (el workflow corre en `pull_request`; no cubre SQL, E2E autenticado ni ledger).
- La aplicación de 0417 y luego 0429 es una tarea nominal separada; no se ejecutará para poner verde un gate.

## FUERA DE ALCANCE DETECTADO

1. `assignPrealertaToSalesOrder` y `unassignPrealertaFromSalesOrder` (`lib/studio/sales-orders/actions.ts:370-373`, `410-414`) actualizan `prealertas` con sesión de equipo, pero el inventario de policies no tiene UPDATE de equipo sobre `prealertas` (0105:286-316, confirmado por el preflight 0417:31-35) y el código no comprueba filas afectadas: para un usuario sólo de equipo la acción podría responder «ok» sin actualizar. Análisis estático, no reproducido. 0417 no cambia ese estado.
2. El helper nuevo repite las comprobaciones del principal L18 (`lib/portal/portal-queries.ts:59-109`) con otra proyección. Unificarlos exige otro SDD: 0381 prohíbe tocar helpers globales.
3. Las páginas Portal que llaman `listPrealertaServiceRequests` resuelven el principal dos veces (con `getPortalClient` y dentro de la query): costo de latencia, no de seguridad.
4. La spec 0381 conserva casillas de aceptación marcadas con `status: in-progress`, y ambas specs listan artefactos de #21 (auditorías y handoffs) que este corte no importa. Es historia del origen y no se alteró.
5. E2E sin configuración Supabase: 15 fallos ambientales ya conocidos en L13 y L16, 1 flaky y el reintento automático de verify colgado más de 15 minutos sin salida, parecido al worker que no cerró en L13. No se persiguió ni se cambiaron retries, timeouts ni tests.
6. Ocho advertencias de lint en archivos intactos y avisos heredados de pnpm en la instalación, sin cambios de configuración ni de lockfile.

## HANDOFF AL DIRECTOR

- Siguiente acción: revisar la PR draft sobre el SHA final, base `3c610701`, y sus checks por SHA.
- Dependencias: ninguna dependencia SQL con otros lotes C. Dentro del lote, 0417 precede a 0429 por el contrato (arista 0417 ⇢ 0429 del anexo SQL); no es una dependencia del SQL de 0429.
- Compartidos: baseline e índice con #69–#77, L02, L17 y la corrección del checker. Al integrar, unir las entradas y regenerar el índice, sin elegir un lado. Las declaraciones de símbolos no se tocaron.
- **Fusionar NO autoriza aplicar** `0417_portal_prealertas_tenant_boundary` ni `0429_portal_service_requests_principal_tenant`. Hace falta OK nominal de Sam y `docs/runbooks/aplicar-migraciones-prod.md`: de a una, primero 0417 y después 0429, con `name` exacto y smoke de compras, proveedores, adjuntos y servicios del Portal. Retirar cada espera sólo con recibo de aplicación.
- Sesiones consumidoras: ninguna delegada. Ownership liberado al cierre con `node scripts/harness-worktree.mjs release --owner c-l11-worker-20260911-claude`, después de la última escritura, commit y publicación. Worktree y rama conservados.
