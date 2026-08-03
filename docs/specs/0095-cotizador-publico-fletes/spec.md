---
sdd: "0095"
title: "Cotizador público de fletes marítimos (SeaRates · caché anti-scraping, Fase 2)"
status: done
author: "Claude Code (ventana searates-cotizador-publico) + founder"
created: 2026-06-17
updated: 2026-06-28
supersedes: null
superseded_by: null
related: ["0092", "0061", "0055"]
confidencialidad: interno
---

# SDD-0095 — Cotizador público de fletes (Fase 2)

> Llevar las **tarifas reales de flete marítimo** (validadas en SDD-0092) al **sitio público**
> como estimado white-label, **sin quemar la cuota de SeaRates ni exponerla a scraping**.

## Contexto

SDD-0092 dejó el cliente SeaRates funcionando (benchmark interno, admin-only) con tarifas reales
confirmadas en vivo (`rates(...) { general points }`, ej. LCL Nansha→La Guaira ≈ USD 1.738). El
founder pidió (2026-06-17) **construir el cotizador de fletes para la web**.

Restricciones duras:
- **Cuota:** 100 llamadas/mes (vence 2026-07-17). El público NO puede gatillar llamadas en vivo.
- **Frontera público↔ERP:** el sitio (`app/estimacion`, `components/**`) no importa `@/lib/studio`,
  `@/lib/db` ni `@supabase`. Puente = `app/api/**` (route handlers) + `lib/public/` (anon) + `lib/shared/`.
- **Candado de país (founder):** origen = puertos de China; destino = Venezuela + **solo Barranquilla**
  (Colombia). Ningún otro país.
- **White-label:** nunca nombrar al proveedor ni a la naviera; el precio es **referencial**
  (calza con "Pagas al llegar\*" y `docs/marketing/condiciones-cotizacion.md`).

## Arquitectura — caché semanal (anti-scraping)

```
cron semanal ──(getOceanRate ×N)──▶ ocean_rates (caché)
                                          ▲
sitio público ──fetch──▶ /api/public/ocean-rate ──RPC anon──┘   (0 llamadas SeaRates/visita)
```

- **`ocean_rates`** (migración 0145): matriz cacheada de tarifas (data de referencia GLOBAL, sin
  `tenant_id`). RLS cerrada; la escribe el cron con service_role; la lee el público SOLO vía la RPC
  `public_ocean_rate` (security definer, grant anon, retorno mínimo).
- **Cron `/api/cron/searates-refresh`** (CRON_SECRET): recorre `OCEAN_RATES_MATRIX` y hace UPSERT.
  Única superficie que gasta cuota. Matriz dimensionada a la cuota: **2 orígenes × 3 destinos × 2
  configs (LCL + FCL HC40) = 12 rutas/semana ≈ 52/mes** (cabe en 100 con headroom).
- **`/api/public/ocean-rate`**: valida el candado de país (`validateOceanRouteInput`), lee la caché
  (`getPublicOceanRate`, anon) y devuelve `{ available, rate, disclaimer }`. Cero cuota.

## Archivos (Slice A · este commit)

| Capa | Archivo |
|---|---|
| Migración | `supabase/migrations/0146_ocean_rates_cache.sql` (tabla + RLS + RPC `public_ocean_rate`) |
| Compartido | `lib/shared/ocean-rate.ts` (catálogo + candado + `validateOceanRouteInput` + `PublicOceanRate` + disclaimer) |
| ERP (cron) | `lib/studio/searates/ocean-rates-matrix.ts` · `ocean-rates-queries.ts` (`refreshOceanRates`) |
| Público | `lib/public/ocean-rates-public.ts` (`getPublicOceanRate`, anon) |
| API | `app/api/cron/searates-refresh/route.ts` · `app/api/public/ocean-rate/route.ts` |
| Cron sched | `vercel.json` (lunes 06:00 UTC) |
| Tests | `lib/{shared,studio/searates,public}/__tests__/*` (candado, refresh/upsert, lectura) |

## Verificación

`node scripts/verify.mjs` (gate) + `pnpm build` verdes. Tests con fetcher/admin/anon fakes — **0
llamadas reales** a SeaRates ni a la DB.

## Diferido — Slice B (necesita decisión del founder + ui-ux)

1. **UI pública** del cotizador (en `/estimacion` o sección nueva) consumiendo `/api/public/ocean-rate`
   — pasa por `ui-ux-designer` + alineación al Norte 4.3 antes del commit.
2. **Presentación del precio:** ¿se muestra el flete crudo o un precio DTD (markup/DDP)? El founder
   decide. La caché guarda el flete real; el slice B aplica la presentación.
3. **Catálogo completo:** resolver el ID de **Barranquilla** + expandir a todos los puertos CN/VE con
   un resolver nombre→ID (autocompletado). Hoy el catálogo arranca con las rutas principales.
4. **Modelado LCL:** escalado por CBM real + mínimos (hoy se cachea 1 CBM de referencia).
5. **Split "averiguar" vs "cotizar":** el estimado cacheado es "averiguar"; la cotización en firme
   va por lead/asesor (otro flujo).

## Pendiente de coordinación / founder

- Aplicar migración **0145** a prod (la corre la ventana de coordinación; NO desde esta rama).
- `CRON_SECRET` ya existe (lo usan otros crons). `SEARATES_API_KEY` debe estar en Vercel env para que
  el cron consiga tarifas (sin ella, el cron cachea filas `status='error' mock_no_key` sin gastar red).
- Subir el límite de SeaRates con Oleh si se quiere matriz más grande o cadencia diaria.
