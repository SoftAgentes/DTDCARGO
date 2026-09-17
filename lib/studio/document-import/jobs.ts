import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { confirmationIssues, type DocumentKind } from "@/lib/shared/document-import";
import { ImportHttpError, reserveLimit, type WorkspaceRow } from "./access";
import { IMPORT_BUCKET, MAX_IMPORT_BYTES } from "./service";
import { extractDocument } from "./extract";

export type ImportJob = {id:string;workspace_id:string;storage_path:string;file_name:string;file_kind:DocumentKind;content_type:string;size_bytes:number;status:string;sha256:string|null;attempts:number;lease_token:string|null};

export function verifyFile(bytes:Uint8Array,job:Pick<ImportJob,"size_bytes"|"file_name"|"content_type">) {
  if(bytes.byteLength!==job.size_bytes || bytes.byteLength>MAX_IMPORT_BYTES || bytes.byteLength===0) throw new ImportHttpError(422,"size_mismatch","La carga está incompleta o su tamaño cambió. Vuelve a cargar el archivo.");
  const ext=job.file_name.split(".").pop()?.toLowerCase();
  const head=Buffer.from(bytes.subarray(0,8)).toString("latin1");
  if(ext==="pdf" && !head.startsWith("%PDF-")) throw new ImportHttpError(415,"signature_mismatch","El contenido no corresponde a un PDF válido.");
  if(ext==="xlsx" && !(bytes[0]===0x50 && bytes[1]===0x4b && bytes[2]===3 && bytes[3]===4)) throw new ImportHttpError(415,"signature_mismatch","El contenido no corresponde a un Excel XLSX válido.");
  if(ext==="csv") {
    if(bytes.includes(0)) throw new ImportHttpError(415,"invalid_csv","Guarda el CSV como texto UTF-8 antes de cargarlo.");
    try{new TextDecoder("utf-8",{fatal:true}).decode(bytes);}catch{throw new ImportHttpError(415,"invalid_csv","Guarda el CSV como texto UTF-8 antes de cargarlo.");}
  }
  return createHash("sha256").update(bytes).digest("hex");
}

export async function finishUpload(db:SupabaseClient,w:WorkspaceRow,jobId:string) {
  const {data,error}=await db.from("document_import_jobs").select("*").eq("id",jobId).eq("workspace_id",w.id).maybeSingle();
  if(error || !data) throw new ImportHttpError(404,"not_found","Archivo no disponible.");
  const job=data as ImportJob;
  if(job.status!=="uploading") return {jobId:job.id,status:job.status};
  const {data:file,error:downloadError}=await db.storage.from(IMPORT_BUCKET).download(job.storage_path);
  if(downloadError || !file) throw new ImportHttpError(422,"upload_incomplete","El archivo todavía no se recibió completo. Intenta la carga de nuevo.");
  const bytes=new Uint8Array(await file.arrayBuffer());
  let sha:string;
  try{sha=verifyFile(bytes,job);}catch(e){
    await db.from("document_import_jobs").update({status:"failed",error_code:e instanceof ImportHttpError?e.code:"invalid_file"}).eq("id",job.id).eq("status","uploading");
    await db.storage.from(IMPORT_BUCKET).remove([job.storage_path]);
    throw e;
  }
  const {data:duplicate}=await db.from("document_import_jobs").select("id,status").eq("workspace_id",w.id).eq("sha256",sha).neq("status","cancelled").neq("id",job.id).maybeSingle();
  if(duplicate) {
    await db.from("document_import_jobs").update({status:"cancelled",error_code:"duplicate"}).eq("id",job.id).eq("status","uploading");
    await db.storage.from(IMPORT_BUCKET).remove([job.storage_path]);
    return {jobId:duplicate.id,status:duplicate.status,duplicate:true};
  }
  const {error:updateError}=await db.from("document_import_jobs").update({sha256:sha,status:"queued",updated_at:new Date().toISOString()}).eq("id",job.id).eq("workspace_id",w.id).eq("status","uploading");
  if(updateError) throw new ImportHttpError(409,"upload_conflict","La carga cambió mientras se procesaba. Actualiza su estado.");
  return {jobId:job.id,status:"queued"};
}

function configuredLimit(key:string,fallback:number,max:number) {
  const n=Number(process.env[key]??fallback);
  if(!Number.isSafeInteger(n)||n<1||n>max) throw new ImportHttpError(503,"budget_not_configured","La capacidad de lectura no está configurada.");
  return n;
}

