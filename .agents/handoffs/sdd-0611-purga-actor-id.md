# SDD-0611 · Purga de `actor_id` de noticias (migración 0546)

- **Owner/sesión:** Worker `0611-purga-actor-id` · rama `claude/0611-purga-actor-id-2fb0be` · worktree `.claude/worktrees/0611-purga-actor-id-2fb0be`
- **Encargo:** Director General, tras el «SI a» de Sam (2026-11-15). Spec 0611 §11.4.1 (decisión de Sam del 2026-11-14).
- **Permisos:** abrir PR lista para revisión, sin auto-merge. **No se fusiona ni se aplica nada en ningún entorno.**
- **Número:** 0546 (`node scripts/next-number.mjs` y barrido de ramas: la 0545 la tiene otra rama).

## Qué se construyó
- `supabase/migrations/0546_noticias_purga_actor_id.sql`: `news_purgar_actor_id()` (SECURITY DEFINER, `search_path` vacío,
  `lock_timeout`, solo `service_role`), marcas `actor_purged_at` y `changed_by_purged_at`, CHECK reescritos
  (`news_audit_manual_con_persona` con marca; `news_audit_purga_sin_uuid`; dos equivalentes en el log) y `changed_by` nullable.
  Frontera estricta `<` ahora − 12 meses. No borra filas.
- `supabase/desarmes/0546_desarme.sql`: para si la purga ya vació uuid.
- `supabase/tests/0546_noticias_purga_actor_id.test.sql` (sin `\ir ../desarmes`) y
  `lib/news/autopublicar/__tests__/noticias-0546.migration.test.ts` (PGlite: control rojo, preflight, 12 mutantes, desarme y vuelta,
  desarme que para tras la purga, gemela con la spec).
- `app/api/cron/noticias-purga-actor/route.ts` + test: `CRON_SECRET`, interruptor `NOTICIAS_PURGA_ACTOR_ACTIVO` (nace apagado),
  `sin_migracion` sin la 0546, respuesta solo con conteos.
- Crontab: `scripts/build-crontab.mjs` (EXTRA_CRONS) y `infra/dtd-cargo/cron/crontab` regenerado (`45 4 * * *`, 27 crons) + test.
- Espera en `supabase/migrations-baseline.json` y declaración de símbolos en `supabase/pending-migration-symbol-declarations.json`.
- `docs/runbooks/noticias-purga-actor.md` (cita la secuencia C8: `build cron` + `up -d --no-deps cron`; nunca `compose up` suelto).
- Spec 0611 §11.4.1.1 (excepción de §11.3.1 (b) vence al aplicar la purga e impacto en privacidad) y `privacidad.md`.
- `.env.example` e `infra/dtd-cargo/.env.example`: `NOTICIAS_PURGA_ACTOR_ACTIVO`.

## Hallazgos de diseño
- Ninguna de las cuatro tablas tiene disparadores de solo agregar (0518 no los creó): no hubo excepción que abrir.
- `news_autopublish_settings.updated_at` marca la edad de la fila: mientras alguien cambie el interruptor, el `updated_by` se queda.
- El brief de `sdd-0611-retencion-actor-id.md` decía «el cron de noticias de esa misma PR» y «nada de app/**»; no existe ese cron
  en `main`. Por orden del DG la ruta de la purga va aquí. Si el cron de noticias llega en otra PR, sigue siendo independiente.

## Validación
PASÓ: vitest focal (noticias-0546, ruta de cron, build-crontab, spec-migration-refs), eslint y tsc sobre lo nuevo, docs:check, sdd:check, build-crontab --check, gate de símbolos (0 rojo, 1 amarillo declarado). NO EJECUTADO: pnpm verify. PR 595.

## Pendientes de esta tarea
- Aplicar la 0546 en prueba y producción (OK nominal de Sam + runbook de producción), retirar su espera después.
- Reconstruir la imagen `cron` (C8) y encender `NOTICIAS_PURGA_ACTOR_ACTIVO=1`: último paso, con OK de Sam.

## FUERA DE ALCANCE DETECTADO
- (ninguno por ahora)

## Impacto documental
Actualizados: spec 0611 §11.4.1.1, `privacidad.md`, runbook nuevo `noticias-purga-actor.md`. Sin otros documentos canónicos afectados.
