-- ─────────────────────────────────────────────────────────────
-- SDD-0043 Fase B — pg_cron: pull periódico READ-ONLY de Kommo.
-- kommo_run_sync() lee el service key de Vault (kommo_cron_key) e invoca la
-- Edge Function kommo-sync vía pg_net (HTTP). NUNCA escribe/borra en Kommo.
-- Intervalo LIVIANO por ahora (1×/día 07:00 UTC); subir en fases posteriores.
-- ─────────────────────────────────────────────────────────────

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.kommo_run_sync()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key    text;
  v_req_id bigint;
begin
  select decrypted_secret into v_key
  from vault.decrypted_secrets
  where name = 'kommo_cron_key'
  limit 1;

  if v_key is null then
    raise notice '[kommo_run_sync] kommo_cron_key no está en Vault — salteo';
    return null;
  end if;

  select net.http_post(
    url     := 'https://xpfuzqombmjmxvprjgmi.supabase.co/functions/v1/kommo-sync',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || v_key,
                 'apikey',        v_key
               ),
    body    := jsonb_build_object('tenant_id', '4ede88a0-b9c4-49ff-962b-e5a5014776e6')
  ) into v_req_id;

  return v_req_id;
end;
$$;

comment on function public.kommo_run_sync() is
  'SDD-0043 Fase B: invoca kommo-sync (read-only) leyendo el service key de Vault (kommo_cron_key). La corre pg_cron.';

revoke execute on function public.kommo_run_sync() from public, anon, authenticated;
grant  execute on function public.kommo_run_sync() to service_role;

-- Schedule LIVIANO: 1×/día 07:00 UTC. (Subir frecuencia en fases posteriores.)
select cron.schedule('kommo-sync-dtd', '0 7 * * *', $job$select public.kommo_run_sync();$job$);
