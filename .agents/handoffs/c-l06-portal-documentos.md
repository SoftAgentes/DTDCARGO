# L06 — Documentos y packing lists del Portal por principal

Fecha: 2026-09-11. Task ID: `c-l06-portal-documentos`.
Owner / sesión escritora: `c-l06-worker-20260911-claude`. Estado: lista-para-revision en PR borrador; **MIGRATE-FIRST: no fusionar antes de aplicar y verificar 0406 en producción**.
Repositorio: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO`.
Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/c-l06-portal-documentos`.
Rama: `codex/c-l06-portal-documentos`. Base: `3c6107012f754953323202a7386b3e7811593814` (origin/main, sin avances al cerrar).
Origen de solo lectura: `ea9952a47f4adf14c48c91e6d0147597beb94aa7`, PR #21 (merge-base con main `2a2e81bf`).
Permisos del encargo: commits selectivos, push de la rama a sí misma y PR draft. NO merge, NO aplicar 0406, NO leer producción, NO deploy.

## OBJETIVO ORIGINAL

Preparar L06 del bloque C (documentos y packing lists del Portal por principal y tenant, RPC 0406, SDD-0342) como PR draft contra main, para integrarla sólo después de aplicar 0406 en producción.

## COMPLETADO

- **Idénticos por blob al origen:** `0406_portal_packing_lists_por_principal.sql` (`f6c3308e`, 1785 B), su contrato (`2934fefc`, 6485 B), `lib/portal/signed-portal-documents.ts` (`9dfe756e`, 1134 B), `portal-packing-list-documents.test.ts` (`5b0ea4da`, 1422 B) y `signed-portal-documents.test.ts` (`6958dc32`, 2242 B).
- **Spec 0342** exacta desde `ea9952a4` más una nota fechada 2026-09-11 con la forma de 0363: pendiente en baseline, MIGRATE-FIRST, OK nominal de Sam + runbook y corte focal. Sin la nota coincide byte a byte con `13311552` (2664 B). Se conserva el `status: done` histórico y todo el frontmatter; no se reservó número (0342/0406 no existían en main).
- **Adopción focal:** `listarPackingListsComoDocumentos` lee la RPC con la sesión y la página firma mediante el helper `server-only`. Los blobs de main (`5c1182f2`, `d127744f`) son los del merge-base: main no había modificado esos dos archivos desde que #21 se separó (la interacción con 0435–0449 es de base de datos y se verificó aparte). Por eso la página adoptada resulta idéntica al origen (`bbc9bc8d`) y `packing-list-queries.ts` (`c7eb2fd6`) difiere del origen sólo en las líneas 103–104: el docstring SDD-0343 de `obtenerPackingListDeCompra` pertenece a otro lote y queda como en main.
- **Baseline:** sólo la espera `0406_portal_packing_lists_por_principal` (bloque C L06 / SDD-0342; MIGRATE-FIRST; OK nominal de Sam y runbook; name exacto). Al retirarla, el archivo vuelve al blob base `3c5a67d4`; `cutoff: 238` y las esperas 0409/0418/0419/0430 intactas.
- **Declaración** `l06-portal-documents-packing-lists-pending-rpc` con el patrón L16/L05: sitio real `lib/portal/packing-list-queries.ts:231` y cuatro evidencias ancladas (232, 252, `page.tsx:56`, `page.tsx:141`). El gate la rechaza por un defecto del checker (ver VALIDACIÓN); por instrucción del Director se conserva anclada al sitio real.
- **Índice** regenerado con `corepack pnpm docs:index` (416 specs).
- **Tests nuevos:** `portal-packing-list-documents.rpc-state.test.ts` (RPC presente, vacía, ausente PGRST202, denegada 42501, transporte caído; sin lectura directa de tablas), `signed-portal-documents.scope.test.ts` (`signDocumentUrls` real: bucket `shipment-docs`, TTL 3600 s, paths ajenos no expuestos, rechazo de Storage), `PortalDocumentsPage.rpc-state.test.tsx` (composición de la página con RPC ausente/presente y firma no disponible) y el contrato SQL `0406_portal_packing_lists_mismo_markbox.test.sql` (mismo Shipping Mark en dos tenants y fila incoherente entre tenants; el contrato del origen usa Shipping Marks distintos).

