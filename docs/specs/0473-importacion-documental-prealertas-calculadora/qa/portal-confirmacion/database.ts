import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import type { SupabaseClient } from "@supabase/supabase-js";
import { emptyDocumentDraft } from "@/lib/shared/document-import";

export const IDS={tenant:"11111111-1111-4111-8111-111111111111",client:"22222222-2222-4222-8222-222222222222",purchase:"33333333-3333-4333-8333-333333333333",user:"44444444-4444-4444-8444-444444444444",token:"55555555-5555-4555-8555-555555555555"};
export const CODE="DTD-DEMO-1-1";
export async function createDemoDatabase(root:string) {
  const pg=new PGlite();
  const migration=(name:string)=>readFileSync(path.join(root,"supabase/migrations",name),"utf8");
  function fn(sql:string,name:string){const pattern="function public."+name;const start=sql.lastIndexOf("create",sql.indexOf(pattern));const end=sql.indexOf("$$;",sql.indexOf("as $$",start));if(start<0||end<0)throw new Error("Missing SQL function");return sql.slice(start,end+3);}
  await pg.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create schema storage;create table auth.users(id uuid primary key);
    create table public.tenants(id uuid primary key);
    create table public.clients(id uuid primary key,tenant_id uuid,name text,markbox text,deleted_at timestamptz);
    create table public.prealertas(id uuid primary key default gen_random_uuid(),tenant_id uuid,client_markbox text,code text,boxes integer default 1,status text default 'anunciada',deleted_at timestamptz);
    create table public.warehouse_boxes(id uuid primary key default gen_random_uuid(),tenant_id uuid,prealerta_id uuid,receipt_id uuid,status text,code text,seq integer,markbox text,client_name text,deleted_at timestamptz,created_at timestamptz default now());
    create table public.consolidation_box_positions(box_id uuid);
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`);
  const base=migration("0147_supplier_packing_uploads.sql");
  await pg.exec(base.slice(base.indexOf("create type packing_list_currency"),base.indexOf("comment on table public.packing_list_submissions")));
  await pg.exec("alter table public.packing_list_submissions add column supplier_address text,add column supplier_city text;");
  for(const [source,name] of [[base,"next_packing_list_folio"],[migration("0148_packing_list_supplier_address.sql"),"submit_packing_list"],[migration("0244_warehouse_boxes_predeclaradas.sql"),"sync_boxes_for_prealerta"],[migration("0244_warehouse_boxes_predeclaradas.sql"),"prealertas_sync_boxes"],[migration("0449_prealerta_exact_box_reception.sql"),"reconcile_labels_after_packing_list"]])await pg.exec(fn(source,name));
  await pg.exec(`create trigger prealertas_sync_boxes_ins after insert on prealertas for each row execute function prealertas_sync_boxes();
    create trigger prealertas_sync_boxes_upd after update of boxes,status on prealertas for each row when(old.boxes is distinct from new.boxes or (old.status is distinct from new.status and new.status='cancelada')) execute function prealertas_sync_boxes();
    create trigger packing_list_reconcile_labels after insert on packing_list_submissions for each row when(new.is_current and new.deleted_at is null) execute function reconcile_labels_after_packing_list();`);
  await pg.exec(migration("0457_document_import_workspaces.sql"));
  await pg.query("insert into tenants values($1)",[IDS.tenant]);
  await pg.query("insert into clients(id,tenant_id,name,markbox)values($1,$2,'Cliente ficticio','DTD-DEMO')",[IDS.client,IDS.tenant]);
  await pg.query("insert into auth.users values($1)",[IDS.user]);
  await pg.query("insert into prealertas(id,tenant_id,client_markbox,code)values($1,$2,'DTD-DEMO',$3)",[IDS.purchase,IDS.tenant,CODE]);
  const draft=emptyDocumentDraft();draft.supplier.company="供应商示例 · Proveedor de ejemplo";draft.supplier.wechat="demo-wechat";draft.docDate="2026-10-21";
  const created=await pg.query<{id:string}>("select (create_document_workspace($1,$2,$3,$4::jsonb,null,null,null)).id",[IDS.tenant,IDS.client,IDS.purchase,JSON.stringify(draft)]);
  const workspaceId=created.rows[0].id;
  const ident=(value:string)=>{if(!/^[a-z_][a-z0-9_]*$/.test(value))throw new Error("Invalid SQL identifier");return '"'+value+'"';};
  const from=(table:string)=>{
    const filters:{column:string;operator:string;value:unknown}[]=[];let columns="*",order="";
    const execute=async()=>{try{const params:unknown[]=[];const where=filters.map(filter=>{const column=ident(filter.column);if(filter.operator==="is")return `${column} is null`;if(filter.operator==="in"){const values=filter.value as unknown[];return `${column} in (${values.map(value=>{params.push(value);return "$"+params.length;}).join(",")})`;}params.push(filter.value);return `${column} ${filter.operator} $${params.length}`;}).join(" and ");const result=await pg.query(`select ${columns==="*"?"*":columns.split(",").map(ident).join(",")} from ${ident(table)}${where?" where "+where:""}${order}`,params);return {data:result.rows,error:null};}catch(error){return {data:null,error};}};
    const chain={select(value:string){columns=value;return chain;},eq(column:string,value:unknown){filters.push({column,operator:"=",value});return chain;},neq(column:string,value:unknown){filters.push({column,operator:"<>",value});return chain;},is(column:string,value:unknown){filters.push({column,operator:"is",value});return chain;},in(column:string,value:unknown[]){filters.push({column,operator:"in",value});return chain;},order(column:string,options?:{ascending?:boolean}){order=` order by ${ident(column)} ${options?.ascending===false?"desc":"asc"}`;return chain;},async maybeSingle(){const result=await execute();return {...result,data:result.data?.[0]??null};},then(resolve:(result:unknown)=>unknown,reject:(error:unknown)=>unknown){return execute().then(resolve,reject);}};
    return chain;
  };
  const db={from,async rpc(name:string,args:Record<string,unknown>){if(name!=="save_document_workspace")throw new Error("Demo RPC unavailable");try{const result=await pg.query<{result:unknown}>("select save_document_workspace($1,$2,$3::jsonb,$4,$5,$6,$7::jsonb) result",[args.p_workspace_id,args.p_expected_revision,JSON.stringify(args.p_draft),args.p_actor_kind,args.p_actor_id,args.p_command_id,args.p_confirmation?JSON.stringify(args.p_confirmation):null]);return {data:result.rows[0].result,error:null};}catch(error){return {data:null,error};}}} as unknown as SupabaseClient;
  return {pg,db,workspaceId};
}
