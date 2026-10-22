import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { emptyDocumentDraft, fromPackingPayload, parseDocumentDraft, mergeDocuments, reconcileDocumentEdit, projectSupplierDocument, DocumentMergeReviewError, toPackingPayload, confirmationIssues, type DocumentDraft, type DocumentKind } from "@/lib/shared/document-import";
import { validatePackingListInput } from "@/lib/studio/prealertas/packlist-form";
import { getPrealertaIdsByToken } from "@/lib/studio/prealertas/queries";
import { buildLabelsFromBoxes } from "@/lib/studio/prealertas/types";
import { ImportHttpError, UUID, anonymousToken, hashToken, notFound, purchaseForClient, requirePortal, requirePortalScope, reserveLimit, type ImportActor, type WorkspaceRow } from "./access";

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
export async function getDocumentLabels(db:SupabaseClient,w:WorkspaceRow,expectedRevision:number) {
  if(!Number.isInteger(expectedRevision) || expectedRevision!==w.revision) throw new ImportHttpError(409,"revision_conflict","El documento cambió. Carga la versión compartida antes de imprimir.");
  if(!w.prealerta_id || !w.tenant_id || w.confirmed_revision!==w.revision || !w.confirmed_submission_id || confirmationIssues(parseDocumentDraft(w.draft)).some(i=>i.blocking))
    throw new ImportHttpError(409,"confirmation_required","Confirma la revisión vigente antes de imprimir las etiquetas.");
  const {data:purchase,error:purchaseError}=await db.from("prealertas").select("code").eq("id",w.prealerta_id).eq("tenant_id",w.tenant_id).is("deleted_at",null).neq("status","cancelada").maybeSingle();
  if(purchaseError || !purchase) return notFound();
  const {data:submission,error:submissionError}=await db.from("packing_list_submissions").select("folio,version_no").eq("id",w.confirmed_submission_id).eq("prealerta_id",w.prealerta_id).eq("tenant_id",w.tenant_id).eq("is_current",true).is("deleted_at",null).maybeSingle();
  if(submissionError || !submission) throw new ImportHttpError(409,"confirmation_required","La versión confirmada cambió. Vuelve a abrir el documento.");
  const {data:mapping,error:mappingError}=await db.from("document_group_boxes").select("box_id").eq("workspace_id",w.id);
  if(mappingError || !mapping) throw new ImportHttpError(503,"labels_unavailable","No pudimos comprobar las etiquetas. Intenta otra vez.");
  const ids=mapping.map(row=>row.box_id);
  let query=db.from("warehouse_boxes").select("id,code,seq").eq("tenant_id",w.tenant_id).eq("prealerta_id",w.prealerta_id).is("deleted_at",null);
  if(ids.length)query=query.in("id",ids);
  const {data:boxes,error:boxesError}=await query.order("seq",{ascending:true});
  const expected=parseDocumentDraft(w.draft).groups.reduce((sum,g)=>sum+(g.cartons??0),0);
  if(boxesError || !boxes || boxes.length!==expected || (ids.length>0&&boxes.length!==ids.length) || new Set(boxes.map(box=>box.code)).size!==expected)
    throw new ImportHttpError(409,"labels_need_operations","Las cajas físicas no coinciden con el documento. Contacta a DTD para revisar las etiquetas.");
  const {data:latest,error:latestError}=await db.from("document_workspaces").select("revision,confirmed_revision,confirmed_submission_id").eq("id",w.id).maybeSingle();
  if(latestError || !latest || latest.revision!==expectedRevision || latest.confirmed_revision!==expectedRevision || latest.confirmed_submission_id!==w.confirmed_submission_id)
    throw new ImportHttpError(409,"revision_conflict","El documento cambió. Carga la versión compartida antes de imprimir.");
  return {revision:w.revision,folio:submission.folio,versionNo:submission.version_no,labels:buildLabelsFromBoxes(purchase.code,boxes)};
}
export type OpenedWorkspace={workspace:WorkspaceRow;anonymousToken?:string};
/** Tope de la carrera al crear el documento compartido: el que pierde vuelve a LEER la fila del
 *  que ganó. Un reintento alcanza cuando la carrera se resuelve; el resto es margen. Si la fila
 *  existe pero este SELECT no la alcanza (otro `client_id` sobre la misma compra), el 23505 se
 *  repite para siempre: sin tope la función se llamaría a sí misma hasta tumbar el proceso. */
const MAX_WORKSPACE_RACE_ATTEMPTS=3;
export async function openWorkspace(admin:SupabaseClient,session:SupabaseClient,body:Record<string,unknown>,headers:Headers):Promise<OpenedWorkspace> {
  return openWorkspaceAttempt(admin,session,body,headers,1);
}
async function openWorkspaceAttempt(admin:SupabaseClient,session:SupabaseClient,body:Record<string,unknown>,headers:Headers,attempt:number):Promise<OpenedWorkspace> {
  const token=headers.get("x-supplier-token");
  // Sólo el cotizador anónimo abre sin el interruptor del portal: un documento
  // de compra (proveedor, compra o sesión) no nace, ni siquiera vacío.
  if(token || body.purchaseId || body.purchaseCode || body.authenticated===true) requirePortalScope();
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
  if(error?.code==="23505" && purchaseId) {
    if(attempt>=MAX_WORKSPACE_RACE_ATTEMPTS) throw new ImportHttpError(503,"workspace_unavailable","No pudimos abrir el documento compartido. Vuelve a intentarlo en un momento.");
    return openWorkspaceAttempt(admin,session,body,headers,attempt+1);
  }
  if(error || !data) throw new ImportHttpError(503,"workspace_unavailable","No pudimos abrir el documento compartido.");
  return {workspace:(Array.isArray(data)?data[0]:data) as WorkspaceRow,...(rawToken?{anonymousToken:rawToken}:{})};
}

