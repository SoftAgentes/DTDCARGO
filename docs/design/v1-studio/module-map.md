# Module Map · DTD Studio v1 → Código actual

**Generado:** 2026-05-23
**Fuente diseño:** `source/erp/shell.jsx` (registro de módulos), `source/HANDOFF.md` (descripción)
**Fuente código:** `app/studio/`

Mapeo de los **21 módulos del diseño v1** contra el estado actual del código en
`app/studio/`. Define qué existe, qué falta, y el orden sugerido de implementación.

---

## 🎨 Sidebar del diseño — 21 módulos en 4 grupos

```
OPERACIÓN (8)              COMERCIAL (5)            FINANZAS (4)             SISTEMA (4)
├── Dashboard              ├── Cotizador            ├── Facturación  (4)     ├── Mailing
├── Embarques  (24)        ├── Clientes  (187)      ├── Documentos           ├── Vault
├── Tracking               ├── CRM · Leads          ├── Reportes             ├── Usuarios
├── Calendario             ├── Proveedores CN       └── Costing & Margen     └── Administración
├── Almacén CN             └── Tarifas
├── Almacén VE
├── Aduana SENIAT
└── TMS · Transporte
```

Sidebar oscuro (`var(--bg-sidebar)` = `#0F1E3D`), agrupado por sección con eyebrows
uppercase, logo con "DTD" wine + "STUDIO" blanco + sub "ERP · v1.0".

---

## 📊 Mapeo módulo por módulo

Leyenda de estado:
- ✅ **Completo** — existe en código y matchea el diseño
- 🟡 **Parcial** — algo existe pero falta refactor / completar
- 📦 **Placeholder** — la ruta existe en código pero vacía
- 🔴 **No existe** — hay que construir desde cero
- 🟢 **Existe en sitio público** — no en Studio pero podemos portarlo

### OPERACIÓN

| Módulo | Estado | JSX referencia | Acción / SDD |
|---|---|---:|---|
| **Dashboard** | 📦 placeholder en `/studio/resumen` | `dashboard.jsx` (13 KB) | **SDD futuro** — Editor de KPIs + drag de widgets + ojo ocultar valores |
| **Embarques** | 🟡 mezclado en `/studio/tracking` actual | `shipments.jsx` (32 KB) | **SDD** — Separar: vista comercial agrupada por cliente. Tabs Tabla / Kanban. Drawer detalle. |
| **Tracking** | 🟡 mezclado con Embarques | `tracking.jsx` (11 KB) | **SDD** — Re-enfocar: mapa + timeline operativa (no lista comercial) |
| **Calendario** | 🔴 no existe | `calendar.jsx` (29 KB) | **SDD** — Mes/semana/agenda. Feriados CN + VE. Eventos operativos |
| **Almacén CN** | 🔴 no existe | `cn.jsx` (66 KB) ⚠️ grande | **SDD** — Recepción + scope + traductor CN/ES + parciales |
| **Almacén VE** | 🔴 no existe | `ve.jsx` (5 KB) | **SDD** — Recepción de container + scope (acceso por almacén) |
| **Aduana SENIAT** | 🔴 no existe | `seniat.jsx` (23 KB) | **SDD** — Workflow aduanal VE (impuestos, agentes, HS codes, AES sync) |
| **TMS · Transporte** | 🔴 no existe | `tms.jsx` (33 KB) | **SDD** — Flota + choferes + rutas + GPS + incidencias |

### COMERCIAL

| Módulo | Estado | JSX referencia | Acción / SDD |
|---|---|---:|---|
| **Cotizador** | 🟢 existe en sitio público `/cotizar`, no en Studio | `quotes.jsx` (14 KB) | **SDD** — Portar al Studio. Quote como entidad guardable. Conectar a Tarifas |
| **Clientes** | 🔴 no existe | `clients.jsx` (15 KB) | **SDD CRÍTICO** — Tabla `clients` + MARKBOX como ID + tiers + RIF. Bloquea Embarques y muchos otros |
| **CRM · Leads** | 🔴 no existe | `leads.jsx` (29 KB) | **SDD** — Kanban + tabla + timeline + drawer. Pipeline comercial |
| **Proveedores CN** | 🔴 no existe | `suppliers.jsx` (19 KB) | **SDD** — Contactos WeChat + ratings + embarques históricos |
| **Tarifas** | 🔴 no existe | `rates.jsx` (5.5 KB) ⭐ | **SDD-0007** — el primero del diseño. Ya pausado esperando esto. |

