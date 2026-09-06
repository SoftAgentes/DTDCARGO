# PR26 · Superviviente terminal de fusiones

- Task/fecha: pr26-profile-merge-chain-20260906 / 2026-09-06.
- Owner: 01a0734d-a379-78b0-a86a-ed90a9a2d6f9.
- Worktree: C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/pr26-profile-merge-chain-20260906.
- Rama: codex/pr26-profile-merge-chain-20260906.
- Base PR26: 7f68d38436a75ca3a84c087ca36d689f79ecd31e.
- Main incorporado: 74bb52ab; merge local 87714db7; conflicto solo en índice regenerado.
- SDD: 0438-portal-profile-functional-remediation.
- Estado: lista-para-revision local. Claim propio se libera al terminar este commit; árbol se conserva.

## OBJETIVO ORIGINAL

Corregir backfill A→B→C para seguir al superviviente terminal válido, preservando
IDs/cardinalidad/cuotas/tenant y abortando atómicamente ante corrupción de la cadena.

## ALCANCE Y PERMISOS

Director autoriza implementación focal tras reproducción y metadata. Allowlist:

- supabase/migrations/0446_portal_profile_functional_remediation.sql
- supabase/tests/0446_portal_profile_functional_remediation.test.sql
- docs/specs/0438-portal-profile-functional-remediation/spec.md
- docs/specs/README.md (solo generador)
- .agents/handoffs/pr26-profile-merge-chain-20260906.md

Ruta adicional aprobada por Director: scripts/qa/profile-merge-chain.mjs. Usa merge_clients0361 real y cadena0445→0446→0447 con SHA de privacidad explícito. No editar0445/0361/0447/0449.
Commits locales autorizados; push/main/Cloud/cleanup prohibidos. No verify/build
masivo mientras PR28 tiene slot. No se copian secretos ni archivos.env.

## COMPLETADO

Aislamiento/claim/merge listos. Lectura confirma que el guard rechaza B.deleted_at
y el UPDATE solo avanza un salto. Eso aborta A→B→C válido si B ya fue retirado.
Metadata list_migrations de xpfuzqombmjmxvprjgmi: 409 entradas; 0445 presente
(20260904193612), 0446 ausente por nombre exacto/prefijo. No se leyeron filas de
negocio; no demuestra ausencia de SQL manual sin ledger. Director corroboró.

## VALIDACIÓN

Reproducción del auditor: profile-chain-evidence/sql-results.json,
real_merge_A_into_B_then_B_into_C_before_0446 → 0446_ABORTS_VALID_HISTORY;
otras seis verificaciones PASS. Pendiente ejecución propia focal con fixtures.

## COMMITS

87714db7: incorpora main y resuelve únicamente el índice mediante generador.

## PR / BRANCH

PR fuente https://github.com/hailuwaycom-sketch/DTDCARGO/pull/26.
Rama local de corrección separada; no se publica ni altera la rama remota del PR.

## PENDIENTES DE ESTA TAREA

Revisión independiente de locks/latencia y validación general cuando Director asigne recursos; implementación focal y pruebas terminadas.

## FUERA DE ALCANCE DETECTADO

Incidencia Storage de PR27 informada por Director: no se corrige aquí.

## HANDOFF AL DIRECTOR

Escritura terminada tras este commit; PR33 intacto. Director recibe el SHA local; conserva ambos árboles y no publica sin autorización.

## Resultado de implementación para revisión

El backfill resuelve el cliente terminal por cada origen del ledger, detecta ciclos
con UUIDs visitados y rechaza tenant nulo/distinto en todos los saltos, destino
inexistente, terminal retirado y origen activo con sucesor. Solo actualiza client_id:
IDs, tenant, estado, fechas, rutas históricas y cupo se conservan. No reescribe0361,
0445 ni0447. No consulta filas de Cloud ni modifica archivos del PR33.

Propuesta implementada y pruebas reproducibles: scripts/qa/profile-merge-chain.mjs.
Requiere Docker y blobs inmutables explícitos:

```powershell
node scripts/qa/profile-merge-chain.mjs --baseline-ref 7f68d38436a75ca3a84c087ca36d689f79ecd31e --privacy-ref 82fc49ff0a81c88929fdd0493ded27e9e8c1f0a2
```

No usa rutas del auditor, credenciales ni.env. Soporte de tablas de0358; funciones
0361/0080/0351 y migraciones0445/0446/0447 reales, sin sustituir merge_clients.
No equivale a un rebuild de todo el sistema. Si falta el blob0447 falla claramente.

Validación focal:

- PASÓ: regresión antigua RED confirmada; GREEN corregido A→B→C,16saltos reales,
  fan-in,idempotencia y conservación del ledger.
- PASÓ: ciclos/self-loop/destino ausente/terminal retirado/tenant intermedio y
  terminal/tenant del ledger/origen activo; rollback completo aunque ya se hubiera
  reparado otra cadena válida antes del error. Compara ledger entero, historia de
  clientes, cuerpo RPC anterior y ausencia de DDL parcial.
- PASÓ:0445→0446→0447 con merge real repetido, cuota agotada, aislamiento/ACL.
- PASÓ: contrato SQL0446 existente completo con nuevo histórico de dos saltos.
- PASÓ: docs:check, governance:check, numbering, node --check y diff --check.
- NO DISPONIBLE: components:check, falta ajv (dependencias no instaladas aquí).
- NO EJECUTADO: verify/build/rebuild masivos por coordinación de recursos PR28.
- NO EJECUTADO: corrida sobre datos reales, aplicación Cloud, medida de latencia.

Logs sintéticos locales: %TEMP%/pr26-merge-chain-red.log (antes del arreglo),
%TEMP%/pr26-merge-chain-final.log (última corrida). El runner imprime JSON con
refs y escenarios; no inventa conteos ni reutiliza resultados de otro SHA.

Revisión de locks pendiente del auditor: el backfill adquiere SHARE ROW EXCLUSIVE
sobre clients y ledger; lectores normales continúan y escritores esperan hasta
commit. CREATE TRIGGER previo adquiere locks sobre solicitudes/clientes: revisar
inversión potencial con merge_clients0361 y otras escrituras concurrentes. No se
ha medido concurrencia entre DDL y tráfico real ni se promete ausencia de deadlock.
Planificar ventana y timeout/reintento de migración autorizado; un fallo debe revertir
la transacción completa. No aplicar para satisfacer un gate preintegración.

Privacidad advisory: CORRECTO en0446 bloque backfill, no cambia tenant ni copia
campos personales, ni imprime IDs/rutas en errores. NO VERIFICABLE retención y
latencia productivas. No hay cambios de UI; UI-CHECK no aplica a este delta SQL.

Revisión independiente solicitada sobre el próximo SHA local. Publicación sigue
prohibida; conservación del worktree requerida. Hallazgo StoragePR27 fuera de alcance.
Última corrida:14 grupos JSON esperados (1control RED original +13 GREEN), incluido tenant nulo: PASÓ. Solo se retiraron contenedores propios del runner. El commit que contiene este handoff fija el SHA de revisión; se reporta por mensaje para evitar autorreferencias.
