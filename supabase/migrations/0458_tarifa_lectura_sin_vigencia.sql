-- SDD-0476. Prepared for review; NOT applied to production.
-- The public calculator must read the price that exists in the database, not a
-- constant compiled into the site. Expiry is an ERP concern, not a read filter.
-- ─────────────────────────────────────────────────────────────
-- 0458 · La tarifa pública se LEE de la base, vencida o no
--
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff.
--    Aplicar exige OK del founder NOMBRANDO este archivo
--    (docs/runbooks/aplicar-migraciones-prod.md).
--
-- ── Problema ────────────────────────────────────────────────
-- `public_cbm_rate(p_modo)` filtra `(valid_until is null or valid_until >=
-- current_date)`. El día que la tarifa pública vence devuelve CERO filas;
-- `lib/public/rates-queries.ts` hace `if (!row || row.per_cbm == null) return
-- null`, y `/tarifas`, `/tarifas/embed` y `/api/public/cbm-rate` caen a
-- `CONFIG.tarifaBaseCBM` de `lib/calculadora.ts` — una constante del código.
--
-- Que hoy el cliente no vea el salto es COINCIDENCIA: la constante y la tarifa
-- del ERP valen lo mismo. La grieta se reabre sola la próxima vez que el
-- founder suba el precio y no toque también el código. Ya pasó con el relevo
-- $800 → $850 de la migración 0336, cuya propia cabecera lo avisa.
--
-- Criterio del founder (2026-09-17): «Aunque la tarifa se venza o esté vencida,
-- se mantiene el precio anterior. Lo que vamos a leer aquí es la base de datos.
-- Ya el tema de si se actualiza o no se actualiza es un tema del back-end, no
-- tuyo. Lo importante es que tú muestres en la base de datos la última
-- actualización o el precio actual de la tarifa.»
--
-- ── Qué cambia: UNA línea ───────────────────────────────────
-- Se borra el predicado de `valid_until` del WHERE. Nada más. La firma, el tipo
-- de retorno, los grants, el parámetro `p_modo` y los demás filtros quedan
-- IDÉNTICOS: `app/api/public/cbm-rate/route.ts` y `lib/public/rates-queries.ts`
-- siguen recibiendo exactamente `(per_cbm, min_charge, valid_until)`.
--
-- ── Por qué NO «preferir la vigente y si no la última vencida» ─
-- Porque ese diseño presupone un CONJUNTO de candidatas, y el esquema no lo
-- permite. El índice único `rates_one_public_cbm_per_tenant_modo` (migr 0255)
-- es `unique (tenant_id, public_calc_modo) where is_public and deleted_at is
-- null and per_cbm is not null`: a lo sumo UNA fila pública con precio por
-- modalidad. Y el relevo programado de 0336 DESPUBLICA la anterior
-- (`is_public = false`) antes de insertar la nueva, así que la histórica
-- tampoco es candidata. El ramal «si no hay vigente, agarrá la última vencida»
-- sería código muerto: ninguna disposición de datos alcanzable lo ejecuta.
--
-- Peor: si algún día alguien dropeara el índice, ese ramal elegiría una fila
-- DISTINTA de la que `/studio/tarifas` muestra como «la pública» y de la que
-- vigila el cron de vencimiento — el sitio y el ERP dirían precios distintos
-- sin un solo error. Quitar el filtro no puede divergir: sirve la única fila
-- pública, la misma que el founder edita y la misma que el ERP marca.
--
-- ── Lo que SIGUE filtrando, y por qué cada uno ──────────────
--  · `is_public = true`      → la marca del founder. Sin ella no es del sitio.
--  · `status = 'published'`  → un borrador NUNCA se sirve (regla de 0255).
--  · `deleted_at is null`    → soft delete.
--  · `per_cbm is not null`   → PRODUCCIÓN TIENE HOY DOS FILAS DDP PÚBLICAS CON
--    `per_cbm` EN NULL (valid_from 2026-05-24, valid_until 2026-12-31,
--    verificadas 2026-09-17). Existen porque el índice único las ignora. Sin
--    este filtro el sitio serviría una tarifa vacía: es el filtro más
--    importante del WHERE y no se toca.
--  · `valid_from is null or valid_from <= current_date` → una tarifa
--    PROGRAMADA para dentro de un mes no se adelanta. Vencer y todavía-no-
--    empezar son cosas distintas: lo primero es un precio real que quedó viejo,
--    lo segundo es un precio que nunca rigió.
--  · `public_calc_modo` → la modalidad. `consolidado` tiene hoy valid_from y
--    valid_until en NULL, así que nunca vencía: su comportamiento no cambia.
--
-- ── Orden ───────────────────────────────────────────────────
-- Era `valid_from desc nulls last`. Se le agregan `updated_at desc, id` para
-- que el desempate sea TOTAL. Con el índice vivo hay a lo sumo una fila y el
-- orden nunca se ejercita; es defensa por si el índice desapareciera, y su
-- criterio queda alineado con el objetivo: gana la más reciente.
--
-- ── Qué NO hace esta migración ──────────────────────────────
-- No toca el índice único, ni datos, ni la firma de la RPC, ni añade una señal
-- «vencida». El consumidor ya recibe `valid_until` y puede derivarla
-- (`valid_until is not null and valid_until < hoy`); quien necesita esa señal
-- es el founder, y el ERP ya se la da (`rateExpiryBadge` en
-- `lib/studio/rate-types.ts` y el cron `app/api/cron/rate-expiry-alert`).
--
-- ── Efecto en producción al aplicarla ───────────────────────
-- Hoy, 2026-09-17, NINGUNO visible: la fila DDP pública está vigente
-- (per_cbm 850.00, min_charge 50.00, valid_from 2026-09-04, valid_until
-- 2026-11-29, status published) y la RPC ya la devuelve. Lo que cambia es el
-- 2026-11-30: hoy el sitio caería a la constante del código; después de esto
-- sigue cotizando 850 hasta que el founder decida otra cosa.
--
-- Idempotente: create or replace + revoke/grant. Sin DDL de tablas, sin locks
-- sobre `rates`, sin backfill.
-- ─────────────────────────────────────────────────────────────