/** Supplier projection excludes source filenames, original URLs, jobs and client identity. */
export function projectWorkspace(w:WorkspaceRow,actor:ImportActor) {
  const draft=actor.kind==="supplier"?projectSupplierDocument(parseDocumentDraft(w.draft)):parseDocumentDraft(w.draft);
  return {id:w.id,revision:w.revision,draft,confirmedRevision:w.confirmed_revision,expiresAt:w.expires_at};
}
export async function saveWorkspace(db:SupabaseClient,w:WorkspaceRow,actor:ImportActor,body:Record<string,unknown>,confirm=false) {
  const existing=parseDocumentDraft(w.draft);
  const draft=reconcileDocumentEdit(existing,body.draft);
  const submittedIssues=draft.issues;
  // Supplier issue IDs are projected; they cannot inject private messages or metadata.
  draft.issues=existing.issues.map((i,index)=>{
    const visibleId=actor.kind==="supplier"?`supplier-review-${index+1}`:i.id;
    const submitted=submittedIssues.find(x=>x.id===visibleId);
    const resolved=(Array.isArray(body.resolvedIssueIds)&&body.resolvedIssueIds.includes(visibleId))?true:submitted?.resolved??i.resolved;
    return {...i,...(resolved===undefined?{}:{resolved})};
  });
  return persistWorkspace(db,w,actor,body,draft,confirm);
}
/** Internal extraction path cannot be selected by body.mode or a client metadata flag. */
async function persistWorkspace(db:SupabaseClient,w:WorkspaceRow,actor:ImportActor,body:Record<string,unknown>,draft:DocumentDraft,confirm:boolean) {
  if(!Number.isInteger(body.expectedRevision) || Number(body.expectedRevision)<0 || !UUID.test(String(body.commandId??""))) throw new ImportHttpError(400,"invalid_revision","Actualiza el documento antes de guardar.");
  draft=parseDocumentDraft(draft);
  let confirmation=null;
  if(confirm) {
    if(actor.kind!=="supplier" || !w.prealerta_id) throw new ImportHttpError(403,"supplier_required","El proveedor debe confirmar el despacho desde su enlace.");
    const blockers=confirmationIssues(draft).filter(i=>i.blocking && !i.resolved);
    if(blockers.length) throw new ImportHttpError(422,"missing_logistics","Revisa los datos pendientes del documento antes de confirmar el despacho.");
    const {input,fieldErrors}=validatePackingListInput(toPackingPayload(draft));
    if(!input) throw new ImportHttpError(422,"invalid_document",fieldErrors?"Revisa los datos del documento antes de confirmar.":"No pudimos validar el documento.");
    confirmation=input;
  }
  const {data,error}=await db.rpc("save_document_workspace",{p_workspace_id:w.id,p_expected_revision:body.expectedRevision,p_draft:draft,p_actor_kind:actor.kind,p_actor_id:actor.id,p_command_id:body.commandId,p_confirmation:confirmation});
  if(error) {
    if(error.code==="40001") throw new ImportHttpError(409,"revision_conflict","Otra sesión cambió este documento. Tus cambios siguen en pantalla; carga la versión compartida antes de guardarlos.");
    if(error.message?.includes("received_boxes")) throw new ImportHttpError(409,"received_boxes","Ya hay cajas recibidas. El equipo de DTD debe revisar cambios en el embalaje.");
    throw new ImportHttpError(503,"save_failed","No pudimos guardar el documento. Conserva los cambios e intenta otra vez.");
  }
  const receipt=Array.isArray(data)?data[0]:data;
  if(!receipt||!Number.isInteger(receipt.revision)||typeof receipt.confirmed!=="boolean") throw new ImportHttpError(503,"save_unconfirmed","No pudimos comprobar el recibo. Conserva tus cambios y consulta la revisión compartida.");
  const latest=await getWorkspace(db,w.id);
  if(latest.tenant_id!==w.tenant_id||latest.client_id!==w.client_id||latest.prealerta_id!==w.prealerta_id||latest.anonymous_hash!==w.anonymous_hash) return notFound();
  if(latest.revision!==receipt.revision) throw new ImportHttpError(409,"revision_conflict","El guardado fue recibido, pero el documento cambió después. Conserva tus cambios y compara la revisión compartida.");
  // Return only known receipt fields and the authoritative projected document.
  return {revision:latest.revision,confirmed:latest.confirmed_revision===latest.revision,
    ...(typeof receipt.folio==="string"?{folio:receipt.folio}:{}),...(Number.isInteger(receipt.versionNo)?{versionNo:receipt.versionNo}:{}),
    ...(typeof receipt.submissionId==="string"?{submissionId:receipt.submissionId}:{}),workspace:projectWorkspace(latest,actor)};
}
export async function applyImport(db:SupabaseClient,w:WorkspaceRow,actor:ImportActor,body:Record<string,unknown>) {
  if(actor.kind==="supplier") throw new ImportHttpError(403,"not_available","Los documentos originales del cliente son privados.");
  const {data:j,error}=await db.from("document_import_jobs").select("result,status").eq("id",String(body.jobId)).eq("workspace_id",w.id).maybeSingle();
  if(error || !j || !["ready","partial"].includes(j.status) || !j.result) return notFound();
  let proposal:DocumentDraft;
  try{proposal=mergeDocuments(parseDocumentDraft(w.draft),parseDocumentDraft(j.result));}
  catch(error){if(error instanceof DocumentMergeReviewError)throw new ImportHttpError(422,"identity_review",error.message);throw error;}
  // The real prior remains w; extraction never acquires manual authority.
  return persistWorkspace(db,w,actor,body,proposal,false);
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
