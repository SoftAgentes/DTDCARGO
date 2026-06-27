---
sdd: "0108"
title: "Combobox de cliente cédula-first (cotizador/tracking/embarques)"
status: in-progress
author: "Claude Code (ventana secundaria) + founder"
created: 2026-06-26
updated: 2026-06-26
supersedes: null
superseded_by: null
related: ["0106", "0107", "0046", "0010"]
confidencialidad: interno
---

# SDD-0108 · Combobox de cliente cédula-first — Fase 3 de la identidad por persona

> **Fase 3 de [SDD-0106](../0106-persons-identidad/spec.md).** Fase 1 creó `persons` +
> `find_client_by_cedula` (lookup normalizado) y elevó la cédula a identificador co-primario en
> la lista de Clientes. Fase 2 ([SDD-0107](../0107-academia-persona/spec.md)) ancló la Academia.
> Esta fase lleva el **"ubicar por cédula primero"** al punto donde el operador **elige** un
> cliente: los formularios de cotizador / tracking / embarques.

## 0. Por qué — y qué NO es

Hoy el operador **tipea a mano** el Shipping Mark y el nombre del cliente (texto plano, sin
lookup) — ej. `app/studio/(app)/cotizador/_components/QuoteDrawer.tsx` tiene dos `<input>`
sueltos (`client_markbox` + `client_name`). No hay validación contra clientes reales ni forma de
buscar por cédula. Esta fase reemplaza eso por un **combobox reusable cédula-first**: el operador
escribe cédula / nombre / Shipping Mark, ve coincidencias reales, y al elegir se autocompletan
markbox + nombre.

**Decisión diferida (NO entra):** la elección de **ruta de detalle `[markbox]` vs `[id]`**
(SDD-0106 §3) queda **fuera de esta fase** — cambiarla rompe links/bookmarks y el RLS del portal
(`get_portal_client_markbox`). Requiere decisión explícita del founder; se trata aparte.

## 1. Modelo / enfoque

- **Additivo, sin migración.** Reusa `find_client_by_cedula` (RPC, 0174) + `listClients`
  (búsqueda cédula-first, 0106). Los formularios **siguen guardando `client_markbox` + `client_name`**
  (texto denormalizado) → cero cambio de schema, cero ripple. El combobox solo mejora cómo se
  llenan + valida contra clientes vivos.
- **Fallback manual:** si el cliente aún no existe en el sistema, el operador puede seguir
  tipeando markbox/nombre libres (no se bloquea el alta).

## 2. Alcance — entregable

### 2.1 Componente reusable
- `app/studio/_components/ui/ClientCombobox.tsx` (`"use client"`): input con búsqueda
  as-you-type (debounce ~300ms), dropdown de coincidencias, navegable por teclado (↑/↓/Enter/Esc),
  `prefers-reduced-motion`, tokens `var(--*)`. Cada opción muestra **cédula/RIF + Shipping Mark +
  nombre** (cédula-first en la jerarquía visual, espejo de la lista de Clientes de Fase 1).
  Props: `value`, `onSelect(client)`, `onManualChange` (fallback texto libre), `name`/`id` para
  el form. Al elegir, devuelve `{ id, markbox, name, rif, person_id }`.
- **Server action de búsqueda** `searchClientsAction(q)` (read-only, gate RBAC `canAccessModule`,
  sin Zod): **cédula-first** — si `q` normaliza a algo cédula-like, intenta `find_client_by_cedula`
  primero; siempre además `listClients` ilike (nombre/markbox/rif/email); dedup por `id`; tope ~8
  resultados. Resuelve tenant desde `user_tenants` (patrón AGENTS.md).

### 2.2 Integraciones
1. **Cotizador** (`QuoteDrawer.tsx`) — **must**: reemplaza los dos `<input>` de cliente por el
   combobox; al elegir, setea `client_markbox` + `client_name` (hidden/controlados) que ya consume
   la action. Mantener fallback manual.
2. **Tracking nuevo** (`tracking/nuevo/_components/CreateShipmentForm.tsx`) — si selecciona
   cliente, mismo combobox.
3. **Embarques** (`embarques/_components/*`) — idem donde se elija cliente.
   *(2 y 3: aplicar el mismo patrón donde exista selección de cliente; si un módulo no la tiene,
   se documenta y se omite.)*

### 2.3 Fuera de alcance
- ❌ Ruta `[markbox]` vs `[id]` (diferida, ver §0).
- ❌ Migrar columnas `client_markbox` → FK.
- ❌ Tocar el sitio público o el portal.

## 3. Verificación
- Vitest: `searchClientsAction` cédula-first (mock Supabase: prioriza match exacto por cédula;
  dedup; tope); lógica de normalización del input (reusa `normalizeCedula`).
- Render/teclado del combobox (testing-library): abre, filtra, selecciona, Esc, fallback manual.
- `node scripts/verify.mjs` **TODO VERDE** + `pnpm build` OK.
- **UI/UX:** pasa por el agente `ui-ux-designer` antes del commit (regla del founder) — pantalla
  nueva/cambio visual sustancial.

## 4. Seguridad / riesgos
- `searchClientsAction` es **read-only** con gate RBAC + RLS por tenant → no filtra clientes de
  otro tenant. Tope de resultados evita scraping.
- **Sin cambio de datos** (los forms siguen guardando markbox+nombre texto) → riesgo bajo,
  reversible (es UX sobre lo existente).

## 5. Archivos
```
app/studio/_components/ui/ClientCombobox.tsx              (nuevo)
lib/studio/client-queries.ts                             (reusa getClientByCedula/listClients)
app/studio/(app)/cotizador/_components/QuoteDrawer.tsx   (editar: combobox)
app/studio/(app)/cotizador/actions.ts                    (searchClientsAction, o lib compartida)
app/studio/(app)/tracking/nuevo/_components/CreateShipmentForm.tsx  (editar si aplica)
app/studio/(app)/embarques/_components/*                 (editar si aplica)
docs/specs/0108-combobox-cedula/spec.md                  (este archivo)
```

## 6. Roadmap (fuera de esta fase)
- **Decisión de ruta `[markbox]` vs `[id]`** + migración gradual `client_markbox` → FK en features
  nuevas (la pieza que cierra la unificación de identidad de SDD-0106).
