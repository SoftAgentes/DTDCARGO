# L16 — Direcciones del Portal

Fecha: 2026-09-10. Task ID: `c-l16-portal-direcciones`.
Owner / sesión escritora: `c-l16-worker-20260910-codex`. Estado: lista-para-revision en PR borrador; importación completa, validación Supabase no disponible.
Repositorio: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO`.
Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/c-l16-portal-direcciones`.
Rama: `codex/c-l16-portal-direcciones`. Base: `e580e77432485173a5cd6ef2250623bb070a5c36`.
Origen de solo lectura: `ea9952a47f4adf14c48c91e6d0147597beb94aa7`, PR #21.

## OBJETIVO ORIGINAL

Importar L16: migraciones 0425/0427, contratos SQL y specs 0372/0377, comando de borrado y estado UI focal sobre la aplicación vigente.

## COMPLETADO

- Importados los dos pares migración/contrato desde `ea9952a4`, idénticos por blob. 0425 precede a 0427 por cierre contractual.
- Importadas specs 0372/0377 con una nota aditiva, fechada debajo del título, según la forma de 0352 en main. Ambas fuentes tienen `status: in-progress`, conservado junto con todo el frontmatter. Al retirar exclusivamente la nota, el contenido coincide byte a byte con el origen. No se convirtió el estado histórico en cierre de esta tarea ni en aplicación real.
- Adaptado únicamente el borrado en `address-actions.ts`: UUID/cardinalidad, cliente de sesión, principal L18 y comparación `principal.userId === auth.user.id`, RPC estrecha sin identidad del formulario, `data === true` sin error, correlación servidor y error recuperable. La RPC revalida propiedad exacta bajo locks. Fallo de caché postcommit no falsea el resultado.
- Observabilidad vigente mediante `console.error`; las nuevas llamadas del borrado contienen sólo correlación/etapa/estado, sin cuerpo del proveedor ni PII. No se incorpora `structured-logger`.
- Estado del borrado por fila: confirmación conservada, espera sin doble envío/cancelación, error accesible persistente y enfocado, reintento y confirmación durable. Editar/Predeterminar se ocultan durante la confirmación/resultado de esa fila para no desmontar el estado. Otras filas siguen operables.
- Comparación literal contra la base: cuerpos de alta, edición y predeterminada idénticos; `PortalAddresses.tsx` desde `function AddForm(` hasta EOF idéntico, incluidos edición y campos vigentes. El origen completo habría eliminado Editar/EditForm: esa regresión no se importa.
- Baseline: únicamente las dos esperas nuevas por nombre exacto. `cutoff: 238`, `$doc` y valores 0409/0418/0430 preservados. Driver `dtd-generated-records` ya instalado y verificado, sin cambios de configuración.
- Índice regenerado con `corepack pnpm docs:index`: 414 specs.
- `pending-migration-symbols` detectó 1 ROJO por la RPC alcanzable. Se añadió declaración conforme al `$doc`, anclada a llamada y fragmentos vigentes de error/estado UI: resultado 0 ROJO y 1 AMARILLO explícito. Borrar no estará operativo hasta aplicar 0427; mientras tanto falla cerrado conservando la dirección. No se silenció el check ni se introdujo fallback.

## VALIDACIÓN

Árbol de producto `70a88a1904d1fb4415bcff92323c992d09d13bc1`, basado en `e580e774`, con sólo el corte L16. Los 13 archivos versionados de producto/documentación coinciden por blob con el snapshot de validación; este handoff se incorpora después, sin cambiar esos archivos. Sin credenciales copiadas ni `.env` operativo. Node 24.20.0, Corepack 0.35.0, pnpm 12.3.4. Recibos de esta sesión fuera de Git en `%TEMP%/c-l16-worker-20260910-codex/`: `verify.log`, `verify.exit`, `schema-rebuild.log` y `verified-product-manifest.json`.

