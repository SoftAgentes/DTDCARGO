# Abrir una tarea en el worktree correcto

Dueño: ingeniería · Estado: vigente operativo · Actualizado: 2026-09-02 · Interno.

Primero localizar el checkout real; después abrirlo en la herramienta elegida.
Ni el título de una tarea ni mencionar una rama demuestra dónde trabaja el agente.

## Confirmación mínima

```powershell
git rev-parse --show-toplevel
git branch --show-current
git status --porcelain=v2 --branch
git worktree list --porcelain
```

Comparar esa ruta con el `cwd` de la tarea y con otras sesiones activas.
Si no coincide, detener la escritura y usar el carril correcto; no cambiar el
HEAD de un checkout compartido para acomodar la tarea.

En esta instalación, el principal está en
`C:\Users\Trabajo\Desktop\Developer\software\DTDCargo` y los workers en el
contenedor hermano `DTD-worktrees`. La lista de Git, no los nombres históricos
`seo` o `brochure`, dice qué carpetas existen hoy.

## Apertura y contexto

En Codex, reutilizar la tarea existente si continúa el mismo objetivo. Si Sam
pide expresamente otra tarea, seleccionar el proyecto/entorno apropiado y
verificar el worktree resultante antes de editar. En otra herramienta, abrir
explícitamente la carpeta validada y repetir la comprobación mínima.

Leer `AGENTS.md`, la spec y el handoff del trabajo. La disponibilidad de memoria
depende de la herramienta: no asumir memoria vacía ni usar main como carpeta
de edición sólo para recuperar historia.

Para preparar una carpeta nueva, dependencias y variables, seguir
[el runbook de worktrees](git-worktrees-multiventana.md). No copiar `.env.local`,
no ejecutar el helper heredado ni traer main automáticamente al abrir.
Para el mensaje de encargo, usar [la plantilla del rol](multi-ventanas-buena-practica.md).
