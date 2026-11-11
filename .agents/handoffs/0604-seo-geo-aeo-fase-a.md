# Handoff — SDD-0604 · SEO, GEO y AEO: fase A

Fecha: 2026-11-05. Worker: Claude Code, sesión del worktree `seo-geo-aeo-691c7b`. Sin subagentes escritores.

Estado: **commit local, sin publicar**. No hay PR. Sam no ha autorizado publicar la rama.

- **Worktree:** `.claude/worktrees/seo-geo-aeo-691c7b`, creado por la aplicación de escritorio, no con `harness-worktree`. No se tomó claim con ese script.
- **Rama:** `claude/seo-geo-aeo-691c7b`, nacida de `1aafa150e` (main del 2026-11-05).
- **SDD:** `docs/specs/0604-seo-geo-aeo-fase-a/spec.md`, `in-progress`. El número salió de `pnpm sdd:next` («spec siguiente: 0604»). **No se reservó con `--reserve`**: antes de publicar hay que comprobar que ninguna otra rama tomó el 0604.

## OBJETIVO ORIGINAL

Sam, 2026-11-05: trabajo de «SEO, GEO y AEO». Aprobó un plan mayor (agente de noticias, departamento de marketing en la oficina, Discord) y eligió empezar por las mejoras estáticas del sitio público. Esta tarea es solo esa fase.

## COMPLETADO

- `public/llms.txt`: sin razón social, RIF ni representante legal; 2015 como fundación; «puerta a puerta (DDP)»; sin hablar de seguimiento de envíos; enlace a la versión ampliada.
- `/llms-full.txt` (`app/llms-full.txt/route.ts`, `lib/public/llms-full.ts`): servicios ofrecibles, FAQ y glosario desde el código. Sin precios.
- `app/robots.ts`: más agentes de IA nombrados. No cambia el acceso; `*` ya permitía.
- `app/sitemap.ts`: entran `/privacidad` y `/cookies`; los posts usan `updated_at`.
- `app/__tests__/sitemap-cobertura-contract.test.ts`: ignora comentarios. Era la causa de que esas dos páginas no se auditaran.
- IndexNow: clave en `public/` y `scripts/indexnow-enviar.mjs`, que por defecto no envía.
- `lib/news/prompts.ts`: sin la promesa de FAQPage automático.
- `docs/marketing/seo.md`, `docs/marketing/agente-seo-noticias.md` y `docs/marketing/README.md`.

## EVIDENCIA

| Comprobación | Resultado |
|---|---|
| Pruebas enfocadas (5 archivos, 35 pruebas) | PASÓ |
| Mutante: quitar `/privacidad` del sitemap | El contrato de cobertura se pone ROJO y nombra la ruta |
| `tsc --noEmit` y ESLint de los archivos tocados | PASÓ, sin salida |
| `pnpm docs:index` y `pnpm sdd:check` | PASÓ |
| `pnpm verify` | exit 0, **CIERRE INCOMPLETO**: 14 de 17 pasos. Build PASÓ |
| `migrations-applied`, `sql-tests`, `schema-rebuild` | NO EJECUTADO (SKIP del propio verify). La tarea no toca base de datos ni migraciones |
| Rich Results Test | NO EJECUTADO. No se cambió ningún JSON-LD |
| `/llms-full.txt` servida por el build | NO EJECUTADO en navegador; solo la prueba de `buildLlmsFull` |

Política IA-01: no aplica, esta fase no ejecuta IA.

## PENDIENTE DE ESTA TAREA

- Autorización de Sam para publicar la rama y abrir la PR.
- Comprobar el número 0604 contra las ramas remotas antes de publicar.
- Después de llegar a producción: `node scripts/indexnow-enviar.mjs --enviar`.
- `docs/marketing/agente-seo-noticias.md` describe el diseño anterior (todo en el Studio, aprobación humana, Telegram). Sam cambió después a esquema mixto con la oficina, publicación automática con filtros y Discord. Hay que actualizarlo cuando exista la SDD de la reestructura.

## FUERA DE ALCANCE DETECTADO

- `app/back/(app)/_components/BackSidebar.tsx` enlaza `/back/noticias`, que ya no existe.
- `/noticias` lee Supabase con la clave anónima (`lib/public/news-queries.ts`), declarado como excepción editorial frente a la regla público ↔ ERP.
- `publishPost` no aplica en el servidor el bloqueo por `[VERIFICAR]`; solo lo hace el navegador.
- Cabecera de `app/noticias/[slug]/opengraph-image.tsx` desactualizada (dice que `getPostBySlug` usa cookies).
- VPS de la oficina: reinicio pendiente; Paperclip una versión atrás.
