# Handoff: SDD-0656 — análisis y plan para actualizar el stack

- **Owner:** Claude Worker (sesión `sdd-0656-worker`), encargado por el DG.
- **Ruta:** `.claude/worktrees/0656-actualizar-stack-1db9d6`
- **Rama:** `claude/0656-actualizar-stack-1db9d6`, con base en `origin/main` `3f496f3de`.
- **Objetivo:** contestar la pregunta de Sam («¿cuándo actualizamos el stack y qué más hay que llevar a la última versión?») con un inventario, los riesgos, los avisos de seguridad y un plan por oleadas. Solo análisis.
- **SDD:** `docs/specs/0656-actualizar-stack/spec.md` (`proposed`).
- **Permisos:** publicar la rama y abrir la PR en borrador. No fusionar. No tocar `package.json`, el lockfile ni producción.

## Completado

- La spec trae el inventario, 11 avisos de Next más 2 de `sharp` y 1 de Vitest, con su aplicabilidad; el riesgo de cada salto con `archivo:línea`; las oleadas A1, A2, B y C; cuándo hacerlo; y las decisiones D1 a D8.
- Se regeneró el índice `docs/specs/README.md`.

## Hallazgo principal

- Producción corre con Next 16.2.11, y nos aplican dos RCE críticas de la Image Optimization (GHSA-2464-fhr4-w9xw, por SVG, y GHSA-2xp9-vwfh-vxw4, por AVIF), una DoS alta de Server Actions (GHSA-p3m5-59mp-jv5r) y, probablemente, una SSRF alta (GHSA-cjq9-62q9-8jv4).
- El override `sharp: 0.35.3` de `pnpm-workspace.yaml:22` bloquea la corrección aunque se suba Next.
- Por eso se propone la oleada **A1 urgente**: Next 16.4.6, `sharp` 0.35.5, Node 24.22.3 y Vitest 4.1.12.

## Validación

| Comprobación | Resultado |
|---|---|
| `node scripts/build-docs-index.mjs --check` | PASÓ |
| `node scripts/check-numbering.mjs` | PASÓ, sin números repetidos |
| `git diff --check` | PASÓ |
| `pnpm verify` | NO EJECUTADO (no aplica: el cambio es solo de docs, y el encargo lo prohíbe en esta fase) |
| `pnpm audit` / `pnpm outdated` | NO EJECUTADO (lo prohíbe el encargo); las dependencias transitivas quedan sin medir |

## Fuentes

- Versiones: `npm view` y `registry.npmjs.org`, consultados el 2026-11-17.
- Avisos: `gh api advisories?ecosystem=npm&affects=…`.
- Node: `nodejs.org/dist/index.json`.
- Changelogs: los oficiales que enlaza la spec. Vitest, ESLint, TypeScript, pnpm, jsdom, React, el SDK de Anthropic y Uppy los resumió un subagente, y se verificaron contra el código los usos que cita la spec.

## Pendientes de esta tarea

- Sam contesta D1 a D8.
- La revisión independiente la lanza el DG.

## Fuera de alcance detectado

- Leer el boletín de seguridad de Node 24.22.3 (nodejs.org/en/blog/vulnerability) para saber qué cubre.
- Medir si alguna noticia publicada sigue sirviendo imágenes desde `*.supabase.co`. Es la condición de D3.

## Impacto documental

- Spec nueva y fila nueva en el índice. No se actualizó ningún documento canónico.
