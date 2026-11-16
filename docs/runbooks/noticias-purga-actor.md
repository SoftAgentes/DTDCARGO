# Purga de `actor_id` de noticias (SDD-0611 §11.4.1)

Vacía el uuid de la persona del equipo en las cuatro columnas de noticias cuando la fila tiene **más de 12 meses**
(decisión de Sam, 2026-11-14). Se conserva qué pasó y cuándo, sin quién. No borra filas.

| Pieza | Dónde |
|---|---|
| Migración (sin aplicar) | `supabase/migrations/0546_noticias_purga_actor_id.sql` |
| Desarme | `supabase/desarmes/0546_desarme.sql` (lo ya vaciado no vuelve) |
| Contrato SQL y PGlite | `supabase/tests/0546_noticias_purga_actor_id.test.sql`, `lib/news/autopublicar/__tests__/noticias-0546.migration.test.ts` |
| Ruta del cron | `app/api/cron/noticias-purga-actor/route.ts` |
| Línea del crontab | `infra/dtd-cargo/cron/crontab`: `45 4 * * *` (diaria, 04:45 UTC), generada por `scripts/build-crontab.mjs` |
| Interruptor | `NOTICIAS_PURGA_ACTOR_ACTIVO` (nace vacío = apagado; solo `1` o `true` enciende) |

Las cuatro columnas y su edad: `news_post_exits.actor_id` (`created_at`), `news_publication_audit.actor_id`
(`evaluated_at`), `news_autopublish_settings_log.changed_by` (`changed_at`) y `news_autopublish_settings.updated_by`
(`updated_at`). Frontera estricta: una fila de exactamente 12 meses no se toca todavía.

## Orden (todo lo hace Sam o con su OK nominal)

1. **Aplicar la 0546** con [aplicar-migraciones-prod.md](aplicar-migraciones-prod.md): primero prueba y luego producción
   (migrate-first), con `name` exacto `0546_noticias_purga_actor_id`. Requiere OK de Sam nombrando el archivo. Fusionar la PR
   **no** la aplica. Antes de aplicar, retirar su espera del baseline solo después de verificar.
2. **El crontab no se toma solo.** `infra/dtd-cargo/cron/Dockerfile` lo copia dentro de la imagen del contenedor `cron`:
   secuencia **C8** de [publicacion-automatica-web.md](publicacion-automatica-web.md). Copiar `cron/` del repo a
   `/srv/dtd-cargo/`, luego
   `docker compose -p dtd-cargo -f compose.yml -f compose.supabase.yml build cron` y
   `docker compose -p dtd-cargo -f compose.yml -f compose.supabase.yml up -d --no-deps cron`.
   **Está prohibido un `compose up` suelto.** Sin esto la línea nueva no corre.
3. **Encender**: copia previa del `.env` (`.env.bak-purga-<ts>`), poner `NOTICIAS_PURGA_ACTOR_ACTIVO=1` y recrear el `web`.
   Es lo último y lleva OK de Sam. La purga es privacidad: corre aunque `news_autopublish` esté apagado.

La purga tiene que estar **aplicada antes de encender la publicación automática** (§11.4.1, punto 2).

## Qué revisar tras encender

- La primera corrida responde `{"ok":true,"estado":"ok","vaciadas":{…}}` con **conteos**; nunca uuid. Una segunda corrida
  seguida da ceros (idempotente).
- Con la 0546 sin aplicar, la ruta responde `sin_migracion` y no rompe; apagada, `apagado` y no toca la base.
- `news_post_exits`, `news_publication_audit`, `news_autopublish_settings_log`: el número de filas no baja (solo se vacía el uuid).
- Una fila de la auditoría vaciada trae `actor_id` nulo y `actor_purged_at` con fecha.

## Apagar y deshacer

- Apagar: vaciar `NOTICIAS_PURGA_ACTOR_ACTIVO` y recrear el `web`. No pierde nada.
- Deshacer la migración: copiar `supabase/desarmes/0546_desarme.sql` a `supabase/migrations/` con el siguiente número libre,
  con OK de Sam. Para con un mensaje si la purga ya vació algún uuid.
