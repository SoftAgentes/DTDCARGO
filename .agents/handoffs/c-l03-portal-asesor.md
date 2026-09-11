# L03 · Asesor del Portal por principal y tenant (RPC 0403)

Fecha: 2026-09-11. Task ID: `c-l03-portal-asesor`.
Owner / sesión escritora: `c-l03-worker-20260911-claude` (Worker Claude Code asignado por el Director). Estado de tarea: lista-para-revision en PR draft #83; **MIGRATE-FIRST**: no se fusiona antes de aplicar y verificar 0403 en producción.
Repositorio: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO` (checkout principal intacto).
Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/c-l03-portal-asesor`.
Rama: `codex/c-l03-portal-asesor`. Base real: `3c6107012f754953323202a7386b3e7811593814` (origin/main al crear el worktree). Main avanzó dos veces durante la tarea y se incorporó por merge, sin rebase:
- `7fb767f6`: trae `b7e8b484` (#71, registro de aplicación de 0425/0427; #79, SDD-0450, checker UTF-16). Sin conflictos.
- `94372af9`: trae `07d000970011ee12364e31124ebe4b301f064b40` (#69, L19, SDD-0385, 0431 pendiente). El driver `dtd-generated-records` unió baseline e índice.
Ninguno de los dos cambió las rutas de código del lote.

Origen de solo lectura: `ea9952a47f4adf14c48c91e6d0147597beb94aa7` (head de PR #21). Commit fuente de SDD-0338 en el origen: `121bfdc5892c917d5ae7263c1f7ec4223667de29`. Base común con main: `2a2e81bf554dbe7bd4f05170847e8f02e988d320`.
SDD: `docs/specs/0338-asesor-portal-por-principal/spec.md`, importada. No se reservó número: 0338 y 0403 no existían en main. Fuera de esta rama, sólo `codex/saneamiento-integral` (head de #21) contiene 0338/0403, con los mismos blobs: es la misma spec, no una colisión.

## OBJETIVO ORIGINAL

Preparar como PR draft contra main el lote L03 del bloque C: migración 0403, su contrato SQL y la spec 0338. Adoptar `getPortalAdvisor` vía RPC en la versión vigente de `lib/portal/portal-queries.ts` y las llamadas focales de Inicio y Soporte, con el test del origen y tests mínimos de RPC presente y ausente. Declarar `0403_portal_advisor_por_principal` pendiente de aplicar. La PR se integra sólo después de aplicar 0403 en producción.

## COMPLETADO

- Aislamiento: worktree creado con `harness-worktree start` desde origin/main `3c610701`. Guard y claim PASÓ; guard `--owner` y rama revalidados antes de cada commit y de cada merge.
- Importación exacta desde `ea9952a4`, comprobada con `git hash-object` sobre los archivos del worktree:

| Artefacto | Blob del origen = importado |
|---|---|
| `supabase/migrations/0403_portal_advisor_por_principal.sql` | `dc812ba645047a3e9712e5be4b30e44a2b445f5d` (1711 B) |
| `supabase/tests/0403_portal_advisor_por_principal.test.sql` | `1cfc133cc788d2eb1510ee9bfc3992c3a5a60f09` (6495 B) |
| `lib/portal/__tests__/portal-advisor-query.test.ts` | `c2cd7c9b8ee03e0bd3414f24152af2435ab83425` (1344 B) |
| `docs/specs/0338-asesor-portal-por-principal/spec.md` sin la nota | `28d10745f044f56d9c27c147068056b6f3e0cf29` (2489 B). Blob final con la nota: `1cca9ce46d91f36f227b4cdd3f009fb11ae170d7` (3470 B). |

- Los cuatro blobs son también los de `121bfdc5`: ningún commit posterior de #21 los tocó.
- Nota de importación fechada 2026-09-11 bajo el H1, con la forma de la de 0363. Menciona MIGRATE-FIRST, el corte focal y que la meta `service_role` de la aceptación no aplica: su test de frontera no existe en main. `status: done` y el frontmatter se conservan como estado histórico del origen. Al retirar exactamente la nota se recupera `28d10745`.
- Historial de main desde la base común: `portal-queries.ts` sólo cambió en `3f03569a` (SDD-0380, cotizaciones) y `dcf99a7f` (L18, principal). Ninguno tocó `getPortalAdvisor`: por AST es igual en `2a2e81bf` y en `3c610701`. Inicio y Soporte no cambiaron en main desde la base común. La Soporte de main (`ef6101c2`) es exactamente la preimagen del hunk de `121bfdc5`.
- Actualización con main en dos merges (`7fb767f6`, `94372af9`). Frente a `origin/main` `07d00097`, la rama difiere exactamente en las 11 rutas del lote más este handoff. Los archivos de código, SQL, spec y tests conservan los blobs de `419d7ec0`. Baseline e índice sólo suman la entrada y la fila del lote sobre lo de main.

### Adopción focal por ruta (líneas en `419d7ec0`, iguales en el árbol final salvo donde se indica)

| Ruta | Cambio | Evidencia |
|---|---|---|
| `lib/portal/portal-queries.ts` | `getPortalAdvisor` (JSDoc L131-141, función L142-158) toma el cuerpo del origen. Llama `db.rpc("get_portal_advisor")` sin argumentos (L145); con error devuelve null (L146); acepta fila en lista u objeto (L148); con nombre vacío devuelve null (L149-150); copia sólo cuatro campos (L152-157). | AST: 25 de 26 sentencias de nivel superior idénticas a main. La única distinta es `getPortalAdvisor`, idéntica, JSDoc incluido, a la de `ea9952a4` y `121bfdc5`. Principal de L18, cotizaciones, envíos, facturas, documentos, activación, completitud, KPIs y próximo arribo quedan intactos. |
| `app/portal/(app)/page.tsx` | Comentario y llamada del asesor (L120-123): `getPortalAdvisor(supabase).catch(() => null)` en vez de `getPortalAdvisor(createAdminClient(), client.id)`. | AST: 17 de 18 sentencias del componente idénticas; imports idénticos (`createAdminClient` sigue en uso en L64, L93, L105 y L183); `return` y JSX idénticos. El hunk queda separado de los de L02 (L23 y L60-66). |
| `app/portal/(app)/soporte/page.tsx` | Comentario del hilo (L87) y llamada (L100): `getPortalAdvisor(supabase)`. | Blob resultante `88ca9369`, el mismo de `121bfdc5`. AST: sólo cambian el `try` del asesor y el comentario del hilo. `admin` se conserva para evidencia, hilo, id de conversación y resúmenes; 5 raíces JSX idénticas. No adopta `support-private-context`. |
| `lib/portal/__tests__/portal-advisor-query.test.ts` | Test del origen, idéntico: 4 casos. | Ver tabla de blobs. |
| `lib/portal/__tests__/portal-advisor-query-rpc-states.test.ts` | Nuevo, 6 casos. RPC presente: sólo la RPC, sin argumentos ni lecturas de tablas, y sólo cuatro campos aunque la respuesta trajera ids; también fila como objeto. RPC ausente (PGRST202), sin EXECUTE (42501), respuesta vacía, y excepción del transporte que se propaga a los `catch` de las páginas. | Aceptación 7, sin tocar tests existentes. |
| `supabase/migrations-baseline.json` | Sólo la espera `0403_portal_advisor_por_principal`: L40 en `419d7ec0`; tras el merge con L19 el driver la ubica en L44, antes de la 0431. | Dice «bloque C L03 / SDD-0338», MIGRATE-FIRST, OK nominal de Sam, runbook y name exacto. Frente a cada main (`3c610701` y `07d00097`), sin la entrada nueva el JSON es igual; cutoff 238, `$doc` y las demás esperas, incluida 0431, intactos; texto de la entrada sin cambios. |
| `supabase/pending-migration-symbol-declarations.json` | Grupo `l03-portal-advisor-pending-rpc`: llamada en `portal-queries.ts:145`; evidencia en `portal-queries.ts:146`, `page.tsx:123`, `PortalAdvisorCard.tsx:64`, `soporte/page.tsx:100` y `:174`. | Conforme al `$doc` y al patrón de L16. ROJO pasa a AMARILLO declarado. |
| `docs/specs/README.md` | Regenerado con `corepack pnpm docs:index`: 416 specs en `419d7ec0`; 417 tras el merge con L19, unido por el driver. | Entra la fila 0338 y sale de la lista de huecos; `docs:check` sincronizado en ambos árboles. |

### Línea que reporta el checker

El checker vigente al empezar marcó ROJO en `lib/portal/portal-queries.ts:145`, que es la línea real de la llamada. Una copia fuera del repo del checker corregido por `c-fix-pending-symbols-utf16` (blob `5d0369f2`) dio el mismo resultado antes y después de la declaración. No hay discrepancia: los tres archivos de código no tienen caracteres fuera del BMP (unidades UTF-16 = code points), así que la declaración queda anclada al sitio real. Esa corrección entró en main durante la tarea (#79) y llegó a esta rama con el primer merge: el checker del árbol es ahora ese mismo blob `5d0369f2`, con 0 ROJO y 1 AMARILLO.

### Comportamiento ante fallo

| Caso | main hoy (`3c610701`) | Adoptado (`419d7ec0`) |
|---|---|---|
| Lectura | `getPortalAdvisor(admin, clientId)` con service_role: `clients` por id (L147-152), membresía activa en `user_tenants` (L159-166) y perfil (L168-172). | RPC con la sesión del cliente (L145). La base deriva la identidad de `auth.uid()` y exige vínculo activo (0403 L38-39), cliente vivo del mismo tenant (L28-31) y asesor activo en ese tenant (L32-35). |
| Error de PostgREST | `clients` con error devuelve null (L152); los fallos de membresía o perfil también terminan en null (L166, L178). Sin log. | `if (error) return null` (L146). Sin log. |
| Excepción | Inicio: `.catch(() => null)` (L123-125). Soporte: `try/catch` que deja null (L100-104). Sin log. | Igual: Inicio L123, Soporte L99-103. La función no traga excepciones; el test nuevo lo fija. |
| Sin asesor, asesor deshabilitado o sin nombre | null (L152, L166, L178). | Sin filas, null (L149-150). El contrato SQL lo prueba (L143-167). |
| Pantalla con null | Inicio: la tarjeta muestra «Equipo DTD Cargo» / «Atención al cliente» con WhatsApp y teléfono públicos (`PortalAdvisorCard.tsx:28-34`, 64, 68, 84). Soporte: «Tu equipo DTD Cargo» (L174-177) y «Otros canales» con el WhatsApp público (L314-317, L340). | Igual. |
| RPC 0403 ausente | No aplica: main no la llama. | PGRST202 en cada visita, así que null permanente. Todos los clientes pierden nombre, cargo, foto y enlace directo del asesor y ven el contacto público. La página no rompe ni inventa nombres. |
| service_role ausente o fallando | Inicio ya depende de service_role en otras lecturas; Soporte construye `admin` en L71. | El asesor deja de depender de service_role. |

Con 0403 aplicada no empeora respecto a main: mismos cuatro campos y mismas condiciones (asesor asignado, miembro activo del tenant, nombre no vacío), ahora exigidas en la base. Las condiciones extra de vínculo activo y cliente vivo ya las exigía el principal de L18 antes de llegar a la llamada (`page.tsx:44-45`, `soporte/page.tsx:60-61`). Sin 0403, sí empeora, y por eso es migrate-first. La migración es aditiva (función, comentario y ACL) y el código vigente de main no la llama: aplicarla primero no altera la operación actual. Main no registra errores en este camino y lo adoptado tampoco, así que no hay log que conservar ni log con datos personales.

### JSX, para `/ui-check`

No cambian JSX, clases, copy ni componentes. El `return` es idéntico en ambas páginas: Inicio 1 de 1 con 2 raíces JSX; Soporte 1 de 1 con 5 raíces JSX, incluidas `AsesorChatCard` y `OtrosCanalesCard`. Sólo cambia la fuente de `advisor`, con el mismo tipo `PortalAdvisor | null`; el fallback visual con null es el de main.

### Datos personales (`revisar-datos-ve`, focal)

Resumen: 5 CORRECTO, 0 ENCONTRADO, 5 NO VERIFICABLE. Titular: el asesor, empleado del tenant y usuario de Studio. Para el cliente del Portal es un tercero interno.

| Campo | Qué es | Finalidad | Base de licitud | Retención | Quién lo ve |
|---|---|---|---|---|---|
| `user_profiles.first_name`, `last_name` (0019 L64-65) | Nombre, concatenado en la RPC (0403 L23) | Identificar quién atiende al cliente (spec 0338) | NO VERIFICABLE | NO VERIFICABLE | El cliente del Portal con vínculo activo a un cliente de ese asesor, en Inicio y Soporte |
| `user_profiles.phone` (0019 L67) | Teléfono | Destino del WhatsApp directo. No se imprime como texto: va en el `href` wa.me (`portal-types.ts:145-149`, 179; `PortalAdvisorCard.tsx:32-33`; `soporte/page.tsx:317`) | NO VERIFICABLE | NO VERIFICABLE | Ese cliente, y WhatsApp si el cliente abre el enlace |
| `user_profiles.avatar_url` (0019 L66) | URL de la foto | Avatar de la tarjeta (`PortalAdvisorCard.tsx:41-48`) | NO VERIFICABLE | NO VERIFICABLE | Ese cliente, en el `src` de la imagen |
| `user_profiles.position_label` (0019 L68) | Cargo | Rol visible (`PortalAdvisorCard.tsx:68`; `soporte/page.tsx:175-177`) | NO VERIFICABLE | NO VERIFICABLE | Ese cliente |

- **CORRECTO · minimización.** La RPC devuelve sólo esos cuatro campos, sin ids ni tenant (0403 L11-16, L22-26). El contrato lo exige (test L107-111) y comprueba que `private_note` no sale (L125). La capa TS copia sólo cuatro claves (`portal-queries.ts:152-157`) y el test nuevo lo fija aunque la respuesta trajera ids.
- **CORRECTO · acceso por principal y tenant.** `auth.uid()` y vínculo activo (0403 L38-39), cliente vivo del mismo tenant (L28-31), asesor activo del mismo tenant (L32-35), EXECUTE sólo para `authenticated` (L48-51). El contrato corrió en Postgres efímero con datos ficticios y cubre otro tenant, vínculo revocado, asesor deshabilitado y cliente eliminado (L132-167). Además, 0151 L57-66 impide asignar un `advisor_id` de otro tenant.
- **CORRECTO · menos privilegio.** Inicio y Soporte dejan de leer `user_tenants`/`user_profiles` con service_role para el asesor (`page.tsx:123`, `soporte/page.tsx:100`).
- **CORRECTO · sin logs del asesor.** `getPortalAdvisor` no registra nada (`portal-queries.ts:142-158`), tampoco los `catch` de las páginas.
- **CORRECTO · sin ampliación.** Main ya mostraba los mismos cuatro campos al mismo cliente (main `portal-queries.ts:168-185`). L03 no crea un flujo de datos nuevo.
- **NO VERIFICABLE · base de licitud y aviso al empleado** de que su nombre, teléfono, foto y cargo se muestran a clientes. No está en el código; depende del contrato laboral o de la política interna.
- **NO VERIFICABLE · retención del perfil del asesor.** La RPC deja de mostrarlo al deshabilitar la membresía (0403 L35), pero la conservación de `user_profiles` no se evalúa en este lote.
- **NO VERIFICABLE · WhatsApp como tercero.** El enlace wa.me con el teléfono del asesor y el saludo con nombre y Shipping Mark del cliente (`PortalAdvisorCard.tsx:29-33`) es comportamiento previo de main, no de L03.
- **NO VERIFICABLE · PIPL.** El código no permite saber si hay tratamiento en China.
- **NO VERIFICABLE · producción.** No se leyó producción ni se ejecutó la RPC contra datos reales.

Esto no es asesoría legal. Conviene una segunda opinión de otro modelo sobre la misma superficie.

### Gobernanza proporcional

- **SGE-00.05, cumplimiento** (`sge-00.md:53`): permisos, tenant y minimización se aplican en la base, con prueba negativa de tenant ajeno, vínculo revocado, asesor deshabilitado, cliente eliminado y dato no necesario (`private_note`). Evidencia local y efímera.
- **SGE-00.12, cumplimiento:** sin merge a main, sin aplicar 0403 y sin leer producción; esas acciones quedan con autorización humana nominal.
- **ERR-01, cumplimiento del copy seguro** (`err-01.md:29-30`): el fallo degrada al contacto público sin mostrar error, SQL ni PII. La regla de observabilidad (L32) no aplica: la lectura es best-effort, tiene fallback diseñado y el fallo no es crítico. Un PGRST202 permanente sería silencioso, y eso se controla con migrate-first y con el AMARILLO que el gate imprime en cada corrida.
- **VIS-01/02, MOT-01, LOD-01, A11Y-01, CMP-01, FRM-01: no aplica.** JSX idéntico.
- **AUD-01/02, MP-01, BTN-01: no aplica.** Sin acciones ni escrituras.

## VALIDACIÓN

Producto validado: `419d7ec0b36eaa88dee30ea82aaeacb91a6f40fb` sobre la base `3c610701`; revalidación de lo afectado sobre los merges `7fb767f6` y `94372af9`. Node 24.20.0, Corepack 0.35.0, pnpm 12.3.4, Docker 29.7.2. Sin credenciales ni `.env` operativo. Recibos fuera de Git, en la carpeta de evidencia del Director (`…/scratchpad/c-l03-portal-asesor/`): `install.log`, `spec-note-identity.json`, `ast-compare.json`, `baseline-check*.json`, `diffs/`, `merge/`, `pending-symbols*.log`, `docs-sdd*.log`, `merge2-checks.log`, `schema-rebuild*.log`, `sql-focal-0403.log`, `sql-tests-merge2.log`, `vitest-focal*.log`, `vitest-advisor-verbose.log`, `typecheck*.log`, `eslint-focal.log`, `merge-drivers.log`, `harness-merge.log`, `verify.log`, `verify.exit` y `verify.meta`.

| Comprobación | Estado y evidencia |
|---|---|
| guard / claim / guard `--owner` y rama antes de cada commit | PASÓ |
| `corepack pnpm install --frozen-lockfile` | PASÓ en 49,1 s; `pnpm-lock.yaml` y `package.json` sin cambios (tampoco en main durante la tarea) |
| Blobs con `git hash-object` | PASÓ (tabla de arriba) |
| Spec sin la nota | PASÓ: igual a `28d10745` |
| AST de `portal-queries.ts` y de las dos páginas | PASÓ: sólo cambian `getPortalAdvisor` y las dos llamadas; JSX idéntico |
| `node scripts/install-merge-drivers.mjs --check` | PASÓ |
| `corepack pnpm sdd:check` | PASÓ: 416 specs / 421 migraciones; sólo colisiones históricas declaradas |
| `corepack pnpm docs:index` y `docs:check` | PASÓ: índice sincronizado, 416 specs |
| `node scripts/check-schema-rebuild.mjs` | PASÓ (06:06-06:07): inventario de 421; 403 migraciones desde cero, 18 sólo-ledger sin cambio de esquema, aislamiento multi-tenant en 219 tablas |
| `node scripts/check-pending-migration-symbols.mjs` | PASÓ: 0 ROJO, 1 AMARILLO declarado (`get_portal_advisor`). Antes de declarar: 1 ROJO en `portal-queries.ts:145`. El checker corregido UTF-16 da lo mismo |
| Contrato `0403_portal_advisor_por_principal.test.sql` en Postgres efímero propio | PASÓ: `psql` exit 0, cinco escenarios y rollback verificado (`portal_advisor_0403_fixture_rolled_back = t`); contenedor `dtd_l03_sqlfocal_7d55709a` retirado |
| Vitest `lib/portal/__tests__` | PASÓ: 30 archivos / 335 tests |
| Vitest de los tres archivos del asesor | PASÓ: 17/17 (7 existentes de `advisor.test.ts`, 4 del origen, 6 nuevos) |
| `corepack pnpm typecheck` | PASÓ |
| ESLint de las cinco rutas TS | PASÓ, 0 problemas |
| Baseline y declaraciones frente a la base | PASÓ: JSON válido, una sola clave nueva, cutoff 238 y `$doc` iguales |
| `git diff --check` y allowlist | PASÓ: 12 rutas exactas con el handoff; ninguna fuera de la allowlist |
| Combinación con L02 (#76, head `092ca77d`, home `9fe0b82d`) | PASÓ: `git merge-file` en ambos órdenes, 0 conflictos, resultado `7015d694` = home tras `121bfdc5` en #21. Ni #71, ni #79, ni #69 tocan la home |
| `corepack pnpm verify` | FALLÓ, exit 1, sobre `419d7ec0` (06:15:31-06:42:58). Ejecutó 16 de 17 pasos: 15 PASÓ, `e2e` FALLÓ por el entorno y `migrations-applied` quedó omitido. Veredicto literal: `verify: 1 fallo(s) → e2e CIERRE ADEMÁS INCOMPLETO — CRÍTICOS SIN MEDIR: migrations-applied.` El vigilante terminó en FIN, sin cuelgue. No se presenta como verde ni se reintentó a mano. |
| `/ui-check` | NO EJECUTADO: lo corre el Director; JSX idéntico |
| E2E autenticado y ledger real | NO DISPONIBLE: sin credenciales; fuera de la autorización |
| CI alojado de la PR | PASÓ sobre el producto: `Calidad continua` / `Calidad local sin secretos` sobre `419d7ec0` ([run 34589070680](https://github.com/hailuwaycom-sketch/DTDCARGO/actions/runs/34589070680)), 14 min 34 s. Preview de Vercel: pass. No cubre E2E autenticado ni Supabase. Las corridas de `7fb767f6` y `d8ce6492` quedaron en curso al publicar el SHA final. El CI del SHA final (segundo merge y este documento) se registra en la PR. |

Detalle de `verify`:

| Paso | Estado y evidencia |
|---|---|
| harness | PASÓ. |
| lint | PASÓ: 0 errores; 8 advertencias en 4 archivos intactos (`NewPurchaseWizard.test.tsx`, `PurchaseStepDetalle.test.tsx`, `KommoBoardView.tsx`, `KommoClient.tsx`). |
| rsc-boundary | PASÓ, 1597 módulos escaneados. |
| typecheck | PASÓ. |
| edge-functions | PASÓ, 4 funciones compilan. |
| test | PASÓ: 6694 tests en 528 archivos (348 s). |
| docs:check | PASÓ, 416 specs. |
| numbering | PASÓ: 416 specs / 421 migraciones; sólo colisiones históricas declaradas. |
| feature-constants | PASÓ, 5 banderas. |
| components:check | PASÓ. |
| governance:check | PASÓ. |
| migrations-applied | NO DISPONIBLE: sin `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` (SKIP). No se midió el ledger real; 0403 está pendiente por diseño. |
| pending-migration-symbols | PASÓ: 0 ROJO, 1 AMARILLO declarado. |
| sql-tests | PASÓ: 163 contratos, incluido `0403_portal_advisor_por_principal.test.sql`; rollback total. |
| schema-rebuild | PASÓ: 403 migraciones desde cero, 18 sólo-ledger y aislamiento en 219 tablas. |
| e2e | NO DISPONIBLE como validación de acceso/Supabase: el runner corrió y FALLÓ (exit 1) por el entorno, no por L03. Puerto propio 3425; 186 tests con 8 workers. Primera pasada: 152 PASÓ, 15 FALLÓ, 1 flaky (`auth.spec.ts:74` en chromium) y 18 omitidos (8,9 min). Reintento automático 1/1 de verify: 153 PASÓ, los mismos 15 FALLÓ y 18 omitidos (5,6 min). Los 15 son `auth.spec.ts:21/91/98/105` y `global-search.spec.ts:22` en chromium, mobile-chrome y mobile-safari; causa observada en `proxy.ts:67`: «Your project's URL and Key are required to create a Supabase client!». Sin cierre forzado de workers. Sin credenciales, el E2E no ejerce con sesión Inicio ni Soporte. |
| build | PASÓ: Next.js 16.2.11 (Turbopack), compilación en 23,2 s y 160/160 páginas estáticas; `tsconfig.json` restaurado. Árbol versionado intacto al terminar, sin contenedores propios y con el puerto 3425 libre. |

### Revalidación tras el primer merge (`7fb767f6`, #71 y #79)

| Comprobación | Estado y evidencia |
|---|---|
| guard `--owner` y rama antes del merge | PASÓ |
| `git merge-tree` previo y merge real | PASÓ: 0 conflictos |
| 11 rutas del lote frente a `419d7ec0` | PASÓ: sin cambios (`git diff` vacío) |
| `git diff --check` y rutas frente a `origin/main` | PASÓ: exactamente las 11 rutas del lote |
| `node scripts/check-pending-migration-symbols.mjs` (checker de main, blob `5d0369f2`) | PASÓ: 0 ROJO, 1 AMARILLO en `portal-queries.ts:145` |
| `corepack pnpm harness:test` | PASÓ: 33/33, incluido `pending-migration-symbols-utf16.node.mjs` de #79 |
| `corepack pnpm docs:check` y `sdd:check` | PASÓ: 416 specs / 421 migraciones |
| Vitest `lib/portal/__tests__` | PASÓ: 30 archivos / 335 tests |
| `corepack pnpm typecheck` | PASÓ |

### Revalidación tras el segundo merge (`94372af9`, #69 / L19)

| Comprobación | Estado y evidencia |
|---|---|
| Claim, guard `--owner` y rama antes del merge | PASÓ |
| `git merge-tree` y merge real con el driver `dtd-generated-records` | PASÓ: merge semántico de baseline e índice, 0 conflictos |
| Baseline frente a `origin/main` `07d00097` | PASÓ: una línea añadida (la espera 0403, texto sin cambios); cutoff 238, `$doc` y esperas 0409/0418/0419/0430/0431 intactos |
| `corepack pnpm docs:check` y `sdd:check` | PASÓ: 417 specs / 422 migraciones; sólo colisiones históricas declaradas |
| `node scripts/check-pending-migration-symbols.mjs` | PASÓ: 0 ROJO, 1 AMARILLO (`get_portal_advisor`); 0431 redefine una función existente y no crea símbolos pendientes |
| `node scripts/check-schema-rebuild.mjs` | PASÓ: inventario de 422; 404 migraciones desde cero, 18 sólo-ledger, aislamiento en 219 tablas |
| `node scripts/run-sql-tests.mjs` | PASÓ: 164 contratos, incluidos 0403 y 0431; rollback total; sin contenedores propios al terminar |
| `git diff --check` y rutas frente a `origin/main` | PASÓ: exactamente las 11 rutas del lote y este handoff |
| Vitest, typecheck, `harness:test`, verify y build sobre los merges | NO EJECUTADO de nuevo sobre `94372af9`. Main sólo trajo handoffs, specs, el checker con su test (ya revalidados tras el primer merge) y SQL/contrato de L19 (cubiertos arriba). No hubo código `app/`/`lib/`, dependencias ni configuración de build. El CI alojado corre sobre el SHA final publicado. |

## COMMITS

- `419d7ec0b36eaa88dee30ea82aaeacb91a6f40fb`: `feat(studio): SDD-0338 — importar L03 asesor Portal por principal (migrate-first)`. SQL, contrato, spec con nota, `getPortalAdvisor`, dos páginas, test del origen, test nuevo, baseline, declaración e índice. Es el producto que validaron verify y el CI.
- `7fb767f6f18242ab805909ba8898dec9d554b3e6`: merge de origin/main (`b7e8b484`, #71 y #79), sin conflictos.
- `d8ce6492eb56bcfac1bfbd6546e45197c46d1f77`: `chore(harness): cerrar handoff L03 asesor Portal`. Primera versión de cierre de este documento.
- `94372af93eab74876ce586dacbf27a88c778c46c`: merge de origin/main (`07d00097`, #69), con el driver en baseline e índice.
- Commit que contiene esta actualización del documento: `chore(harness): actualizar handoff L03 tras merge con L19`. Sólo documentación; el hash final queda en la PR.

## PR / BRANCH

[PR #83 en borrador](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/83): «[NO FUSIONAR ANTES DE APLICAR 0403] feat(studio): SDD-0338 — L03 asesor Portal por principal (migrate-first)». Base `main`; rama `codex/c-l03-portal-asesor`, publicada a sí misma con upstream propio. Worktree conservado en la ruta de arriba. Sin merge a main ni aplicación de migraciones.

## PENDIENTES DE ESTA TAREA

- Ninguno de implementación o preparación: SQL, contrato, spec, adopción focal, tests, baseline, declaración, índice, PR y handoff están entregados.
- Revisión del Director, CI del SHA final y `/ui-check`.
- E2E autenticado y ledger real siguen NO DISPONIBLES. No son permiso para copiar credenciales ni para aplicar la migración.

## FUERA DE ALCANCE DETECTADO

1. **Comentarios que quedan desactualizados fuera de la allowlist.** `lib/portal/__tests__/advisor.test.ts:7-8` dice que `getPortalAdvisor` «es admin-scopeada»; `app/portal/(app)/reclamos/actions.ts:73-74` justifica una lectura con admin «mismo criterio que getPortalAdvisor». Sólo comentarios, sin efecto funcional.
2. **SQL 0403, `limit 1` sin `order by` (L41).** Con varios vínculos activos, la RPC elegiría uno arbitrario. En estas vistas no ocurre: el principal de L18 usa `maybeSingle` (`portal-queries.ts:73`), devuelve null y la página sale antes. Se importa idéntico.
3. **Declaraciones sin merge driver.** L01, L02, L04, L05 y L06 también agregan grupos a `degradations`, así que al integrar habrá conflicto textual; se resuelve por unión. Baseline e índice sí tienen `dtd-generated-records`.
4. **GitHub no ejecuta `dtd-generated-records`.** Tras #69, la PR #83 se vio CONFLICTING aunque el merge local con el driver era limpio. Cada PR que entre a main tocando baseline o índice repetirá ese estado hasta rehacer el merge local.
5. **Allowlist histórica de 0338.** `scripts/__tests__/portal-service-role-boundary.test.mjs` y la meta «10 rutas / 18 construcciones» no existen en main; pertenecen al saneamiento de #21 y no se importan.
6. **Fallback silencioso.** Ni main ni el origen registran el fallo de esta lectura. Si el Director quiere la misma observabilidad que pidió en L02 (código o mensaje, sin ids ni datos del asesor), es un cambio acotado a `getPortalAdvisor` y su test.
7. **Heredados del entorno, sin cambios.** Aviso de pnpm 12 sobre `pnpm.onlyBuiltDependencies` ignorado; 8 advertencias de lint en los 4 archivos intactos citados; los 15 fallos E2E ambientales ya conocidos en L16/L18/L02 y un flaky recuperado. No son regresiones de L03.

## HANDOFF AL DIRECTOR

- **Orden migrate-first.** Revisar la PR #83 sobre el SHA final (main estaba en `07d00097` al publicar). Con OK nominal de Sam, aplicar 0403 individualmente con name `0403_portal_advisor_por_principal` según el runbook, y verificar el objeto y su ACL. Después, en esta rama: retirar la espera del baseline y la declaración `l03`, actualizar la nota de SDD-0338, revalidar y recién entonces fusionar.
- **Serialización con L02 (#76).** Comparten sólo `app/portal/(app)/page.tsx`, con hunks separados. La simulación en ambos órdenes da 0 conflictos y el blob `7015d694` de #21. Baseline e índice se resuelven con el driver; declaraciones, por unión. Quien entre segundo hace merge de origin/main y revalida.
- **Otros lotes.** Ninguna rama `codex/c-*` local o remota toca `portal-queries.ts`, Soporte ni los tests del asesor. Sin dependencia de 0402 ni de L05.
- **Incidente de ownership durante el cierre, resuelto.** Un commit del handoff falló porque faltaba su archivo de mensaje, y la cadena siguió: publicó sólo el merge `7fb767f6` y liberó el claim antes de tiempo. Se volvió a reclamar con el mismo owner (el claim se adquirió sin conflicto, así que no había claim ajeno), se completó `d8ce6492` y se volvió a liberar. Para el segundo merge se reclamó de nuevo antes de escribir.
- **Ownership.** Escritura finalizada con esta actualización. Tras su commit y push se libera el claim con `node scripts/harness-worktree.mjs release --owner c-l03-worker-20260911-claude`; el estado efectivo se verifica en los metadatos Git del worktree. Worktree y rama se conservan. No hay subagentes ni sesiones consumidoras delegadas.