## DIFF FOCAL POR ARCHIVO

`lib/portal/packing-list-queries.ts` (main → adoptado; resto del módulo intacto):

| main | adoptado | Justificación |
|---|---|---|
| 224–225 «admin client, y el `client_markbox` es acá el control de acceso» | 224–225 «SDD-0342: la RPC deriva el cliente desde auth.uid()» | El contrato del caller cambia; el texto anterior describía el acceso admin por Shipping Mark que desaparece. |
| 228–231 `(admin, markbox)` + `if (!markbox) return []` | 228 `(db: SupabaseClient)` | El caller ya no entrega identidad; la RPC la deriva de `auth.uid()` (0406:38–39). |
| 234–243 `admin.from("packing_list_submissions")…eq("client_markbox")…limit(200)` | 231 `db.rpc("get_portal_packing_list_documents")` | Retira la lectura service_role sin tenant; orden y tope 200 pasan al SQL (0406:40–41). |
| 247–251 normalización del embed `prealertas(code)` | 235 `String(r.purchase_code ?? "").trim()` | La RPC devuelve `purchase_code` plano. |
| 260–261 `created_at` / `total_ctns` | 244–245 `submitted_at` / `boxes` | Nombres de columnas de la RPC (0406:8–14). |
| 265–269 catch → `[]` | 249–253 catch → `[]` | Sin cambio: mismo fallo cerrado. |

`app/portal/(app)/documentos/page.tsx`:

| main | adoptado | Justificación |
|---|---|---|
| 3, 4, 6 imports de admin, `listMyDocuments/getPortalClient` y `signDocumentUrls` | 4 import de `listSignedPortalDocuments` | La página deja de construir service_role. |
| 53 `getPortalClient(supabase)` | — | Sólo servía para pasar el Shipping Mark a la lectura admin. |
| 58–63 `Promise.all(listMyDocuments, admin packing)` | 54–57 `Promise.all(listSignedPortalDocuments(supabase), listarPackingListsComoDocumentos(supabase))` | Ambas fuentes reciben sólo la sesión. |
| 65–70 `signDocumentUrls(createAdminClient(), paths)` sin try | helper `signed-portal-documents.ts:21–35` | Firma server-only de paths releídos por RLS, con fallo cerrado. |
| 78 `docs.map((doc) =>` y 89 `url: urls[doc.storagePath] ?? null` | 65 `signedDocs.map(({ document: doc, url }) =>` y 76 `url,` | La URL llega resuelta desde el helper. |
| JSX 132–175 | JSX 119–162 | Idéntico: sin cambio visual. |

Resumen `/ui-check` (NO EJECUTADO; lo corre el Director): el diff no toca JSX, clases, copy ni componentes; sólo imports y obtención de datos (líneas 1–15 y 52–78 del archivo adoptado).

## FIRMADOR Y RBAC DOCUMENTAL 0435–0444

