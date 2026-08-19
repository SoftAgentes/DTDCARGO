-- ─────────────────────────────────────────────────────────────
-- 0385 · Saca el correo muerto de una noticia publicada.
--
-- QUÉ ESTÁ MAL
-- El post `navieras-mas-grandes-mundo` cierra invitando al lector a escribir a
-- `info@doortudoor.com`. Ese buzón corresponde al dominio viejo y no es el
-- canónico — el vigente es `info@dtdcargo.com`. La página es PÚBLICA y está
-- viva hoy en /noticias/navieras-mas-grandes-mundo, así que cualquiera que la
-- lea y quiera escribir, escribe a una dirección equivocada.
--
-- DE DÓNDE VIENE
-- Del seed 0056_seed_news_posts_from_static.sql:185, que copió el texto de la
-- versión estática de las noticias, anterior a la migración de dominio
-- doortudoor.com → dtdcargo.com. El seed NO se edita: ya corrió, y su cabecera
-- debe seguir diciendo lo que aplicó. La corrección va acá.
--
-- POR QUÉ UN `replace` Y NO UN TEXTO NUEVO
-- Toca sólo la subcadena del correo y deja intacto el resto del artículo. Si
-- el cuerpo se editó desde el CMS después del seed, este UPDATE respeta esa
-- edición en vez de pisarla con el texto viejo del seed.
--
-- ALCANCE
-- El `where` busca por contenido, no por slug: si otra fila arrastra el mismo
-- correo (del seed o cargada por el CMS), también se corrige. Hoy, medido
-- contra el repo, la única del seed es `navieras-mas-grandes-mundo`; no se
-- consultó producción para escribir esto, así que el filtro por contenido es a
-- propósito — cubre lo que el repo no puede ver.
--
-- IDEMPOTENTE: correrla dos veces no cambia nada la segunda vez (después del
-- primer pase ninguna fila hace match con el LIKE).
--
-- NO TOCA el dominio `doortudoor.com` cuando aparece como URL: ese sigue vivo
-- y redirigiendo (301 → dtdcargo.com), es infraestructura de SEO y su retiro
-- sería otra decisión. Acá sólo se corrige el BUZÓN, que sí está muerto.
-- ─────────────────────────────────────────────────────────────

update public.news_posts
   set body_markdown = replace(
         body_markdown,
         'info@doortudoor.com',
         'info@dtdcargo.com'
       )
 where body_markdown like '%info@doortudoor.com%';
