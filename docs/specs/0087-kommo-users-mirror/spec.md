---
sdd: "0087"
title: "Espejo de usuarios de Kommo — nombres de asesor en el tablero"
status: done
author: "Claude Code (ventana kommo-users) + founder"
created: 2026-06-14
updated: 2026-06-28
supersedes: null
superseded_by: null
related: ["0078", "0043", "0062"]
confidencialidad: interno
---

# DTD-0087 — Espejo de usuarios de Kommo (nombres de asesor)

> El tablero CRM (SDD-0078) muestra la cartera y el filtro por **"Asesor #142"** (el `responsible_user_id`
> crudo) porque el espejo no trae los usuarios de Kommo. Este slice espeja `kommo_users` y cruza el id →
> nombre real, para que la concentración de cartera y el filtro sean **accionables** ("María / José" en vez
> de un número). Read-only, sin write-back. Roadmap #4 de SDD-0078.

## Contexto

El diagnóstico de SDD-0062/0078 reveló que el **99,9%** de los leads están en un solo asesor — pero el
tablero lo rotula "Asesor #9976747", ilegible para decidir (repartir cartera, SLA). El espejo (SDD-0043)
sincroniza pipelines/statuses/custom_fields/contacts/leads pero **no usuarios**. Falta una tabla
`kommo_users` + el pull en `kommo-sync` + el cruce en la analítica.

## Alcance (esta ventana)

- **Migr 0139**: tabla `kommo_users` (`tenant_id, id bigint, name, email, synced_at`, PK `(tenant_id, id)`),
  clon del patrón de los `kommo_*` (migr 0082): RLS ON + policy authenticated SELECT por tenant +
  service_role ALL + grants. Sin RPC, sin SECURITY DEFINER.
- **Edge function `kommo-sync`** (`sync.ts` + `types.ts`): nueva entidad `users` →
  `GET /api/v4/users?limit=250` → upsert `kommo_users` vía `upsertRows` (mismo `logged()` + `sync_logs`).
  Aditiva: si falla, las demás entidades siguen (patrón existente).
- **`lib/studio/kommo-types.ts`**: `KommoUserRow`. **`lib/studio/kommo-queries.ts`**: `listKommoUsers`.
- **`lib/studio/kommo-analytics.ts`**: `ownershipDistribution(leads, nameById?)` rotula con el nombre real
  (fallback a "Asesor #id" si no está en el mapa). `getKommoAnalytics` trae los usuarios y arma el mapa.
  La query de usuarios es **resiliente** (`.catch(() => [])`): si el código deploya antes de aplicar la
  migración, el tablero cae a "Asesor #id" en vez de romperse.

**Sin cambios de UI:** el nombre fluye por `OwnerSlice.label` → el tablero (cartera) y el filtro Asesor del
worklist ya lo renderizan. Cambia el contenido del label, no los componentes.

## Fuera de alcance (diferido)
- Mostrar email/foto del asesor, o una vista de "equipo". Solo el nombre, donde ya se usa el id.
- Reasignar leads / round-robin (eso vive en Kommo, no en el ERP).

## Criterios de aceptación
- [ ] `node scripts/verify.mjs` verde (incl. test del cruce id→nombre + fallback en `ownershipDistribution`).
- [ ] `pnpm build` (turbopack) verde.
- [ ] Migr 0139 queda como ARCHIVO (no aplicada a prod).
- [ ] Con `kommo_users` poblado, el tablero muestra el nombre real del asesor (cartera + filtro); con la
      tabla vacía o inexistente, cae a "Asesor #id" sin romperse (resiliencia del deploy gap).
- [ ] Read-only: no muta Kommo ni el resto del espejo. Frontera pública↔ERP intacta.

## Gates para coordinación / founder
- Aplicar migr 0139 a prod (skills Supabase + advisors) **y** deploy de la edge function `kommo-sync`
  (es donde vive el pull de usuarios) → tras el próximo sync, los nombres pueblan `kommo_users`.
- Sin decisión de founder pendiente (es read-only, no toca el write-back ni sus flags).
