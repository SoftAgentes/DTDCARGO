# Handoff — C / L13: frontera tenant de reclamos Portal

Fecha: 2026-09-10. Task ID: `c-l13-portal-reclamos`.
Owner / sesión: `c-l13-portal-reclamos-worker-20260910-root` (Worker Codex).
Estado: lista-para-revision, con límites de entorno explícitos; no integrada ni aplicada. Claim adquirido tras verificar asignación explícita del worktree, árbol limpio, reflog y procesos asociados a esta sesión; sin claim ni handoff previos. Liberación al terminar la publicación del handoff, con recibo efectivo en la PR.

- Repo: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO`.
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/c-l13-portal-reclamos`.
- Rama: `codex/c-l13-portal-reclamos`.
- Base asignada y HEAD inicial: `e580e77432485173a5cd6ef2250623bb070a5c36`; coincide con main remoto consultado al iniciar.
- Origen solo lectura: `ea9952a47f4adf14c48c91e6d0147597beb94aa7`, head de PR #21 confirmado en GitHub.
- SDD asignada: `docs/specs/0363-portal-reclamos-tenant-boundary/spec.md`; conservar frontmatter y `done` histórico, añadir únicamente la nota de importación fechada.

## OBJETIVO ORIGINAL

Preparar L13 para integración a main mediante PR en borrador: importar migración 0419, spec 0363 y contrato; declarar `0419_portal_reclamos_tenant_boundary` pendiente de aplicar. El Worker no fusiona ni aplica a producción.

## COMPLETADO

Importados los tres archivos L13 y publicada la PR en borrador. Migración y contrato idénticos por blob; spec idéntica salvo nota de importación aditiva fechada bajo el título. El baseline añade únicamente `0419_portal_reclamos_tenant_boundary`, conserva `cutoff: 238` y las tres esperas previas. Índice regenerado con `corepack pnpm docs:index` (413 specs). La revisión independiente de extracción pasó sin bloqueos.

Identidad, aislamiento y ownership comprobados. Lectura del plan C, anexo SQL, AGENTS, skill Worker, runbook y reglas aplicables. Subagente interno de auditoría exclusivamente en lectura, sin archivos de escritura asignados. Gobernanza: cumplimiento de SGE-00.05/06/07/12 por frontera/preflight, evidencia local distinguida de producción y autorización separada; no aplica cambio de controles, pantallas, captura, movimiento o borrado de datos personales en esta extracción. No se declara conforme el legado completo.

Alcance exacto: los tres archivos L13, `supabase/migrations-baseline.json` solo para añadir la espera, `docs/specs/README.md` por generador y este handoff. Prohibidos app/lib, otros lotes, cutoff, esperas existentes, origen #21, ruleset y producción. Autorizados instalación congelada, pruebas efímeras locales, commits selectivos, push explícito de la rama y PR draft contra main.

Aceptación: blobs originales en los tres archivos antes de nota; migración/contrato idénticos al cerrar; spec solo nota aditiva; baseline conserva entradas y cutoff 238; índice generado; sdd/docs, verify, reconstrucción desde cero y gate de símbolos; cierre durable y PR draft.

## VALIDACIÓN

