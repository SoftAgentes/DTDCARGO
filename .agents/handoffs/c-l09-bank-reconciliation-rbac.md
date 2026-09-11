# L09 — RBAC de conciliación bancaria

Fecha: 2026-09-10. Task ID: `c-l09-bank-reconciliation-rbac`.
Owner / sesión Worker: `01a08e00-5c04-7151-bc25-83f6c1eccb05`.
Estado de tarea: lista-para-revision con límites de validación declarados; no integrada ni aplicada a producción.

- Repo: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO`.
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/c-l09-bank-reconciliation-rbac`.
- Rama: `codex/c-l09-bank-reconciliation-rbac`.
- Base asignada y remoto main comprobado: `5f3afaf6a2f17b2d8d9a2170447bb97ef387b883`.
- Origen de solo lectura: `ea9952a47f4adf14c48c91e6d0147597beb94aa7`, PR #21.
- SDD asignado: `docs/specs/0352-bank-reconciliation-rbac/spec.md`; el estado histórico `done` se conserva por identidad de blob, independiente de esta extracción y de release.
- Plan: `docs/audits/c-analisis-bloque-c.md` y anexo `c-analisis-bloque-c-sql.md`.
- Disponibilidad: árbol limpio, guard válido, claim disponible; los procesos encontrados corresponden a la cadena de lanzamiento de esta misma sesión. Claim adquirido antes de editar. Subagente de revisión únicamente en lectura.

## OBJETIVO ORIGINAL

Preparar L09 para main mediante PR en borrador, importando únicamente spec 0352, migración 0409 y su contrato, idénticos por blob al origen, y declarar `0409_bank_reconciliation_rbac` pendiente de aplicar.

## COMPLETADO

Los tres blobs importados coinciden byte por byte con el origen. Entrada pendiente agregada sin alterar el resto del baseline; índice regenerado con `corepack pnpm docs:index` (410 specs, 42 huecos históricos). Allowlist exacta de este encargo (prevalece sobre rutas históricas de la spec):

- `docs/specs/0352-bank-reconciliation-rbac/spec.md`
- `supabase/migrations/0409_bank_reconciliation_rbac.sql`
- `supabase/tests/0409_bank_reconciliation_rbac.test.sql`
- `supabase/migrations-baseline.json`: solo agregar entrada; conservar cutoff 238 y todas las entradas existentes.
- `docs/specs/README.md`: exclusivamente mediante `corepack pnpm docs:index`.
- `.agents/handoffs/c-l09-bank-reconciliation-rbac.md`

Dependencias: ninguna dentro de C; tablas/policies históricas de 0167 y helpers de 0200 ya presentes en la base. Sin RPC nueva ni allowlist app/lib.

Permisos: commits selectivos, push explícito de la rama propia y PR en borrador contra main. Excluidos merge, producción, ruleset, cutoff, otros lotes, app/lib y borrado de ramas/worktrees. Fusionar NO autoriza aplicar `0409_bank_reconciliation_rbac` a producción.

### Identidad del origen

Importación binaria mediante `git cat-file blob ea9952a4:<ruta>`; contraste con `git cat-file -s <blob>` y `git hash-object --no-filters <ruta>`. Resultado observado (origen y worktree iguales):

| Archivo | Bytes | Blob origen = worktree |
|---|---:|---|
| `docs/specs/0352-bank-reconciliation-rbac/spec.md` | 2832 | `011fccdd87cf857dbd467449b3287502c860cbb5` |
| `supabase/migrations/0409_bank_reconciliation_rbac.sql` | 6608 | `333847b33c9970d5b7361e27898f52db2ea26c20` |
| `supabase/tests/0409_bank_reconciliation_rbac.test.sql` | 10634 | `5c4be2ec8dfa890714fc14b857c8bc273d6c98ae` |

Comprobación estructural adicional: retirando únicamente la clave `0409_bank_reconciliation_rbac` del baseline nuevo, el JSON es idéntico al de `5f3afaf6`; `cutoff=238`.

Salida de `git cat-file --batch-check` sobre origen y HEAD, en ese orden por archivo; los buffers obtenidos con `git cat-file blob` también se compararon íntegros:

