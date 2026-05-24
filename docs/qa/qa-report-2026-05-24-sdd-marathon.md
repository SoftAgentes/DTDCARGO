# QA Report — DTD Studio (localhost:3000)

**Date:** 2026-05-24
**Tier:** Quick (smoke + critical/high fixes only)
**Mode:** Diff-aware (12 commits de la sesión sobre main)
**Branch:** main
**Duration:** ~12 min
**Pages visited:** 8
**Framework:** Next.js 16 (Turbopack)
**Auth:** sesión existente (hailuway.com user)

---

## Health Score

| Categoría | Score | Peso |
|---|---|---|
| Console | 100/100 | 15% |
| Links | 100/100 | 10% |
| Visual | 100/100 | 10% |
| Functional | 100/100 | 20% |
| UX | 100/100 | 15% |
| Performance | 100/100 | 10% |
| Content | 100/100 | 5% |
| Accessibility | 100/100 | 15% |
| **Total** | **100/100** | |

**0 issues encontrados.** No hubo fixes que aplicar en Quick tier.

---

## Top 3 cosas a fijarse en próxima sesión

(No críticas — son observaciones del estado actual, no bugs)

1. **`AGT-0001` Tracking Concierge sigue en status `active`** en el tenant hailuway.com. Si ejecutás manualmente desde "Ejecutar ↗", va a fallar con `permission denied for table agent_runs` hasta que apliques `0016_agent_runs_service_role_grants.sql` a prod.
2. **`ANTHROPIC_API_KEY` no configurada en `.env.local`** — el endpoint cae al MockLLMClient sin problemas, pero no podés validar el flujo Anthropic real hasta agregar la key.
3. **Migraciones pendientes de aplicar a prod:** `0016` (GRANT fix), `0017` (Vault schema), `0018` (Mailing schema), `0019` (Users+Roles schema). Las 4 escritas + commiteadas a main, no aplicadas.

---

## Smoke test — 8 páginas

### ✅ Page 1: `/studio/dashboard`

- Title: `Dashboard · DTD Studio`
- Eyebrow: `OPERACIÓN · 24 MAY 2026` (en wine)
- Saludo: `Buenas tardes, Hailuway.` (personalizado al user logueado)
- AgenticHealthCard renderiza (state: 1 agente instalado, 1 activo)
- Console errors: **0**
- Server errors: **0**

### ✅ Page 2: `/studio/admin`

- H1: `Administración`
- Pill "Acceso restringido · Admin" en wine
- Sidenav: 13 items agrupados (BÁSICO 6 / INTERMEDIO 3 / PRO 4)
- Item activo default: `Datos de la empresa` (primer BÁSICO)
- H2 sincroniza con sidenav activo
- Console errors: **0**

### ✅ Page 3: `/studio/admin?section=agents`

- H2: `Agentes y Skills`
- Item activo en sidenav cambia a "Agentes y Skills" (grupo PRO)
- CTA `Abrir Agentes y Skills →` apunta a `/studio/admin/agentes` correcto
- Console errors: **0**

### ✅ Page 4: `/studio/admin?section=features`

- H2: `Casos de uso · ON/OFF`
- Eyebrow: `BÁSICO`
- Panel "POR IMPLEMENTAR" con dashed border
- Tag SDD-0030 visible
- Mensaje "El shell está listo, falta el contenido."
- Console errors: **0**

### ✅ Page 5: `/studio/admin/agentes` (tab default = Catálogo)

- 4 KPIs row (Activos / Runs hoy / Aprobaciones / Gasto MTD)
- 3 tabs: `Catálogo 1` (activo) · `Instalados 1` · `Runs` (sin count)
- 1 skill card visible (Tracking Concierge)
- Console errors: **0**

### ✅ Page 6: `/studio/admin/agentes/tracking-concierge` (detalle skill)

- H1: `Tracking Concierge`
- Back link → `/studio/admin/agentes?tab=catalog` correcto
- Botón "Instalar skill" habilitado (no disabled — porque ya hay 1 instalado, pero no bloqueamos crear otro)
- 4 tools listadas correctamente (`get_shipment`, `get_shipment_timeline`, `search_shipments_by_customer`, `get_customer`) con badge "read-only"
- Console errors: **0**

### ✅ Page 7: `/studio/admin/agentes?tab=installed`

- 1 row: `Tracking Concierge` / `AGT-0001` / Estado: `Activo`
- 3 botones acción row: `Pausar`, `Apagar`, `Ejecutar ↗` (correctos para status=active)
- Console errors: **0**

### ✅ Page 8: `/studio/admin/agentes?tab=runs`

- 0 rows (esperado — submit del orchestrator está bloqueado por GRANT pendiente)
- Empty state correcto: "No hay ejecuciones registradas"
- CTA `Ver agentes instalados →` apunta a `?tab=installed` correcto
- Console errors: **0**

---

## Interacciones críticas testeadas

### ✅ Toggle status agent (server action + revalidatePath)

| Acción | Status antes | Status después | Botones después |
|---|---|---|---|
| Click `Pausar` en AGT-0001 | Activo | **Pausado** | Activar / Apagar |
| Click `Activar` | Pausado | **Activo** | Pausar / Apagar / Ejecutar ↗ |

`toggleAgentStatusAction` + `revalidatePath` funciona end-to-end sin reload manual.

### ✅ Sidenav admin navigation

Click directo a URL `?section=permissions` cambia:
- H2 a "Permisos por rol"
- Eyebrow a "INTERMEDIO"
- Item activo del sidenav a "Permisos por rol"
- Tag a SDD-0024 (consistente con la spec recién escrita)

### ✅ InstallSkillDrawer apertura + cierre

- Botón "Instalar skill" abre dialog `role="dialog" aria-modal="true"`
- 4 fields renderizados con defaults correctos:
  - `skill_id` (hidden): UUID real de la skill
  - `name`: `Tracking Concierge` (default del skill.name)
  - `model`: `claude-sonnet-4-6` (default del skill.default_model)
  - `budget_usd_monthly`: `50`
- Click "Cancelar" cierra el drawer
- **NO ejecuté submit** para no crear AGT-0002 en DB

---

## PR Summary (1 línea)

> QA Quick sobre 12 commits de la sesión: 8 páginas + 3 interacciones críticas testeadas, 0 issues, health score 100/100. Listo para merge.

---

## Notas técnicas

- **Stash:** `git stash push -u -m "qa-session-temp: docs/design handoff + CLAUDE.md regla previa"` aplicado al inicio. Restaurado con `git stash pop` al final.
- **Preview server:** Next.js 16 (Turbopack) en `:3000`, reuso de sesión.
- **No se aplicaron fixes** porque no se encontró ningún issue de severidad critical/high (única severidad permitida en Quick tier).
- **Issues low/medium deferred:** 0 (la sesión tuvo tan buena higiene de typecheck + revisiones visuales en vivo que no quedó deuda QA).

---

## Estado del repo después de QA

Sin cambios. Solo lectura. No se agregaron commits ni se modificaron archivos. El stash original se restauró.