| Comprobación | Estado y evidencia |
|---|---|
| `corepack pnpm install --frozen-lockfile` | PASÓ, 813 paquetes; lockfile intacto. Aviso heredado de pnpm 12 sobre `pnpm.onlyBuiltDependencies`. |
| Cuatro blobs mediante `git cat-file blob` + `git hash-object` | PASÓ; hashes abajo. |
| Specs fuente al retirar sólo nota de importación | PASÓ, igualdad byte a byte; frontmatter intacto. |
| Baseline al retirar sólo las dos entradas nuevas | PASÓ, idéntico a base; cutoff 238. |
| `node scripts/install-merge-drivers.mjs --check` | PASÓ. |
| `corepack pnpm sdd:check` | PASÓ, 414 specs/419 migraciones; conserva colisiones históricas declaradas. |
| `corepack pnpm docs:index` y `corepack pnpm docs:check` | PASÓ, índice sincronizado con 414 specs. |
| `corepack pnpm exec vitest run address-actions.delete.test.ts PortalAddresses.delete-state.test.tsx PortalAddresses.test.tsx` | PASÓ, 36 tests/3 archivos, incluidos 8 tests existentes. RPC ausente PGRST202, principal inválido/actor distinto, cardinalidad/UUID, respuestas no true, errores/transportes, logs sin detalle sensible, caché postcommit y UI por fila. |
| `node scripts/check-schema-rebuild.mjs` | PASÓ: inventario 419, 401 ejecutadas desde cero, 18 sólo-ledger verificadas sin cambio de esquema y barrido de aislamiento multi-tenant. PostgreSQL desechable `postgres:17`; contenedor propio retirado al terminar. |
| `node scripts/check-pending-migration-symbols.mjs` | PASÓ con límite explícito: 0 ROJO, 1 AMARILLO declarado para `delete_portal_delivery_address`. |
| `git diff --check` y allowlist | PASÓ: exactamente 14 archivos autorizados (incluido handoff); excluidos y lockfile intactos por bytes. |
| `corepack pnpm verify` | FALLÓ, exit 1: 16/17 pasos ejecutados; 15 PASÓ, E2E falló por configuración ausente y migrations-applied quedó omitido. Veredicto literal: `verify: 1 fallo(s) → e2e CIERRE ADEMÁS INCOMPLETO — CRÍTICOS SIN MEDIR: migrations-applied.` No se absuelve ni se presenta como verde. |
| `/ui-check` | NO EJECUTADO: cambio limitado al estado de borrado autorizado, sin cambio de pantalla fuera de ese estado. Unitarios de UI no certifican navegador/WCAG. |
| E2E autenticado, aplicación real de migraciones y producción | NO EJECUTADO; fuera de la autorización de esta tarea. |

Detalle del gate canónico:

| Paso | Estado y evidencia |
|---|---|
| harness | PASÓ, 18 tests. |
| lint | PASÓ, 0 errores y 8 advertencias en archivos intactos de compras Portal/CRM. |
| rsc-boundary | PASÓ, 1597 módulos escaneados. |
| typecheck | PASÓ. |
| edge-functions | PASÓ, 4 funciones compilan con Deno 2. |
| test | PASÓ, 6684 tests en 526 archivos, 177,32 s. |
| docs:check | PASÓ, 414 specs sincronizadas. |
| numbering | PASÓ, conserva las colisiones históricas declaradas. |
| feature-constants | PASÓ, 5 banderas coinciden. |
| components:check | PASÓ. |
| governance:check | PASÓ. |
| migrations-applied | NO DISPONIBLE: sin NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY; salida SKIP 3. No se comprobó el ledger real. |
| pending-migration-symbols | PASÓ con 0 ROJO y 1 AMARILLO declarado, sin presentar la RPC como aplicada. |
| sql-tests | PASÓ, 161 contratos, incluidos 0425/0427; rollback total. |
| schema-rebuild | PASÓ también dentro de verify: 401 migraciones desde cero, 18 sólo-ledger y aislamiento multi-tenant. |
| e2e | NO DISPONIBLE como validación de acceso/Supabase: el runner se ejecutó y FALLÓ (exit 1). Primera pasada: 151 pasaron, 15 fallaron, 2 flaky y 18 omitidos (5,4 min). Reintento automático de verify: 153 pasaron, los mismos 15 fallaron, 18 omitidos, sin flaky (4,7 min). Los 15 fallos son auth.spec.ts:21/91/98/105 y global-search.spec.ts:22 en los tres navegadores; error observado en proxy.ts:67 al crear Supabase sin URL/clave. No se persiguió la configuración ni se interrumpió el gate. |
| build | PASÓ: compilación de producción, TypeScript y generación/prerender completos; check-build restauró tsconfig.json. Árbol de producto intacto al terminar. |

Identidad de blobs de origen:

| Archivo | SHA-1 blob |
|---|---|
| `supabase/migrations/0425_portal_delivery_addresses_tenant_boundary.sql` | `301f065bdaf8d7852f75760432010b007eff5f56` |
| `supabase/tests/0425_portal_delivery_addresses_tenant_boundary.test.sql` | `678a8c23dfd9c3215ab51805fde68cf5b6287093` |
| `supabase/migrations/0427_portal_delete_delivery_address_command.sql` | `8876632e5c8238b88671fdb4a77fe32be92136b2` |
| `supabase/tests/0427_portal_delete_delivery_address_command.test.sql` | `69c34f2d23f7843f6ee1eb43e29f87b7407f1eb3` |

Revisión independiente de SQL/caller/UI: sin bloqueo estático. 0425 acota las tres policies Portal; 0427 valida actor/vínculo/cliente/dirección, conserva histórico/default y registra auditoría atómica mínima. Los contratos ejecutados, reconstrucción y límites de producción se reportan por separado.