```text
PASS docs/specs/0352-bank-reconciliation-rbac/spec.md
011fccdd87cf857dbd467449b3287502c860cbb5 blob 2832
011fccdd87cf857dbd467449b3287502c860cbb5 blob 2832
PASS supabase/migrations/0409_bank_reconciliation_rbac.sql
333847b33c9970d5b7361e27898f52db2ea26c20 blob 6608
333847b33c9970d5b7361e27898f52db2ea26c20 blob 6608
PASS supabase/tests/0409_bank_reconciliation_rbac.test.sql
5c4be2ec8dfa890714fc14b857c8bc273d6c98ae blob 10634
5c4be2ec8dfa890714fc14b857c8bc273d6c98ae blob 10634
```

### Revisión individual de policies

Líneas de `supabase/migrations/0409_bank_reconciliation_rbac.sql`, idénticas al origen. Revisión local y segunda revisión independiente de subagente, ambas sin hallazgo bloqueante para esta extracción:

| Policy | Líneas | Evidencia |
|---|---|---|
| `bank_statements_accounting_select` | 44–49 | USING: tenant propio y accounting/admin. |
| `bank_statements_accounting_insert` | 50–55 | WITH CHECK: tenant y rol de la fila nueva. |
| `bank_statements_accounting_update` | 56–65 | USING y WITH CHECK: controla fila previa y resultado. |
| `bank_statements_accounting_delete` | 66–71 | USING: tenant y rol; conserva el DELETE compensatorio vigente. |
| `bank_statement_lines_accounting_select` | 75–80 | USING sobre tenant propio de la línea y rol financiero. |
| `bank_statement_lines_accounting_insert` | 81–86 | WITH CHECK sobre tenant y rol. |
| `bank_statement_lines_accounting_update` | 87–96 | USING y WITH CHECK sobre ambas versiones de la fila. |
| `bank_statement_lines_accounting_delete` | 97–102 | USING: financiero del mismo tenant. |

Productores reales en la base: `0167_bank_reconciliation.sql:33,66,119–142` crea tablas, habilita RLS, policies históricas y acceso service_role. `0200_rbac_disabled_enforcement.sql:50–84` define los helpers vigentes con `auth.uid()` y `disabled_at IS NULL`. No se altera el trigger de integridad de matching de `0167:172–215`. Los GRANT/REVOKE de `0409:104–107` afectan exclusivamente a authenticated y dejan CRUD explícito. Las acciones actuales de Contabilidad conservan su guard; `reconcile-actions.ts:152–156` necesita DELETE para compensar un alta fallida. No se copió ni editó ese código.

Gobernanza: `cumplimiento` SGE-00.05 para restricción en DB por tenant/rol, con contrato negativo; `cumplimiento` MP-01 dentro del corte, al reducir sujetos autorizados sin agregar purga ni alterar retención P3/R3. `no aplica` UI, A11Y, notificaciones, IA y nuevos estados. AUD-01/AUD-02: sin nuevo camino de escritura, auditoría o exportación; se conserva el legado, sin declarar certificación transversal de sus flujos.

### Límites de la evidencia

- El contrato `0409:18–78` sintetiza tablas y helpers; omite FK, columnas y triggers reales. Su verde no prueba reconstrucción histórica.
- El contrato contiene casos de CRUD de cinco roles no financieros y accounting/admin en ambas tablas. Para accounting desactivado solo incluye SELECT/UPDATE de extractos (`:187–201`); para tenant B, SELECT de extractos y UPDATE de líneas ajenas (`:203–218`). No contiene casos explícitos de retenanting, INSERT cross-tenant, usuario sin membresía o varias membresías activas.
- service_role se ejercita mediante lectura (`:265–273`); su DML se conserva por inspección de ACL, sin afirmar CRUD probado por ese bloque.
- Preflight comprueba tablas/helpers y nombres/comando de policies históricas, sin certificar catálogo productivo libre de deriva. Postflight usa una lista de privilegios en `has_table_privilege`; la evidencia de CRUD completo proviene de GRANT explícito y operaciones del contrato, no de esa expresión por sí sola.
- La spec conserva `status: done` y allowlist histórica por el requisito de identidad. No significa que esta migración esté aplicada ni amplía las seis rutas autorizadas aquí.

## VALIDACIÓN

Ejecución sobre base `5f3afaf6` más los cinco archivos de entrega ahora contenidos en `b8ded3bbc08f6b6a6c2406a3bf7617e46bf1097b`. Los hashes de los cinco inputs fueron congelados durante verify y cotejados contra el index antes del commit; las ediciones posteriores son de este handoff.