/** Each attempt reserves a worst-case token allowance before contacting an AI provider. */
export async function processImportJob(db:SupabaseClient,jobId?:string) {
  const {data,error}=await db.rpc("claim_document_import_job",{p_job_id:jobId??null});
  if(error) throw new ImportHttpError(503,"queue_unavailable","La lectura no está disponible. Intenta más tarde.");
  const job=(Array.isArray(data)?data[0]:data) as ImportJob|undefined;
  if(!job) return {processed:false};
  try{
    const {data:w,error:we}=await db.from("document_workspaces").select("id,expires_at").eq("id",job.workspace_id).maybeSingle();
    if(we || !w || (w.expires_at && Date.parse(w.expires_at)<=Date.now())) throw new ImportHttpError(410,"expired","Esta importación caducó.");
    await reserveLimit(db,"processing-global",1,configuredLimit("DOCUMENT_IMPORT_DAILY_JOBS",100,10000),86400000);
    // PDF / unknown spreadsheets can use AI. The extractor also caps pages/context.
    await reserveLimit(db,"ai-token-budget",200000,configuredLimit("DOCUMENT_IMPORT_DAILY_TOKEN_BUDGET",2000000,200000000),86400000);
    const {data:file,error:de}=await db.storage.from(IMPORT_BUCKET).download(job.storage_path);
    if(de || !file) throw new ImportHttpError(503,"storage_unavailable","No pudimos leer el archivo recibido.");
    const bytes=new Uint8Array(await file.arrayBuffer());
    if(verifyFile(bytes,job)!==job.sha256) throw new ImportHttpError(422,"content_changed","El archivo cambió después de la carga.");
    const draft=await extractDocument(bytes,{fileName:job.file_name,kind:job.file_kind,sourceId:job.id});
    const partial=confirmationIssues(draft).some(i=>i.blocking&&!i.resolved);
    const {data:saved,error:se}=await db.from("document_import_jobs").update({status:partial?"partial":"ready",result:draft,error_code:null,lease_until:null,updated_at:new Date().toISOString()})
      .eq("id",job.id).eq("lease_token",job.lease_token).eq("status","processing").select("id").maybeSingle();
    if(se) throw new ImportHttpError(503,"queue_unavailable","No pudimos guardar la lectura.");
    return {processed:Boolean(saved),status:partial?"partial":"ready"};
  }catch(e){
    const detail=e as {code?:string;retryable?:boolean;status?:number};
    const transient=detail.retryable===true || [429,502,503,504].includes(detail.status??0);
    const retry=transient && job.attempts<3;
    // Do not persist raw exception text: upstream errors may contain document text or tokens.
    const code=typeof detail.code==="string" && /^[a-z_]{1,60}$/.test(detail.code)?detail.code:"extraction_failed";
    const {error:fe}=await db.from("document_import_jobs").update({status:retry?"queued":"failed",error_code:code,lease_until:null,
      available_at:new Date(Date.now()+job.attempts*60000).toISOString(),updated_at:new Date().toISOString()})
      .eq("id",job.id).eq("lease_token",job.lease_token).eq("status","processing");
    if(fe) throw new ImportHttpError(503,"queue_unavailable","No pudimos actualizar el estado de lectura.");
    return {processed:true,status:retry?"queued":"failed",code};
  }
}

/** Delete private objects first; only then remove expired anonymous workspaces/history. */
export async function cleanupImports(db:SupabaseClient) {
  const now=new Date().toISOString();
  const {data:expired,error}=await db.from("document_workspaces").select("id").lt("expires_at",now).limit(50);
  if(error) throw new ImportHttpError(503,"cleanup_unavailable","Limpieza no disponible.");
  let removed=0;
  for(const w of expired??[]) {
    const {data:jobs,error:je}=await db.from("document_import_jobs").select("storage_path").eq("workspace_id",w.id);
    if(je) continue;
    const paths=(jobs??[]).map(j=>String(j.storage_path));
    if(paths.length) {const {error:se}=await db.storage.from(IMPORT_BUCKET).remove(paths);if(se)continue;}
    const {error:de}=await db.from("document_workspaces").delete().eq("id",w.id).lt("expires_at",now);
    if(!de)removed++;
  }
  // Abandoned signed uploads cannot be replayed after their two-hour URL TTL.
  const cutoff=new Date(Date.now()-24*3600000).toISOString();
  const {data:abandoned}=await db.from("document_import_jobs").select("id,storage_path").eq("status","uploading").lt("created_at",cutoff).limit(100);
  for(const j of abandoned??[]) {
    const {error:se}=await db.storage.from(IMPORT_BUCKET).remove([j.storage_path]);
    if(!se) await db.from("document_import_jobs").update({status:"cancelled",error_code:"upload_expired"}).eq("id",j.id).eq("status","uploading");
  }
  await db.from("document_import_jobs").update({status:"failed",error_code:"attempts_exhausted",lease_until:null})
    .eq("status","processing").gte("attempts",3).lt("lease_until",now);
  await db.from("document_import_limits").delete().lt("window_start",new Date(Date.now()-2*86400000).toISOString());
  return {removed};
}
