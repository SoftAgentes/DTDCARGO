# Forja DTD — qué hicimos (2026-06-26)

Sesión: integrar Forge a DTD Cargo (proyecto ya avanzado) **sin romper la metodología existente** (SDD + harness `/feature`). Decisión: Forge = **toolbox LOCAL/personal**, no entra al repo del equipo.

---

## 1. Descarte: `/forge-init` NO aplica

`/forge-init` es para proyectos template greenfield. En DTD habría sido destructivo: sobrescribe `README.md`, edita un `CLAUDE.md` tipo "Forge V… Cerebro de la Fábrica" que acá **no existe** (tu `CLAUDE.md` es solo el puente `@AGENTS.md`), y mueve skills por un "BUILD_MODE" que el proyecto no tiene. **No se corrió.**

## 2. Diagnóstico

- Forge ya estaba físicamente instalado en `.claude/` (skills, 15 agents, 47 commands, `.forge/manifest.json` v5.1.0) — **inerte**: archivos que Claude lee solo cuando los invocás; no tocan `app/`/`lib/`/`docs/`.
- **Riesgo real = el borde de git.** El `.gitignore` viejo dejaba pasar `.claude/agents/**` y `.claude/commands/**` enteros → un `git add` metía los 60+ archivos de Forge al repo del equipo, compitiendo con tu metodología.

## 3. Cambios aplicados

### a) `.gitignore` — Forge aislado como toolbox local ✅ commiteado (`ac39a1f`)
Whitelist explícita: **solo** tu harness DTD se versiona.

```
.forge/                          # (último cambio, SIN commitear todavía)
.claude/*
!.claude/agents/
.claude/agents/*
!.claude/agents/implementer.md
!.claude/agents/leader.md
!.claude/agents/reviewer.md
!.claude/commands/
.claude/commands/*
!.claude/commands/feature.md
!.claude/commands/radar.md
!.claude/commands/ui-check.md
!.claude/settings.json
```

Todo lo de Forge (skills/agents/commands extra + `.forge/`) queda local.

### b) `settings.json` — revertido al original limpio ✅
Forge le había metido 7 hooks apuntando a `.claude/hooks/*.sh` (carpeta local/gitignored). Si se commiteaba, **rompía los commits de tus compañeros** (apuntaría a scripts que no existen en su repo) + corría `test-runner.sh` en cada Edit. Revertido. Los 8 `.sh` siguen en disco para uso local.

### c) `/forja` — la-forja adaptada a DTD ✅ creado (local/gitignored)
Archivo: `.claude/commands/forja.md`

---

## 4. Qué es `/forja`

Ejecución **competitiva en paralelo**: N agentes implementan la **MISMA** spec SDD con enfoques distintos, en worktrees aislados; al final comparás y cherry-pickeás lo mejor.

**Uso:** `/forja <spec-SDD> <N>` → ej. `/forja 0107 3`

**`/feature` vs `/forja`:**
- `/feature` = UN enfoque secuencial (la mayoría de specs).
- `/forja` = explorar VARIOS enfoques en paralelo cuando el enfoque importa (cuesta N× tokens).

**Personalidades** (dentro de los rieles de DTD, sin "disruptivo/arquitectura radical"):
| Lane | Personalidad | Prioridad |
|---|---|---|
| 1 | Fiel | Fidelidad estricta a spec + AGENTS.md |
| 2 | Robusto | TDD + edge cases + defensa en DB (`*_in_tenant()` + trigger) + RLS |
| 3 | Pragmático | Mejoras UX/patterns dentro de convenciones → `MEJORAS.md` |

**Reusa tu infra:** `scripts/harness-worktree.mjs` (worktrees + `.env.local` + `pnpm install`), agente `implementer`, gate `node scripts/verify.mjs`.

**Adaptaciones críticas vs la-forja original:**
1. ❌ NO Supabase local/Docker — DTD usa SIEMPRE la nube prod (`xpfuzq`). Los N lanes comparten la misma DB; nadie corre `dev` ni aplica migraciones (solo escriben archivos `.sql`). `verify.mjs` no corre SQL → seguro en paralelo.
2. ❌ NO bash/`setup.sh` — todo Node (Windows).
3. Input = spec SDD (no BLUEPRINT). Gate = `verify.mjs`. Respeta frontera público↔ERP. Nunca push/deploy/merge automático.

---

## 5. Pendientes

- [ ] `.gitignore` tiene el cambio `.forge/` **sin commitear** → cerrar con commit selectivo.
- [ ] **Push** del commit `ac39a1f` (y el de `.forge/`) → requiere tu OK.
- [ ] (Opcional) Probar `/forja` en seco con una spec real para ver el flujo.

> Branch de la sesión: `feat/persons-identidad`. Nada se pusheó.
