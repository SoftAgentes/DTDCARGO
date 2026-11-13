# Handoff — SDD-0632 retiro de Graphify, Archify y Obsidian

- Owner: Worker Claude · claim `local-graphify-retiro` · sesión iniciada por «Segundo Cerebro Online».
- Worktree: `.claude/worktrees/distracted-mendel-4d032d` · rama `claude/distracted-mendel-4d032d` · base `origin/main` e5169e86e.
- SDD: [0632](../../docs/specs/0632-retiro-graphify/spec.md) (reserva local `codex/sdd-reserve-0632-retiro-graphify`, commit 0e1751f; sin publicar). Reemplaza a 0471 y 0623.
- Decisión de Sam (2026-11-13): «A Graphite lo eliminamos totalmente, ya que no se estaba usando y había que actualizarlo a cada rato».
- **Condición de integración** (Sam, 2026-11-13, vía la sesión que encargó): «Opino que retiremos Grafiti cuando avancemos con la creación del cerebro, ¿correcto?». La PR queda en **borrador** y no se integra hasta que el repositorio privado del cerebro avance y Sam confirme el retiro. Lo mismo vale para la limpieza fuera de Git.

## OBJETIVO ORIGINAL

Retirar Graphify, Archify y la publicación a Obsidian de las reglas, scripts, pruebas, comandos y cierre de DTD Cargo, con SDD propia, sin romper verify ni CI, y dejar la limpieza fuera de Git para Sam o el Director.

## Inventario (búsqueda por valor sobre origin/main e5169e86e)

Patrones: `graphify`, `knowledge:`, `knowledge-sync`, `knowledge-daily`, `knowledge-graph`, `archify`, `semanticPilot`, `GRAPH_REPORT`, `graphify-out`.

| Ruta | Qué era | Acción |
| --- | --- | --- |
| `AGENTS.md` | sección «Conocimiento y actualización» (knowledge:status, Graphify, Archify, Obsidian, runbook) y «graphify» en la lista de lecturas | sección reducida a guardado canónico + handoff; aviso de retiro |
| `.agents/skills/director/SKILL.md` | «Conservar conocimiento y revisar vigencia», knowledge:status/publish/check, `$graphify` | reemplazada por revisión de handoff; aviso de retiro |
| `.agents/skills/worker/SKILL.md` | «Cierre documental» con Graphify, semanticPilot, Archify, knowledge:status/publish | reducida a impacto documental en handoff |
| `docs/runbooks/codex-engineering.md` | «Conocimiento al iniciar y cerrar» | reducida; aviso de retiro |
| `docs/runbooks/knowledge-graphify-obsidian.md` | runbook completo | reemplazado por nota corta de retiro |
| `docs/engineering/project-rules.md` | «Vista visual del conocimiento» y «Mapa del repo (graphify)» | eliminadas |
| `docs/architecture/README.md` | enlace al mapa del ciclo de conocimiento | eliminado |
| `docs/architecture/knowledge-lifecycle.md`, `.archify.json` | mapa Archify | eliminados |
| `scripts/knowledge-{daily,sync,visual}.mjs`, `knowledge-graph.py`, `knowledge-graph-repair.py`, `knowledge-semantic-apply.py`, `knowledge-policy.json`, `knowledge-visual-evidence.json`, `archify.lock.json` | scripts y datos | eliminados |
| `scripts/lib/knowledge-{projection,state,vault,visual}.mjs` | módulos (único contenido de `scripts/lib/`) | eliminados; sin otros importadores |
| `scripts/tests/knowledge-*.node.mjs` (9) | pruebas del harness | eliminadas; el descubrimiento es por carpeta, no por lista fija |
| `package.json` | 6 comandos `knowledge:*` | eliminados |
| `.graphifyignore` | config Graphify | eliminado (y su línea en `.dockerignore`) |
| `.env.example`, `infra/dtd-cargo/.env.example` | `GRAPHIFY_PYTHON` | eliminado |
| `docs/specs/0471…`, `docs/specs/0623…` | specs | `status: superseded`, `superseded_by: "0632"`, aviso |
| `docs/specs/README.md` | índice | regenerado |
| `.gitignore`, `.dockerignore`, `eslint.config.mjs`, `scripts/check-pending-migration-symbols.mjs` | exclusiones de `graphify-out` | **conservadas** como protección mientras la carpeta exista en checkouts locales |
| `.github/workflows/*` | — | sin referencias |
| `docs/governance/*` | — | sin referencias |
| `.claude/` versionado | — | sin referencias |
| `docs/qa/0581-…`, specs anteriores, `.agents/handoffs/*` | evidencia histórica | sin cambios |

