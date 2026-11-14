import type { IncomingMessage,ServerResponse } from "node:http";
import { randomUUID,createHash } from "node:crypto";
import { createDemoDatabase,IDS,CODE,QA_CASES } from "./database";
import { parseDocumentDraft,mergeDocuments,projectSupplierDocument,type DocumentDraft,type DocumentKind } from "@/lib/shared/document-import";
import { DISABLED_QA_EXTRACTION,qaExtractionErrorCode,qaCaseRoute,type QaExtractionConfig } from "./extraction-config";
import type { createGlmTestRuntime } from "./glm-test-runtime";
import type { estimateDocuments } from "@/lib/studio/document-import/estimate";

/** Explicit fictitious snapshot; never queried from production or presented as online parity. */
export const QA_RATE_SNAPSHOT = Object.freeze({ id:"sdd0473-s3-fictional-20261022-v1",fictitious:true,
  rates:{rate:{per_cbm:100,min_charge:380,valid_until:null},params:{pesoIncluidoKg:1000,recargoExcedenteKg:2,descuentoValencia:0,recargoEmbalajeEspecial:75,recargoBateriaMult:1.5,thresholdCascoKm:0,tarifaKmFueraCasco:0,cbmMaxContenedor:68,pesoMaxContenedorKg:27000,pesoMaxEnvioKg:12000},cities:[{id:"maracaibo",label:"Maracaibo · prueba ficticia",km:410,casco:false,ventaCbm:100,minCharge:200,frecuenciaDias:7,cubierta:true}]},
});

