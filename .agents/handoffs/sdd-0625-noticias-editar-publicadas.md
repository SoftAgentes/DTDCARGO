# Handoff · SDD-0625 — Corregir, retirar y volver a publicar noticias desde el Studio

- **Owner / sesión:** Worker Claude, `local_d679d6ad` (iniciada por el Director General `local_25e2dded`).
- **Ruta:** `.claude/worktrees/upbeat-sutherland-4cb3a5` · **rama:** `claude/noticias-editar-studio-75790c`.
- **Base:** `origin/main` `b63de1527` (PR #505).
- **SDD:** `docs/specs/0625-noticias-editar-publicadas/spec.md` (reserva `refs/heads/codex/sdd-reserve-0625`, commit `0b17009fd`).
- **Migración:** `0532_noticias_edicion_auditada.sql`, **SIN APLICAR**, declarada como espera en `migrations-baseline.json`.

## OBJETIVO ORIGINAL

Un admin del Studio puede editar y retirar noticias ya publicadas desde Studio › Marketing › Noticias web:
lista «Publicadas», editar titular, bajada, cuerpo, categoría y SEO con vista previa, retirar con
motivo (§4.11 de la 0611) y volver a publicar. El slug no cambia. Caso real: una noticia dice 30 días y
el FCL tarda de 45 a 55; **no se tocaron datos de producción**: Sam corrige desde la pantalla nueva.

## COMPLETADO

- Pestañas «Nueva noticia» / «Publicadas» (rutas, no estado).
- `/studio/marketing/noticias-web/publicadas`: tablas Publicadas (titular, fecha, categoría, estado,
  «Ver», «Corregir», «Retirar») y Retiradas (desde `news_post_exits`, con motivo o «Motivo pendiente»,
  «Volver a publicar»).
- `/publicadas/[id]`: formulario controlado con vista previa (MarkdownLite), aviso de marcas, slug fijo.
- `/retirar/[id]`: la pantalla que ya enlaza el aviso de `#noticias` (`lib/studio/news/autopublicar.ts`).
- Actions (`publicadas/actions.ts`): `tenantAdminGate` (admin activo), columnas permitidas exactas,
  marcas `[VERIFICAR` bloquean guardar, categoría dentro del mismo tipo, errores de Postgres traducidos,
  `revalidatePath` de `/noticias`, `/noticias/<slug>`, `/sitemap.xml` y la lista.
- **Gate verificado:** la pantalla actual exige `role === "admin"` + flag `marketing_news` +
  `requireModuleView("noticias-web")`; las actions de publicar usan `tenantAdminGate`. Se reutiliza igual.
- **RLS/policies:** sin cambios. La edición usa `news_posts_admin_update` (0055); retiro y vuelta, las
  funciones de 0518 (en producción desde 2026-11-08). anon no gana nada.
- Migración 0532: tipo de entidad `news_post` + disparador `audit_news_posts` (AFTER UPDATE) con el writer
  AUD-01 en la misma transacción; huellas y columnas cambiadas, **sin copiar texto**. Migrate-first
  compatible: sin ella todo funciona, solo falta la fila de quién y cuándo.
- **Revalidación pública:** no se tocó `app/noticias/**` ni `app/sitemap.ts` (ISR 300 s). La pantalla dice
  «hasta 5 minutos»; `revalidatePath` acelera si Studio y sitio comparten despliegue.

## VALIDACIÓN

| Comprobación | Estado |
|---|---|
| `vitest` actions (`noticias-publicadas-actions.test.ts`, 23) + tests previos de la carpeta | PASÓ (40/40) |
| `vitest` contrato 0532 en PGlite (contrato, control rojo, preflight doble, 7 mutantes, espera declarada) | PASÓ (12/12) |
| `tsc --noEmit -p .` | PASÓ |
| ESLint sobre los archivos tocados | PASÓ |
| `check-rsc-boundary`, `check-numbering`, `check-pending-migration-symbols` (0 ROJO · 0 AMARILLO) | PASÓ |
| `docs:check`, `components:check`, `governance:check` | PASÓ |
| `/ui-check` | OK con ajustes menores; #1 (tabs → `aria-pressed`) y #2 (separar «Retirar») aplicados; #3-#4 bajos, sin cambio |
| `pnpm verify` completo | NO EJECUTADO al momento del handoff: pedido el turno al Director (una corrida pesada a la vez); el CI de la PR es el portón |
| Smoke visual en navegador (login admin, Supabase local) | NO EJECUTADO: requiere Studio con sesión y datos; queda para el smoke del Director/Sam |
| `run-sql-tests` contra Postgres real (Docker) | NO EJECUTADO localmente (lo cubre PGlite; el CI lo corre) |

## COMMITS

Ver `git log origin/main..HEAD` en la rama (spec, migración + contrato, Studio + pruebas, handoff).

## PR / BRANCH

PR contra `main`, no draft. No fusionar ni aplicar 0532 sin el OK nominal de Sam.

## PENDIENTES DE ESTA TAREA

- `pnpm verify` con turno, o CI verde de la PR.
- Smoke en Preview/prueba: entrar como admin, corregir una noticia, retirar con motivo, volver a publicar,
  y comprobar `/noticias/<slug>` a los ≤ 5 min. **Ojo: Preview comparte Supabase con producción** (memoria
  del proyecto): el smoke sobre Preview escribe en producción; hacerlo en el entorno de prueba o con OK.
- Aplicar 0532 (Director General, OK nominal de Sam, runbook). Orden con la 0526 (#507): independientes;
  ambas agregan una línea en `pendingBelowCutoff` → conflicto textual trivial al integrar la segunda.

## FUERA DE ALCANCE DETECTADO

1. Editar una noticia **retirada** pide una policy SELECT para admin sobre `news_posts` (hoy la 0055 solo
   deja ver publicadas, también al admin). No se agregó.
2. `publishPost` (INSERT) no deja evento AUD-01; la 0532 audita solo UPDATE.
3. Cambiar el slug con redirección 301: otra SDD.
4. La página del generador (`page.tsx`) lee `user_tenants` sin `disabled_at` para su redirect (la action sí
   usa `tenantAdminGate`); las páginas nuevas usan `tenantAdminGate`.

## HANDOFF AL DIRECTOR

- Revisar PR; la 0532 es la única migración y nace sin aplicar.
- Impacto documental: spec nueva + índice `docs/specs/README.md` regenerado. Graphify/Archify: no
  ejecutados en esta tarea (sin cambios en fuentes del piloto semántico); pendiente global habitual al
  integrar.