- PASÓ: guard, raíz/rama/base, status inicial sin modificaciones; origen de PR #21 y main remoto.
- PASÓ: `corepack pnpm install --frozen-lockfile` (28.7 s), Node 24.20.0 / pnpm 12.3.4; lockfile intacto.
- PASÓ: `corepack pnpm sdd:check` (413 specs / 418 migraciones), `corepack pnpm docs:check`, scope de seis rutas, `git diff --check` y revisión independiente.
- **FALLÓ** `corepack pnpm verify`, exit **1**, del `2026-09-11T03:17:13.625Z` al `2026-09-11T03:41:17.275Z`, sobre el contenido exacto de `5dd214fb7de7aee173d9d475eea62619bb7dc4fb`. **16 de 17 pasos ejecutados: 15 PASÓ, E2E FALLÓ, migrations-applied NO DISPONIBLE**. No es verde completo ni certificación de producción. El commit posterior sólo agrega este handoff; no cambia el contenido probado.
- PASÓ: harness (18), lint (0 errores / 8 advertencias basales), rsc-boundary (1597 módulos), typecheck, edge-functions (4), unitarios (524 archivos / 6656 tests), docs:check, numbering, feature-constants, components:check y governance:check.
- PASÓ: `pending-migration-symbols: 0 ROJO · 0 AMARILLO declarado(s)`. `supabase/pending-migration-symbol-declarations.json` intacto.
- PASÓ: SQL completo, **160 contratos**, incluido `0419_portal_reclamos_tenant_boundary.test.sql`; rollback total.
- PASÓ: **schema-rebuild**, 418 archivos inventariados, **400 migraciones aplicadas desde cero**, 18 sólo-ledger verificadas sin tocar esquema, barrido de **219 tablas y dos tenants sintéticos**. Base completa asignada más únicamente la migración L13; ninguna migración C adicional importada por esta tarea. El resultado procede del gate completo, no del fixture focal.
- NO DISPONIBLE: `migrations-applied`, SKIP explícito por ausencia de `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`; no se consultó producción. Sólo existe `.env.example`, sin credenciales ni banderas de omisión en el entorno.
- E2E **NO DISPONIBLE** para cierre funcional autenticado; comando **FALLÓ** (exit 1). Primera pasada: timeout de 120 s del webServer antes de tests. Segunda: **152 pasaron / 15 fallaron / 1 flaky / 18 omitidos**, 11.2 min. Los 15 fallos son login/auth y global-search protegido, con falta explícita de URL/clave Supabase en `proxy.ts:67`; no se corrigió ni persiguió producto ajeno. Un error adicional fuera de tests corresponde al worker que no cerró en 300000 ms y fue terminado por el propio runner. No se modificaron retries, timeouts ni tests; no hubo terminación manual.
- PASÓ: build de producción y postbuild Norte. Next compiló en 25.5 s; el runner restauró `tsconfig.json` byte por byte y retiró `.next-verify` al terminar.
- PASÓ: CI remoto **Calidad local sin secretos** del commit de extracción `5dd214fb`, [run 34558371873](https://github.com/hailuwaycom-sketch/DTDCARGO/actions/runs/34558371873). El CI del commit final de handoff debe comprobarse aparte por SHA en la PR; no se le atribuye este verde anterior. Ese workflow no ejecuta SQL, schema-rebuild, E2E autenticado ni ledger Supabase.
- NO EJECUTADO: merge, aplicación de 0419 a producción, lectura de datos productivos, despliegue manual, cambios del ruleset y resolución de conflictos con L16; fuera de la autorización Worker.

PostgreSQL **17.11**, imagen `postgres:17`, ID `sha256:67f41722b7a8cbdb868a44a4995c846eddfdc2973bccb291ce937dce88ad5675`. Versión consultada en contenedor efímero propio `25f255b2ab82`; runners `dtd_sqltest_1972c4a2` / `dtd_rebuild_1972c4a2` ya retirados al finalizar. Sin acceso a los servicios Supabase preexistentes.

Evidencia local fuera de Git: `C:/Users/AKXGEN~1/AppData/Local/Temp/c-l13-portal-reclamos-20260910-root/` (`install.log`, `docs-index.log`, `sdd-check.log`, `docs-check.log`, `blobs-iniciales.log`, `blobs-finales.log`, `verify.log`, recibo final `verify-result.json`).

### Identidad por blob: salida de git cat-file

Consulta `git cat-file --batch-check` sobre `ea9952a4:<ruta>` y el índice preparado, en el orden spec / migración / contrato:

```text
spec origen:       bd7b8a9e1f2d919783e24ffadf6e9ffebe846dc6 blob 7372
spec importada:    bd7b8a9e1f2d919783e24ffadf6e9ffebe846dc6 blob 7372
spec con nota:     e1683be27f94130642572d37e48ebad03f6ed8a0 blob 7917
migración origen:  cf3a6375074797a8324f186dfebb77f264d2a3aa blob 3949
migración índice:  cf3a6375074797a8324f186dfebb77f264d2a3aa blob 3949
contrato origen:   0784a35129963852ebbf0e35466ce61a8804d755 blob 29996
contrato índice:   0784a35129963852ebbf0e35466ce61a8804d755 blob 29996
```

Además de comparar OID, se compararon Buffers del working tree contra `git cat-file blob`: igualdad byte a byte. Retirar únicamente la nota de la spec devuelve el Buffer original completo; frontmatter, `done` y referencias históricas permanecen intactos.

## COMMITS

- `5dd214fb7de7aee173d9d475eea62619bb7dc4fb` — importación lógica de L13: spec con nota, SQL, contrato, espera y regeneración de índice en el mismo commit selectivo.
- Commit que contiene este documento — cierre durable del Worker. SHA final en la PR, sin recursión de commits para registrar su propio hash.

## PR / BRANCH

[PR #67 en borrador](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/67), base main, rama `codex/c-l13-portal-reclamos`; publicación con push explícito de la rama a sí misma. CI de extracción PASÓ; estado del SHA final de handoff en la PR. No se fusionó ni desplegó manualmente.

## PENDIENTES DE ESTA TAREA

Ninguno de extracción o implementación. La integración aún no está hecha: Director debe revisar la PR y sus checks por SHA, aceptar los límites de entorno explícitos, coordinar L16 y obtener la autorización de merge correspondiente. E2E autenticado y ledger productivo siguen NO DISPONIBLE en este entorno; no se aplicará una migración para convertirlos en verde. La aplicación productiva de 0419 es una tarea nominal separada.

## FUERA DE ALCANCE DETECTADO

El prompt dice baseline vacío, pero la base asignada ya contiene esperas `0409_bank_reconciliation_rbac`, `0418_portal_academia_tenant_boundary` y `0430_portal_profile_change_requests_principal_tenant`. Se preservan íntegramente. La aclaración final del encargo confirma L09/L12/L18 ya integrados y L16 paralelo; la mención inicial de L18 paralelo/piloto quedó desactualizada.

Ocho advertencias de ESLint en archivos preexistentes, sin errores. E2E: ausencia de configuración Supabase, primera pasada con timeout del servidor y cierre posterior de `worker-47` demorado 300000 ms. Son límites/incidencias fuera de L13 y no una reparación de esta tarea. El timeout de cierre se dejó actuar según el runner instalado; no se inició otra reproducción ni se tocaron dependencias o scripts.

## HANDOFF AL DIRECTOR

**Exacto en el plan:** `c-analisis-bloque-c.md:82` y anexo SQL `:69/:152` describen dos ALTER POLICY SELECT, objetos históricos, sin productor/dependiente interno C y sin allowlist nueva app/lib. La reconstrucción sobre e580e774 confirma ese corte. Consumers existentes en `app/portal/(app)/soporte/page.tsx`, `lib/portal/portal-claims.ts` y `lib/studio/reclamos/claim-evidence.ts` no se tocaron. No se importó `support-private-context`. Los tamaños 7372/3949/29996 del Director son exactos; la spec aumenta sólo por la nota.

**Diferencias/precisiones:** el análisis anterior usó e325cb4d y 414 archivos base; esta base e580e774 ya incorpora L09/L12/L18, contiene 417 y con L13 reconstruye 418. El baseline inicial no estaba vacío. El plan recomendaba L09 como piloto; L18 sí incorpora código, por lo que no tiene la misma forma SQL pura de L13. La aclaración final de Sam fija L16 como paralelo actual. El contrato focal crea fixtures propios: sus resultados no sustituyen la reconstrucción completa ni son evidencia de Supabase/Storage/firma real. Las cifras 416/398 migraciones y 47 pruebas de consumidores conservadas en la spec pertenecen al origen histórico; la evidencia vigente de esta extracción es la de este handoff.

L16 comparte baseline e índice: la integración futura corresponde al Director, **uniendo entradas y regenerando índice**, sin elegir un lado. Revisar SHA y base vigentes antes de integrar. Fusionar NO autoriza aplicar `0419_portal_reclamos_tenant_boundary` a producción; requiere autorización nominal separada de Sam y runbook, con `name` exactamente `0419_portal_reclamos_tenant_boundary`.

Owner de esta única sesión escritora: `c-l13-portal-reclamos-worker-20260910-root`; subagente de auditoría sólo lectura. La secuencia de cierre es publicar este handoff, revalidar remoto/estado y liberar con `node scripts/harness-worktree.mjs release --owner c-l13-portal-reclamos-worker-20260910-root`; la PR registra el recibo efectivo de liberación y el SHA final. No borrar rama ni worktree. La actividad/cleanup de otras sesiones no se autoriza ni se infiere aquí.
