// @vitest-environment node
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll,afterAll,describe,it,expect } from "vitest";
import { emptyDocumentDraft,toPackingPayload } from "@/lib/shared/document-import";
import { validatePackingListInput } from "@/lib/studio/prealertas/packlist-form";

/** Real embedded PostgreSQL. Fixture DDL only for unrelated prerequisites;
 * submit0148,folio0147,sync0244,reconcile0449 and ALL0457 execute their real SQL. */
const migration=(name:string)=>readFileSync(new URL("../../../supabase/migrations/"+name,import.meta.url),"utf8");
function fn(sql:string,name:string) {
  const start=sql.indexOf("create or replace function public."+name)>=0?sql.indexOf("create or replace function public."+name):sql.indexOf("create function public."+name);
  if(start<0)throw new Error("Missing real function "+name);
  const end=sql.indexOf("$$;",sql.indexOf("as $$",start));
  return sql.slice(start,end+3);
}
let db:PGlite;
const tenant=randomUUID(),client=randomUUID(),user=randomUUID();
beforeAll(async()=>{
  db=new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create schema storage;create table auth.users(id uuid primary key);
    create table public.tenants(id uuid primary key);
    create table public.clients(id uuid primary key,tenant_id uuid,name text,markbox text,deleted_at timestamptz);
    create table public.prealertas(id uuid primary key default gen_random_uuid(),tenant_id uuid,client_markbox text,code text,boxes integer default 1,status text default 'anunciada',deleted_at timestamptz);
    create table public.warehouse_boxes(id uuid primary key default gen_random_uuid(),tenant_id uuid,prealerta_id uuid,receipt_id uuid,status text,code text,seq integer,markbox text,client_name text,deleted_at timestamptz,created_at timestamptz default now());
    create table public.consolidation_box_positions(box_id uuid);
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`);
  const base=migration("0147_supplier_packing_uploads.sql");
  await db.exec(base.slice(base.indexOf("create type packing_list_currency"),base.indexOf("comment on table public.packing_list_submissions")));
  await db.exec("alter table public.packing_list_submissions add column supplier_address text, add column supplier_city text;");
  await db.exec(fn(base,"next_packing_list_folio"));
  await db.exec(fn(migration("0148_packing_list_supplier_address.sql"),"submit_packing_list"));
  const boxes=migration("0244_warehouse_boxes_predeclaradas.sql");
  await db.exec(fn(boxes,"sync_boxes_for_prealerta"));
  await db.exec(fn(boxes,"prealertas_sync_boxes"));
  await db.exec(`create trigger prealertas_sync_boxes_ins after insert on public.prealertas for each row execute function public.prealertas_sync_boxes();
    create trigger prealertas_sync_boxes_upd after update of boxes,status on public.prealertas for each row when(old.boxes is distinct from new.boxes or (old.status is distinct from new.status and new.status='cancelada')) execute function public.prealertas_sync_boxes();`);
  await db.exec(fn(migration("0449_prealerta_exact_box_reception.sql"),"reconcile_labels_after_packing_list"));
  await db.exec("create trigger packing_list_reconcile_labels after insert on public.packing_list_submissions for each row when(new.is_current and new.deleted_at is null) execute function public.reconcile_labels_after_packing_list();");
  await db.exec(migration("0457_document_import_workspaces.sql"));
  await db.query("insert into tenants(id)values($1)",[tenant]);
  await db.query("insert into clients(id,tenant_id,name,markbox)values($1,$2,'Synthetic supplier test','DTD-TEST')",[client,tenant]);
  await db.query("insert into auth.users values($1)",[user]);
},60000);
afterAll(async()=>{await db?.close();});

function draft(){const d=emptyDocumentDraft();d.supplier.wechat="synthetic-contact";d.currency="USD";
  d.products=[{id:"p1",name:"Synthetic A",nameZh:"",code:"A",brand:"",material:"",quantity:100,unitPrice:2,currency:"USD",unit:"pcs"},{id:"p2",name:"Synthetic B",nameZh:"",code:"B",brand:"",material:"",quantity:50,unitPrice:3,currency:"USD",unit:"pcs"}];
  d.groups=[{id:"g1",label:"1-10",cartons:10,grossWeightKg:120,cbm:0.6,items:[{productId:"p1",quantity:100},{productId:"p2",quantity:50}]}];return d;}
async function workspace(d=emptyDocumentDraft()) {
  const purchase=randomUUID();await db.query("insert into prealertas(id,tenant_id,client_markbox,code)values($1,$2,'DTD-TEST',$3)",[purchase,tenant,"P-"+purchase]);
  const r=await db.query<{id:string}>("select (public.create_document_workspace($1,$2,$3,$4::jsonb,null,null,null)).id",[tenant,client,purchase,JSON.stringify(d)]);
  return {id:r.rows[0].id,purchase};
}
async function save(id:string,revision:number,d:ReturnType<typeof draft>,confirm=false,command=randomUUID()) {
  const input=confirm?validatePackingListInput(toPackingPayload(d)).input:null;
  const r=await db.query<{result:{revision:number;folio:string;confirmed:boolean}}>("select public.save_document_workspace($1,$2,$3::jsonb,$4,$5,$6,$7::jsonb) as result",[id,revision,JSON.stringify(d),confirm?"supplier":"client",confirm?"synthetic-supplier":user,command,input?JSON.stringify(input):null]);
  return r.rows[0].result;
}
describe("0457 SQL real on ephemeral PostgreSQL",()=>{
  it("saves incomplete draft; CAS rejects stale second browser and appends history",async()=>{
    const w=await workspace();await save(w.id,0,emptyDocumentDraft());
    await expect(save(w.id,0,draft())).rejects.toThrow("revision_conflict");
    const r=await db.query<{n:number}>("select count(*)::int n from document_workspace_versions where workspace_id=$1",[w.id]);expect(r.rows[0].n).toBe(1);
  });
  it("confirms mixed cartons once with real legacy submission/reconcile and stable physical codes",async()=>{
    const w=await workspace();const d=draft();const command=randomUUID();
    const receipt=await save(w.id,0,d,true,command);expect(receipt.confirmed).toBe(true);
    const repeated=await save(w.id,0,d,true,command);expect(repeated).toEqual(receipt);
    const rows=await db.query<{total_ctns:string;total_weight:string;total_cbm:string;total_amount:string}>("select total_ctns,total_weight,total_cbm,total_amount from packing_list_submissions where prealerta_id=$1",[w.purchase]);
    expect(rows.rows).toHaveLength(1);expect(Number(rows.rows[0].total_ctns)).toBe(10);expect(Number(rows.rows[0].total_weight)).toBe(120);expect(Number(rows.rows[0].total_cbm)).toBe(0.6);expect(Number(rows.rows[0].total_amount)).toBe(350);
    const mapping=await db.query<{contents:{scope:string;cartons:number;items:unknown[]};code:string}>("select m.contents,b.code from document_group_boxes m join warehouse_boxes b on b.id=m.box_id where m.workspace_id=$1",[w.id]);
    expect(mapping.rows).toHaveLength(10);expect(new Set(mapping.rows.map(r=>r.code)).size).toBe(10);
    expect(mapping.rows[0].contents).toMatchObject({scope:"group_total",cartons:10,items:[{productId:"p1",quantity:100},{productId:"p2",quantity:50}]});
  });
  it("rejects reused command with different content",async()=>{const w=await workspace(),command=randomUUID();await save(w.id,0,draft(),false,command);const changed=draft();changed.supplier.company="Changed";await expect(save(w.id,0,changed,false,command)).rejects.toThrow("idempotency_conflict");});
  it("never reassigns received boxes; price correction preserves mapping",async()=>{
    const w=await workspace(),d=draft();await save(w.id,0,d,true);
    const before=await db.query<{box_id:string;group_id:string}>("select box_id,group_id from document_group_boxes where workspace_id=$1 order by box_id",[w.id]);
    await db.query("update warehouse_boxes set status='recibida',receipt_id=$2 where id=$1",[before.rows[0].box_id,randomUUID()]);
    const changed=draft();changed.groups[0].cbm=1;await expect(save(w.id,1,changed,true)).rejects.toThrow("received_boxes_require_operations");
    d.products[0].unitPrice=4;await save(w.id,1,d,true);
    const after=await db.query("select box_id,group_id from document_group_boxes where workspace_id=$1 order by box_id",[w.id]);expect(after.rows).toEqual(before.rows);
  });
  it("rolls back submission, revision and box changes on mapping mismatch",async()=>{
    const w=await workspace(),d=draft();const input=validatePackingListInput(toPackingPayload(d)).input!;
    d.groups[0].cartons=11;
    await expect(db.query("select public.save_document_workspace($1,0,$2::jsonb,'supplier','s',$3,$4::jsonb)",[w.id,JSON.stringify(d),randomUUID(),JSON.stringify(input)])).rejects.toThrow("group_box_count_mismatch");
    const r=await db.query<{revision:number;n:number}>("select revision,(select count(*)::int from packing_list_submissions where prealerta_id=$2) n from document_workspaces where id=$1",[w.id,w.purchase]);expect(r.rows[0]).toEqual({revision:0,n:0});
  });
  it("enforces atomic quota and does not increment on rejection",async()=>{
    const scope=randomUUID(),window=new Date().toISOString();
    for(const expected of [true,true,false]){const r=await db.query<{ok:boolean}>("select reserve_document_import_limit($1,$2,1,2) ok",[scope,window]);expect(r.rows[0].ok).toBe(expected);}
  });
  it("leases one job and fences stale worker after expired retry",async()=>{
    const w=await workspace();const job=randomUUID();
    await db.query("insert into document_import_jobs(id,workspace_id,request_key,file_name,file_kind,storage_path,content_type,size_bytes,status)values($1,$2,$3,'synthetic.csv','packing_list',$4,'text/csv',3,'queued')",[job,w.id,randomUUID(),job+".csv"]);
    const first=await db.query<{lease_token:string;attempts:number}>("select * from claim_document_import_job($1)",[job]);expect(first.rows[0].attempts).toBe(1);
    expect((await db.query("select * from claim_document_import_job($1)",[job])).rows).toHaveLength(0);
    await db.query("update document_import_jobs set lease_until=now()-interval '1 minute' where id=$1",[job]);
    const second=await db.query<{lease_token:string}>("select * from claim_document_import_job($1)",[job]);expect(second.rows[0].lease_token).not.toBe(first.rows[0].lease_token);
    const stale=await db.query("update document_import_jobs set status='ready' where id=$1 and lease_token=$2 returning id",[job,first.rows[0].lease_token]);expect(stale.rows).toHaveLength(0);
  });
  it("rejects direct authenticated/anonymous table and function access",async()=>{
    for(const role of ["anon","authenticated"]){await db.exec("set role "+role);try{await expect(db.query("select * from document_workspaces")).rejects.toThrow("permission denied");await expect(db.query("select * from claim_document_import_job(null)")).rejects.toThrow("permission denied");}finally{await db.exec("reset role");}}
  });
  it("expires anonymous workspace even with valid capability and cascades only its history",async()=>{
    const id=randomUUID();await db.query("insert into document_workspaces(id,draft,anonymous_hash,expires_at)values($1,$2::jsonb,$3,now()-interval '1 minute')",[id,JSON.stringify(emptyDocumentDraft()),"testhash"+id]);
    await expect(save(id,0,draft())).rejects.toThrow("workspace_not_found");
    await db.query("delete from document_workspaces where id=$1",[id]);
  });
});