### FINANZAS

| Módulo | Estado | JSX referencia | Acción / SDD |
|---|---|---:|---|
| **Facturación** | 🔴 no existe | `invoices.jsx` (11 KB) | **SDD** — Generación de facturas con links a embarques/clientes |
| **Documentos** | 🔴 no existe | `documents.jsx` (5 KB) | **SDD** — BL, AWB, packing list, certificados. Sin flow de generación todavía |
| **Reportes** | 🔴 no existe | `reports.jsx` (36 KB) ⚠️ grande | **SDD** — 7 tabs por área (Overview / Clientes / Agentes / Rutas / Navieras / Servicios) |
| **Costing & Margen** | 🔴 no existe | `costing.jsx` (40 KB) ⚠️ grande | **SDD** — Editor + templates por ruta + USD/VES + forecast + comparativas |

### SISTEMA

| Módulo | Estado | JSX referencia | Acción / SDD |
|---|---|---:|---|
| **Mailing** | 🔴 no existe | `mailing.jsx` (3 KB) + 6 sub-módulos (compose, config, logs, rules, signatures, templates) — ~110 KB total | **SDD GRANDE** — Sistema de correo completo. Probablemente requiere varios SDDs |
| **Vault** | 🔴 no existe | `vault.jsx` (42 KB) ⚠️ grande | **SDD** — Caja fuerte con master password. Cifrado + recovery |
| **Usuarios** | 🟡 auth básico existe (login) | `users.jsx` (15 KB) | **SDD** — Roles + permisos por módulo + scope por almacén + 2FA |
| **Administración** | 🔴 no existe | `admin.jsx` (91 KB) ⚠️ EL MÁS GRANDE | **SDD MUY GRANDE** — Casos de uso ON/OFF + 11 secciones de config |

### Cross-módulo (componentes compartidos)

| Feature | JSX referencia | Estado |
|---|---:|---|
| Quick Email modal | `quick-email.jsx` (13 KB) | 🔴 — modal global invocable desde cualquier módulo |
| Comments con @menciones | `comments.jsx` (13 KB) | 🔴 — sistema de comentarios cross-entidad |
| Tweaks panel (theme/density) | `tweaks-panel.jsx` (24 KB) | 🔴 — selector de tema, densidad, idioma |
| Shell (sidebar + topbar) | `shell.jsx` (25 KB) | 🟡 — tenemos sidebar básico, falta agrupación + topbar con búsqueda ⌘K |
| Components library | `components.jsx` (27 KB) | 🟡 — tenemos `studio-btn-*` etc., falta portar Btn/Badge/Card/Drawer/Modal/Table/KPI/Tabs/EmptyState como componentes React |
| Data mock | `data.jsx` (54 KB) | 🔴 — mock data realista para desarrollo. Suplantar con queries Supabase reales |

---

## 📈 Resumen ejecutivo

| Estado | Cantidad | % |
|---|---:|---:|
| ✅ Completo | 0 | 0% |
| 🟡 Parcial | 3 | 14% |
| 📦 Placeholder | 1 | 5% |
| 🟢 En sitio público (a portar) | 1 | 5% |
| 🔴 No existe | 16 | 76% |
| **Total** | **21** | **100%** |

**Conclusión honesta:** estamos en **~14% del Studio v1 implementado** (solo el módulo
Tracking actual, mezclado con Embarques + auth básico). El handoff del diseño nos da
el roadmap completo para llegar al 100%.

---

## 🗺️ Roadmap propuesto (ordenado por dependencias + valor)

### Sprint 0 — Cimientos visuales (1-2 semanas)

Adoptar el shell del diseño antes de seguir construyendo módulos. Sin esto, cada
módulo nuevo refactorea visualmente lo anterior.

