# Handoff — SDD-0611 · Ajustes antes de encender, más los pendientes de la #422

| Campo | Valor |
|---|---|
| Owner | Worker `wizardly-murdock` (sesión de la #417, la misma ruta con una rama nueva) |
| Sesión que encargó | Subdirector «SEO, GEO y AEO» (`local_61442abe-3b66-423e-9af4-8008d5457aa3`), por orden del DG |
| Ruta | `.claude/worktrees/wizardly-murdock-7db565` |
| Rama | `claude/noticias-ajustes-0611`, nacida en main `9019d3997`, con main `e74cde6fc` (fast-forward) y `7f01a3bb5` (merge) traídos |
| Fecha | 2026-11-09 |
| SDD | 0611 (y la SDD-0613 para `seo.md`) |
| Migración | Ninguna todavía. `NNNN` espera su número del DG |

## OBJETIVO ORIGINAL

Antes de encender la publicación automática o enganchar `news_publicar_manual`, cerrar los hallazgos de las revisiones de la #417 que no bloqueaban. Además, el DG sumó a esta PR lo no bloqueante de la #422.

El plan completo está en la nota compartida del Subdirector (`plan-segunda-pr-0611-antes-de-encender.md`).

## COMPLETADO EN ESTA PR

1. **`86e1200b9` (docs):**
   - la spec 0611 §11.2 registra la 0518 aplicada, con version, COMMIT y evidencia de prueba y producción, y apunta a `cierre-migraciones-20261108.md`;
   - C5: el conteo previo a un `VALIDATE` usa `news_texto_tiene_marca`, igual que el CHECK;
   - governance, `agente-seo-noticias.md` y el plan maestro dejan de decir que la 0518 está sin aplicar;
   - el handoff de la 0611 suma «Estado de la 0518» y las decisiones de Sam.
2. **`fc24ed53d` (pruebas de la #422):**
   - `__tests__/seo-auditoria-json-ld.test.tsx` recorre cada `<WebPageJsonLd …/>` sin depender del orden de las props, y lee el logo del layout dentro de su bloque, que debe ser uno solo;
   - `components/Nav.drawer-inert.test.tsx` cambia de nombre para decir lo que mide: los atributos, no el foco.
3. **`0c8b7c931` (docs de la #422):**
   - `docs/marketing/seo.md` suma la auditoría del 2026-11-07, los 4 arreglos, la tabla de laboratorio y P-a a P-k;
   - el handoff de la #422 corrige la frase «sin merge con main».

## Decisiones de Sam (2026-11-08, transmitidas por el Subdirector)

- **C2:** «Quedan sin autor». `seo_drafts.created_by` pasa a `on delete set null` y deja de ser NOT NULL.
- **13:** «Sí, sigue contando». Una automática que una persona edita sigue contando en F7. Solo se recalcula `content_sha256`.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| `spec-migration-refs.test.ts` | PASÓ, 5/5 |
| `seo-auditoria-json-ld.test.tsx` y `Nav.drawer-inert.test.tsx`, `--maxWorkers=1` | PASÓ, 6/6 |
| Mutante: props reordenadas y sin `name` en `/fcl` | PASÓ: cae en «todas las páginas que lo usan le pasan name y description». Con el mismo cambio, el patrón viejo encontraba 0 usos en `/fcl`: solo lo atajaba el piso |
| Mutante: el logo del layout sin `width` | PASÓ: cae en «el logo del layout no declara width» |
| Archivos restaurados después de los mutantes | PASÓ (`git status` limpio en `app/`) |
| eslint de las dos pruebas / `tsc --noEmit` | PASÓ / PASÓ |
| docs:check, sdd:check, governance:check y `diff --check` | PASÓ |
| `pnpm verify`, build, Docker y e2e | NO EJECUTADO, por orden del encargo |
| CI de GitHub | La #485 se marcó lista el 2026-11-09 para que corra la Calidad; la vigila el Subdirector |

## PR siguiente: rama `claude/noticias-antes-de-encender-2` (2026-11-09)

La #485 entró en main con el tren #487 (`b5669b1a5`). La rama nueva sale de main `ad50537f1`. Lleva un merge local de la cabeza congelada de la #485 (`876914d6e`), porque los ajustes de su revisión tocan ese contenido.

**Hecho, con commit local y sin push:**
- `71bb01948`, pendientes no bloqueantes de la revisión de la #485:
  - `elementosJsx` salta el texto entre comillas;
  - los usos de `WebPageJsonLd` se cuentan de verdad.
- `929b5d7ee`: la spec §11.2 cita literal el OK de Sam para aplicar la 0518, tomado de `cierre-migraciones-20261108.md:44`.
- `7cef323e6` (C1): `lib/public/news-queries.ts` pide en sus 4 lecturas de filas completas las 19 columnas seguras. La lista es un literal, porque supabase-js tipa el resultado leyendo el texto del `select`.
  - Se apoya en el catálogo de producción que leyó el DG el 2026-11-09, solo la estructura: tiene 24 columnas.
  - No pide `publish_via`, `seo_draft_id`, `content_sha256`, `created_by` ni `tenant_id`.
  - `content_kind`, `cover_image_url`, `cover_alt`, `featured`, `reviewer_name` y `reviewer_role` **no existen** en producción y no se piden. El sitio ya las trata como opcionales (`lib/news/editorial.ts`, `app/noticias/[slug]/page.tsx`, `NewsArticleJsonLd.tsx`, `ActualidadHub.tsx`). Hoy tampoco llegan con `*`, así que el resultado es el mismo.
  - La prueba (`lib/public/__tests__/news-queries-columnas.test.ts`) dio roja antes del arreglo, 2 de 5. Tres mutantes caen: volver a `*`, sumar `created_by` y sumar una columna inexistente.
  - Las vecinas de `/noticias` y SEO pasan 84 de 84.

**Escrito y sin commit, hasta confirmar el número:**
- la migración `0525_noticias_ajustes_antes_de_encender.sql` (C2-A y los puntos 11, 12 y 13);
- su contrato SQL y su prueba en PGlite (13 de 13);
- la espera en el baseline;
- la spec §11.3.

El número 0525 es el que propone `sdd:next`.

## PENDIENTES DE ESTA TAREA

- **El número de la migración:** confirmarlo y hacer commit de lo que depende de él.
- **Defensa en la base para C1:** una migración **aparte y app-first**, distinta de la 0525. Se aplica **después** de desplegar el código con `COLUMNAS_PUBLICAS`: con permisos por columna, un `select("*")` de anon falla y vaciaría `/noticias`. SQL en borrador:
  ```sql
  -- App-first: solo con el código de C1 ya desplegado.
  revoke select on public.news_posts from anon;
  grant select (id, slug, tipo, categoria, title, excerpt, body_markdown,
                author_name, author_role, focus_keyword, secondary_keywords,
                meta_description, pain_points, date, read_time_min, published,
                source, created_at, updated_at)
     on public.news_posts to anon;
  ```
  Antes de aplicarla hay que medir tres cosas:
  - que ninguna otra lectura con anon pida una columna de fuera de la lista (`lib/news/slugify.ts` y `lib/news/writers.ts`, por ejemplo: ver con qué cliente leen);
  - que la policy `news_posts_public_select` (`published = true`) siga funcionando;
  - el contrato, con un mutante que devuelva `created_by` a anon.
- Lo que sigue abierto en el handoff de la 0611 (C3, C4, C6 a C10, cron, pantalla de retiro y lo demás) no entra, salvo que el DG lo pida.

## FUERA DE ALCANCE DETECTADO

- La línea de `WebPageJsonLd` en «Arquitectura SEO» de `seo.md` todavía nombra `/calculadora` y `/track`. Es la P4 de la SDD-0613.

## HANDOFF AL DIRECTOR

La #485 trajo documentos y pruebas y está en main (tren #487). La PR siguiente, desde `claude/noticias-antes-de-encender-2`, trae C1 y la 0525. Sigue sin publicar hasta que el Subdirector avise. Nada se enciende: encender la publicación automática pide el OK de Sam, y aplicar la 0525 pide su OK nombrando el archivo.
