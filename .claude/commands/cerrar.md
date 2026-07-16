---
description: Cierre seguro multi-sesión. Inspecciona propiedad, estado git, sesiones activas e integración con el arnés fail-closed del núcleo. Nunca borra: ante cualquier duda emite LIMPIEZA BLOQUEADA y conserva todo. No absorbe trabajo de otras ventanas.
---

# /cerrar

Wrapper fino sobre el **arnés del núcleo**. El arnés **inspecciona y bloquea; nunca elimina**.

## 1 · Resolver el arnés (local primero)

```powershell
$FORGE_KANBAN = @(
  '.agents\skills\forge-kanban',
  (Join-Path $HOME '.claude\skills\forge-kanban'),
  (Join-Path $HOME '.codex\skills\forge-kanban')
) | Where-Object { Test-Path $_ } | Select-Object -First 1
$HARNESS = Join-Path (Resolve-Path $FORGE_KANBAN).Path 'scripts\harness.mjs'
```

## 2 · Inspeccionar — read-only

```powershell
node "$HARNESS" list
node "$HARNESS" plan-finish "<ruta-absoluta-del-worktree>"
```

Devuelve `verdict`: **`LIMPIEZA_PERMITIDA`** o **`LIMPIEZA_BLOQUEADA`**, con cada check y su razón.

El arnés **no borra en ningún caso**. `finish` reporta y sale distinto de cero por diseño:
la eliminación física exige un recibo firmado por un humano.

## 3 · Los checks

`registered_worktree` · `not_primary_checkout` · `inside_expected_container` ·
`clean_including_untracked` · `not_locked` · `physical_path_exists` ·
`no_active_session_signal` · `session_inactive_proven` · `head_durably_preserved` ·
`integrated_in_published_integrator` · `handoff_and_evidence_saved`

⚠️ **`session_inactive_proven` es `false` por diseño, no por bug.** En Windows es
**indemostrable** que ninguna terminal, Codex CLI o proceso mantenga un `cwd`
(`Win32_Process` no expone working directory). El núcleo lo declara en su campo
`limitation`. Lo que sí detecta: ventanas de Claude vivas (lock + PID validado +
owner TCP cruzado) y dev servers. **Una terminal con `cd` al worktree es invisible.**

Consecuencia: el veredicto normal es `LIMPIEZA_BLOQUEADA`. **Eso es correcto.**

## 4 · Cierre del trabajo

1. **Propiedad demostrada** — `ownedPaths` sale de escrituras **reales** de esta sesión.
   No se deduce de `git status` ni por antigüedad.
2. **Commit atómico + staging selectivo** — una intención lógica, solo rutas propias:
   ```bash
   git add <rutas exactas>     # NUNCA git add . ni -A
   git commit -m "<tipo>(<ámbito>): <título>"
   ```
3. **Push** — solo con autorización explícita del founder.
4. **Handoff** — `.agents/handoffs/<fecha>-<tarea>.md` con evidencia, commit, push y
   siguiente responsable.

**Cambios ajenos se conservan y se reportan.** "Workspace limpio" significa que no quedan
cambios *de esta tarea* — jamás borrar lo de otra ventana para lograr un `git status` vacío.

## 5 · Eliminación física — solo humano

`scripts/harness-worktree.mjs` es el **adaptador brownfield** de este proyecto y el único
que puede remover worktrees. **No lo invoques automáticamente.** Mostrá el veredicto del
arnés y el comando exacto, y **pará**.

## Prohibido

`--force` · `git clean` · `git reset --hard` · `git branch -D` · `rm -rf` ·
`Remove-Item` recursivo · borrado manual como fallback automático · eliminar ramas remotas.

> **"No estoy seguro" nunca significa "borrar".**
