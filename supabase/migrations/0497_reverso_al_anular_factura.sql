-- SDD-0573 / I3-B. Candidata local de FUENTE; controles NO EJECUTADOS.
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicar exige OK
--    nominal de Sam para este archivo. MIGRATE-FIRST no autoriza apply/merge.
-- Autoridad: 0573-I3B-encargo-fuente-director.md (b307acc5).
-- Líneas antes de cabecera, FK diferible, admisión protegida READ COMMITTED.
-- No prueba procedencia RPC, commit exterior, ausencia de deadlocks o DB real.
set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
declare
  v record;
  v_proc pg_catalog.pg_proc%rowtype;
  v_code pg_catalog.pg_constraint%rowtype;
  v_fk pg_catalog.pg_constraint%rowtype;
  v_md5 text;
  v_definer boolean;
  v_config text[];
  -- PG17 pg_get_expr mantiene orden, tipos y literales; no borra espacios.
  v_append_defaults constant text := $defaults$'succeeded'::text, NULL::text, NULL::jsonb, NULL::jsonb, '{}'::jsonb, NULL::text, 1, 'internal'::text$defaults$;
begin
  -- Precondición nominal heredada, antes de DDL y de otros pins de M9.
  if pg_catalog.to_regclass('public.invoices') is null or pg_catalog.to_regclass('public.journal_entries') is null
     or pg_catalog.to_regclass('public.journal_lines') is null or pg_catalog.to_regclass('public.payment_receipts') is null
     or pg_catalog.to_regclass('public.accounting_settings') is null or pg_catalog.to_regclass('public.user_tenants') is null
     or pg_catalog.to_regprocedure('public.get_user_tenant_id()') is null
     or pg_catalog.to_regprocedure('public.next_entry_code(uuid)') is null
     or pg_catalog.to_regprocedure('auth.uid()') is null then
    raise exception '0497 requiere invoices, journal_entries, journal_lines, payment_receipts, accounting_settings, user_tenants, get_user_tenant_id(), next_entry_code(uuid) y auth.uid()';
  end if;
  if exists (select 1 from pg_catalog.pg_attribute a where a.attrelid=pg_catalog.to_regclass('public.journal_entries')
     and a.attname='reverses_entry_id' and not a.attisdropped) then
    raise exception '0497 abortado: el reverso de asientos ya existe';
  end if;
  select pg_catalog.md5(pg_catalog.replace(p.prosrc,E'\r\n',E'\n')),p.prosecdef,p.proconfig
    into v_md5,v_definer,v_config from pg_catalog.pg_proc p
    where p.oid=pg_catalog.to_regprocedure('public.void_invoice_with_audit_reason(uuid,text)');
  if v_md5 is distinct from '76644e17876d0caaa46e727de5946138'
     or v_definer is distinct from false or v_config is distinct from array['search_path=""'] then
    raise exception '0497 abortado: void_invoice_with_audit_reason no es la de la 0294 (md5 %, definer %, config %)',
      v_md5,v_definer,v_config;
  end if;

  for v in select * from (values
      ('public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)','cd315c0780a4faac4e3d6e48c8415832','plpgsql','uuid',true,'v',array['search_path=""']::text[],array['p_tenant_id','p_entity_type','p_entity_id','p_actor_type','p_actor_id','p_event_type','p_source','p_result','p_reason','p_before_data','p_after_data','p_payload','p_correlation_id','p_schema_version','p_sensitivity']::text[],8),
      ('public.void_invoice_with_audit_reason(uuid,text)','76644e17876d0caaa46e727de5946138','plpgsql','boolean',false,'v',array['search_path=""']::text[],array['p_id','p_reason']::text[],0),
      ('public.append_audit_event_v1(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)','4b123fd01f9b6c78b040bedb090df4bf','plpgsql','uuid',true,'v',array['search_path=""']::text[],array['p_tenant_id','p_entity_type','p_entity_id','p_actor_type','p_actor_id','p_event_type','p_source','p_result','p_reason','p_before_data','p_after_data','p_payload','p_correlation_id','p_schema_version','p_sensitivity']::text[],8),
      ('public.audit_d2_financial_change()','651ae10230ca25196f5a7290d44aa172','plpgsql','trigger',true,'v',array['search_path=""']::text[],array[]::text[],0),
      ('public.excepcion_al_cierre_vigente(uuid)','f66b2bab0c89371fa56534278c7b5860','sql','boolean',true,'v',array['search_path=""']::text[],array['p_entry_id']::text[],0),
      ('public.journal_entries_validate_closing()','b62227b4908f55103d80c211c53f0c67','plpgsql','trigger',false,'v',array['search_path=public']::text[],array[]::text[],0),
      ('public.journal_lines_validate_closing()','2f8faeb6da1f43e55dfc8e06c94cd53e','plpgsql','trigger',false,'v',array['search_path=public']::text[],array[]::text[],0),
      ('public.get_accounting_closing_date(uuid)','7e5d5609120f003e2c21b89601cbc5a5','sql','date',true,'s',array['search_path=public']::text[],array['p_tenant_id']::text[],0),
      ('public.journal_entry_is_closed(uuid)','8114d6c6b43a00dea3731722c9bc7208','sql','boolean',true,'s',array['search_path=public']::text[],array['p_entry_id']::text[],0),
      ('public.next_entry_code(uuid)','6954cb3efb9db4ca131266964d4ed524','plpgsql','text',true,'v',array['search_path=public']::text[],array['p_tenant_id']::text[],0)
  ) pin(signature,body_md5,lang,return_type,definer,volatility,config,argnames,defaults)
  loop
    select p.* into v_proc from pg_catalog.pg_proc p
    where p.oid = pg_catalog.to_regprocedure(v.signature);
    if not found or v_proc.proowner <> 'postgres'::regrole
       or v_proc.prokind <> 'f' or v_proc.proretset or v_proc.proisstrict
       or v_proc.proleakproof or v_proc.proparallel <> 'u'
       or v_proc.provolatile::text <> v.volatility
       or v_proc.prosecdef <> v.definer or v_proc.provariadic <> 0
       or v_proc.proallargtypes is not null or v_proc.proargmodes is not null
       or coalesce(v_proc.proargnames,array[]::text[]) <> v.argnames
       or v_proc.pronargdefaults <> v.defaults
       or v_proc.prorettype <> pg_catalog.to_regtype(v.return_type)
       or v_proc.proconfig is distinct from v.config
       or (select l.lanname from pg_catalog.pg_language l where l.oid=v_proc.prolang) <> v.lang
       or pg_catalog.md5(pg_catalog.replace(v_proc.prosrc,E'\r\n',E'\n')) <> v.body_md5 then
      raise exception '0497: preflight función/cuerpo/config de % no coincide.',v.signature;
    end if;
    if (v.defaults=0 and v_proc.proargdefaults is not null)
       or (v.defaults<>0 and (v_proc.proargdefaults is null
         or pg_catalog.pg_get_expr(v_proc.proargdefaults,0::oid,false) is distinct from v_append_defaults)) then
      raise exception '0497: preflight defaults de % no coinciden.',v.signature;
    end if;
  end loop;


  -- Código: identidad estructural, UNIQUE inmediata no parcial, no sólo nombre.
  select c.* into v_code from pg_catalog.pg_constraint c
  where c.conrelid='public.journal_entries'::regclass
    and c.conname='journal_entries_tenant_id_entry_code_key';
  if not found or v_code.contype <> 'u' or not v_code.convalidated
     or v_code.condeferrable or v_code.condeferred
     or v_code.conkey <> array[
       (select attnum from pg_catalog.pg_attribute where attrelid=v_code.conrelid and attname='tenant_id' and not attisdropped),
       (select attnum from pg_catalog.pg_attribute where attrelid=v_code.conrelid and attname='entry_code' and not attisdropped)]::smallint[]
     or not exists (select 1 from pg_catalog.pg_index i join pg_catalog.pg_class idx on idx.oid=i.indexrelid
       join pg_catalog.pg_am am on am.oid=idx.relam
       where i.indexrelid=v_code.conindid and i.indrelid=v_code.conrelid
         and i.indisunique and i.indisvalid and i.indisready and i.indislive and i.indimmediate
         and not i.indisprimary and i.indnatts=2 and i.indnkeyatts=2
         and i.indexprs is null and i.indpred is null and am.amname='btree'
         and array(select x from unnest(i.indkey::smallint[]) x)=v_code.conkey) then
    raise exception '0497: M9 UNIQUE real de código incompatible.';
  end if;
  if (select count(*) from pg_catalog.pg_constraint c
      where c.connamespace='public'::regnamespace and c.conname='journal_lines_entry_id_fkey') <> 1 then
    raise exception '0497: M9 nombre FK no singular.';
  end if;
  select c.* into v_fk from pg_catalog.pg_constraint c
  where c.conrelid='public.journal_lines'::regclass and c.conname='journal_lines_entry_id_fkey';
  if not found or v_fk.contype <> 'f' or v_fk.confrelid <> 'public.journal_entries'::regclass
     or not v_fk.convalidated or v_fk.confdeltype <> 'c' or v_fk.confupdtype <> 'a'
     or v_fk.confmatchtype <> 's'
     or v_fk.conkey <> array[(select attnum from pg_catalog.pg_attribute where attrelid=v_fk.conrelid and attname='entry_id' and not attisdropped)]::smallint[]
     or v_fk.confkey <> array[(select attnum from pg_catalog.pg_attribute where attrelid=v_fk.confrelid and attname='id' and not attisdropped)]::smallint[]
     or not exists (select 1 from pg_catalog.pg_index i where i.indexrelid=v_fk.conindid
       and i.indrelid=v_fk.confrelid and i.indisprimary and i.indisunique
       and i.indisvalid and i.indisready and i.indislive and i.indimmediate
       and i.indnatts=1 and i.indnkeyatts=1 and i.indpred is null and i.indexprs is null
       and array(select x from unnest(i.indkey::smallint[]) x)=v_fk.confkey) then
    raise exception '0497: M9 FK de líneas incompatible.';
  end if;
  if not exists (select 1 from pg_catalog.pg_constraint c
      where c.conrelid='public.journal_entries'::regclass and c.conname='journal_entries_invoice_id_fkey'
        and c.contype='f' and c.confrelid='public.invoices'::regclass and c.convalidated
        and not c.condeferrable and not c.condeferred and c.confdeltype='n' and c.confupdtype='a'
        and c.confmatchtype='s'
        and c.conkey=array[(select attnum from pg_catalog.pg_attribute where attrelid=c.conrelid and attname='invoice_id' and not attisdropped)]::smallint[]
        and c.confkey=array[(select attnum from pg_catalog.pg_attribute where attrelid=c.confrelid and attname='id' and not attisdropped)]::smallint[]
        and exists(select 1 from pg_catalog.pg_index i where i.indexrelid=c.conindid
          and i.indrelid=c.confrelid and i.indisprimary and i.indisunique and i.indisvalid
          and i.indisready and i.indislive and i.indimmediate)) then
    raise exception '0497: M9 FK de factura incompatible.';
  end if;
  for v in select * from (values
    ('public.journal_lines','entry_id','uuid',-1,true),
    ('public.journal_lines','account_id','uuid',-1,true),
    ('public.journal_lines','debit','numeric',917510,true),
    ('public.journal_lines','credit','numeric',917510,true),
    ('public.journal_entries','id','uuid',-1,true),
    ('public.journal_entries','tenant_id','uuid',-1,true),
    ('public.journal_entries','entry_code','text',-1,true),
    ('public.journal_entries','entry_date','date',-1,true),
    ('public.journal_entries','invoice_id','uuid',-1,false),
    ('public.accounts','tenant_id','uuid',-1,true),
    ('public.accounts','code','text',-1,true),
    ('public.accounts','is_postable','boolean',-1,true),
    ('public.invoices','base_amount','numeric',917510,true),
    ('public.invoices','iva_amount','numeric',917510,true),
    ('public.invoices','total_amount','numeric',917510,true),
    ('public.invoices','issued_at','date',-1,false)
  ) col(rel,name,type_name,typmod,not_null)
  loop
    if not exists (select 1 from pg_catalog.pg_attribute a where a.attrelid=pg_catalog.to_regclass(v.rel)
      and a.attname=v.name and not a.attisdropped and a.atttypid=pg_catalog.to_regtype(v.type_name)
      and a.atttypmod=v.typmod and a.attnotnull=v.not_null) then
      raise exception '0497: M9 columna incompatible %.%.',v.rel,v.name;
    end if;
  end loop;
  if exists (select 1 from pg_catalog.pg_class c where c.oid in (
      'public.invoices'::regclass,'public.accounts'::regclass,
      'public.journal_entries'::regclass,'public.journal_lines'::regclass)
      and (c.relkind <> 'r' or not c.relrowsecurity)) then
    raise exception '0497: M9 relación/RLS incompatible.';
  end if;
  for v in select * from (values
    ('public.journal_entries','journal_entries_validate_closing_trg','public.journal_entries_validate_closing()',31),
    ('public.journal_lines','journal_lines_validate_closing_trg','public.journal_lines_validate_closing()',31),
    ('public.journal_entries','audit_d2_journal_entries','public.audit_d2_financial_change()',29),
    ('public.invoices','audit_d2_invoices','public.audit_d2_financial_change()',29)
  ) t(rel,name,fn,kind)
  loop
    if not exists (select 1 from pg_catalog.pg_trigger t where t.tgrelid=pg_catalog.to_regclass(v.rel)
      and t.tgname=v.name and t.tgfoid=pg_catalog.to_regprocedure(v.fn)
      and t.tgtype=v.kind and t.tgenabled='O' and not t.tgisinternal
      and t.tgconstraint=0 and not t.tgdeferrable and not t.tginitdeferred
      and t.tgnargs=0 and t.tgqual is null and t.tgattr=''::int2vector) then
      raise exception '0497: M9 trigger histórico incompatible %.%.',v.rel,v.name;
    end if;
  end loop;
  -- ACL efectiva del escritor real: incluye PUBLIC y membresías heredadas.
  if pg_catalog.has_function_privilege('anon',
      'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)','EXECUTE')
     or pg_catalog.has_function_privilege('authenticated',
      'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)','EXECUTE')
     or not pg_catalog.has_function_privilege('service_role',
      'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)','EXECUTE')
     or exists (select 1 from pg_catalog.pg_roles r where r.rolname in ('anon','authenticated','service_role')
       and pg_catalog.has_function_privilege(r.oid,
        'public.append_audit_event_v1(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)','EXECUTE')) then
    raise exception '0497: M9 ACL efectiva de append incompatible.';
  end if;

  if v_fk.condeferrable or v_fk.condeferred then
    raise exception '0497: M9 preimagen de diferibilidad FK incompatible.';
  end if;
  if exists (select 1 from pg_catalog.pg_constraint c where c.connamespace='public'::regnamespace
     and c.conname in ('i3_journal_entry_final_check','i3_invoice_final_check')) then
    raise exception '0497: nombres de constraints finales ya ocupados.';
  end if;
  if exists (select 1 from pg_catalog.pg_proc p where p.pronamespace='public'::regnamespace
    and p.proname in ('i3_lock_entry','i3_entry_protected','i3_sale_lines_valid','i3_original_valid','i3_mirror_valid','i3_assert_invoice_final','i3_assert_new_entry','i3_journal_entry_guard','i3_journal_line_guard','i3_invoice_guard','i3_journal_entry_final','i3_invoice_final','post_invoice_journal_entry_atomic')) then
    raise exception '0497: símbolos I3-B ya ocupados.';
  end if;
