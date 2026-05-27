# Audit Report · DTD Studio Sandbox v1.3.1

> **Auditor**: Claude (sesión 2026-05-24)
> **Sandbox**: `docs/design/studio/v1.3.1-claude-design/proyecto/`
> **Método**: 1 screenshot del DTD Studio · ERP en mobile preset (light mode) + audit estático via `Read` + `Grep` sobre tokens, módulos del `nuevo/` y portales. Screenshots adicionales bloqueados por timeout del renderer (issue ajeno al sandbox).

---

## Veredicto general

**APROBADO** — el sandbox es brand-compliant. Cero violaciones materiales del CLAUDE.md / BRAND.md. Las 2 desviaciones encontradas son menores y aceptables.

---

## 1 · Tokens (`erp/tokens.css`) — ✅ 100% alineado

Verificación 1:1 contra `CLAUDE.md` raíz del sandbox:

| Token | Definido en sandbox | Esperado por BRAND.md | Match |
|---|---|---|---|
| `--wine` | `#7F0F1A` | `#7F0F1A` | ✓ |
| `--wine-deep` | `#5E0A12` | `#5E0A12` | ✓ |
| `--wine-soft` | `#C2747F` | `#C2747F` | ✓ |
| `--bg-base` | `#FBFAF7` | `#FBFAF7` | ✓ |
| `--bg-surface` | `#FFFFFF` | `#FFFFFF` | ✓ |
| `--bg-sidebar` | `#0F1E3D` | `#0F1E3D` | ✓ |
| `--ink` | `#0F1E3D` | `#0F1E3D` | ✓ |
| `--ink-soft` | `#6B6B6B` | `#6B6B6B` | ✓ |
| `--ink-mute` | `#9B9B9B` | `#9B9B9B` | ✓ |
| `--border` | `#E8E6E2` | `#E8E6E2` | ✓ |
| `--success` | `#1F8A5B` | `#1F8A5B` | ✓ |
| `--warning` | `#B8893A` | `#B8893A` | ✓ |
| `--danger` | `#A8323E` | `#A8323E` | ✓ |
| `--info` | `#2A6FDB` | `#2A6FDB` | ✓ |

### Dark theme — ✅ correcto

Todos los tokens dark están definidos en `[data-theme="dark"]` con valores invertidos consistentes con el CLAUDE.md. Notable:

- `--bg-sidebar: #060D1C` (dark) — **MÁS oscuro que light `#0F1E3D`**. Esto sostiene el patrón "sidebar siempre oscuro en ambos temas" que es la base del fix v1.3.1.

### Extensiones del sandbox NO presentes en BRAND.md raíz

El sandbox agrega refinements del sistema que son **consistentes** (no violaciones) y vale portar al repo Next.js cuando se sincronice:

- `--wine-tint: rgba(127,15,26,0.08)` — variante semi-transparente
- `--bg-sidebar-hover/active` — estados visuales del sidebar
- `--ink-inv` / `--ink-side` / `--ink-side-soft` — texto sobre fondo navy
- `--border-strong` / `--border-side` — bordes con tonos
- `--success-bg` / `--warning-bg` / `--danger-bg` / `--info-bg` / `--neutral-bg` — fondos semi-transparentes para badges
- `--neutral` / `--neutral-bg` — tono neutral explícito
- **Density modifiers** `[data-density="compact|spacious"]` — ajusta spacing dinámicamente. **Feature interesante**, considerar para el repo.
- `--sb-expanded: 248px` / `--sb-collapsed: 64px` / `--topbar-h: 60px` / `--content-max: 1440px`

---

## 2 · Fix dark mode v1.3.1 — ✅ completo

**Bug original**: 9 lugares usaban `background: var(--ink)` con texto blanco. En dark mode `--ink` se invertía a claro → texto blanco sobre fondo claro = invisible.

