---
sdd: "0007"
title: "DoorTuDoor — Sprint 0.1: Studio Shell v1 (sidebar agrupado + topbar)"
status: done
author: "founder"
created: 2026-05-23
updated: 2026-06-02
supersedes: null
superseded_by: null
related: ["0003", "0004", "0005", "0006"]
---

# DTD-0007 — Sprint 0.1: Studio Shell v1

> **Sprint 0 — Cimientos visuales.** Adoptar el shell del handoff de diseño v1 antes
> de seguir construyendo módulos. Sin esto, cada SDD nuevo refactorea visualmente lo
> anterior. Bloquea SDD-0008 (Tarifas) y todo el roadmap del Studio.

---

## 1. Resumen en una línea

Portar `docs/design/v1-studio/source/erp/shell.jsx` al Studio: sidebar oscuro agrupado
en 4 secciones (OPERACIÓN/COMERCIAL/FINANZAS/SISTEMA) con 21 módulos, sidebar colapsable
persistido, topbar sticky con module label dinámico + search ⌘K (placeholder) + theme
toggle + user menu — todo con `var(--*)` tokens, cero hex literales.

---

## 2. Scope

### Incluye

#### Componentes nuevos
- `app/studio/_components/icons.tsx` — subset de íconos SVG inline del handoff
  (~24 íconos: dashboard, box, radar, clock, warehouse, shield, truck, calc, users,
  spark, cn, tag, invoice, doc, chart, star, mail, lock, cog, chevR, chevD, search,
  sun, moon, bell). Componentes React puros sin deps externas.
- `app/studio/_components/ui/Avatar.tsx` — primitive mínimo necesario para topbar
  (initials, sizes 20/28/32, tonos wine/neutral/info).
- `app/studio/_components/ui/Badge.tsx` — primitive mínimo necesario para topbar
  (tonos success/warning/danger/info/wine/neutral, sizes sm/md).
- `app/studio/_components/StudioSidebar.tsx` — client component con registry de 21
  módulos, agrupación visual, active state via `usePathname`, collapsed state
  persistido en `localStorage.studio_sidebar_collapsed`, badge support, footer con
  botón colapsar.
- `app/studio/_components/StudioTopbar.tsx` — client component sticky con: module
  label dinámico (pathname → label mapping), search button (⌘K registrado, abre
  modal placeholder), theme toggle (escribe `document.documentElement.dataset.theme`
  + `localStorage.studio_theme`), notifications icon (0 por ahora), user menu
  dropdown con email + role badge + Cerrar sesión.

#### Refactor
- `app/studio/(app)/layout.tsx` — reemplazar shell viejo (que tiene 9 hex literales:
  `#0F1E3D`, `#FFFFFF`, `#C2747F`, etc.) por nuevo Sidebar + Topbar. Cero hex,
  solo `var(--*)`. Body con `var(--bg-base)` y padding `var(--s-6)`.
- `app/studio/(app)/_components/SidebarNav.tsx` — eliminar (reemplazado por
  StudioSidebar).
- `app/studio/(app)/_components/Breadcrumb.tsx` — eliminar (reemplazado por module
  label del topbar).

#### Rutas placeholder (18 nuevas)
Cada módulo del sidebar debe resolver a una ruta válida — sin esto el sidebar lleva
a 404. Cada placeholder es un page.tsx con EmptyState simple "Próximamente —
SDD-XXXX" usando tokens del sistema:

```
app/studio/(app)/
├── dashboard/page.tsx       (mover desde /resumen — ver migración)
├── embarques/page.tsx       → SDD-0012
├── calendario/page.tsx      → SDD-0015
├── cn/page.tsx              → SDD-0016
├── ve/page.tsx              → SDD-0017
├── seniat/page.tsx          → SDD-0018
├── tms/page.tsx             → SDD-0019
├── cotizador/page.tsx       → SDD-0011
├── clientes/page.tsx        → SDD-0010
├── leads/page.tsx           → SDD futuro
├── proveedores/page.tsx     → SDD futuro
├── tarifas/page.tsx         → SDD-0008 ⭐ (siguiente, este sprint)
├── facturacion/page.tsx     → SDD-0020
├── documentos/page.tsx      → SDD-0021
├── reportes/page.tsx        → SDD-0023
├── costing/page.tsx         → SDD-0022
├── mailing/page.tsx         → SDD-0026 y siguientes
├── no-olvidar/page.tsx      → SDD-0025
├── usuarios/page.tsx        → SDD-0024
└── admin/page.tsx           → SDD-0030
```

