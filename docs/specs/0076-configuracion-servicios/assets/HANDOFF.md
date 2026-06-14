# HANDOFF — SDD-0076 · Configuración de servicios

> **Estado:** las 4 fases + el editor de FAQ/adicionales/precios implementados en la rama `feat/configuracion-servicios`, **sin push**.
> **Fecha:** 2026-06-14 · **Base:** `4c28353` · **Para:** la ventana/persona de coordinación que mergea + aplica migraciones a prod.

Esta nota es el **runbook de activación**. El código está completo y verde; falta desbloquearlo (merge + migración + seed + API key + publicar).

> ⚠️ **Merge parcial (al 2026-06-14):** coordinación mergeó **SOLO la Fase 1** (`dee9d3b`, vía merge `b1fe493`). Los **6 commits siguientes están SIN mergear** (ver tabla). Además **SDD-0077 tomó la migración `0131` y ya está en main/prod**, pero la **`0130` de acá sigue sin aplicar** — son tablas independientes (service_configs vs contabilidad), así que aplicar `0130` después de `0131` funciona, aunque queda fuera de orden. La rama está basada en `4c28353` y main avanzó a `c9a043f`: al mergear habrá divergencia (ojo `StudioSidebar.tsx` — contabilidad también lo tocó — y `docs/specs/README.md`, que se regenera).

## Qué se construyó (6 commits sobre `4c28353`)

| Fase | Commit | Entrega |
|---|---|---|
| 1 | `dee9d3b` | `lib/shared/service-catalog.ts` — catálogo canónico de claves (20 servicios), reconciliación 19 slugs ↔ 5 núcleo ↔ 4 enums `ShipmentService`, `momento_timeline`, aliases legacy + tests. Spec `0076`. |
| 2 | `c4ba62a` | Migración **`0130`** (`service_configs` + `service_faqs` + `service_addons` + `service_price_history`, RLS por tenant, `revoke from anon`, RPCs públicas con whitelist, seed del contenido actual con `is_public=false`) + módulo `app/studio/(app)/servicios/` con asistente + guardrail (no publicar con solo lo contable) + `lib/studio/service-catalog/*` + tests. |
| 3 | `722bf89` | `lib/public/servicios-queries.ts` — lectura pública (RPC) + `mergeServiciosPublicados()` (fallback por campo) + tests. |
| 3 | `748fbca` | `app/servicios/page.tsx` async consume la DB con fallback; `ServiciosDetalle` por props; JSON-LD desde la lista merged. **Verificado E2E** (fallback = estático). |
| 4 | `699e668` | Gancho IA: `lib/studio/agents/tools/service-tools.ts` + `skills/service-advisor.ts` + registro (tools + `SKILLS_BY_SLUG`) + tests de wiring. |
| 2+ | `9016130` | Editor diferido de Fase 2: `ServicioDrawer` con pestañas (Servicio/FAQ/Adicionales/Precios) + `ServiceSubEditors` (FAQ pública/interna, adicionales ADS, historial de precios). Fix Fase 3: `revalidatePath('/servicios')` al publicar/editar (la página es static). `pnpm build` verde. |

**Números:** spec `0076`, migración `0130` (confirmados libres al crear). Re-confirmar contra origin antes de mergear.

## Checklist de activación (en orden)

1. **Pre-check:** `git fetch origin`; confirmar que `0076`/`0130` no chocan con otra rama.
2. **Merge** `feat/configuracion-servicios` → main. **Antes de pushear, correr `pnpm build` (turbopack)** — un build roto no lo caza `verify.mjs` y tumba los deploys. Confirmar deploy READY (`get_deployment(dtdcargo.com)`).
3. **Aplicar migración `0130`** a Supabase prod (invocar antes los skills Supabase) → crea tablas + RPCs + seed. Correr `get_advisors`. *(Hasta este paso, `/studio/servicios` da error al leer; `/servicios` queda OK por fallback.)*
4. **Re-seed de skills** (`scripts/seed-agents.ts`) → registra `service-advisor` en la DB. Gotcha: gap RLS `service_role` en `tenants`/`skills` puede romper el seed → workaround vía MCP.
5. **(Sam) Activar `ANTHROPIC_API_KEY`** en prod → desbloquea el asesor IA (mismo blocker del "Parte Diario").
6. **(Sam) Publicar** en `/studio/servicios` los servicios que correspondan (nacen en Borrador).

## Verificación
- `/servicios` 200, muestra servicios (DB publicada + fallback estático). El crawl de Kommo toma lo publicado.
- `/studio/servicios` lista los 20 editables; publicar exige descripción + alcance + cómo se solicita.
- `getSkillDefBySlug("service-advisor")` presente; el asesor IA responde con el corpus (público + interno).

## Notas de diseño que NO se deben romper
- **Capa pública vs interna:** la RPC `public_servicios()` usa whitelist (nunca expone `notes_internal`/`internal_price_ref`); el asesor IA tiene instrucción de no filtrar lo interno al cliente. Las FAQ `audience='internal'` nunca se publican (CHECK en DB).
- **Cero regresión:** `/servicios` cae al estático por campo hasta que se publique. No retirar `lib/servicios-detalle.ts` hasta confirmar paridad de lo publicado.
- **Mapeo N:1:** `fcl-bodega` y `fcl-directo` comparten `reserva_FCL` (5 núcleo, 4 enums). No asumir 1:1.

## Diferido (no en esta rama)
- Mostrar las **FAQ públicas en `/servicios`** (el editor ya las gestiona y `getPublicServiceFaqs()` existe; falta cablearlo en `app/servicios/page.tsx`).
- Cursos de importación: ficha reservada (`proximamente`), contenido lo define la ventana del curso Alibaba.
