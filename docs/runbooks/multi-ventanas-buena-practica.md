# Multi-ventanas · buena práctica

> **Uso:** si abrís una segunda ventana de Claude Code sobre DTD Cargo, pegá el bloque de abajo
> como **primer mensaje** de esa ventana. **Lo único que editás es la última línea (TAREA)** —
> ahí decís qué va a hacer esa ventana; si la dejás vacía, Claude te la pregunta antes de tocar
> nada. Origen: sesión 2026-06-12, tras 3 colisiones de numeración y un main divergido.

---

Vas a trabajar en el repo **DTD Cargo** en PARALELO con otras ventanas de Claude Code. Sos una
**ventana secundaria**: tu trabajo termina en un commit en TU rama, nunca en main ni en prod.
Leé `AGENTS.md` antes de tocar nada. Reglas duras de coordinación (no negociables):

1. **TU CARRIL.** Trabajás SOLO en tu propio worktree + rama (`feat/<tema>` o `chore/<tema>`).
   Si no existe, crealo: `git worktree add C:/Users/Trabajo/Desktop/DTD-worktrees/<tema> -b feat/<tema>`.
   **NUNCA** trabajes directo en `C:\Users\Trabajo\Desktop\DTDCargo` (el worktree de main es
   compartido) ni en el worktree de otra ventana.

2. **PUSH PROHIBIDO.** Desde esta ventana **NO se hace `git push`** — nunca, a ninguna rama,
   bajo ningún motivo (push a main = deploy automático a producción vía Vercel). El push, los
   merges a main y las migraciones a prod los maneja **ÚNICAMENTE la ventana de coordinación**
   (la que Sam designe; por default la que está en `main`/coordinando la sesión). Si creés que
   algo necesita push: termina tu commit y **pedíselo a Sam en tu reporte final**.

3. **MERGE PROHIBIDO.** No mergees main a tu rama sin avisar, y jamás tu rama a main. Si quedás
   muy detrás de main y lo necesitás, decílo en el reporte — lo reintegra la coordinación.

4. **NUMERACIÓN (la herida de hoy: 3 colisiones).** Antes de crear un spec
   (`docs/specs/NNNN-slug/`) o una migración (`supabase/migrations/NNNN_*.sql`), verificá el
   número libre en **origin/main + TODAS las ramas locales**:
   ```bash
   git fetch origin
   for b in $(git for-each-ref --format='%(refname:short)' refs/heads) origin/main; do
     git ls-tree --name-only "$b" docs/specs/ supabase/migrations/ 2>/dev/null
   done | grep -oE '[0-9]{4}' | sort -u | tail -5
   ```
   Tomá el siguiente libre y **declaralo en tu primer commit y en tu reporte final**.

5. **MIGRACIONES.** Nunca apliques nada a la DB de prod (ni MCP, ni SQL editor). Tu migración
   queda como archivo en tu rama; la aplica la coordinación con autorización de Sam. Si tu
   migración crea funciones: incluí `revoke execute on function ... from public, anon;` salvo
   que sea pública a propósito (deuda conocida: 78 RPCs ejecutables por anon).

6. **COMMITS.** Verificá la rama antes de cada commit (`git branch --show-current`). Commit
   **selectivo** (lista explícita de archivos; `git add -A` solo si TODO el working tree es
   tuyo). No toques archivos fuera de tu alcance; si necesitás uno compartido
   (`StudioSidebar.tsx`, `docs/specs/README.md` — que además es generado:
   `node scripts/build-docs-index.mjs`), anotalo en el reporte.

7. **GATE.** Antes de commitear: `node scripts/verify.mjs` (NO `pnpm verify`) hasta
   "TODO VERDE". Si falla con "failed to find the runner" es flaky de Windows → re-corré.
   Pantallas nuevas o cambio visual sustancial → agente `ui-ux-designer` antes del commit.

