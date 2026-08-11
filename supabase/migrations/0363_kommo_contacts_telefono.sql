-- CRM · el teléfono del contacto deja de vivir sólo dentro de un jsonb.
--
-- Hoy `kommo_contacts.custom_fields` guarda el array crudo de Kommo y el teléfono
-- hay que sacarlo parseando `[{field_code:'PHONE', values:[{value}]}]` en cada
-- consulta. Consecuencias medidas:
--   · `findKommoContactsByPhone` escanea 500 contactos recientes y compara en JS
--     — es "advisory" justamente porque no puede buscar de verdad.
--   · el universo de Recuperación se lee con un cap de 5.000 y se filtra en JS.
--   · el router del webhook carga hasta 10.000 clientes para cruzar por teléfono.
-- Todo eso son escaneos porque no hay nada indexable.
--
-- `phone_last10` es GENERADA, no escrita: `regexp_replace` y `right` son IMMUTABLE,
-- así que Postgres la mantiene sola y NO puede driftear respecto a `phone`. Un
-- valor derivado que alguien puede olvidar de actualizar es una fuente de bugs;
-- éste no se puede olvidar.
--
-- La expresión es la MISMA de `phoneKey` (_shared/kommo-router.ts) y del índice
-- `clients_phone_last10_idx` (migración 0342): los últimos 10 dígitos, y null si
-- hay menos de 10.
--
-- ⚠️ `regexp_replace`, `length` y `right` van calificados con `pg_catalog.`
-- (expresión de columna generada: no debe depender del search_path), pero
-- `coalesce` NO — es sintaxis SQL, no una función, y `pg_catalog.coalesce(...)`
-- da `42883: function does not exist`. La 0342 ya lo hacía así; calificarlo de
-- más costó un intento fallido de aplicar. Eso hace equivalentes "+58 412-1668021", "0412-1668021" y
-- "4121668021", y deja fuera los números incompletos — preferimos no cruzar antes
-- que cruzar con la persona equivocada.

set lock_timeout = '5s';
set statement_timeout = '120s';

do $preflight$
begin
  if to_regclass('public.kommo_contacts') is null then
    raise exception '0363 requiere public.kommo_contacts (migración 0082)';
  end if;
end;
$preflight$;

alter table public.kommo_contacts
  add column if not exists email text,
  add column if not exists phone text;

alter table public.kommo_contacts
  add column if not exists phone_last10 text
  generated always as (
    case
      when pg_catalog.length(
             pg_catalog.regexp_replace(coalesce(phone, ''), '\D', '', 'g')
           ) >= 10
      then pg_catalog."right"(
             pg_catalog.regexp_replace(coalesce(phone, ''), '\D', '', 'g'),
             10
           )
    end
  ) stored;

comment on column public.kommo_contacts.phone is
  'CRM: telefono del contacto, desnormalizado desde custom_fields (field_code PHONE). '
  'Lo escribe mapContactRow (_shared/kommo-mapping.ts), unico lugar del mapeo.';
comment on column public.kommo_contacts.phone_last10 is
  'CRM: ultimos 10 digitos de phone, o null si hay menos de 10. GENERADA: no puede '
  'driftear. Misma expresion que phoneKey() y que clients_phone_last10_idx (0342).';

-- El índice que convierte tres escaneos en búsquedas exactas.
create index if not exists kommo_contacts_phone_last10_idx
  on public.kommo_contacts (tenant_id, phone_last10)
  where phone_last10 is not null;

-- Búsqueda por email (la usa el dedupe del alta de clientes).
create index if not exists kommo_contacts_email_idx
  on public.kommo_contacts (tenant_id, lower(email))
  where email is not null;

-- ── Backfill de lo ya espejado ──────────────────────────────────────────────
-- Mismo criterio que `parseContactFields` (lib/studio/kommo-convert.ts): el
-- PRIMER field con ese code y valor no vacío. `phone_last10` se calcula sola.
update public.kommo_contacts c
   set email = sub.email,
       phone = sub.phone
  from (
    select k.tenant_id,
           k.id,
           (select f->'values'->0->>'value'
              from jsonb_array_elements(
                     case when jsonb_typeof(k.custom_fields) = 'array'
                          then k.custom_fields else '[]'::jsonb end
                   ) f
             where upper(coalesce(f->>'field_code', '')) = 'EMAIL'
               and coalesce(f->'values'->0->>'value', '') <> ''
             limit 1) as email,
           (select f->'values'->0->>'value'
              from jsonb_array_elements(
                     case when jsonb_typeof(k.custom_fields) = 'array'
                          then k.custom_fields else '[]'::jsonb end
                   ) f
             where upper(coalesce(f->>'field_code', '')) = 'PHONE'
               and coalesce(f->'values'->0->>'value', '') <> ''
             limit 1) as phone
      from public.kommo_contacts k
  ) sub
 where c.tenant_id = sub.tenant_id
   and c.id = sub.id
   and (c.email is distinct from sub.email or c.phone is distinct from sub.phone);