end;
$preflight$;

alter table public.journal_lines
  alter constraint journal_lines_entry_id_fkey deferrable initially immediate;
alter table public.journal_entries
  add column reverses_entry_id uuid
    constraint journal_entries_reverses_entry_id_fkey
    references public.journal_entries(id) on delete restrict;
create unique index journal_entries_un_reverso
  on public.journal_entries (reverses_entry_id) where reverses_entry_id is not null;
alter table public.journal_entries
  add constraint journal_entries_reverso_coherente check (
    (source = 'invoice_reversal') = (reverses_entry_id is not null)
  );

create function public.i3_lock_entry(p_entry_id uuid)
returns void language plpgsql volatile security definer set search_path = ''
as $function$
begin
  if p_entry_id is null then
    raise exception 'Identidad contable inválida.' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('dtd:i3:journal-entry:' || p_entry_id::text, 0));
end;
$function$;

create function public.i3_entry_protected(p_entry_id uuid)
returns boolean language sql volatile security definer set search_path = ''
as $function$
  select exists (
    select 1 from public.journal_entries e
    where e.id = p_entry_id and
      (e.source in ('invoice', 'invoice_reversal') or e.reverses_entry_id is not null)
  ) or exists (
    select 1 from public.journal_entries r where r.reverses_entry_id = p_entry_id
  )
$function$;

-- Integridad del original HISTÓRICO: nominal propio, no documento revalorado.
-- Las clases se acreditan por la jerarquía real, no por un prefijo del código.
-- Un ciclo, padre/cuenta de otro tenant o cuenta no imputable no acredita clase.
create function public.i3_sale_lines_valid(p_entry_id uuid, p_tenant_id uuid)
returns boolean language sql volatile security definer set search_path = ''
as $function$
  with recursive ancestry as (
    select l.id as line_id, a.id, a.parent_id, a.tenant_id, a.code,
           array[a.id] as seen
    from public.journal_lines l join public.accounts a on a.id = l.account_id
    where l.entry_id = p_entry_id and a.tenant_id = p_tenant_id and a.is_postable
    union all
    select c.line_id, a.id, a.parent_id, a.tenant_id, a.code, c.seen || a.id
    from ancestry c join public.accounts a on a.id = c.parent_id
    where a.tenant_id = p_tenant_id and not a.id = any(c.seen)
  ), classified as (
    select l.*, (select min(c.code) from ancestry c where c.line_id = l.id
                 and c.code in ('1.1.2','4.5','2.1.5') having count(*) = 1) as kind,
      not exists (select 1 from ancestry c where c.line_id = l.id and c.parent_id is not null
        and not exists (select 1 from public.accounts parent where parent.id = c.parent_id
          and parent.tenant_id = p_tenant_id and not parent.id = any(c.seen))) as ancestry_valid
    from public.journal_lines l where l.entry_id = p_entry_id
  )
  select count(*) >= 2
    and coalesce(bool_and(kind is not null and ancestry_valid
      and debit is not null and credit is not null
      and debit between 0 and 999999999999.99
      and credit between 0 and 999999999999.99
      and scale(debit) <= 2 and scale(credit) <= 2
      and (debit = 0 or credit = 0)
      and case kind when '1.1.2' then credit = 0 and debit > 0
                    when '4.5' then debit = 0
                    when '2.1.5' then debit = 0 and credit > 0
                    else false end), false)
    and count(*) filter (where kind = '1.1.2') = 1
    and count(*) filter (where kind = '4.5') >= 1
    and sum(debit) > 0 and sum(debit) = sum(credit)
  from classified
$function$;

create function public.i3_original_valid(p_entry_id uuid, p_tenant_id uuid, p_invoice_id uuid)
returns boolean language sql volatile security definer set search_path = ''
as $function$
  select exists (
    select 1 from public.journal_entries e
    where e.id = p_entry_id and e.tenant_id = p_tenant_id
      and e.invoice_id = p_invoice_id and e.source = 'invoice'
      and e.reverses_entry_id is null and e.status = 'asentado'
      and e.deleted_at is null and nullif(pg_catalog.btrim(e.entry_code),'') is not null
      and e.posted_at is not null
      and pg_catalog.isfinite(e.posted_at) and pg_catalog.isfinite(e.entry_date)
      and e.entry_date between date '0001-01-01' and date '9999-12-31'
      and public.i3_sale_lines_valid(e.id, p_tenant_id)
  )