- **Entradas:** `listSignedPortalDocuments(db)` sólo recibe el cliente de sesión (`signed-portal-documents.ts:18–20`); la página le pasa `supabase` (`page.tsx:55`). No acepta ids ni paths del llamador ni del navegador.
- **Origen de los paths:** `listMyDocuments(db)` (`portal-queries.ts:357–390`) lee `shipment_documents` con la sesión, filtra por el Shipping Mark de `get_portal_client_markbox()` (360–361, 368) y queda sujeta a RLS. Para un cliente Portal la policy aplicable es `shipment_documents portal self read` de 0416 (0416:55–72: `auth.uid()`, vínculo activo, cliente vivo, tenant y envío coherentes). Precisión sobre el encargo: los paths firmados provienen de esa lectura RLS ligada al principal, no de la RPC 0406; los packing lists no son archivos y nunca se firman (`page.tsx:106` enlaza a `/portal/compras/[code]`).
- **Elevación mínima:** sin documentos no se construye service_role (`signed-portal-documents.ts:22`); los packing lists nunca usan admin. El resultado sólo asocia URLs a los paths propios (29–32): una URL de un path ajeno devuelta por Storage se descarta (test de alcance).
- **TTL:** `signDocumentUrls` usa su default de 3600 s (`shipment-document-queries.ts:50`), el mismo que la página de main (main `page.tsx:66–69`, sin TTL propio). El test lo fija en 3600 s sobre el bucket `shipment-docs`, que es privado (0086:69–77).
- **Compatibilidad 0435–0444:** 0439 conserva la lectura Portal de 0416 (0439:7 y postcheck 244–252) y sólo añade `document_entity_authorized` al camino interno por tenant (152–183) y al bucket (185–222). El helper lee con la sesión, así que respeta ambas; la firma con service_role ya existía en main para los mismos paths. Un principal sólo de equipo no obtiene Shipping Mark Portal → `[]` sin elevar (`portal-queries.ts:360–361`). No se abre acceso que esas migraciones cerraron. 0435–0438 y 0440–0444 cambian otras entidades de `documents`, no `shipment_documents`.
- **0449:** su trigger `packing_list_reconcile_labels` es `after insert` sobre `packing_list_submissions` (0449:248–250); la RPC es de lectura y no depende de él. Verificado en base efímera con 0406 aplicada después de 0449.

## COMPORTAMIENTO ANTE FALLO

| Situación | main hoy (`3c610701`) | Código adoptado |
|---|---|---|
| RPC 0406 ausente (PGRST202) | No aplica: main no llama la RPC; lee packing lists con service_role por Shipping Mark (main `packing-list-queries.ts:234–243`). | El helper lanza (232) y su catch devuelve `[]` (249–252), sin fallback. La página conserva los documentos de envío firmados (`page.tsx:55`, 65–78); si el cliente sólo tenía packing lists ve el estado vacío (141). Declarado AMARILLO; migrate-first evita esa ventana. |
| Error o rechazo de la lectura de packing lists | catch → `[]` (main 265–269). | Igual: catch → `[]` (249–253). |
| Falta URL o `SUPABASE_SERVICE_ROLE_KEY` (`createAdminClient` lanza, `lib/db/admin.ts:22–31`) | La página lanza al construir admin para packing lists (main `page.tsx:61`) o para firmar (66–67). | Packing lists no usan admin; la firma captura el error (`signed-portal-documents.ts:24–35`) y la tarjeta muestra «Enlace no disponible» (`DocumentsClient.tsx:151–153`). |
| Storage responde error | `signDocumentUrls` devuelve `{}` (`shipment-document-queries.ts:59`) → URL nula. | Igual; si además rechaza, el catch deja URL nula. |
| Error de `listMyDocuments` | `[]` (`portal-queries.ts:373`). | Igual. |
| Mismo Shipping Mark en dos tenants (`clients` es `unique (tenant_id, markbox)`, 0006:23) | Filtro sólo por `client_markbox` con service_role (main `packing-list-queries.ts:237`): puede listar packing lists de otro tenant. | La RPC exige tenant coherente en vínculo, cliente, packing list y compra (0406:21–37); contrato nuevo PASÓ. |

Conclusión: no empeora. El único modo nuevo de fallo (RPC ausente) es cerrado, sin exposición, y queda fuera de producción por el orden migrate-first. La auditoría (producto:182) advierte que un verde con mocks puede ocultar degradaciones: por eso se prueban RPC presente y ausente en helper y página.

## VALIDACIÓN