**Fix esperado**: reemplazar por `background: var(--bg-sidebar)` (siempre oscuro en ambos temas).

**Verificación**:

```bash
# El bug:
grep -E "background[^,;}]*var\(--ink\)" nuevo/
→ 0 matches (excepto descripción en CHANGELOG.md)

# El fix:
grep "var(--bg-sidebar)" nuevo/
→ 8 archivos:
  ✓ nuevo/mobile/app.jsx
  ✓ nuevo/modules/audit-log.jsx
  ✓ nuevo/modules/conciliacion.jsx
  ✓ nuevo/modules/contabilidad.jsx
  ✓ nuevo/pantallas/agente-perfil.jsx
  ✓ nuevo/pantallas/chofer-perfil.jsx
  ✓ nuevo/pantallas/estado-cuenta.jsx
  + 1 archivo (CHANGELOG referencia)
```

**Veredicto**: fix correctamente aplicado en los 6 archivos mencionados en el CHANGELOG + bonus en mobile/app.jsx.

---

## 3 · Reglas de marca — ✅ sin violaciones materiales

### Fuentes prohibidas (Inter / Roboto / Poppins / etc.)
- **0 uso real**. Aparecen solo en listas negras de `CLAUDE.md`, `typography.json`, `README.md` (= están bien documentadas como prohibidas).
- Las "menciones" en `Brand Book DTD v2.3.html` son palabras españolas/JS (`Interacción`, `IntersectionObserver`) — falso positivo del grep.

### Hex literales fuera de tokens
- **`nuevo/modules/` y `nuevo/pantallas/`**: 0 hex literales ✓
- **`nuevo/mobile/app.jsx`**: 1 hex → `#1F3055` en `linear-gradient(135deg, var(--bg-sidebar), #1F3055)`. **Autorizado por CLAUDE.md** ("único gradiente permitido: dark navy hero").
- **`portal/app.jsx`**: 4 hex → ver detalle abajo.
- **`erp/`** (legacy v1.0): no auditado en detalle (NO se modifica), pero `tokens.css` está perfecto.

### Gradientes coloridos (AI slop)
- 0 matches de `linear-gradient` con paletas raras. Solo aparecen los 2-3 gradientes navy autorizados.

### Emojis decorativos
- **1 match**: `🎉` en `nuevo/CHANGELOG.md` línea 242 ("v1.1 completo"). Es documentación interna, **no UI de producto**. Aceptable, pero idealmente reemplazar por `✓` o quitar.

---

## 4 · Portal del Cliente — ⚠ 1 detalle menor

`portal/app.jsx` tiene 4 hex literales. Análisis línea por línea:

| Línea | Hex | Contexto | Veredicto |
|---|---|---|---|
| 61 | `#1F3055`, `#0B1428` | `linear-gradient(135deg, var(--ink) 0%, #1F3055 50%, #0B1428 100%)` — hero del login | ✓ Variante autorizada del gradient navy. `#0B1428` es exactamente el `--bg-base` dark del sistema. |
| 264 | `#C2747F` | `color: white ? '#C2747F' : 'var(--wine)'` — color del logo "DTD" sobre fondo navy | ⚠ **MINOR**: debería ser `var(--wine-soft)` (que es exactamente `#C2747F`). Refactor de 1 línea. |
| 294 | `#1F3055` | Otro `linear-gradient` navy en card | ✓ Mismo gradiente autorizado |
| 763 | `#25D366` | `color: '#25D366'` para icon de WhatsApp | ✓ Brand externo legítimo (verde WhatsApp). Idealmente con comentario `/* WhatsApp brand color */`. |

`portal/app-standalone.jsx` tiene los **mismos 4 matches** = es duplicate del `app.jsx` para servirse en standalone (sin shell). Mismo veredicto.

**Acción sugerida**: PR de 2 líneas reemplazando `'#C2747F'` por `var(--wine-soft)` en ambos archivos. No bloqueante.

---

