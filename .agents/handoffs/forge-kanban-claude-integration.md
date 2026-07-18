# Handoff — Integración de Skill Plugin Kanban en Claude Code (DTDCargo)

| | |
|---|---|
| **Fecha** | 2026-07-16 |
| **Rama** | `feat/forge-kanban-claude` |
| **Worktree** | ninguno — checkout principal `DTDCargo/` |
| **Commit que contiene este handoff** | consultar `git log -1 --oneline` |
| **`main`** | ❌ **sin tocar** |
| **Push** | ❌ **no realizado** |
| **Limpieza** | ❌ **nada borrado** (worktrees y ramas intactos) |
| **Núcleo canónico (HAMUDI)** | ❌ **sin modificar** — las correcciones van como patches abajo |
| **Origen del núcleo** | `ERP HAMUDI/.agents/skills/forge-kanban` @ `16b8ed4` |

---

## 1 · Veredicto de la auditoría: **APROBADO**

El núcleo de Codex **resuelve las tres fallas estructurales que HAMUDI arrastraba**. Verificado por
ejecución, no por lectura:

| Falla en HAMUDI | Estado en el núcleo |
|---|---|
| `.forge/forge-kanban.yml` letra muerta (ningún script lo leía) | ✅ `lib/config.mjs` lo parsea. `parseSimpleYaml` es un subconjunto deliberadamente chico que **lanza ante sintaxis desconocida** — "para evitar aceptar configuración que no se aplica". Correcto por construcción. |
| `capability-router.yaml` prosa sin parser | ✅ `lib/router.mjs` lo parsea. `route product_design` → `impeccable`/`web-quality`/evidencia. Desconocida → bloquea + `suggested_skill: skill-creator`. |
| Detección de sesiones = prosa (`requiresCodexTaskInspection: true`) | ✅ `lib/sessions.mjs`: `process.kill(pid,0)` valida PID · `netstat -ano` cruza puerto↔owner contra PID reuse · `active = alive && tcpMatches && matchesPath` · **`absence_proven: false`** hardcodeado + campo `limitation` con la verdad. |
| Gate planning→dev sin enforcement | ✅ `control-plane.mjs:46-48` lo exige en código (`spec_ref`, `builder_skills`, `review_skills`, `owned_paths`, `gate`, `evidence`). |

---

## 2 · Pruebas — todas ejecutadas

```
node .agents/skills/forge-kanban/test-forge-kanban.mjs
  → ALL FORGE KANBAN TESTS PASSED (28/28, exit 0)

node scripts/verify.mjs
  → verify: TODO VERDE ✓   (lint · rsc-boundary · typecheck · test · docs:check · e2e)

node .agents/skills/forge-kanban/scripts/forge-kanban.mjs doctor --json
  → healthy: true — git_repository · base_commit · config_parsed · ticket_directory · capability_router

node .agents/skills/forge-kanban/scripts/forge-kanban.mjs route product_design --json
  → blocked: false · builder: [impeccable] · reviewer: [web-quality] · resuelto desde YAML

node .agents/skills/forge-kanban/scripts/forge-kanban.mjs route inexistente --json
  → blocked: true · suggested_skill: skill-creator

node .agents/skills/forge-kanban/scripts/harness.mjs plan-finish .
  → LIMPIEZA_BLOQUEADA (not_primary_checkout: false, clean_including_untracked: false)  ✅ fail-closed
```

Anti-teatro verdes: `doctor parses project config instead of documenting it` ·
`router resolves builder and reviewer from YAML` · `unknown capability blocks closed` ·
`cleanup remains blocked without positive session and integration proof` ·
**`stale Claude lock is not treated as an active window`**.

---

## 3 · Archivos — 24, todos propios

**Núcleo instalado sin reconstruir** (vía su propio `scripts/install.mjs`) — 19 archivos en
`.agents/skills/forge-kanban/`, byte-idénticos al canónico salvo `SKILL.md` (N1+N2) y
`agents/claude.yaml` (nuevo).

**Wrappers finos de Claude — lo único que se creó:**

| Archivo | Rol |
|---|---|
| `.claude/commands/forge-kanban.md` | Thin command. Resuelve local → `~/.claude/skills` → `~/.codex/skills`. Cero nombres de modelo. |
| `.claude/commands/cerrar.md` | Thin command → `harness.mjs plan-finish`. Nunca borra. |
| `.agents/skills/forge-kanban/agents/claude.yaml` | Descriptor de interfaz, espejo de `openai.yaml`. |

**Binding y adaptadores DTD:**

