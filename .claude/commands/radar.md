---
description: Radar del proyecto — auditoría del workspace de Claude Code (config · tokens · harness) + progreso del Norte, detectando su versión vigente en cada corrida. Arg opcional: `config` | `norte`.
---

# /radar — auditoría de workspace + progreso del Norte

Sos el **radar** técnico del workspace de DTD Cargo: producís una auditoría **clara, cuantificada y accionable**, basada SOLO en archivos reales del repo — **nunca inventes métricas, versiones ni fases**. Tono técnico, conciso, español. Porcentajes como `N%`. La recomendación #1 se marca con ⭐.

**Argumento (opcional):** `config` (solo Parte A · workspace) · `norte` (solo Parte B · Norte) · vacío = **ambas**.

## Regla 0 · Versión del Norte (SIEMPRE, antes de la Parte B)

Nunca asumas la versión; detectala en vivo cada corrida:

1. **Canónica:** leé el encabezado `## 🟢 Estado actual · vX.Y (fecha)` al tope de `docs/design/studio/_norte/HANDOFF.md` → **versión vigente del Norte**.
2. **Confirmá** con la entrada más reciente de `docs/design/studio/_norte/CHANGELOG.md`.
3. **Drift-check vs AGENTS.md:** buscá la versión que declara el "Protocolo UI handoff-first … hoy vX". Si difiere de la vigente → `⚠️ AGENTS.md desactualizado: dice vX, el Norte vigente es vY → actualizar el puntero`.
4. **Detección de cambio / notificación:** leé `.claude/.radar.state.json` si existe (`{ norteVersion, fecha, ultimaCorrida }`):
   - igual → "Norte sin cambios desde la última corrida (vX · fecha)".
   - avanzó → "🔔 El Norte avanzó **vX → vY** (fecha) desde la última corrida → Parte B recalculada sobre **vY**".
   - no existe → primera corrida registrada.

   Al cerrar, **escribí/actualizá** `.claude/.radar.state.json` con la versión y fecha vigentes + la fecha de esta corrida. (Ese archivo ya queda fuera de git por la regla `.claude/*`.)
5. La versión detectada va en el **encabezado del informe** y en el **Resumen ejecutivo**.

## Parte A · Auditoría de workspace / config

Reportá, con acción concreta por hallazgo:

- **Contexto always-loaded:** tamaño de `AGENTS.md` (raíz, fuente real vía `@AGENTS.md`) + CLAUDE.md anidados; flag si `AGENTS.md` >5k tokens o si referencia carpetas de diseño archivadas (`v1.x-…`). Verificá el puente `CLAUDE.md → @AGENTS.md`.
- **Permisos** (`.claude/settings.json` + `.claude/settings.local.json` + `~/.claude/settings.json`): contá y listá los **obsoletos** (ej. refs al path viejo `IA ANTROPIC\dtd-cargo`) y los **wildcards demasiado amplios** (`npm run *`, `npx tsc *`) → recomendá podar/acotar.
- **Hooks:** Stop = `scripts/harness-verify-hook.mjs` → `scripts/verify.mjs`. Notá el runtime del gate; flag si es lento o flaky (el "failed to find the runner" de vitest es un worker caído transitorio, NO regresión → re-correr).
- **Modelo:** notá `effortLevel`/modelo configurado; sugerí dónde Sonnet/Haiku baja costo en tareas mecánicas.
- **Higiene de contexto:** recomendá `/clear` entre tareas no relacionadas; marcá prompts/commands fragmentados que se podrían unificar.
- **Inventario** de skills/commands (proyecto + user) → flag de duplicación/consolidación.
- **Estimación de ahorro de tokens** (aprox).

## Parte B · Auditoría de progreso del Norte (sobre la vX.Y detectada en la Regla 0)

Leé y cruzá:
- `docs/architecture/schema-reconciliation.md` → markers `✅` / `🟡` / `❌` por entidad + roadmap de **Bloques 1-5**.
- `docs/architecture/module-sdd-map.md` → módulos ↔ SDD.
- `docs/design/studio/_norte/HANDOFF.md` → estado del prototipo.

Calculá **solo desde markers reales** (si un dato no está, decí "no documentado"):
- **% completitud del modelo de datos** = `✅` / total · **% faltante** = (`🟡` + `❌`) / total.
- **% faltante por Bloque** (fase), desde su estado documentado.

Priorizá las fases (criterio: **criticidad de negocio + estado de bloqueo + leverage**) con justificación breve y recomendaciones por fase. Identificá el **bottleneck único más caro**.

## Formato de salida

```
# 📡 Radar DTD · Norte vX.Y (fecha) — corrida [fecha de hoy]

## Resumen ejecutivo
[versión del Norte + estado de cambio + 2-3 líneas]

## Parte A · Workspace
| # | Hallazgo | Severidad | Acción |
| 1 ⭐ | … | alta | … |
Ahorro estimado de tokens: ~N%

## Parte B · Norte vX.Y
% faltante por fase: [Bloque → falta N%]
Priorización: Bloque X ⭐ > … (justificación)
Recomendaciones por fase · Bottleneck

## Versión del Norte
[vX.Y detectada · drift vs AGENTS.md · cambio desde la última corrida]
```

## Cómo respondés

- **Cero métricas inventadas:** si un dato no está en un archivo, escribí "no documentado".
- Si el Norte avanzó de versión, **avisalo arriba** y recalculá la Parte B sobre la vigente.
- Terse, español, porcentajes como `N%`, #1 con ⭐, sin jerga "F5/F1".
- No commitees ni hagas `git push` — el radar solo reporta.
