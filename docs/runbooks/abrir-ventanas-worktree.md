# Runbook — Abrir ventanas de Claude para trabajar en paralelo (worktrees)

> Quick-reference operativo: cómo arrancar una ventana nueva de Claude Code en el lane correcto.
> Complemento de [`git-worktrees-multiventana.md`](git-worktrees-multiventana.md) (ese explica el *porqué* y los comandos git; este, el *día a día* de abrir ventanas).

---

## 1. La idea clave (la que más confunde)

**La rama la define la CARPETA que abrís, NO lo que le escribís a Claude.**

- No le decís "continuá en `chore/seo-faq`" por texto → **abrís la carpeta del lane y ya está en esa rama, solo.**
- Si abrís la carpeta equivocada, ningún mensaje cambia la rama.
- El texto del primer mensaje es para la **tarea + contexto**, no para elegir rama.

```
1 ventana  =  1 carpeta (worktree)  =  1 rama  =  1 tarea
```

---

## 2. Cómo abrir la ventana en el lane correcto (Windows)

1. Abrí una **terminal nueva** (Windows Terminal / PowerShell).
2. `cd` a la carpeta del lane.
3. Corré `claude`.

```powershell
cd C:\Users\Trabajo\Desktop\DTD-worktrees\seo
claude
```

*(Si usás el desktop/IDE de Claude Code: abrí ESA carpeta como proyecto, no la principal `DTDCargo`.)*

**¿Qué carpetas/lanes tengo ahora?** Desde la ventana main:
```
git worktree list
```
Te lista cada carpeta con su rama. Los lanes cambian con el tiempo (se crean y se retiran); por eso abajo la plantilla **genérica** es lo durable, los ejemplos son una foto del momento.

---

## 3. Por qué hace falta un mensaje de apertura

Una ventana abierta en un worktree **arranca con memoria vacía** (el `MEMORY.md` del proyecto se indexa por ruta y NO viaja; el `AGENTS.md`/`CLAUDE.md` sí, viven en el repo). El primer mensaje le dice que **lea el runbook** (ahí está todo lo del árbol) y le da la tarea.

> Corolario: el trabajo memoria-pesado (que depende de mucho contexto histórico) conviene hacerlo desde la **ventana main**.

---

## 4. Plantilla genérica (copiá/pegá, rellená los `<...>`)

```
Trabajás en el worktree del lane "<NOMBRE>" (carpeta <ruta>, rama <rama>).
Confirmá con: git branch --show-current
Leé AGENTS.md + docs/runbooks/git-worktrees-multiventana.md.
Reglas: solo esta carpeta · todo código por el arnés (node scripts/verify.mjs verde antes de cerrar) · commit selectivo (nunca git add -A) · NO push sin mi OK.
Antes de empezar, traé main: git merge main
Tarea: <qué quiero>.
```

---

## 5. Ejemplos listos (foto actual — verificá con `git worktree list`)

**🪟 Ventana main — `C:\Users\Trabajo\Desktop\DTDCargo` (rama `main` · INTEGRACIÓN)**
> Sos la ventana de integración (rama main). Confirmá con `git branch --show-current`. Acá NO codeo features — solo mergeo lanes, pusheo (con mi OK) y hago lo memoria-pesado. Leé AGENTS.md y docs/runbooks/git-worktrees-multiventana.md. Decime qué lane querés integrar.

**🪟 Ventana SEO — `C:\Users\Trabajo\Desktop\DTD-worktrees\seo` (rama `chore/seo-faq`)**
> Trabajás en el worktree del lane SEO (rama chore/seo-faq). Confirmá con `git branch --show-current`. Leé AGENTS.md + docs/runbooks/git-worktrees-multiventana.md. Solo esta carpeta · arnés · commit selectivo · NO push sin mi OK. Antes de empezar: `git merge main`. Tarea: retomemos el SEO — revisá qué quedó pendiente en esta rama y proponé el próximo paso.

**🪟 Ventana brochure — `C:\Users\Trabajo\Desktop\DTD-worktrees\brochure` (rama `feat/brochure`)**
> Trabajás en el worktree del lane brochure (rama feat/brochure). Confirmá con `git branch --show-current`. Leé AGENTS.md + docs/runbooks/git-worktrees-multiventana.md. Solo esta carpeta · arnés · commit selectivo · NO push sin mi OK. Tarea: [lo que quieras].

---

## 6. Las 4 reglas que no se rompen

1. **1 ventana = 1 carpeta = 1 rama.** Nunca 2 ventanas en la misma carpeta.
2. **La carpeta elige la rama** — abrí la correcta, no lo digas por texto.
3. **Push/deploy solo desde la ventana main, con tu OK.**
4. **Lo memoria-pesado, en la ventana main** (las otras arrancan con memoria vacía).

---

## 7. ¿Lane NUEVO? (no uno de los existentes)

**No crees worktrees a mano desde una ventana de lane.** Pedíselo a la **ventana main**:

> "Creá un worktree para el lane `<X>` (rama `feat/<x>` off main) y dejámelo listo."

La ventana main crea la carpeta + rama + `pnpm install` + copia `.env.local`, y recién ahí abrís una ventana en esa carpeta nueva (sección 2).

---

## 8. Primer reflejo en CADA ventana nueva

Antes de tocar nada, confirmá dónde estás:
```
git branch --show-current     # ¿es la rama del lane que esperabas?
git worktree list             # ¿estoy en la carpeta correcta?
```
Si la rama no coincide con el lane → cerrá y abrí la carpeta correcta (no intentes cambiar de rama acá: romperías el aislamiento).