Árbol de producto: commit `1b655967010c64542532d9fb4e1beebd62950bcf` sobre `3c610701`. Node 24.20.0, Corepack 0.35.0, pnpm 12.3.4. Sin credenciales copiadas ni `.env` operativo. Recibos fuera de Git en `C:\Users\AKXGEN~1\AppData\Local\Temp\claude\C--Users-AKX-generator-Desktop-Developer-DTDCARGO\454d97be-b1e0-4fc9-97e9-c6bb621ba84c\scratchpad\c-l06-portal-documentos\`: `install.log`, `vitest-focal.log`, `focal-checks.log`, `typecheck.log`, `schema-rebuild.log`, `order-check.mjs` + `order-check.log`, `repro-checker.mjs` + `repro-checker.log`, `repro-minimo.mjs` + `repro-minimo.log`, `check-pending-migration-symbols.utf16.mjs` + `pending-symbols-utf16.log`, `verify.log`, `verify.exit`, `verify.meta`, `verify-summary.mjs`, `verify-kill.log`, `procs-before-kill.log`, `procs-chain.log`, `procs-after-kill.log`, `list-l06-procs.ps1`, `chain-l06-procs.ps1`, `build.log`, `build.exit`, `build.meta`, `diff-focal.patch`.

| Comprobación | Estado y evidencia |
|---|---|
| `guard` / `claim` / `guard --owner` | PASÓ al inicio y antes del commit y del push. |
| `corepack pnpm install --frozen-lockfile` | PASÓ, 813 paquetes (25,8 s); aviso heredado `pnpm.onlyBuiltDependencies`. Lockfile intacto. |
| Blobs (`git hash-object` / `git rev-parse HEAD:`) | PASÓ: tabla abajo. |
| Spec sin nota / baseline sin 0406 | PASÓ: `13311552` y `3c5a67d4` exactos. |
| `node scripts/install-merge-drivers.mjs --check` | PASÓ. |
| `sdd:check` | PASÓ: sin números repetidos; conserva colisiones históricas declaradas (entre ellas la de migraciones 0342, ajena a la spec 0342). |
| `corepack pnpm docs:index` / `docs:check` | PASÓ: 416 specs sincronizadas. |
| `node scripts/check-schema-rebuild.mjs` | PASÓ: inventario 421, 403 desde cero, 18 sólo-ledger, aislamiento multi-tenant (219 tablas, 2 tenants). Contenedor retirado. |
| Orden tipo producción (`order-check.mjs`, fuera del repo) | PASÓ: 398 migraciones no pendientes hasta 0449 y 0406 al final; RPC `SECURITY DEFINER`, `search_path=""`, sin argumentos; EXECUTE sólo `authenticated` (anon/service_role `f`); policies 0416/0439, trigger 0449 y `UNIQUE (auth_user_id)` presentes; 0 filas para usuario sin vínculo. Contenedor `dtd_l06order_c7c2291b` retirado. |
| Contratos SQL focales | PASÓ: origen 0406 y nuevo mismo Shipping Mark, ambos con ROLLBACK. |
| `node scripts/check-pending-migration-symbols.mjs` | **FALLÓ (exit 2) por defecto del checker (enmascarado por code points con caracteres astrales).** Con índices UTF-16: **0 ROJO / 1 AMARILLO**. Detalle y repro abajo. |
| Vitest focal (7 archivos) | PASÓ: 40 tests (origen, existentes de packing list/filtro y nuevos). |
| Typecheck completo / ESLint focal / rsc-boundary | PASÓ / PASÓ / PASÓ (1598 módulos). |
| `corepack pnpm verify` | FALLÓ / INCOMPLETO sobre `1b655967`: 13 de 17 pasos PASÓ; `pending-migration-symbols` FALLÓ (exit 2) por defecto del checker; `migrations-applied` NO DISPONIBLE; e2e FALLÓ/NO DISPONIBLE: colgado, detenido por el Worker según protocolo del Director (puerto 3138); build NO EJECUTADO dentro de verify. Sin veredicto final impreso: `verify.exit = exit=0` es artefacto del wrapper MSYS tras `taskkill`. Detalle abajo. |
| `git diff --check` y allowlist | PASÓ: 15 archivos de producto + este handoff; nada fuera del alcance. |
| `/ui-check` | NO EJECUTADO: lo corre el Director; JSX sin cambios. |
| E2E autenticado, `migrations-applied`, producción | NO DISPONIBLE / NO EJECUTADO: sin credenciales y fuera de la autorización. |

### Detalle del gate canónico

`corepack pnpm verify` sobre `1b655967` (inicio 04:56:19; recibo `verify.log`, extractor `verify-summary.mjs`). Puerto E2E propio: **3138** («dev server propio en el puerto 3138», línea 330 del log).

| Paso | Estado y evidencia |
|---|---|
| harness | PASÓ, 18 tests (22,4 s). |
| lint | PASÓ, 0 errores y 8 advertencias en archivos fuera del alcance: `NewPurchaseWizard.test.tsx`, `PurchaseStepDetalle.test.tsx`, `KommoBoardView.tsx` y `KommoClient.tsx`. |
| rsc-boundary | PASÓ, 1598 módulos. |
| typecheck | PASÓ. |
| edge-functions | PASÓ, 4 funciones compilan. |
| test | PASÓ, 6700 tests en 531 archivos (191,15 s). |
| docs:check | PASÓ, 416 specs. |
| numbering | PASÓ, 416 specs · 421 migraciones; colisiones históricas declaradas. |
| feature-constants | PASÓ, 5 banderas. |
| components:check | PASÓ. |
| governance:check | PASÓ. |
| migrations-applied | NO DISPONIBLE: sin `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` (SKIP, exit 3); ledger real sin medir. |
| pending-migration-symbols | FALLÓ (exit 2) por defecto del checker (enmascarado por code points con caracteres astrales); con índices UTF-16: 0 ROJO / 1 AMARILLO. |
| sql-tests | PASÓ, 164 contratos, incluidos `0406_portal_packing_lists_por_principal` y `0406_portal_packing_lists_mismo_markbox`; rollback total. |
| schema-rebuild | PASÓ, 403 desde cero, 18 sólo-ledger, aislamiento multi-tenant (219 tablas, 2 tenants). |
| e2e | **FALLÓ/NO DISPONIBLE: colgado, detenido por el Worker según protocolo del Director.** Primera pasada (13,8 min): 152 pasaron, 15 fallaron, 1 flaky, 18 omitidos. Los 15 fallos son ambientales y coinciden con L16: `auth.spec.ts:21/91/98/105` y `global-search.spec.ts:22` en chromium, mobile-chrome y mobile-safari (`proxy.ts:67` sin URL/clave de Supabase). El flaky es `auth.spec.ts:74` (chromium, `ERR_ABORTED`). Además, `worker-47 … force-killed` a los 300 s. El reintento automático de verify arrancó a las 05:21:36 y el log quedó sin salida desde las 05:29:17. No se hizo ningún reintento adicional. |
| build | NO EJECUTADO dentro de verify. CI del SHA `1b655967` (run 34582301730, «Calidad local sin secretos»): failure en «Codigo contra migraciones pendientes» (mismo defecto del checker) y «Build de produccion sin secretos» SKIPPED. Vercel Preview del mismo SHA: completó (no sustituye el gate). Build aislado fuera de verify (`node scripts/check-build.mjs`, 05:50:03–05:52:42 sobre `1b655967`): **PASÓ**, «build de producción OK», `tsconfig.json` restaurado y árbol limpio. No es un reintento de verify: sólo el paso de build, aislado en `.next-verify`. |

Detención según protocolo del Director (recibos `procs-before-kill.log`, `procs-chain.log`, `verify-kill.log`, `procs-after-kill.log`; scripts de sólo lectura `list-l06-procs.ps1` y `chain-l06-procs.ps1`):

- Vigilante de un solo aviso: COLGADO (sin salida en el log por más de 15 min).
- Árbol propio identificado por ruta del worktree, puerto 3138 y cadena de padres: `sh.exe corepack pnpm verify` 23380 → `corepack.js` 45488 → `pnpm-native verify` 44396 → `cmd` 5304 → `verify.mjs` 45176 → Playwright 564 → workers 18388, 38604, 24300, 40104, 45392 y 15416 (con sus `chrome-headless-shell`) y `cmd` 29348 → `next dev --port 3138` 28136 → servidor 42424.
- 05:48:47: `taskkill /PID 23380 /T /F` terminó 30 procesos (exit 0).
- Sin sobrevivientes: 0 procesos con la ruta del worktree, ningún PID de la cadena sigue existiendo y el puerto 3138 no tiene listener. El árbol Git quedó limpio.
- No se tocaron procesos de otras sesiones (se observó un `pnpm typecheck` ajeno iniciado a las 05:48:43).
- `verify.exit` registra `exit=0` porque el wrapper de MSYS no propaga el código de un proceso terminado con `taskkill`. No es un resultado: verify no imprimió su veredicto final.

### `pending-migration-symbols`: defecto del checker y repro

- **Caminos de la máscara** en `scripts/check-pending-migration-symbols.mjs`: `maskSqlNonCode` construye `const out = [...sql];` (106) y lo consume `extractCreatedSymbols` (180); `maskJavaScriptComments` construye `const out = [...source];` (253) y lo consume `findSymbolReferences` (389). `out` se arma por code points pero se indexa con posiciones UTF-16. En la máscara JS, cada carácter astral desplaza la escritura y pisa saltos de línea.
- **Árbol real** (`repro-checker.log`): `packing-list-queries.ts` mide 12042 unidades UTF-16 y 12040 code points, con astrales en las líneas 36 y 156 (comentarios de main). La máscara vigente deja 171 líneas de 294 y ubica la llamada en `:125`; con índices UTF-16 quedan 294 líneas y la llamada en `:231`. En SQL, la máscara vigente deja sin extraer `comments_freeze_immutable` (0090) y `sales_orders.invoicing_total_boxes`, `prealerta_sales_order_in_tenant` y `sales_order_claim_and_invoice` (0128). Hoy no cambian el resultado de este gate.
- **Repro mínimo** (`repro-minimo.mjs` / `repro-minimo.log`): un comentario de bloque con un emoji antes de la llamada. Fuente de 4 líneas → la máscara vigente deja 2 y reporta `a.ts:1`; con índices UTF-16 deja 4 y reporta `a.ts:3` (real). El caso SQL mínimo no reproduce (esa máscara protege los saltos); el impacto SQL citado es el medido en el árbol real.
- **Con índices UTF-16** (`check-pending-migration-symbols.utf16.mjs`, copia fuera del repo con `texto.split("")` en 106 y 253; `pending-symbols-utf16.log`): **0 ROJO / 1 AMARILLO**, con la declaración y sus cuatro evidencias válidas.
- Por instrucción del Director: la declaración se mantiene en `:231`, el checker no se modifica en esta rama y el cierre no se bloquea. `quality.yml:78` ejecuta el mismo check en CI.

Identidad de blobs (commit `1b655967`):

| Archivo | Blob | Bytes | Relación |
|---|---|---|---|
| `supabase/migrations/0406_portal_packing_lists_por_principal.sql` | `f6c3308e` | 1785 | idéntico al origen |
| `supabase/tests/0406_portal_packing_lists_por_principal.test.sql` | `2934fefc` | 6485 | idéntico al origen |
| `docs/specs/0342-documentos-portal-por-principal/spec.md` | `37c82384` | 3617 | origen + nota |
| `lib/portal/signed-portal-documents.ts` | `9dfe756e` | 1134 | idéntico al origen |
| `lib/portal/__tests__/portal-packing-list-documents.test.ts` | `5b0ea4da` | 1422 | idéntico al origen |
| `lib/portal/__tests__/signed-portal-documents.test.ts` | `6958dc32` | 2242 | idéntico al origen |
| `app/portal/(app)/documentos/page.tsx` | `bbc9bc8d` | 6774 | idéntico al origen |
| `lib/portal/packing-list-queries.ts` | `c7eb2fd6` | 12216 | origen salvo 103–104 (main) |

## REVISIÓN FOCAL DE DATOS (`revisar-datos-ve`)

Resumen: 3 CORRECTO · 2 ENCONTRADO (uno preexistente que L06 corrige al aplicar 0406, otro preexistente sin cambio) · 5 NO VERIFICABLE.

Inventario (sólo lo que toca esta pantalla):

| Campo | Qué es | Finalidad | Retención | Quién lo ve |
|---|---|---|---|---|
| `packing_list_submissions.supplier_company/contact/email/wechat/phone` (0147:44–49) | Contacto del proveedor en China: titular no usuario (punto 12) | Contactar al proveedor (0147:44) | NO VERIFICABLE | Equipo por tenant; **no** sale por la RPC (0406:8–14, 20) |
| `packing_list_submissions.rows`, `total_amount`, `supplier_note` (0147:54, 57, 61) | Mercancía, montos y nota libre | Documento de la compra | NO VERIFICABLE | No salen por la RPC; el detalle de compra es de otro lote |
| `packing_list_submissions.submit_ip/user_agent` (0147:65–66) | Evidencia anti-abuso | Auditoría | NO VERIFICABLE | No salen por la RPC |
| `folio`, `created_at`, `total_ctns` (0147:53, 59, 67) y `prealertas.code` | Identificadores del documento y la compra | Listar en Documentos | NO VERIFICABLE | Cliente titular vía RPC (0406:20) |
| `client_users.auth_user_id`, `clients.markbox`, `tenant_id` | Vínculo e identificador del cliente | Derivar identidad dentro de la RPC | — | No se devuelven (0406:8–14) |
| `shipment_documents.*` (0086:17–31) y objetos del bucket `shipment-docs` | BL, POD y otros; un POD puede contener nombre y firma de quien recibe (titular no usuario) | Documentar el envío | La UI promete «7 años en archivo» (`page.tsx:135`): NO VERIFICABLE | Cliente (0416:55–72), equipo con RBAC de Tracking (0439), service_role sólo para firmar |
| URL firmada | Enlace portador temporal | Descarga | 3600 s (`shipment-document-queries.ts:50`) | Cualquiera con el enlace durante su vigencia |

Hallazgos:

- **CORRECTO — minimización:** la RPC devuelve sólo id, código de compra, folio, fecha y cajas (0406:8–14, 20); el contrato rechaza firmas con tenant/client/email/rows/amount (test 0406:70–72) y filas con contacto o montos (93–99). Norma: SC 332/2001, finalidad y calidad (`marco-legal-ve.md:74`); PIPL art. 6, mínimo alcance (`marco-legal-cn-pipl.md:46–48`).
- **CORRECTO — identidad y tenant:** derivados de `auth.uid()` con vínculo activo, cliente vivo y tenant coherente (0406:21–39); contrato nuevo con el mismo Shipping Mark en dos tenants PASÓ. Norma: SC 332/2001, seguridad y confidencialidad (`marco-legal-ve.md:77`).
- **CORRECTO (código) — firma acotada:** sólo paths releídos por RLS y admin sólo si hay documentos (`signed-portal-documents.ts:21–32`). No verificado contra una base real con Storage.
- **ENCONTRADO (main, se corrige al aplicar 0406 e integrar):** lectura service_role de packing lists filtrada sólo por Shipping Mark (main `packing-list-queries.ts:234–243`) aunque `clients` sólo es único por tenant (0006:23). Puede listar folio, fecha, cajas y código de compra de otro cliente con el mismo Shipping Mark en otro tenant. Si hoy existen colisiones en producción: NO VERIFICABLE (no se leyeron filas). Arreglo: esta PR con 0406 aplicada. Norma: SC 332/2001, seguridad y confidencialidad.
- **ENCONTRADO (preexistente, sin cambio en L06):** la URL firmada es un enlace portador de 1 h que se abre en pestaña nueva (`DocumentsClient.tsx:181–190`); quien la reciba reenviada puede descargar sin sesión durante esa hora. Arreglo concreto, fuera de alcance: firmar al hacer clic mediante un Route Handler que revalide la sesión y use un TTL corto (p. ej. 60 s). Norma: SC 332/2001, seguridad y confidencialidad.
- **NO VERIFICABLE:** retención real de archivos y filas (promesa de 7 años en `page.tsx:135` sin mecanismo en este alcance); respaldos y registros de Storage/CDN que puedan conservar URLs firmadas; base de licitud y aviso a proveedores en China (PIPL) y a quien firma un POD; contrato con el proveedor de hosting/Storage; comportamiento en producción mientras 0406 no esté aplicada.

Verificación contra datos reales: no ejecutada (sin autorización para producción); la lógica se verificó en Postgres efímero con datos sintéticos. Esta revisión no es asesoría legal; lo marcado NO VERIFICABLE requiere revisión humana y, cuando corresponda, de un abogado.

## COMMITS

- `1b655967010c64542532d9fb4e1beebd62950bcf`: SDD-0342 — migración/contratos 0406, spec con nota, adopción focal, firmador, tests, baseline, declaración e índice.
- Commit que contiene este documento: cierre durable del handoff; hash final en la PR.

## PR / BRANCH

[PR #77 en borrador](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/77), título «[NO FUSIONAR ANTES DE APLICAR 0406] feat(studio): SDD-0342 — importar L06 documentos Portal por principal (migrate-first)», base `main`, rama `codex/c-l06-portal-documentos`, worktree indicado arriba. Rama publicada explícitamente a sí misma; sin merge ni aplicación de migraciones.

## PENDIENTES DE ESTA TAREA

- **Antes de fusionar:** aplicar `0406_portal_packing_lists_por_principal` en producción con OK nominal de Sam y `docs/runbooks/aplicar-migraciones-prod.md` (de a una, name exacto) y verificar catálogo, ACL y una llamada como `authenticated`. Después, en esta rama: retirar la espera del baseline y la declaración `l06-…-pending-rpc`, actualizar la nota de 0342 y revalidar (patrón del commit `b49f1c0b` de L16).
- **Depende de la corrección del harness en la tarea `c-fix-pending-symbols-utf16` (PR por crear); tras integrarse, merge de origin/main y revalidar el gate.** La declaración veraz (`:231`) no necesita cambios; si 0406 se aplica antes, la declaración se retira y el gate deja de evaluarla.
- CI alojado del SHA publicado, revisión del Director y `/ui-check`.
- E2E autenticado y ledger real quedan sin validar; no son autorización para copiar credenciales ni aplicar migraciones.

## FUERA DE ALCANCE DETECTADO

- **Defecto de `scripts/check-pending-migration-symbols.mjs` (SDD-0450):** máscara por code points indexada en UTF-16 (líneas 106 y 253); detalle y repro en VALIDACIÓN. Lo corrige la tarea `c-fix-pending-symbols-utf16` que asigna el Director; arreglo propuesto: `texto.split("")` en ambos sitios más un test con un astral antes del sitio. Otros lotes con astrales antes de su sitio fallarían igual.
- Allowlist original de 0342 no importada: `scripts/__tests__/portal-service-role-boundary.test.mjs` (el criterio «6 rutas / 12 construcciones» no es verificable en main) y los documentos de auditoría/handoff de #21.
- Premisa del encargo: main no evolucionó `packing-list-queries.ts` ni `documentos/page.tsx` (blobs = merge-base); no hubo nada de SDD-0449/RBAC que conservar en ellos.
- URL firmada portadora de 1 h (preexistente; ver revisión de datos).
- Avisos heredados de pnpm 12 sobre `pnpm.onlyBuiltDependencies`.

## HANDOFF AL DIRECTOR

- Título de la PR con «[NO FUSIONAR ANTES DE APLICAR 0406]». 0406 no tiene dependencias SQL C y es aditiva (función + ACL): el código de main sigue funcionando tras aplicarla, así que el orden seguro es aplicar 0406 → verificar → retirar espera/declaración en la rama → fusionar → desplegar.
- Gate `pending-migration-symbols`: depende de `c-fix-pending-symbols-utf16`; tras integrarse, merge de origin/main en esta rama y revalidar. No bloquea este cierre.
- Conflictos esperables sólo en baseline, índice y declaraciones con L05/L02/L04 y #69–#74: resolver por unión (baseline e índice tienen driver `dtd-generated-records`; las declaraciones no).
- Revisar la PR sobre los SHA publicados y la base `3c610701`. No se tocó producción, no se aplicó 0406, no se fusionó ni se desplegó.
- Ownership: liberado al cierre con `node scripts/harness-worktree.mjs release --owner c-l06-worker-20260911-claude` después de la última escritura y publicación. Sin subagentes ni contenedores propios activos. Se conservan worktree y rama.
