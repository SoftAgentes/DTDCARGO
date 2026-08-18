-- ─────────────────────────────────────────────────────────────
-- 0384 · SDD-0269 — El precio pactado con el aliado, como número.
--
-- QUÉ FALTABA
-- La migr 0382 dejó dos formas de pactar: un `discount_pct` sobre la tarifa de
-- la casa, o filas propias de `rates` dentro de la lista del aliado. Pero la
-- forma en que el founder piensa el acuerdo es una tercera, y era la más
-- directa: «con Dynasty Cargo tengo $690 el CBM». Un número, sin porcentaje y
-- sin ruta.
--
-- Eso ya se podía hacer —cargando filas en su lista desde /studio/tarifas—, pero
-- estaba a tres clics y en otro módulo, y la ficha del aliado sólo ofrecía el
-- porcentaje. Una capacidad que existe pero no se encuentra es una capacidad que
-- no está.
--
-- POR QUÉ UNA COLUMNA Y NO UNA FILA DE `rates`
-- Una fila de `rates` exige servicio + origen + destino. El acuerdo con un
-- aliado no tiene ruta: es el precio de SU carga, venga de donde venga. Pedirle
-- al founder que invente una ruta para guardar un número sería obligarlo a
-- mentirle al catálogo — y después ese destino inventado compite en el ILIKE con
-- los de verdad.
--
-- EL ORDEN DE RESOLUCIÓN, DE LO MÁS ESPECÍFICO A LO MÁS GENERAL
--   1. Tarifa propia   — una fila suya en `rates` para esa ruta exacta.
--   2. Precio pactado  — `base_per_cbm`, este número.
--   3. Descuento       — `discount_pct` sobre la de la casa.
--   4. La casa         — tal cual.
-- Los cuatro pueden convivir. El más específico manda, y la pantalla dice cuál
-- se aplicó: un precio que el vendedor no sabe explicar es un precio que no usa.
--
-- ⚠️ SÓLO APLICA DONDE EL PRECIO ES POR CBM.
-- El FCL se cobra por contenedor (`flat_rate`), no por metro cúbico, así que un
-- $/CBM pactado no tiene dónde aplicarse ahí y el FCL sigue su camino: descuento
-- si lo hay, si no la de la casa. La decisión NO se toma mirando el `service`
-- sino la FORMA de la tarifa de la casa (`per_cbm is not null`), que es el dato
-- que de verdad dice cómo se cobra ese tramo — el `service` de la fila pública
-- ya divergió una vez de lo que representaba (ver la cabecera de la migr 0255).
--
-- Y el piso (`min_charge`) sigue siendo el de la casa, igual que con el
-- descuento: es un término comercial aparte, no el precio.
--
-- Ref: SDD-0269. Aditiva. Una columna nullable; ninguna fila cambia.
-- ─────────────────────────────────────────────────────────────

alter table public.price_books
  add column if not exists base_per_cbm numeric(10, 2);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'price_books_base_per_cbm_positivo'
  ) then
    alter table public.price_books
      add constraint price_books_base_per_cbm_positivo
      check (base_per_cbm is null or base_per_cbm > 0);
  end if;
end$$;

comment on column public.price_books.base_per_cbm is
  'SDD-0269: el precio por CBM pactado con este aliado, en USD. Se aplica donde la lista no tiene tarifa '
  'propia Y la tarifa de la casa para ese tramo se cobra por CBM; si el tramo va por contenedor (flat_rate), '
  'no aplica y se sigue con el descuento o la tarifa de la casa. Manda sobre `discount_pct` por ser más '
  'específico. NO reemplaza `min_charge`: el piso sigue siendo el de la casa.';
