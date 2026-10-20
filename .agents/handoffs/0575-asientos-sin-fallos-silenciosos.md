# Handoff · SDD-0575 · Contrato transaccional propuesto

Fecha: 2026-10-20. Estado de esta subtarea documental: lista para revisión del Director. La SDD permanece en `draft`; implementación no aprobada.

## Adopción y ownership

- Owner: `codex-0575-contrato-docs-01a15a4e`, subagente documental del Director Codex; sesión raíz `01a15a4e-ddf0-7d82-8656-d9dc56b58468`.
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/sdd-0575-asientos-sin-fallos-silenciosos`.
- Rama: `codex/sdd-0575-asientos-sin-fallos-silenciosos`.
- HEAD recibido y remoto verificado antes de editar: `b4bd7cc23394fde1e8543ffc400e271bbd2b9006`.
- Se adopta explícitamente AGENTS del ámbito y la skill Worker/runbook Director–Worker vigentes. Se conservan rama, base, worktree y trabajo anterior. El antecedente documental de las cinco decisiones permanece en `b4bd7cc2`.
- El Director mantiene la adopción autorizada de la sesión preexistente y la pausa de las sesiones Claude. Se verificaron raíz/rama/HEAD, árbol limpio, ausencia de claim y ausencia de consumidores visibles por referencia de ruta en procesos. Una primera lectura paralela vio el otro proceso PowerShell de esta misma comprobación; la repetición secuencial dio cero consumidores. La inspección de procesos no demuestra ausencia universal de sesiones en espera; se combina con el traspaso explícito del Director.
- Guard y claim propio adquiridos antes de editar. Ownership: retenido durante este bloque; liberación pendiente al terminar la escritura.
- Autorización: conservar la propuesta revisada y las correcciones verificadas; validación documental mediante entradas Node directas; commit selectivo y push de esta rama a sí misma. Sin producto, SQL, tests, migraciones, reservas, instalaciones, DB, .env, PR nueva, merge, deploy ni actualización de conocimiento global.

## OBJETIVO ORIGINAL

Conservar en la tarea la propuesta temporal de contrato y sus contradicciones verificadas, manteniendo las cinco decisiones aceptadas y separando la dirección revisada de los contratos que el Director cerrará con el Worker antes de producto.

Allowlist exacta de esta subtarea:

- `docs/specs/0575-asientos-sin-fallos-silenciosos/spec.md`.
- `docs/specs/0575-asientos-sin-fallos-silenciosos/assets/contrato-transaccional-propuesto.md` (nuevo).
- `.agents/handoffs/0575-asientos-sin-fallos-silenciosos.md`.
- `docs/specs/README.md`, solo mediante el generador si requiere cambio.

## COMPLETADO

- Conservado el asset completo con enlaces relativos al repositorio y atribución de la propuesta temporal SHA256 `177d4b07450cded9f229358ef4bf0eb4c043788f29f019db842e9474a22ce760`. La revisión original se atribuye a main `8e9e0f505322cd57b3230cce6b16b45b5554cb8a`; sus refs de dependencias son evidencia fechada, no base integrada actual.
- Corregida la spec: origen contable `supplier_bill` sin renombrado indiscriminado de un kind de UI; índice de gasto `je_one_live_entry_per_expense` existente; distinción entre asiento asentado válido y predicado de unicidad.
- Conservadas las cinco decisiones aceptadas: RPC por documento, cierre gobernado por 0566 sin refecha, sección en Por contabilizar, tres PR secuenciales y gasto desde 0575-a.
- Registrada como dirección revisada la separación de resultados, subbloque reversible/motivo exterior condicionado a commit, ensayo sin efectos, reconciliación del desconocido y guarda de cierre en la mutación de origen.
- Conservadas como propuestas las firmas, permisos finales, capacidades de origen, listas por PR y base integrada. Número de migración pendiente. La matriz identifica diez casos transaccionales y no concede una excepción a service_role.
- El Director revisó el diff de spec y la matriz durante este bloque sin hallazgo adicional; la aceptación documental final sigue pendiente de cotejo del SHA, asset, handoff y rama remota.
- Índice regenerado mediante su entrada Node; no produjo cambios en `docs/specs/README.md`.

## VALIDACIÓN

- Identidad, árbol inicial limpio, remoto igual al HEAD y guard: PASÓ.
- Claim propio y consumidores visibles: PASÓ, con el límite de observación explicado arriba.
- `node scripts/build-docs-index.mjs`: PASÓ; 556 specs, 19 huecos; README generado sin cambios.
- `node scripts/build-docs-index.mjs --check`: PASÓ; índice sincronizado con 556 specs.
- `node scripts/check-numbering.mjs`: PASÓ; 556 specs, 488 migraciones y 11 excepciones históricas conservadas; ningún número nuevo ni reserva.
- Validador efímero mediante Node, sin crear scripts persistentes: PASÓ; tres documentos, 34 enlaces locales, 27 anclas comprobadas y cero destinos ausentes/fuera del repositorio. Dos enlaces externos de PostgreSQL conservados de la revisión original, sin reconsulta de red en este bloque.
- `git diff --check` y `git diff --cached --check`: PASÓ, incluido el asset nuevo incorporado al índice. Scope observado: los tres documentos de la allowlist, sin README generado modificado.
- Tests de producto/SQL, lint, build, verify, DB y producción: NO EJECUTADO por alcance documental explícito.

## COMMITS

El commit que contiene este documento conserva el contrato propuesto y las correcciones verificadas. Su SHA final y la igualdad local/remoto se entregan al Director tras el push, sin un commit recursivo para insertar el propio hash. El antecedente documental es `b4bd7cc23394fde1e8543ffc400e271bbd2b9006`.

## PR / BRANCH

Rama propia conservada: `codex/sdd-0575-asientos-sin-fallos-silenciosos`. Push autorizado a esa misma rama. No se abre PR ni se cambia la base. Revisión e integración pendientes del Director.

## PENDIENTES DE ESTA TAREA

- Revisión y aceptación final del documento por el Director sobre el SHA publicado. Contenido y validación documental preparados para ese cotejo.
- El cierre operativo confirma después de sellar este documento: commit/push, SHA local = remoto, ahead 0, árbol limpio y claim liberado. La conversación de entrega registra la evidencia final sin modificar de nuevo este commit.

Pendientes de la **SDD-0575**, fuera de este encargo documental pero no ajenos a la tarea:

- Cerrar con el Director y el Worker las firmas, permisos, composición 0566, guardas de origen y capacidades transaccionales, identidad/ciclo de vida del motivo, idempotencia y protocolo de reconciliación.
- Revalidar la base integrada de 0557/0559/0566/0569/0572/0573 e identificar el contrato/SHA de Caracas; el asset conserva únicamente el snapshot leído.
- Fijar los contratos y allowlists exactos de 0575-a/b/c y el límite/concurrencia del lote; las listas del asset son provisionales.
- Inventario y reserva del número de migración por el Director, sin renumerar una aplicada.
- Encargos de implementación posteriores y evidencia real de sus criterios; la SDD sigue en draft.
- Reparar, reasentar, leer o borrar datos mantiene autorización separada. Los casos de la radiografía son datos de prueba y no autorizan una operación de datos.

## FUERA DE ALCANCE DETECTADO

No se incorpora ningún hallazgo ajeno al alcance de la SDD-0575. Los pendientes de su futura implementación se registran arriba, separados del cierre de este encargo documental.

## HANDOFF AL DIRECTOR

Se entrega el diff documental para cotejo final antes de aceptar el documento. La dirección revisada no autoriza producto ni fija un número de migración. El orden de entrega sigue 0575-a → 0575-b → 0575-c.

Impacto documental: spec, asset y handoff propios; integración en main pendiente. Graphify estructural/semántico, Archify, knowledge:status, exportación y revisión visible en Obsidian: NO EJECUTADO por el alcance explícito de este encargo, que limita la validación a documentación/diff/enlaces. No se afirma actualizada ninguna capa derivada.
