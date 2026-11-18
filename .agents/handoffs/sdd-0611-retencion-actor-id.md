# SDD-0611 · Retención de `actor_id` cerrada (2026-11-14)

Solo documentos. Cierra la decisión abierta de §11.4.1 de
`docs/specs/0611-noticias-publicacion-automatica/spec.md`.

## Qué decidió Sam
Respuestas en la pantalla del Subdirector SEO, relatadas al Director General (que las
reconfirma). Opciones elegidas, textualmente: «12 meses (Recomendado)»; «Sí, las 4 columnas
(Recomendado)»; «Vaciar solo el uuid (Recomendado)»; «En la PR del cron de noticias
(Recomendado)».

## Qué cambió
- §11.4.1 pasa de «decisión abierta» a «cerrada», con las opciones y las 5 condiciones antes de
  encender (purga existe, aplicada con OK nominal, columnas con `NULL`, contrato SQL con mutante,
  encendido al final).
- §11.3.1 (b): la excepción temporal vence cuando la purga esté aplicada.
- Punto 6 de «Abiertas»: decidido; falta construir y aplicar la purga.
- `updated:` 2026-11-14.

## Pendiente de esta tarea
- Migración de purga (migrate-first, OK nominal de Sam para aplicarla, la pide el Director
  General) y su contrato SQL. No está en esta PR.

## FUERA DE ALCANCE DETECTADO
- SDD-0612 D3 «Con título» y SDD-0610 D3 «Modelo de lenguaje» y D7 «Solo sumarla» no son la
  recomendación de sus specs fusionadas; el Director General los reconfirma con Sam.

## Impacto documental
Allowlist: `docs/specs/0611-noticias-publicacion-automatica/spec.md` y `privacidad.md` (modificados) y
este handoff (nuevo). Sin código, sin migraciones. Verificado: `docs:check` y `sdd:check` PASÓ.
No corrí verify ni vitest.

## Brief del Worker: migración de purga (no la programa el Subdirector)
- **Rama y worktree propios, los de la PR del cron de noticias**, como dijo Sam («En la PR del cron de
  noticias»): la purga va en esa PR (el Worker del cron la incluye). Si esa PR aún no existe, el
  Director General decide dónde abrirla; no se reinterpreta la decisión. Opus (toca DB y datos personales).
- **Número:** el que dé `pnpm sdd:next` al empezar. Verifica ramas y `refs/dtd/reservations`.
- **Archivos exactos (allowlist), según el precedente de §11.4.2:**
  `supabase/migrations/05NN_noticias_purga_actor_id.sql`;
  `supabase/tests/05NN_noticias_purga_actor_id.test.sql` (contrato SQL);
  `lib/news/autopublicar/__tests__/noticias-05NN.migration.test.ts` (el contrato en PGlite, con el
  control rojo y los mutantes; junto a `noticias-0518.migration.test.ts` y
  `lib/news/__tests__/noticias-0532.migration.test.ts`);
  `supabase/migrations-baseline.json` (espera en `pendingBelowCutoff`);
  spec 0611 §11.4 (la purga ya existe, `updated:`); handoff propio. Nada de `app/**`.
- **Qué hace:** a los 12 meses de la fila, pone en `NULL` `news_post_exits.actor_id`,
  `news_publication_audit.actor_id`, `news_autopublish_settings.updated_by` y
  `news_autopublish_settings_log.changed_by`. Conserva el resto de la fila (qué y cuándo).
  Reloj por tabla: `created_at` en `news_post_exits`, `evaluated_at` en `news_publication_audit`,
  `updated_at` en `news_autopublish_settings`, `changed_at` en `news_autopublish_settings_log`.
  La frontera es **estricta: más de 12 meses** (reloj `<` ahora menos 12 meses); una fila de
  exactamente 12 meses no se toca todavía.
  Función `SECURITY DEFINER` con `search_path` fijado; `revoke execute … from public, anon,
  authenticated` (patrón de 0518:853-861); la llama el cron de noticias de esa misma PR.
- **Dos bloqueos que el Worker debe resolver (medidos en 0518):**
  1. `news_autopublish_settings_log.changed_by` es `NOT NULL`: hay que hacerlo nullable.
  2. `news_publication_audit` tiene `news_audit_manual_con_persona`
     (`via = 'automatica' or actor_id is not null`): vaciar `actor_id` en filas manuales lo viola.
     Reescribirla para permitir `actor_id` nulo solo si la fila fue purgada, con una columna de marca
     (p. ej. `actor_purgado_at`). No se usa una ventana de edad en un CHECK: un CHECK con `now()` no
     es inmutable. La regla no se afloja para filas nuevas.
  Revisar si hay triggers o políticas que impidan el `UPDATE` de esas tablas y declararlo.
- **Contrato SQL (PGlite), con piso de conteo y un mutante:** (a) fila de 13 meses queda con uuid nulo;
  (b) fila de 11 meses no cambia, y el caso borde: una de exactamente 12 meses no cambia; (c) el resto de columnas de la fila no cambia; (d) idempotente: una
  segunda corrida no cambia nada y no falla; (e) la marca de purga no permite insertar filas manuales nuevas sin persona: sigue
  siendo rechazada; (f) `public`, `anon` y `authenticated` no pueden ejecutar la función. Mutante: quitar el filtro de
  edad hace fallar (b).
- **Migración en espera** (`pendingBelowCutoff`); la aplica el Director General con OK nominal de Sam;
  el cierre lo hace él aparte. `spec-migration-refs.test.ts` y el gate de símbolos antes de publicar.
- **Reglas:** nunca `gh pr update-branch`; traer main una sola vez, al final; `ready --undo` →
  push → `ready`; revisar `revisar-datos-ve` en el handoff.
