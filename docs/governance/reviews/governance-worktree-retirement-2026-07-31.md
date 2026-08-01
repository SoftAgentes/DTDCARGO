# REV-SGE-033 · Auditoría y retiro seguro de worktrees históricos

| Control | Valor |
|---|---|
| Fecha | 2026-07-31 |
| Worktrees antes | 50 |
| Retirados | 31 |
| Conservados | 19 |
| Fallos | 0 |
| Ramas borradas | 0 |

## Criterio fail-closed

Sólo se retiró un worktree cuando cumplía simultáneamente:

1. ruta absoluta dentro de `C:/Users/Trabajo/Desktop/Developer/software/DTD-worktrees/`;
2. working tree limpio;
3. `HEAD` ancestro de `origin/main`;
4. no era el checkout principal ni el worktree de la tarea activa;
5. ninguna tarea activa lo poseía.

Se usó `git worktree remove` sin `--force` y luego `git worktree prune`. No se
borraron branches, refs ni commits; cualquier árbol retirado puede recrearse
desde Git.

## Conservados

Los 19 worktrees restantes se preservaron por una o más razones verificables:

- checkout principal y tarea activa;
- árboles administrados por Claude o por el cache de Codex;
- cambios sin commit;
- `HEAD` todavía no integrado en `origin/main`;
- ownership o utilidad histórica no demostrados como retirables.

En particular se conservaron `numeracion-y-poda` y `sdd-0225-registro` por
cambios locales, y todas las ramas no ancestro de `origin/main`. La auditoría no
interpreta “rama limpia” como “trabajo integrado”.

## Resultado

La deuda operativa bajó de 50 a 19 worktrees sin pérdida de trabajo y sin
interferir con otras sesiones. No queda autorizado retirar los 19 conservados
hasta que cada uno satisfaga nuevamente el criterio completo.
