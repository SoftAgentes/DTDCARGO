# Handoff — SDD-0611 · Ajustes antes de encender

| Campo | Valor |
|---|---|
| Owner | Worker `wizardly-murdock` (sesión de la #417, la misma ruta con otra rama) |
| Sesión que encargó | Subdirector «SEO, GEO y AEO» (`local_61442abe-3b66-423e-9af4-8008d5457aa3`), por orden del DG |
| Ruta | `.claude/worktrees/wizardly-murdock-7db565` |
| Rama | `claude/noticias-antes-de-encender-2`, nacida en main `ad50537f1`. Lleva un merge local de la cabeza de la #485 (`876914d6e`) y trae main `b5669b1a5` y `2f3a77b7a` |
| PR | [SoftAgentes/DTDCARGO#492](https://github.com/SoftAgentes/DTDCARGO/pull/492) |
| Fecha | 2026-11-09 |
| SDD | 0611 |
| Migración | **0525** `supabase/migrations/0525_noticias_ajustes_antes_de_encender.sql`, número confirmado por el DG. **NO APLICADA**, declarada como espera. md5 `03698ca2155e4f2f03623f2a39901b6e`, 8.957 bytes |

## OBJETIVO ORIGINAL

Antes de encender la publicación automática o enganchar `news_publicar_manual`, cerrar los hallazgos de las revisiones de la #417 y de la #485 que no bloqueaban:
- C1: las columnas públicas de `news_posts`;
- C2-A y los puntos 11, 12 y 13, en la migración 0525.

La primera parte, documentos y pruebas de la #422, fue la #485, que está en main desde el tren #487 (`b5669b1a5`). El plan completo está en la nota compartida del Subdirector (`plan-segunda-pr-0611-antes-de-encender.md`).

## COMPLETADO EN ESTA PR

1. **`71bb01948`, pendientes de la revisión de la #485:**
   - `elementosJsx` salta el texto entre comillas;
   - los usos de `WebPageJsonLd` se cuentan de verdad.
2. **`929b5d7ee`:** la spec §11.2 cita literal el OK de Sam para aplicar la 0518, tomado de `cierre-migraciones-20261108.md:44`.
3. **`7cef323e6` (C1) y la vuelta de la revisión del DG:** `lib/public/news-queries.ts` pide en sus 4 lecturas de filas completas **18 columnas explícitas**.
   - No pide `publish_via`, `seo_draft_id`, `content_sha256`, `created_by`, `tenant_id` ni `source` (N2: ninguna página lo usa).
   - La lista es un literal, porque supabase-js tipa el resultado leyendo el texto del `select`.
   - Se apoya en el catálogo de producción leído por el DG el 2026-11-09, solo la estructura: 24 columnas.
   - `content_kind`, `cover_image_url`, `cover_alt`, `featured`, `reviewer_name` y `reviewer_role` no existen y no se piden. El sitio ya las trata como opcionales, y con `*` tampoco llegan hoy, así que el resultado es el mismo.
4. **`ee54bc199`, la migración 0525:**
   - C2-A: `created_by` con `ON DELETE SET NULL` y nullable;
   - 11: `news_salida_motivo` exige el motivo;
   - 12: anon sin EXECUTE sobre la marca y la huella;
   - 13: el disparador `news_posts_huella_al_editar_trg`;
   - preflight, postflight, su contrato, su prueba en PGlite, la espera y la spec §11.3.
5. **Vuelta de la revisión del DG sobre `ffc797dc9` (CHANGES_REQUESTED, 3 bloqueantes documentales):**
   - la allowlist exacta de la #492 en la spec §11.3.2; se quita «la segunda PR trae su propia allowlist» y se sube `updated:`;
   - este handoff, al día;
   - la constancia de `revisar-datos-ve` en la spec §11.3.1: el alcance real de C2 y la retención de los uuid sin FK;
   - N2: sin `source`;
   - N3: una prueba estática de que ninguna lectura de `news_posts` en `lib/news`, `lib/public` ni `lib/studio/news` pide `*`;
   - N4: el contrato afirma el EXECUTE de `news_salida_motivo` (authenticated sí, anon no), con su mutante.

## Decisiones de Sam (2026-11-08, transmitidas por el Subdirector)

- **C2:** «Quedan sin autor». **Alcance real (§11.3.1):** quedan sin autor **todos** los `seo_drafts` de la persona borrada, no solo los de noticias automáticas. El OK de aplicación de la 0525 tiene que nombrarlo.
- **13:** «Sí, sigue contando». Una automática que una persona edita sigue contando en F7. Solo se recalcula `content_sha256`.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| La 0525 en PGlite (`noticias-0525.migration.test.ts`) | PASÓ, 14/14: el contrato en verde, el control rojo (sin la 0525 cae en «12: anon no ejecuta news_huella»), la doble aplicación frenada por el preflight y 10 mutantes, cada uno caído en su aserción (incluido N4: «news_salida_motivo queda ejecutable por anon») |
| Contrato SQL de la 0525 en Postgres real, en el CI de `ffc797dc9` | PASÓ: workflow «Contratos SQL», run `42634209507`, success |
| Prueba de C1 (`news-queries-columnas.test.ts`) | PASÓ, 6/6: los 5 casos de C1 (también en la «Calidad continua» de `ffc797dc9`, run `42634254211`, success) más N3. Roja antes del arreglo (2 de 5) |
| Mutantes de C1 | PASÓ, todos caídos: volver a `*`, sumar `created_by`, sumar una columna inexistente, volver a sumar `source` (N2) y `select("*")` en `lib/news/slugify.ts` (N3) |
| `seo-auditoria-json-ld.test.tsx` | PASÓ. Tres mutantes caídos: `description="a > b"` sin `name`, un uso sin `/>` y un import sin uso |
| Vecinas de `/noticias` y SEO | PASÓ, 84/84 |
| Candado | PASÓ: esperas 0422, 0423 y 0525; 0 nuevas sin sellar |
| Gate de símbolos | PASÓ: 0 ROJO · 0 AMARILLO. Ningún código usa los símbolos de la 0525 |
| `check-migrations-applied`, envoltorios de migraciones y `spec-migration-refs` | PASÓ |
| docs:check, sdd:check, governance:check, tsc, eslint y `diff --check` | PASÓ |
| El código funciona igual con o sin la 0525 | PASÓ, por lectura: ninguna ruta llama a `news_salida_motivo`, `news_huella` ni `news_texto_tiene_marca`; `seo_drafts.created_by` solo se escribe; la lectura pública es la policy `published = true` |
| `pnpm verify`, build, Docker y e2e | NO EJECUTADO, por orden del encargo |

## PENDIENTES DE ESTA TAREA

- **Aplicar la 0525:** la aplica el DG, con el OK nominal de Sam. Ese OK tiene que nombrar el alcance de C2: todos los borradores de la persona borrada quedan sin autor.
- **Condición escrita para encender (N1): defensa por columnas para anon.** Hoy anon sigue leyendo `created_by`, `publish_via`, `seo_draft_id` y `content_sha256` por PostgREST directo, aunque el sitio ya no los pida. Antes de encender, va una migración **aparte y app-first**, distinta de la 0525, aplicada **después** de desplegar C1: con permisos por columna, un `select("*")` de anon falla y vaciaría `/noticias`. SQL en borrador:
  ```sql
  -- App-first: solo con el código de C1 ya desplegado.
  revoke select on public.news_posts from anon;
  grant select (id, slug, tipo, categoria, title, excerpt, body_markdown,
                author_name, author_role, focus_keyword, secondary_keywords,
                meta_description, pain_points, date, read_time_min, published,
                created_at, updated_at)
     on public.news_posts to anon;
  ```
  Antes de aplicarla hay que medir tres cosas:
  - que ninguna otra lectura con anon pida una columna de fuera de la lista (ver con qué cliente leen `lib/news/slugify.ts` y `lib/news/writers.ts`);
  - que la policy `news_posts_public_select` siga funcionando;
  - el contrato, con un mutante que devuelva `created_by` a anon.
- **Condición para encender: el plazo de retención.** `news_post_exits.actor_id`, `news_publication_audit.actor_id`, `news_autopublish_settings.updated_by` y `news_autopublish_settings_log.changed_by` conservan el uuid de una persona borrada, porque no tienen FK. Es una excepción temporal (spec §11.3.1) hasta que Sam fije el plazo, que va con su purga en la PR del cron.
- Lo que sigue abierto en el handoff de la 0611 (C3, C4, C6 a C10, cron, pantalla de retiro y lo demás) no entra, salvo que el DG lo pida.

## FUERA DE ALCANCE DETECTADO

- La línea de `WebPageJsonLd` en «Arquitectura SEO» de `seo.md` todavía nombra `/calculadora` y `/track`. Es la P4 de la SDD-0613.

## HANDOFF AL DIRECTOR

La #492 trae C1 y la 0525 sin aplicar. El código funciona igual con o sin la 0525. Nada se enciende:
- aplicar la 0525 pide el OK de Sam nombrando el archivo y el alcance de C2;
- encender la publicación automática pide otro OK, y antes de pedirlo tienen que estar la defensa por columnas para anon y el plazo de retención.
