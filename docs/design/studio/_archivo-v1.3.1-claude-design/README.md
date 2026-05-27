# DTD Studio · v1.3.1 (Claude Design)

> Entrega completa del sandbox del Studio en versión **v1.3.1** (fix dark mode + todo lo previo).
> Recibido del usuario el **2026-05-24** vía 2 archivos ZIP en `~/Downloads/`.

---

## Qué contiene esta carpeta

| Carpeta/archivo | Qué es | Estado |
|---|---|---|
| `proyecto/` | Versión **v1.3.1 actual** del sandbox completo (119 archivos) | ⭐ Source of truth |
| `_archivo-v1.3/` | Versión **v1.3 anterior** (sin fix dark mode) | Para diff histórico |
| `PROMPT-CLAUDE-CODE.md` | Guía de operación para sesiones futuras de Claude Code que trabajen sobre el sandbox | Activo |
| `README.md` (este archivo) | Contexto de la entrega | — |

Backups originales en formato ZIP: `docs/design/handoffs-archive/DTD-Cargo-v1.3.1.zip` y `DTD-Cargo-handoff-v1.3.1.zip`.

---

## Qué NO es esto

**No son mockups HTML estáticos** que pedí inicialmente para validar layouts del módulo "Agentes y Skills". Es algo distinto y más grande:

Es la **fuente de verdad alternativa del Studio** — un mini-proyecto completo, ejecutable abriendo los HTMLs en el browser, donde Claude Design itera el ERP completo (visual + features + mock data + persistencia) ANTES de portarlo al repo Next.js de producción (`app/studio/`).

Por eso trae:
- HTMLs ejecutables (DTD Studio ERP, Mobile ERP, Portal Cliente, Operario CN/VE/Multi/Bodeguero, Brand Book v2.4, Reporte)
- Sistema completo `erp/` (21 módulos JSX + tokens + components + icons + mock data)
- Iteraciones nuevas en `nuevo/` (v1.1 → v1.3.1)
- Assets de marca en `handoff/` (logos, isotipos, colors.json, typography.json)
- 22 PNGs de capturas de iteración en `uploads/`
- `CLAUDE.md` con las reglas de marca aplicables al sandbox
- `HANDOFF.md` con notas operativas
- `PROMPT-CLAUDE-CODE.md` con la guía completa para sesiones de Claude Code

---

## Mapa de contenido (`proyecto/`)

### HTMLs ejecutables (raíz)
- `DTD Studio · ERP.html` — el ERP principal (admin)
- `Portal del Cliente.html` + `Portal del Cliente · standalone.html` + `... · standalone-src.html`
- `Mobile ERP.html` — versión móvil del ERP (v1.3, NUEVO)
- `Operario CN.html` · `Operario VE.html` · `Operario Multi.html` · `Bodeguero VE.html`
- `Brand Book DTD v2.2/v2.3/v2.4.html` (versiones del brand book)
- `Reporte DTD-Cargo.html`

### Sistema base (`erp/`)
- `tokens.css` — tokens light + dark (fuente única de color/spacing)
- `data.jsx` — mock data global (`window.ERPData`)
- `icons.jsx` — set de iconos SVG (`window.Icon`)
- `components.jsx` — UI primitives (`window.ERPUI`: Btn, Input, Select, Badge, Card, Table, KPI, Drawer, Modal, Tabs, Avatar, Progress, EmptyState)
- `shell.jsx` — sidebar + topbar + router
- `tweaks-panel.jsx`
- `modules/` — 21 módulos del ERP original (admin, calendar, clients, cn, comments, costing, dashboard, documents, invoices, leads, mailing*, quick-email, quotes, rates, reports, seniat, shipments, suppliers, tms, tracking, users, vault, ve)

### Iteraciones nuevas (`nuevo/`)
- `feature-flags.jsx` — estado global (`window.DTDFlags`)
- `rates.jsx` — helper tasas USD/VES/CNY (`window.ERPRates`)
- `modules/` — overrides + módulos nuevos:
  - `dashboard.jsx` — override del Dashboard con editor de KPIs/widgets (Sprint A1)
  - `qr-queue.jsx` — Cola de QR para oficina (Sprint A2)
  - `conciliacion.jsx` — Conciliación bancaria (Sprint C2)
  - `audit-log.jsx` — Audit log con drill-down (Sprint C3)
  - `contabilidad.jsx` + `contabilidad-data.jsx` — Contabilidad QuickBooks-like (v1.2)
- `pantallas/` — HTMLs standalone:
  - `chofer-perfil.html` + `.jsx` (Sprint A3)
  - `camion-perfil.html` + `.jsx` (Sprint A4)
  - `agente-perfil.html` + `.jsx` (Sprint A5)
  - `estado-cuenta.html` + `.jsx` (Sprint C1)
- `mobile/app.jsx` — Mobile ERP app completa (v1.3)
- `README.md` — reglas detalladas del subfolder
- `CHANGELOG.md` — bitácora de TODOS los cambios v1.1+ (37 KB, lectura obligatoria al arrancar sesión sobre este sandbox)
- `PROMPT-CLAUDE-CODE.md` — guía operativa