$function$;

create function public.i3_mirror_valid(p_original uuid, p_reverse uuid)
returns boolean language sql volatile security definer set search_path = ''
as $function$
  select not exists (
    (select l.account_id, l.credit, l.debit from public.journal_lines l where l.entry_id = p_original
     except all
     select l.account_id, l.debit, l.credit from public.journal_lines l where l.entry_id = p_reverse)
    union all
    (select l.account_id, l.debit, l.credit from public.journal_lines l where l.entry_id = p_reverse
     except all
     select l.account_id, l.credit, l.debit from public.journal_lines l where l.entry_id = p_original)
  )
$function$;

-- Relee estado ACTUAL. Dos direcciones: reversal -> anulada y anulada -> par.
-- No impone el total actual del documento al original histórico íntegro90.
create function public.i3_assert_invoice_final(p_invoice_id uuid)
returns void language plpgsql volatile security definer set search_path = ''
as $function$
declare
  v_inv public.invoices%rowtype;
  v_original public.journal_entries%rowtype;
  v_reverse public.journal_entries%rowtype;
  v_all integer;
  v_originals integer;
  v_reversals integer;
begin
  if p_invoice_id is null then return; end if;
  select * into v_inv from public.invoices where id = p_invoice_id for update;
  select count(*), count(*) filter (where e.source = 'invoice' and e.reverses_entry_id is null),
         count(*) filter (where e.source = 'invoice_reversal')
    into v_all, v_originals, v_reversals
  from public.journal_entries e
  where (e.invoice_id = p_invoice_id and
          (e.source in ('invoice','invoice_reversal') or e.reverses_entry_id is not null))
     or e.reverses_entry_id in (select x.id from public.journal_entries x where x.invoice_id = p_invoice_id);
  if v_all = 0 then return; end if;
  if v_inv.id is null or v_inv.deleted_at is not null or v_originals <> 1
     or v_all <> v_originals + v_reversals then
    raise exception 'La relación contable de la factura requiere revisión.' using errcode = '23514';
  end if;
  select * into v_original from public.journal_entries
  where invoice_id = p_invoice_id and source = 'invoice' and reverses_entry_id is null;
  if not public.i3_original_valid(v_original.id, v_inv.tenant_id, p_invoice_id) then
    raise exception 'La venta original requiere revisión.' using errcode = '23514';
  end if;
  if v_inv.status = 'anulada' then
    if v_reversals <> 1 then
      raise exception 'Una factura anulada con venta requiere su reverso íntegro.' using errcode = '23514';
    end if;
    select * into v_reverse from public.journal_entries where reverses_entry_id = v_original.id;
    if v_reverse.id is null or v_reverse.source <> 'invoice_reversal'
       or v_reverse.invoice_id is distinct from p_invoice_id
       or v_reverse.tenant_id is distinct from v_inv.tenant_id
       or v_reverse.status <> 'asentado' or v_reverse.deleted_at is not null
       or v_reverse.posted_at is null or not pg_catalog.isfinite(v_reverse.posted_at)
       or not pg_catalog.isfinite(v_reverse.entry_date)
       or v_reverse.entry_date < v_original.entry_date
       or not public.i3_mirror_valid(v_original.id, v_reverse.id) then
      raise exception 'El par de anulación requiere revisión.' using errcode = '23514';
    end if;
  elsif v_inv.status::text not in ('emitida','parcial','vencida','pagada') or v_reversals <> 0 then
    raise exception 'Estado de factura y par contable incompatibles.' using errcode = '23514';
  end if;
end;
$function$;

-- Recibe NEW completo: la cabecera todavía no existe en la tabla.
create function public.i3_assert_new_entry(p_entry public.journal_entries)
returns void language plpgsql volatile security definer set search_path = ''
as $function$
declare
  v_inv public.invoices%rowtype;
  v_original public.journal_entries%rowtype;
  v_ar uuid;
  v_sales uuid;
  v_tax uuid;
  v_closing date;
  v_date date;
begin
  select * into v_inv from public.invoices where id = p_entry.invoice_id for update;
  if v_inv.id is null or v_inv.tenant_id is distinct from p_entry.tenant_id
     or v_inv.deleted_at is not null or p_entry.status <> 'asentado'
      or nullif(pg_catalog.btrim(p_entry.entry_code),'') is null
     or p_entry.deleted_at is not null or p_entry.posted_at is null
     or not pg_catalog.isfinite(p_entry.posted_at)
     or not pg_catalog.isfinite(p_entry.entry_date)
     or p_entry.entry_date not between date '0001-01-01' and date '9999-12-31' then
    raise exception 'Cabecera automática incompleta o incompatible.' using errcode = '23514';
  end if;
  -- Locks de cuentas antes de decidir y retenidos hasta fin de la TX exterior.
  perform a.id from public.accounts a where a.id in (
    select l.account_id from public.journal_lines l where l.entry_id = p_entry.id
  ) order by a.id for share;
  select closing_date into v_closing from public.accounting_settings where tenant_id = p_entry.tenant_id;
  if v_closing is not null and p_entry.entry_date <= v_closing then
    raise exception 'El nuevo asiento pertenece a un período cerrado.' using errcode = '23514';
  end if;
  if p_entry.source = 'invoice' and p_entry.reverses_entry_id is null then
    if v_inv.status::text not in ('emitida','parcial','vencida','pagada')
       or v_inv.issued_at is null or not pg_catalog.isfinite(v_inv.issued_at)
       or v_inv.issued_at not between date '0001-01-01' and date '9999-12-31'
       or p_entry.entry_date <> v_inv.issued_at
       or not (v_inv.base_amount between 0 and 999999999999.99
         and v_inv.iva_amount between 0 and 999999999999.99
         and v_inv.total_amount between 0 and 999999999999.99)
       or v_inv.base_amount is null or v_inv.iva_amount is null or v_inv.total_amount is null
       or scale(v_inv.base_amount) > 2 or scale(v_inv.iva_amount) > 2 or scale(v_inv.total_amount) > 2
       or v_inv.total_amount <= 0 or v_inv.total_amount <> v_inv.base_amount + v_inv.iva_amount
       or exists (select 1 from public.journal_entries e
          where e.invoice_id = v_inv.id and
            (e.source in ('invoice','invoice_reversal') or e.reverses_entry_id is not null))
       or exists (select 1 from public.journal_entries e where e.reverses_entry_id = p_entry.id) then
      raise exception 'La nueva venta no acredita el documento persistido.' using errcode = '23514';
    end if;
    select id into v_ar from public.accounts where tenant_id = p_entry.tenant_id and code = '1.1.2' and is_postable;
    select id into v_sales from public.accounts where tenant_id = p_entry.tenant_id and code = '4.5' and is_postable;
    select id into v_tax from public.accounts where tenant_id = p_entry.tenant_id and code = '2.1.5' and is_postable;
    if v_ar is null or v_sales is null or (v_inv.iva_amount > 0 and v_tax is null)
       or exists (
         (select l.account_id, l.debit, l.credit from public.journal_lines l where l.entry_id = p_entry.id
          except all
          select x.account_id, x.debit, x.credit from (
            values (1,v_ar, v_inv.total_amount, 0::numeric),
                   (2,v_sales, 0::numeric, v_inv.base_amount),
                   (3,v_tax, 0::numeric, v_inv.iva_amount)
          ) x(n,account_id,debit,credit) where x.n < 3 or v_inv.iva_amount > 0)
         union all
         (select x.account_id, x.debit, x.credit from (
            values (1,v_ar, v_inv.total_amount, 0::numeric),
                   (2,v_sales, 0::numeric, v_inv.base_amount),
                   (3,v_tax, 0::numeric, v_inv.iva_amount)
          ) x(n,account_id,debit,credit) where x.n < 3 or v_inv.iva_amount > 0
          except all
          select l.account_id, l.debit, l.credit from public.journal_lines l where l.entry_id = p_entry.id)
       ) then
      raise exception 'Las líneas de venta no son la fórmula nominal íntegra.' using errcode = '23514';
    end if;
  elsif p_entry.source = 'invoice_reversal' and p_entry.reverses_entry_id is not null then
    select * into v_original from public.journal_entries where id = p_entry.reverses_entry_id for update;
    v_date := greatest((pg_catalog.now() at time zone 'America/Caracas')::date,
                       coalesce(v_closing + 1, v_original.entry_date), v_original.entry_date);
    if v_inv.status::text not in ('emitida','parcial','vencida')
       or coalesce(v_inv.paid_amount,0) <> 0
       or exists (select 1 from public.payment_receipts where invoice_id = v_inv.id and deleted_at is null)
       or not public.i3_original_valid(v_original.id, p_entry.tenant_id, p_entry.invoice_id)
       or p_entry.entry_date <> v_date
       or exists (select 1 from public.journal_entries e
           where e.reverses_entry_id = v_original.id
              or (e.invoice_id = v_inv.id
                and (e.source in ('invoice','invoice_reversal') or e.reverses_entry_id is not null)
                and e.id <> v_original.id))
       or not public.i3_mirror_valid(v_original.id, p_entry.id) then
      raise exception 'El nuevo reverso no acredita un original íntegro.' using errcode = '23514';
    end if;
  else
    raise exception 'Origen o vínculo automático incompatible.' using errcode = '23514';
  end if;
end;
$function$;

create function public.i3_journal_entry_guard()
returns trigger language plpgsql volatile security definer set search_path = ''
as $function$
declare v_protected boolean;
begin
  if tg_op = 'INSERT' then
    v_protected := new.source in ('invoice','invoice_reversal')
      or new.reverses_entry_id is not null;
    if v_protected then
      if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then
        raise exception 'La operación contable requiere una transacción READ COMMITTED.' using errcode = '25000';
      end if;
      perform i.id from public.invoices i where i.id = new.invoice_id for update;
    end if;
    perform public.i3_lock_entry(new.id);
    -- También una cabecera manual relee después de esperar por el UUID.
    v_protected := v_protected or public.i3_entry_protected(new.id);
    if v_protected then perform public.i3_assert_new_entry(new); end if;
    return new;
  end if;
  -- OLD o NEW, incluidos los dos extremos y participación inversa.
  if old.source in ('invoice','invoice_reversal') or old.reverses_entry_id is not null
     or public.i3_entry_protected(old.id)
     or (tg_op = 'UPDATE' and
         (new.source in ('invoice','invoice_reversal') or new.reverses_entry_id is not null
          or public.i3_entry_protected(new.id))) then
    raise exception 'El asiento automático es inmutable; revisa su factura y reverso.' using errcode = '23514';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;

