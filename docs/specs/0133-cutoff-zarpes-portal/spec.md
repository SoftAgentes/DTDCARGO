---
sdd: "0133"
title: "Cut-off / calendario de zarpes en el portal"
status: in-progress
author: "agente-secundario (inventario portal)"
created: 2026-07-01
updated: 2026-07-01
supersedes: null
superseded_by: null
related: ["0042", "0047", "0101"]
confidencialidad: interno
---

# DTD-0133 — Cut-off / calendario de zarpes en el portal

> **Número confirmado 2026-07-01** (máx en main = 0131 → libre 0133). Origen:
> `INVENTARIO-PORTAL.md` gap **#2** (rama `feat/portal-inventario`).

## Contexto

El dashboard del portal ya muestra el **próximo arribo** (buque real, ETA — SDD-0101). Pero
falta la otra mitad de la firma del Norte: la **cuenta regresiva al cut-off** ("próxima salida
de TU puerto" con cierre de carga + espacio disponible — `_norte/portal/app.jsx`
`NextSailingCard`). Es lo primero que el cliente necesita para organizar sus compras contra el
calendario real ("tu mercancía debe llegar a China antes del …").

**La data ya existe.** SDD-0047 creó la tabla `sailings` (migr 0096) con
`pol / pod / vessel / voyage / etd / eta / cutoff / status (abierto|cutoff|zarpado|transito|
arribado) / space (alta|media|baja|cerrada)`. Falta la **lógica "próximo zarpe relevante para
el cliente"** + la **card** en el portal.

## Objetivo

Mostrar en el dashboard del portal una **`NextSailingCard`** con:
- cuenta regresiva al **cut-off** del próximo zarpe abierto de la ruta del cliente;
- ETD/ETA del zarpe;
- **espacio disponible** (alta/media/baja/cerrada);
- copy de acción ("tu mercancía debe llegar antes del <cutoff>").

## No-objetivos

- Reservar espacio desde el portal (V1 es informativo).
- Gestionar el calendario de zarpes (eso es el Studio / SDD-0047).

## Enfoque técnico (propuesta)

- **Sin migración.** `sailings` ya existe; el portal la lee con **admin client scopeado**
  (best-effort, mismo patrón que Naviera Tier 1 — el cliente no tiene RLS sobre `sailings`).
- Query "próximo zarpe": `status = 'abierto'` **and** `cutoff >= now()` **and** ruta relevante,
  ordenado por `cutoff` asc, `limit 1`.
- **Degradación honesta:** si no hay zarpe abierto para la ruta → la card no se muestra (o
  muestra "sin fecha publicada, escríbele a tu asesor"), nunca rota.

## Decisión clave abierta (founder): ¿cuál es "la ruta del cliente"?

`sailings` es por `pol → pod`. Hay que decidir cómo se elige el zarpe que le toca al cliente:

1. **Por su historial de envíos** — la ruta (pol/pod) más frecuente de sus últimos envíos.
2. **Por su puerto de destino en Venezuela** (pod fijo del cliente) + pol por defecto (China).
3. **Config del tenant** — un "zarpe destacado del portal" que el operador marca (el más
   simple: una sola ruta principal para todos).
4. **El cliente elige** ruta en la card (selector pol/pod).

> Recomendación para V1: **opción 3** (un zarpe destacado configurable) o **2** (pod del
> cliente) — las más baratas; refinar a 1/4 después.

## Otras decisiones abiertas

- ¿Mostrar solo el próximo zarpe o los próximos 2-3?
- ¿La card aparece siempre o solo si el cliente tiene compras/prealertas activas?
- ¿Se relaciona con la prealerta ("tu mercancía debe llegar antes del cut-off")?

## UI

- `NextSailingCard` en el dashboard (`PortalDashboardNorte`), arriba o junto al "próximo
  arribo". Cuenta regresiva viva (client component) al `cutoff`. Estados de `space` con los
  tokens de color del portal.

## Verificación

- `node scripts/verify.mjs` verde.
- Sin migración → sin gate de DB. Si se agrega una policy de portal a `sailings`, validar con
  `begin … rollback` en prod.

## Estado de implementación (2026-07-01 · rama `feat/portal-inventario`)

**Construido, verify TODO VERDE. SIN migración** (lee `sailings` con admin client scopeado por
tenant, patrón Naviera Tier 1). Decisiones founder: ruta = **próximo zarpe abierto** global
(cut-off más cercano, sirve para LCL 95%); la card se muestra **siempre que haya zarpe**.

- **`lib/portal/next-sailing-queries.ts`** — `getNextOpenSailing` (status='abierto' +
  cutoff ≥ hoy + tenant, orden por cutoff asc, limit 1) + `daysUntil` (puro) +
  `portalSpaceLabel`.
- **`app/portal/(app)/_components/PortalNextSailingCard.tsx`** — card "Próxima salida" con
  cuenta regresiva VIVA al cut-off (SSR-safe: días del server como fallback) + ETD/ETA +
  espacio disponible + copy "tu mercancía debe llegar a China antes del <cutoff>".
- **Wire** en `PortalDashboardNorte` (columna derecha, arriba) + fetch best-effort en la home.
- **Tests:** `lib/portal/__tests__/next-sailing.test.ts` (7).

**Diferido (V1 informativo):** reservar espacio desde el portal · selector de ruta · relación
con prealerta · mostrar 2-3 próximos zarpes.
