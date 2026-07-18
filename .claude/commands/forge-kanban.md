---
description: Skill Plugin Kanban — inventario visual, routing, propuestas approval-gated, tickets v3 y cierre seguro para proyectos con o sin Forge.
---

# /forge-kanban

Wrapper fino de Claude sobre el núcleo canónico de Forge Kanban. No duplica el
backlog, router, dashboard, contratos ni arnés. Resuelve local primero:

```powershell
$FORGE_KANBAN = @(
  '.agents\skills\forge-kanban',
  (Join-Path $HOME '.claude\skills\forge-kanban'),
  (Join-Path $HOME '.codex\skills\forge-kanban')
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $FORGE_KANBAN) { throw 'Forge Kanban no está instalado. Ejecuta scripts/install.mjs.' }
$FK = Join-Path (Resolve-Path $FORGE_KANBAN).Path 'scripts\forge-kanban.mjs'
```

La instalación del proyecto gana. El fallback global prueba Claude y después
Codex. En proyectos Forge ejecutar `/avivar` primero; en standalone, `start`.

Al invocar `/forge-kanban`, ejecutar inmediatamente `doctor --json`. Si está
sano, ejecutar `board` y presentar su tabla completa en la respuesta. No mostrar
solamente conteos de `status` o el resumen de `features`.

## Comandos

```powershell
node "$FK" doctor --json
node "$FK" start --json
node "$FK" status --json
node "$FK" board
node "$FK" features
node "$FK" reconcile
node "$FK" propose
node "$FK" approve FKP-XXXXXXXX --by "Nombre" --reason "Alcance validado"
node "$FK" apply FKP-XXXXXXXX
node "$FK" route general_code --json
node "$FK" adopt --deep
node "$FK" snapshot T-001 start
node "$FK" snapshot T-001 end
node "$FK" report T-001
```

`propose` no crea tickets. `approve` registra autorización nominativa. `apply`
materializa sólo una propuesta elegible cuyo hash y baseline sigan vigentes.

## Modelos

El wrapper sólo conoce clases lógicas: `sol`, `terra` y `luna`. Resolver modelo
y esfuerzo desde `.forge/forge-kanban.yml`; nunca hardcodearlos. Un
`reasoning_effort: null` es válido cuando el proveedor no admite el parámetro.
Todo ticket debe explicar `model_reason`.

## Herramientas de Claude

- Usar TodoWrite para fases, no para microtareas.
- Usar AskUserQuestion para decisiones reales con alternativas.
- Mantener Plan mode hasta que exista Blueprint y `go`.
- Un revisor independiente no se autoaprueba.
- Usar `/cerrar` para finalizar; nunca borrar worktrees desde este wrapper.

## Reglas duras

- Las specs y shards son fuentes; `KANBAN.md`, registry, dashboard y bitácora
  son vistas generadas y no se editan a mano.
- No crear otro backlog, router, dashboard, contrato ni arnés paralelo.
- Prohibidos `git add .`, `git add -A`, `git clean`, `reset --hard`, `branch -D`
  y borrado recursivo no auditado.
- Sin push a `main`, deploy o migraciones alojadas sin autorización explícita.
- Ante evidencia incompleta, sesiones dudosas o cambios ajenos, bloquear el
  cierre y conservar el worktree.