create function public.i3_journal_line_guard()
returns trigger language plpgsql volatile security definer set search_path = ''
as $function$
declare
  v_id uuid;
  v_parent public.journal_entries%rowtype;
begin
  if tg_op = 'DELETE' then
    perform public.i3_lock_entry(old.entry_id);
    -- Lectura decisoria SEPARADA del lock; sin ocultar tenant/estado/borrado.
    select * into v_parent from public.journal_entries where id = old.entry_id for key share;
    if not found then return old; end if; -- CASCADE manual RC/RR, sólo DELETE.
    if public.i3_entry_protected(old.entry_id) then
      raise exception 'No se alteran líneas de un asiento automático.' using errcode = '23514';
    end if;
    return old;
  end if;
  for v_id in select distinct x.id from unnest(
      case when tg_op = 'UPDATE' then array[old.entry_id,new.entry_id]
           else array[new.entry_id] end) x(id) order by x.id
  loop
    perform public.i3_lock_entry(v_id);
    select * into v_parent from public.journal_entries where id = v_id for key share;
    if found then
      if public.i3_entry_protected(v_id) then
        raise exception 'No se alteran líneas de un asiento automático.' using errcode = '23514';
      end if;
    elsif tg_op = 'UPDATE' then
      raise exception 'No se actualiza una línea sin cabecera.' using errcode = '23514';
    elsif pg_catalog.current_setting('transaction_isolation') <> 'read committed' then
      raise exception 'La operación contable requiere una transacción READ COMMITTED.' using errcode = '25000';
    end if;
  end loop;
  return new;
end;
$function$;

create function public.i3_invoice_guard()
returns trigger language plpgsql volatile security definer set search_path = ''
as $function$
declare v_has boolean;
begin
  if tg_op = 'INSERT' then return new; end if;
  -- La transición a anulada debe poder acreditar ausencia tras el lock aun si
  -- el posting concurrente no actualizó la fila de invoices.
  if (tg_op = 'DELETE' or (tg_op = 'UPDATE' and
      ((new.status = 'anulada' and old.status is distinct from new.status)
       or new.id is distinct from old.id or new.tenant_id is distinct from old.tenant_id
       or new.deleted_at is distinct from old.deleted_at)))
     and pg_catalog.current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'La operación contable requiere una transacción READ COMMITTED.' using errcode = '25000';
  end if;
  select exists (select 1 from public.journal_entries e
    where e.invoice_id in (old.id, case when tg_op = 'UPDATE' then new.id else old.id end)
      and (e.source in ('invoice','invoice_reversal') or e.reverses_entry_id is not null))
    into v_has;
  if v_has and (tg_op = 'DELETE' or
       (tg_op = 'UPDATE' and
        (new.id is distinct from old.id or new.tenant_id is distinct from old.tenant_id
         or new.deleted_at is distinct from old.deleted_at
         or (old.status = 'anulada' and new.status is distinct from old.status)))) then
    raise exception 'No se desvincula ni reabre una factura con asiento automático.' using errcode = '23514';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;

create function public.i3_journal_entry_final()
returns trigger language plpgsql volatile security definer set search_path = ''
as $function$
begin
  if tg_op <> 'INSERT' then perform public.i3_assert_invoice_final(old.invoice_id); end if;
  if tg_op <> 'DELETE' then perform public.i3_assert_invoice_final(new.invoice_id); end if;
  return null;
end;
$function$;

create function public.i3_invoice_final()
returns trigger language plpgsql volatile security definer set search_path = ''
as $function$
begin
  if tg_op <> 'INSERT' then perform public.i3_assert_invoice_final(old.id); end if;
  if tg_op <> 'DELETE' then perform public.i3_assert_invoice_final(new.id); end if;
  return null;
end;
$function$;

create trigger i3_journal_entry_guard
before insert or update or delete on public.journal_entries
for each row execute function public.i3_journal_entry_guard();
create trigger i3_journal_line_guard
before insert or update or delete on public.journal_lines
for each row execute function public.i3_journal_line_guard();
create trigger i3_invoice_guard
before insert or update or delete on public.invoices
for each row execute function public.i3_invoice_guard();
create constraint trigger i3_journal_entry_final_check
after insert or update or delete on public.journal_entries
deferrable initially deferred for each row execute function public.i3_journal_entry_final();
create constraint trigger i3_invoice_final_check
after insert or update or delete on public.invoices
deferrable initially deferred for each row execute function public.i3_invoice_final();

create function public.post_invoice_journal_entry_atomic(p_tenant_id uuid, p_invoice_id uuid)
returns jsonb language plpgsql volatile security definer
set search_path = '' set dtd.audit_reason = ''
as $function$
declare
  v_inv public.invoices%rowtype;
  v_entry public.journal_entries%rowtype;
  v_all integer;
  v_vivos integer;
  v_ar uuid;
  v_sales uuid;
  v_tax uuid;
  v_closing date;
  v_nuevo uuid;
  v_code text;
  v_result jsonb;
  v_schema text;
  v_table text;
  v_constraint text;
begin
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'La operación contable requiere una transacción READ COMMITTED.' using errcode = '25000';
  end if;
  if p_tenant_id is null or p_invoice_id is null then
    raise exception 'Identidad de factura inválida.' using errcode = '22023';
  end if;
  v_result := pg_catalog.jsonb_build_object('version',1,'outcome','not_posted',
    'invoice_id',p_invoice_id,'entry_id',null,'entry_code',null,'entry_date',null);
  select * into v_inv from public.invoices i
  where i.id = p_invoice_id and i.tenant_id = p_tenant_id for update;
  if not found or v_inv.deleted_at is not null then
    return v_result || pg_catalog.jsonb_build_object('reason','invoice_unavailable');
  end if;
  if v_inv.status::text not in ('emitida','parcial','vencida','pagada') then
    return v_result || pg_catalog.jsonb_build_object('reason','invoice_not_postable');
  end if;
  if v_inv.issued_at is null or not pg_catalog.isfinite(v_inv.issued_at)
     or v_inv.issued_at not between date '0001-01-01' and date '9999-12-31' then
    return v_result || pg_catalog.jsonb_build_object('reason','invalid_issue_date');
  end if;
  if v_inv.base_amount is null or v_inv.iva_amount is null or v_inv.total_amount is null
     or not (v_inv.base_amount between 0 and 999999999999.99
       and v_inv.iva_amount between 0 and 999999999999.99
       and v_inv.total_amount between 0 and 999999999999.99)
     or scale(v_inv.base_amount) > 2 or scale(v_inv.iva_amount) > 2 or scale(v_inv.total_amount) > 2 then
    return v_result || pg_catalog.jsonb_build_object('reason','invalid_amounts');
  end if;
  if v_inv.total_amount <> v_inv.base_amount + v_inv.iva_amount then
    return v_result || pg_catalog.jsonb_build_object('reason','totals_mismatch');
  end if;
  perform e.id from public.journal_entries e
  where e.invoice_id = p_invoice_id or e.reverses_entry_id in (
    select x.id from public.journal_entries x where x.invoice_id = p_invoice_id)
  order by e.id for update;
  perform l.id from public.journal_lines l where l.entry_id in (
    select e.id from public.journal_entries e where e.invoice_id = p_invoice_id)
  order by l.id for update;
  perform a.id from public.accounts a where a.id in (
    select l.account_id from public.journal_lines l join public.journal_entries e on e.id = l.entry_id
    where e.invoice_id = p_invoice_id) order by a.id for share;
  select count(*), count(*) filter (where e.source = 'invoice' and e.reverses_entry_id is null)
    into v_all, v_vivos
  from public.journal_entries e
  where (e.invoice_id = p_invoice_id and
       (e.source in ('invoice','invoice_reversal') or e.reverses_entry_id is not null))
     or e.reverses_entry_id in (select x.id from public.journal_entries x where x.invoice_id = p_invoice_id);
  if v_all > 0 then
    select * into v_entry from public.journal_entries where invoice_id = p_invoice_id and source = 'invoice';
    if v_all <> 1 or v_vivos <> 1 or
       not public.i3_original_valid(v_entry.id,p_tenant_id,p_invoice_id) then
      return v_result || pg_catalog.jsonb_build_object('reason','existing_sale_requires_review');
    end if;
    return pg_catalog.jsonb_build_object('version',1,'outcome','already_posted',
      'reason','entry_already_exists','invoice_id',p_invoice_id,
      'entry_id',v_entry.id,'entry_code',v_entry.entry_code,
      'entry_date',pg_catalog.to_char(v_entry.entry_date,'YYYY-MM-DD'));
  end if;
  if v_inv.total_amount = 0 then
    return v_result || pg_catalog.jsonb_build_object('reason','zero_total');
  end if;
  perform a.id from public.accounts a
  where a.tenant_id = p_tenant_id and a.code in ('1.1.2','4.5','2.1.5') order by a.id for share;
  select id into v_ar from public.accounts where tenant_id = p_tenant_id and code = '1.1.2' and is_postable;
  select id into v_sales from public.accounts where tenant_id = p_tenant_id and code = '4.5' and is_postable;
  select id into v_tax from public.accounts where tenant_id = p_tenant_id and code = '2.1.5' and is_postable;
  if v_ar is null or v_sales is null or (v_inv.iva_amount > 0 and v_tax is null) then
    return v_result || pg_catalog.jsonb_build_object('reason','missing_accounts');
  end if;
  select closing_date into v_closing from public.accounting_settings where tenant_id = p_tenant_id;
  if v_closing is not null and v_inv.issued_at <= v_closing then
    return v_result || pg_catalog.jsonb_build_object('reason','period_closed');
  end if;
  v_nuevo := pg_catalog.gen_random_uuid();
  perform public.i3_lock_entry(v_nuevo);
  -- Normalización retroactiva, sólo después de descartar lectura/no-op.
  set constraints public.journal_lines_entry_id_fkey,
    public.i3_journal_entry_final_check, public.i3_invoice_final_check immediate;
  for v_intento in 1..3 loop
    begin
      set constraints public.journal_lines_entry_id_fkey,
        public.i3_journal_entry_final_check, public.i3_invoice_final_check deferred;
      v_code := public.next_entry_code(p_tenant_id);
      insert into public.journal_lines(entry_id,account_id,debit,credit,line_memo) values
        (v_nuevo,v_ar,v_inv.total_amount,0,'Factura ' || v_inv.invoice_code),
        (v_nuevo,v_sales,0,v_inv.base_amount,'Ingreso de factura ' || v_inv.invoice_code);
      if v_inv.iva_amount > 0 then
        insert into public.journal_lines(entry_id,account_id,debit,credit,line_memo)
        values(v_nuevo,v_tax,0,v_inv.iva_amount,'IVA de factura ' || v_inv.invoice_code);
      end if;
      insert into public.journal_entries(id,tenant_id,entry_code,entry_date,memo,status,source,invoice_id,posted_at)
      values(v_nuevo,p_tenant_id,v_code,v_inv.issued_at,'Factura ' || v_inv.invoice_code,
             'asentado','invoice',p_invoice_id,pg_catalog.clock_timestamp());
      perform public.i3_assert_invoice_final(p_invoice_id);
      set constraints public.journal_lines_entry_id_fkey,
        public.i3_journal_entry_final_check, public.i3_invoice_final_check immediate;
      return pg_catalog.jsonb_build_object('version',1,'outcome','posted','reason','posted',
        'invoice_id',p_invoice_id,'entry_id',v_nuevo,'entry_code',v_code,
        'entry_date',pg_catalog.to_char(v_inv.issued_at,'YYYY-MM-DD'));
    exception when unique_violation then
      get stacked diagnostics v_schema = schema_name, v_table = table_name, v_constraint = constraint_name;
      if v_schema is distinct from 'public' or v_table is distinct from 'journal_entries'
         or v_constraint is distinct from 'journal_entries_tenant_id_entry_code_key'
         or v_intento = 3 then raise; end if;
    end;
  end loop;
  raise exception 'No se confirmó el asiento.' using errcode = '40001';
