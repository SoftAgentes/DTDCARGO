# Handoff — SDD-0611 §11.5 · código de la regla de la foto de portada (migración 0547)

| Campo | Valor |
|---|---|
| Owner | Worker `0611-foto-licencia-d10015` |
| Sesión que encargó | Director General (`local_25e2dded-103b-4eaa-b10e-6527564b9cad`), a partir del encargo del Subdirector SEO |
| Ruta | `.claude/worktrees/0611-foto-licencia-d10015` |
| Rama | `claude/0611-foto-licencia-d10015`, nacida en main `4f5497601` |
| Fecha | 2026-11-16 |
| SDD | 0611 §11.5 (nueva subsección §11.5.1) |
| Migración | **0547** `0547_noticias_portada_licencia.sql`, **EN ESPERA, sin aplicar**. Número: la 0546 es la purga de `actor_id` (PR #595); la 0547 era la siguiente libre el 2026-11-16 (renumerada por orden del DG). El DG confirma el número al integrar. |

## OBJETIVO ORIGINAL

Hacer cumplir en código la regla de §11.5: foto de la fuente solo con licencia comprobada; si no, banco libre o foto propia sin la marca anterior; si no, sin foto; nunca la marca anterior. Migración nueva en espera (no aplicar), publicación y render que no usen foto sin licencia, filtro de marca anterior y URL, portada sin imagen que se vea bien, y lo pendiente de la #593.

## COMPLETADO

1. **Migración 0547 (sin aplicar)**, desarme `supabase/desarmes/0547_desarme.sql`, contrato `supabase/tests/0547_noticias_portada_licencia.test.sql` (sin `\ir ../desarmes`), runner PGlite con control rojo, preflight doble, 6 mutantes y la vuelta del desarme solo allí, y espera en `supabase/migrations-baseline.json`.
   - `news_posts` no tenía columnas de portada (el catálogo de producción del 2026-11-09 y el código lo confirman); la 0547 agrega 7 con dos CHECK que exigen URL permitida, licencia escrita y comprobada con fecha, origen y enlace de origen si no es propia.
   - `seo_drafts` +6 `autopub_cover_*` (solo forma).
   - `news_insertar_post` (misma firma y privilegios) guarda la portada solo si pasa; si un CHECK de portada la rechaza, publica la noticia **sin** portada, sin retenerla. Los CHECK que no son de portada se vuelven a lanzar.
   - anon lee seis columnas de portada, no `cover_license_verified_at`.
2. **`lib/news/portada.ts`**: regla pura (`evaluarPortada`, `esUrlDePortadaPermitida`, `nombraMarcaAnterior`, `portadaDeRegistro`). La marca anterior se detecta cruda y decodificada, con NFKC; la expresión es la misma que la del CHECK (prueba gemela).
3. **Publicación automática** (`lib/studio/news/autopublicar.ts`): lee las columnas de portada (reintenta sin ellas si la 0547 no está), decide con `evaluarPortada` y manda al RPC la portada solo si se puede usar. F6 ya no retiene por portada (`puntaje:portada` retirado, §11.5 b).
4. **Render**: `editorialImageOf` devuelve `null` si no hay foto presentable; tarjeta destacada, archivo, relacionadas y página de la noticia se ven sin hueco ni relleno; pie de foto con crédito, licencia y origen. `opengraph-image` ya era una tarjeta de texto sin foto, sin cambios. La portada se lee en una consulta aparte (`conPortadas`) que degrada sin la 0547; declarado en `pending-migration-symbol-declarations.json` (gate: 0 rojo, 1 amarillo declarado).
5. **#593**: lo que seguía abierto era que las fotos excluidas y dudosas de §11.5 no tenían prueba; ahora `editorial.test.ts` falla si un respaldo usa alguna.
6. Spec §11.5.1 con la tabla de piezas.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| `node scripts/check-pending-migration-symbols.mjs` | PASÓ (0 rojo, 1 amarillo declarado) |
| noticias-0547.migration.test.ts (PGlite: contrato, control rojo, preflight, 6 mutantes, desarme, gemelas) | PASÓ 14/14. Encontró dos defectos reales de la 0547 antes de la PR (`position` con esquema y `cover_origin` NULL que pasaba el CHECK), ya corregidos |
| portada, editorial, news-queries-portada, news-queries-columnas, piezas, filtros, studio autopublicar (una a una) | PASARON |
| `tsc --noEmit` | PASÓ |
| `pnpm sdd:check` (numbering) | PASÓ |
| `pnpm verify` | NO EJECUTADO (no pedido) |
| Aplicación de la 0547 | NO EJECUTADA (espera OK nominal de Sam) |

## COMMITS / PR / BRANCH

Rama `claude/0611-foto-licencia-d10015`. PR propia, sin auto-merge, a main.

## PENDIENTES DE ESTA TAREA

- Aplicar la 0547 en prueba y producción con OK nominal de Sam y el runbook (migrate-first); sellarla y retirar la espera.
- Que el Studio (o quien cargue la foto) capture crédito, licencia, origen y fecha de comprobación en el borrador: hoy ninguna pantalla escribe `autopub_cover_*`, así que sin eso toda noticia sigue con el respaldo propio.
- Revisión de las fotos a la vista cada vez que se agregue o cambie una (límite de la prueba de §11.5).
- Retirar o cambiar la foto de las 5 noticias ya publicadas: cambio de contenido en producción, con OK de Sam (§11.5).

## FUERA DE ALCANCE DETECTADO

- Los `.jpg` viejos con la marca anterior siguen en `public/fotos` (`precinto-doortudoor-…jpg`, `carga-contenedor-precinto-doortudoor-…jpg`, `puerto-venezuela-aduana-entrega-final-…jpg`) y los usan `app/contacto` y los docs de WhatsApp. Retirarlos exige cambiar esos usos primero.
- `dtd-cargo-recepcion-contenedor.webp` (camisa con la marca anterior) y las dudosas `dtd-cargo-descarga-bodega.webp` y `dtd-cargo-atencion-mapa.webp` siguen en `public/fotos`; no las usa ningún respaldo.
- `lib/news/types.ts` declara columnas (`content_kind`, `featured`, `reviewer_*`) que no existen en producción; no se tocaron.

## HANDOFF AL DIRECTOR

- Decisión de diseño a revisar: F6 dejó de retener por portada. Es lo que pide §11.5 (b), pero cambia un código de retención existente (`puntaje:portada`).
- Orden de aplicación: 0547 después de la 0518 y la 0526 (ya aplicadas). El sitio no depende de ella para salir (degrada al respaldo).
- Impacto documental: spec 0611 §11.5.1 actualizado; nada más. Sin datos personales en el repo.

Nota de proceso: un `sed` global de renumeración (0546→0547) tocó 35 archivos ajenos; se revirtieron con `git checkout` antes de commitear. El diff final solo trae archivos de esta tarea.
