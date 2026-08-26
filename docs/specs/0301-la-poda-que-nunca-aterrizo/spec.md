---
sdd: "0301"
title: "La poda del 3-ago nunca llegó a main — 14 archivos muertos, y uno que resucitó"
status: in-progress
author: "founder"
created: 2026-08-26
updated: 2026-08-26
supersedes: null
superseded_by: null
related: ["0295"]
confidencialidad: interno
---

# DTD-0301 — La poda que nunca aterrizó

> Salió de una pregunta chica: barriendo `transition: all` (SDD-0295) se vio que
> dos de los componentes tocados **no los importa nadie**. Al tirar del hilo,
> eran catorce — y ya estaban identificados hace tres semanas.

## El hallazgo: la poda se hizo y se archivó

La radiografía del 2026-08-02 identificó 15 archivos muertos y los borró en el
commit `50d52091` («poda 15 archivos muertos»). Ese commit vive en
**`origin/archive/radiografia-erp-20260802`** — una rama **archivada, nunca
mergeada**. Los 15 siguieron en `main` hasta hoy.

La auditoría hasta lo dejó por escrito: *«`EstimacionForm.tsx` sí está
muerto»*.

## 🔴 Y por qué esa lista NO se podía aplicar tal cual

**`components/FclCalculator.tsx` resucitó.** Estaba muerto el 3-ago; hoy lo
importan `app/fcl/page.tsx` y `app/fcl/embed/page.tsx`, que se construyeron
después. **Aplicar la lista de hace tres semanas habría roto `/fcl`.**

Es exactamente lo que la propia auditoría advertía:

> «Por eso el Lote 5 se ejecuta archivo por archivo, no por lista.»

Una lista de código muerto **caduca**. Es un hecho sobre el mundo en una fecha,
no una propiedad del archivo.

## Cómo se midió (dos métodos, porque uno solo miente)

1. **Imports por ruta** — `from ".../<basename>"` sobre `app/`, `components/`,
   `lib/`, `e2e/`, `scripts/`.
2. **Símbolos exportados** — cada nombre exportado, buscado con límites de
   palabra en todo el corpus.

Los dos **discreparon en 6 archivos**. Al mirar las líneas, los 6 eran
**menciones en comentarios**, no usos:

| Símbolo | Dónde «aparecía» |
|---|---|
| `AgenticHealthCard` | comentario en `agent-queries.ts` |
| `CategorySelector` | comentario en `Step1Headlines.tsx` |
| `Hero` | `{/* ── Hero ── */}` en `app/page.tsx` |
| `ServiciosDetalle` | comentario en `FichaCuerpo.tsx` |
| `estimateEta` | comentario en `portal-types.ts` |
| `stats` (de `venezuela-catalog`) | palabra común, sin relación |

El único `Hero` realmente importado es **`DdpHero`**, otro componente.

**La medición se repitió sobre el árbol final** justo antes de borrar, porque
`origin/main` avanzó entre el análisis y la ejecución — que es la trampa que
`FclCalculator` demuestra.

## Lo que se borró — 14 archivos · 2.227 líneas

| Líneas | Archivo | Por qué murió |
|---:|---|---|
| 494 | `components/EstimacionForm.tsx` | `/estimacion` pasó a 301 → `/tarifas` |
| 392 | `components/servicios/OfertaWizard.tsx` | lo reemplazó el rediseño de `/servicios` al Norte |
| 346 | `lib/data/venezuela-catalog.ts` | — |
| 229 | `…/dashboard/_components/AgenticHealthCard.tsx` | — |
| 118 | `app/noticias/[slug]/_components/FaqPageJsonLd.tsx` | — |
| 110 | `components/Hero.tsx` | — |
| 110 | `lib/public/tracking-queries.ts` | `/track` pasó a 301 → `/portal/login` |
| 108 | `…/noticias-web/_components/CategorySelector.tsx` | pasó a `SegmentedControl` |
| 101 | `lib/studio/hooks/use-realtime-dispatch.ts` | — |
| 49 | `components/ServiciosDetalle.tsx` | se extrajo a `FichaCuerpo` |
| 47 | `lib/studio/person-queries.ts` | — |
| 42 | `components/JoinCTA.tsx` | — |
| 41 | `components/TrustBar.tsx` | — |
| 40 | `app/studio/(app)/_components/LogoutButton.tsx` | — |

Ninguno dejó tests huérfanos.

## Lo que NO se borró

**`components/FclCalculator.tsx`** — vivo, alimenta `/fcl` y `/fcl/embed`.

## Verificación

1. **Dos métodos independientes**, con los 6 desacuerdos revisados línea por
   línea.
2. **Re-medición sobre el árbol final** antes de ejecutar el borrado.
3. `pnpm typecheck` limpio con los 14 fuera.
4. Gate completo `node scripts/verify.mjs` — el paso `build` es el que prueba de
   verdad que ninguna ruta dependía de ellos.

## ⚠️ Lo que esta spec NO afirma

**Que estos 14 no vayan a hacer falta.** El sistema está por liberarse a
operación real, y algunos —`person-queries`, `use-realtime-dispatch`,
`venezuela-catalog`— podían estar aparcados para lo que viene. **Muerto hoy no
es lo mismo que descartado**, y esa distinción la decidió el founder, no la
medición. Si alguno hace falta, vuelve entero desde git.
