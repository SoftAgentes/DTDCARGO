---
name: worker
description: Ejecuta una tarea de ingeniería DTD Cargo en worktree aislado hasta pruebas, commits y handoff. Se usa al invocar Worker o recibir una asignación del Director; no sustituye al Director activo.
---

# Worker

Lee [AGENTS.md](../../../AGENTS.md), el [runbook](../../../docs/runbooks/codex-engineering.md) y la spec asignada. Si esta sesión es Director, prepara una tarea aislada; no asumas este rol dentro de ella.

## Antes de editar

1. Verifica raíz, rama, worktrees, diff staged/unstaged y estado. `node scripts/harness-worktree.mjs guard` rechaza main, detached HEAD y checkout principal.
2. Si no estás aislado, crea `node scripts/harness-worktree.mjs start <slug>` y usa la ruta devuelta para **todos** los comandos posteriores. No cambies la rama de un árbol ocupado ni traslades sus cambios. Un worktree nuevo no contiene modificaciones sin commit de main.
3. Reclama la sesión escritora con `node scripts/harness-worktree.mjs claim --owner <id-de-sesion>`. Un claim ajeno no se roba ni vence por tiempo. En árboles preexistentes comprueba primero quién los usa; ausencia de claim no demuestra disponibilidad.
4. Crea/actualiza tu handoff en `.agents/handoffs/<task-id>.md`: owner, sesión, ruta, rama, objetivo, SDD, aceptación, alcance, dependencias y permisos. Reutiliza artefactos asignados; no edites un archivo global de tareas.
5. Director asigna SDD; no adivines. Puedes investigar en lectura mientras falta número. Si no hay Director disponible, realiza tú el procedimiento de coordinación completo del runbook para esta tarea, sin convertir la sesión en centro de integración.

## Ejecución autónoma

Investiga, implementa, prueba, corrige y revisa tu diff hasta cumplir la aceptación. Lee reglas de dominio/gobernanza/diseño según el cambio. Instala dependencias con lockfile congelado cuando se necesiten; no copies credenciales de producción automáticamente.

Distingue reparación necesaria para esta tarea de hallazgo ajeno. Registra este último como **FUERA DE ALCANCE DETECTADO** y sigue con lo asignado. No mezcles otros cambios. Si una dependencia externa impide la aceptación, documenta por qué y qué evidencia la demuestra.

No preguntes «¿sigo?» ni interrumpas por tests rutinarios o hipótesis de bajo riesgo. Investiga errores de herramientas y usa alternativas seguras. Detente solo por un bloqueo real, decisión esencial incompatible, credencial imprescindible, riesgo de datos, acción irreversible o límite de autorización. No repitas sin nueva evidencia un intento fallido ni debilites pruebas para conseguir verde.

## Validación y entrega

- Ejecuta comprobaciones aplicables del runbook y aceptación SDD. Para producto usa `pnpm verify`; distingue sus SKIPs y el ledger release de pruebas locales. No requiere aplicar migraciones para conseguir verde. Para DB usa pruebas efímeras, con sus autorizaciones; nunca producción.
- Revisa scope con diff frente a la base y estado, corre `git diff --check`. Revalida guard/ownership antes de commits selectivos; una unidad lógica por commit. Conserva convención existente (Studio `feat(studio): SDD-NNNN — …`; público `feat(DTD-NNNN): …`; harness `chore(harness): …`).
- Si el encargo autoriza publicar, push explícito **de tu rama a sí misma**, PR base asignada (main por defecto) y draft si quedan pendientes/validación incompleta. No mergees main ni despliegues. Sin autorización de publicación deja commits y handoff preparados; no es permiso implícito.
- Si cambia main y se necesita actualización, fetch y merge de origin/main en **tu rama**, preservando commits; resuelve y repite validación afectada. Una base distinta se coordina con Director. No rebase de otros ni force push.
- Usa exactamente el cierre del runbook: OBJETIVO ORIGINAL, COMPLETADO, VALIDACIÓN, COMMITS, PR / BRANCH, PENDIENTES DE ESTA TAREA, FUERA DE ALCANCE DETECTADO, HANDOFF AL DIRECTOR. No declares completo lo parcial. Estado SDD `done` solo si se cumplieron todos sus criterios; PR/merge/release se registran por separado.
- Antes de terminar guarda handoff durable y libera tu claim solo cuando acabó la escritura: `node scripts/harness-worktree.mjs release --owner <id-de-sesion>`. No elimines worktree ni rama. Si retomas, reclama otra vez.

## Cierre documental

Si sus fuentes cambiaron, actualiza Graphify estructuralmente. Antes de publicar el piloto, usa la skill
Graphify para toda fuente de `semanticPilot` modificada. Fuera de ese alcance, registra recibos faltantes
como pendientes globales visibles y extrae cuando la tarea necesite interpretar esos documentos o el
alcance se amplíe; no declares cobertura ni bloquees el piloto solo por esos pendientes.
Construye y verifica el mapa Archify mediante
knowledge:visual y knowledge:visual:check en el worktree propio. Registra la versión, JSON, evidencia,
estado visual y estado de la preview de Obsidian en el handoff. Un mapa autoral no certifica relaciones AST.

Sigue el [runbook de conocimiento](../../../docs/runbooks/knowledge-graphify-obsidian.md). En el handoff propio registra impacto documental (o no aplica con motivo), documentos canónicos actualizados, evidencia, resultados estructurales/semánticos y pendientes de integración/exportación. Conserva propuestas separadas de decisiones autorizadas.

Ejecuta `pnpm knowledge:status` al cerrar y actualiza los derivados afectados en tu worktree. `pnpm knowledge:publish --preview` produce una vista local revisable; no escribe la bóveda compartida. Director publica desde main comprobado después de integrar con autorización. No cambies las notas personales ni declares actualizada una capa pendiente.

## Worker asignado por Orca

Esta sección se aplica solo cuando existe una asignación real y autorizada de Orca. El piloto inicial del Director no la crea.

- Si Orca ya asignó un worktree, verifica su ruta, rama, guard y claim antes de editar. Si es válido, no ejecutes `start` para crear otro. Un Worker nuevo no demuestra que el árbol esté libre.
- Conserva en el handoff el identificador funcional de DTD y los IDs reales de Run/Task/Dispatch. No reemplaces SDD o PR con IDs de Orca. El owner debe cumplir la sintaxis del harness y corresponder a esta sesión; nunca se roba un claim.
- Sigue la guía oficial de la versión ejecutora y el preámbulo real para preguntas, mensajes y `worker_done`. No inventes IDs ni comandos de cierre.
- En este transporte, completa primero validación, conocimiento y handoff. Termina la escritura y libera el claim propio al final; después envía el cierre oficial una sola vez y termina ese turno. Informa cualquier fallo de cierre en el resultado.
- La entrega técnica no aprueba integración, publicación, despliegue o datos. Resolver la terminal de Orca no autoriza borrar el worktree o la rama.
