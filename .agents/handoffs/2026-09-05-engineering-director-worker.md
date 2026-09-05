# Handoff — migración Director/Worker

Fecha: 2026-09-05 · Owner: Codex, tarea engineering-director-worker.
Sesión/claim: codex-engineering-migration-20260905.
Estado: lista-para-revision (implementación terminada; integración no autorizada).
Worktree: C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/engineering-director-worker.
Rama: codex/engineering-director-worker.
Base: origin/main@b8294664a1b4f9e25c423dd814f4813fa5b1be8f.
SDD: docs/specs/0444-engineering-director-worker/spec.md.
Aceptación y allowlist: spec; permisos: commits + push rama propia + PR de revisión.
Prohibidos en el encargo: merge, producción, reglas GitHub, borrar trabajo previo.

## OBJETIVO ORIGINAL

Implementar metodología nativa Codex con Director/Workers aislados, PR, SDD,
autonomía, continuidad entre días y limpieza segura sin interrumpir sesiones.

## COMPLETADO

- Dos skills repo-scoped y metadata, invocación $director / $worker.
- AGENTS compacto, conocimiento técnico conservado en docs/engineering/project-rules.md.
- Runbook de asignación, SDD, integración, release, cleanup y adopción gradual.
- Wrappers Claude y multiventana sustituyen instrucciones contradictorias.
- Guard y claims por sesión; start sin copia de secretos; finish solo informe.
- Reservas SDD locales durables y publicación create-only a rama numérica.
- Briefing JSON reproducible de Git/GitHub y solapamientos.
- Gate harness en verify y comandos harness:status / harness:test.
- Auditoría, spec e índice generados, sin cambiar funcionalidades de producto.

## VALIDACIÓN

PASÓ:

- `node --test scripts/tests/director-status.node.mjs scripts/tests/harness-worktree.node.mjs scripts/tests/next-number.integration.node.mjs`: 12/12.
- Vitest heredado `scripts/next-number.test.mjs`: 8/8.
- Validador oficial quick_validate.py: Director y Worker válidos.
- Lint ESLint focalizado sobre scripts nuevos/modificados.
- docs:index, docs:check, sdd:check y git diff --check.
- Snapshot real: 5 worktrees, 38 refs, 9 PR, 21 pares con archivos compartidos.
- Revisión conceptual independiente: ocho escenarios del encargo.
- Revisión de scripts por otro agente: sin hallazgos accionables.
- Sintaxis de verify y compatibilidad de argv --test con su runner.

NO EJECUTADO (no aplica a cambios solo de harness): build/E2E/SQL y suite completa
de producto. NO EJECUTADO por alcance: ledger/lecturas Cloud, migraciones y deploy.
No se afirma verde global de producto. Código probado es el diff de esta rama;
SHA definitivo y checks del remoto deben consultarse en el PR después del push.

## COMMITS

Unidades previstas y verificables en git log de esta rama:
1. docs(harness): SDD-0444 — metodología Director/Worker y continuidad.
2. chore(harness): SDD-0444 — aislamiento, reservas e inventario verificables.

Los hashes definitivos se registran en descripción de PR y respuesta de entrega,
sin crear commits recursivos para el hash del propio documento.
Identidad Git del agente usada por comando: Codex <codex@openai.com>;
no se modificó identidad global ni configuración compartida.

La reserva local conserva stub b7874e9623646097e88625516c1dd8519f175721
en codex/sdd-reserve-0444-engineering-director-worker y refs/dtd/reservations/0444.
No es otra tarea pendiente ni prueba de publicación remota; la spec completa
viaja con la rama de migración. No reciclar su ID.

## PR / BRANCH

Rama: codex/engineering-director-worker · base main.
PR draft se prepara/publica como entrega. Consultar asociación durable con:
`gh pr view codex/engineering-director-worker`.
El número/URL final y estado de checks se registran en la entrega.

## PENDIENTES DE ESTA TAREA

Ninguno para la implementación solicitada. Revisión/merge/adopción requieren
la autorización posterior excluida de este encargo; no se ejecutan automáticamente.

## FUERA DE ALCANCE DETECTADO

- main sin protección/rulesets; identidad actual comparte privilegio administrativo.
- CI de calidad vive en #21, todavía no main; ordenar esa integración aparte.
- PR #23 tenía Vercel ERROR; #28/#29 comparten 0440 en título y 0435 tiene variantes
  entre ramas. No asumir que son tareas independientes; no se arreglaron aquí.
- Configuración efectiva/SHA producción y rollback global no verificados.
- Worktrees previos siguen con sus propias sesiones y cambios en curso.

## HANDOFF AL DIRECTOR

Revisar PR y head/base actuales; adoptar solo tras merge autorizado. Antes de
merge verificar efectos automáticos sobre producción y sus permisos.
Archivos compartidos con otros trabajos potenciales: AGENTS, package.json,
scripts/verify.mjs, numeración, índice de specs y runbooks. Esta tarea no integra
otras ramas. Revisar #21 por cambios de CI y scripts, sin mezclar su alcance.

La rama y worktree se conservan, sin cleanup. Se libera claim al finalizar la
escritura; su presencia/ausencia real se comprueba con harness-worktree/metadata
Git, no con esta frase. No archivar ni borrar sesiones/worktrees anteriores.
Para probar antes del merge: abrir este worktree e invocar $director;
Workers piloto deben partir de esta rama con --from codex/engineering-director-worker
para tener las skills nuevas. Tras merge, start usa origin/main normal.