#### Migración de rutas existentes
- `/studio/resumen` → `/studio/dashboard` (mover archivo + agregar redirect simple
  desde resumen para que viejos bookmarks no rompan).
- `/studio/tracking` → se mantiene (es el módulo real, hoy funcional).
- `/studio/ajustes` → se mantiene pero **sale del sidebar principal**. Accesible
  desde user menu → "Preferencias". Se reorganizará cuando exista SDD-0029 Admin.

### NO incluye (queda para SDDs futuros)

- **UI primitives completos** (`<Btn>`, `<Input>`, `<Select>`, `<Card>`, `<Table>`,
  `<KPI>`, `<Drawer>`, `<Modal>`, `<Tabs>`, `<Progress>`, `<EmptyState>` como
  componentes React reutilizables) → **Sprint 0.2 (SDD-0007-bis o sin SDD)**. Solo
  portamos Avatar + Badge porque los necesita el topbar.
- **Refactor de Tracking actual** para usar nuevos primitives → **Sprint 0.3**.
- **Search global ⌘K funcional** → **Sprint 6.4**. Por ahora solo el botón visual
  + atajo de teclado que abre modal vacío con mensaje "Próximamente".
- **Auto-detect del SO para theme** → Sprint 0.3 si hace falta. V1 default `light`.
- **Notifications reales** → SDD futuro. Por ahora ícono con 0 notifs.
- **"Ver como…" switcher** del user menu (cambio de scope demo) → SDD-0023 Usuarios
  + Roles. Por ahora solo email + Cerrar sesión.
- **Tweaks panel** (theme/density/language) → Sprint 6.3.
- **Conexión `/track/[code]` público al backend** → SDD futuro con autorización
  explícita (toca zona prohibida del sitio público).

---

## 3. Archivos a crear / editar

### Nuevos

```
docs/specs/0007-studio-shell-v1/
└── spec.md                                              ← este archivo

app/studio/_components/
├── icons.tsx                                            ← 24 SVG inline
└── ui/
    ├── Avatar.tsx                                       ← initials + tonos + sizes
    └── Badge.tsx                                        ← tonos + sizes

app/studio/(app)/_components/
├── StudioSidebar.tsx                                    ← client (use pathname + localStorage)
└── StudioTopbar.tsx                                     ← client (theme toggle + ⌘K + user menu)

app/studio/(app)/
├── dashboard/page.tsx                                   ← migrado desde /resumen
├── embarques/page.tsx                                   ← placeholder
├── calendario/page.tsx                                  ← placeholder
├── cn/page.tsx                                          ← placeholder
├── ve/page.tsx                                          ← placeholder
├── seniat/page.tsx                                      ← placeholder
├── tms/page.tsx                                         ← placeholder
├── cotizador/page.tsx                                   ← placeholder
├── clientes/page.tsx                                    ← placeholder
├── leads/page.tsx                                       ← placeholder
├── proveedores/page.tsx                                 ← placeholder
├── tarifas/page.tsx                                     ← placeholder (SDD-0008 siguiente)
├── facturacion/page.tsx                                 ← placeholder
├── documentos/page.tsx                                  ← placeholder
├── reportes/page.tsx                                    ← placeholder
├── costing/page.tsx                                     ← placeholder
├── mailing/page.tsx                                     ← placeholder
├── no-olvidar/page.tsx                                  ← placeholder
├── usuarios/page.tsx                                    ← placeholder
└── admin/page.tsx                                       ← placeholder
```

### Editados

```
app/studio/(app)/layout.tsx                              ← reemplaza shell viejo
docs/design/v1-studio/module-map.md                      ← marcar Sprint 0.1 ✅
```

### Eliminados

```
app/studio/(app)/_components/SidebarNav.tsx              ← reemplazado por StudioSidebar
app/studio/(app)/_components/Breadcrumb.tsx              ← reemplazado por module label
app/studio/(app)/resumen/page.tsx                        ← movido a /dashboard (con redirect)
```

### Redirect simple (para no romper bookmarks viejos)

`app/studio/(app)/resumen/page.tsx` se reemplaza por:

```tsx
import { redirect } from "next/navigation";
export default function ResumenRedirect() {
  redirect("/studio/dashboard");
}
```

---

## 4. Decisiones de diseño

### 4.1 Slugs en español (con excepciones por acrónimos)

Match con el resto del sitio público y memory del proyecto. Excepciones son los IDs
del handoff que son acrónimos reconocibles: `cn`, `ve`, `tms`, `seniat`, `crm`
(este último no se usa porque el módulo se llama "leads"). Mapeo:

