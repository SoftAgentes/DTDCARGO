import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { emptyDocumentDraft, fromPackingPayload, parseDocumentDraft, mergeDocuments, toPackingPayload, confirmationIssues, type DocumentKind } from "@/lib/shared/document-import";
import { validatePackingListInput } from "@/lib/studio/prealertas/packlist-form";
import { getPrealertaIdsByToken } from "@/lib/studio/prealertas/queries";
import { ImportHttpError, UUID, anonymousToken, hashToken, notFound, purchaseForClient, requirePortal, reserveLimit, type ImportActor, type WorkspaceRow } from "./access";

export const IMPORT_BUCKET = "document-imports";
export const MAX_IMPORT_BYTES = 15*1024*1024;
export const WORKSPACE_SELECT = "id,tenant_id,client_id,prealerta_id,anonymous_hash,expires_at,draft,revision,confirmed_revision,confirmed_submission_id";
export async function getWorkspace(db:SupabaseClient,id:string):Promise<WorkspaceRow> {
  if (!UUID.test(id)) return notFound();
  const {data,error}=await db.from("document_workspaces").select(WORKSPACE_SELECT).eq("id",id).maybeSingle();
  if(error || !data) return notFound();
  return data as WorkspaceRow;
}
/** Gate physical labels by the latest confirmed shared revision, never a browser-only flag. */
export async function documentLabelGate(db:SupabaseClient,purchaseId:string,tenantId:string):Promise<{managed:boolean;allowed:boolean}> {
  const {data,error}=await db.from("document_workspaces").select("draft,revision,confirmed_revision").eq("prealerta_id",purchaseId).eq("tenant_id",tenantId).maybeSingle();
  if(error){
    if(error.code==="42P01"&&process.env.DOCUMENT_IMPORT_ENABLED!=="true")return {managed:false,allowed:true};
    return {managed:true,allowed:false};
  }
  if(!data)return {managed:false,allowed:true};
  try{return {managed:true,allowed:data.revision===data.confirmed_revision&&!confirmationIssues(parseDocumentDraft(data.draft)).some(i=>i.blocking&&!i.resolved)};}
  catch{return {managed:true,allowed:false};}
}
export async function openWorkspace(admin:SupabaseClient,session:SupabaseClient,body:Record<string,unknown>,headers:Headers) {
  const token=headers.get("x-supplier-token");
  let tenantId:string|null=null,clientId:string|null=null,purchaseId:string|null=null;
  if(token) {
    if(!UUID.test(token)) return notFound();
    const ids=await getPrealertaIdsByToken(admin,token);
    if(!ids) return notFound();
    const {data:owner,error}=await admin.from("clients").select("id").eq("tenant_id",ids.tenantId).eq("markbox",ids.markbox).is("deleted_at",null).maybeSingle();
    if(error || !owner) return notFound();
    tenantId=ids.tenantId;clientId=owner.id;purchaseId=ids.prealertaId;
  } else if (body.purchaseId || body.purchaseCode || body.authenticated===true) {
    const principal=await requirePortal(session);
    tenantId=principal.tenantId;clientId=principal.client.id;
    if(body.purchaseId) purchaseId=(await purchaseForClient(session,principal,String(body.purchaseId))).id;
    else if(body.purchaseCode){
      const {data:p,error}=await session.from("prealertas").select("id").eq("code",String(body.purchaseCode).slice(0,100))
        .eq("tenant_id",principal.tenantId).eq("client_markbox",principal.client.markbox).is("deleted_at",null).neq("status","cancelada").maybeSingle();
      if(error||!p)return notFound();purchaseId=p.id;
    }
  }
  if(purchaseId) {
    const {data,error}=await admin.from("document_workspaces").select(WORKSPACE_SELECT).eq("prealerta_id",purchaseId).eq("tenant_id",tenantId).eq("client_id",clientId).maybeSingle();
    if(error) throw new ImportHttpError(503,"workspace_unavailable","No pudimos abrir el documento compartido.");
    if(data) return {workspace:data as WorkspaceRow};
  }
  let draft=emptyDocumentDraft();
  let legacySubmissionId:string|null=null;
  if(purchaseId) {
    const {data:p}=await admin.from("prealertas").select("supplier_id").eq("id",purchaseId).eq("tenant_id",tenantId).maybeSingle();
    if(p?.supplier_id) {
      const {data:s}=await admin.from("suppliers_cn").select("name,contact,wechat,city").eq("id",p.supplier_id).eq("tenant_id",tenantId).maybeSingle();
      if(s) Object.assign(draft.supplier,{company:s.name??"",contact:s.contact??"",wechat:s.wechat??"",city:s.city??""});
    }
    const {data:previous,error:previousError}=await admin.from("packing_list_submissions")
      .select("id,supplier_company,supplier_contact,supplier_email,supplier_wechat,supplier_phone,supplier_address,supplier_city,currency,doc_date,rows")
      .eq("prealerta_id",purchaseId).eq("tenant_id",tenantId).eq("is_current",true).is("deleted_at",null).maybeSingle();
    if(previousError)throw new ImportHttpError(503,"workspace_unavailable","No pudimos recuperar el documento anterior. Intenta de nuevo.");
    if(previous){
      draft=fromPackingPayload({supplierCompany:previous.supplier_company??"",supplierContact:previous.supplier_contact??"",supplierEmail:previous.supplier_email??"",supplierWechat:previous.supplier_wechat??"",supplierPhone:previous.supplier_phone??"",supplierAddress:previous.supplier_address??"",supplierCity:previous.supplier_city??"",currency:previous.currency,docDate:previous.doc_date,rows:previous.rows});
      legacySubmissionId=previous.id;
    }
  }
  const rawToken=clientId ? null : anonymousToken();
  const {data,error}=await admin.rpc("create_document_workspace",{p_tenant_id:tenantId,p_client_id:clientId,p_prealerta_id:purchaseId,p_draft:draft,
    p_anonymous_hash:rawToken?hashToken(rawToken):null,p_expires_at:rawToken?new Date(Date.now()+86400000).toISOString():null,p_submission_id:legacySubmissionId});
  if(error?.code==="23505" && purchaseId) return openWorkspace(admin,session,body,headers);
  if(error || !data) throw new ImportHttpError(503,"workspace_unavailable","No pudimos abrir el documento compartido.");
  return {workspace:(Array.isArray(data)?data[0]:data) as WorkspaceRow,...(rawToken?{anonymousToken:rawToken}:{})};
}

