import type { IncomingMessage,ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { createDemoDatabase,IDS,CODE } from "./database";
import { parseDocumentDraft,mergeDocuments,type DocumentDraft } from "@/lib/shared/document-import";

export const EXAMPLE_CSV="Supplier,Proveedor de ejemplo\nProduct,Code,Cartons,Qty/CTN,Total PCS,Unit price USD,Unit,Gross weight kg,Total CBM\nVasos de vidrio,VAS-01,10,10,100,3.5,pcs,,0.6\n";
export async function demoMiddleware(server:{ssrLoadModule:(path:string)=>Promise<unknown>},root:string){
  let database=await createDemoDatabase(root);
  const jobs=new Map<string,{bytes?:Uint8Array;fileName:string;result?:DocumentDraft;status:string}>();
  const service=await server.ssrLoadModule("/lib/studio/document-import/service.ts") as typeof import("@/lib/studio/document-import/service");
  const extractor=await server.ssrLoadModule("/lib/studio/document-import/extract.ts") as typeof import("@/lib/studio/document-import/extract");
  const exporter=await server.ssrLoadModule("/lib/studio/document-import/export.ts") as typeof import("@/lib/studio/document-import/export");
  return async(req:IncomingMessage,res:ServerResponse,next:()=>void)=>{
    const url=new URL(req.url??"/","http://127.0.0.1");
    if(url.pathname===`/p/${IDS.token}`&&req.method==="GET"){res.statusCode=302;res.setHeader("Location","/docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/index.html?page=supplier");res.end();return;}
    if(!url.pathname.startsWith("/qa/")&&url.pathname!=="/api/document-import")return next();
    res.setHeader("Cache-Control","no-store");
    const json=(data:unknown,status=200)=>{res.statusCode=status;res.setHeader("Content-Type","application/json");res.end(JSON.stringify(data));};
    async function bytes(){const parts:Buffer[]=[];let size=0;for await(const chunk of req){const part=Buffer.from(chunk);size+=part.length;if(size>15*1024*1024)throw new Error("File too large");parts.push(part);}return Buffer.concat(parts);}
    try{
      if(url.pathname==="/qa/example.csv"){res.setHeader("Content-Type","text/csv; charset=utf-8");res.setHeader("Content-Disposition","attachment; filename=packing-demo-sin-peso.csv");res.end(EXAMPLE_CSV);return;}
      if(url.pathname==="/qa/reset"&&req.method==="POST"){await database.pg.close();database=await createDemoDatabase(root);jobs.clear();json({ok:true});return;}
      if(url.pathname.startsWith("/qa/upload/")&&req.method==="PUT"){const job=jobs.get(url.pathname.split("/").pop()??"");if(!job){json({},404);return;}job.bytes=new Uint8Array(await bytes());res.end();return;}
      if(url.pathname!=="/api/document-import"){json({},404);return;}
      const body=req.method==="POST"?JSON.parse((await bytes()).toString("utf8")) as Record<string,unknown>:{};
      const action=String(body.action??url.searchParams.get("action"));
      const actor=req.headers["x-supplier-token"]===IDS.token?{kind:"supplier" as const,id:"supplier:demo"}:{kind:"client" as const,id:IDS.user};
      if(action==="capabilities"){json({available:true,portal:true,formats:["xlsx","csv","pdf"],maxBytes:15*1024*1024});return;}
      const w=await service.getWorkspace(database.db,database.workspaceId);
      if(action==="open"||action==="workspace"){json({workspace:service.projectWorkspace(w,actor)});return;}
      if(action==="upload"){const id=randomUUID();jobs.set(id,{fileName:String(body.fileName),status:"uploading"});json({jobId:id,status:"uploading",uploadUrl:`/qa/upload/${id}`,contentType:"application/octet-stream"});return;}
      if(action==="uploaded"){const id=String(body.jobId),job=jobs.get(id);if(!job?.bytes){json({code:"upload_failed"},400);return;}try{job.result=await extractor.extractDocument(job.bytes,{fileName:job.fileName,kind:"combined",sourceId:id});job.status="ready";}catch{job.status="failed";}json({jobId:id,status:job.status});return;}
      if(action==="job"){const job=jobs.get(url.searchParams.get("jobId")??"");json({job:{status:job?.status??"failed",result:job?.result??null,errorCode:job?.status==="failed"?"configuration_missing":null}});return;}
      if(action==="apply"){const job=jobs.get(String(body.jobId));if(!job?.result){json({code:"not_found"},404);return;}const merged=mergeDocuments(parseDocumentDraft(w.draft),job.result);json(await service.saveWorkspace(database.db,{...w,draft:merged},actor,{...body,draft:merged}));return;}
      if(action==="save"||action==="confirm"){json(await service.saveWorkspace(database.db,w,actor,body,action==="confirm"));return;}
      if(action==="labels"){json(await service.getDocumentLabels(database.db,w,Number(url.searchParams.get("expectedRevision"))));return;}
      if(action==="history"){const result=await database.pg.query<{draft:DocumentDraft}>("select revision,draft,actor_kind,confirmed,created_at from document_workspace_versions where workspace_id=$1 order by revision desc",[w.id]);json({versions:result.rows.map(version=>({...version,draft:actor.kind==="supplier"?{...version.draft,sources:[]}:version.draft}))});return;}
      if(action==="export"){const result=await exporter.exportDocument(parseDocumentDraft(w.draft),{markbox:"DTD-DEMO",code:CODE,confirmed:w.revision===w.confirmed_revision,revision:w.revision});res.setHeader("Content-Type","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");res.end(Buffer.from(result));return;}
      json({code:"unknown_action"},400);
    }catch(error){const known=error as {status?:number;code?:string};json({code:known.code??"demo_failed",error:"La operación local no se pudo completar."},known.status??500);}
  };
}