| Comprobación | Estado | Resultado medido |
|---|---|---|
| `corepack pnpm install --frozen-lockfile` | PASÓ | 813 paquetes reutilizados, pnpm 12.3.4; lockfile sin cambios. |
| Identidad por blob | PASÓ | Tres archivos, tamaños y OID de la tabla anterior; también verificados al stage. |
| Baseline y allowlist | PASÓ | Nueva clave exacta, cutoff 238; cero cambios app/lib; revisión independiente. |
| `corepack pnpm docs:index` | PASÓ | Índice generado; 410 specs y 42 huecos históricos. |
| `corepack pnpm sdd:check` | PASÓ | 410 specs, 415 migraciones; solo colisiones históricas ya declaradas. |
| `corepack pnpm docs:check` | PASÓ | Índice sincronizado. |
| verify: harness | PASÓ | 18/18. |
| verify: lint | PASÓ | 0 errores, 8 advertencias en producto preexistente. |
| verify: rsc-boundary | PASÓ | 1597 módulos, sin cruces prohibidos. |
| verify: typecheck | PASÓ | TypeScript completo. |
| verify: edge-functions | PASÓ | Cuatro entradas compilan con Deno. |
| verify: test | PASÓ | 6621 pruebas en 522 archivos; 189.79 s. |
| verify: docs:check / numbering | PASÓ | Índice y numeración sin colisiones nuevas. |
| verify: feature-constants | PASÓ | Consistencia de constantes. |
| verify: components:check | PASÓ | Registro validado. |
| verify: governance:check | PASÓ | Cápsula sincronizada. |
| verify: migrations-applied | NO DISPONIBLE | SKIP: sin NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. No se consultó producción. |
| verify: pending-migration-symbols | PASÓ | `0 ROJO · 0 AMARILLO declarado(s)`; no se modificaron declaraciones. |
| verify: sql-tests | PASÓ | 157/157 contratos, incluido 0409; rollback total. |
| verify: schema-rebuild | PASÓ | 397 migraciones de esquema desde cero, 18 solo-ledger verificadas, aislamiento multi-tenant aprobado. Inventario 415 = base 414 + únicamente 0409. |
| verify: e2e | NO DISPONIBLE | URL/clave Supabase ausentes: error explícito de createServerClient en proxy.ts:67. Tras el fallo de mobile-safari el runner dejó de avanzar; se interrumpió esta ejecución a las 21:23:03 -04:00 conforme al encargo de no perseguir E2E sin configuración. Sin reporte terminal ni total E2E aprobado. |
| build: `node scripts/check-build.mjs` | PASÓ | Exit 0, compilación, TypeScript, prerender y postbuild Norte. Ejecutado por separado después de interrumpir E2E; exactamente el entry del paso build de verify. El script restauró tsconfig y retiró su salida temporal; sin diff adicional. |
| `corepack pnpm verify` completo | FALLÓ | Exit -1 por interrupción controlada durante E2E. Los pasos anteriores sí tienen recibos; no se declara cierre canónico completo ni exit 0. |
| `git diff --check` / revisión final | PASÓ | Seis rutas de la allowlist, sin cambios app/lib, lockfile, cutoff, declaraciones de símbolos ni otras migraciones. |
| Merge / migración en producción | NO EJECUTADO | Fuera de autorización. |

Resultado agregado de los 17 pasos definidos en verify: **15 PASÓ, 2 NO DISPONIBLE** (ledger y E2E), reuniendo el verify interrumpido y el build independiente. Este conteo es una consolidación de recibos, **no el resumen de una ejecución canónica completa**. No se solicitó ni ejecutó un segundo intento manual de E2E.

Recibos locales fuera de Git: `%TEMP%/codex-c-l09-01a08e00/`. El handoff conserva los resultados suficientes para revisión; los logs completos son complementarios:

| Recibo | SHA-256 |
|---|---|
| `verify.log` | `86301055292da4fcfabdfc32218c5423d218a98eadb53ef2255cec54695750cf` |
| `build.log` | `ae405ad84cc4bc4c33d56ceafa022d7e1da7988f48e3647aa44e9f74c3f020d7` |
| `e2e-interruption.json` | `a0f25755990cf890c52a1330e945cabe1b950b8d39a63fd7a68ca4b8813c51f7` |