end;
$function$;

create or replace function public.void_invoice_with_audit_reason(p_id uuid, p_reason text)
returns boolean language plpgsql volatile security definer
set search_path = '' set dtd.audit_reason = ''
as $function$
declare
  v_reason text := nullif(pg_catalog.btrim(p_reason), '');
  v_tenant uuid;
  v_hoy date;
  v_inv public.invoices%rowtype;
  v_entry public.journal_entries%rowtype;
  v_recibos integer;
  v_vivos integer;
  v_all integer;
  v_debe numeric;
  v_haber numeric;
  v_cierre date;
  v_fecha date;
  v_code text;
  v_nuevo uuid;
  v_memo text;
  v_schema text;
  v_table text;
  v_constraint text;
begin
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'La operación contable requiere una transacción READ COMMITTED.' using errcode = '25000';
  end if;
  if v_reason is null or pg_catalog.char_length(v_reason) not between 4 and 1000 then
    raise exception 'audit: reason debe tener entre 4 y 1000 caracteres' using errcode = '22023';
  end if;
  v_tenant := public.get_user_tenant_id();
  if v_tenant is null or not exists (
    select 1 from public.user_tenants ut
    where ut.user_id = (select auth.uid()) and ut.tenant_id = v_tenant
      and ut.disabled_at is null and pg_catalog.lower(pg_catalog.btrim(ut.role)) in ('admin', 'accounting')
  ) then
    raise exception 'Solo admin o contabilidad anulan una factura.' using errcode = '42501', hint = 'dtd-anular';
  end if;
  select * into v_inv from public.invoices i
  where i.id = p_id and i.tenant_id = v_tenant
  for update;
  if not found or v_inv.deleted_at is not null or v_inv.status in ('pagada','anulada') then return false; end if;
  if exists (select 1 from public.payment_receipts r
      where r.invoice_id = p_id and r.tenant_id is distinct from v_tenant) then
    raise exception 'Los vínculos de cobro requieren revisión.' using errcode = '55000', hint = 'dtd-anular';
  end if;
  select pg_catalog.count(*) into v_recibos from public.payment_receipts r
  where r.invoice_id = p_id and r.tenant_id = v_tenant and r.deleted_at is null;
  if v_recibos > 0 then
    raise exception 'La factura tiene % cobro(s) vivo(s): anúlalos primero en Cobranzas.', v_recibos
      using errcode = '55000', hint = 'dtd-anular';
  end if;
  if coalesce(v_inv.paid_amount, 0) > 0 then
    raise exception 'La factura tiene % aplicado sin recibo (un crédito de referido o un reporte de pago): revierte el crédito antes de anular.',
      pg_catalog.to_char(v_inv.paid_amount,'FM999999999990.00') using errcode = '55000', hint = 'dtd-anular';
  end if;
  perform e.id from public.journal_entries e
  where e.invoice_id = p_id or e.reverses_entry_id in (
    select x.id from public.journal_entries x where x.invoice_id = p_id)
  order by e.id for update;
  perform l.id from public.journal_lines l where l.entry_id in (
    select e.id from public.journal_entries e where e.invoice_id = p_id)
  order by l.id for update;
  perform a.id from public.accounts a where a.id in (
    select l.account_id from public.journal_lines l join public.journal_entries e on e.id = l.entry_id
    where e.invoice_id = p_id) order by a.id for share;
  select count(*), count(*) filter (where e.source = 'invoice' and e.status = 'asentado' and e.deleted_at is null)
    into v_all,v_vivos from public.journal_entries e
  where (e.invoice_id = p_id and
      (e.source in ('invoice','invoice_reversal') or e.reverses_entry_id is not null))
     or e.reverses_entry_id in (select x.id from public.journal_entries x where x.invoice_id = p_id);
  if v_vivos > 1 then
    raise exception 'La factura tiene % asientos de venta vivos: revisa el libro diario antes de anular.', v_vivos
      using errcode = '55000', hint = 'dtd-anular';
  end if;
  if v_vivos <> v_all then
    raise exception 'Los antecedentes de venta requieren revisión.' using errcode = '55000', hint = 'dtd-anular';
  end if;
  if v_vivos = 1 then
    select * into v_entry from public.journal_entries where invoice_id = p_id and source = 'invoice';
    select sum(l.debit),sum(l.credit) into v_debe,v_haber from public.journal_lines l where l.entry_id = v_entry.id;
    if v_debe is null or v_debe = 0 or v_debe <> v_haber
       or not public.i3_original_valid(v_entry.id,v_tenant,p_id) then
      raise exception 'El asiento de venta % no cuadra: revisa el libro diario antes de anular.', v_entry.entry_code
        using errcode = '55000', hint = 'dtd-anular';
    end if;
    v_hoy := (pg_catalog.now() at time zone 'America/Caracas')::date;
    select closing_date into v_cierre from public.accounting_settings where tenant_id = v_tenant;
    v_fecha := greatest(v_hoy, coalesce(v_cierre + 1,v_hoy), v_entry.entry_date);
    v_memo := pg_catalog.format('Reverso de la factura %s (asiento %s del %s).',
      v_inv.invoice_code,v_entry.entry_code,pg_catalog.to_char(v_entry.entry_date,'YYYY-MM-DD'))
      || case when v_cierre is not null and v_entry.entry_date <= v_cierre
              then ' — período cerrado: el reverso va en el período abierto.' else '' end;
    v_nuevo := pg_catalog.gen_random_uuid();
    perform public.i3_lock_entry(v_nuevo);
    set constraints public.journal_lines_entry_id_fkey,
      public.i3_journal_entry_final_check, public.i3_invoice_final_check immediate;
    for v_intento in 1..3 loop
      begin
        set constraints public.journal_lines_entry_id_fkey,
          public.i3_journal_entry_final_check, public.i3_invoice_final_check deferred;
        v_code := public.next_entry_code(v_tenant);
        insert into public.journal_lines(entry_id,account_id,debit,credit,line_memo)
        select v_nuevo,l.account_id,l.credit,l.debit,
          pg_catalog.format('Reverso: factura %s; asiento %s.',v_inv.invoice_code,v_entry.entry_code)
        from public.journal_lines l where l.entry_id = v_entry.id order by l.id;
        insert into public.journal_entries(id,tenant_id,entry_code,entry_date,memo,status,source,invoice_id,reverses_entry_id,posted_at)
        values(v_nuevo,v_tenant,v_code,v_fecha,v_memo,'asentado','invoice_reversal',p_id,v_entry.id,pg_catalog.clock_timestamp());
        perform pg_catalog.set_config('dtd.audit_reason', v_reason, true);
        update public.invoices set status = 'anulada' where id = p_id;
        perform pg_catalog.set_config('dtd.audit_reason', '', true);
        perform public.i3_assert_invoice_final(p_id);
        set constraints public.journal_lines_entry_id_fkey,
          public.i3_journal_entry_final_check, public.i3_invoice_final_check immediate;
        return true;
      exception when unique_violation then
        get stacked diagnostics v_schema = schema_name, v_table = table_name, v_constraint = constraint_name;
        if v_schema is distinct from 'public' or v_table is distinct from 'journal_entries'
           or v_constraint is distinct from 'journal_entries_tenant_id_entry_code_key'
           or v_intento = 3 then raise; end if;
      end;
    end loop;
    raise exception 'No se confirmó el reverso.' using errcode = '40001';
  end if;
  perform pg_catalog.set_config('dtd.audit_reason', v_reason, true);
  update public.invoices set status = 'anulada' where id = p_id;
  return true;
