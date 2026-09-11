# L01 — Marca del Portal por principal (RPC 0401 / SDD-0336)

Fecha: 2026-09-11. Task ID: `c-l01-portal-marca`.
Owner / sesión escritora: `c-l01-worker-20260911-claude`. Estado: lista-para-revision en PR borrador; **MIGRATE-FIRST: no fusionar antes de aplicar y verificar 0401 en producción**.
Repositorio: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO`.
Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/c-l01-portal-marca`.
Rama: `codex/c-l01-portal-marca`. Base: `3c6107012f754953323202a7386b3e7811593814` (origin/main al crear). Al cierre, origin/main había avanzado a `5894538d0c99dd597bfff136b6283c364671b19c` (PR #71: registro de 0425/0427); se fusionó en esta rama sin rebase, con el merge `282c63919d80b95c6d0884a65200bcc76d648826`.
Origen de solo lectura: `ea9952a47f4adf14c48c91e6d0147597beb94aa7`, PR #21.
Permisos del encargo: commits selectivos, push de la rama a sí misma y PR draft. NO merge, NO aplicar 0401, NO leer producción, NO deploy.

## OBJETIVO ORIGINAL

Preparar L01 del bloque C como PR draft contra main: la marca white-label del Portal se resuelve con la RPC 0401 `get_portal_brand()`, ligada al principal autenticado, en el comprobante de factura y en las etiquetas de compra (SDD-0336).

## COMPLETADO

- **Idénticos por blob al origen:** migración 0401, su contrato, `brand-resolve.ts` y el test de origen (tabla en VALIDACIÓN). El `brand-resolve.ts` de #21 es el de main (`fb34e571`) más `resolveBrandForPortal` al final. `resolveBrandForClient` queda intacta porque la sigue usando `app/p/[token]/page.tsx:44`, así que la adaptación mínima coincide con el origen.
- **Spec 0336** exacta más una nota fechada 2026-09-11 con la forma de 0363: pendiente en baseline, MIGRATE-FIRST, OK nominal de Sam más runbook, y corte focal. Sin la nota coincide byte a byte con `4b6696c1` (2858 B). Se conservan `status: done` y todo el frontmatter; no se reservó número (0336 y 0401 no existían en main).
- **Comprobante:** el resultado es byte a byte el blob de #21 (`20e894c4`), porque main→#21 sólo difiere en los dos hunks de marca.
- **Etiquetas:** sólo los dos hunks de marca (import y llamada). Se conservan `getLabelPresentation` con `presentation={presentation.settings}`, `listPredeclaredBoxes`, `getPortalClient`, las llamadas sin `tenantId` y el firmado vigente. No se importan los hunks de principal y tenant (L18/L22), el firmador `listSignedPrealertaDocuments` ni la retirada de `presentation`.
- **Test nuevo** `lib/studio/aliados/__tests__/brand-resolve-portal-rpc.test.ts`, 5 casos: fila como objeto; RPC ausente (PGRST202); permiso denegado (42501); transporte caído; error acompañado de fila. Todos comprueban que no hay lectura directa de tablas ni fallback.
- **Baseline:** sólo la espera `0401_portal_brand_por_principal` (bloque C L01 / SDD-0336; MIGRATE-FIRST; OK nominal de Sam y runbook; name exacto). Sin ella el archivo vuelve al blob base `3c5a67d4`; `cutoff: 238` y las esperas 0409/0418/0419/0430 quedan intactas.
- **Declaración** `l01-portal-brand-pending-rpc` con el patrón de L16/L06: sitio real `lib/studio/aliados/brand-resolve.ts:66` y cuatro evidencias ancladas. Gate: 0 ROJO · 1 AMARILLO.
- **Índice** regenerado con `corepack pnpm docs:index` (416 specs).

## DIFF FOCAL POR ARCHIVO

`lib/studio/aliados/brand-resolve.ts` (main `fb34e571` → `a7a0e6eb`, +18 líneas):

| main | HEAD | Motivo |
|---|---|---|
| 1–53 | 1–53, sin cambios | `resolveBrandForClient` intacta; su consumidor restante es el enlace del proveedor `app/p/[token]/page.tsx:44`. |
| — | 55–71 `resolveBrandForPortal(db)` | `db.rpc("get_portal_brand")` sin argumentos (66); error → `DTD_BRAND` (67); fila como arreglo u objeto (69); `resolveBrand` (70). |

`app/portal/(app)/facturas/[code]/comprobante/page.tsx` (main `3c6adc98` → `20e894c4`, igual a #21):

| main | HEAD | Motivo |
|---|---|---|
| 34 `import { createAdminClient }` y 35 `import { resolveBrandForClient }` | 34 `import { resolveBrandForPortal }` | El único uso de admin era la marca (main 80): la página deja de construir service_role. |
| 77–82 comentario SDD-0255 y `resolveBrandForClient(createAdminClient(), { markbox: client.markbox })` | 76–78 comentario SDD-0336 y `resolveBrandForPortal(supabase)` | La marca sale de la sesión del Portal; ya no se pasa el Shipping Mark. |

`app/portal/(app)/compras/[code]/etiquetas/page.tsx` (main `98e663fe` → `73a7cc87`; distinto del `c8273288` de #21):

| main | HEAD | Motivo |
|---|---|---|
| 6 `import { resolveBrandForClient }` | 6 `import { resolveBrandForPortal }` | `createAdminClient` (5) se conserva: lo usan la presentación (62) y el firmado (106). |
| 59–66 comentario SDD-0255 y `resolveBrandForClient(createAdminClient(), { markbox })` | 59–61 comentario SDD-0336 y `resolveBrandForPortal(supabase)` | Texto del comentario tomado de #21. |
| 67 `getLabelPresentation(createAdminClient(), prealerta.tenant_id)` | 62, idéntica | Presentación que main incorporó después de #21; aceptar #21 íntegra la eliminaba. |
| 78 `listPredeclaredBoxes(supabase, prealerta.id)` | 73, idéntica | Consumidor señalado por L20. |
| 139 `presentation={presentation.settings}` | 134, idéntica | — |

## RESUMEN JSX PARA /ui-check

- Ningún hunk toca JSX. Desde el primer `return (` hasta el final del archivo, las dos páginas son byte a byte iguales a main: comprobante main 88 → HEAD 84 (hash `e81494fa`), etiquetas main 135 → HEAD 130 (hash `37f8e545`).
- Sólo cambia el valor de `brand`, con el mismo tipo `BrandContext`. El comprobante lo consume en logo o nombre (HEAD 133–142), tagline (155), emisor (215–223), nota (395), pie (438–441) y tagline del pie (451). Etiquetas lo pasa a `LabelsClient` (133) junto con `presentation` (134).
- Con 0401 aplicada, el `BrandContext` es el mismo que en main: la RPC devuelve las mismas ocho columnas de `BRAND_COLUMNS` (`brand-resolve.ts:17–19`) y pasa por el mismo `resolveBrand`. Un cliente directo ve DTD en ambos casos.

## COMPORTAMIENTO ANTE FALLO

| Situación | main hoy (`3c610701`) | Código adoptado (`12ffba6a`) |
|---|---|---|
| RPC 0401 ausente (PGRST202) | No aplica: main no llama la RPC. Lee `clients` y `aliados` con service_role por Shipping Mark (main `brand-resolve.ts:41–45`, comprobante main 80, etiquetas main 64). El cliente de un aliado ve su marca. | El error devuelve DTD (`brand-resolve.ts:66–67`). El cliente de un aliado ve DTD como emisor, pie y tagline del comprobante y en sus etiquetas: **peor que main**. Por eso la PR es migrate-first y el gate lo declara AMARILLO. Un cliente directo ve lo mismo que hoy (DTD). |
| Error de la lectura (red, permiso, PostgREST) | Error → DTD (main `brand-resolve.ts:47`). | Error → DTD (67). postgrest-js 2.106.1 convierte un fallo de fetch en `{ error }`, sin lanzar (`dist/index.cjs:293–325`). Igual que main. |
| Sin fila (cliente directo, vínculo revocado, cliente eliminado) | `!data?.aliado_id` → DTD (47). | `resolveBrand(null)` → DTD (`brand-context.ts:112`). Contrato y prueba de orden: 0 filas. Igual que main. |
| Falta la URL o `SUPABASE_SERVICE_ROLE_KEY` (`createAdminClient` lanza, `lib/db/admin.ts:22–31`) | El comprobante lanza al construir admin para la marca (main 80); etiquetas lanza en la marca (main 64). | El comprobante ya no usa admin y renderiza. Etiquetas sigue lanzando en `getLabelPresentation(createAdminClient(), …)` (62), como main en su línea 67. No empeora y mejora el comprobante. |
| Mismo Shipping Mark en dos tenants (`unique (tenant_id, markbox)`, `0006_clients.sql:23`) | Admin filtra sólo por markbox (main `brand-resolve.ts:45`); con dos filas `maybeSingle()` falla → DTD (47): el cliente de aliado pierde su marca. | La RPC deriva el cliente de `auth.uid()` (0401:43–44) y `client_users` tiene `unique (auth_user_id)` (`0080_portal_cliente.sql:30`): una fila, marca correcta. Mejora. |

Conclusión: el único modo de fallo nuevo es la RPC ausente para clientes de aliado. No expone datos (cae a la marca de la casa, completa y sin fallback admin), pero degrada el white-label, y `lib/shared/brand-context.ts:4–7` documenta que eso no es cosmético: hay un caso legal donde un membrete de la casa debilitó la defensa de «aliado independiente». Ese modo queda fuera de producción con el orden migrate-first. 0401 es aditiva (función + ACL) y main no la llama, así que aplicarla antes de fusionar no cambia el comportamiento vigente. El comentario fechado de `brand-context.ts:20–21` («445 de 445 con `aliado_id` NULL») sugiere que hoy no habría clientes de aliado afectados, pero es NO VERIFICABLE sin leer producción; el orden migrate-first se mantiene igual.

## VALIDACIÓN

Árbol de producto: commit `12ffba6a916ae1cd1b0f47a418e49d2d9d4b2cf8` sobre `3c610701`. Node 24.20.0, Corepack 0.35.0, pnpm 12.3.4, Docker 29.7.2. Sin credenciales copiadas ni `.env` operativo. Recibos fuera de Git en `C:\Users\AKXGEN~1\AppData\Local\Temp\claude\C--Users-AKX-generator-Desktop-Developer-DTDCARGO\454d97be-b1e0-4fc9-97e9-c6bb621ba84c\scratchpad\c-l01-portal-marca\`: `install.log`, `docs-sdd.log`, `pending-symbols-1-sin-declaracion.log`, `pending-symbols-2-con-declaracion.log`, `check-pending-migration-symbols.utf16-a6b2081b.mjs` y `pending-symbols-3-checker-utf16.log`, `vitest-focal.log`, `typecheck.log`, `eslint-focal.log`, `sql-0401-focal.log`, `schema-rebuild.log`, `order-check.mjs`, `order-check.sql` y `order-check.log`, `diff-focal-tracked.patch`, `verify.log`, `verify.exit` y `verify.meta`.

| Comprobación | Estado y evidencia |
|---|---|
| `guard` / `claim` / `guard --owner` | PASÓ al inicio, antes del commit y antes del push. |
| `corepack pnpm install --frozen-lockfile` | PASÓ, 813 paquetes (33,1 s); lockfile intacto. Aviso heredado de pnpm 12 sobre `pnpm.onlyBuiltDependencies`. |
| Blobs (`git cat-file` + `git hash-object`, con y sin filtros) | PASÓ: tabla abajo. |
| Spec sin la nota / baseline sin 0401 | PASÓ: `4b6696c1` y `3c5a67d4` exactos. |
| `node scripts/install-merge-drivers.mjs --check` | PASÓ. |
| `corepack pnpm sdd:check` | PASÓ: sin números repetidos; conserva el choque histórico declarado de las **migraciones** 0336 (`0336_pod_closes_shipment` · `0336_rate_ddp_850_septiembre_2026`), ajeno a la spec 0336. 416 specs, 421 migraciones. |
| `corepack pnpm docs:index` / `docs:check` | PASÓ: 416 specs sincronizadas. |
| `node scripts/check-schema-rebuild.mjs` | PASÓ: inventario 421, 403 desde cero, 18 sólo-ledger sin cambio de esquema, aislamiento multi-tenant (219 tablas, 2 tenants). Contenedor retirado. |
| Contrato 0401 focal (contenedor propio `dtd_l01sql_277222593`) | PASÓ en PostgreSQL 17.11: ACL, SECURITY DEFINER con `search_path` vacío, firma sin internos, marca propia, otro tenant, revocado, directo y eliminado; `portal_brand_0401_fixture_rolled_back = t`. Contenedor retirado. |
| Orden tipo producción (`order-check.mjs`, fuera del repo) | PASÓ: 398 migraciones no pendientes hasta 0449 y 0401 al final. Catálogo `prosecdef = t`, `search_path=""`, sin argumentos; EXECUTE `authenticated = t`, `anon`/`service_role`/PUBLIC `= f`. Con datos sintéticos: aliado activo de T1 y de T2 reciben sólo su marca (ocho campos, sin tarifa, acuerdo ni ids); directo, revocado, sin vínculo y eliminado reciben 0 filas; `anon` y `service_role` reciben 42501. ROLLBACK verificado; contenedor `dtd_l01order_774d7da7` retirado. |
| `node scripts/check-pending-migration-symbols.mjs` | PASÓ: 1 ROJO sin declaración (`brand-resolve.ts:66`) → 0 ROJO · 1 AMARILLO declarado. El sitio reportado coincide con el real: `brand-resolve.ts` no tiene caracteres fuera del BMP. El checker corregido de `c-fix-pending-symbols-utf16` (`a6b2081b`, extraído en solo lectura fuera del repo) da el mismo resultado y el mismo sitio. |
| Vitest focal (8 archivos) | PASÓ: 87 tests. Test de origen (3), test nuevo (5) y consumidores de marca existentes: `white-label`, `supplier-flow`, `comprobante`, `payment-reports`, `claim-payment-governance`, `aliado-types`. |
| `corepack pnpm typecheck` / ESLint focal (5 archivos) | PASÓ / PASÓ. |
| `corepack pnpm verify` | **FALLÓ, exit 1**, sobre `12ffba6a` (06:07:28 → 06:39:14 −04:00). De 17 pasos, 15 PASÓ; `e2e` FALLÓ por configuración ausente y `migrations-applied` quedó omitido. Veredicto literal: `verify: 1 fallo(s) → e2e CIERRE ADEMÁS INCOMPLETO — CRÍTICOS SIN MEDIR: migrations-applied.` No se absuelve ni se presenta como verde. El vigilante dio FIN, no COLGADO: no hizo falta `taskkill` ni se detuvo ningún PID. |
| `git diff --check` y allowlist | PASÓ: 11 archivos de producto más este handoff; nada fuera del alcance; sin espacios finales; todos terminan en salto de línea. |
| `/ui-check` | NO EJECUTADO: lo corre el Director. JSX idéntico (ver resumen). |
| E2E autenticado, `migrations-applied`, producción | NO DISPONIBLE / NO EJECUTADO: sin credenciales y fuera de la autorización. |

Detalle del gate canónico (`verify.log`, 17 pasos):

| Paso | Estado y evidencia |
|---|---|
| harness | PASÓ, 18 tests. |
| lint | PASÓ, 0 errores y 8 advertencias en archivos intactos: `NewPurchaseWizard.test.tsx` (4) y `PurchaseStepDetalle.test.tsx` (2) de compras Portal; `KommoBoardView.tsx` y `KommoClient.tsx` (1 cada uno). |
| rsc-boundary | PASÓ, 1597 módulos escaneados. |
| typecheck | PASÓ. |
| edge-functions | PASÓ, 4 funciones compilan con Deno. |
| test | PASÓ, 6692 tests en 528 archivos. |
| docs:check | PASÓ, 416 specs sincronizadas. |
| numbering | PASÓ, 416 specs · 421 migraciones; conserva las colisiones históricas declaradas. |
| feature-constants | PASÓ, 5 banderas coinciden. |
| components:check | PASÓ. |
| governance:check | PASÓ. |
| migrations-applied | NO DISPONIBLE: sin `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`; salida SKIP 3. No se midió el ledger real. |
| pending-migration-symbols | PASÓ con 0 ROJO y 1 AMARILLO declarado, sin presentar la RPC como aplicada. |
| sql-tests | PASÓ, 163 contratos (incluido 0401), con rollback. |
| schema-rebuild | PASÓ: 403 migraciones desde cero, 18 sólo-ledger y aislamiento multi-tenant (219 tablas, 2 tenants). |
| e2e | NO DISPONIBLE como validación de acceso ni de Supabase: el runner se ejecutó y FALLÓ (exit 1). Primera pasada: 151 pasaron, 15 fallaron, 2 flaky y 18 omitidos (11,7 min). Reintento automático: 152 pasaron, los mismos 15 fallaron, 1 flaky y 18 omitidos (8,5 min). Los 15 fallos son `auth.spec.ts:21/91/98/105` y `global-search.spec.ts:22` en chromium, mobile-chrome y mobile-safari; el error aparece en `proxy.ts:67`, al crear el cliente Supabase sin URL ni clave. Flaky recuperados: `auth.spec.ts:74` (chromium, primera pasada) y `calculadora-semantic-colors.spec.ts:53` (mobile-chrome, ambas pasadas). Ningún spec del comprobante ni de etiquetas falló. Es el mismo patrón ambiental que L16 registró sobre main; no se persiguió la configuración ni se interrumpió el gate. |
| build | PASÓ: compilación de producción, con `/portal/facturas/[code]/comprobante` y `/portal/compras/[code]/etiquetas` generadas como rutas dinámicas. |

Revalidación tras el merge de origin/main (`282c6391`, recibo `post-merge.log`):

- `git diff 12ffba6a 282c6391` sólo contiene los dos archivos que trajo main: `.agents/handoffs/0425-0427-aplicacion-prod-20260911.md` y la nota de `docs/specs/0372-portal-delivery-addresses-tenant-boundary/spec.md`. El árbol de producto verificado no cambió.
- `git diff origin/main...HEAD` sigue siendo exactamente los 11 archivos de producto.
- PASARON `docs:index` (sin cambios en el índice), `docs:check` (416 specs), `sdd:check`, `governance:check` y `check-pending-migration-symbols` (0 ROJO · 1 AMARILLO).
- No se repitió el `verify` completo porque el merge no toca código, migraciones, tests ni configuración.

Identidad de blobs:

| Archivo | Blob | Bytes | Relación |
|---|---|---|---|
| `supabase/migrations/0401_portal_brand_por_principal.sql` | `6243fa5f3f64ab352ba511e57dc07128ebc7fe30` | 1765 | idéntico al origen |
| `supabase/tests/0401_portal_brand_por_principal.test.sql` | `b85c2933cb3897724840a7741ae6d26b35b538e9` | 6689 | idéntico al origen |
| `docs/specs/0336-marca-portal-por-principal/spec.md` | `fb7ca9452b366be0030b55525929ad65f2538416` | 3991 | origen `4b6696c1` (2858 B) más nota |
| `lib/studio/aliados/brand-resolve.ts` | `a7a0e6eb36e3b6dfa7ee9e65067c71b69123e28e` | 2834 | idéntico al origen |
| `lib/studio/aliados/__tests__/brand-resolve.test.ts` | `4812f33961dccc8c38604e767c0e6c185aa2bf67` | 1506 | idéntico al origen |
| `app/portal/(app)/facturas/[code]/comprobante/page.tsx` | `20e894c4606cbde2f2cd6f562ee250b5b9d33dea` | 21783 | igual a #21: sólo sus dos hunks de marca frente a main `3c6adc98` |
| `app/portal/(app)/compras/[code]/etiquetas/page.tsx` | `73a7cc87184ed9d7ceada62129d5ab74d82cc9eb` | 7859 | main `98e663fe` más dos hunks de marca |
| `lib/studio/aliados/__tests__/brand-resolve-portal-rpc.test.ts` | `31bf3f84cf8db87817b485346a25644729b477cd` | 2881 | nuevo |

## REVISIÓN FOCAL DE DATOS (`revisar-datos-ve`)

Resumen: 3 CORRECTO · 1 ENCONTRADO (preexistente, fuera de alcance) · 4 NO VERIFICABLE. El cambio no captura, mueve ni borra datos de la factura, así que la revisión es focal.

Inventario (sólo lo que toca este cambio):

| Campo | Qué es | Finalidad | Retención | Quién lo ve |
|---|---|---|---|---|
| `aliados.trade_name`, `brand_name` (0362:72, 78) | Nombre comercial del aliado | Emisor, pie y etiqueta white-label | NO VERIFICABLE | Clientes Portal del aliado vía RPC (0401:29–30); equipo del tenant (0362:146–149) |
| `aliados.support_email`, `support_whatsapp`, `support_website` (0362:82–84) | Contacto de soporte del aliado. Si el aliado es unipersonal, identifica a una persona natural (titular no usuario, punto 12) | Contacto impreso en comprobante y etiqueta | NO VERIFICABLE | Igual que la fila anterior (0401:33–35) |
| `aliados.brand_primary`, `brand_secondary`, `hide_dtd_brand` (0362:79–80, 85) | Colores y bandera | Pintar el documento | — | Igual (0401:31–32, 36) |
| `aliados.agreement_notes`, `billing_value`, `marked_by`, `tenant_id`, `client_id` (0362:64–66, 91–94) | Datos internos del acuerdo | Gestión comercial | NO VERIFICABLE | **No** salen por la RPC (0401:13–22) |
| `client_users.auth_user_id`/`status`, `clients.deleted_at`/`aliado_id` (0080:18–21; 0362:130) | Vínculo del principal | Derivar la identidad dentro de la RPC | — | No se devuelven |
| Datos de factura (`getMyInvoice`: código, cliente, montos, notas) | Factura del cliente | Comprobante | NO VERIFICABLE | Sin cambio en L01 |

Hallazgos:

- **CORRECTO — alcance del cambio:** el diff sólo toca la resolución de marca: comprobante 34 (import) y 76–78 (llamada); etiquetas 6 y 59–61. Las lecturas de factura y cliente siguen intactas (`getMyInvoice`/`getPortalClient`, comprobante 29 y 67–74) y todo el JSX desde la línea 84 es idéntico a main.
- **CORRECTO — minimización:** la RPC devuelve sólo los ocho campos públicos de marca (0401:13–22, 28–36). El contrato rechaza firmas con tenant, cliente, acuerdo o tarifa (test 0401:138–140) y respuestas con datos internos (165–168); la prueba de orden lo confirma sobre el esquema completo. Main leía los mismos ocho campos, pero con service_role (main `brand-resolve.ts:17–19, 41`). Norma: SC 332/2001, finalidad y calidad (`marco-legal-ve.md:74`); PIPL art. 6, mínimo alcance (`marco-legal-cn-pipl.md:46–47`).
- **CORRECTO — identidad y privilegio:** identidad derivada de `auth.uid()` con vínculo activo y cliente vivo (0401:37–44), sin parámetros; EXECUTE sólo `authenticated` (0401:52–55); un cliente por usuario (`0080_portal_cliente.sql:30`). El comprobante deja de construir service_role, que `lib/db/admin.ts:10` prohíbe en páginas. Norma: SC 332/2001, seguridad y confidencialidad (`marco-legal-ve.md:77`); PIPL art. 51 (`marco-legal-cn-pipl.md:188`).
- **ENCONTRADO (preexistente, fuera de alcance; SQL importado idéntico):** 0401 une el aliado sólo por `a.id = c.aliado_id` (0401:41–42). Ni la FK (0362:130) ni el trigger `clients_guard_markbox_aliado` (0362:284–327) exigen el mismo tenant. En la prueba de orden, un UPDATE cruzado fue aceptado y el cliente de T1 recibió la marca pública del aliado de T2. Sólo salen campos públicos de marca, pero pueden incluir el contacto de soporte de otro tenant. Arreglo concreto, en su propia tarea y con migración nueva: añadir `and a.tenant_id = c.tenant_id` en la RPC y un guard de tenant para `clients.aliado_id` (trigger o FK compuesta `(tenant_id, aliado_id)` → `aliados (tenant_id, id)`). Norma: SC 332/2001, seguridad y confidencialidad (`marco-legal-ve.md:77`).
- **NO VERIFICABLE:** comportamiento en producción mientras 0401 no esté aplicada; si hoy existen clientes con `aliado_id` o vínculos cruzados de tenant (no se leyó producción); si los contactos de soporte de los aliados son de personas naturales; retención y base de licitud de los datos del aliado.

Verificación contra datos reales: no ejecutada (sin autorización para producción). La lógica se verificó en Postgres efímero con datos sintéticos. Esta revisión no es asesoría legal; lo marcado NO VERIFICABLE requiere revisión humana y, cuando corresponda, de un abogado.

## GOBERNANZA

- `cumplimiento`: RBAC en la base, sin identidad recibida del cliente (0401:43–44, 52–55). ERR-01: un error degrada a la marca segura completa (`brand-resolve.ts:67`, `brand-context.ts:112`), sin documento a medio pintar.
- `no aplica`: cambio visual (JSX idéntico), captura de PII nueva, escritura, borrado, componentes nuevos o consumidores de `deprecated`, gates nuevos.
- `excepción`: de la allowlist de 0336 no se importan `scripts/__tests__/portal-service-role-boundary.test.mjs` (ausente en main; su criterio «10 rutas / 21 construcciones» no es verificable aquí) ni los documentos de auditoría y handoff de #21. Corte focal del plan asignado por el Director.
- `no conformidad`: ninguna nueva. Preexistente: etiquetas sigue construyendo service_role en una página (62 y 106), contra `lib/db/admin.ts:10`.

## COMMITS

- `12ffba6a916ae1cd1b0f47a418e49d2d9d4b2cf8`: SDD-0336 — migración y contrato 0401, spec con nota, adopción focal, tests, baseline, declaración e índice.
- `282c63919d80b95c6d0884a65200bcc76d648826`: merge de origin/main `5894538d` (PR #71: handoff de aplicación de 0425/0427 y nota de la spec 0372), sin conflictos ni cambios de producto.
- Commit que contiene este documento: cierre durable del handoff; hash final en la PR.

## PR / BRANCH

[PR #82 en borrador](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/82), título «[NO FUSIONAR ANTES DE APLICAR 0401] feat(studio): SDD-0336 — importar L01 marca Portal por principal (migrate-first)», base `main`, rama `codex/c-l01-portal-marca`, worktree indicado arriba. Rama publicada explícitamente a sí misma (`12ffba6a` al abrir la PR); sin merge ni aplicación de migraciones.

## PENDIENTES DE ESTA TAREA

- **Antes de fusionar:** aplicar `0401_portal_brand_por_principal` en producción con OK nominal de Sam y `docs/runbooks/aplicar-migraciones-prod.md` (de a una, name exacto) y verificar catálogo, ACL y una llamada como `authenticated`. Después, en esta rama: retirar la espera del baseline y la declaración `l01-portal-brand-pending-rpc`, actualizar la nota de 0336 (patrón del commit `b49f1c0b` de L16) y revalidar.
- CI alojado del SHA publicado, revisión del Director y `/ui-check`.
- E2E autenticado y ledger real quedan sin validar; no son autorización para copiar credenciales ni aplicar migraciones.

## FUERA DE ALCANCE DETECTADO

- **Coherencia de tenant aliado↔cliente:** 0401 (41–42) no exige `a.tenant_id = c.tenant_id`, y el esquema vigente acepta un `clients.aliado_id` de otro tenant (0362:130, 284–327). Demostrado en la prueba de orden (`order-check.log`, observación en `<stdin>:211` y `:221`). Detalle y arreglo propuesto en la revisión de datos.
- La RPC tampoco filtra aliados eliminados o suspendidos (`aliados.deleted_at`/`status`, 0362:73–74, 98). Es el mismo comportamiento que `resolveBrandForClient` en main (41–52), sin cambio en L01.
- `app/p/[token]/page.tsx:44` sigue usando `resolveBrandForClient(admin, { markbox })`: es el enlace del proveedor, sin sesión Portal, así que no es consumidor de la RPC.
- Etiquetas sigue construyendo service_role para `getLabelPresentation` (62) y para el firmado (106). Es preexistente; lo retoman L22 u otros lotes.
- El comentario de `brand-resolve.ts:28–32` («desde el portal hay que pasar el admin client») queda desfasado para el Portal autenticado. Se conserva por identidad de blob con el origen.
- El defecto UTF-16 del checker (tarea `c-fix-pending-symbols-utf16`) no afecta a L01, porque no hay astrales antes de `:66`. Los dos checkers coinciden.
- Avisos heredados de pnpm 12 sobre `pnpm.onlyBuiltDependencies`, sin cambio de configuración.
- Ocho advertencias de lint en archivos que esta PR no toca: `NewPurchaseWizard.test.tsx` (4), `PurchaseStepDetalle.test.tsx` (2), `KommoBoardView.tsx` (1) y `KommoClient.tsx` (1).
- E2E no está disponible en las rutas que requieren configuración de Supabase: 15 fallos ambientales conocidos (`proxy.ts:67`) que no se atribuyen a L01. Los flaky recuperados (`auth.spec.ts:74` y `calculadora-semantic-colors.spec.ts:53`) quedan en el recibo.

## HANDOFF AL DIRECTOR

- Título de la PR con «[NO FUSIONAR ANTES DE APLICAR 0401]». 0401 no tiene dependencias SQL C y es aditiva: tras aplicarla, main sigue igual. Orden seguro: aplicar 0401 → verificar → retirar espera y declaración en esta rama → fusionar → desplegar.
- L22 va después y comparte etiquetas: esta rama sólo cambia las líneas 6 y 59–61. L22 debe partir de main con L01 integrado y conservar `presentation` y `listPredeclaredBoxes`.
- Conflictos esperables sólo en baseline, índice y declaraciones con otros lotes (por ejemplo L06, #77): resolver por unión. Baseline e índice tienen el driver `dtd-generated-records`; en las declaraciones hay que unir a mano los elementos de `degradations`.
- Revisar la PR sobre los SHA publicados y la base `3c610701`. No se tocó producción, no se aplicó 0401, no se fusionó ni se desplegó.
- Ownership: se libera al cierre con `node scripts/harness-worktree.mjs release --owner c-l01-worker-20260911-claude`, después de la última escritura, commit y publicación. Sin subagentes. Los contenedores propios (`dtd_l01sql_*`, `dtd_l01order_*`, y los `dtd_rebuild_*`/`dtd_sqltest_*` de este worktree) quedaron retirados; no se tocaron el stack Supabase `dtd-pr28-auth-*` ni procesos de otras sesiones. Se conservan worktree y rama.