| # | Tarea | SDD | Estado | Esfuerzo |
|---|---|---|---|---|
| 0.1 | Portar `shell.jsx` → sidebar oscuro agrupado 4 secciones + topbar con búsqueda ⌘K + theme toggle | **SDD-0007** | ✅ (2026-05-23) | ~6h |
| 0.2 | Portar `components.jsx` → React components reutilizables (`<Btn>`, `<Badge>`, `<Card>`, `<Table>`, `<Input>`, `<Drawer>`, `<Modal>`, `<Tabs>`, `<KPI>`, `<EmptyState>`) en `app/studio/_components/ui/` | TBD | pendiente | ~8h |
| 0.3 | Refactor pantallas existentes (`/dashboard`, `/tracking` lista + detalle + nuevo, `/ajustes`) — reemplazar 100+ hex hardcoded por tokens dark-aware. Habilita el dark theme funcional. | continuación SDD-0007 | ✅ (2026-05-23) | ~3h |

### Sprint 1 — Comercial mínimo (3-4 semanas)

Lo que desbloquea cobro real y operación comercial.

| # | Módulo | SDD | Esfuerzo | Por qué primero |
|---|---|---|---|---|
| 1.1 | **Tarifas** | SDD-0008 ✅ | ~3h | Bloquea Cambio de destino, Cotizador y Facturación. Schema rates + 6 seed |
| 1.2 | **Cambio de destino** (feature en Tracking) | SDD-0009 ✅ | ~2h | Modal con sugerencia de fee desde Tarifas + audit en timeline |
| 1.3 | **Clientes** + MARKBOX | SDD-0010 ✅ | ~4h | Tabla `clients` + tiers + RIF + auto-MARKBOX + detalle con histórico |
| 1.4 | **Cotizador** (portar a Studio) | SDD-0011 ✅ | ~5h | Calculator live + state machine + convertir a embarque |

### Sprint 2 — Operación visual (4-6 semanas)

Lo que reemplaza el Excel del día a día.

| # | Módulo | SDD | Esfuerzo |
|---|---|---|---|
| 2.1 | **Embarques** (separar de Tracking actual + Kanban) | SDD-0011 | ~8h |
| 2.2 | **Tracking** (mapa + timeline) | SDD-0012 | ~5h |
| 2.3 | **Dashboard real** (KPIs leyendo de envíos) | SDD-0013 | ~4h |
| 2.4 | **Calendario** operativo (mes/semana + feriados CN/VE) | SDD-0014 | ~6h |

### Sprint 3 — Operación profunda (6-8 semanas)

| # | Módulo | SDD | Esfuerzo |
|---|---|---|---|
| 3.1 | **Almacén CN** (recepción + scope + traductor) | SDD-0015 | ~12h ⚠️ |
| 3.2 | **Almacén VE** | SDD-0016 | ~4h |
| 3.3 | **Aduana SENIAT** | SDD-0017 | ~8h |
| 3.4 | **TMS · Transporte** (flota + GPS) | SDD-0018 | ~10h |

### Sprint 4 — Finanzas (4-6 semanas)

| # | Módulo | SDD | Esfuerzo |
|---|---|---|---|
| 4.1 | **Facturación** | SDD-0019 | ~5h |
| 4.2 | **Documentos** (BL, AWB) | SDD-0020 | ~4h |
| 4.3 | **Costing & Margen** | SDD-0021 | ~10h ⚠️ |
| 4.4 | **Reportes** (7 tabs) | SDD-0022 | ~8h |

### Sprint 5 — Sistema (4-6 semanas)

| # | Módulo | SDD | Esfuerzo |
|---|---|---|---|
| 5.1 | **Usuarios + Roles + Scope** | SDD-0023 | ~6h |
| 5.2 | **Vault** (caja fuerte) | SDD-0024 | ~8h |
| 5.3 | **Mailing** (templates + compose + reglas) | SDD-0025 a SDD-0028 | ~20h ⚠️ |
| 5.4 | **Administración** (casos uso ON/OFF) | SDD-0029 | ~15h ⚠️ |
| 5.5 | **Proveedores CN** + **Leads CRM** | SDD-0030/31 | ~10h |

### Sprint 6 — Cross-módulo (paralelo a otros sprints)

| # | Feature | Esfuerzo |
|---|---|---|
| 6.1 | Quick Email modal global | ~3h |
| 6.2 | Comments con @menciones | ~5h |
| 6.3 | Tweaks panel (theme/density) | ~3h |
| 6.4 | Búsqueda global ⌘K | ~4h |

### Sprint 7 — Apps móviles (después del ERP base)