| ID del handoff | Slug Next.js | Label visible |
|---|---|---|
| `dashboard` | `/dashboard` | Dashboard |
| `shipments` | `/embarques` | Embarques |
| `tracking` | `/tracking` | Tracking |
| `calendar` | `/calendario` | Calendario |
| `cn` | `/cn` | Almacén CN |
| `ve` | `/ve` | Almacén VE |
| `seniat` | `/seniat` | Aduana SENIAT |
| `tms` | `/tms` | TMS · Transporte |
| `quotes` | `/cotizador` | Cotizador |
| `clients` | `/clientes` | Clientes |
| `leads` | `/leads` | CRM · Leads |
| `suppliers` | `/proveedores` | Proveedores CN |
| `rates` | `/tarifas` | Tarifas |
| `invoices` | `/facturacion` | Facturación |
| `documents` | `/documentos` | Documentos |
| `reports` | `/reportes` | Reportes |
| `costing` | `/costing` | Costing & Margen |
| `mailing` | `/mailing` | Mailing |
| `no-olvidar` | `/no-olvidar` | No-Olvidar |
| `users` | `/usuarios` | Usuarios |
| `admin` | `/admin` | Administración |

### 4.2 Sidebar collapsed persiste en localStorage

`localStorage.studio_sidebar_collapsed = "1" | "0"`. Default expanded. Se hidrata
client-side; en SSR se renderiza expandido por default (no causa flash visible
porque el sidebar es el mismo color en ambos estados).

### 4.3 Theme persiste en localStorage

`localStorage.studio_theme = "light" | "dark"`. Default `light`. El theme toggle
escribe `document.documentElement.dataset.theme` y persiste. Para evitar flash de
contenido sin tema (FOUC), se inyecta un script inline en el `<head>` del
`app/studio/(app)/layout.tsx` que aplica el tema antes del render:

```html
<script dangerouslySetInnerHTML={{__html: `
  try {
    var t = localStorage.getItem('studio_theme');
    if (t === 'dark') document.documentElement.dataset.theme = 'dark';
  } catch(e) {}
`}} />
```

### 4.4 Module label del topbar — mapping pathname → label

Un helper `pathToLabel(pathname: string)` que matchea contra el registry de módulos.
Caso edge: `/studio/tracking/abc-123` (vista detalle) → label "Tracking". El último
segmento (id) no afecta. Caso edge: `/studio/ajustes` → label "Ajustes" (aunque no
esté en el sidebar). Fallback: "DTD Studio".

### 4.5 Search ⌘K — placeholder funcional

El botón es real, el atajo `⌘K` (o `Ctrl+K` en Windows) está registrado con
`useEffect` + `keydown` listener. Abre un modal centrado, fondo `var(--bg-surface)`,
con un input deshabilitado y mensaje:

> _"Búsqueda global llegará en Sprint 6.4. Mientras tanto, navegá desde el sidebar."_

Esto es **mejor** que no tener nada porque entrena el muscle memory de los usuarios
desde día 1 y deja claro que la funcionalidad está planificada.

### 4.6 21 módulos visibles desde día 1 vs. solo los implementados

El handoff los muestra todos. **Decisión: los 21 visibles**, todos llevan a una
ruta real (placeholder cuando no está implementado). Razones:

1. El usuario ve el roadmap completo del producto desde el primer login (vende el
   ERP a sí mismo y al equipo).
2. Cada placeholder linkea al SDD que lo desbloqueará — transparencia total.
3. Cero 404s posibles desde el sidebar.

Alternativa rechazada: mostrar solo los implementados (3 hoy) — mata la sensación
de progreso y obliga a refactorear el sidebar cada SDD.

### 4.7 BRAND-CHECK aplicado al refactor de layout

El layout actual viola BRAND.md regla #1 ("solo tokens, cero hex"). El refactor
arregla 9 hex literales reemplazándolos por:
- `#0F1E3D` → `var(--bg-sidebar)`
- `#FFFFFF` → `var(--bg-surface)`
- `#C2747F` → `var(--wine-soft)`
- `#FBFAF7` → `var(--bg-base)`
- `#E8E6E2` → `var(--border)`
- `rgba(255,255,255,0.08)` → `var(--border-side)`
- `rgba(255,255,255,0.5)` → `var(--ink-side-soft)`

No es un cambio nuevo controversial — es cumplir una regla del CLAUDE.md que no
estaba siendo respetada porque el shell se construyó antes de adoptar los tokens.