Gobernanza: cumplimiento técnico del corte de SGE-00/AUD-01/MP-01 mediante comando atómico P2/R2, resultado durable y error recuperable; excepción inline heredada de SDD-0268 conservada, sin importar ConfirmDialog del Studio; políticas de formularios/errores/foco atendidas por el estado focal y pruebas. No aplica cambio de componentes canónicos ni gates nuevos. La allowlist histórica de 0377 cede al corte explícito del plan y a la asignación de Sam.

Revisión técnica focal de datos (`revisar-datos-ve`): CORRECTO en código, identidad/tenant y dirección exacta (`0427` líneas 52–85); sólo `deleted_at` y `updated_at` cambian por comando/trigger; evento con estados `deleted_at/is_default`, sin payload postal (líneas 87–120). Inventario: `client_delivery_addresses` conserva `line/label/city/state/reference/city_slug` para entrega y datos históricos, junto con identificadores de cliente/tenant y `deleted_at`; el evento conserva identidad técnica/estado/correlación. Retención legal, respaldos, terceros, base de licitud y comportamiento en producción: NO VERIFICABLE en esta tarea. Se trata de retiro de la lista activa, no supresión física de datos; esta revisión no es asesoría legal.

## COMMITS

- `fe3cc7787386f6d6ca44b7d2486b383cd6697172`: SDD-0372, migración/contrato 0425 y spec con su nota en el mismo commit.
- `70a88a1904d1fb4415bcff92323c992d09d13bc1`: SDD-0377, migración/contrato 0427 y spec con nota, comando/UI focales, baseline, declaración e índice generado.
- Commit que contiene este documento: cierre durable del handoff; hash final en la PR.

## PR / BRANCH

[PR #68 en borrador](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/68), base `main`, rama `codex/c-l16-portal-direcciones`. Rama publicada explícitamente a sí misma; sin merge ni aplicación de migraciones.

## PENDIENTES DE ESTA TAREA

- No quedan cambios de extracción/implementación por completar: los seis archivos SQL/spec/contrato, cuatro de código, baseline, declaración, índice y handoff están entregados.
- CI alojado del último SHA y revisión del Director pendientes; conservar PR en borrador hasta su evaluación. `Calidad local sin secretos` no cubre E2E autenticado ni Supabase.
- E2E de acceso con configuración disponible y ledger real quedan sin validar; no son autorización para copiar credenciales ni aplicar migraciones. La tarea no certifica release/producción.

## FUERA DE ALCANCE DETECTADO

Avisos heredados de pnpm 12/npm sobre `pnpm.onlyBuiltDependencies` y claves de `.npmrc`, sin cambio de package.json/lockfile/configuración. Ocho warnings de lint en archivos intactos: `NewPurchaseWizard.test.tsx` (4), `PurchaseStepDetalle.test.tsx` (2), `KommoBoardView.tsx` y `KommoClient.tsx` (1 cada uno). Se conservan colisiones de numeración históricas ya declaradas. E2E no está disponible en las rutas que requieren configuración Supabase: 15 fallos ambientales conocidos, no una regresión atribuida a L16; no hay credenciales para medir ledger/E2E autenticado. La primera pasada tuvo dos flaky recuperados, conservados en el recibo. Excluidos: structured-logger, scripts/verify.mjs y gates/fixtures nuevos, lib/portal/**, lib/studio/client-address-queries.ts, otros lotes, PR #21, ruleset, merge y aplicación de migraciones.

## HANDOFF AL DIRECTOR

- El corte del plan prevalece sobre la allowlist histórica más amplia de 0377, por autorización explícita de Sam.
- Dependencias: L18 ya integrado; 0425 antes de 0427 por dependencia de contrato, no del SQL.
- L13 trabaja en paralelo: conflictos de baseline/índice corresponden a integración; resolver por unión.
- Autorizado: edición focal, instalación congelada, validación local/efímera, commits selectivos, push de rama propia y PR draft. Fusionar NO autoriza aplicar `0425_portal_delivery_addresses_tenant_boundary` ni `0427_portal_delete_delivery_address_command`.
- **Calibración: corte focal practicable, no forzado.** Se conserva la aplicación vigente y se traslada sólo el comando/estado; las trampas del logger y la eliminación de edición del origen quedan fuera. La revisión independiente confirmó cuerpos legacy/formularios idénticos a base.
- Revisar la PR #68 sobre los SHA publicados y la base asignada `e580e774`; main remoto seguía en esa base al finalizar el gate. No incorporar L13 ni resolver su futura integración dentro de esta rama.
- Ownership liberado al cierre mediante `node scripts/harness-worktree.mjs release --owner c-l16-worker-20260910-codex`, después de la última escritura/commit/publicación. Los subagentes de código y revisión finalizaron; no quedan sesiones escritoras delegadas. Se conservan worktree y rama.
- Los contenedores efímeros `dtd_rebuild_599670f2` y `dtd_sqltest_599670f2` no estaban presentes tras verify; no se tocaron los servicios/relays ajenos del entorno.