export const EXAMPLE_CSV="Supplier,Proveedor de ejemplo\nProduct,Code,Cartons,Qty/CTN,Total PCS,Unit price USD,Unit,Gross weight kg,Total CBM\nVasos de vidrio,VAS-01,10,10,100,3.5,pcs,,0.6\n";
export async function demoMiddleware(server:{ssrLoadModule:(path:string)=>Promise<unknown>},root:string,extraction:QaExtractionConfig=DISABLED_QA_EXTRACTION,options:{nativeOnly?:boolean}={}){
  const nativeOnly=options.nativeOnly===true;
  if(nativeOnly&&(extraction.glmTest||extraction.pdfEnabled))throw new Error("Native demo requires disabled assisted extraction");
  let database=extraction.glmTest?await createDemoDatabase(root,{separateGlmCases:true}):await createDemoDatabase(root);
  let glm:Awaited<ReturnType<typeof createGlmTestRuntime>>|undefined;
  let estimate:typeof estimateDocuments|undefined;
  if(extraction.glmTest){
    if(!database.caseWorkspaces)throw new Error("Missing separate fictitious cases");
    const module=await server.ssrLoadModule("/docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/glm-test-runtime.ts") as {createGlmTestRuntime:typeof createGlmTestRuntime};
    glm=await module.createGlmTestRuntime({...extraction.glmTest,workspaceIds:database.caseWorkspaces});
  }
  const isolated=Boolean(glm)||nativeOnly;
  if(isolated)estimate=(await server.ssrLoadModule("/lib/studio/document-import/estimate.ts") as {estimateDocuments:typeof estimateDocuments}).estimateDocuments;
  const jobs=new Map<string,{bytes?:Uint8Array;fileName:string;sizeBytes?:number;workspaceId?:string;kind:DocumentKind;revision?:number;stage?:"ocr"|"tokenizer"|"chat";result?:DocumentDraft;status:"uploading"|"processing"|"ready"|"failed";errorCode?:string}>();
  const service=await server.ssrLoadModule("/lib/studio/document-import/service.ts") as typeof import("@/lib/studio/document-import/service");
  const extractor=await server.ssrLoadModule("/lib/studio/document-import/extract.ts") as typeof import("@/lib/studio/document-import/extract");
  const exporter=await server.ssrLoadModule("/lib/studio/document-import/export.ts") as typeof import("@/lib/studio/document-import/export");
  return async(req:IncomingMessage,res:ServerResponse,next:()=>void)=>{
    const url=new URL(req.url??"/","http://127.0.0.1");
    const canonical=glm?qaCaseRoute(url.pathname):null;
    if(canonical&&req.method==="GET"){res.statusCode=302;res.setHeader("Location",`/docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/index.html?page=${canonical.page}&case=${canonical.kind}`);res.end();return;}
    if(url.pathname===`/p/${IDS.token}`&&req.method==="GET"){res.statusCode=302;res.setHeader("Location","/docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/index.html?page=supplier");res.end();return;}
    if(!url.pathname.startsWith("/qa/")&&url.pathname!=="/api/document-import")return next();
    res.setHeader("Cache-Control","no-store");
    const json=(data:unknown,status=200)=>{res.statusCode=status;res.setHeader("Content-Type","application/json");res.end(JSON.stringify(data));};
    async function bytes(){const parts:Buffer[]=[];let size=0;for await(const chunk of req){const part=Buffer.from(chunk);size+=part.length;if(size>15*1024*1024)throw new Error("File too large");parts.push(part);}return Buffer.concat(parts);}
    try{
      if(url.pathname==="/qa/example.csv"){res.setHeader("Content-Type","text/csv; charset=utf-8");res.setHeader("Content-Disposition","attachment; filename=packing-demo-sin-peso.csv");res.end(EXAMPLE_CSV);return;}
      if(url.pathname==="/qa/reset"&&req.method==="POST"){if(isolated){json({code:"qa_reset_disabled"},409);return;}await database.pg.close();database=await createDemoDatabase(root);jobs.clear();json({ok:true});return;}
      if(url.pathname.startsWith("/qa/upload/")&&req.method==="PUT"){const job=jobs.get(url.pathname.split("/").pop()??"");if(!job){json({},404);return;}if(job.status!=="uploading"){json({code:"upload_closed"},409);return;}const uploadedBytes=new Uint8Array(await bytes());if(job.status!=="uploading"){json({code:"upload_closed"},409);return;}if(nativeOnly&&uploadedBytes.length!==job.sizeBytes){job.status="failed";job.errorCode="upload_failed";json({code:"invalid_metadata"},400);return;}job.bytes=uploadedBytes;res.end();return;}
      if(url.pathname!=="/api/document-import"){json({},404);return;}
      const body=req.method==="POST"?JSON.parse((await bytes()).toString("utf8")) as Record<string,unknown>:{};
      const action=String(body.action??url.searchParams.get("action"));
      if(nativeOnly&&action==="pdf"){json({code:"qa_pdf_disabled"},400);return;}
      const token=req.headers["x-supplier-token"];
      const actor=token===IDS.token||(glm&&token===QA_CASES.xlsx.token)?{kind:"supplier" as const,id:"supplier:demo"}:{kind:"client" as const,id:IDS.user};
      if(isolated&&token&&actor.kind!=="supplier"){json({code:"not_found"},404);return;}
      if(action==="capabilities"){json({available:true,portal:true,formats:nativeOnly?["xlsx","csv"]:glm?["pdf","xlsx"]:extraction.pdfEnabled?["pdf"]:["xlsx","csv","pdf"],maxBytes:15*1024*1024,
        extractionDisclosure:nativeOnly?"El XLSX o CSV se lee en esta máquina, sin IA. El PDF está deshabilitado. Revisa la propuesta; los datos que falten quedan pendientes.":glm?"El PDF se envía a GLM · Z.AI Standard para OCR y lectura asistida. El Excel usa lectura nativa sin IA. Revisa la propuesta antes de aplicarla.":"La lectura asistida envía el contenido a Anthropic. Revisa la propuesta antes de aplicarla."});return;}
      const requestedId=String(body.workspaceId??url.searchParams.get("workspaceId")??(Array.isArray(body.workspaceIds)&&body.workspaceIds.length===1?body.workspaceIds[0]:""));
      const xlsx=glm&&(body.purchaseCode===QA_CASES.xlsx.code||requestedId===database.caseWorkspaces?.xlsx||token===QA_CASES.xlsx.token);
      const targetId=xlsx?database.caseWorkspaces!.xlsx:database.workspaceId;
      if(isolated&&body.purchaseCode!==undefined&&body.purchaseCode!==(xlsx?QA_CASES.xlsx.code:CODE)){json({code:"not_found"},404);return;}
      if(isolated&&requestedId&&requestedId!==targetId){json({code:"not_found"},404);return;}
      if(glm&&actor.kind==="supplier"&&((token===QA_CASES.xlsx.token)!==xlsx)){json({code:"not_found"},404);return;}
      if(isolated&&actor.kind==="supplier"&&["upload","uploaded","job","apply","estimate","destinations"].includes(action)){json({code:"not_allowed"},403);return;}
      const w=await service.getWorkspace(database.db,targetId);
      if(glm&&action==="usage"){if(actor.kind==="supplier"){json({code:"not_allowed"},403);return;}json({receipt:glm.receipt(w.id)});return;}
      if(isolated&&action==="destinations"){json({cities:QA_RATE_SNAPSHOT.rates.cities});return;}
      if(isolated&&action==="estimate"){
        if(!Array.isArray(body.workspaceIds)||body.workspaceIds.length!==1||body.workspaceIds[0]!==w.id){json({code:"invalid_selection"},400);return;}
        if(!Array.isArray(body.expectedRevisions)||body.expectedRevisions.length!==1||body.expectedRevisions[0]?.workspaceId!==w.id||body.expectedRevisions[0]?.revision!==w.revision){json({code:"revision_conflict"},409);return;}
        const result=estimate!([w],body,QA_RATE_SNAPSHOT.rates);
        const snapshot={id:QA_RATE_SNAPSHOT.id,fictitious:true,digest:createHash("sha256").update(JSON.stringify(QA_RATE_SNAPSHOT)).digest("hex")};
        let savedId:string|undefined;
        if(body.save===true){
          const before=await service.getWorkspace(database.db,w.id);
          if(before.revision!==w.revision||before.tenant_id!==w.tenant_id||before.client_id!==w.client_id||before.prealerta_id!==w.prealerta_id){json({code:"revision_conflict"},409);return;}
          const id=await database.saveEstimateSnapshot(w,{inputs:{workspaceIds:body.workspaceIds,expectedRevisions:body.expectedRevisions,input:result.input},rates:{...result.rates,snapshot},result});
          if(!id){json({code:"revision_conflict"},409);return;}savedId=id;
        }
        const latest=await service.getWorkspace(database.db,w.id);if(latest.revision!==w.revision||latest.tenant_id!==w.tenant_id||latest.client_id!==w.client_id||latest.prealerta_id!==w.prealerta_id||latest.anonymous_hash!==w.anonymous_hash){json({code:"revision_conflict"},409);return;}
        json({...result,snapshot,...(savedId?{savedId}:{})});return;
      }
      if(action==="open"||action==="workspace"){json({workspace:service.projectWorkspace(w,actor)});return;}
      if(action==="upload"){const fileName=String(body.fileName);if(extraction.pdfEnabled&&!glm&&!fileName.toLowerCase().endsWith(".pdf")){json({code:"qa_pdf_only"},400);return;}
        if(nativeOnly&&(typeof body.fileName!=="string"||fileName.length>200||fileName.includes("\0")||!Number.isInteger(body.sizeBytes)||Number(body.sizeBytes)<=0||Number(body.sizeBytes)>15*1024*1024||!/\.(xlsx|csv)$/i.test(fileName)||!["packing_list","invoice","proforma","combined","unknown"].includes(String(body.kind)))){json({code:"invalid_metadata"},400);return;}
        if(glm&&(!Number.isInteger(body.sizeBytes)||Number(body.sizeBytes)<=0||Number(body.sizeBytes)>15*1024*1024||!(xlsx?/\.xlsx$/i:/\.pdf$/i).test(fileName)||!["packing_list","invoice","proforma","combined","unknown"].includes(String(body.kind)))){json({code:"invalid_metadata"},400);return;}
        const id=randomUUID();jobs.set(id,{fileName,kind:isolated?body.kind as DocumentKind:"combined",...(nativeOnly?{sizeBytes:Number(body.sizeBytes)}:{}),workspaceId:w.id,revision:w.revision,status:"uploading"});json({jobId:id,status:"uploading",uploadUrl:`/qa/upload/${id}`,contentType:"application/octet-stream"});return;}
      if(action==="uploaded"){
        const id=String(body.jobId),job=jobs.get(id);
        if(!job){json({code:"upload_failed"},400);return;}
        if(isolated&&job.workspaceId!==w.id){json({code:"not_found"},404);return;}
        if(isolated&&job.revision!==w.revision){json({code:glm?"qa_glm_context_conflict":"revision_conflict"},409);return;}
        // Reserve synchronously before the first await; duplicate requests never re-extract.
        if(job.status!=="uploading"){json({jobId:id,status:job.status});return;}
        if(!job.bytes){json({code:"upload_failed"},400);return;}
        job.status="processing";
        let responseId=id;
        try{
          if(job.fileName.toLowerCase().endsWith(".pdf")&&!extraction.pdfEnabled)throw new extractor.DocumentImportError("configuration_missing","La lectura PDF no está habilitada en esta demo.");
          const options={fileName:job.fileName,kind:job.kind,sourceId:id};
          let result=glm?await glm.extract(job.bytes,options,w,stage=>{job.stage=stage;}):nativeOnly?await extractor.extractDocument(job.bytes,options,{nativeOnly:true}):await extractor.extractDocument(job.bytes,options);
          if(isolated){
            const latest=await service.getWorkspace(database.db,w.id);
            if(latest.revision!==job.revision||latest.tenant_id!==w.tenant_id||latest.client_id!==w.client_id||latest.prealerta_id!==w.prealerta_id||latest.anonymous_hash!==w.anonymous_hash)throw new Error("Stale extraction");
            const sha256=createHash("sha256").update(job.bytes).digest("hex");
            const context=glm?glm.contextId(options,w):createHash("sha256").update(JSON.stringify({mode:"native-only",workspaceId:w.id,revision:w.revision,fileName:job.fileName,kind:job.kind,sha256})).digest("hex");
            responseId=await database.storeJob({id,workspaceId:w.id,fileName:job.fileName,kind:job.kind,size:job.bytes.length,sha256,context,result});
            if(responseId!==id){const known=jobs.get(responseId);if(!known?.result||known.workspaceId!==w.id||known.revision!==w.revision)throw new Error("Unknown completed job");result=known.result;}
          }
          job.result=result;
          job.status="ready";
        }catch(error){responseId=id;job.errorCode=glm?.failureCode(error)??qaExtractionErrorCode(error,extractor.DocumentImportError);job.status="failed";}
        json({jobId:responseId,status:job.status});return;
      }
      if(action==="job"){const job=jobs.get(url.searchParams.get("jobId")??"");if(isolated&&job?.workspaceId!==w.id){json({code:"not_found"},404);return;}json({job:{status:job?.status??"failed",result:job?.result??null,errorCode:job?.errorCode??null,...(glm&&job?.stage?{stage:job.stage}:{})}});return;}
      if(action==="apply"){if(isolated){const job=jobs.get(String(body.jobId));if(!job?.result||job.workspaceId!==w.id){json({code:"not_found"},404);return;}if(job.revision!==w.revision){json({code:glm?"qa_glm_context_conflict":"revision_conflict"},409);return;}json(await service.applyImport(database.db,w,actor,body));return;}const job=jobs.get(String(body.jobId));if(!job?.result){json({code:"not_found"},404);return;}const merged=mergeDocuments(parseDocumentDraft(w.draft),job.result);json(await service.saveWorkspace(database.db,{...w,draft:merged},actor,{...body,draft:merged}));return;}
      if(action==="save"||action==="confirm"){json(await service.saveWorkspace(database.db,w,actor,body,action==="confirm"));return;}
      if(action==="labels"){json(await service.getDocumentLabels(database.db,w,Number(url.searchParams.get("expectedRevision"))));return;}
      if(glm&&action==="pdf"){
        const expected=Number(url.searchParams.get("expectedRevision"));
        const gate=await service.getDocumentLabels(database.db,w,expected);
        const readMapping=async()=>{
          const rows=await database.pg.query<{box_code:string;group_id:string}>("select b.code box_code,g.group_id from document_group_boxes g join warehouse_boxes b on b.id=g.box_id where g.workspace_id=$1 and g.revision=$2 order by b.code",[w.id,expected]);
          return rows.rows.map(row=>({boxCode:row.box_code,groupId:row.group_id}));
        };
        const mapping=await readMapping();
        const pdf=await server.ssrLoadModule("/lib/studio/document-import/pdf.tsx") as typeof import("@/lib/studio/document-import/pdf");
        const surface=pdf.parsePdfSurface(url.searchParams.get("surface"));
        const result=await pdf.renderConfirmedDocumentPdf({draft:projectSupplierDocument(parseDocumentDraft(w.draft)),markbox:"DTD-DEMO",code:xlsx?QA_CASES.xlsx.code:CODE,revision:expected,folio:gate.folio,versionNo:gate.versionNo,labels:gate.labels,boxGroups:mapping},surface);
        const latest=await service.getWorkspace(database.db,w.id),current=await service.getDocumentLabels(database.db,latest,expected);
        if(latest.confirmed_submission_id!==w.confirmed_submission_id||JSON.stringify(current)!==JSON.stringify(gate)||JSON.stringify(await readMapping())!==JSON.stringify(mapping)){json({code:"revision_conflict"},409);return;}
        res.setHeader("Content-Type","application/pdf");res.setHeader("Content-Disposition",`attachment; filename="${surface}-${xlsx?QA_CASES.xlsx.code:CODE}-Rev${expected}.pdf"`);res.end(Buffer.from(result.bytes));return;
      }
      if(action==="history"){const result=await database.pg.query<{draft:DocumentDraft}>("select revision,draft,actor_kind,confirmed,created_at from document_workspace_versions where workspace_id=$1 order by revision desc",[w.id]);json({versions:result.rows.map(version=>({...version,draft:actor.kind==="supplier"?projectSupplierDocument(parseDocumentDraft(version.draft)):version.draft}))});return;}
      if(action==="export"){
        const expected=Number(url.searchParams.get("expectedRevision"));
        if(isolated&&(!Number.isInteger(expected)||expected!==w.revision)){json({code:"revision_conflict"},409);return;}
        const result=await exporter.exportDocument(projectSupplierDocument(parseDocumentDraft(w.draft)),{markbox:"DTD-DEMO",code:xlsx?QA_CASES.xlsx.code:CODE,confirmed:w.revision===w.confirmed_revision,revision:w.revision});
        if(isolated){const latest=await service.getWorkspace(database.db,w.id);if(latest.revision!==expected||latest.confirmed_submission_id!==w.confirmed_submission_id){json({code:"revision_conflict"},409);return;}}
        res.setHeader("Content-Type","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");res.end(Buffer.from(result));return;}
      json({code:"unknown_action"},400);
    }catch(error){const known=error as {status?:number;code?:string};json({code:known.code??"demo_failed",error:"La operación local no se pudo completar."},known.status??500);}
  };
}
