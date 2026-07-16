---
description: Skill Plugin Kanban — control plane de ejecución. Diagnostica el proyecto, clasifica y enruta tickets a constructor/revisor/modelo/método con razón explícita, verifica gates y prepara el cierre fail-closed. Wrapper fino sobre el núcleo canónico; no duplica backlog, router, dashboard ni arnés.
---

# /forge-kanban

Wrapper fino de Claude sobre el **núcleo canónico** de Skill Plugin Kanban.
No reimplementa nada: resuelve el skill y delega.

## 1 · Resolver el skill (local primero)

```powershell
$FORGE_KANBAN = @(
  '.agents\skills\forge-kanban',
  (Join-Path $HOME '.claude\skills\forge-kanban'),
  (Join-Path $HOME '.codex\skills\forge-kanban')
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $FORGE_KANBAN) { throw 'Forge Kanban no está instalado. Corré scripts/install.mjs.' }
$FK = Join-Path (Resolve-Path $FORGE_KANBAN).Path 'scripts\forge-kanban.mjs'
```

**La instalación del proyecto gana siempre.** El fallback global prueba Claude antes que Codex;
ninguno es obligatorio.

## 2 · Orden de arranque

- **Proyecto Forge** → `/avivar` **precede** a Forge Kanban.
- **Proyecto standalone** → `node "$FK" start`.

## 3 · Comandos

| Comando | Qué hace |
|---|---|
| `node "$FK" doctor --json` | Diagnostica: repo git · commit base · config parseada · directorio de tickets · router |
| `node "$FK" start --json` · `status --json` | Estado del backlog |
| `node "$FK" route <dominio> --json` | Constructor · revisor · método · evidencia, **desde el YAML** |
| `node "$FK" adopt [--deep]` | Adopción read-only de proyecto existente |
| `node "$FK" reconcile` | Reporte de reconciliación |
| `node "$FK" snapshot <ticket> <start\|end>` · `report <ticket>` | Métricas por ticket |

Empezá siempre por `doctor`. Si no está sano, **parás** — no clasifiques sobre un repo roto.

## 4 · Modelos — clases lógicas, nunca nombres

Este wrapper **no conoce ningún modelo**. Los tickets llevan `model_class`:
`sol` (razonamiento crítico) · `terra` (construcción general) · `luna` (mecánico/documental).

El mapeo clase → proveedor/modelo/esfuerzo vive **solo** en `.forge/forge-kanban.yml`.
Leelo de ahí; no lo hardcodees ni lo infieras.

⚠️ `reasoning_effort: null` es un valor **válido y deliberado**: algunos modelos rechazan el
parámetro de esfuerzo y fallan si se envía. Respetá el `null` de la config.

`model_reason` es obligatorio siempre — el nombre del modelo no es una justificación.

## 5 · Tools nativos de Claude

Claude tiene lo que Codex no. Usalo:

- **TodoWrite** → seguimiento de fases (Codex lo emite como lista en texto).
- **AskUserQuestion** → decisiones con opciones (Codex las emite en markdown).
- **Plan mode** → propuesta antes de tocar archivos.
- **Subagents** → un revisor independiente **no se autoaprueba**.
- **Slash commands nativos** → este archivo. Codex no los tiene; invoca por lenguaje natural.

## 6 · Cierre

Usá **`/cerrar`**. Nunca borres worktrees desde acá.

## Reglas duras

- **No crear** otro backlog, router, dashboard, contrato de tickets ni arnés universal.
- **No modificar el núcleo** sin explicar antes la incompatibilidad.
- `KANBAN.md`, registry y dashboard son **vistas generadas** — jamás a mano.
- Ultracode y `/code-review ultra` los **dispara el founder**: imprimí el comando y **PARÁ**.
- **Prohibido:** `git add .` · `git add -A` · `git clean` · `reset --hard` · `branch -D` ·
  `--force` · borrado recursivo. Sin push ni cambios a `main` sin autorización.
