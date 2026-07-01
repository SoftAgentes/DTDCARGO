---
sdd: "0125"
title: "Master data — hub read-only de catálogos (tiers + punteros a módulos + faltantes)"
status: in-progress
author: "Claude Code (sesión secundaria · worktree web-norte) + founder"
created: 2026-07-01
updated: 2026-07-01
supersedes: null
superseded_by: null
related: ["0090", "0130", "0029"]
confidencialidad: interno
---

# SDD-0125 · Master data

> Sexta sección real de Administración. Sin migración: **hub read-only** que
> mapea dónde vive cada catálogo, en vez de inventar un store nuevo.

## Contexto

Los "catálogos" del Norte para esta sección son heterogéneos:

- **Tiers de cliente** — enum de código (`ClientTier`: regular/vip/premium).
- **Servicios** — tabla real `service_configs` (SDD-0090), gestionada en
  `/studio/servicios`.
- **Ciudades / rutas** — catálogos VE + rutas, gestionados en
  `/studio/admin/rutas`.
- **Segmentos, tipos de documento, estados, HS codes, AES** — hoy NO existen
  como catálogo editable en DB.

No hay un único store "master data" que construir sin inventar tablas. Meter
todo eso greenfield sería especulativo y solaparía módulos existentes.

## Alcance

1. **Tiers de cliente** — lista read-only (código).
2. **Se gestionan en su módulo** — punteros a `/studio/servicios` y
   `/studio/admin/rutas`.
3. **Por implementar** — chips de los catálogos que aún no existen como
   editables (segmentos, tipos de documento, estados, HS codes, AES), con nota
   de que cada uno necesita su propia spec (tabla + RLS + UI).

## Superficie de código

- `app/studio/(app)/admin/_components/MasterDataSection.tsx` — server-safe.
- `app/studio/(app)/admin/page.tsx` — render de la sección.

## Follow-ups (fuera de alcance)

- Catálogos editables nuevos (segmentos de cliente, tipos de documento, estados
  del workflow, HS codes OMA, AES arancel VE) → cada uno su spec con migración.

## Estado

Código listo; `pnpm typecheck` + build en verde. Sin migración.
