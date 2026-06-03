---
sdd: "0012"
title: "DoorTuDoor — Embarques (vista comercial agrupada por cliente)"
status: done
author: "founder"
created: 2026-05-24
updated: 2026-06-02
supersedes: null
superseded_by: null
related: ["0005", "0006", "0010", "0011"]
confidencialidad: interno
---

# DTD-0012 — Embarques (vista comercial)

> **Primer módulo del Sprint 2 (Operación visual).** Vista comercial
> agrupada por cliente, en contraste con el Tracking actual que es lista
> plana operativa. Lectura — sin crear/editar/cambiar estados (esos
> viven en Tracking + Cotizador).

---

## 1. Resumen en una línea

Tabla acordeón agrupada por cliente con tabs por status (Todos / Activos
/ Entregados / Con alertas) + drawer detail read-only con link directo
al Tracking. Reutiliza la tabla `shipments` existente, sin schema nuevo.

---

## 2. Scope

### Incluye

#### Helpers (extensión)
- `lib/studio/shipment-queries.ts`:
  - `groupShipmentsByClient(shipments)` → array de
    `{ clientMarkbox, clientName, shipments, stats }`
  - `computeClientStats(shipments)` →
    `{ count, totalCbm, totalWeight, alertCount, activeCount }`

#### Pages
- `app/studio/(app)/embarques/page.tsx` (server) — reemplaza placeholder:
  - Fetch `listShipments({ status: 'all' })` (no filtros adicionales
    — los maneja el client por performance vs. round trips)
  - Delega todo el UI a `EmbarquesClient`
- `_components/EmbarquesClient.tsx` (client):
  - Header: eyebrow "Operación comercial" + h1 "Embarques." + subtítulo
  - Tabs:
    - **Todos** (count total)
    - **Activos** (no terminal: !delivered && !cancelled)
    - **Entregados** (delivered)
    - **Con alertas** (status = exception)
  - Toolbar: search (client_name, MARKBOX, code, ruta)
  - Tabla agrupada por cliente con acordeón
    - Group header: ▶/▼ + Cliente name + MARKBOX (mono) + count badge +
      total CBM
    - Children rows: code + ruta + service badge + status badge + CBM + fecha
    - Click row → abre drawer
  - Empty state si no hay matches
- `_components/ShipmentDetailDrawer.tsx` (client):
  - Drawer lateral 560px read-only
  - Header: code (mono) + cliente + status badge
  - Datos: cliente · MARKBOX · servicio · origen · destino · peso ·
    volumen · vehicle (si aplica) · GPS (si aplica) · notas · creado · actualizado
  - Footer: botón primary "Ir al tracking →" link a `/tracking/[id]`
  - Cierre con Esc o backdrop

### NO incluye (diferido a SDDs futuros)

- **Vista Kanban** (toggle table/kanban del handoff) — diferido. ~3h
  trabajo aparte con drag-and-drop.
- **Bulk select con acciones** — diferido. UX queda más simple sin
  checkboxes en V1.
- **Progress bar visual** — requiere columna `progress` o cálculo
  desde shipment_events (porcentaje según status). Sin schema extension
  en V1.
- **ETA visible** — requiere columna `eta_at` con cálculo desde rate
  `transit_days` + fecha de creación. Sin schema extension en V1.
- **Valor monetario por envío** — requiere link con `quotes` o columna
  `value_usd` en shipments. Diferido.
- **Botón "+ Nuevo embarque"** en Embarques — flow correcto es
  Cotizador → Convertir, o /tracking/nuevo directo. No duplicar form.
- **"Exportar CSV"** — botón placeholder disabled.
- **Acciones de cambio de estado** (cancelar, transicionar, agregar evento) —
  viven en `/tracking/[id]`. Drawer de Embarques solo lee.
- **Cambio de destino** — vive en `/tracking/[id]`.
- **Filtros por servicio/origen/destino** — solo tabs por status + search
  por ahora. Si negocio lo pide, fácil de agregar.
- **Persistencia del tab/expand state en URL** — `useState` local. Los
  filtros importantes (status) sí podrían ir a URL pero por simplicidad
  v1 quedan en memoria. Si Sam quiere bookmarkeable, micro-fix después.

---

## 3. Archivos a crear / editar

### Nuevos