DB efímera: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2), imagen `sha256:67f41722b7a8cbdb868a44a4995c846eddfdc2973bccb291ce937dce88ad5675`. Contenedores de esta ejecución: SQL `469bc15a17cb5ce941e1029904f7f1bb0aa676320f164aaab35bdd2336a83881`; rebuild `905743fe0f357a1a75d109f30328a35a97a64c4c1d95adfe5e486681f9444ea2`. Ambos terminaron y su ausencia fue comprobada. No se tocaron contenedores de otras tareas.

## COMMITS

- `b8ded3bbc08f6b6a6c2406a3bf7617e46bf1097b` — importación indivisible de los tres blobs, baseline pendiente e índice generado; cinco rutas selectivas.
- Commit que contiene este documento — cierre durable, matriz de evidencia y calibración del piloto. Su hash final queda en la PR para evitar autorreferencia.

## PR / BRANCH

[PR #63 en borrador](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/63), base `main` en `5f3afaf6`, rama `codex/c-l09-bank-reconciliation-rbac`. Publicada explícitamente a la rama homónima. No se hizo merge.

## PENDIENTES DE ESTA TAREA

La importación, declaración pendiente, reconstrucción, revisión de policies, validaciones locales disponibles y PR en borrador están preparadas. No hay correcciones de SQL/producto pendientes identificadas dentro de L09.

La cobertura E2E/ledger y un cierre canónico sin interrupción **no están acreditados**. El encargo clasifica esas dependencias de configuración como NO DISPONIBLE y ordena no perseguirlas; se entregan como límite explícito para el Director. Revisión e integración en main siguen pendientes del Director con autorización propia. Aplicación productiva sigue pendiente de aprobación concreta de Sam.

## FUERA DE ALCANCE DETECTADO

- Configuración Supabase/credenciales ausentes. No se copiaron secretos; ledger y E2E autenticado no disponibles.
- E2E dejó de producir resultados tras mobile-safari (último caso reportado: Portal magic link, retry #1). Se conoce el error de configuración, pero no se afirma una causa exacta del estancamiento ni se intentó reparar Playwright. Se detuvo solo el árbol propio de verify: 26 procesos identificados por parentesco y CreationDate, cero sobrevivientes comprobados y puerto 3792 sin listener. Esto no es una regresión SQL atribuida a L09.
- Ocho advertencias de lint en archivos de producto sin cambios; colisiones históricas de numeración declaradas por el gate. No se corrigieron dentro de este lote.

## HANDOFF AL DIRECTOR

**Qué del plan resultó exacto:** los tres tamaños y blobs; la correspondencia independiente 0352 ↔ 0409; dos tablas y ocho policies; productores históricos 0167/0200; ausencia de predecesor C, RPC nueva, cambios app/lib y necesidad de desplegar facades. La reconstrucción base completa + solo 0409 pasó en este worktree: 397 migraciones de esquema (396 de base + 1), 18 solo-ledger e aislamiento. Símbolos pendientes quedó completamente limpio y el contrato focal pasó dentro de 157 contratos.

**Qué requiere calibración para los otros 21:** no hubo discrepancia funcional en el corte SQL. Las specs históricas ya pueden decir done y traer allowlists antiguas; conservar blobs no equivale a aplicación ni a autorización de esas rutas. Los fixtures de contratos no sustituyen productores reales. El entorno no permite declarar verde integral: ledger ausente; E2E falla por configuración y además dejó de avanzar, por lo que se interrumpió y build se midió por separado. Ni este resultado ni Calidad local sin secretos certifican E2E autenticado, Supabase alojado o producción.

**Siguiente acción:** revisar PR #63 y el SHA final de sus dos commits; revalidar base vigente y checks de ese head antes de decidir integración. La última lectura remota de esta entrega conserva main en `5f3afaf6` y el origen #21 en `ea9952a4`. Si aparece conflicto de baseline, unir todas las entradas; nunca elegir un lado. Mantener `0409_bank_reconciliation_rbac` pendiente, con cutoff 238, hasta aplicación individual autorizada y verificada. No se modifica la PR #21 ni su rama.

**Sesiones y ownership:** única sesión escritora indicada arriba; subagente exclusivamente en lectura, terminado. Contenedores efímeros y procesos de E2E propios cerrados, sin consumidores runtime de esta tarea. Este documento se cierra con claim propio; después del último push se ejecuta `node scripts/harness-worktree.mjs release --owner 01a08e00-5c04-7151-bc25-83f6c1eccb05`, y el resultado de liberación se registra en la descripción final de la PR y la entrega. Se conservan rama, worktree y evidencia; no se autoriza limpieza.