| Archivo | Cambio |
|---|---|
| `.forge/forge-kanban.yml` | `sol`/`terra` → `claude-opus-4-8` (`max`/`high`), `luna` → `claude-haiku-4-5` con **`reasoning_effort: null`** (ese modelo **rechaza** el parámetro y falla si se envía). `max_forja_agents: 3`, `create_if_missing: false`. |
| `scripts/bitacora-metrics.mjs` | Adaptador de 3 líneas. **Obligatorio** — ver P7. |
| `.gitignore` | `.forge/` → `.forge/*` + `!.forge/forge-kanban.yml`. |

**Conservados sin tocar** (regla del founder): `scripts/harness-worktree.mjs` (adaptador
brownfield) · `dashboard/dashboard-data.json` (vista adoptada, no reemplazada) · los 15 skills
ajenos en `.agents/skills/` · `.agents/handoffs/` preexistente · `outputs/` · `_COMMUNITY_*`.

**17 untracked ajenos verificados intactos.** Staging 100% selectivo — nunca `git add .` ni `-A`.

---

## 4 · Patches propuestos al núcleo

**No aplicados en HAMUDI.** P1 y P2 sí están en la copia de DTDCargo (sin ellos Claude no funciona).

### P1 · `SKILL.md` — el fallback global era exclusivamente `.codex` 🔴

```diff
-$FORGE_KANBAN = if (Test-Path .agents\skills\forge-kanban) {
-  (Resolve-Path .agents\skills\forge-kanban).Path
-} else {
-  Join-Path $HOME '.codex\skills\forge-kanban'
-}
+$FORGE_KANBAN = @(
+  '.agents\skills\forge-kanban',
+  (Join-Path $HOME '.claude\skills\forge-kanban'),
+  (Join-Path $HOME '.codex\skills\forge-kanban')
+) | Where-Object { Test-Path $_ } | Select-Object -First 1
+if (-not $FORGE_KANBAN) { throw 'Forge Kanban no está instalado.' }
+$FORGE_KANBAN = (Resolve-Path $FORGE_KANBAN).Path
```

**Por qué:** en Claude Code `~/.codex/skills/` no existe. Sin instalación local, el skill no resuelve.

### P2 · `SKILL.md` — la tabla de modelos hardcodeaba `gpt-5.6-*` 🔴

Reemplazada por clases lógicas `sol`/`terra`/`luna` + "resolvé desde `.forge/forge-kanban.yml`".

**Por qué:** contradecía la regla "el core no hardcodea nombres de modelos" **y al propio config del
núcleo**, que ya usa clases correctamente. Una sesión de Claude leyendo el SKILL.md sería instruida a
usar modelos de OpenAI. Se añadió la nota de que `reasoning_effort: null` es válido y deliberado.

### P3 · `lib/config.mjs:7` — el default contradice al instalador 🟡

```diff
-  ticket_dir: '.claude/backlog/tickets',
+  ticket_dir: '.forge/backlog/tickets',
```

**Por qué:** hay **tres respuestas distintas** hoy — `DEFAULT_CONFIG` dice `.claude/backlog/tickets`,
`assets/forge-kanban.example.yml` dice `.forge/backlog/tickets`, e `install.mjs` **crea**
`.forge/backlog/tickets`. Un proyecto sin config toma un path de Claude desde el núcleo universal.
*(No aplicado en la copia DTD: el binding fija `ticket_dir` explícitamente, así que no muerde acá.)*

### P4 · Fugas de portabilidad 🟡

| Archivo:línea | Fuga |
|---|---|
| `SKILL.md:190` | `npm.cmd run test:forge-kanban` — npm + Windows en el núcleo |
| `assets/bitacora-template.html:36` | `npm run bitacora:metrics:write` |
| `SKILL.md:202` | "Supabase" nombrado en el núcleo |
| `references/capability-router.yaml:56` | `builder_skills: [supabase, insforge]` *(discutible: es identidad de capacidad, no dependencia)* |

Comando de verificación:
```bash
grep -rniE 'hamudi|boreal|dtd|supabase|vercel|next\.js|C:\\Users' .agents/skills/forge-kanban/
grep -rnE '\b(npm|pnpm)\b' .agents/skills/forge-kanban/
```

### P5 · `harness.mjs` — sin `start`, y `cleanup_allowed` nunca puede ser `true` 🟡

Comandos reales: `list|inspect|plan-finish|finish`. **Falta `start`** → el arnés universal no puede
crear worktrees. Y `head_durably_preserved`, `integrated_in_published_integrator` y
`handoff_and_evidence_saved` están **hardcodeados en `false`**, más `session_inactive_proven` que lee
el `absence_proven: false` fijo → `finish` siempre sale 1 o 2.

