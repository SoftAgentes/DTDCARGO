# Runbook — Worktrees: aislamiento, publicación y limpieza segura

Dueño: ingeniería · Estado: vigente operativo · Actualizado: 2026-09-02 · Interno.

Esta guía explica cómo trabajar sin mezclar cambios ni perder trabajo al cerrar.
No autoriza comandos por sí misma. La política fuente sigue en
[`AGENTS.md`](../../AGENTS.md); los permisos concretos de la tarea y los controles
de la herramienta también se respetan. No se modifica esa política aquí.

## 1. Identificar el rol antes de actuar

`AGENTS.md` define ventanas autónomas por defecto y secundarios de Modo Forja.
No existe una prohibición universal de publicar desde toda rama secundaria ni
un coordinador central obligatorio para cualquier sesión. Pero tampoco una
autorización universal para hacer push: manda el rol y el GO de la tarea.

| Contexto | Límite |
|---|---|
| Sesión autónoma según `AGENTS.md` | Sólo su trabajo; publicación y cierre con autorización, sin absorber cambios ajenos |
| Secundario de Modo Forja | Su worktree, rama, verificación y commit; nunca push ni migraciones alojadas |
| Worker de Codex bajo `source-command-cerrar` | Commit selectivo y, con GO, push de su rama; no integra main ni se elimina a sí mismo |
| Integración/cierre exclusivo en Codex | Operación separada del worker: integrar/publicar/limpiar sólo con autoridad y exclusividad verificadas |

El protocolo `source-command-cerrar` puede ser más restrictivo que el flujo
autónomo general. En ese cierre no se resuelve una divergencia con merge,
rebase, reset o force-push: se conserva el trabajo y se entrega al integrador.
Una instrucción antigua, un objetivo continuo o un resultado verde no amplían
un GO limitado a cierto SHA, rama o servicio. Un rechazo de permisos no se rodea.

## 2. Ubicación e inventario

En esta instalación el checkout principal es
`C:\Users\Trabajo\Desktop\Developer\software\DTDCargo`; los worktrees viven
en el contenedor hermano `C:\Users\Trabajo\Desktop\Developer\software\DTD-worktrees`.
En otra máquina, obtener primero la ruta principal con `git worktree list`:
no reutilizar rutas antiguas del Escritorio ni inventar lanes por nombre.

Desde el checkout de la tarea, inspeccionar sin modificar archivos:

```powershell
git rev-parse --show-toplevel
git branch --show-current
git status --porcelain=v2 --branch
git diff --cached --name-status
git diff --name-status
git ls-files --others --exclude-standard
git worktree list --porcelain
```

Listar también las tareas de Codex y verificar sesiones de otras herramientas
que puedan usar esas rutas; guardar título, estado y `cwd`. Una tarea idle o
archivada no prueba que su carpeta esté libre de procesos o trabajo único.
Si no se puede comprobar ownership, no escribir ni retirar el worktree.

Una tarea de escritura usa una carpeta/rama propia. Los worktrees separan
índice y archivos de trabajo, pero comparten objetos, refs y parte de la
configuración Git: no hacen imposible todo conflicto. Tampoco protegerían
archivos compartidos manualmente mediante enlaces.

## 3. Preparar y verificar el trabajo

Para un worktree nuevo de Codex, usar prefijo `codex/`, salvo nombre pedido por
Sam. Elegir una base remota actualizada y autorizada, un destino absoluto dentro
del contenedor y una rama inexistente; no reutilizar una carpeta con contenido.
`git worktree add --no-track -b <rama> <ruta> <base>` permite no heredar por
accidente `origin/main` como upstream. Los marcadores se sustituyen por valores
verificados; este ejemplo no crea nada ni es una orden para ejecutarlo.

Dentro del worktree propio, instalar con `pnpm install --frozen-lockfile`.
No copiar `.env.local` desde producción u otro checkout. Revisar `.env.example`
y provisionar sólo las variables necesarias del entorno autorizado; PAT de
Supabase nunca dentro del árbol, ni siquiera gitignored. Los E2E autenticados
tienen su [runbook efímero](e2e-supabase-efimero.md).

Declarar una allowlist antes de editar. Revisar el diff y hacer staging de
rutas exactas, nunca `git add -A`, `git add .` ni `commit -a`. No asumir que un
archivo es propio porque aparezca en `git status`; no alterar un índice ajeno.
SDD/migraciones se numeran con `pnpm sdd:next`, que mira todas las refs.
Una migración aplicada no se renumera. El índice de specs es generado.

