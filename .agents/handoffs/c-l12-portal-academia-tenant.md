# L12 — Academia Portal: frontera de tenant

Fecha: 2026-09-10. Task ID: `c-l12-portal-academia-tenant`.
Owner / sesión escritora: `worker-c-l12-20260910-codex-root` (Codex Worker).
Estado: lista-para-revision; extracción y entrega en PR draft completadas. Sin merge ni aplicación productiva.
Repositorio: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO`.
Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/c-l12-portal-academia-tenant`.
Rama: `codex/c-l12-portal-academia-tenant`.
Base asignada y observada: `5f3afaf6a2f17b2d8d9a2170447bb97ef387b883`.
Origen de solo lectura: `ea9952a47f4adf14c48c91e6d0147597beb94aa7` (PR #21).
SDD: `docs/specs/0362-portal-academia-tenant-boundary/spec.md`; estado histórico del origen preservado, sin atribuirle nueva validación.

## OBJETIVO ORIGINAL

Preparar L12 para revisión e integración por el Director mediante PR en borrador contra main: una migración, su spec y su contrato idénticos por blob al origen, declarados pendientes de aplicar. Fusionar NO autoriza aplicar `0418_portal_academia_tenant_boundary` a producción.

## COMPLETADO

- Preflight: worktree asignado limpio, rama/base correctas, sin claim previo ni otro proceso escritor identificado; procesos Codex corresponden a esta tarea asignada.
- Claim exclusivo adquirido; source PR #21 y main remoto comprobados.
- Lecturas: AGENTS, Worker, runbook, reglas técnicas, plan bloque C, anexo SQL, spec y gobernanza aplicable.
- Tres archivos importados con `git cat-file blob`; tamaños y hashes coinciden exactamente con el origen. El árbol de la base no contenía ninguno.
- Baseline: añadida únicamente la clave `0418_portal_academia_tenant_boundary` en `pendingBelowCutoff`, con motivo y aplicación nominal; cutoff 238 preservado y resto idéntico estructuralmente a la base.
- Índice regenerado con `corepack pnpm docs:index`: 410 specs, 42 huecos históricos.
- Reconstrucción y contrato medidos de nuevo en este worktree; baseline y símbolos pendientes verificados. Revisión independiente de lectura aprobó el corte.
- Rama publicada y PR #64 creada explícitamente en borrador contra main.

Alcance exacto: los tres archivos L12, `supabase/migrations-baseline.json` (solo nueva entrada), `docs/specs/README.md` regenerado y este handoff. Excluidos app/lib, otros lotes, cutoff y entradas previas, rama/PR #21, ruleset y producción.

Aceptación: identidad de los tres blobs, pending nominal con cutoff 238, rebuild desde cero, pending-migration-symbols limpio, índice regenerado y PR draft. Commits selectivos y publicación de rama/PR autorizados; merge, aplicación Cloud y limpieza de ramas/worktrees no autorizados.

## VALIDACIÓN

- PASÓ: `corepack pnpm install --frozen-lockfile`, exit 0, 813 paquetes; Node v24.20.0 / pnpm 12.3.4 resuelto por Corepack. Lockfile intacto.
- PASÓ: `corepack pnpm docs:index`, `corepack pnpm sdd:check`, `corepack pnpm docs:check` y `git diff --check` iniciales. Numeración: 410 specs y 415 archivos de migración; solo exenciones históricas ya declaradas.
- PASÓ: comprobación estructural de baseline: una entrada añadida, cutoff 238, documentación y entradas previas preservadas.
- FALLÓ / INTERRUMPIDO el cierre agregado `corepack pnpm verify`: exit 1. Se ejecutó sin variables VERIFY_SKIP ni credenciales Supabase; todos los pasos anteriores a E2E terminaron. Se detuvo el árbol propio del proceso verify durante E2E después de confirmar la configuración Supabase ausente prevista por el encargo. No produjo resumen final ni se declara verde completo. El build se ejecutó después de forma separada con el mismo script del gate.
- PASÓ dentro de verify: harness 18/18; lint sin errores (8 warnings históricos); frontera RSC sobre 1597 módulos; TypeScript; 4 Edge Functions; 6621 unitarios en 522 archivos; docs, numbering, feature-constants, components y governance.
- PASÓ `pending-migration-symbols`: `0 ROJO · 0 AMARILLO declarado(s)`; sin cambios en `supabase/pending-migration-symbol-declarations.json`.
- PASÓ `sql-tests`: 157 contratos, incluido `0418_portal_academia_tenant_boundary.test.sql`, rollback total en PostgreSQL 17 efímero.
- PASÓ `schema-rebuild`: inventario 415 = 397 migraciones aplicadas desde cero + 18 solo-ledger verificadas sin cambio de esquema. Barrido de 219 tablas y dos tenants sintéticos creados en PostgreSQL; no son tenants de producción. Base completa 5f3afaf6 + únicamente 0418 de este lote.
- NO DISPONIBLE `migrations-applied`: faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY; el runner emitió SKIP. No se consultó producción.
- NO DISPONIBLE E2E completo/autenticado: faltan NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY; `proxy.ts:67` emitió `Your project's URL and Key are required to create a Supabase client!`. Playwright inició 186 tests; hubo fallos de Auth y resultados parciales públicos antes de detenerlo, sin resumen final ni cifra de cobertura completa. No se investigó como regresión de L12 ni se copiaron credenciales. Se verificó PID 7244 (`node scripts/verify.mjs`, creado 21:21:37 local) antes de detener solo su árbol. Puerto local 3509 sin listener al terminar.
- PASÓ build/postbuild: `node scripts/check-build.mjs`, exit 0. Compilación Next, TypeScript y postbuild Norte terminaron; el runner restauró tsconfig.json y retiró `.next-verify`. No queda diff fuera de allowlist.
- PASÓ revisión final de alcance: cinco archivos de implementación/documentación de L12 y este handoff; app/lib, scripts, workflow, lockfile, package.json, tsconfig y declaraciones de símbolos intactos. Blobs del índice Git comprobados mediante `git cat-file` antes del commit.
- NO EJECUTADO merge, migraciones de producción, despliegue manual, cambios al ruleset y limpieza de ramas/worktrees: no autorizados.
- NO DISPONIBLE todavía un resultado final del CI del HEAD de entrega: debe comprobarse en la PR. `Calidad local sin secretos` no valida E2E autenticado ni Supabase alojado.
- Contenedores propios `dtd_sqltest_addd3089` y `dtd_rebuild_addd3089`: ausentes antes de la corrida y eliminados por sus runners al terminar; comprobado con Docker después de ambos pasos. Sin tocar contenedores ajenos.

Las pruebas midieron los cinco archivos que quedaron en `f0900861496f487d8a4fd5c132cc5c6cbcdc1d6d`, sobre base `5f3afaf6`. El commit siguiente solo cierra este handoff. Logs locales completos, fuera de Git:

| Archivo bajo `%TEMP%` | SHA-256 |
|---|---|
| `c-l12-portal-academia-tenant-verify-20260910.log` | `71f8d9ffa3e2971b8bb9a8f95b2f73ab45e84864a7f306dd472f1902e109a3bd` |
| `c-l12-portal-academia-tenant-build-20260910.log` | `c4fba89ac56a83514ed4dcbb828e6163fa3e6f54d775f91e67cf61092c4613bd` |

Salida de identidad (`git cat-file -s` / bytes de `git cat-file blob` / `git hash-object --no-filters`):

```text
PASO docs/specs/0362-portal-academia-tenant-boundary/spec.md bytes=7758 source=0e7ffcfb90b264e91808325380706c69ad783a18 worktree=0e7ffcfb90b264e91808325380706c69ad783a18
PASO supabase/migrations/0418_portal_academia_tenant_boundary.sql bytes=10071 source=e5cf659b7d72fb356f7ab27213323d48a264b190 worktree=e5cf659b7d72fb356f7ab27213323d48a264b190
PASO supabase/tests/0418_portal_academia_tenant_boundary.test.sql bytes=35662 source=c063b61c69076a6d8515dd0e14968a263fa063c7 worktree=c063b61c69076a6d8515dd0e14968a263fa063c7
```

## COMMITS

- `f0900861496f487d8a4fd5c132cc5c6cbcdc1d6d` — unidad L12: spec, migración y contrato exactos, baseline pendiente e índice regenerado; cinco archivos añadidos selectivamente.
- Commit que contiene este documento — cierre durable con evidencia y handoff. Su SHA final se registra en la PR; no se crea recursión de commits por el hash del propio documento.

## PR / BRANCH

PR draft: https://github.com/hailuwaycom-sketch/DTDCARGO/pull/64.
Base `main`; rama `codex/c-l12-portal-academia-tenant`, publicada explícitamente a la misma rama de origin. Worktree indicado arriba. Main remoto seguía en `5f3afaf6a2f17b2d8d9a2170447bb97ef387b883` antes de publicar; no fue necesario actualizar la base.

## PENDIENTES DE ESTA TAREA

La extracción y entrega draft están completadas. Para integrar: revisión del Director y resultado del CI del HEAD final. E2E completo y ledger no están disponibles en este entorno; limitación prevista por el encargo, sin reparación propia pendiente. La migración permanece pendiente de aplicación nominal; merge y release son decisiones posteriores separadas.

## FUERA DE ALCANCE DETECTADO

- Corepack resolvió pnpm 12.3.4 y emitió aviso de que `pnpm.onlyBuiltDependencies` en package.json ya no se lee; la instalación congelada terminó en 0. El workflow versionado usa pnpm 11.19.0. No se modificó configuración ni lockfile por este aviso.
- Lint: ocho warnings preexistentes, seis por argumentos sin uso en tests de Compras y dos de React en `KommoBoardView.tsx` / `KommoClient.tsx`. Los archivos coinciden con la base; no se tocaron.

## HANDOFF AL DIRECTOR

Sin dependencia interna C. L09 corre en otra rama y comparte baseline/índice: el Director debe **UNIR entradas** y regenerar índice al integrar; esta sesión no resolvió esa integración. Revisar PR #64 / HEAD final contra main y confirmar CI; no adoptar el verde de otra rama. El contenido SQL cumple la medición local pedida, con los límites E2E/ledger descritos. Fusionar NO autoriza aplicar `0418_portal_academia_tenant_boundary` a producción.

Ownership al entregar: escritura cerrada; el claim `worker-c-l12-20260910-codex-root` se libera después del último push y su recibo queda en el cierre al Director. No quedan procesos de validación propios ni otra sesión escritora asignada; subagente de auditoría trabajó solo en lectura y terminó. Rama, worktree y evidencias locales se conservan. Una futura sesión debe reclamar ownership de nuevo.

Contraste estático con el plan:

- Exacto: L12 contiene únicamente migración 0418, spec 0362 y contrato 0418; los tres tamaños medidos coinciden. Son ocho ALTER POLICY en seis tablas históricas, sin nueva RPC, tabla, columna, ACL, trigger ni DML persistente. Consumidores Academia ya presentes; no se necesitó tocar app/lib ni traer otro lote C.
- Confirmado dinámicamente en este árbol: la base completa + 0418 reconstruye desde cero y pasa el contrato; el gate de símbolos pendientes queda 0/0. No apareció dependencia C nueva.
- Matiz: `docs/audits/c-analisis-bloque-c-sql.md:68` omite 0105 en el resumen de antecedentes. La cabecera de 0418 y el contrato sí la incluyen; el inventario del anexo en línea 247 también. 0105 ya está en la base y no añade dependencia C ni amplía el lote.
- Adopción explícita: el plan general desaconseja copiar automáticamente specs históricas (`c-analisis-bloque-c.md:62`); este encargo asigna expresamente 0362 exacta por blob, por lo que se reutiliza sin renumerar ni reescribir.
- La spec conserva `status: done` y cifras históricas de su origen. Esos resultados no son evidencia de esta ejecución; el estado de extracción, PR y release se registra aquí por separado. Su propia aceptación histórica deja CI, integración y Cloud pendientes.
- El contrato usa stubs y carga 0080/0105/0144/0145/0149 antes de 0418; su verde aislado no sustituye la reconstrucción completa. Tampoco certifica el catálogo ni datos de producción.

Gobernanza del corte: cumplimiento local de SGE-00.05 respaldado por contrato SQL y reconstrucción actual; SGE-00.07/12 mediante resultados explícitos y separación PR/merge/producción. UI, marca, captura/movimiento/borrado de PII real y nuevos escritores de negocio: no aplica; no se modifican esas superficies. La allowlist actual del encargo prevalece sobre rutas de cierre históricas de la spec. No se declara conformidad del legado ni del estado productivo.