```
docs/specs/0012-embarques/
└── spec.md                                              ← este

app/studio/(app)/embarques/_components/
├── EmbarquesClient.tsx                                  ← tabs + toolbar + tabla agrupada
└── ShipmentDetailDrawer.tsx                             ← drawer read-only
```

### Editados

```
app/studio/(app)/embarques/page.tsx                      ← reemplaza placeholder
lib/studio/shipment-queries.ts                           ← + groupShipmentsByClient + computeClientStats
docs/design/v1-studio/module-map.md                      ← 2.1 ✅
```

### Sin cambios

```
supabase/migrations/                                     ← sin schema nuevo (reusa shipments)
app/studio/(app)/tracking/                               ← intacto (acciones siguen ahí)
```

---

## 4. Decisiones de diseño

### 4.1 Sin schema nuevo

Reusa `shipments` tal cual. Si después Embarques necesita data que
Tracking no provee (progress, eta, valor), se agregan columnas con
migration aparte.

### 4.2 Acordeón con estado local (no URL)

Cada usuario expande/colapsa según le sirve. Persistir en URL ensuciaría
la navegación. Si Sam quiere bookmarkeable, se agrega después.

**Default:** todos colapsados si hay ≥3 grupos, todos expandidos si <3.

### 4.3 Tab "Con alertas" = status exception

El handoff usaba un campo `alert: boolean` aparte. Para no duplicar
estado, reuso `status = exception` como criterio. Si el negocio quiere
otros tipos de alerta (ETA vencida, peso desconocido, etc.), SDD futuro.

### 4.4 Drawer read-only — Single Source of Truth para edición

Toda mutación (cambio estado, edición de campos, cambio destino,
cancel/delete) vive en `/tracking/[id]`. El drawer de Embarques solo
muestra y linkea allá. Esto evita:
- Duplicar formularios (deuda de mantenimiento)
- Confusión sobre dónde está la "verdad" del estado del envío
- Inconsistencia visual si dos UIs editan diferente

### 4.5 Group header clickeable como toggle

Toda la fila del cliente es clickeable para expandir/colapsar. Sin
botón ▶/▼ separado para reducir clicks. El chevron es solo visual.

### 4.6 Sin paginación V1

`listShipments` retorna hasta 100 rows. Si un tenant tiene >100
envíos visibles en un tab, los más viejos no aparecen. Para volúmenes
mayores, agregamos paginación en SDD futuro o filtros por fecha más
agresivos.

### 4.7 Search filtra contra el grupo completo

Si typeás "Demo", se muestran grupos cuyo client_name o MARKBOX
matchee, Y también grupos cuyo algún children matchee (code, ruta).
Mejor UX que filtrar solo headers o solo rows.

---

## 5. Criterios de aceptación

### Funcional
- [ ] `/studio/embarques` muestra agrupación por cliente con counts
- [ ] Tab "Todos" muestra todos los envíos no soft-deleted
- [ ] Tab "Activos" excluye delivered + cancelled
- [ ] Tab "Entregados" solo muestra status = delivered
- [ ] Tab "Con alertas" solo muestra status = exception
- [ ] Tabs muestran counts correctos
- [ ] Click en group header expande/colapsa el grupo
- [ ] Click en row hijo abre drawer detail
- [ ] Drawer muestra todos los datos del envío
- [ ] Botón "Ir al tracking →" navega correcto y se puede operar
- [ ] Search filtra contra client_name, MARKBOX, code, ruta
- [ ] Empty state si no hay matches en el tab/search actual

### Sistema
- [ ] `pnpm typecheck` pasa
- [ ] Cero hex literales nuevos
- [ ] Light + dark themes funcionan
- [ ] Sidebar marca "Embarques" como active

---

## 6. Out of scope / open questions

- **¿Vista Kanban?** Sí — pero en SDD-0012b si lo pedís, o cuando llegue
  el Sprint 3 de Operación profunda.
- **¿Notificaciones desde Embarques?** No. Si querés alertar al cliente
  o al equipo, usás el módulo Mailing (SDD futuro) o WhatsApp manual.
- **¿Agrupación alternativa (por servicio, por origen)?** No por ahora.
  Comercial = agrupar por cliente. Operacional = lista plana (Tracking).
- **¿Histórico por cliente expandible inline?** No. El histórico de un
  cliente vive en `/clientes/[markbox]`. Embarques agrupa pero no
  reemplaza el detalle del cliente.
