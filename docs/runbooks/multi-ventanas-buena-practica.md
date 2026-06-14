# Multi-ventanas · buena práctica

> **Uso:** si abres una segunda ventana de Claude Code sobre DTD Cargo, pega el bloque de abajo
> como **primer mensaje** de esa ventana. **Lo único que editas es la última línea (TAREA)** — ahí
> dices qué va a hacer esa ventana; si la dejas vacía, Claude te la pregunta antes de tocar nada.
> Unifica el flujo manual y el del arnés en un solo prompt (incluye el gate `verify.mjs` **y**
> `pnpm build`). Origen: sesión 2026-06-12 (3 colisiones de numeración + un main divergido);
> unificado y pasado a tuteo el 2026-06-14.

---

## Prompt de ventana SECUNDARIA (feature) — pegar como primer mensaje

Vas a trabajar en el repo **DTD Cargo** en PARALELO con otras ventanas de Claude Code. Eres una
**ventana secundaria**: tu trabajo termina en un commit en TU rama, nunca en main ni en prod.
Lee `AGENTS.md` antes de tocar nada. Reglas duras (no negociables):

1. **TU CARRIL.** Trabajas SOLO en tu worktree + rama `feat/<tema>`. Si no tienes carril:
   `node scripts/harness-worktree.mjs start <slug>` (o `git worktree add C:/Users/Trabajo/Desktop/DTD-worktrees/<tema> -b feat/<tema>`);
   abre una ventana AHÍ y sigue AHÍ. **NUNCA** trabajes directo en `C:\Users\Trabajo\Desktop\DTDCargo`
   (el worktree de main es compartido) ni en el worktree de otra ventana.

2. **PUSH PROHIBIDO.** Desde esta ventana **NO se hace `git push`** — nunca, a ninguna rama
   (push a main = deploy automático a prod vía Vercel). El push, los merges a main y las
   migraciones a prod los maneja **ÚNICAMENTE la ventana de coordinación** que Sam designe. Si algo
   necesita push: termina tu commit y pídeselo a Sam en tu reporte final.

3. **MERGE PROHIBIDO.** Ni main→tu rama sin avisar, ni jamás tu rama→main. Si quedas muy detrás de
   main y lo necesitas, dilo en el reporte — lo reintegra la coordinación.

4. **MIGRACIONES.** Nunca apliques nada a la DB de prod (ni MCP, ni SQL editor) — tu migración
   queda como ARCHIVO en tu rama. Antes de tocar el schema invoca los 2 skills Supabase
   (seguridad + postgres-best-practices). Si creas funciones: incluye
   `revoke execute on function ... from public, anon;` salvo que sean públicas a propósito.
   Ojo con el cast enum↔text en backfills (`col::text`) — el build/tsc no caza errores de SQL.

5. **NUMERACIÓN** (la herida recurrente: ya van varias colisiones — 0078/0079, 0080). Antes de
   crear spec (`docs/specs/NNNN-slug/`) o migración (`supabase/migrations/NNNN_*.sql`): `git fetch
   origin` y verifica el número libre contra **origin/main + TODAS las ramas (locales y remotas)**,
   no solo el índice de main. **Chequea también lo que declararon otras ventanas en `MEMORY.md`**
   (`git log --all` no ve ramas paralelas sin fetchear). Toma el siguiente libre y decláralo en tu
   commit y reporte.
   ```bash
   git fetch origin
   for b in $(git for-each-ref --format='%(refname:short)' refs/heads refs/remotes/origin); do
     git ls-tree -r --name-only "$b" docs/specs/ supabase/migrations/ 2>/dev/null
   done | grep -oE '[0-9]{4}' | sort -u | tail -6
   ```

6. **COMMITS.** `git branch --show-current` antes de cada commit (confirma que NO es main). Commit
   **selectivo** (lista explícita de archivos; **nunca `git add -A`**). No toques archivos de otra
   ventana; si necesitas uno compartido (`StudioSidebar.tsx`, `docs/specs/README.md` — que además
   es generado: `node scripts/build-docs-index.mjs`), anótalo en el reporte.

**EJECUCIÓN — usa el arnés:**

7. Para trabajo no trivial: **`/feature <tu tarea>`** → el arnés implementa (código + tests) →
   verifica (`node scripts/verify.mjs` hasta VERDE) → revisa (reviewer aprueba/rechaza). **NO
   commitea sin tu OK; NUNCA pushea.** Un cambio trivial (un doc, una línea) lo puedes hacer a
   mano, pero igual pasa el gate.

8. **GATE + BUILD** antes de entregarle a Sam: `node scripts/verify.mjs` (**NO** `pnpm verify`)
   hasta "TODO VERDE", **Y** `pnpm build` (turbopack). `verify.mjs` da verde pero el deploy de
   Vercel puede fallar igual — pasó con el barrel `"use server"` en módulos server-action; si el
   build falla, **NO entregas** hasta arreglarlo. Si `verify.mjs` falla con "failed to find the
   runner" es flaky de Windows → re-corre. Pantalla nueva o cambio visual → agente
   `ui-ux-designer` antes del commit.

