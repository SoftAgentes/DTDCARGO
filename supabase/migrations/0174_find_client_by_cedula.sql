-- ─────────────────────────────────────────────────────────────
-- SDD-0106 (Fase 1): lookup del cliente por cédula (normalizado).
--
-- Primitiva de "ubicar al cliente por cédula primero": normaliza el documento
-- igual que el índice único (upper + sin puntos/guiones, espejo de 0095) y
-- devuelve el cliente del tenant del caller. SECURITY INVOKER → la RLS de
-- clients aplica como el caller (solo su tenant). Devuelve 0 o 1 fila.
--
-- NO aplicar a prod (lo hace la coordinación / founder).
-- ─────────────────────────────────────────────────────────────

create or replace function public.find_client_by_cedula(p_doc text)
returns setof public.clients
language sql
stable
security invoker
set search_path = public
as $$
  select *
  from public.clients
  where deleted_at is null
    and rif is not null
    and btrim(rif) <> ''
    and upper(regexp_replace(rif,   '[^A-Za-z0-9]', '', 'g'))
      = upper(regexp_replace(p_doc, '[^A-Za-z0-9]', '', 'g'))
  limit 1;
$$;

comment on function public.find_client_by_cedula is
  'SDD-0106: cliente del tenant por cédula/RIF normalizada (espejo de clients_tenant_doc_unique, 0095). SECURITY INVOKER → RLS por tenant. 0 o 1 fila.';

revoke all on function public.find_client_by_cedula(text) from public;
revoke execute on function public.find_client_by_cedula(text) from anon;
grant execute on function public.find_client_by_cedula(text) to authenticated;
