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

- Next 16.2.11, `sharp` 0.35.3, Vitest 4.1.7 y Node 24.22.1 tienen avisos públicos de seguridad que se corrigen subiendo de versión. La spec lista los GHSA y su versión corregida.
- La aplicabilidad a nuestra configuración se analizó y se reportó al DG. El detalle vive fuera de este repo público, porque un hueco abierto no va a Git público (revisión del DG del 2026-11-17).
- Se propone la oleada **A1 urgente**: Next 16.4.6, `sharp` 0.35.5, Node 24.22.3 y Vitest 4.1.12.

## Ronda de revisión del DG (2026-11-17, sobre a28a823ec)

- B1: se redujeron la §2, la conclusión, D1 a D3 y este handoff a la lista pública de avisos. El análisis quedó en una nota del buzón del repo privado. El commit 46deba7db y el cuerpo original de la PR #635 ya contenían el detalle; reescribir la historia lo decide Sam.
- Menores:
  - Se agregó `chatwoot-portal-poc.yml:65` a la A1.
  - Se documentó el origen del override de `sharp` (`b1aa30d99`, SDD-0224).
  - Se agregó GHSA-qxg6-89mg-rqv8.
  - Se quitaron los conteos de archivos.
  - Se agregaron D9, D10 y D11.
  - La clasificación del aviso de SVG («posible, no descartable», inferencia) está en la nota privada.

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

- Sam contesta D1 a D11.
- La revisión independiente la lanza el DG.

## Fuera de alcance detectado

- Leer el boletín de seguridad de Node 24.22.3 (nodejs.org/en/blog/vulnerability) para saber qué cubre.
- Medir qué hosts de imágenes remotas siguen usando las noticias publicadas. Es la condición de D3.

## Impacto documental

- Spec nueva y fila nueva en el índice. No se actualizó ningún documento canónico.

## Cierre de la fase de análisis (2026-11-17)

- Sam aceptó D3 a D8 con sus recomendaciones. En el chat del DG contestó «Sí, las 6».
- D1, D2, D9, D10 y D11 quedaron resueltas con la A1.
- Oleadas hechas y fusionadas: A1 (#636), Node en Chatwoot (#639), A2 (#643) y `agentRules` (#644).
- La spec pasa a `in-progress`: siguen la oleada B y la C.
- La prueba de D7 (`@supabase/ssr`) no se hace sin que el DG coordine el servidor de prueba y a Sam.