| # | App | SDD | Esfuerzo |
|---|---|---|---|
| 7.1 | Portal Cliente (MARKBOX login) | SDD-0032 | ~12h |
| 7.2 | Operario CN (recepción mobile) | SDD-0033 | ~15h |
| 7.3 | Operario VE (chofer mobile) | SDD-0034 | ~12h |
| 7.4 | Bodeguero VE (bodega mobile) | SDD-0035 | ~10h |

---

## ⏱️ Estimación total

| Concepto | Sprints | Esfuerzo crudo | Calendario realista |
|---|---:|---:|---:|
| Sprint 0 (cimientos) | 1 | ~18h | 1-2 semanas |
| Sprint 1 (comercial) | 1 | ~15h | 3-4 semanas |
| Sprint 2 (operación visual) | 1 | ~23h | 4-6 semanas |
| Sprint 3 (operación profunda) | 1 | ~34h | 6-8 semanas |
| Sprint 4 (finanzas) | 1 | ~27h | 4-6 semanas |
| Sprint 5 (sistema) | 1 | ~59h | 6-10 semanas |
| Sprint 6 (cross-módulo) | paralelo | ~15h | n/a |
| **Total Studio v1 ERP** | 6 | **~191h** | **6-9 meses** |
| Sprint 7 (apps móviles) | 1 | ~49h | 4-6 meses extra |

Esto NO es estimación blue-sky de "lo escribo en una tarde". Es:
- Cada SDD = spec + implementación turn-by-turn + UI/UX review + commit
- Asume 1 dev (yo) trabajando con vos como product owner
- Asume features definidas en JSX como mockup, no scope creep
- Incluye testing manual de cada módulo en cada SDD

---

## 🚦 Próximo paso lógico

**Sprint 0 (Cimientos visuales) cerrado** + **SDD-0008 Tarifas** completo (primer módulo real del diseño portado).

**Sprint 1 (Comercial mínimo) cerrado:** Tarifas (SDD-0008), Cambio de
destino (SDD-0009), Clientes + MARKBOX (SDD-0010), Cotizador (SDD-0011).
Stack comercial completo: catálogo de precios + cliente identificable +
cotización con state machine + conversión automática a embarque.

Próximos en cola (Sprint 2 — Operación visual):
- **SDD-0012 Embarques** ⭐ — separar la vista comercial (agrupada por
  cliente) del Tracking operativo actual. Tabs Tabla/Kanban. Drawer
  detalle. Es el primer módulo del Sprint 2.
- **SDD-0013 Tracking** (refactor con mapa + timeline)
- **SDD-0014 Dashboard real** (KPIs leyendo de envíos)
- **SDD-0015 Calendario operativo**

---

## 📌 Decisiones pendientes antes de SDD-0007

1. **¿Adoptamos `shell.jsx` antes de SDD-0007 (Sprint 0.1) o después?**
   - Si lo hacemos primero: cada módulo nuevo ya nace con el shell correcto
   - Si lo dejamos para después: SDD-0007 funciona en el shell actual y migra cuando llegue Sprint 0

   **Recomendación:** hacerlo PRIMERO en Sprint 0 (1-2 días extra ahora ahorra refactor de Tarifas en 2 semanas)

2. **¿Adoptamos `components.jsx` (UI primitives) antes de SDD-0007?**
   - Mismo trade-off. **Recomendación:** sí, primero.

3. **¿Refactor de naming en código actual?** Hoy "Tracking" es lo que el diseño llama
   "Embarques" + "Tracking" combinado. ¿Renombramos antes de seguir? **Recomendación:** sí, en Sprint 0.3.

---

## 🔗 Referencias

- `docs/design/v1-studio/source/HANDOFF.md` — handoff original del diseñador
- `docs/design/v1-studio/source/CLAUDE.md` → copiado a `BRAND.md` raíz
- `docs/design/v1-studio/source/erp/tokens.css` → adoptado en `app/studio/tokens.css`
- `docs/design/v1-studio/source/erp/modules/*.jsx` — 25 archivos JSX de referencia
- `docs/design/v1-studio/source/erp/shell.jsx` — registro de módulos + sidebar oscuro
- `docs/design/v1-studio/source/erp/components.jsx` — primitives UI a portar
