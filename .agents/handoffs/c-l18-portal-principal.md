# L18 · principal Portal y migración 0430

Fecha: 2026-09-10. Estado: lista-para-revision, con límites de validación externa.
Owner / sesión escritora: `c-l18-worker-20260910-codex`.
Task ID: `c-l18-portal-principal`.
Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/c-l18-portal-principal`.
Rama: `codex/c-l18-portal-principal`. Base: `2824872caf446a68c6d2dfe3b3cba5ce6c73c389`.
Al cerrar, `origin/main` avanzó a `46142350f9ba381b1ba850a48f840a2e2e2a094c`
por PR #65: sólo notas de importación en specs 0352/0362. Diff remoto comprobado,
sin solapamiento con L18 ni cambio de producto/schema. Se conserva la base asignada;
no se incorporan esos commits ajenos ni se afirma haber probado una combinación nueva.
Origen congelado de solo lectura: `ea9952a47f4adf14c48c91e6d0147597beb94aa7` (PR #21).
SDD: `docs/specs/0382-portal-profile-change-requests-principal-tenant/spec.md`.

## OBJETIVO ORIGINAL

Traer L18 como raíz autónoma: SQL y contrato 0430 originales, spec 0382 original
con nota aditiva fechada, principal/tipo y guards focales de cuenta y solicitudes
Portal sobre la aplicación vigente. Preservar el resto de funciones, presentación
y lecturas privadas de perfil. L02/L03/L05/L14/L16/L22 dependen de este productor.

## COMPLETADO

- Aislamiento comprobado: rama y base asignadas, árbol inicial limpio, guard PASÓ.
- Claim exclusivo adquirido; el encargo asigna este worktree a esta sesión.
- Principal `PortalClientPrincipal = { userId, tenantId, client: PortalClient }`
  resuelto desde `auth.getUser()` y vínculo activo `client_users`, con validación
  del cliente vivo y coherencia de identidad/tenant. Errores fallan a null.
- `getPortalClient` conserva API/DTO y delega al principal. Las otras 17 funciones
  de `portal-queries.ts` permanecen idénticas por AST a la base, incluido el asesor
  vigente, activación, completitud, cotizaciones, envíos y facturas.
- Snapshot Portal de solicitudes con tenant/cliente/source/estado explícitos;
  las cuatro queries genéricas Studio permanecen idénticas por AST.
- Perfil resuelve el principal y consume ese snapshot. JSX, Field/Step,
  direcciones, fotos/firma, historial privado y cuota vigentes se conservan.
- SQL y contrato originales; spec original más nota aditiva fechada bajo H1,
  con `status: in-progress` y todas sus casillas históricas intactos.
- Baseline suma únicamente `0430_portal_profile_change_requests_principal_tenant`.
  Comparación estructural confirma cutoff 238, entradas 0409/0418 y `$doc` intactos.
  Driver `dtd-generated-records` instalado; no hubo conflicto que resolver.
- Índice regenerado, sin editar manualmente. Revisión independiente sin hallazgos
  bloqueantes ni dependencias de helpers excluidos.

### Justificación del corte por ruta

| Ruta | Cambio autorizado y evidencia |
|---|---|
| `supabase/migrations/0430_portal_profile_change_requests_principal_tenant.sql` | Importación exacta; endurece sólo dos policies de lectura. |
| `supabase/tests/0430_portal_profile_change_requests_principal_tenant.test.sql` | Contrato exacto; causalidad, idempotencia, deriva, roles, ACL y filas sintéticas. |
| `docs/specs/0382-portal-profile-change-requests-principal-tenant/spec.md` | Contenido exacto más nota de importación; estado histórico no equivale a producción. |
| `lib/portal/portal-queries.ts` | Sólo principal/tipo y delegación de cuenta; demás funciones conservadas. |
| `lib/portal/change-request-queries.ts` | Agrega snapshot Portal; no cambia las queries genéricas Studio. |
| `app/portal/(app)/perfil/page.tsx` | Principal y snapshot; presentación y lecturas privadas intactas. |
| `lib/portal/__tests__/account.test.ts` | Diez casos conservados; fixture de identidad actualizado. |
| `lib/portal/__tests__/portal-profile-scope.test.ts` | Casos fuente más validación del principal público, multiplicidad y fallos cerrados. |
| `lib/portal/__tests__/portal-change-request-scope.test.ts` | Casos fuente más aislamiento, orden, errores y preservación Studio. Fixture respeta limit antes de maybeSingle. |
| `docs/specs/README.md` | Regeneración canónica: 412 specs. |
| `supabase/migrations-baseline.json` | Sólo la espera nueva de 0430; ningún cambio semántico a campos previos. |
| `.agents/handoffs/c-l18-portal-principal.md` | Contrato, evidencia, límites y cierre durable del encargo. |

### Identidad por blob: recibo

Comprobación ejecutada: `git cat-file blob ea9952a4:<ruta>` entrega Buffer original;
`git hash-object --stdin` del archivo importado y comparación byte a byte con
`git cat-file blob <hash>` confirmaron las tres igualdades antes de añadir la nota.

| Artefacto | Blob fuente = blob importado |
|---|---|
| Spec 0382 | `91baf604bfe7d07a070ab30e21ae5106fdc85b53` |
| Migración 0430 | `228f73764605da063d7d66d6e6d9b87764317070` |
| Contrato 0430 | `c9fe0313fdda14844a07a0f77a8b7d48814cce0d` |

SQL y contrato conservan esos blobs finales. La spec final tiene otro blob por
la nota expresamente exigida en aceptación 2; retirar exclusivamente ese bloque
recupera exactamente el blob fuente. No se presenta como identidad del blob final.
La receta se leyó en `codex/c-nota-specs-importadas:docs/specs/0352-bank-reconciliation-rbac/spec.md`:
el archivo de la base aún no contenía nota. Se adaptó verazmente a `in-progress`
porque `ea9952a4` no contiene `done` en 0382. No se cambia el título ni frontmatter.

### Tests de origen que no entraron

Las rutas `lib/portal/__tests__/payment-report-actions.test.ts` y
`lib/portal/__tests__/payment-report-consumers.test.ts` no existen en `2824872c`.
No había fixtures preexistentes para adaptar. Sus versiones finales prueban
comandos/recibos `create_portal_payment_report`, `cancel_portal_payment_report`
y `resolve_payment_report` de L14/RPC 0421. Se omiten completas según aceptación 7:
24 + 27 casos por conteo estático del origen, no ejecutados ni importados.

### Gobernanza proporcional

- **Cumplimiento SGE-00.05:** filtros explícitos y tests negativos de tenant,
  cliente, retiro, multiplicidad y origen de solicitudes; evidencia local solamente.
- **Cumplimiento SGE-00.12:** autoridad de Sam limitada a preparación, tests,
  commit/push/PR draft. Ninguna migración productiva ni merge ejecutado.
- **No aplica SGE-00.01–04, .06–11 al cambio de acciones/visual:** no se incorporan
  mutaciones, confirmaciones, componentes, estados visuales, captura o retención
  de PII; presentación y fallback vigentes conservados. No certifica el legado.
- **Excepción documental autorizada:** nota aditiva rompe sólo el blob final de
  la spec; contenido fuente íntegro comprobado tras retirar exactamente la nota.

## Alcance y permisos

Once rutas SDD: SQL, contrato, spec; `lib/portal/portal-queries.ts`,
`lib/portal/change-request-queries.ts`, cinco tests (`account`, `portal-profile-scope`,
`portal-change-request-scope`, `payment-report-consumers`, `payment-report-actions`),
y `app/portal/(app)/perfil/page.tsx`. Los dos tests de pagos sólo cambian fixtures de identidad.
Adicionales autorizados: `docs/specs/README.md` regenerado, entrada nueva del baseline,
declaraciones de símbolos pendientes sólo si procede, y este handoff.

Autorizados instalación congelada, pruebas locales/DB efímera, commits selectivos,
push de la rama propia y PR draft contra main. Prohibidos merge, producción/aplicar
0430, cambiar cutoff 238 o entradas 0409/0418, otros lotes/helpers, ruleset y cleanup.
Subagente `tests_focal`: escritura exclusiva en los cinco tests; root mantiene los
otros archivos. Subagente `audit_sql_gate`: sólo lectura, sin sesión Worker propia.

## VALIDACIÓN

| Comprobación | Resultado / alcance |
|---|---|
| `corepack pnpm install --frozen-lockfile` | PASÓ, pnpm 12.3.4 / Node 24.20.0; lockfile intacto. Advertencia de configuración pnpm heredada no modificada. |
| Identidad `git cat-file` | PASÓ con salvedad explícita de nota de spec, recibo anterior. |
| `corepack pnpm sdd:check` y `corepack pnpm docs:check` | PASÓ: 412 specs / 417 migraciones; sólo colisiones históricas ya exentas. |
| `node scripts/check-pending-migration-symbols.mjs` | PASÓ: 0 ROJO / 0 AMARILLO; 0430 sólo altera policies, no crea símbolos. No corresponde declaración y el archivo de declaraciones queda intacto. |
| Tres tests focales con `corepack pnpm test` | PASÓ: 3 archivos / 45 tests, exit 0. |
| Unitarios completos dentro de verify | PASÓ: 524 archivos / 6656 tests, sin omisiones. |
| Harness, lint, frontera RSC, typecheck, Edge Functions | PASÓ: harness 18/18; 4 Edge Functions; lint 0 errores y 8 warnings ajenos. |
| Docs, numbering, feature-constants, components, governance dentro de verify | PASÓ. |
| `migrations-applied` | NO DISPONIBLE: faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. No se consultó el ledger productivo. |
| `sql-tests` dentro de verify | PASÓ: 159 contratos, incluido 0430, con rollback total sobre Postgres desechable. |
| `schema-rebuild` dentro de verify | PASÓ: 417 archivos; 399 migraciones desde cero + 18 sólo-ledger verificadas sin cambio de esquema; aislamiento de 219 tablas con 2 tenants sintéticos. |
| E2E autenticado | NO DISPONIBLE por URL/clave Supabase ausentes. El runner FALLÓ, exit 1: pasada final 153 PASÓ / 15 FALLÓ / 18 omitidos; primera 151 PASÓ / 2 flaky / 15 FALLÓ / 18 omitidos. Los 15 casos son auth.spec.ts y global-search.spec.ts en los tres proyectos. |
| Cierre de Playwright | FALLÓ fuera de los tests: `worker-45 process did not exit within 300000ms after stop, force-killed it`. El gate esperó su timeout y continuó; no se modificó el harness. |
| `/ui-check` | NO EJECUTADO: no cambia presentación; JSX/Field/Step idénticos por AST. |
| Build y postbuild dentro de verify | PASÓ: Next.js 16.2.11, compilación, TypeScript, generación/prerender y Norte. El runner restauró tsconfig.json. |
| Revisión estática independiente / AST / allowlist / baseline | PASÓ: 12 rutas autorizadas; 17 funciones Portal, 4 queries Studio y JSX conservados. |
| `git diff --check` | PASÓ. |
| `corepack pnpm verify` | FALLÓ, exit 1: 16 de 17 pasos ejecutados; 15 aprobados y E2E fallido. Cierre incompleto por migrations-applied sin medir. Ningún gate silenciado. |

La aceptación distingue reconstrucción completa de esquema del contrato focal.
Recibos locales fuera de Git: `%TEMP%/dtd-c-l18-20260910/blob-identity.json` y `verify.log`.

## COMMITS

Commit de implementación: el commit que contiene esta versión del documento.
Incluye código focal, SQL/contrato/spec con nota, tests, baseline e índice.

## PR / BRANCH

PR draft a publicar contra main tras este commit; rama y worktree indicados arriba.
Fusionar NO autoriza aplicar `0430_portal_profile_change_requests_principal_tenant` a producción.

## PENDIENTES DE ESTA TAREA

Publicar rama/PR draft y completar cierre de ownership. La implementación focal,
reconstrucción, contratos y unitarios están completos. E2E autenticado y ledger
productivo siguen NO DISPONIBLES; no son permiso para obtener/copiar credenciales
ni para aplicar la migración. La revisión de integración corresponde al Director.

## FUERA DE ALCANCE DETECTADO

Ocho warnings de lint en archivos ajenos, sin errores. Configuración pnpm heredada
ignorada por pnpm 12: `pnpm.onlyBuiltDependencies`, sin cambio al manifiesto.
E2E no dispone de configuración Supabase; se conserva la limitación solicitada.
El segundo intento registró además un timeout de cierre de `worker-45` a 300000 ms;
evidencia actual del runner, no diagnóstico de causa raíz ni reparación del teardown.

## HANDOFF AL DIRECTOR

El corte focal resultó practicable: productor principal con la misma forma que
esperan L02/L03/L05/L14/L16/L22, sin productor C oculto. L05 conserva a su cargo
`profile-private-context`/RPC 0405 y L03 el asesor nuevo. Los módulos finales home,
hub, soporte, observabilidad y otras 29 migraciones C no entraron.

Lo no practicable tal como estaba formulado: identidad final del blob de spec y
nota aditiva simultáneas; se conserva identidad del contenido fuente y se explica
la excepción específica. Tampoco corresponde trasladar fixtures de dos tests de
pagos ausentes en base: al preparar L14 habrá que incorporar sus tests completos
y sus fixtures de principal. Ninguna de estas salvedades requiere helper ajeno.

No trasladar funciones finales adicionales de #21 al integrar este lote. El
snapshot acepta opcionalmente un principal resuelto server-side de la misma
sesión; sus consumidores no deben obtenerlo de parámetros del cliente.
Siguiente acción del Director: revisar el corte y salvedades, coordinar los seis
dependientes y cualquier futura integración con autorización específica. La PR
no autoriza release ni aplicar SQL. No hubo acceso a filas productivas, merge,
cambio de ruleset, otras ramas ni cleanup de worktrees.
Ownership retenido mientras termina publicación; no borrar worktree.