El gate canónico de DTD Cargo es `node scripts/verify.mjs`; ejecutar además
las comprobaciones y build que exija el alcance o la integración. Una omisión
`SKIP` no es verde. No lanzar builds que interfieran con otra tarea por rutina,
ni usar comandos de otros proyectos. El cierre documental usa gates de docs,
numeración, gobernanza, componentes y diff, sin fingir una ejecución de la app.

## 4. Publicar no equivale a integrar, desplegar o limpiar

Antes de publicar, comprobar rama, SHA, ownership, remoto, upstream y
divergencia después de refrescar referencias. Un worker publica sólo el destino
aprobado. Si el GO cubre un SHA concreto, commits posteriores quedan fuera.
Integrar main, aplicar migraciones y promover producción son gates separados.
Registrar CI por SHA y efecto real de `ignoreCommand`, según `AGENTS.md`:
un commit documental anidado puede disparar Preview, y un push no demuestra deploy.

Dejar handoff propio en `.agents/handoffs/YYYY-MM-DD-<slug>-close.md` con rutas,
commits, pruebas, omisiones y operaciones pendientes. No declarar cierre completo
ni archivar una tarea bloqueada sin continuidad. El próximo responsable debe
poder retomar sin acceder a secretos o memoria personal.

## 5. Retirar un worktree: todas las condiciones son obligatorias

En Codex bajo `source-command-cerrar`, la limpieza pertenece al cierre
integrador exclusivo. En modo autónomo se aplica el rol y el GO de `AGENTS.md`:
la sesión puede cerrar su propio trabajo, sin imponerle un coordinador central.
En ambos casos se opera desde fuera del candidato y se exige, para **cada**
carpeta, demostrar antes de borrarla:

1. Ruta absoluta resuelta, exactamente registrada por Git, distinta del checkout
   principal y dentro del contenedor esperado. Resolver enlaces; ante duda, parar.
2. Ninguna tarea/sesión/proceso activo usa ese `cwd` y el ownership está claro.
3. Árbol e índice limpios, incluidos untracked. Inventariar también archivos
   ignorados por nombre: un bundle, handoff o archivo único no es basura por estar
   ignorado. Preservar lo necesario en un destino durable autorizado, sin Git para secretos.
4. Publicación comprobada: upstream correcto y `rev-list --left-right --count`
   entre upstream y rama da `0 0`, o evidencia remota equivalente del SHA exacto.
5. El HEAD del candidato es ancestro de main publicado y del main local desde
   donde se cierra. Refrescar refs y comprobar el SHA remoto; main local atrasado,
   una rama sólo commiteada o `branch --merged` por sí solos no bastan.
6. Handoff, snapshots y evidencia necesarios ya están contenidos o preservados.

Sólo con esas pruebas y autorización, ejecutar `git worktree remove -- <ruta>`
desde el checkout principal, sin `--force`. Comprobar que desapareció del
inventario **y** del disco. Después, revisar `git worktree prune --dry-run`:
no podar entradas ajenas o de rutas temporalmente inaccesibles. Podar únicamente
cuando los candidatos residuales estén identificados y autorizados.

La rama local se retira con `git branch -d <rama>` sólo tras comprobar su
contención; la remota se conserva salvo autorización explícita de borrado.
Si cualquier paso falla, detenerse y registrar `LIMPIEZA BLOQUEADA`. No usar
borrado recursivo, robocopy, `git clean`, reset, force-push o `branch -D` como
atajo. Recuperar la incertidumbre es preferible a destruir evidencia.

## 6. Herramienta heredada: no confundir existencia con cierre seguro

`scripts/harness-worktree.mjs` **sí existe**; no es una pieza pendiente de crear.
Su `start` usa `feat/`, copia `.env.local` e instala sin lockfile congelado.
Su `finish` intenta retirar la carpeta antes de comprobar contención, tiene un
fallback recursivo y puede borrar la rama con `-D`. No verifica tareas activas.
Por tanto, **sus comandos mutantes no implementan este cierre seguro de Codex**.
No utilizarlos aquí. Su adaptación requiere cambio de código y pruebas aparte;
esta revisión documental no afirma haberlos corregido ni ejecutado.

Mensajes de apertura/cierre por rol: [multi-ventanas](multi-ventanas-buena-practica.md).
Estado del saneamiento: [checklist de arranque](../audits/2026-09-02-codex-arranque-checklist.md).