## 5 · Mobile ERP (NUEVO v1.3) — ✅ brand-compliant

`Mobile ERP.html` review:

- ✓ Theme color `#0F1E3D` (correcto, navy)
- ✓ PWA-ready (`viewport-fit=cover`, `apple-mobile-web-app-capable`, `user-scalable=no`)
- ✓ Fonts cargadas: Archivo (todos weights) + Archivo Black + JetBrains Mono — coincide con sistema
- ✓ Reusa `erp/tokens.css` (single source of truth)
- ✓ Layout `max-width: 480px` (mobile-only), centrado, con "phone frame" en desktop ≥481px
- ✓ 5 keyframes de animación (fade, pop, slide-in, shimmer, bounce-in) — todas funcionales (feedback de state changes), ninguna decorativa
- ✓ Stack: React 18 + Babel standalone (mismo que el resto del sandbox)
- ✓ Carga `nuevo/rates.jsx` (window.ERPRates) + `nuevo/mobile/app.jsx`

---

## 6 · Sidebar del Studio (visible en screenshot) — ✅ con módulos nuevos

Confirmé en screenshot light mode que el sandbox tiene **22 módulos en sidebar** organizados en 4 secciones:

| Sección | Módulos |
|---|---|
| **OPERACIÓN** (7) | Dashboard, Embarques (24), Tracking, Calendario, Almacén CN, Almacén VE, TMS · Transporte |
| **COMERCIAL** (5) | Cotizador, Clientes (187), CRM · Leads, Proveedores CN, Tarifas |
| **FINANZAS** (6) | Facturación (4), **Contabilidad** ⭐ nuevo, **Conciliación bancaria** ⭐ nuevo, Documentos, Reportes, Costing & Margen |
| **SISTEMA** (5) | Mailing, Vault, **Audit log** ⭐ nuevo, Usuarios, Administración |

**Diferencias vs repo Next.js de producción (21 módulos)**:

- ✅ 3 módulos nuevos: **Contabilidad**, **Conciliación bancaria**, **Audit log**
- ❓ Aduana SENIAT NO visible en el screenshot del sandbox (posiblemente oculta por feature flag, o el sidebar lo lista pero scrolleado fuera de viewport)
- ❌ **No hay "Agentes y Skills"** en el sandbox → confirma que SDD-0020 sigue por separado, no afectado por esta entrega
- ❌ **No hay "Mobile ERP" en sidebar** → es app standalone vía HTML separado en raíz, no es módulo del sidebar (decisión de diseño correcta)

---

## 7 · Lo NUEVO del sandbox vs repo Next.js — candidatos a portar

| Feature en sandbox | Esfuerzo de port | Prioridad | SDD sugerido |
|---|---|---|---|
| **Mobile ERP** (5 pantallas: Home + Tracking + Clientes cerca + Gastos rápidos + Más, travel banner CN, modal nuevo gasto USD/VES/CNY con foto/categoría/embarque/cobrable) | Alto · pantalla por pantalla | **Alta** — listo para usar | SDD futuro · Mobile ERP |
| **Contabilidad QuickBooks-like** (52 cuentas freight VE + libro diario/mayor + P&L + Balance General + Flujo caja + Margen por embarque + lock con password 30min) | Alto · módulo grande | **Alta** — feature core finanzas | SDD futuro · Contabilidad |
| **Estado de cuenta del cliente** (cuenta corriente + aging + métodos pago + transacciones VES con tasa registrada + condiciones crédito) | Medio | Media — extensión Clientes | SDD futuro · Estado de cuenta |
| **Conciliación bancaria** (auto-matching + confidence score) | Medio | Media | SDD futuro · Conciliación |
| **Audit log con drill-down** (5 tabs: Resumen / Diff campos / Actor / Relacionados / JSON) | Medio | Media — base compliance | SDD futuro · Audit log Studio |
| **Editor de Dashboard** (drag-to-reorder 14 KPIs + 7 widgets, persistencia localStorage) | Bajo | Baja — nice-to-have | Mejora SDD-0014 existente |
| **Cola de QR** (impresión oficina + sync Operario CN via localStorage) | Bajo | Baja — operacional | SDD futuro · QR Print Queue |
| **Perfiles standalone** (chofer · camión · agente aduanal) | Bajo · ya diseñados | Baja | Extensión TMS + SENIAT |
| **Density modifiers** `[data-density=compact|spacious]` | Muy bajo · solo CSS | Baja · feature de calidad | Mejora tokens del Studio |
| **Helper `window.ERPRates`** (USD/VES/CNY + BCV/Paralelo) | Bajo | Media — necesario para VES | Parte del SDD Contabilidad |
| **Helper `window.DTDFlags`** (feature flags global) | Muy bajo | Baja · infra | Patrón a adoptar en Admin |

