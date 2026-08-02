-- ============================================================================
-- 0335 · SDD-0238 — Metadatos de previsualización de los assets de marca
-- ============================================================================
-- Dos datos que un diseñador mira ANTES de bajar nada y que la 0334 no guardaba:
--
--   · width / height — las dimensiones. El hub viejo (hardcodeado) las decía
--     ("PNG · 741×764") y se perdieron al pasar el catálogo a datos. Sin ellas,
--     la ficha no responde "¿me sirve este archivo?" y hay que descargarlo para
--     averiguarlo.
--
--   · tile — sobre qué fondo se previsualiza. ESTO ARREGLA UN BUG REAL: hasta
--     ahora el fondo lo decidía una expresión regular sobre el NOMBRE del
--     archivo (`/revers|mono-light|inverso/` en AssetCard.tsx). Un archivo
--     llamado "logo para fondo oscuro.png" no matchea → el logo blanco se pinta
--     sobre papel blanco y el diseñador ve un recuadro vacío. Adivinar por el
--     nombre no es un mecanismo; el dato tiene que ser un campo.
--
-- `tile = 'auto'` conserva el comportamiento actual para las filas que ya
-- existen, así que esta migración no cambia nada de golpe: lo que se sube de
-- ahora en adelante trae el fondo elegido a mano.
--
-- Las dimensiones se leen EN EL NAVEGADOR al subir (naturalWidth/naturalHeight)
-- y viajan como campos del formulario. Es a propósito: leerlas en el servidor
-- exigiría una dependencia de decodificación de imágenes para un dato cosmético.
-- Por eso son nullable — si el navegador no las pudo leer (SVG sin viewBox, un
-- .AI, una fuente), la ficha simplemente no las muestra.
--
-- NO aplicar a prod (lo hace la coordinación / founder).
-- ============================================================================

set lock_timeout = '5s';
set statement_timeout = '30s';

alter table public.brand_assets
  add column if not exists width  integer,
  add column if not exists height integer,
  add column if not exists tile   text not null default 'auto';

-- Dimensiones positivas o nulas: un 0 o un negativo sólo puede venir de un
-- cliente manipulado, y renderizaría "0×0" en la ficha.
alter table public.brand_assets
  drop constraint if exists brand_assets_dimensions_positive;
alter table public.brand_assets
  add constraint brand_assets_dimensions_positive check (
    (width  is null or width  > 0) and
    (height is null or height > 0)
  );

alter table public.brand_assets
  drop constraint if exists brand_assets_tile_valid;
alter table public.brand_assets
  add constraint brand_assets_tile_valid check (
    tile in ('auto', 'light', 'dark', 'checker')
  );

comment on column public.brand_assets.width is
  'Ancho en px. Lo lee el navegador al subir (naturalWidth). NULL = no se pudo leer (SVG sin viewBox, .AI, fuentes) y la ficha lo omite.';

comment on column public.brand_assets.height is
  'Alto en px. Ver comentario de width.';

comment on column public.brand_assets.tile is
  'Fondo de la miniatura: light (papel) · dark (navy, para logos claros) · checker (cuadrícula de transparencia) · auto (hereda el criterio por nombre, comportamiento previo a 0335). Existe porque adivinar por el nombre del archivo fallaba con nombres libres.';
