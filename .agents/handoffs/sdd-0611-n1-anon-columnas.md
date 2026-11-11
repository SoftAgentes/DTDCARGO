# Handoff — SDD-0611 · N1, anon sin `created_by` ni `publish_via` (migración 0526)

| Campo | Valor |
|---|---|
| Owner | Worker `noticias-n1-revoke-anon-a3ccc9` |
| Sesión que encargó | Director General (`local_25e2dded-103b-4eaa-b10e-6527564b9cad`) |
| Ruta | `.claude/worktrees/noticias-n1-revoke-anon-a3ccc9` |
| Rama | `claude/noticias-n1-revoke-anon-a3ccc9`, nacida en main `836b2cf19` |
| Fecha | 2026-11-11 |
| SDD | 0611 (§7 punto 6, §11.4) |
| Migración | **0526** `supabase/migrations/0526_noticias_anon_solo_columnas_publicas.sql`. **NO APLICADA**, en ningún entorno; declarada como espera. md5 `f58d4595160b45559882f1adb5ee909a`, 6.731 bytes (LF) |

## OBJETIVO ORIGINAL

Preparar como PR, sin aplicarla, la migración N1 de las noticias automáticas:
- anon deja de leer `created_by` y `publish_via` de `news_posts`;
- la lectura pública de `lib/public/news-queries` y `/noticias` sigue funcionando;
- un `.test.sql` en PGlite que falle si anon todavía lee esas columnas y pase si la lectura pública sigue;
- la retención de `actor_id` queda como decisión abierta para Sam, sin decidirla.

No tocar `app/noticias/**` ni `app/sitemap.ts` (PR #505).

## COMPLETADO

1. **Número 0526.** `pnpm sdd:next` (813 refs + worktrees, 2026-11-11) dio «migración siguiente: 0526». `--reserve` solo reserva specs. Las migraciones las coordina el Director, así que el número queda registrado aquí y en la PR para que el DG lo confirme. `migrations-lock verificar` lo ve como espera sin sellar, sin errores.
2. **La 0526.**
   - Hace `revoke select on public.news_posts from anon` y `grant select (…18 columnas…) to anon`.
   - Un REVOKE de columna no alcanza mientras exista el GRANT de tabla: hay que quitar el de tabla y dar las columnas.
   - Las columnas son exactamente `COLUMNAS_PUBLICAS`. Quedan fuera también `seo_draft_id`, `content_sha256`, `tenant_id` y `source`, que la C1 ya trataba como internas. Una columna futura nace invisible para anon.
   - El preflight exige la 0518 y el SELECT de tabla de la 0055, y aborta si ya se aplicó.
   - El postflight comprueba la tabla, las 6 internas, las 18 públicas y que authenticated conserve su SELECT.
3. **El contrato** `supabase/tests/0526_noticias_anon_solo_columnas_publicas.test.sql`. Usa el fixture de la 0525 con las migraciones reales 0053, 0055, 0057, 0140, 0518, 0525 y 0526, y tiene 16 aserciones:
   - N1: anon no lee ni filtra por `created_by` y `publish_via`, no lee las otras 4 y no pide `*` (42501);
   - L: las 4 lecturas de `news-queries` traen sus filas, y la RLS sigue escondiendo la no publicada;
   - S: authenticated y service_role siguen leyendo las internas.
4. **La prueba PGlite** `lib/news/autopublicar/__tests__/noticias-0526.migration.test.ts`. Incluye:
   - el verde;
   - el control rojo, que cae en «N1: anon no lee created_by»;
   - el preflight doble;
   - 6 mutantes: sin revoke, el grant con `created_by`, con `publish_via`, con `tenant_id`, el grant sin `body_markdown` y el revoke que alcanza también a authenticated;
   - la gemela: grant = `COLUMNAS_PUBLICAS`.
5. **La espera** en `supabase/migrations-baseline.json › pendingBelowCutoff`, con el texto que el operador lee antes de aplicar.
6. **La spec.** Lleva §11.4 (N1, la 0526, sus pruebas y cómo deshacerla), §11.4.1 (la decisión abierta de la retención de `actor_id`, sin decidir), §11.4.2 (la allowlist) y §7 punto 6. En `privacidad.md` va la tabla de quién lee esas columnas antes y después de la 0526.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| `vitest run` 0526 (PGlite) | PASÓ, 11/11 |
| `vitest run`: 0525, `news-queries-columnas`, `anon-privilegios-residuales`, `spec-migration-refs` y `check-migrations-applied` | PASÓ, 6 archivos y 98 pruebas (incluye la 0526) |
| `node scripts/migrations-lock.mjs verificar` | PASÓ: 512 selladas y 3 esperas (0422, 0423, 0526) |
| `check-pending-migration-symbols` | PASÓ: 0 rojos, 0 amarillos (la 0526 no crea símbolos) |
| `sdd:check` / `docs:check` | PASÓ |
| `tsc --noEmit` | PASÓ |
| `eslint` del archivo nuevo | PASÓ |
| `git diff --check` | PASÓ |
| `pnpm verify` | NO EJECUTADO. El diff es una migración sin aplicar, pruebas y docs, sin código de producto; el portón es el CI de la PR |
| Aplicación en algún entorno | NO EJECUTADO, por diseño |
| `pnpm knowledge:status` | INVALID por enlaces rotos de otras specs (por ejemplo, 0482 → 0483), que ya venían de antes. No los toca esta tarea |

## COMMITS

- `d74aadaf3` feat(db): migración 0526, contrato, prueba PGlite y espera.
- `8c60566e0` docs(spec): §11.4 y privacidad.
- El commit de este handoff.

## PR / BRANCH

`claude/noticias-n1-revoke-anon-a3ccc9` → `main`. El número de la PR va en el aviso al DG.

## PENDIENTES DE ESTA TAREA

- Que el DG confirme el número 0526 y revise y fusione la PR.
- Aplicar la 0526 pide un OK nominal de Sam nombrando el archivo. Antes, la web desplegada tiene que pedir columnas explícitas (la C1 está en main). Después de aplicarla:
  - smoke de /noticias, de una noticia, de su imagen OG y del sitemap;
  - comprobar que `select=created_by` con la clave anon da 401/42501;
  - retirar la espera y sellar con `retirar-espera`.
- La decisión de Sam de §11.4.1 (retención de `actor_id`) sigue abierta. Tiene que estar decidida antes de encender.

## FUERA DE ALCANCE DETECTADO

- En producción, anon podría tener sobre `news_posts` privilegios de escritura que vengan de los privilegios por defecto de Supabase (INSERT, UPDATE, DELETE…). La RLS los corta, porque solo hay policies de admin para escribir. La 0526 solo toca SELECT, y no leí el catálogo de producción para comprobarlo.
- `knowledge:status` INVALID por enlaces rotos de specs ajenas.

## Impacto documental

- Canónicos actualizados: `docs/specs/0611-…/spec.md` y `privacidad.md`.
- Graphify y Archify: no se regeneraron en esta tarea; queda pendiente de integración para el Director.
- No hay notas personales tocadas.

## HANDOFF AL DIRECTOR

PR lista para revisión, con número de migración 0526 por confirmar. No se aplicó nada. La única decisión pendiente de Sam es la retención de `actor_id`.