**Lectura:** es **diseño deliberado** (línea 57: *"requiere un recibo firmado; use el integrador de
plataforma"*), confirmado por el founder: *"el arnés universal se mantiene como asesor fail-closed"*.
**Propuesta: documentarlo en el SKILL.md**, para que no se lea como bug.

### P6 · `harness.mjs:31` — `-C` duplicado 🟢

`git()` ya inyecta `-C root`; la línea 31 pasa `'-C', target` → `git -C root -C target status`.
Funciona solo porque el target es absoluto (el último `-C` gana). Frágil.

### P7 · `test-forge-kanban.mjs:18` — la suite del portable exige un adaptador del proyecto 🔴

```js
const METRICS = join(ROOT, 'scripts', 'bitacora-metrics.mjs')   // ROOT = raíz del proyecto
```

**El defecto que rompió la instalación.** El test de un paquete **portable** exige que exista
`<proyecto>/scripts/bitacora-metrics.mjs`. HAMUDI lo tiene; ningún proyecto nuevo lo tiene.
**2 de 28 tests fallan fuera de HAMUDI** (`metrics writes the resolved Williams bitacora`,
`metrics payload contains Williams identity`).

Contradice a la propia spec: *"El proyecto **puede** tener un adaptador de dos líneas"* — pero el test
lo hace **obligatorio**.

**Propuesta:** que el test caiga al colector portable cuando no haya adaptador local — igual que ya
hace `forge-kanban.mjs:metricsScript()`, que tiene el fallback correcto.

**Workaround aplicado en DTD:** se creó el adaptador de 3 líneas (patrón documentado). 28/28 verdes.

---

## 5 · Riesgos y pendientes

### 🔴 Disco al 99%

`C: 400G · 7.3G libres`. **El commit falló la primera vez** con `unable to write loose object file:
No space left on device` (había 47 MB). El founder liberó espacio. Con 7.3 GB, un `pnpm install` en
un worktree nuevo puede volver a llenarlo.

**Medido, contra la hipótesis inicial:** `../DTD-worktrees/` pesa **12 MB**, no es la causa.

### 🟡 36 carpetas huérfanas en `../DTD-worktrees/`

```
carpetas: 36 · git worktree list: 1 · ninguna con .git · ramas feat/*: 0
```

Residuo del fallback destructivo de `harness-worktree.mjs`: `git worktree remove` desregistra
**antes** de borrar; si el borrado falla por long-path de Windows, la carpeta queda. **No se tocaron**
(regla: ante duda, conservar). Son 12 MB — molestia, no urgencia. Justifican las prohibiciones de
"borrado manual como fallback automático".

### 🟡 Declarado pero no consumido por código

El núcleo solo **lee por código** `ticket_dir` y `kanban_view`. `models`, `dashboard`,
`max_forja_agents` y `mode` se parsean y mergean, pero **ningún script los usa** — los consume el
agente vía SKILL.md.

Legítimo para un skill, **pero hay que decirlo**: `dashboard.strategy: detect_and_reuse` **no está
implementado**. Nada detecta ni reusa el dashboard todavía. `dashboard/dashboard-data.json` sigue
intacto y con su dueño actual (`actualizar-dashboards`).

### 🟡 Divergencia copia DTD ↔ núcleo canónico

`SKILL.md` de DTDCargo tiene P1+P2; el de HAMUDI no. **Un `install.mjs --force` los revertiría.**
Se cierra cuando P1/P2 entren al núcleo.

### 🟢 Backlog vacío

`.forge/backlog/tickets/` existe y está vacío. Ningún ticket v3 creado — fuera del alcance
autorizado. `status`/`reconcile` funcionan pero no reportan nada.

### 🟢 El agujero que no cierra

`session_inactive_proven: false` es **honesto, no un bug**. En Windows es **indemostrable** que
ninguna terminal mantenga un `cwd`: `Win32_Process` **no expone working directory** (verificado
contra `CimClassProperties`), `handle.exe` no está instalado, `openfiles` requiere reboot, y el path
del worktree **no aparece** en la CommandLine de `next dev`. Cobertura real ~85–90% (ventana de
Claude viva, dev server vivo). **Una terminal con `cd` al worktree es invisible.**

---

## 6 · Siguiente responsable

**Founder.** Decisiones abiertas:

1. ¿P1–P7 vuelven al núcleo canónico? P1/P2 son bloqueantes para Claude; **P7 rompe cualquier
   instalación nueva**.
2. ¿Push de `feat/forge-kanban-claude`? — no autorizado aún.
3. ¿Las 36 huérfanas? — conservadas, esperando decisión.
4. ¿Implementar `dashboard.strategy` o quitarlo del config hasta que exista?