### Apps móviles operarios (`operario/`)
- `app.jsx` (Operario CN), `ve.jsx` (Operario VE), `bodeguero.jsx`

### Portal cliente (`portal/`)
- `app.jsx` + `app-standalone.jsx`

### Marca (`handoff/docs/clients/dtdcargo/brandbook/`)
- `colors.json`, `typography.json`
- `dtdcargo-isotipo.{svg,png,jpg}`, `dtdcargo-logo-light.svg`, `dtdcargo-logo-lockup.svg`, `dtdcargo-dimensions-box.svg`
- `README.md`

### Capturas y misceláneos
- `uploads/` — 22 PNGs (capturas de iteración, screenshots)
- `scraps/` — 1 sketch napkin
- `assets/` — container.svg + dtdcargo-icon-navy.png

### Documentación operativa (raíz)
- `CLAUDE.md` — reglas de marca aplicables al sandbox (idéntico a `proyecto/CLAUDE.md` y al `BRAND.md` del repo)
- `HANDOFF.md` — notas del handoff
- `estado-cuenta.jsx` — pantalla suelta en raíz (consolidar a `nuevo/pantallas/` si se reusa)

---

## Cómo usar este sandbox

1. **NO modificar nada acá** desde el repo de producción. El sandbox es read-only para nosotros.
2. **Si queremos cambiar algo visual**, lo hacemos en el sandbox (vía sesión separada de Claude Code) y después lo portamos al repo Next.js.
3. **Para previsualizar**: abrir cualquier HTML doble-click (no necesita server). Los JSX se cargan via `<script type="text/babel">`.
4. **Para portar al repo de producción** (`app/studio/`):
   - Identificar el módulo o pantalla a portar
   - Adaptar JSX inline → componentes React/TSX del Studio
   - Reemplazar `window.ERPUI`/`window.Icon`/`window.ERPData` por los equivalentes del repo (`@/app/studio/_components/ui/*`, queries Supabase reales, etc.)
   - Reemplazar tokens hex literales del sandbox por `var(--*)` del `app/studio/tokens.css`
   - Anotar el origen en la SDD correspondiente

---

## Cambios v1.3.1 vs v1.3 (lo nuevo de esta entrega)

Del `nuevo/CHANGELOG.md`:

> **2026-05-24 · v1.3.1 · Fix dark mode · cards siempre oscuras**
>
> **Bug:** 9 lugares usaban `background: var(--ink)` con texto `#fff`. En dark mode `--ink` se invierte a `#F2F0EC` (claro) → texto blanco sobre fondo claro = invisible.
>
> **Fix:** reemplazado por `var(--bg-sidebar)` que se mantiene oscuro en ambos temas (light `#0F1E3D` · dark `#060D1C`).
>
> **Archivos modificados** (todos en `nuevo/`):
> - `nuevo/modules/audit-log.jsx` · Mini map ubicación + JSON pre block
> - `nuevo/modules/conciliacion.jsx` · Balance strip
> - `nuevo/modules/contabilidad.jsx` · Card "Total caja+bancos" + footers P&L + Balance
> - `nuevo/pantallas/estado-cuenta.jsx` · RatesBanner (BCV/Paralelo/Spread)
> - `nuevo/pantallas/agente-perfil.jsx` · Card "Habilitación SENIAT"
> - `nuevo/pantallas/chofer-perfil.jsx` · Pills A/B/C/D/E categorías licencia

---

## Próximos pasos sugeridos

1. **Brand audit visual**: abrir cada HTML, tomar screenshots light + dark, verificar que respete BRAND.md y tokens reales. Revisar específicamente el fix dark mode de v1.3.1.
2. **Component mapping**: cruzar los componentes del sandbox (`window.ERPUI.*`) contra los que existen en el repo de producción (`app/studio/_components/ui/*`) y documentar drift.
3. **Priorización de port**: cuáles de las features del `nuevo/` valen un SDD propio para portar al repo de producción (candidatos obvios: Contabilidad → ¿SDD-0026?; Mobile ERP → ¿SDD-0027?; Estado de cuenta cliente → ¿SDD-0028?; Conciliación bancaria → ¿SDD-0029?).
4. **Sync con SDD-0020** (Agentes y Skills): este sandbox NO incluye el módulo Agentes — sigue como SDD-0020 según el plan existente, sin afectar lo aquí entregado.

---

## Origen y trazabilidad

- **Quién**: Claude Design (sesión externa del founder)
- **Cuándo**: 2026-05-24
- **Cómo llegó**: 2 archivos ZIP en `~/Downloads/` (`DTD-Cargo.zip` + `DTD-Cargo-handoff.zip`) + 1 archivo MD guía (`PROMPT-CLAUDE-CODE.md`)
- **Validación de integridad**: SHA256 de ambos ZIPs distintos; contenido descomprimido confirma que `01-dtd-cargo` (renombrado `proyecto/`) tiene CHANGELOG más reciente (v1.3.1) y `02-dtd-cargo-handoff` (renombrado `_archivo-v1.3/`) tiene la versión anterior (v1.3).
