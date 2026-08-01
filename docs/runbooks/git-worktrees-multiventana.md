# Runbook — Worktrees: trabajar 3–4 ventanas en paralelo sin sangrado

> **Problema que resuelve:** cuando abrís varias ventanas de Claude/VS Code sobre la **misma carpeta**, todas comparten el mismo árbol de archivos y la misma rama → los cambios sin commitear de una "ensucian" a las otras (el *sangrado*). La solución no es "más ramas": es **una carpeta por tarea** (worktree).

---

## 1. Conceptos en 30 segundos

- **Rama (branch):** una línea de historia paralela. `main` es la línea oficial → **lo que se pushea a `main` deploya a producción (Vercel)**.
- **Worktree:** una **segunda carpeta** ligada al mismo repo, parada en **otra rama**, con **sus propios archivos** y su propio estado sin commitear.
- **Regla de oro que te protege:** no podés tener la misma rama en dos worktrees. `main` vive en UNA sola carpeta. El sangrado se vuelve **imposible por diseño**.

```
1 ventana  =  1 carpeta (worktree)  =  1 rama  =  1 tarea
```

---

## 2. Estructura (contenedor `DTD-worktrees\` — decisión founder)

Los worktrees van **agrupados en un contenedor**, NO sueltos en el Escritorio:

```
C:\Users\Trabajo\Desktop\
├─ DTDCargo\                  → main           (integración + deploy · NO editar features acá)
└─ DTD-worktrees\
   ├─ brochure\               → feat/brochure  (lane Brochure)
   └─ seo\                    → chore/seo-faq   (lane SEO / Calculadora)
```