---

## 8 · Issues / desviaciones — resumen final

### Críticos (bloquean merge)
**Ninguno.** ✓

### Mayores (resolver pronto)
**Ninguno.** ✓

### Menores (refactor cuando convenga)

1. **`portal/app.jsx` línea 264 + `portal/app-standalone.jsx` línea ~264**: reemplazar `'#C2747F'` por `var(--wine-soft)`. Refactor de 1 línea por archivo.
2. **`portal/app.jsx` línea 763**: agregar comentario `/* WhatsApp brand color */` al `'#25D366'` para que el hex literal sea autoexplicable.
3. **`nuevo/CHANGELOG.md` línea 242**: reemplazar `🎉` por `✓` o quitar (es doc interno, aceptable como está).

### Lecciones para sesiones futuras

- ✅ **Tokens.css del sandbox debe ser fuente de verdad** para el `app/studio/tokens.css` del repo Next.js. Las extensiones (`--wine-tint`, `*-bg` variants, density modifiers) son refinements que deberían portarse.
- ✅ **El patrón "background: var(--bg-sidebar)" en lugar de "var(--ink)" para superficies oscuras** debe documentarse en el BRAND.md raíz para evitar repetir el bug v1.3 en el repo.
- ⚠ **Preview server con `serve` + viewport ≥1024px tiene timeouts** de screenshot. Para audits futuros, preferir `preview_inspect` (returns computed styles exactos) en lugar de screenshots.

---

## 9 · Próximos pasos sugeridos

1. **Decidir orden de port**: cuál de los módulos del sandbox tiene prioridad para portar al repo Next.js. Sugerencia: empezar por Contabilidad o Mobile ERP (alto valor, ya diseñado completo).
2. **Sincronizar tokens** del repo `app/studio/tokens.css` con las extensiones del sandbox (1 sesión, low risk).
3. **Refactor menor del Portal** (3 líneas) si se va a tocar el portal por otra razón.
4. **Continuar con SDD-0020 (Agentes y Skills) en paralelo** — este sandbox no lo bloquea ni afecta.
5. **Considerar abrir SDDs para los 4 módulos nuevos** (Contabilidad / Mobile / Conciliación / Audit log) antes de portar para tener spec formal.

---

## 10 · Archivos auditados (trazabilidad)

- `proyecto/erp/tokens.css` (full read)
- `proyecto/CLAUDE.md` (full read, validar reglas)
- `proyecto/nuevo/CHANGELOG.md` (head 40 lines + grep)
- `proyecto/nuevo/**/*.jsx` (grep masivo: hex literales, gradientes, emojis, var(--bg-sidebar), var(--ink))
- `proyecto/portal/app.jsx` + `app-standalone.jsx` (grep + read parcial)
- `proyecto/Mobile ERP.html` (head 60 lines)
- `proyecto/erp/` (grep masivo background var(--ink) → 0)
- 1 screenshot ejecutado: DTD Studio · ERP en mobile preset light mode
