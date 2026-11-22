---
sdd: "0685"
title: Marcar como históricas las referencias al back Norte en el prototipo
status: in-progress
author: Sam
created: 2026-11-19
updated: 2026-11-22
supersedes: null
superseded_by: null
related: ["0603", "0632"]
confidencialidad: interna
---

# SDD-0685 — Marcar como históricas las referencias al back Norte en el prototipo

Reservada el 2026-11-19 (stub); retomada y ejecutada el 2026-11-22 tras el merge de la PR #706 («poda normativa y retiro del back Norte», fusionada el 2026-11-19), que eliminó la carpeta `docs/design/studio/_norte/backend/`.

## Contexto

El «back Norte» (`_norte/backend/`: `README.md`, `API-CONTRACT.md`, `prisma/schema.prisma`) era la guía de backend de la primera etapa. El backend real es Supabase y su norma vive en `docs/engineering/project-rules.md` §Patrones del Studio ERP. La #706 retiró la carpeta y las menciones normativas (AGENTS, project-rules), pero el prototipo `docs/design/studio/_norte/**` conserva decenas de instrucciones vivas del tipo «ver `backend/API-CONTRACT.md`» que apuntan a archivos que ya no existen y suenan vigentes.

## Alcance

Insertar, en cada instrucción viva que apunta a `backend/…` dentro de `docs/design/studio/_norte/**`, la nota exacta:

`[historico: el backend real es Supabase; ver docs/engineering/project-rules.md seccion Patrones del Studio]`

colocada justo después de la última referencia `backend/…` de la línea. Ni reescrituras ni borrados: el texto original queda intacto; solo se inserta la marca.

**Lo que no se marca como histórico** (sigue vigente): el Norte como prototipo de diseño y su orden de lectura CLAUDE → HANDOFF → CHANGELOG (AGENTS.md §Fronteras críticas); la mención «backend/próximo» de `CHANGELOG.md:1875` (falsa positiva: no apunta a la carpeta).

## Lista de archivos (31 líneas en 15 archivos; todos bajo `docs/design/studio/_norte/`)

Líneas verificadas con `git grep -n "backend/"` sobre `b0218800c` (las de CLAUDE.md se corrieron 7 líneas desde el stub, de 386/423 a 393/430, por ediciones posteriores):

| Archivo | Líneas |
|---|---|
| `HANDOFF.md` | 11, 105, 123, 210 |
| `CLAUDE.md` | 393, 430 |
| `HANDOFF-NOMINA.md` | 5, 47 |
| `HANDOFF-CBM-MEDIDAS.md` | 7 |
| `HANDOFF-SESION-2026-06-20.md` | 58 |
| `SYNC-NORTE-2026-06-14.md` | 97 |
| `BRAND-DECISIONS-BD037-BD069.md` | 517 |
| `design_handoff_mobile_app/CLAUDE.md` | 301, 338 |
| `Portal del Cliente · Rediseño · DTD-Cargo.html` | 251 |
| `CHANGELOG.md` | 275, 559, 565, 571, 1170, 1172, 1177, 1591, 1597 |
| `HANDOFF-MOBILE.md` | 9, 197 |
| `design_handoff_mobile_app/HANDOFF-MOBILE.md` | 9, 197 |
| `_archivo/Reporte DTD-Cargo.html` | 229 |
| `erp/api/client.jsx` | 9 (solo comentario) |
| `erp/modules/estudio-redes.jsx` | 14 (solo comentario) |

## Exclusiones

- Nada fuera de la lista. `app/`, `lib/` y `components/` intocables (código vivo); en los dos `.jsx` solo cambian líneas de comentario.
- `docs/specs/**`, `.agents/handoffs/**` y `docs/archive/**`: son evidencia fechada y quedan intactos (SDD-0632 / AGENTS.md §Lecturas 4). Sus citas a `_norte/backend/` ya son históricas por naturaleza.
- `.gitignore:154` (`_norte/backend/prisma/`): regla de ignore deliberada (corregida en la #707), no es una referencia viva.

## Riesgo

El Norte se refresca por NORTE-SYNC; una sincronización futura puede pisar estas marcas. Se re-aplican si el sync las trae sin ellas.

## Criterios de aceptación

1. `git grep -n "backend/" -- docs/design/studio/_norte` : toda línea de la lista porta la marca (excepto la falsa positiva de `CHANGELOG.md:1875`). **Cumplido:** 31/31.
2. El diff son solo inserciones dentro de las 31 líneas: al quitar la marca de cada línea nueva se obtiene exactamente la línea original. **Cumplido:** 0 anomalías.
3. `git diff --check` limpio; no cambia ningún archivo fuera de `docs/design/studio/_norte/**` salvo esta spec y el handoff.
4. `pnpm docs:check` y `pnpm sdd:check` en verde.

## Validación

Ver el handoff `.agents/handoffs/sdd-0685-norte-historico.md`.