end;
$function$;

alter function public.i3_lock_entry(uuid) owner to postgres;
revoke all on function public.i3_lock_entry(uuid) from public, anon, authenticated, service_role;
alter function public.i3_entry_protected(uuid) owner to postgres;
revoke all on function public.i3_entry_protected(uuid) from public, anon, authenticated, service_role;
alter function public.i3_sale_lines_valid(uuid,uuid) owner to postgres;
revoke all on function public.i3_sale_lines_valid(uuid,uuid) from public, anon, authenticated, service_role;
alter function public.i3_original_valid(uuid,uuid,uuid) owner to postgres;
revoke all on function public.i3_original_valid(uuid,uuid,uuid) from public, anon, authenticated, service_role;
alter function public.i3_mirror_valid(uuid,uuid) owner to postgres;
revoke all on function public.i3_mirror_valid(uuid,uuid) from public, anon, authenticated, service_role;
alter function public.i3_assert_invoice_final(uuid) owner to postgres;
revoke all on function public.i3_assert_invoice_final(uuid) from public, anon, authenticated, service_role;
alter function public.i3_assert_new_entry(public.journal_entries) owner to postgres;
revoke all on function public.i3_assert_new_entry(public.journal_entries) from public, anon, authenticated, service_role;
alter function public.i3_journal_entry_guard() owner to postgres;
revoke all on function public.i3_journal_entry_guard() from public, anon, authenticated, service_role;
alter function public.i3_journal_line_guard() owner to postgres;
revoke all on function public.i3_journal_line_guard() from public, anon, authenticated, service_role;
alter function public.i3_invoice_guard() owner to postgres;
revoke all on function public.i3_invoice_guard() from public, anon, authenticated, service_role;
alter function public.i3_journal_entry_final() owner to postgres;
revoke all on function public.i3_journal_entry_final() from public, anon, authenticated, service_role;
alter function public.i3_invoice_final() owner to postgres;
revoke all on function public.i3_invoice_final() from public, anon, authenticated, service_role;
alter function public.post_invoice_journal_entry_atomic(uuid,uuid) owner to postgres;
revoke all on function public.post_invoice_journal_entry_atomic(uuid,uuid) from public, anon, authenticated, service_role;
alter function public.void_invoice_with_audit_reason(uuid,text) owner to postgres;
revoke all on function public.void_invoice_with_audit_reason(uuid,text) from public, anon, authenticated, service_role;
grant execute on function public.post_invoice_journal_entry_atomic(uuid,uuid) to service_role;
grant execute on function public.void_invoice_with_audit_reason(uuid,text) to authenticated;

do $postflight$
declare
  v record;
  v_proc pg_catalog.pg_proc%rowtype;
  v_code pg_catalog.pg_constraint%rowtype;
  v_fk pg_catalog.pg_constraint%rowtype;
  v_append_defaults constant text := $defaults$'succeeded'::text, NULL::text, NULL::jsonb, NULL::jsonb, '{}'::jsonb, NULL::text, 1, 'internal'::text$defaults$;
