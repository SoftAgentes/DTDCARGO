# L05 · contexto privado del perfil Portal (0405 / SDD-0341)

Fecha: 2026-09-11. Estado de tarea: lista-para-revision (PR draft #75; MIGRATE-FIRST).
Owner / sesión escritora: `c-l05-worker-20260911-claude` (Worker Claude asignado por el Director).
Task ID: `c-l05-portal-perfil-privado`.
Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/c-l05-portal-perfil-privado`.
Rama: `codex/c-l05-portal-perfil-privado`. Base: `3c6107012f754953323202a7386b3e7811593814`
(origin/main; `git fetch origin` antes de publicar confirmó que main no avanzó).
Origen congelado de solo lectura: `ea9952a47f4adf14c48c91e6d0147597beb94aa7` (head de PR #21).
SDD: `docs/specs/0341-perfil-privado-portal-por-principal/spec.md` (importada; `status: done` histórico).

## OBJETIVO ORIGINAL

Preparar el lote L05 del bloque C como PR draft contra main: migración 0405, su contrato
SQL, la spec 0341, el helper `lib/portal/profile-private-context.ts` y su test, y la
adopción focal del helper en `app/portal/(app)/perfil/page.tsx` sobre la versión vigente
de main. Declarar `0405_portal_perfil_privado_por_principal` pendiente. La PR se integra
SOLO DESPUÉS de aplicar 0405 en producción (migrate-first, como L16).

## COMPLETADO

- Aislamiento: rama/base asignadas, árbol limpio al inicio, `guard` y `claim` PASÓ;
  guard `--owner` y rama revalidados antes de cada commit y del push.
- SQL 0405 y contrato importados idénticos por blob. Spec 0341 importada exacta con una
  nota de importación fechada bajo el título (forma de 0363): pendiente, migrate-first y
  alcance del corte. Al retirar sólo la nota, el blob vuelve a `37e399f8…`.
- Helper y test importados con **una línea adaptada cada uno** (justificación abajo).
- Adopción focal en `perfil/page.tsx`: imports y bloque de datos. El `return (...)` JSX
  es idéntico byte a byte a main. Se conservan el principal L18, el snapshot de
  solicitudes, el cupo 0445–0447 (`getPortalProfileEditQuota`, `quota=`), la compuerta de
  identidad `hasExistingPhoto` de SDD-0439, direcciones y el resto de lecturas.
- Baseline: sólo la espera nueva `0405_portal_perfil_privado_por_principal`, con el formato
  vigente. Comparación estructural: cutoff 238 y las esperas 0409/0418/0419/0430 intactas.
- Declaración del símbolo pendiente según su `$doc` y el patrón L16: anclada a la llamada y
  a los fragmentos de degradación. Resultado 0 ROJO · 1 AMARILLO; el check no se silenció.
- Índice regenerado con `corepack pnpm docs:index` (416 specs).
- Test nuevo de adopción de la página, con la RPC presente y ausente.
- Rama publicada a sí misma y PR draft #75 con título `[NO FUSIONAR ANTES DE APLICAR 0405] …`.

### Identidad por blob

| Artefacto | Blob origen | Blob final | Nota |
|---|---|---|---|
| `supabase/migrations/0405_portal_perfil_privado_por_principal.sql` | `06fb2e2c…` | `06fb2e2c…` | Idéntico, 1617 B. |
| `supabase/tests/0405_portal_perfil_privado_por_principal.test.sql` | `691833d2…` | `691833d2…` | Idéntico, 5435 B. |
| `docs/specs/0341-perfil-privado-portal-por-principal/spec.md` | `37e399f8…` | `3445e14d…` | Nota de 13 líneas; sin ella, blob `37e399f8…` byte a byte. |
| `lib/portal/profile-private-context.ts` | `776e4121…` | `da758998…` | Línea 55 adaptada. |
| `lib/portal/__tests__/profile-private-context.test.ts` | `ea90d0cc…` | `e00b9eca…` | Línea 51 adaptada. |

Recibo fuera de Git: `blob-identity.json` en la carpeta de evidencia (abajo).

### Adaptación mínima del origen, línea a línea

| Archivo:línea | Origen → final | Por qué |
|---|---|---|
| `lib/portal/profile-private-context.ts:55` | `createSignedUrl(cedulaPath, 3600)` → `createSignedUrl(cedulaPath, 60)` | Compila contra main, pero con 3600 s rompería el contrato vigente de SDD-0439: «URL firmada de 60 segundos» (`docs/specs/0439-portal-cliente-edicion-de-perfil/spec.md:119`), documentado en `CedulaPhotoRow.tsx:16` y aplicado en main (`page.tsx` base:121, commit `82fc49ff`). El origen se escribió sobre la base común `2a2e81bf`, que firmaba ambas fotos a 3600 s. El avatar sigue en 3600 s, igual que main. |
| `lib/portal/__tests__/profile-private-context.test.ts:51` | `3600,` → `60,` | Misma expectativa exacta para la cédula; no se debilita ninguna aserción. |

No hizo falta adaptar nada para compilar: `PHOTO_BUCKET`, `createAdminClient` y el alias
`server-only` existen en main. La salida del helper queda exactamente como la define la
spec 0341 (decisión 6: sólo códigos y URLs firmadas, nunca paths).

### Diff focal de `app/portal/(app)/perfil/page.tsx` (base → HEAD, 510 → 468 líneas)

- Imports: salen `createAdminClient` (`@/lib/db/admin`) y `PHOTO_BUCKET`; entra
  `getPortalPrivateProfileContext` en la línea 4, como en el manifiesto (`:4,72`). La
  llamada queda en la línea 81 (72 en #21) porque main conserva el import del cupo y el
  comentario del bloque.
- Bloque de datos (base 74–127 → HEAD 73–85): las dos lecturas `service_role`
  (`client_markbox_history` y `clients` + firma) se sustituyen por
  `const { previousMarkboxes: codigosAnteriores, avatarUrl, cedulaUrl } = await getPortalPrivateProfileContext(supabase);` (líneas 80–81).
- `const hasCedulaPhoto = completeness.hasPhoto;` (línea 85). En main salía de la misma
  lectura admin del path; el helper no expone paths, así que la existencia persistida se
  toma de la lectura de sesión que la página ya hacía (`getProfileCompleteness`,
  `lib/portal/portal-queries.ts:596-633`, misma columna `cedula_photo_path`) y que ya
  gobierna el aviso «1 pendiente». No añade lecturas.
- Nada más cambia: el snapshot de solicitudes con principal L18, el cupo, direcciones,
  tarifas y todo el JSX desde `return (` hasta EOF quedan idénticos (base línea 157 → HEAD
  115; recibo `jsx-identity.json`). Recibo del diff: `page-focal.diff`.

### Comportamiento con la RPC presente y ausente

| Elemento | main (antes) | L05 con 0405 | L05 sin 0405 (EMPTY) |
|---|---|---|---|
| Códigos anteriores | admin lee `client_markbox_history` por `client.id`, `retired_at desc` | RPC: mismos códigos y orden, filtrados además por tenant | ocultos (lista vacía, `page.tsx:179`) |
| Avatar | admin firma `avatar_path` 3600 s | helper firma el path devuelto 3600 s | iniciales y «Subir foto de perfil» (`AvatarEditor.tsx:44,78`) |
| Cédula «Ver» | admin firma 60 s | helper firma 60 s | sin enlace; «Vista temporal no disponible» (`CedulaPhotoRow.tsx:83`) |
| Existencia de la cédula | lectura admin del path | lectura de sesión, misma columna | igual: no depende de 0405 |
| Reemplazo de la cédula | bloqueado (`actions.ts:87-89`, trigger 0447) | igual | igual |
| `service_role` | dos construcciones y lecturas de tablas en la página | ninguna en la página; el helper sólo firma Storage si hay path | ninguna |
| Identidad, cupo, solicitudes, direcciones, principal | — | sin cambio | sin cambio |

Por eso migrate-first: sin 0405 no hay error visible ni crash, pero desaparecen fotos e
historial del perfil. La degradación está declarada en
`supabase/pending-migration-symbol-declarations.json` (id
`l05-portal-profile-private-context-pending-rpc`). El test
`app/portal/(app)/perfil/page.private-context.test.tsx` ejercita la página y el helper
reales en ambos caminos.

### Storage firmado con cliente admin: no hay escalada

- El helper no recibe ids ni paths (`profile-private-context.ts:30-33`); los paths salen de
  la RPC sin parámetros, que deriva cliente y tenant de `auth.uid()`, exige vínculo activo,
  tenant coherente y cliente vivo (`0405:14-24`) y filtra el historial por cliente y tenant
  (`0405:26-31`). `SECURITY DEFINER` con `search_path = ''` (`0405:11-12`); `EXECUTE` sólo
  `authenticated` (`0405:42-45`).
- El cliente elevado se construye sólo si hay al menos un path (`:44-49`) y sólo para
  `storage.from(PHOTO_BUCKET).createSignedUrl` (`:49-57`); no lee tablas. Ante fallo de
  Storage conserva los códigos y no emite URLs (`:63-65`).
- La página recibe códigos y URLs, nunca paths (`:58-62`). El test de página verifica que
  sólo se firman los dos paths devueltos, con 3600/60 s, y que el admin no toca tablas.
- La RPC usa `limit 1` sin orden (`0405:23`): con dos vínculos activos del mismo usuario
  elegiría uno. La página no llega a llamarla, porque el principal L18 rechaza la
  multiplicidad (`page.tsx:49-50`; `portal-profile-scope.test.ts:116-123`). No es escalada:
  ambos vínculos serían del mismo usuario autenticado.

### Revisión `revisar-datos-ve` (focal, sin asesoría legal)

Alcance: contexto privado del perfil, fotos en Storage firmado e historial de Shipping
Marks. La tarea no captura, escribe, borra ni cambia la conservación de datos (spec
0341:52); cambia por dónde se leen. Marcos: CRBV arts. 28 y 60 y SC 332/2001 (finalidad,
temporalidad); PIPL sólo por el acceso del equipo en China, que este cambio no altera.

Inventario:

| Dato | Qué es | Finalidad declarada | Base de licitud | Conservación | Quién lo ve |
|---|---|---|---|---|---|
| `clients.cedula_photo_path` + objeto `client-docs` | Foto de cédula/RIF (sensible; puede incluir rostro) | Verificar identidad antes de la primera carga (`CedulaPhotoRow.tsx:123-126`) | NO VERIFICABLE: el registro remite a una directiva propuesta (`registro-tratamiento.md:60`; `fotos-identidad-cliente-v1.md:4`) | Propuesta no activa (`registro-tratamiento.md:60`) | Titular vía URL de 60 s (`profile-private-context.ts:55`); equipo Studio |
| `clients.avatar_path` + objeto `client-docs` | Foto de perfil cosmética (puede mostrar rostro) | Avatar cosmético (`page.tsx:73-74`) | NO VERIFICABLE | El reemplazo borra el anterior best-effort (`avatar-actions.ts:79-82`) | Titular vía URL de 3600 s (`profile-private-context.ts:52`); equipo |
| `client_markbox_history.markbox` (+ `client_id`, `tenant_id`, `retired_at`) | Shipping Marks anteriores (identificador operativo) | Saber que cajas con el código viejo llegan igual (`page.tsx:78-79`) | NO VERIFICABLE | Finalidad no evidente en el código | Equipo del tenant por RLS (`0367:59-71`); titular por la RPC (`0405:26-31`) |
| URL firmada | Credencial temporal del objeto | Mostrar la foto al titular | Derivada | No persiste; 60 s / 3600 s | Quien tenga la URL durante el TTL; enlace de cédula con `rel="noopener noreferrer"` (`CedulaPhotoRow.tsx:76`) |

Resultados:

- CORRECTO — lectura por principal y tenant: la RPC sustituye las lecturas `service_role`
  de la página (`0405:14-31`); contrato con tenant B, vínculo revocado y cliente eliminado
  (`0405_…test.sql:92-135`), ejecutado en `sql-tests`.
- CORRECTO — minimización hacia la página: sólo códigos y URLs, nunca paths
  (`profile-private-context.ts:58-62`); elevación sólo para Storage y sólo con path (`:44-57`).
- CORRECTO — la URL de la cédula conserva 60 s (`:55`), igual que main y SDD-0439.
- CORRECTO — la compuerta de identidad no depende de la firma ni de la RPC (`page.tsx:85`);
  el reemplazo sigue bloqueado antes de subir (`actions.ts:87-89`) y en base (`0447:36-40`).
- ENCONTRADO (preexistente, fuera de alcance) — la foto de perfil (`clients.avatar_path`)
  y `client_markbox_history` no figuran en `docs/legal/privacidad/registro-tratamiento.md`
  (búsqueda de «avatar» y «markbox» sin coincidencias ahí). Arreglo: añadir filas con
  finalidad, opcionalidad y conservación.
- ENCONTRADO (excepción acotada heredada de SDD-0341) — `lib/db/admin.ts:10-11` pide no usar
  `service_role` desde páginas. L05 lo retira de la página, pero el helper que ésta invoca
  sigue construyéndolo para firmar (`profile-private-context.ts:49`), como fija la spec
  0341 (decisión 5).
- NO VERIFICABLE — base de licitud de ambas fotos; comportamiento real de 0405 en
  producción (no aplicada ni consultada); acceso desde China a `client-docs` vía Studio
  (sin cambio aquí); retención de URLs firmadas en logs de terceros.
- Paso 3 (verificación contra datos): sólo contrato SQL con datos ficticios en Postgres
  desechable; no se tocó producción.

Fuera de alcance, para abogado: base de licitud, redacción de política y contratos con
proveedores. Esta revisión no es asesoría legal; conviene una segunda opinión de otro modelo.

### Gobernanza

- Cumplimiento SGE-00 / aislamiento: identidad y tenant se fijan en la base (RPC) y en el
  principal L18; tests negativos de tenant, revocado y eliminado.
- Cumplimiento ERR-01: sin principal o ante fallo no se emiten URLs; la fila de cédula ya
  distingue fallo de firma de ausencia de documento (`ProfileEditControls.test.tsx:76-97`).
- No aplica captura, escritura, borrado ni cambio visual (spec 0341:52): el JSX es idéntico.
- Excepción documental: la nota rompe sólo el blob final de la spec; contenido fuente
  íntegro al retirarla. Excepción de adaptación: TTL de la cédula justificado arriba.

## VALIDACIÓN

Producto validado en el commit `8080168c` (árbol = base + corte L05), Node/pnpm de
Corepack. Evidencia fuera de Git en
`C:\Users\AKXGEN~1\AppData\Local\Temp\claude\C--Users-AKX-generator-Desktop-Developer-DTDCARGO\454d97be-b1e0-4fc9-97e9-c6bb621ba84c\scratchpad\c-l05-portal-perfil-privado\`
(`verify.log`, `blob-identity.json`, `page-focal.diff`, `jsx-identity.json`,
`schema-rebuild.log`, `vitest-*.log`, `pending-symbols-*.log`, `typecheck.log`, `eslint-focal.log`).

| Comprobación | Resultado |
|---|---|
| `harness-worktree guard` / `claim` / `guard --owner` | PASÓ |
| `corepack pnpm install --frozen-lockfile` | PASÓ (pnpm 12.3.4; lockfile intacto) |
| Blobs con `git hash-object` + comparación byte a byte | PASÓ (tabla de identidad) |
| `node scripts/install-merge-drivers.mjs --check` | PASÓ (`dtd-generated-records`) |
| `corepack pnpm sdd:check` | PASÓ; sólo colisiones históricas ya declaradas |
| `corepack pnpm docs:index` / `docs:check` | PASÓ, 416 specs |
| `node scripts/check-schema-rebuild.mjs` | PASÓ: 421 archivos, 403 migraciones desde cero (incluye 0405), 18 sólo-ledger, barrido multi-tenant de 219 tablas |
| `node scripts/check-pending-migration-symbols.mjs` | Antes de declarar: 1 ROJO (`profile-private-context.ts:33`), exit 1. Después: 0 ROJO · 1 AMARILLO, exit 0 |
| Vitest focal, primer intento en paralelo | FALLÓ por infraestructura: 7 de 8 workers no arrancaron (`Timeout waiting for worker to respond`) con `tsc` en paralelo; ninguna aserción falló y el único archivo ejecutado pasó |
| Vitest focal, 8 archivos en serie | PASÓ, 77 tests: helper, página nueva, `ProfileEditControls`, `PortalAddresses`, `address-actions.delete`, `portal-profile-scope`, `profile-edit-quota`, `account` |
| `corepack pnpm typecheck` | PASÓ |
| ESLint focal (4 archivos TS/TSX) | PASÓ, 0 avisos |
| `git diff --check` y allowlist | PASÓ: 11 rutas exactas (10 en el commit de producto + este handoff) |
| `corepack pnpm verify` | FALLÓ, exit 1: 16 de 17 pasos ejecutados, 15 PASÓ; e2e FALLÓ por configuración Supabase ausente; `migrations-applied` NO DISPONIBLE. Veredicto literal: `verify: 1 fallo(s) → e2e CIERRE ADEMÁS INCOMPLETO — CRÍTICOS SIN MEDIR: migrations-applied.` No se presenta como verde |
| `/ui-check` | NO EJECUTADO: no disponible para el Worker; lo corre el Director. JSX sin cambios (resumen abajo) |
| E2E autenticado / `migrations-applied` | NO DISPONIBLE: sin credenciales Supabase; no se copiaron secretos |
| CI alojado del SHA final | Se consulta tras publicar este documento; su resultado va en la PR #75 y en la respuesta al Director, para no crear un commit recursivo |

Detalle del gate canónico `corepack pnpm verify` sobre `8080168c` (log `verify.log`):

| Paso | Estado y evidencia |
|---|---|
| harness | PASÓ, 18/18 |
| lint | PASÓ: 0 errores; 8 avisos en 4 archivos ajenos intactos (`app/portal/(app)/compras/nueva/NewPurchaseWizard.test.tsx`, `app/portal/(app)/compras/nueva/PurchaseStepDetalle.test.tsx`, `app/studio/(app)/crm/_components/KommoBoardView.tsx`, `app/studio/(app)/crm/_components/KommoClient.tsx`) |
| rsc-boundary | PASÓ |
| typecheck | PASÓ |
| edge-functions | PASÓ, 4 funciones compilan |
| test | PASÓ, 528 archivos / 6691 tests |
| docs:check | PASÓ, 416 specs |
| numbering | PASÓ; colisiones históricas ya declaradas |
| feature-constants | PASÓ, 5 banderas |
| components:check | PASÓ |
| governance:check | PASÓ |
| migrations-applied | NO DISPONIBLE: SKIP sin `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`; no se consultó el ledger real |
| pending-migration-symbols | PASÓ con 0 ROJO · 1 AMARILLO declarado (0405) |
| sql-tests | PASÓ, 163 contratos con rollback total, incluido `0405_portal_perfil_privado_por_principal.test.sql` |
| schema-rebuild | PASÓ: 421 archivos, 403 desde cero, 18 sólo-ledger, aislamiento de 219 tablas |
| e2e | FALLÓ por entorno (exit 1), servidor de desarrollo propio en el puerto 3441. Los 15 casos son los ambientales conocidos de L16/L18: `auth.spec.ts:21/91/98/105` y `global-search.spec.ts:22` en chromium, mobile-chrome y mobile-safari, con `proxy.ts:67` creando Supabase sin URL/clave. Primera pasada: 151 PASÓ / 15 FALLÓ / 2 flaky / 18 omitidos (5,4 min). Reintento automático del propio gate (no manual): 153 PASÓ / 15 FALLÓ / 18 omitidos (9,4 min). Al cerrar, Playwright forzó `worker-45` tras 300000 ms. No se reintentó a mano ni se tocó configuración |
| build | PASÓ: build de producción completo; el runner restauró `tsconfig.json` (Next le inyectó `distDir`). Árbol limpio al terminar y sin contenedores efímeros propios |

## COMMITS

- `8080168c`: `feat(studio): SDD-0341 — importar L05 contexto privado del perfil Portal
  (migrate-first)`. SQL, contrato, spec con nota, helper y test, adopción en la página,
  test de adopción, baseline, declaración e índice. Es el producto validado por `verify`.
- Commit que contiene este documento: cierre durable del handoff; sólo documentación, sin
  cambios de producto. Su hash final queda en la PR.

## PR / BRANCH

[PR #75 en borrador](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/75), base `main`,
rama `codex/c-l05-portal-perfil-privado` publicada a sí misma con upstream propio. Título:
`[NO FUSIONAR ANTES DE APLICAR 0405] feat(studio): SDD-0341 — L05 contexto privado del
perfil Portal (migrate-first)`. Worktree conservado en la ruta indicada arriba.

## PENDIENTES DE ESTA TAREA

- Ninguno de implementación o preparación del lote. Quedan fuera del Worker: revisión del
  Director, `/ui-check` y la secuencia migrate-first autorizada por Sam.
- E2E autenticado y ledger productivo siguen NO DISPONIBLES; no autorizan obtener o copiar
  credenciales ni aplicar la migración.

## FUERA DE ALCANCE DETECTADO

- `docs/legal/privacidad/registro-tratamiento.md` no inventaría `clients.avatar_path` ni
  `client_markbox_history`.
- `lib/db/admin.ts:10-11` desaconseja `service_role` desde páginas; en HEAD, 11 archivos
  page/layout de `app/portal/**` aún importan `createAdminClient` (por ejemplo
  `envios/page.tsx:3`, `documentos/page.tsx:3`, `facturas/[code]/aceptar/page.tsx:5`).
  Corresponden a otros lotes o helpers finales de #21 excluidos de L05.
- La RPC 0405 usa `limit 1` sin orden; es segura detrás del principal L18, pero un llamador
  futuro sin principal previo debería resolverlo antes.
- E2E sin configuración Supabase: 15 fallos ambientales conocidos, no atribuibles a L05; y
  cierre de Playwright con `worker-45` forzado a los 300000 ms (igual que en L18), sin
  diagnóstico de causa raíz.
- Ocho avisos de lint en cuatro archivos ajenos intactos (tabla de `verify`).
- Arranque de workers de Vitest frágil bajo carga en este equipo (primer intento focal).

## HANDOFF AL DIRECTOR

- **Orden migrate-first obligatorio:** 1) revisar esta PR; 2) OK nominal de Sam para
  `0405_portal_perfil_privado_por_principal`; 3) aplicarla sola con el runbook
  `docs/runbooks/aplicar-migraciones-prod.md` y name exacto; 4) verificar objeto, ACL y
  `SECURITY DEFINER`; 5) en esta rama, retirar la espera del baseline, la declaración
  `l05-portal-profile-private-context-pending-rpc` y actualizar la nota de la spec (patrón
  `b49f1c0b` de L16); 6) revalidar y sólo entonces fusionar. Fusionar no autoriza aplicar,
  y aplicar no autoriza fusionar.
- Compartidos: #69, #70, #72, #73 y #74 también tocan `supabase/migrations-baseline.json` y
  `docs/specs/README.md` (unir por entradas; driver `dtd-generated-records`). Ninguna toca
  `perfil/**`, el helper ni `supabase/pending-migration-symbol-declarations.json`; #71 no
  toca estas rutas. Heads observados: #69 `b7a922b9`, #70 `4e100f8d`, #72 `db214b92`,
  #73 `19a28b13`, #74 `a11131ef`.
- `/ui-check` pendiente del Director. Resumen JSX: ningún nodo cambia; las props
  `avatarUrl`, `viewUrl`, `hasExistingPhoto` y la lista de códigos conservan nombres y
  valores con la RPC presente, y quedan vacías sin ella (tabla de comportamiento).
- Sin merge, sin aplicar 0405, sin leer producción, sin deploy. No se tocó la rama de #21.
- Ownership: escritura terminada con este documento. Tras su commit y push se libera el claim
  con `node scripts/harness-worktree.mjs release --owner c-l05-worker-20260911-claude`; el
  estado efectivo se verifica en los metadatos Git del worktree. Sin subagentes ni sesiones
  consumidoras delegadas. Conservar rama y worktree.
