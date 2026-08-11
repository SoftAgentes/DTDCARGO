-- CRM · vínculo lead ↔ contacto en el espejo de Kommo.
--
-- El problema: `kommo_leads` guarda `name` y nada más de la persona. No tiene
-- teléfono, no tiene email y NO tiene referencia al contacto. Por eso ninguna
-- pantalla del ERP puede mostrar un teléfono al lado de un lead — la única que
-- muestra teléfonos (Recuperación) parte de `kommo_contacts`, no de leads.
-- Medido 2026-08-11: 3.151 leads, 1.683 contactos con teléfono, CERO forma de
-- cruzarlos.
--
-- La API lo regala: `GET /api/v4/leads?with=contacts` embebe
-- `_embedded.contacts: [{id, is_main}]` **sin costar requests extra** — es el
-- mismo endpoint que el sync ya pagina.
--
-- Por qué tabla puente y no una columna `main_contact_id` en kommo_leads:
--   1. Kommo modela N:N. Una columna pierde información.
--   2. Escribir en `kommo_leads` chocaría con el trigger `kommo_discard_stale_update`
--      (migración 0107): un webhook fuera de orden descartaría el UPDATE y con él
--      el vínculo, sin dejar rastro.
--
-- ⚠️ SIN foreign key a `kommo_contacts`, a propósito. El webhook puede ver un lead
-- cuyo contacto todavía no está espejado (el sync ordena contactos→leads, pero el
-- webhook no garantiza nada). Una FK ahí convertiría un orden de llegada en un
-- error de espejado.

set lock_timeout = '5s';
set statement_timeout = '60s';

do $preflight$
begin
  if to_regclass('public.kommo_leads') is null then
    raise exception '0362 requiere public.kommo_leads (migración 0082)';
  end if;
  if to_regprocedure('public.get_user_tenant_id()') is null then
    raise exception '0362 requiere get_user_tenant_id() para la RLS del espejo';
  end if;
end;
$preflight$;

create table if not exists public.kommo_lead_contacts (
  tenant_id  uuid    not null,
  lead_id    bigint  not null,
  contact_id bigint  not null,
  is_main    boolean not null default false,
  synced_at  timestamptz not null default now(),
  primary key (tenant_id, lead_id, contact_id),
  -- Compuesta: si el webhook borra el lead, sus vínculos se van con él.
  foreign key (tenant_id, lead_id)
    references public.kommo_leads (tenant_id, id) on delete cascade
);

comment on table public.kommo_lead_contacts is
  'CRM: vinculo lead <-> contacto de Kommo (_embedded.contacts de /api/v4/leads?with=contacts). '
  'Es lo que permite mostrar el telefono al lado del lead. SIN FK a kommo_contacts a proposito: '
  'el webhook puede ver un lead cuyo contacto aun no esta espejado.';

-- "¿de qué leads es contacto esta persona?" — el cruce inverso.
create index if not exists kommo_lead_contacts_contact_idx
  on public.kommo_lead_contacts (tenant_id, contact_id);

-- Un lead tiene UN contacto principal como máximo.
create unique index if not exists kommo_lead_contacts_main_idx
  on public.kommo_lead_contacts (tenant_id, lead_id)
  where is_main;

-- ── Permisos (patrón del resto del espejo, 0082 / 0343) ─────────────────────
grant select on public.kommo_lead_contacts to authenticated;
grant all    on public.kommo_lead_contacts to service_role;

alter table public.kommo_lead_contacts enable row level security;

drop policy if exists "kommo_lead_contacts tenant read" on public.kommo_lead_contacts;
create policy "kommo_lead_contacts tenant read"
  on public.kommo_lead_contacts for select to authenticated
  using (tenant_id = public.get_user_tenant_id());

drop policy if exists "kommo_lead_contacts service all" on public.kommo_lead_contacts;
create policy "kommo_lead_contacts service all"
  on public.kommo_lead_contacts for all to service_role
  using (true) with check (true);

-- ── Reemplazo de vínculos, con la MISMA guarda de orden que la 0107 ─────────
--
-- `kommo_lead_contacts` no hereda el trigger `kommo_discard_stale_update` porque
-- es otra tabla. Sin esta comparación, un webhook que llega tarde con un snapshot
-- viejo pisaría vínculos más nuevos — justo lo que la 0107 existe para impedir en
-- `kommo_leads`. La regla es la misma: si el snapshot es más viejo que lo
-- espejado, no se toca nada.
create or replace function public.kommo_replace_lead_contacts(
  p_tenant_id        uuid,
  p_lead_id          bigint,
  p_links            jsonb,
  p_lead_updated_at  timestamptz default null
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current timestamptz;
  v_n int;
begin
  select kommo_updated_at into v_current
    from public.kommo_leads
   where tenant_id = p_tenant_id and id = p_lead_id;

  -- Gemelo de kommo_discard_stale_update (0107): un snapshot viejo no pisa nada.
  if v_current is not null
     and p_lead_updated_at is not null
     and p_lead_updated_at < v_current then
    return -1;  -- descartado por orden; distinto de 0 ("no vino ningún vínculo")
  end if;

  delete from public.kommo_lead_contacts
   where tenant_id = p_tenant_id and lead_id = p_lead_id;

  insert into public.kommo_lead_contacts (tenant_id, lead_id, contact_id, is_main)
  select p_tenant_id,
         p_lead_id,
         (e->>'id')::bigint,
         coalesce((e->>'is_main')::boolean, false)
    from jsonb_array_elements(coalesce(p_links, '[]'::jsonb)) e
   where e ? 'id'
  on conflict (tenant_id, lead_id, contact_id) do update
     set is_main = excluded.is_main, synced_at = now();

  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

comment on function public.kommo_replace_lead_contacts(uuid, bigint, jsonb, timestamptz) is
  'CRM: reemplaza los vinculos de UN lead. Devuelve -1 si descarta por orden '
  '(snapshot mas viejo que el espejado, gemelo de la 0107), o la cantidad insertada.';

-- Versión por lotes: el sync procesa ~3.100 leads por corrida y una llamada por
-- lead serían 3.100 round-trips. Recibe [{lead_id, updated_at, links:[...]}].
create or replace function public.kommo_replace_lead_contacts_bulk(
  p_tenant_id uuid,
  p_rows      jsonb
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r         jsonb;
  v_total   int := 0;
  v_one     int;
begin
  for r in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb))
  loop
    v_one := public.kommo_replace_lead_contacts(
      p_tenant_id,
      (r->>'lead_id')::bigint,
      coalesce(r->'links', '[]'::jsonb),
      nullif(r->>'updated_at', '')::timestamptz
    );
    if v_one > 0 then
      v_total := v_total + v_one;
    end if;
  end loop;
  return v_total;
end;
$$;

comment on function public.kommo_replace_lead_contacts_bulk(uuid, jsonb) is
  'CRM: reemplazo de vinculos por lotes para el sync. Devuelve el total insertado.';

-- Sólo el backend (edge functions) escribe el espejo. `authenticated` lee la
-- tabla por RLS, pero no puede reemplazar vínculos.
revoke execute on function public.kommo_replace_lead_contacts(uuid, bigint, jsonb, timestamptz) from public, anon, authenticated;
revoke execute on function public.kommo_replace_lead_contacts_bulk(uuid, jsonb) from public, anon, authenticated;
grant  execute on function public.kommo_replace_lead_contacts(uuid, bigint, jsonb, timestamptz) to service_role;
grant  execute on function public.kommo_replace_lead_contacts_bulk(uuid, jsonb) to service_role;