- `DTDCargo\` (main) = ventana de **integración**: la ÚNICA que mergea y pushea.
- Los worktrees **siempre afuera de `DTDCargo\`** (el contenedor lo cumple), **nunca anidados adentro** (si no, tsc/eslint/vitest del repo escanean la copia → caos).
- **Granularidad sana:** una carpeta por **lane activo** (no por los 20 módulos), y **ramas cortas por tarea** adentro (`feat/<tema>`), mergeando a `main` seguido. Ramas largas por módulo = drift + merge hell (evitar).
- **Clasificación (regla founder):** ante cada tarea nueva, primero se decide a qué lane/worktree pertenece (público→`seo` · brochure→`brochure` · módulo Studio nuevo→worktree nuevo); recién ahí se abre/usa esa ventana. El trabajo lo hace la ventana de ESE escritorio.

---

## 3. Comandos exactos

**Crear una carpeta-worktree con una rama nueva** (desde `DTDCargo\`):
```
git worktree add ../DTD-worktrees/<tema> -b feat/<tema>
```

**Dejarla lista para correr** (node_modules y `.env` NO se comparten):
```
cd ../DTD-worktrees/<tema>
pnpm install
copy ..\..\DTDCargo\.env.local .env.local
```
> `pnpm install` en un worktree es rápido: pnpm hardlinkea desde su store global, casi sin disco extra.

**Ver todas las carpetas-worktree:**
```
git worktree list
```

**Commitear dentro de la carpeta** (selectivo, nunca `git add -A`):
```
git add <rutas de tu tarea>
git commit -m "feat(studio): SDD-NNNN — título"
```

**Antes de mergear, traé `main` a tu rama** (resolvés conflictos en tu rama, NO en main):
```
git merge main
```

**Mergear a main y publicar** (desde `DTDCargo\`, con tu OK — esto deploya):
```
cd ../DTDCargo
git merge feat/<tema>
git push
```

**Limpiar cuando la tarea terminó:**
```
git worktree remove ../DTD-worktrees/<tema>
git branch -d feat/<tema>
```

---

## 4. Un día de trabajo

1. **Arranque (~1 min):** `git worktree add ../DTDCargo-<tema> -b feat/<tema>` → abrís esa carpeta en una ventana nueva → `pnpm install` + copiar `.env.local`.
2. **Durante el día:** cada ventana trabaja en SU carpeta. Commits chicos y seguidos **dentro de su carpeta** (aislados, no se pisan).
3. **Antes de cerrar:** `node scripts/verify.mjs` verde en esa carpeta → `git merge main` por si hubo cambios.
4. **Cierre/deploy:** en `DTDCargo\` → `git merge feat/<tema>` → con tu OK `git push` (Vercel publica).
5. **Limpieza:** `git worktree remove` + `git branch -d`.

---

## 5. Reglas para no chocar

- **Cada ventana, un área distinta del código.** Los conflictos solo ocurren si dos ramas editan las **mismas líneas del mismo archivo**.
- **Archivos compartidos = una sola ventana los toca:** `AGENTS.md`, el sidebar, y sobre todo `docs/specs/README.md` (se autogenera con `pnpm docs:index`) → que los regenere solo la ventana de integración (`main`), después de mergear.
- **Numeración (specs y migraciones): NO la adivines.** Cada rama toma el siguiente libre mirando **todas** las ramas, y para eso hay herramienta:
  ```
  pnpm sdd:next                          # próximo libre de spec y de migración (hace fetch)
  pnpm sdd:next --reserve <slug>          # prepara la reserva; te imprime el push
  ```
  El **29-jul-2026 hubo cuatro colisiones en un día**, y una fue *después* de chequear `origin/main`: entre numerar y pushear pasaron horas y otra ventana se llevó el número. Por eso, si el trabajo va a durar, **reservá**: la reserva publica en `main` un `spec.md` stub con ese número, que es lo que lo hace visible para las demás ventanas. **Un commit vacío no reserva nada** (el escaneo mira carpetas, no mensajes de commit).

  Si igual chocan, el paso `numbering` de `verify.mjs` lo caza al mergear. **La que se mueve es la que NO está en `main`.** ⚠️ Una migración **ya aplicada** no se renumera nunca.
- **Mergeá seguido y chico.** Una rama que vive días se aleja de `main` y acumula conflictos.
- **El push/deploy sale SOLO de `main`**, desde `DTDCargo\`, con tu OK.
- **Namespace de memoria:** abrir Claude en una carpeta-worktree usa una **memoria propia** (el `MEMORY.md` del proyecto se indexa por ruta y NO viaja; el `AGENTS.md`/`CLAUDE.md` sí, viven en el repo). El trabajo que se apoya fuerte en memoria conviene hacerlo desde `DTDCargo\` (integración).
- **Footgun de upstream:** si creás la rama desde `origin/main` (`-b X origin/main`) queda *trackeando* `main` → un `git push` pelado puede publicar. Correr `git branch --unset-upstream` en la rama nueva.

---

## 6. Limpieza de ramas viejas (evita la "confusión de ramas")

Antes de borrar, mirá si está mergeada:
```
git branch --merged main          # las que listа acá ya están integradas → seguras de borrar
git log --oneline main..<rama>    # qué tiene una rama que aún no está en main
```
- Mergeada → `git worktree remove ../<carpeta>` (si tiene) + `git branch -d <rama>`.
- No mergeada y ya no sirve → `git branch -D <rama>` (la `D` mayúscula fuerza; usar a conciencia).
- Evitá el botón "↑ Push" que crea ramas `preview/<fecha>` automáticas — son las que ensucian la lista.

---

## 7. Verificación (que quedó bien)

1. `git worktree list` → una carpeta por lane, cada una en su rama, ninguna repetida.
2. En una carpeta de feature: hacés un cambio → `git status` lo ve. En `DTDCargo\` → `git status` **NO** lo ve. (Aislamiento confirmado.)
3. `node scripts/verify.mjs` verde **dentro de cada worktree** (tras `pnpm install`).

---

## 8. Futuro: automatizarlo en el harness

Decisión tomada: que el harness `/feature` gestione el ciclo de vida del worktree, respetando la regla *"nada se mergea/pushea sin OK del founder"*:

```
  AUTO (local, seguro):  crear worktree+rama · pnpm install · correr el loop implement→verify→review
  TU OK (sigue gated):   commit · merge a main · push
```

Piezas a construir cuando se retome:
1. `scripts/harness-worktree.mjs` → `start <slug>` (crea worktree+rama+install) / `finish <slug>` (merge local + `worktree remove` + `branch -d`, **sin push**).
2. `.claude/commands/feature.md` worktree-aware: Step 1 invoca `start`; Step 5 (APPROVED) propone `finish`. Los agentes `leader`/`implementer`/`reviewer` no cambian.

> El gate `node scripts/verify.mjs` ya corre desde cualquier `cwd`, así que funciona dentro de un worktree tras `pnpm install`.
