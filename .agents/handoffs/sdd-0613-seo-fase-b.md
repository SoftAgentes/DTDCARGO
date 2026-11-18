# Handoff — SDD-0613 · SEO, GEO y AEO: fase B (diseño)

Fecha: 2026-11-06. Task ID: `sdd-0613-seo-fase-b`.
Owner / sesión escritora: `claude-seo-fase-b` (Worker Claude Code; la misma sesión de las SDD-0605 y
0607).

Estado de la tarea: **lista para revisión, con PR en borrador contra `main`.**

- **Worktree:** `DTD-worktrees/seo-fase-b`, sin `node_modules`.
- **Rama:** `codex/seo-fase-b`, desde `main` `3d17292a4`.
- **SDD:** `docs/specs/0613-seo-fase-b/spec.md`, estado `proposed`. Reservada con
  `sdd:next --reserve`: rama `codex/sdd-reserve-0613-seo-fase-b` y ref `refs/dtd/reservations/0613`,
  solo locales. El inventario daba del 0603 al 0612 tomados.
- **Permisos:** el encargo de la sesión coordinadora autoriza publicar esta rama y abrir la PR en
  borrador; no autoriza fusionarla. Sin código, sin migraciones numeradas.

## OBJETIVO ORIGINAL

Diseñar la fase B de SEO como seguimiento de la SDD-0604, con prioridades medidas y no supuestas,
encajada con la SDD-0611 y la SDD-0610, separando lo medido de lo inferido y de lo que solo se
puede medir con Search Console.

## COMPLETADO

- Spec SDD-0613 con la medición (§1), seis prioridades (§2), el diseño de las tres primeras (§3),
  dependencias, allowlist y criterios.
- **Las tres prioridades:**
  1. **Revisión en el servidor:** el bloqueo por `[VERIFICAR]` y por menos de 400 palabras solo vive
     en el navegador (`Step3Article.tsx`); `publishPost` no lo comprueba. Es la dependencia de la
     0611.
  2. **Search Console entra al Studio:** sin esos datos no se mide nada de lo que importa.
  3. **Contenido que falta, medido:** tres ideas aprobadas sin página, dos respuestas parciales y
     una frase de prioridad 5 («cómo invertir en china») sin ninguna página.
- **Lo que la medición descartó:** títulos, descripciones, canónicos y sitemap están completos en
  las 27 páginas indexables; 18 de las 20 preguntas del CRM ya tienen respuesta.

## Cómo se midió

Un script de Node de solo lectura, sin red, que no se versiona (`medir-seo.mjs`, en el scratchpad
de la sesión). Recorre `app/**/page.tsx` fuera de las rutas privadas, busca `metadata` o
`generateMetadata`, `title`, `description`, `canonical`, `noindex` y componentes de JSON-LD, y lo
cruza con las URL de `app/sitemap.ts`. Las palabras clave se contaron como frase exacta, sin
tildes, en `app/` público, `lib/servicios-detalle.ts`, `lib/faqs.ts`, `lib/geo-zonas.ts` y el
glosario. El cruce de las 20 preguntas del CRM con las 42 FAQ fue **por lectura**, no por script.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| `node scripts/build-docs-index.mjs` y `--check` (`pnpm docs:index`, `pnpm docs:check`) | PASÓ |
| `node scripts/check-numbering.mjs` (`pnpm sdd:check`) | PASÓ |
| `git diff --check` y diff contra la allowlist | PASÓ |
| `pnpm verify` | NO EJECUTADO, no aplica: solo documento |
| Datos de Search Console y de la base | NO DISPONIBLE: no entran todavía; están marcados «sin datos» en la spec |

## COMMITS

1. `chore(sdd)`: stub de la reserva 0613.
2. El commit que contiene este documento: spec, índice y handoff.

## PR / BRANCH

- Rama `codex/seo-fase-b`, base `main` `3d17292a4`. PR en borrador; el número queda en la PR.

## PENDIENTES DE ESTA TAREA

- [ ] Revisión del Director General y de Sam.
- [ ] Número y OK nominal de la migración sin número, cuando se implemente.

## FUERA DE ALCANCE DETECTADO

1. **`docs/marketing/seo.md` cita `/calculadora` y `/track` con `WebPageJsonLd`**: esas rutas ya
   redirigen a `/tarifas` y `/entrar`. Es la prioridad P4 de la spec; no se corrigió aquí.
2. **`docs/marketing/agente-seo-noticias.md` dice «Publicar lo aprueba una persona»**, que la
   SDD-0611 cambió para `/noticias`. Se corrige al integrar la 0611; también es el pendiente de
   alinearlo con el esquema mixto.
3. **El histórico de tarifas FCL se sobrescribe** (`upsert` por ruta), según
   `docs/marketing/seo-aeo-preguntas-crm.md`. La idea del precio semanal necesita otra SDD.

## HANDOFF AL DIRECTOR

- **Orden:** esta SDD encaja detrás de la 0610 (#388) y la 0611 (#389); P1 usa los estados de la
  0611 y P2 la puerta de la 0610.
- **Migración:** propuesta sin número; la numera el Director General.
- **Sin código, sin textos públicos, sin variables.** No se tocó producción.
- **Reserva 0613:** las dos refs locales se pueden borrar cuando la spec esté en `main`.
- **Ownership:** claim liberado al cerrar.