9. **REPORTE FINAL (obligatorio).** Al terminar, entrega en un bloque: rama + worktree + commits
   (hash y título) · números de spec/migración que tomaste · archivos compartidos que tocaste · y
   qué le queda a la coordinación (merge / push / migración a prod / decisiones de Sam).

**TAREA DE ESTA VENTANA:** _<la completa Sam: qué hacer y, si la sabe, en qué rama>_

> **Para Claude:** si la línea TAREA quedó sin completar (dice `<completar>`, `<la completa Sam…>`
> o está vacía), tu PRIMERA acción es preguntarle a Sam: **"¿Cuál es la tarea de esta ventana y en
> qué rama/worktree trabajo?"** No asumas alcance, no leas medio repo, no toques archivos hasta
> tener la respuesta. Con la tarea clara: confirma tu carril en una línea ("Trabajo en
> `feat/<tema>`, worktree `<path>`, sin push") y arranca.

---

## La ventana de Push / coordinación (la "de arriba")

Hay **una sola** ventana que mergea y pushea. Las de feature **commitean lo suyo**; esta **integra
lo ya commiteado y pushea**. **Nunca** le digas "haz commit a todo" — barre el trabajo a medio
hacer de otra ventana (ej: archivos sin commitear que no son de una rama lista).

**Lo que le dices (corto):** _"Integra las ramas listas y pushea main con mi OK."_

**Prompt completo para pegar en la ventana de Push:**

> Eres la ventana de **Push / coordinación** de DTD Cargo. NO escribes código nuevo. Tu trabajo:
> 1. `git fetch origin`.
> 2. Mapea el estado real (no te fíes de resúmenes de otras ventanas): `git worktree list`, ramas
>    adelante/detrás de `main`, y qué worktrees tienen trabajo **sin commitear**.
> 3. Reconcilia `main` con `origin/main`.
> 4. Mergea a `main` **SOLO** las ramas ya **commiteadas** (sus ventanas las cerraron). Resuelve
>    conflictos. `docs/specs/README.md` es generado → `node scripts/build-docs-index.mjs`. Resuelve
>    colisiones de numeración (spec/migración) renumerando la que llegó segunda.
> 5. **Verifica cada rama antes de integrarla** si toca código/seguridad/migraciones (auditoría
>    read-only; en features financieras/seguridad, adversarial). No integres con un crítico abierto.
> 6. Corre `node scripts/verify.mjs` **y `pnpm build` (turbopack)** al final. El build es el único
>    que caza el barrel `"use server"` que tumba deploys; `verify.mjs` no.
> 7. Muéstrame el resumen (qué entra, qué quedó afuera) y, **con mi OK explícito, `git push`**.
>    Confirma el deploy real con `get_deployment(dtdcargo.com)` (state READY + el SHA correcto) —
>    un 200 público puede estar sirviendo el build viejo.
> 8. **Migraciones a prod:** las aplicas tú con mi OK, **migrate-first** (antes del push si el
>    código las necesita sin fallback) y transaccional (`apply_migration`; si falla, prod queda
>    intacto). Pre-chequea enums/dependencias; corre `get_advisors` después.
>
> **REGLA DURA — commits selectivos, NUNCA `git add -A`.** Si un worktree tiene archivos sin
> commitear que NO son de una rama lista (otra ventana a medio trabajo), **no los toques ni los
> commitees** — avísame para que esa ventana los cierre primero. Tu push debe ser **una sola
> pasada** que junte todo lo listo, para no dejar dos ramas divergentes que después choquen.

---

## Cierre de ventana (antes de dormir / apagar)

No hay un botón que cierre todas las ventanas — **es por ventana: pega esto en CADA chat abierto**
(menos en la de Push, que usa su propio prompt). Cada ventana **guarda su caja** (commit en su
rama); nadie pushea ni mergea al cerrar.

**Prompt de cierre (pegar en cada ventana de feature):**

> Voy a cerrar por hoy. **Cierra tu caja, sin push ni merge:**
> 1. `git branch --show-current` — confirma en qué rama estás.
> 2. `node scripts/verify.mjs` — si queda verde, sigue; si queda rojo y no lo arreglas en 2
>    intentos, commitea igual como `wip: <qué falta>` y avísame (no me dejes trabajo sin commitear).
> 3. **Commit SELECTIVO de TU trabajo en TU rama** (lista explícita de archivos; NUNCA `git add
>    -A`; no toques archivos de otra ventana).
> 4. **NO push, NO merge.**
> 5. Repórtame en 1 línea: **rama · último commit · qué quedó a medias para retomar mañana.**

⚠️ **Si la ventana está trabajando directo en el worktree de `main`** (como pasó con la ventana
legal): primero dile que **cree su propia rama** (`git switch -c feat/<tema>`) y commitee ahí — así
su trabajo no se mezcla con el `main` que vas a pushear.