---

## 5. Criterios de aceptación

### Visual
- [ ] Sidebar oscuro `var(--bg-sidebar)` con 21 módulos en 4 grupos exactos del
      handoff (OPERACIÓN 8 / COMERCIAL 5 / FINANZAS 4 / SISTEMA 4).
- [ ] Eyebrows uppercase con letterspacing 0.16em, color `var(--ink-side-soft)`.
- [ ] Active state: background `var(--bg-sidebar-active)` + strip vertical
      `var(--wine-soft)` de 3px a la izquierda + ícono en `var(--wine-soft)`.
- [ ] Hover state: background `var(--bg-sidebar-hover)`.
- [ ] Logo: "DTD" en `var(--wine-soft)` + "STUDIO" en `#fff` (sobre fondo oscuro)
      + sub "ERP · v1.0" en uppercase letterspacing.
- [ ] Badges en items del sidebar (ej: Embarques `24`, Clientes `187`, Facturación `4`).
- [ ] Sidebar colapsa a 64px de ancho con animación 180ms; íconos centrados;
      labels y badges ocultos; logo solo el ícono.
- [ ] Estado collapsed persiste entre reloads.
- [ ] Topbar sticky en top, altura `var(--topbar-h)` (60px en density normal).
- [ ] Module label dinámico (cambia al navegar).
- [ ] Search button con `⌘ K` chip a la derecha.
- [ ] Theme toggle (sun/moon) que cambia entre light y dark con animación suave.
- [ ] Dark theme aplica todos los tokens dark del `tokens.css`.
- [ ] User menu dropdown con avatar (initials del email) + email + role badge
      "Admin" en tono wine + opción "Cerrar sesión".

### Funcional
- [ ] Cada item del sidebar lleva a una ruta válida (cero 404).
- [ ] `/studio/resumen` redirecta a `/studio/dashboard`.
- [ ] `/studio/tracking` sigue funcionando exactamente como antes (sin regresiones).
- [ ] Auth guard se mantiene server-side (redirect a `/studio/login` si no hay user).
- [ ] `⌘K` (o `Ctrl+K` en Windows) abre el modal placeholder de búsqueda.
- [ ] `pnpm typecheck` pasa sin errores.
- [ ] `pnpm build` pasa sin errores.

### Brand compliance
- [ ] Cero hex literales en `app/studio/**` después del refactor (búsqueda regex
      `#[0-9A-Fa-f]{3,8}` debe retornar 0 resultados, excepto en `tokens.css`).
- [ ] Cero fuentes prohibidas (Inter, Roboto, etc.).
- [ ] Cero gradientes coloridos o AI slop.
- [ ] Solo tokens del sistema para spacing, radius, sombras.
- [ ] ui-ux-designer agent valida el resultado antes del commit.

---

## 6. Migración de SDD numbers

El SDD-0006 (cerrado) mencionó "SDD-0007 = conexión /track público al backend".
El `module-map.md` lo reasignó a "Tarifas". Este SDD lo reasigna a "Studio Shell".
Reasignación final post-decisión:

| SDD | Tema actual |
|---|---|
| 0007 | **Studio Shell v1** (este) |
| 0008 | Tarifas (módulo `rates`) ⭐ siguiente |
| 0009 | Cambio de destino (feature en Tracking) |
| 0010 | Clientes + MARKBOX |
| 0011 | Cotizador en Studio |
| 0012 | Embarques (separar de Tracking actual) |
| 0013 | Tracking (mapa + timeline operativa) |
| 0014 | Dashboard real (KPIs leyendo de envíos) |
| 0015+ | Operación profunda / Finanzas / Sistema — ver module-map.md |

La conexión `/track/[code]` público → backend queda como **SDD futuro sin número
asignado** hasta que se priorice.

---

## 7. Out of scope / open questions

- **Sprint 0.2 (UI primitives completos):** ¿Hacerlo inmediatamente después de
  este SDD, o intercalar con SDD-0008 Tarifas? **Sugerencia:** hacerlo después de
  SDD-0008 para validar que el patrón de primitives "funciona" con un módulo real.
- **Mobile responsive:** este SDD asume desktop ≥1024px. Mobile breakpoint queda
  para un SDD aparte (los operarios en almacén usarán apps mobile, no el Studio).
- **Keyboard navigation completa** (tab order, focus rings): se valida visual pero
  no se garantiza WCAG 2.1 AA en este SDD. Auditoría a11y queda para Sprint 5.