## Limpieza fuera de Git — PENDIENTE, condicionada

No se ejecutó nada. Solo después de que (1) Sam confirme el retiro con el cerebro privado avanzado, (2) la PR esté fusionada y (3) Sam dé el OK a estos borrados. Se miraron en lectura el 2026-11-13: los cinco existen.

```powershell
# 1. Tarea programada (Ready; ejecuta node scripts/knowledge-daily.mjs en el checkout principal)
Unregister-ScheduledTask -TaskName 'DTD Cargo - Graphify diario' -Confirm:$false
# 2. Derivados en el checkout principal (ignorados por Git)
Remove-Item -Recurse -Force 'C:\Users\AKX generator\Desktop\Developer\DTDCARGO\graphify-out'
Remove-Item -Recurse -Force 'C:\Users\AKX generator\Desktop\Developer\DTDCARGO\DTD Cargo'   # bóveda Obsidian publicada
# 3. Log de la corrida diaria
Remove-Item -Force "$env:LOCALAPPDATA\dtd-cargo\knowledge-daily.log"
# 4. Herramienta y skill locales
uv tool uninstall graphifyy
Remove-Item -Recurse -Force "$env:USERPROFILE\.codex\skills\graphify"
```

Antes del punto 2, si Sam quiere conservar algo de la bóveda `DTD Cargo/` (notas personales), que lo mueva al repositorio privado del cerebro. Después de la limpieza se pueden retirar, en otra PR, las exclusiones de `graphify-out` de `.gitignore`, `.dockerignore`, `eslint.config.mjs` y `scripts/check-pending-migration-symbols.mjs`. Si quedó un `.mcp.json` local con el server `graphify`, quitarlo (en el principal no existe).

## VALIDACIÓN

| Comprobación | Resultado |
| --- | --- |
| `node scripts/tests/run-harness.mjs` (sin las 9 pruebas knowledge) | PASÓ: 170 pruebas, 165 pasan, 0 fallan, 5 omitidas |
| `docs:check` / `sdd:check` | PASÓ (índice regenerado, 609 specs; sin números repetidos) |
| `pnpm verify` local (2026-11-13) | FALLÓ por dos pasos: `test` y `harness`. Detalle abajo |
| Vitest aislado: `spec-migration-refs`, `infra-env-example`, `env-example-contract`, `la-accion-lanza` | PASÓ 41/41 tras corregir `supersedes` |
| lint, typecheck, build dentro de verify | PASÓ |
| migrations-applied, sql-tests, schema-rebuild | NO EJECUTADO (SKIP de verify; no aplican a este diff) |
| CI de la PR | NO EJECUTADO: en borrador el CI no corre (SDD-0621) |

Fallos de `pnpm verify` y su causa:
- `spec-migration-refs` — **mío**: `supersedes` con dos IDs. Corregido a `"0471"` (la prueba admite uno); 0623 queda en `related` y en el cuerpo. Prueba sin cambios.
- `harness` → `verify-watchdog` «un árbol que calla…»: `Get-CimInstance` no respondió bajo carga. El mismo harness corrido solo, antes, dio 0 fallos. No toca archivos de esta tarea.
- `test` → `la-accion-lanza` (pasa aislada), `infra/ops/tests/migraciones.test.mjs` (timeout de 600 s) y varios «Failed to start forks worker»: carga de la PC, ver memoria de Vitest/forks. Ninguno toca archivos de esta tarea.

## PENDIENTES DE ESTA TAREA

- Confirmación de Sam para integrar (condición de arriba).
- Limpieza fuera de Git (condicionada).

## FUERA DE ALCANCE DETECTADO

- Ninguno.
