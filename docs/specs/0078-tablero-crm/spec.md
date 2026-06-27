---
sdd: "0078"
title: "Tablero CRM (Kommo ↔ ERP) read-only — Dirección + Asesor"
status: done
author: "Claude Code (ventana crm-tablero) + founder"
created: 2026-06-14
updated: 2026-06-27
supersedes: null
superseded_by: null
related: ["0043", "0058", "0051", "0052", "0062"]
confidencialidad: interno
---

# DTD-0078 — Tablero CRM (Kommo ↔ ERP) read-only

> Convertir `/studio/kommo` de una tabla plana de leads en un **tablero** que muestre la salud
> del embudo de Kommo cruzada con la **plata real del ERP**. SOLO LECTURA: no toca Kommo ni el
> espejo. Para dirección (founder) + el asesor comercial.

## Contexto

El ERP ya espeja Kommo a Supabase (cron diario, SDD-0043): **~2.675 leads · 2.700 contactos · 10
embudos · 62 etapas**. La pantalla actual `/studio/kommo` es una **tabla plana** — no muestra
embudo, valor, conversión ni antigüedad. El diagnóstico de SDD-0062 (data real de prod) probó que
el embudo es un **cementerio**: 2.029 leads atascados, mediana ~349 días sin moverse, $0 de valor
en el 100% de los leads, conversión 0,04%, 99,9% de los leads en 1 usuario, 5,5% con email.

Este spec hace ese diagnóstico **vivo y continuo**, y agrega la única vista que Kommo no puede dar:
el cruce con el dinero facturado del ERP. **Cero write-back** (eso es SDD-0062, diferido).

> Decisión del founder (2026-06-14): el tablero vive **en el ERP** (no widget de Kommo); motor de
> conexión = **API directa + webhook** (lo que ya existe), sin iPaaS. Investigación en la memoria
> `project_contabilidad_qbo_online` y el plan de la sesión.

## Alcance (v1)

- **Sin migración** — todo código de app. Lee del espejo `kommo_*` + cruza `clients`/`invoices`.
- **Garantía de no-daño:** si la pantalla nunca cargara, Kommo quedaría idéntico (solo `SELECT`).
- Dos pestañas vía `?tab=` (patrón de la Torre de control, SDD-0050):

### Pestaña Dirección
KPIs (`KpiCard`): total leads · contactos · conversión Kommo · convertidos a cliente DTD · cobertura
email · **valor real ERP** (suma facturada trailing-12m de los leads ya convertidos). Más:
- **Salud del embudo** — distribución de leads por etapa del embudo principal, con el cuello marcado.
- **Cementerio** — buckets de antigüedad (>30/90/180/365 días sin moverse) + mediana.
- **Concentración de cartera** — leads por asesor (`responsible_user_id`), con el dominante marcado.
- **Valor Kommo vs ERP** — contraste: Kommo dice `Σ price` (≈$0); el ERP ya facturó `$X`.

### Pestaña Asesor (worklist)
La tabla de leads existente, enriquecida: columna **días sin moverse** + **valor** (ERP si el lead
está convertido, sino el `price` de Kommo). Filtros: embudo · asesor · antigüedad · orden
(reciente/más viejo). Mantiene "Convertir a cliente" (SDD-0058).

> **Limitación honesta:** el espejo no trae nombres de asesor (no hay `kommo_users`) → se muestra
> "Asesor #id" con el dominante marcado. "Sin email" no es filtrable a nivel lead (el email vive en
> el contacto y el espejo no linkea lead↔contacto). Ambas = follow-up.

## Arquitectura

- `lib/studio/kommo-analytics.ts` — funciones **puras** (testeadas): `agingBuckets`, `funnelHealth`,
  `ownershipDistribution`, `conversionStats`, `emailCoverage`, `valueContrast` + el orquestador
  `getKommoAnalytics(supabase)` y `allConvertedLeads()`.
- Reusa: `clientAnnualBilling` (SDD-0051), `Donut`/`Progress`/`HeaderRow` (SDD-0052),
  `KpiCard`/`Badge`/`EmptyState`, `parseContactFields` (SDD-0043).
- `app/studio/(app)/kommo/_components/kommo-tabs.shared.ts` — resolver de pestaña (server-safe).
- `DireccionTab.tsx` (presentacional) + `KommoClient.tsx` (orquestador con pestañas + worklist).
- `lib/studio/kommo-queries.ts` — `KommoFilters` extendido (responsible/agedDays/sort).

Constantes Kommo: etapa Won = 142, Lost = 143 (estados de sistema, universales por cuenta).

## Criterios de aceptación
- [ ] `node scripts/verify.mjs` verde (incl. tests nuevos de `kommo-analytics`).
- [ ] `pnpm build` (turbopack) verde.
- [ ] `/studio/kommo?tab=direccion` muestra los 6 KPIs + embudo + cementerio + cartera + contraste.
- [ ] `/studio/kommo?tab=asesor` muestra el worklist con días + valor + filtros, y "Convertir" sigue.
- [ ] Cero escritura a Kommo / cero migración / frontera público↔ERP intacta.

## Fuera de alcance (diferido a SDD-0062)
Webhook tiempo-real · write-back de valor/etapa a Kommo · captura/reactivación email · espejo
`kommo_users` · widget dentro de Kommo.
