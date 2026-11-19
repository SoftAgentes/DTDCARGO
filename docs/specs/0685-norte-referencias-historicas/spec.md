---
sdd: 0685
title: Marcar como historicas las referencias al back Norte en el prototipo
status: proposed
author: Sam
created: 2026-11-19
updated: 2026-11-19
supersedes: null
superseded_by: null
related: PR #706 (retiro del back Norte)
confidencialidad: interna
---

# SDD-0685 - Marcar como historicas las referencias al back Norte en el prototipo

Reserva de numeracion (stub). La spec se desarrolla y la tarea se ejecuta DESPUES del merge de la PR #706.

## Objetivo

Marcar cada instruccion viva que apunta a `_norte/backend/` dentro de `docs/design/studio/_norte/**` con la nota exacta:
`historico: el backend real es Supabase; ver docs/engineering/project-rules.md seccion Patrones del Studio`.

Ni reescrituras ni borrados: la marca se inserta, el texto original queda intacto.

## Allowlist (lineas verificadas por grep sobre 48207f65d)

- HANDOFF.md:11,105,123,210 - CLAUDE.md:386,423 - HANDOFF-NOMINA.md:5,47 - HANDOFF-CBM-MEDIDAS.md:7 - HANDOFF-SESION-2026-06-20.md:58 - SYNC-NORTE-2026-06-14.md:97 - BRAND-DECISIONS-BD037-BD069.md:517 - design_handoff_mobile_app/CLAUDE.md:301,338 - Portal del Cliente Rediseno DTD-Cargo.html:251
- Adicionales del grep: CHANGELOG.md:275,559,565,571,1170,1172,1177,1591,1597 (el :1875 es falso positivo, excluido) - HANDOFF-MOBILE.md:9,197 - design_handoff_mobile_app/HANDOFF-MOBILE.md:9,197 - _archivo/Reporte DTD-Cargo.html:229
- Comentarios (solo comentarios, cero codigo vivo): erp/api/client.jsx:9 - erp/modules/estudio-redes.jsx:14

## Exclusiones

Nada fuera del allowlist. app/, lib/ y components/ intocables (codigo vivo). Resto del Norte intacto.

## Riesgo

El Norte se refresca por NORTE-SYNC; una sincronizacion futura puede pisar estas marcas. Las marcas se re-aplican si el sync las trae sin ellas.

## Validacion

git grep -n "backend/" en _norte/** post-tarea: cada linea del allowlist porta su marca. docs:check en verde. Diff limitado a las lineas del allowlist.
