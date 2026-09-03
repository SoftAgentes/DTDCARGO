# Multi-ventanas — mensajes de trabajo con alcance explícito

Dueño: ingeniería · Estado: vigente operativo · Actualizado: 2026-09-02 · Interno.

Estas plantillas distinguen roles; no imponen un coordinador central a todas
las sesiones. La política está en [`AGENTS.md`](../../AGENTS.md) y el procedimiento
en [worktrees y cierre seguro](git-worktrees-multiventana.md). No sustituyen el
GO de Sam ni los controles de permisos de Codex.

## Una tarea continua no requiere muchas tareas de Codex

Reutilizar la tarea y el worktree aislado cuando pertenezcan al mismo objetivo.
No crear otra tarea visible, archivar tareas ajenas ni abrir worktrees sólo por
dividir una lista. La delegación se usa cuando esté autorizada y tenga ownership
acotado; nunca permite compartir un índice de escritura entre agentes.

## Apertura de un worker aislado

Plantilla para una tarea **designada worker**, no para redefinir todas las
sesiones autónomas. Sustituir los marcadores antes de usarla:

```text
Tarea: <objetivo concreto y criterio de aceptación>.
Worktree asignado: <ruta absoluta>. Rama: <rama>.
Alcance de archivos: <allowlist inicial>.

Lee AGENTS.md y docs/runbooks/git-worktrees-multiventana.md.
Confirma raíz, rama, HEAD, índice, cambios locales y otras tareas activas.
Si el carril o la propiedad no coinciden, no escribas ni cambies de rama:
informa la discrepancia. No absorbas cambios ajenos.

Trabaja sólo el alcance autorizado. Usa SDD cuando corresponda, pruebas del
repo y commits atómicos con rutas selectivas. Reporta errores y SKIP como tales.
No copies secretos de otro checkout ni ejecutes el start/finish heredado.

Este rol no integra main ni despliega. Publicar su propia rama requiere GO
explícito del destino y alcance; si es secundario de Modo Forja, no hace push.
Deja handoff con SHA, archivos, evidencia, omisiones y siguiente responsable.
```

Si sólo se pide análisis, esta plantilla no autoriza implementación. Una
base desactualizada tampoco autoriza merge, pull, rebase o reset durante el cierre.

## Integración exclusiva

Usar sólo cuando Sam asigne la integración y el checkout no esté en uso por
otra tarea. No ejecutar este mensaje como consecuencia de leerlo:

```text
Integra únicamente el lote aprobado: <ramas y SHA exactos>.
Destino autorizado: <repositorio y rama>. Operaciones autorizadas: <lista>.

Confirma exclusividad, ownership y estado limpio. Refresca referencias y
compara los SHA con el remoto; no asumas que main local está al día.
Revisa los handoffs, commits, colisiones de numeración y orden app/migraciones.
No integres ramas sólo porque estén commiteadas o sus tareas estén archivadas.
Si hay cambios ajenos, divergencia o un gate de release pendiente, informa y
conserva el estado. No uses comandos destructivos para conseguir un árbol limpio.

Con los permisos aplicables, verifica la integración con el gate canónico y
build proporcionales. Publica sólo el lote/destino aprobado. Mide CI y deployment
por SHA: push, Preview y producción no son equivalentes.
Migraciones y escrituras alojadas exigen sus autorizaciones independientes.
Retira worktrees únicamente después de todas las pruebas del runbook de limpieza.
```

## Cierre de trabajo, sin pérdida de continuidad

```text
Guarda sólo el trabajo propio de esta tarea con staging selectivo y las pruebas
correspondientes. No hagas push, integración, deploy, migraciones ni limpieza
fuera del GO ya concedido. Un rechazo de permisos requiere nueva autorización.

Entrega: rol, rama/worktree, SHA, rutas propias, pruebas/omisiones, estado remoto,
handoff y pendientes. Preserva carpetas, ramas, archivos ignorados necesarios y
tareas con cierre bloqueado. No conviertas un fallo en un cierre aprobado.
```

El archivo de continuidad vive en `.agents/handoffs/` de la rama propia.
Los criterios de borrado están sólo en el runbook principal; no se duplican
como un atajo en cada prompt. Abrir una carpeta: [guía breve](abrir-ventanas-worktree.md).