begin
  if not exists (select 1 from pg_catalog.pg_proc p
      where p.oid=pg_catalog.to_regprocedure('public.void_invoice_with_audit_reason(uuid,text)')
      and p.prosecdef and p.proconfig=array['search_path=""','dtd.audit_reason=']) then
    raise exception '0497: postflight — void_invoice_with_audit_reason tiene que ser DEFINER con search_path vacío';
  end if;
  if pg_catalog.has_function_privilege('anon','public.void_invoice_with_audit_reason(uuid,text)','EXECUTE')
     or not pg_catalog.has_function_privilege('authenticated','public.void_invoice_with_audit_reason(uuid,text)','EXECUTE') then
    raise exception '0497: postflight — la ACL de void_invoice_with_audit_reason no es la esperada';
  end if;

  for v in select * from (values
      ('public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)','cd315c0780a4faac4e3d6e48c8415832','plpgsql','uuid',true,'v',array['search_path=""']::text[],array['p_tenant_id','p_entity_type','p_entity_id','p_actor_type','p_actor_id','p_event_type','p_source','p_result','p_reason','p_before_data','p_after_data','p_payload','p_correlation_id','p_schema_version','p_sensitivity']::text[],8),
      ('public.append_audit_event_v1(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)','4b123fd01f9b6c78b040bedb090df4bf','plpgsql','uuid',true,'v',array['search_path=""']::text[],array['p_tenant_id','p_entity_type','p_entity_id','p_actor_type','p_actor_id','p_event_type','p_source','p_result','p_reason','p_before_data','p_after_data','p_payload','p_correlation_id','p_schema_version','p_sensitivity']::text[],8),
      ('public.audit_d2_financial_change()','651ae10230ca25196f5a7290d44aa172','plpgsql','trigger',true,'v',array['search_path=""']::text[],array[]::text[],0),
      ('public.excepcion_al_cierre_vigente(uuid)','f66b2bab0c89371fa56534278c7b5860','sql','boolean',true,'v',array['search_path=""']::text[],array['p_entry_id']::text[],0),
      ('public.journal_entries_validate_closing()','b62227b4908f55103d80c211c53f0c67','plpgsql','trigger',false,'v',array['search_path=public']::text[],array[]::text[],0),
      ('public.journal_lines_validate_closing()','2f8faeb6da1f43e55dfc8e06c94cd53e','plpgsql','trigger',false,'v',array['search_path=public']::text[],array[]::text[],0),
      ('public.get_accounting_closing_date(uuid)','7e5d5609120f003e2c21b89601cbc5a5','sql','date',true,'s',array['search_path=public']::text[],array['p_tenant_id']::text[],0),
      ('public.journal_entry_is_closed(uuid)','8114d6c6b43a00dea3731722c9bc7208','sql','boolean',true,'s',array['search_path=public']::text[],array['p_entry_id']::text[],0),
      ('public.next_entry_code(uuid)','6954cb3efb9db4ca131266964d4ed524','plpgsql','text',true,'v',array['search_path=public']::text[],array['p_tenant_id']::text[],0)
  ) pin(signature,body_md5,lang,return_type,definer,volatility,config,argnames,defaults)
  loop
    select p.* into v_proc from pg_catalog.pg_proc p
    where p.oid = pg_catalog.to_regprocedure(v.signature);
    if not found or v_proc.proowner <> 'postgres'::regrole
       or v_proc.prokind <> 'f' or v_proc.proretset or v_proc.proisstrict
       or v_proc.proleakproof or v_proc.proparallel <> 'u'
       or v_proc.provolatile::text <> v.volatility
       or v_proc.prosecdef <> v.definer or v_proc.provariadic <> 0
       or v_proc.proallargtypes is not null or v_proc.proargmodes is not null
       or coalesce(v_proc.proargnames,array[]::text[]) <> v.argnames
       or v_proc.pronargdefaults <> v.defaults
       or v_proc.prorettype <> pg_catalog.to_regtype(v.return_type)
       or v_proc.proconfig is distinct from v.config
       or (select l.lanname from pg_catalog.pg_language l where l.oid=v_proc.prolang) <> v.lang
       or pg_catalog.md5(pg_catalog.replace(v_proc.prosrc,E'\r\n',E'\n')) <> v.body_md5 then
      raise exception '0497: postflight predecesor conservado función/cuerpo/config de % no coincide.',v.signature;
    end if;
    if (v.defaults=0 and v_proc.proargdefaults is not null)
       or (v.defaults<>0 and (v_proc.proargdefaults is null
         or pg_catalog.pg_get_expr(v_proc.proargdefaults,0::oid,false) is distinct from v_append_defaults)) then
      raise exception '0497: postflight defaults de % no coinciden.',v.signature;
    end if;
  end loop;


  for v in select * from (values
      ('public.i3_lock_entry(uuid)','b18d630a5be03fa9fb49d9c846a70f1d','plpgsql','void',true,'v',array['search_path=""']::text[],array['p_entry_id']::text[],0),
      ('public.i3_entry_protected(uuid)','b650efe8f1a40a3b37d6856129618849','sql','boolean',true,'v',array['search_path=""']::text[],array['p_entry_id']::text[],0),
      ('public.i3_sale_lines_valid(uuid,uuid)','51f21e245b78c000abe7b20724222eec','sql','boolean',true,'v',array['search_path=""']::text[],array['p_entry_id','p_tenant_id']::text[],0),
      ('public.i3_original_valid(uuid,uuid,uuid)','7fd39538887599082e6383757676ce4c','sql','boolean',true,'v',array['search_path=""']::text[],array['p_entry_id','p_tenant_id','p_invoice_id']::text[],0),
      ('public.i3_mirror_valid(uuid,uuid)','c8a247834035e2af6b69d1c87b6b52a8','sql','boolean',true,'v',array['search_path=""']::text[],array['p_original','p_reverse']::text[],0),
      ('public.i3_assert_invoice_final(uuid)','cddbdb9d4e395d067a01d2f75e8b5e61','plpgsql','void',true,'v',array['search_path=""']::text[],array['p_invoice_id']::text[],0),
      ('public.i3_assert_new_entry(public.journal_entries)','c81d50be044e20fb007e843c5339d887','plpgsql','void',true,'v',array['search_path=""']::text[],array['p_entry']::text[],0),
      ('public.i3_journal_entry_guard()','a82e26776290eb51e73a08392d7d51ba','plpgsql','trigger',true,'v',array['search_path=""']::text[],array[]::text[],0),
      ('public.i3_journal_line_guard()','623893ae4724af5359c820d70270c7cc','plpgsql','trigger',true,'v',array['search_path=""']::text[],array[]::text[],0),
      ('public.i3_invoice_guard()','637aaf6c7bd814b52487860345e6f0ad','plpgsql','trigger',true,'v',array['search_path=""']::text[],array[]::text[],0),
      ('public.i3_journal_entry_final()','6c5b873a11a19f22a7ca8cee5921ca24','plpgsql','trigger',true,'v',array['search_path=""']::text[],array[]::text[],0),
      ('public.i3_invoice_final()','8ec1d7a86931583d14e5780cdbb1dcb2','plpgsql','trigger',true,'v',array['search_path=""']::text[],array[]::text[],0),
      ('public.post_invoice_journal_entry_atomic(uuid,uuid)','ddc746bd3510af63eb3daf3b47c342db','plpgsql','jsonb',true,'v',array['search_path=""','dtd.audit_reason=']::text[],array['p_tenant_id','p_invoice_id']::text[],0),
      ('public.void_invoice_with_audit_reason(uuid,text)','df593256d4e6381a787969818863355d','plpgsql','boolean',true,'v',array['search_path=""','dtd.audit_reason=']::text[],array['p_id','p_reason']::text[],0)
  ) pin(signature,body_md5,lang,return_type,definer,volatility,config,argnames,defaults)
  loop
    select p.* into v_proc from pg_catalog.pg_proc p
    where p.oid = pg_catalog.to_regprocedure(v.signature);
    if not found or v_proc.proowner <> 'postgres'::regrole
       or v_proc.prokind <> 'f' or v_proc.proretset or v_proc.proisstrict
       or v_proc.proleakproof or v_proc.proparallel <> 'u'
       or v_proc.provolatile::text <> v.volatility
       or v_proc.prosecdef <> v.definer or v_proc.provariadic <> 0
       or v_proc.proallargtypes is not null or v_proc.proargmodes is not null
       or coalesce(v_proc.proargnames,array[]::text[]) <> v.argnames
       or v_proc.pronargdefaults <> v.defaults
       or v_proc.prorettype <> pg_catalog.to_regtype(v.return_type)
       or v_proc.proconfig is distinct from v.config
       or (select l.lanname from pg_catalog.pg_language l where l.oid=v_proc.prolang) <> v.lang
       or pg_catalog.md5(pg_catalog.replace(v_proc.prosrc,E'\r\n',E'\n')) <> v.body_md5 then
      raise exception '0497: postflight I3-B función/cuerpo/config de % no coincide.',v.signature;
    end if;
    if v_proc.proargdefaults is not null then
      raise exception '0497: postflight defaults de % no coinciden.',v.signature;
    end if;
  end loop;


  -- Código: identidad estructural, UNIQUE inmediata no parcial, no sólo nombre.
  select c.* into v_code from pg_catalog.pg_constraint c
  where c.conrelid='public.journal_entries'::regclass
    and c.conname='journal_entries_tenant_id_entry_code_key';
  if not found or v_code.contype <> 'u' or not v_code.convalidated
     or v_code.condeferrable or v_code.condeferred
     or v_code.conkey <> array[
       (select attnum from pg_catalog.pg_attribute where attrelid=v_code.conrelid and attname='tenant_id' and not attisdropped),
       (select attnum from pg_catalog.pg_attribute where attrelid=v_code.conrelid and attname='entry_code' and not attisdropped)]::smallint[]
     or not exists (select 1 from pg_catalog.pg_index i join pg_catalog.pg_class idx on idx.oid=i.indexrelid
       join pg_catalog.pg_am am on am.oid=idx.relam
       where i.indexrelid=v_code.conindid and i.indrelid=v_code.conrelid
         and i.indisunique and i.indisvalid and i.indisready and i.indislive and i.indimmediate
         and not i.indisprimary and i.indnatts=2 and i.indnkeyatts=2
         and i.indexprs is null and i.indpred is null and am.amname='btree'
         and array(select x from unnest(i.indkey::smallint[]) x)=v_code.conkey) then
    raise exception '0497: M9 UNIQUE real de código incompatible.';
  end if;
  if (select count(*) from pg_catalog.pg_constraint c
      where c.connamespace='public'::regnamespace and c.conname='journal_lines_entry_id_fkey') <> 1 then
    raise exception '0497: M9 nombre FK no singular.';
  end if;
  select c.* into v_fk from pg_catalog.pg_constraint c
  where c.conrelid='public.journal_lines'::regclass and c.conname='journal_lines_entry_id_fkey';
  if not found or v_fk.contype <> 'f' or v_fk.confrelid <> 'public.journal_entries'::regclass
     or not v_fk.convalidated or v_fk.confdeltype <> 'c' or v_fk.confupdtype <> 'a'
     or v_fk.confmatchtype <> 's'
     or v_fk.conkey <> array[(select attnum from pg_catalog.pg_attribute where attrelid=v_fk.conrelid and attname='entry_id' and not attisdropped)]::smallint[]
     or v_fk.confkey <> array[(select attnum from pg_catalog.pg_attribute where attrelid=v_fk.confrelid and attname='id' and not attisdropped)]::smallint[]
     or not exists (select 1 from pg_catalog.pg_index i where i.indexrelid=v_fk.conindid
       and i.indrelid=v_fk.confrelid and i.indisprimary and i.indisunique
       and i.indisvalid and i.indisready and i.indislive and i.indimmediate
       and i.indnatts=1 and i.indnkeyatts=1 and i.indpred is null and i.indexprs is null
       and array(select x from unnest(i.indkey::smallint[]) x)=v_fk.confkey) then
    raise exception '0497: M9 FK de líneas incompatible.';
  end if;
  if not exists (select 1 from pg_catalog.pg_constraint c
      where c.conrelid='public.journal_entries'::regclass and c.conname='journal_entries_invoice_id_fkey'
        and c.contype='f' and c.confrelid='public.invoices'::regclass and c.convalidated
        and not c.condeferrable and not c.condeferred and c.confdeltype='n' and c.confupdtype='a'
        and c.confmatchtype='s'
        and c.conkey=array[(select attnum from pg_catalog.pg_attribute where attrelid=c.conrelid and attname='invoice_id' and not attisdropped)]::smallint[]
        and c.confkey=array[(select attnum from pg_catalog.pg_attribute where attrelid=c.confrelid and attname='id' and not attisdropped)]::smallint[]
        and exists(select 1 from pg_catalog.pg_index i where i.indexrelid=c.conindid
          and i.indrelid=c.confrelid and i.indisprimary and i.indisunique and i.indisvalid
          and i.indisready and i.indislive and i.indimmediate)) then
    raise exception '0497: M9 FK de factura incompatible.';
  end if;
  for v in select * from (values
    ('public.journal_lines','entry_id','uuid',-1,true),
    ('public.journal_lines','account_id','uuid',-1,true),
    ('public.journal_lines','debit','numeric',917510,true),
    ('public.journal_lines','credit','numeric',917510,true),
    ('public.journal_entries','id','uuid',-1,true),
    ('public.journal_entries','tenant_id','uuid',-1,true),
    ('public.journal_entries','entry_code','text',-1,true),
    ('public.journal_entries','entry_date','date',-1,true),
    ('public.journal_entries','invoice_id','uuid',-1,false),
    ('public.accounts','tenant_id','uuid',-1,true),
    ('public.accounts','code','text',-1,true),
    ('public.accounts','is_postable','boolean',-1,true),
    ('public.invoices','base_amount','numeric',917510,true),
    ('public.invoices','iva_amount','numeric',917510,true),
    ('public.invoices','total_amount','numeric',917510,true),
    ('public.invoices','issued_at','date',-1,false)
  ) col(rel,name,type_name,typmod,not_null)
  loop
    if not exists (select 1 from pg_catalog.pg_attribute a where a.attrelid=pg_catalog.to_regclass(v.rel)
      and a.attname=v.name and not a.attisdropped and a.atttypid=pg_catalog.to_regtype(v.type_name)
      and a.atttypmod=v.typmod and a.attnotnull=v.not_null) then
      raise exception '0497: M9 columna incompatible %.%.',v.rel,v.name;
    end if;
  end loop;
  if exists (select 1 from pg_catalog.pg_class c where c.oid in (
      'public.invoices'::regclass,'public.accounts'::regclass,
      'public.journal_entries'::regclass,'public.journal_lines'::regclass)
      and (c.relkind <> 'r' or not c.relrowsecurity)) then
    raise exception '0497: M9 relación/RLS incompatible.';
  end if;
  for v in select * from (values
    ('public.journal_entries','journal_entries_validate_closing_trg','public.journal_entries_validate_closing()',31),
    ('public.journal_lines','journal_lines_validate_closing_trg','public.journal_lines_validate_closing()',31),
    ('public.journal_entries','audit_d2_journal_entries','public.audit_d2_financial_change()',29),
    ('public.invoices','audit_d2_invoices','public.audit_d2_financial_change()',29)
  ) t(rel,name,fn,kind)
  loop
    if not exists (select 1 from pg_catalog.pg_trigger t where t.tgrelid=pg_catalog.to_regclass(v.rel)
      and t.tgname=v.name and t.tgfoid=pg_catalog.to_regprocedure(v.fn)
      and t.tgtype=v.kind and t.tgenabled='O' and not t.tgisinternal
      and t.tgconstraint=0 and not t.tgdeferrable and not t.tginitdeferred
      and t.tgnargs=0 and t.tgqual is null and t.tgattr=''::int2vector) then
      raise exception '0497: M9 trigger histórico incompatible %.%.',v.rel,v.name;
    end if;
  end loop;
  -- ACL efectiva del escritor real: incluye PUBLIC y membresías heredadas.
  if pg_catalog.has_function_privilege('anon',
      'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)','EXECUTE')
     or pg_catalog.has_function_privilege('authenticated',
      'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)','EXECUTE')
     or not pg_catalog.has_function_privilege('service_role',
      'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)','EXECUTE')
     or exists (select 1 from pg_catalog.pg_roles r where r.rolname in ('anon','authenticated','service_role')
       and pg_catalog.has_function_privilege(r.oid,
        'public.append_audit_event_v1(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)','EXECUTE')) then
    raise exception '0497: M9 ACL efectiva de append incompatible.';
  end if;

  if not v_fk.condeferrable or v_fk.condeferred then
    raise exception '0497: M9 FK debe ser DEFERRABLE INITIALLY IMMEDIATE.';
  end if;
  -- RI reales: CASCADE conserva acción inmediata; no toda RI se vuelve diferida.
  if (select count(*) from pg_catalog.pg_trigger t where t.tgconstraint=v_fk.oid) <> 4
     or exists (select 1 from pg_catalog.pg_trigger t join pg_catalog.pg_proc p on p.oid=t.tgfoid
       where t.tgconstraint=v_fk.oid and
         (not t.tgisinternal or t.tgenabled<>'O' or t.tgnargs<>0 or t.tgqual is not null or t.tginitdeferred
          or not (
            (t.tgrelid=v_fk.confrelid and p.proname='RI_FKey_cascade_del' and t.tgtype=9 and not t.tgdeferrable)
            or (t.tgrelid=v_fk.confrelid and p.proname='RI_FKey_noaction_upd' and t.tgtype=17 and t.tgdeferrable)
            or (t.tgrelid=v_fk.conrelid and p.proname='RI_FKey_check_ins' and t.tgtype=5 and t.tgdeferrable)
            or (t.tgrelid=v_fk.conrelid and p.proname='RI_FKey_check_upd' and t.tgtype=17 and t.tgdeferrable)
          ))) then
    raise exception '0497: M9 enlaces RI de FK incompatibles.';
  end if;
  if not exists (select 1 from pg_catalog.pg_attribute a
      where a.attrelid='public.journal_entries'::regclass and a.attname='reverses_entry_id'
        and a.atttypid='uuid'::regtype and not a.attisdropped and not a.attnotnull)
     or not exists (select 1 from pg_catalog.pg_constraint c
      where c.conrelid='public.journal_entries'::regclass and c.conname='journal_entries_reverses_entry_id_fkey'
        and c.contype='f' and c.confrelid=c.conrelid and c.convalidated
        and not c.condeferrable and not c.condeferred and c.confdeltype='r'
        and c.confupdtype='a' and c.confmatchtype='s'
        and c.conkey=array[(select attnum from pg_catalog.pg_attribute where attrelid=c.conrelid and attname='reverses_entry_id')]::smallint[]
        and c.confkey=array[(select attnum from pg_catalog.pg_attribute where attrelid=c.confrelid and attname='id')]::smallint[]
        and exists (select 1 from pg_catalog.pg_index i where i.indexrelid=c.conindid
          and i.indrelid=c.confrelid and i.indisprimary and i.indisvalid and i.indisunique
          and i.indisready and i.indislive and i.indimmediate and i.indnatts=1 and i.indnkeyatts=1
          and i.indexprs is null and i.indpred is null
          and array(select x from unnest(i.indkey::smallint[]) x)=c.confkey)) then
    raise exception '0497: M9 FK RESTRICT del reverso incompatible.';
  end if;
  select c.* into v_fk from pg_catalog.pg_constraint c
  where c.conrelid='public.journal_entries'::regclass and c.conname='journal_entries_reverses_entry_id_fkey';
  if (select count(*) from pg_catalog.pg_trigger t where t.tgconstraint=v_fk.oid) <> 4
     or exists (select 1 from pg_catalog.pg_trigger t join pg_catalog.pg_proc p on p.oid=t.tgfoid
       where t.tgconstraint=v_fk.oid and
         (not t.tgisinternal or t.tgenabled<>'O' or t.tgnargs<>0 or t.tgqual is not null
          or t.tgdeferrable or t.tginitdeferred or not (
            (t.tgrelid=v_fk.confrelid and p.proname='RI_FKey_restrict_del' and t.tgtype=9)
            or (t.tgrelid=v_fk.confrelid and p.proname='RI_FKey_noaction_upd' and t.tgtype=17)
            or (t.tgrelid=v_fk.conrelid and p.proname='RI_FKey_check_ins' and t.tgtype=5)
            or (t.tgrelid=v_fk.conrelid and p.proname='RI_FKey_check_upd' and t.tgtype=17)
          ))) then
    raise exception '0497: M9 enlaces RI del reverso incompatibles.';
  end if;
  if not exists (select 1 from pg_catalog.pg_constraint c
      where c.conrelid='public.journal_entries'::regclass and c.conname='journal_entries_reverso_coherente'
        and c.contype='c' and c.convalidated and not c.condeferrable and not c.condeferred
        and pg_catalog.regexp_replace(pg_catalog.pg_get_expr(c.conbin,c.conrelid),'[[:space:]()]','','g')
          = 'source=''invoice_reversal''::text=reverses_entry_idISNOTNULL') then
    raise exception '0497: M9 CHECK del reverso incompatible.';
  end if;
  if not exists (select 1 from pg_catalog.pg_index i join pg_catalog.pg_class idx on idx.oid=i.indexrelid
      join pg_catalog.pg_am am on am.oid=idx.relam
      where i.indexrelid=pg_catalog.to_regclass('public.journal_entries_un_reverso')
        and i.indrelid='public.journal_entries'::regclass and idx.relnamespace='public'::regnamespace
        and i.indisunique and i.indisvalid and i.indisready and i.indislive and i.indimmediate
        and not i.indisprimary and i.indnatts=1 and i.indnkeyatts=1 and i.indexprs is null
        and am.amname='btree'
        and array(select x from unnest(i.indkey::smallint[]) x)=array[
          (select attnum from pg_catalog.pg_attribute where attrelid=i.indrelid and attname='reverses_entry_id')]::smallint[]
        and pg_catalog.regexp_replace(pg_catalog.pg_get_expr(i.indpred,i.indrelid),'[[:space:]()]','','g')
          = 'reverses_entry_idISNOTNULL') then
    raise exception '0497: M9 índice UNIQUE del reverso incompatible.';
  end if;
  for v in select * from (values
    ('public.journal_entries','i3_journal_entry_guard','public.i3_journal_entry_guard()',31,false),
    ('public.journal_lines','i3_journal_line_guard','public.i3_journal_line_guard()',31,false),
    ('public.invoices','i3_invoice_guard','public.i3_invoice_guard()',31,false),
    ('public.journal_entries','i3_journal_entry_final_check','public.i3_journal_entry_final()',29,true),
    ('public.invoices','i3_invoice_final_check','public.i3_invoice_final()',29,true)
  ) t(rel,name,fn,kind,deferred)
  loop
    if not exists (select 1 from pg_catalog.pg_trigger t where t.tgrelid=pg_catalog.to_regclass(v.rel)
      and t.tgname=v.name and t.tgfoid=pg_catalog.to_regprocedure(v.fn)
      and t.tgtype=v.kind and t.tgenabled='O' and not t.tgisinternal and t.tgnargs=0
      and t.tgqual is null and t.tgattr=''::int2vector
      and t.tgdeferrable=v.deferred and t.tginitdeferred=v.deferred
      and case when v.deferred then exists (select 1 from pg_catalog.pg_constraint c
          where c.oid=t.tgconstraint and c.contype='t' and c.connamespace='public'::regnamespace
            and c.conrelid=t.tgrelid and c.conname=v.name and c.convalidated
            and c.condeferrable and c.condeferred
            and (select count(*) from pg_catalog.pg_constraint other
                 where other.connamespace=c.connamespace and other.conname=c.conname)=1)
          else t.tgconstraint=0 end) then
      raise exception '0497: M9 trigger I3-B incompatible %.%.',v.rel,v.name;
    end if;
  end loop;
  for v in select * from (values
    ('public.i3_lock_entry(uuid)','owner_only'),
    ('public.i3_entry_protected(uuid)','owner_only'),
    ('public.i3_sale_lines_valid(uuid,uuid)','owner_only'),
    ('public.i3_original_valid(uuid,uuid,uuid)','owner_only'),
    ('public.i3_mirror_valid(uuid,uuid)','owner_only'),
    ('public.i3_assert_invoice_final(uuid)','owner_only'),
    ('public.i3_assert_new_entry(public.journal_entries)','owner_only'),
    ('public.i3_journal_entry_guard()','owner_only'),
    ('public.i3_journal_line_guard()','owner_only'),
    ('public.i3_invoice_guard()','owner_only'),
    ('public.i3_journal_entry_final()','owner_only'),
    ('public.i3_invoice_final()','owner_only'),
    ('public.post_invoice_journal_entry_atomic(uuid,uuid)','service_role'),
    ('public.void_invoice_with_audit_reason(uuid,text)','authenticated')
  ) allowed(signature,api_role)
  loop
    if exists (select 1 from pg_catalog.pg_proc p,
        lateral pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
        where p.oid=pg_catalog.to_regprocedure(v.signature) and a.grantee=0 and a.privilege_type='EXECUTE')
       or exists (select 1 from pg_catalog.pg_roles r where r.rolname in ('anon','authenticated','service_role')
          and pg_catalog.has_function_privilege(r.oid,v.signature,'EXECUTE')
            is distinct from (r.rolname=v.api_role)) then
      raise exception '0497: M9 ACL efectiva/heredada incompatible de %.',v.signature;
    end if;
  end loop;
  for v in select unnest(array['i3_lock_entry','i3_entry_protected','i3_sale_lines_valid','i3_original_valid','i3_mirror_valid','i3_assert_invoice_final','i3_assert_new_entry','i3_journal_entry_guard','i3_journal_line_guard','i3_invoice_guard','i3_journal_entry_final','i3_invoice_final','post_invoice_journal_entry_atomic','void_invoice_with_audit_reason']) as name
  loop
    if (select count(*) from pg_catalog.pg_proc p where p.pronamespace='public'::regnamespace and p.proname=v.name) <> 1 then
      raise exception '0497: M9 sobrecarga no autorizada de %.',v.name;
    end if;
  end loop;
  if not pg_catalog.has_schema_privilege('service_role','public','USAGE')
     or not pg_catalog.has_schema_privilege('authenticated','public','USAGE') then
    raise exception '0497: M9 schema public no accesible por roles previstos.';
  end if;
end;
$postflight$;
reset statement_timeout;
reset lock_timeout;