/** Supplier projection excludes source filenames, original URLs, jobs and client identity. */
export function projectWorkspace(w:WorkspaceRow,actor:ImportActor) {
  const draft=parseDocumentDraft(w.draft);
  if(actor.kind==="supplier") draft.sources=[];
  return {id:w.id,revision:w.revision,draft,confirmedRevision:w.confirmed_revision,expiresAt:w.expires_at};
}
export async function saveWorkspace(db:SupabaseClient,w:WorkspaceRow,actor:ImportActor,body:Record<string,unknown>,confirm=false) {
  if(!Number.isInteger(body.expectedRevision) || !UUID.test(String(body.commandId??""))) throw new ImportHttpError(400,"invalid_revision","Actualiza el documento antes de guardar.");
  const draft=parseDocumentDraft(body.draft);
  const existing=parseDocumentDraft(w.draft);
  // Source evidence is server-owned, not editable by supplier or a browser payload.
  draft.sources=existing.sources;
  const knownIssues=new Map(existing.issues.map(i=>[i.id,i]));
  draft.issues=existing.issues.map(i=>({...i,resolved:body.resolvedIssueIds instanceof Array && body.resolvedIssueIds.includes(i.id) ? true : (draft.issues.find(x=>x.id===i.id)?.resolved===true || i.resolved)}));
  for(const i of parseDocumentDraft(body.draft).issues) if(!knownIssues.has(i.id)) draft.issues.push(i);
  let confirmation=null;
  if(confirm) {
    if(actor.kind!=="supplier" || !w.prealerta_id) throw new ImportHttpError(403,"supplier_required","El proveedor debe confirmar el despacho desde su enlace.");
    const blockers=confirmationIssues(draft).filter(i=>i.blocking && !i.resolved);
    if(blockers.length) throw new ImportHttpError(422,"missing_logistics",blockers.map(i=>i.message).slice(0,5).join(" "));
    const {input,fieldErrors}=validatePackingListInput(toPackingPayload(draft));
    if(!input) throw new ImportHttpError(422,"invalid_document",Object.values(fieldErrors??{}).join(" "));
    confirmation=input;
  }
  const {data,error}=await db.rpc("save_document_workspace",{p_workspace_id:w.id,p_expected_revision:body.expectedRevision,p_draft:draft,p_actor_kind:actor.kind,p_actor_id:actor.id,p_command_id:body.commandId,p_confirmation:confirmation});
  if(error) {
    if(error.code==="40001") throw new ImportHttpError(409,"revision_conflict","Otra sesión cambió este documento. Tus cambios siguen en pantalla; carga la versión compartida antes de guardarlos.");
    if(error.message?.includes("received_boxes")) throw new ImportHttpError(409,"received_boxes","Ya hay cajas recibidas. El equipo de DTD debe revisar cambios en el embalaje.");
    throw new ImportHttpError(503,"save_failed","No pudimos guardar el documento. Conserva los cambios e intenta otra vez.");
  }
  return data;
}
export async function applyImport(db:SupabaseClient,w:WorkspaceRow,actor:ImportActor,body:Record<string,unknown>) {
  if(actor.kind==="supplier") throw new ImportHttpError(403,"not_available","Los documentos originales del cliente son privados.");
  const {data:j,error}=await db.from("document_import_jobs").select("result,status").eq("id",String(body.jobId)).eq("workspace_id",w.id).maybeSingle();
  if(error || !j || !["ready","partial"].includes(j.status) || !j.result) return notFound();
  const proposal=mergeDocuments(parseDocumentDraft(w.draft),parseDocumentDraft(j.result));
  // Application is explicit after preview; source comes only from the extraction.
  const mergedWorkspace={...w,draft:proposal};
  return saveWorkspace(db,mergedWorkspace,actor,{...body,draft:proposal},false);
}
const MIME:Record<string,string>={pdf:"application/pdf",csv:"text/csv",xlsx:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"};
export async function reserveUpload(db:SupabaseClient,w:WorkspaceRow,actor:ImportActor,body:Record<string,unknown>) {
  if(actor.kind==="supplier") throw new ImportHttpError(403,"not_available","Completa o corrige el documento compartido.");
  if(w.expires_at && Date.parse(w.expires_at)-Date.now()<125*60000)throw new ImportHttpError(410,"upload_session_expiring","Esta sesión está por vencer. Abre una nueva importación antes de cargar más archivos.");
  const fileName=String(body.fileName??"").replace(/[\u0000-\u001f\\/]/g,"_").slice(0,200);
  const ext=fileName.split(".").pop()?.toLowerCase()??"";
  if(!MIME[ext]) throw new ImportHttpError(415,"unsupported_format",ext==="xls"?"Convierte el archivo XLS a XLSX o PDF para importar sus datos. Puedes conservar el original como adjunto.":"Usa un archivo XLSX, CSV o PDF.");
  if(!Number.isInteger(body.sizeBytes) || Number(body.sizeBytes)<=0 || Number(body.sizeBytes)>MAX_IMPORT_BYTES) throw new ImportHttpError(413,"file_too_large","El archivo debe pesar hasta 15 MB.");
  const requestKey=String(body.requestKey??"");
  if(!UUID.test(requestKey)) throw new ImportHttpError(400,"invalid_request","Vuelve a seleccionar el archivo.");
  const kind:DocumentKind=["packing_list","invoice","proforma","combined","unknown"].includes(String(body.kind))?body.kind as DocumentKind:"unknown";
  const {data:previous}=await db.from("document_import_jobs").select("id,storage_path,status").eq("workspace_id",w.id).eq("request_key",requestKey).maybeSingle();
  if(previous && previous.status!=="uploading") return {jobId:previous.id,status:previous.status};
  if(!previous) await reserveLimit(db,`upload:${w.id}`,1,10,86400000);
  const id=previous?.id??randomUUID();
  const path=previous?.storage_path??`${w.tenant_id??"anonymous"}/${w.id}/${id}.${ext}`;
  if(!previous) {
    const {error}=await db.from("document_import_jobs").insert({id,workspace_id:w.id,request_key:requestKey,file_name:fileName,file_kind:kind,storage_path:path,content_type:MIME[ext],size_bytes:body.sizeBytes});
    if(error) throw new ImportHttpError(503,"upload_unavailable","No pudimos preparar la carga. Intenta otra vez.");
  }
  const {data,error}=await db.storage.from(IMPORT_BUCKET).createSignedUploadUrl(path,{upsert:false});
  if(error || !data) throw new ImportHttpError(503,"upload_unavailable","No pudimos preparar la carga. Intenta otra vez.");
  return {jobId:id,status:"uploading",uploadUrl:data.signedUrl,contentType:MIME[ext]};
}
