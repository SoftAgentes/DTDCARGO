---
title: "Onboarding — empezá acá en 5 minutos"
type: explanation
status: vigente
owner: "founder"
updated: 2026-05-29
review-by: 2026-08-29
confidencialidad: interno
---

# Empezá acá (5 min) — cómo está organizado este repo

> Para un dev nuevo **o una sesión nueva de Claude**. Si leés esto + `/CLAUDE.md`, ya sabés dónde vive todo.

## 1. Son 4 productos en un solo Next.js

| Superficie | Qué es | Dónde | Backend |
|---|---|---|---|
| **Sitio público** | dtdcargo.com (marketing + tracking) | `app/{cotizar,track,contacto,calculadora,servicios,noticias,glosario}` + `components/` | HTTP al ERP externo · tracking lee un RPC anon de Supabase |
| **Studio ERP** | operación interna "DoorTuDoor" | `app/studio/(app)/<modulo>/` | Supabase (`@/lib/db`) |
| **Móvil PWA** | apps de operario (almacén/camionero) | `app/m/{cn,ve,erp}/` | Supabase (reusa `lib/studio`) |
| **Back** | CMS del contenido del sitio público | `app/back/(app)/` | Supabase (`lib/back/`) |

**Frontera dura (forzada por ESLint):** el sitio público NUNCA importa código del ERP
(`@/lib/studio`, `@/lib/db`, `@/app/studio`). Único puente: `@/lib/shared/*`.

## 2. Cómo arranco una feature

1. ¿Necesita spec? Sí (regla: no hay código sin spec). Copiá `docs/specs/_template/` → `docs/specs/NNNN-slug/`.
2. ¿Es del Studio? `app/studio/(app)/<modulo>/`: `page.tsx` + `actions.ts` (`"use server"`) + `_components/`.
   Queries → `lib/studio/<entidad>-queries.ts` · tipos → `lib/studio/<entidad>-types.ts`.
3. ¿Visual? Mira el handoff en `docs/design/studio/_norte/` antes de inventar.
4. ¿Dónde va cada cosa? → [`docs/README.md`](../README.md) (tabla "dónde va X") + `/CLAUDE.md` (árbol de decisión de código).

## 3. Mapa "qué módulo es qué SDD"
→ [`module-sdd-map.md`](./module-sdd-map.md). Índice de specs con estado → [`docs/specs/README.md`](../specs/README.md).

## 4. Reglas que no se rompen
- Marca/visual: leer `/BRAND.md` antes de tocar colores/tipografía/componentes.
- Adjuntos: doc → `assets/` al lado; runtime (fotos/recibos) → Supabase Storage `{tenant_id}/...`, nunca en git.
- Confidencial (PII, contratos, financieros): nunca en git.
- Validar docs: `pnpm docs:check`. Regenerar índice: `pnpm docs:index`.

## 5. Comandos
`pnpm dev` · `pnpm typecheck` · `pnpm build` · `pnpm lint` · `pnpm test` · `pnpm docs:check`
(Si `pnpm <x>` falla con `ERR_PNPM_IGNORED_BUILDS`: correr `node node_modules/<bin>` directo.)