8. **REPORTE FINAL (obligatorio).** Al terminar, entregá en un bloque:
   - Rama + worktree + commits (hash y título).
   - Números de spec/migración que tomaste.
   - Archivos compartidos que tocaste (si alguno).
   - Qué le queda a la coordinación: merge / push / migración a prod / decisiones de Sam.

**TAREA DE ESTA VENTANA:** _<la completa Sam: qué hacer y, si la sabe, en qué rama>_

> **Para Claude:** si la línea TAREA quedó sin completar (dice `<completar>`, `<la completa Sam…>`
> o está vacía), tu PRIMERA acción es preguntarle a Sam: **"¿Cuál es la tarea de esta ventana y
> en qué rama/worktree trabajo?"** No asumas alcance, no leas medio repo, no toques archivos
> hasta tener la respuesta. Con la tarea clara: confirmá tu carril en una línea
> ("Trabajo en `feat/<tema>`, worktree `<path>`, sin push") y arrancá.

---

## La ventana de Push / coordinación (la "de arriba")

Hay **una sola** ventana que mergea y pushea. Las de feature **commitean lo suyo**; esta
**integra lo ya commiteado y pushea**. **Nunca** le digas "haz commit a todo" — barre el
trabajo a medio hacer de otra ventana (ej: archivos sin commitear que no son de una rama lista).

**Lo que le decís (corto):** _"Integrá las ramas listas y pusheá main con mi OK."_

**Prompt completo para pegar en la ventana de Push:**

> Sos la ventana de **Push / coordinación** de DTD Cargo. NO escribís código nuevo. Tu trabajo:
> 1. `git fetch origin`.
> 2. Mapeá el estado real (no te fíes de resúmenes de otras ventanas): `git worktree list`,
>    ramas adelante/detrás de `main`, y qué worktrees tienen trabajo **sin commitear**.
> 3. Reconciliá `main` con `origin/main`.
> 4. Mergeá a `main` **SOLO** las ramas que ya estén **commiteadas** (sus ventanas las cerraron).
>    Resolvé conflictos. El índice `docs/specs/README.md` es generado → `node scripts/build-docs-index.mjs`.
> 5. Corré `node scripts/verify.mjs` **una vez al final** (hasta "TODO VERDE").
> 6. Mostrame el resumen (qué entra, qué quedó afuera) y, **con mi OK explícito, `git push`**.
>
> **REGLA DURA — commits selectivos, NUNCA `git add -A`.** Si un worktree tiene archivos sin
> commitear que NO son de una rama lista (otra ventana a medio trabajo), **no los toques ni los
> commitees** — avisame para que esa ventana los cierre primero. Tu push debe ser **una sola
> pasada** que junte todo lo listo, para no dejar dos ramas divergentes que después choquen.

---

## Cierre de ventana (antes de dormir / apagar)

No hay un botón que cierre todas las ventanas — **es por ventana: pegá esto en CADA chat abierto**
(menos en la de Push, que usa su propio prompt). Cada ventana **guarda su caja** (commit en su rama);
nadie pushea ni mergea al cerrar.

**Prompt de cierre (pegar en cada ventana de feature):**

> Voy a cerrar por hoy. **Cerrá tu caja, sin push ni merge:**
> 1. `git branch --show-current` — confirmá en qué rama estás.
> 2. `node scripts/verify.mjs` — si queda verde, seguí; si queda rojo y no lo arreglás en 2 intentos,
>    commiteá igual como `wip: <qué falta>` y avisame (no me dejes trabajo sin commitear).
> 3. **Commit SELECTIVO de TU trabajo en TU rama** (lista explícita de archivos; NUNCA `git add -A`;
>    no toques archivos de otra ventana).
> 4. **NO push, NO merge.**
> 5. Reportame en 1 línea: **rama · último commit · qué quedó a medias para retomar mañana.**

⚠️ **Si la ventana está trabajando directo en el worktree de `main`** (como pasó con la ventana legal):
primero decile que **cree su propia rama** (`git switch -c feat/<tema>`) y commitee ahí — así su trabajo
no se mezcla con el `main` que vas a pushear.