create or replace function public.public_cbm_rate(p_modo text default 'ddp')
returns table (
  per_cbm     numeric,
  min_charge  numeric,
  valid_until date
)
language sql
stable
security definer
set search_path = public
as $$
  select r.per_cbm, r.min_charge, r.valid_until
  from public.rates r
  join public.tenants t on t.id = r.tenant_id
  where t.slug = 'dtd'
    and r.is_public = true
    and r.status = 'published'
    and r.deleted_at is null
    and r.per_cbm is not null
    and r.public_calc_modo = coalesce(nullif(trim(p_modo), ''), 'ddp')
    -- Sin filtro de `valid_until` a propósito (migr 0458): una tarifa vencida
    -- sigue siendo el último precio que el founder puso, y es el que el sitio
    -- debe mostrar. Renovar la vigencia es trabajo del ERP, no condición de
    -- lectura.
    and (r.valid_from is null or r.valid_from <= current_date)
  order by r.valid_from desc nulls last, r.updated_at desc, r.id
  limit 1;
$$;

comment on function public.public_cbm_rate(text) is
  'Endpoint público (anon) de la tarifa por CBM del calculador del sitio. p_modo: ddp (default, Puerta a Puerta) | consolidado (LCL hasta puerto). Devuelve la fila is_public Y status=published del tenant dtd para esa modalidad: per_cbm + min_charge + valid_until. Retorno MÍNIMO, sin data comercial sensible. Un draft NUNCA se sirve. DESDE LA MIGR 0458 NO FILTRA POR VIGENCIA: una tarifa vencida se sigue sirviendo, porque es el último precio real que puso el founder y el sitio debe leer la base, no la constante de respaldo de lib/calculadora.ts. Renovar la vigencia es trabajo del ERP (badge de /studio/tarifas + cron rate-expiry-alert), no condición de lectura. Sí sigue filtrando valid_from: una tarifa PROGRAMADA a futuro no se adelanta. Singleton garantizado por rates_one_public_cbm_per_tenant_modo (migr 0255).';

-- Los grants no cambian respecto de 0255; se reafirman porque `create or
-- replace` no los toca y dejarlos escritos hace la migración autocontenida.
revoke all on function public.public_cbm_rate(text) from public;
grant execute on function public.public_cbm_rate(text) to anon, authenticated;
