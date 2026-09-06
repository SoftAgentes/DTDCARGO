# Handoff — migración Director/Worker

Fecha: 2026-09-05 · Owner: Worker 01a073a6-f21d-7483-9b74-4d9f3464c295.
Task ID: 2026-09-05-ci-harness-remediation, unidad B.
Estado: lista-para-revision-local (corrección de la recepción de #32).
Worktree: C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/engineering-director-worker.
Rama: codex/engineering-director-worker.
Base: origin/main@b8294664a1b4f9e25c423dd814f4813fa5b1be8f.
SDD: docs/specs/0444-engineering-director-worker/spec.md.
Aceptación y allowlist: spec. Autorización vigente: trabajo y commits locales.
Prohibidos en esta corrección: push, publicación/actualización de PR, merge main,
producción, protecciones/credenciales y cleanup de ramas/worktrees.
Este alcance sustituye el permiso de publicación del encargo inicial.

## EXTENSIÓN ACTUAL — SDD-0360

Task ID: 2026-09-05-destino-focus-extract. Estado: combinación local en validación.
El Director publicó c36d7e26 en #32; CI detectó la carrera de foco de main antes
de llegar al harness. Ahora se incorpora A/cf1570d6 con el arreglo de producto
ef99fca5fff6cf9b4562255370876313ffd7ced3, sin cambiar workflow ni gates.
Allowlist adicional: cinco paths de SDD-0360 y handoffs/specs0349/0444 solo
para coordinación/dependencia/evidencia. Se conservan C3 y harness:test.

Dos regresiones de frames fallaron sobre original y pasan 13/13 focales con
el arreglo exacto de46afa953; las diez previas permanecen intactas. Fixture
local ficticia pasó teclado, mouse, Escape y cursor manual. Verify completo
se ejecutará aquí sobre el producto combinado; no se duplica suite/build en
A ni extracción si sus árboles de producto son equivalentes. Ver
[handoff SDD-0360](2026-09-05-destino-focus-extract.md).
Push/actualización de #32 reservados al Director. El historial inferior conserva
la corrección previa de CI y no constituye evidencia alojada de esta extensión.

## CORRECCIÓN COMPLETADA LOCALMENTE

Punto de partida: PR draft #32, HEAD local/remoto original
2db92f9979ef3380cc608d2f5ea8ce3d4bfaac2c. Los commits de corrección se conservarán
solo localmente; #32 seguirá mostrando el estado anterior hasta autorización.

- C3 restaurado: RLS habilitado en toda tabla nueva; aislamiento por tenant
  cuando corresponde; DDL destructivo exige default/respaldo y estrategia
  segura revisada. Un default no recupera datos eliminados. Ninguna regla
  autoriza DDL ni migraciones productivas.
- CI base: extracción mínima A/SDD-0349 desde #21, incorporada por merge local.
  B añade ejecución explícita de pnpm harness:test al job de calidad.
- Regresión: contrato del workflow debe rechazar omisión, comentarios/echo,
  condiciones y tolerancia de errores en paso o job.
- Documentación: CI alojada y protecciones siguen pendientes; #21 y #32
  completos siguen teniendo conflictos técnicos, no son intercambiables.

La validación de esta revisión se registra a continuación; el bloque histórico
inferior solo prueba el estado original. Cierre mediante un commit merge local
con A como segundo padre; SHA definitivo en el reporte del Worker, sin añadir
otro commit para insertar el hash de este mismo documento.

Dependencia A: c6ffc009e5c7580b156cdab9fba0b88d14ee6575, rama
codex/ci-quality-extract-20260905, base b8294664. El único conflicto de ese
merge local fue docs/specs/README.md; se resolvió con su generador, conservando
ambas specs. No se hizo merge de la rama de saneamiento.

Allowlist incremental de esta corrección: .github/workflows/quality.yml;
scripts/__tests__/ci-workflow-contract.test.mjs; .harness/CHECKPOINTS.md;
docs/runbooks/codex-engineering.md; specs 0349/0444; docs/specs/README.md;
los handoffs de A y B. Son nueve paths frente al HEAD inicial de #32.

## VALIDACIÓN DE LA CORRECCIÓN

- PASÓ: frozen install sin modificar manifest/lockfile.
- Regresión demostrada: antes del paso nuevo, el contrato focal falló con
  "Falta un único paso ejecutable pnpm harness:test". Después pasaron los
  16 contratos de CI y los 8 tests heredados de numeración (24/24).
- El contrato parsea YAML con js-yaml, dependencia ya declarada por ESLint,
  resuelta desde su paquete. No se añade dependencia ni se modifica lockfile.
- PASÓ: ESLint focal del contrato; diff-check de la corrección.
- PASÓ en la combinación: ESLint completo (0 errores, 8 warnings heredados),
  frontera RSC, prune-next-types, TypeScript con heap 4096 y cuatro Edge Functions
  con Deno 2.9.6 temporal verificado al preparar A; sin SKIPs en B.
- PASÓ: Vitest completo, 501 archivos / 6188 pruebas, 205,15 segundos. Incluye
  los contratos de CI/numeración, pero no cuenta los tests .node.mjs.
- PASÓ: pnpm harness:test, 12/12 pruebas Node, 0 fallos y 0 SKIPs.
- PASÓ: docs:check, sdd:check, constantes, components:check y governance:check.
- BUILD: primer intento falló al solicitar Noto Serif SC .74.woff2 a
  fonts.gstatic.com, con cuatro errores derivados de Turbopack (35 segundos).
  PASÓ el reintento aislado del build: 158 páginas, 92 segundos, tsconfig.json
  restaurado. No se cambió producto ni pruebas, ni se sustituyeron fuentes.
- NO EJECUTADO: Actions alojado de este SHA, SQL/E2E/ledger, despliegue.
  No se invoca verify completo porque incluye gates externos a este encargo.

Runner local expande los scripts pnpm a sus entrypoints Node; harness:test se
invocó mediante pnpm. Ambiente hijo con CI=true, NEXT_TELEMETRY_DISABLED=1,
credenciales y flags VERIFY_SKIP retirados; TypeScript/build con heap 4096.
Continúa después de un fallo para registrar todos los gates; el job alojado
se detiene en el primero. Logs locales en %TEMP%/dtd-ci-combined-B/; la evidencia
durable son estos resultados y los contratos versionados, no un verde alojado.

## CONFLICTOS PENDIENTES CON #21 COMPLETA

Intersección medida entre los diffs base b8294664 → #21 ea9952a4 y
base b8294664 → #32 2db92f99 (diez paths):

- .claude/commands/feature.md
- AGENTS.md
- docs/runbooks/abrir-ventanas-worktree.md
- docs/runbooks/git-worktrees-multiventana.md
- docs/runbooks/multi-ventanas-buena-practica.md
- docs/specs/README.md
- package.json
- scripts/__tests__/harness-worktree.test.mjs
- scripts/harness-worktree.mjs
- scripts/verify.mjs

Además, #21 agrega scripts/__tests__/harness-operation-paths.test.mjs y
scripts/__tests__/harness-worktree-safety.test.mjs, que importan
runWorktreeCommand y prueban finish con eliminación; esa exportación no existe
en B, cuyo finish solo informa. No reincorporar esos tests ni sustituir el
script sin rediseñar su contrato. En AGENTS, trasladar a project-rules las
correcciones técnicas sobre rutas/env y semántica de ignoreCommand (Markdown
raíz frente a subcarpetas, y docs/marketing), conservando el modelo Director/Worker.
package.json y verify deben preservar comandos y gates de ambas ramas que
apliquen; el índice se regenera. Requiere revisión semántica y validación nueva.
La extracción A y el pase combinado B no aprueban ni vuelven compatible #21.

## HISTORIAL DEL ENCARGO INICIAL

Los bloques siguientes conservan la evidencia de implementación inicial;
no autorizan publicación ni sustituyen la validación de la corrección actual.

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
PR draft inicial: https://github.com/hailuwaycom-sketch/DTDCARGO/pull/32.
Esta revisión no la actualiza. Consultar asociación durable con:
`gh pr view codex/engineering-director-worker`.
El número/URL final y estado de checks se registran en la entrega.

## PENDIENTES DE ESTA TAREA

Ninguno de implementación/validación local. La ejecución alojada posterior,
publicación, revisión/merge/adopción requieren autorización y no se ejecutan
automáticamente. El CI alojado previo de #21 no valida estos SHA.

## FUERA DE ALCANCE DETECTADO

- main sin protección/rulesets; identidad actual comparte privilegio administrativo.
- CI mínimo se extrae como A/SDD-0349; no está en main ni se publica en este encargo.
- PR #23 tenía Vercel ERROR; #28/#29 comparten 0440 en título y 0435 tiene variantes
  entre ramas. No asumir que son tareas independientes; no se arreglaron aquí.
- Configuración efectiva/SHA producción y rollback global no verificados.
- Worktrees previos siguen con sus propias sesiones y cambios en curso.

## HANDOFF AL DIRECTOR

Revisar PR y head/base actuales; adoptar solo tras merge autorizado. Antes de
merge verificar efectos automáticos sobre producción y sus permisos.
Archivos compartidos con otros trabajos potenciales: AGENTS, package.json,
scripts/verify.mjs, numeración, índice de specs y runbooks. Esta tarea no integra
el saneamiento completo de #21: solo incorpora la extracción mínima A.
Ambas PR comparten diez paths. #21 agrega tests que importan runWorktreeCommand,
ausente en #32, y espera eliminación en finish; #32 conserva finish como informe.
Revisar esos contratos y portar las correcciones técnicas de AGENTS de #21 a
project-rules antes de cualquier integración posterior; no resolver por ours/theirs
de archivos completos ni declarar compatibilidad a partir de esta extracción.

La rama y worktree se conservan, sin cleanup. Se libera claim al finalizar la
escritura; su presencia/ausencia real se comprueba con harness-worktree/metadata
Git, no con esta frase. No archivar ni borrar sesiones/worktrees anteriores.
Para probar antes del merge: abrir este worktree e invocar $director;
Workers piloto deben partir de esta rama con --from codex/engineering-director-worker
para tener las skills nuevas. Tras merge, start usa origin/main normal.
