import "server-only";
import { after, NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { createClient } from "@/lib/db/server";
import { publicOrigin } from "@/lib/runtime/public-origin";
import { parseDocumentDraft } from "@/lib/shared/document-import";
import { enabled, ImportHttpError, authorizeWorkspace, portalEnabled, reserveRequest, requirePortal, requirePortalScope, UUID } from "./access";
import { getWorkspace,openWorkspace,projectWorkspace,reserveUpload,applyImport,saveWorkspace } from "./service";
import { finishUpload,processImportJob } from "./jobs";
import { getEstimateRates,estimateForRequest } from "./estimate";
import { exportDocument } from "./export";

export function allowedOrigin(req:NextRequest):string|null {
  const origin=req.headers.get("origin");if(!origin)return null;
  const configured=[process.env.NEXT_PUBLIC_SITE_URL,process.env.NEXT_PUBLIC_HAILUWAY_API,...(process.env.DOCUMENT_IMPORT_ALLOWED_ORIGINS??"").split(",")];
  const allowed=new Set(configured.filter(Boolean).flatMap(s=>{try{return [new URL(s!).origin];}catch{return [];}}));
  allowed.add(publicOrigin(req.url));
  return allowed.has(origin)?origin:null;
}
function responseHeaders(req:NextRequest) {
  const headers:Record<string,string>={"Cache-Control":"private, no-store","Vary":"Origin","X-Content-Type-Options":"nosniff"};
  const origin=allowedOrigin(req);if(origin){headers["Access-Control-Allow-Origin"]=origin;headers["Access-Control-Allow-Credentials"]="true";}
  return headers;
}
export function options(req:NextRequest) {
  if(!allowedOrigin(req))return new NextResponse(null,{status:403});
  return new NextResponse(null,{status:204,headers:{...responseHeaders(req),"Access-Control-Allow-Methods":"GET, POST, OPTIONS","Access-Control-Allow-Headers":"Content-Type, X-Document-Token, X-Supplier-Token"}});
}
export async function documentImportRequest(req:NextRequest) {
  const headers=responseHeaders(req);
  try{
    if(req.headers.has("origin")&&!allowedOrigin(req))throw new ImportHttpError(403,"origin_denied","Origen no permitido.");
    if(req.method==="POST"&&!allowedOrigin(req))throw new ImportHttpError(403,"origin_required","Abre esta operación desde el portal de DTD.");
    const action=req.nextUrl.searchParams.get("action");
    if(req.method==="GET"&&action==="capabilities")return NextResponse.json({available:process.env.DOCUMENT_IMPORT_ENABLED==="true",portal:portalEnabled(),formats:["xlsx","csv","pdf"],maxBytes:15*1024*1024},{headers});
    enabled();
    const admin=createAdminClient(),session=await createClient();
    await reserveRequest(admin,req.headers);
    if(req.method==="GET") {
      if(action==="destinations"){const rates=await getEstimateRates();return NextResponse.json({cities:rates.cities.map(c=>({id:c.id,label:c.label}))},{headers});}
      if(action==="purchases") {
        requirePortalScope();
        const principal=await requirePortal(session);
        const {data:purchases,error:pe}=await session.from("prealertas").select("id,code").eq("tenant_id",principal.tenantId).eq("client_markbox",principal.client.markbox).is("deleted_at",null).neq("status","cancelada").order("created_at",{ascending:false}).limit(100);
        if(pe)throw new ImportHttpError(503,"purchases_unavailable","No pudimos cargar tus compras.");
        if(!purchases?.length)return NextResponse.json({purchases:[]},{headers});
        const {data,error}=await admin.from("document_workspaces").select("id,prealerta_id,revision,confirmed_revision,draft")
          .eq("tenant_id",principal.tenantId).eq("client_id",principal.client.id).in("prealerta_id",purchases.map(p=>p.id));
        if(error)throw new ImportHttpError(503,"purchases_unavailable","No pudimos cargar tus compras.");
        return NextResponse.json({purchases:purchases.map(p=>{const w=data?.find(w=>w.prealerta_id===p.id);return {workspaceId:w?.id??null,purchaseId:p.id,code:p.code,revision:w?.revision??null,confirmedRevision:w?.confirmed_revision??null,draft:w?parseDocumentDraft(w.draft):null};})},{headers});
      }
      const w=await getWorkspace(admin,req.nextUrl.searchParams.get("workspaceId")??"");
      const actor=await authorizeWorkspace(admin,session,w,req.headers);
      if(action==="workspace")return NextResponse.json({workspace:projectWorkspace(w,actor)},{headers});
      if(action==="job") {
        if(actor.kind==="supplier")throw new ImportHttpError(403,"not_allowed","Los archivos originales son privados.");
        const {data,error}=await admin.from("document_import_jobs").select("id,status,result,error_code").eq("id",req.nextUrl.searchParams.get("jobId")).eq("workspace_id",w.id).maybeSingle();
        if(error||!data)throw new ImportHttpError(404,"not_found","Archivo no disponible.");
        return NextResponse.json({job:{id:data.id,status:data.status,result:data.result,errorCode:data.error_code}},{headers});
      }
      if(action==="history") {
        const {data,error}=await admin.from("document_workspace_versions").select("revision,draft,actor_kind,confirmed,created_at").eq("workspace_id",w.id).order("revision",{ascending:false}).limit(50);
        if(error)throw new ImportHttpError(503,"history_unavailable","No pudimos cargar el historial.");
        return NextResponse.json({versions:(data??[]).map(v=>{const draft=parseDocumentDraft(v.draft);if(actor.kind==="supplier")draft.sources=[];return {...v,draft};})},{headers});
      }
      if(action==="export") {
        let markbox="",code="Documento";
        if(w.prealerta_id){const {data:p,error}=await admin.from("prealertas").select("code,client_markbox").eq("id",w.prealerta_id).eq("tenant_id",w.tenant_id).maybeSingle();if(error||!p)throw new ImportHttpError(404,"not_found","Compra no disponible.");markbox=p.client_markbox;code=p.code;}
        const bytes=await exportDocument(parseDocumentDraft(w.draft),{markbox,code,confirmed:w.revision===w.confirmed_revision,revision:w.revision});
        return new NextResponse(bytes as BodyInit,{headers:{...headers,"Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","Content-Disposition":`attachment; filename="PackingList-${code.replace(/[^a-z0-9-]/gi,"_")}.xlsx"`}});
      }
      throw new ImportHttpError(400,"unknown_action","Operación no disponible.");
    }
    if(Number(req.headers.get("content-length")??0)>2000000)throw new ImportHttpError(413,"payload_too_large","El documento es demasiado grande.");
    const text=await req.text();if(Buffer.byteLength(text)>2000000)throw new ImportHttpError(413,"payload_too_large","El documento es demasiado grande.");
    let body:Record<string,unknown>;try{body=JSON.parse(text);}catch{throw new ImportHttpError(400,"invalid_json","Solicitud inválida.");}
    if(!body||typeof body!=="object"||Array.isArray(body))throw new ImportHttpError(400,"invalid_json","Solicitud inválida.");
    if(body.action==="open") {
      const opened=await openWorkspace(admin,session,body,req.headers);
      const accessHeaders=new Headers(req.headers);if(opened.anonymousToken)accessHeaders.set("x-document-token",opened.anonymousToken);
      const actor=await authorizeWorkspace(admin,session,opened.workspace,accessHeaders);
      return NextResponse.json({workspace:projectWorkspace(opened.workspace,actor),...(opened.anonymousToken?{anonymousToken:opened.anonymousToken}:{})},{headers});
    }
    if(body.action==="estimate")return NextResponse.json(await estimateForRequest(admin,session,req.headers,body),{headers});
    const w=await getWorkspace(admin,String(body.workspaceId??""));const actor=await authorizeWorkspace(admin,session,w,req.headers);
    let result:unknown;
    if(body.action==="upload")result=await reserveUpload(admin,w,actor,body);
    else if(body.action==="uploaded") {
      if(actor.kind==="supplier"||!UUID.test(String(body.jobId)))throw new ImportHttpError(403,"not_allowed","Carga no disponible.");
      result=await finishUpload(admin,w,String(body.jobId));
      const job=result as {jobId:string;status:string};
      if(job.status==="queued")after(async()=>{await processImportJob(admin,job.jobId).catch(()=>undefined);});
    }else if(body.action==="apply")result=await applyImport(admin,w,actor,body);
    else if(body.action==="save"||body.action==="confirm")result=await saveWorkspace(admin,w,actor,body,body.action==="confirm");
    else throw new ImportHttpError(400,"unknown_action","Operación no disponible.");
    return NextResponse.json(result,{headers});
  }catch(e){
    if(e instanceof ImportHttpError)return NextResponse.json({error:e.message,code:e.code},{status:e.status,headers});
    if(e instanceof Error && e.message.startsWith("Documento inválido:"))return NextResponse.json({error:e.message,code:"invalid_document"},{status:422,headers});
    // Logs contain only event code, never tokens, raw documents, PII or vendor errors.
    console.error("[document-import] request_failed");
    return NextResponse.json({error:"No pudimos completar la operación. Conserva tus datos e intenta otra vez.",code:"unavailable"},{status:503,headers});
  }
}
