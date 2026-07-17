---
sdd: "0158"
title: "Documentos de Marketing en el Studio — lector read-only de docs/marketing"
status: done
author: "Sam (founder) + agente adquisición"
created: 2026-07-17
updated: 2026-07-17
supersedes: null
superseded_by: null
related: ["0119", "0085"]
confidencialidad: interno
---

# DTD-0158 — Documentos de Marketing en el Studio

> **Número:** máx en `docs/specs` = 0157 → **0158 libre** (2026-07-17).

## Contexto

El sistema de adquisición generó mucha documentación en `docs/marketing/` (18 docs). Vive en git,
fuera de la vista diaria del founder → con el tiempo se olvida que existe. Decisión founder: meterla
**donde ya entra todos los días, el Studio**, como un acceso en el menú (no un archivo suelto).

## Decisión

Sub-módulo **"Documentos"** dentro del módulo Marketing (SDD-0119), en `/studio/marketing/docs`.
- **Read-only, sin base de datos:** lee los `.md` de `docs/marketing/` por `fs` y los renderiza.
- **Renderizador propio** (`lib/studio/marketing/markdown.ts`): el repo no traía motor de markdown
  y el `MarkdownLite` de noticias-web solo hace títulos/negritas — insuficiente para las tablas y
  listas de estos docs. Pure/server-safe; escapa todo el texto (sin XSS; contenido propio confiable).
- **Enlaces internos** entre docs (`[x](ventas.md)`) se vuelven clickeables dentro del lector
  (`data-doc` → cambia de documento sin navegar).
- **Prod:** los `.md` viajan en el bundle vía `outputFileTracingIncludes["/studio/marketing/docs"]`
  (mismo patrón que el hub de marca con `whatsapp-business.md`).
- **RBAC:** módulo `marketing-docs` = marketing + commercial + support (admin siempre). Registrado
  en `modules.ts` + `rbac.ts` (el test anti-drift exige ambos).
- **Acceso:** entrada en el menú lateral (grupo MARKETING) + tarjeta en el HUB de marca.

## Archivos

- `lib/studio/marketing/markdown.ts` — renderMarkdown(src, bundled) → HTML (puro).
- `lib/studio/marketing/docs-reader.ts` — getMarketingDocs() (server-only, fs).
- `app/studio/(app)/marketing/docs/page.tsx` + `_components/DocsReaderClient.tsx`.
- `lib/studio/modules.ts` · `lib/studio/rbac.ts` · `next.config.ts` · `marketing/hub/page.tsx`.

## Verificación

- `pnpm typecheck` + ESLint de los archivos tocados.
- `node node_modules/vitest/vitest.mjs run lib/studio/rbac.test.ts` (anti-drift módulo↔matriz).
- Manual: `/studio/marketing/docs` con rol admin/marketing → lista + render + enlaces internos.
