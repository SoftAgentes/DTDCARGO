// @vitest-environment node
import { Readable } from "node:stream";
import type { IncomingMessage,ServerResponse } from "node:http";
import { beforeEach,describe,expect,it,vi } from "vitest";
import { emptyDocumentDraft } from "@/lib/shared/document-import";
import type { ExtractionOptions } from "@/lib/studio/document-import/extract";
import { demoMiddleware } from "./server";

const database=vi.hoisted(()=>({create:vi.fn()}));
vi.mock("./database",()=>({createDemoDatabase:database.create,IDS:{token:"synthetic-token",user:"synthetic-user"},CODE:"DTD-DEMO-1-1",QA_CASES:{pdf:{code:"DTD-DEMO-1-1",token:"synthetic-token"},xlsx:{code:"DTD-DEMO-1-2",token:"synthetic-xlsx-token"}}}));

// Deliberately supplied by the SSR loader, not imported again through another module graph.
class SsrDocumentImportError extends Error {
  constructor(readonly code:string,message:string,readonly retryable=false){super(message);this.name="DocumentImportError";}
}
function deferred<T>(){let resolve!:(value:T)=>void,reject!:(reason:unknown)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}

async function setup(pdfEnabled=false,glmTest=false){
  const draft=emptyDocumentDraft();
  const workspace={id:"synthetic-workspace",revision:0,confirmed_revision:null,draft};
  const other={...workspace,id:"synthetic-xlsx-workspace"};
  const service={getWorkspace:vi.fn(async(_db:unknown,id:string)=>id===other.id?other:workspace),projectWorkspace:vi.fn((w:typeof workspace)=>w),saveWorkspace:vi.fn(),applyImport:vi.fn(async()=>({revision:1}))};
  const extractDocument=vi.fn(async(_bytes:Uint8Array,_options:ExtractionOptions)=>draft);
  const storeJob=vi.fn(),runtime={extract:vi.fn(async()=>draft),receipt:vi.fn(),close:vi.fn()};
  database.create.mockResolvedValue({db:{},pg:{close:vi.fn(),query:vi.fn()},workspaceId:workspace.id,storeJob,...(glmTest?{caseWorkspaces:{pdf:workspace.id,xlsx:other.id}}:{})});
  const ssrLoadModule=vi.fn(async(path:string)=>{
    if(path.endsWith("/service.ts"))return service;
    if(path.endsWith("/extract.ts"))return{extractDocument,DocumentImportError:SsrDocumentImportError};
    if(path.endsWith("/export.ts"))return{exportDocument:vi.fn()};
    if(path.endsWith("/glm-test-runtime.ts"))return{createGlmTestRuntime:vi.fn(async()=>runtime)};
    if(path.endsWith("/estimate.ts"))return{estimateDocuments:vi.fn(()=>({input:{},rates:{}}))};
    throw new Error("Unexpected SSR module");
  });
  const handler=await demoMiddleware({ssrLoadModule},"synthetic-root",{pdfEnabled,...(glmTest?{glmTest:{canonicalRoot:"synthetic-double-only",goId:"synthetic-go-01"}}:{})});
  async function requestStream(method:string,url:string,stream:Readable){
    const req=Object.assign(stream,{method,url,headers:{}});
    const headers=new Map<string,unknown>();let output="";
    const res={statusCode:200,setHeader:(key:string,value:unknown)=>headers.set(key,value),end:(value?:unknown)=>{output=value===undefined?"":String(value);}};
    const next=vi.fn();await handler(req as unknown as IncomingMessage,res as unknown as ServerResponse,next);
    return{status:res.statusCode,output,json:()=>JSON.parse(output) as Record<string,unknown>,headers,next};
  }
  const request=(method:string,url:string,body?:unknown)=>{
    const payload=body===undefined?Buffer.alloc(0):Buffer.isBuffer(body)?body:Buffer.from(JSON.stringify(body));
    return requestStream(method,url,Readable.from(payload.length?[payload]:[]));
  };
  const post=(body:unknown)=>request("POST","/api/document-import",body);
  async function upload(fileName=pdfEnabled?"synthetic.pdf":"synthetic.csv"){
    const response=await post({action:"upload",fileName});
    const {jobId,uploadUrl}=response.json() as {jobId:string;uploadUrl:string};
    await request("PUT",uploadUrl,Buffer.from(pdfEnabled?"%PDF-synthetic-unit-input":"synthetic-unit-input"));
    return jobId;
  }
  const job=(id:string)=>request("GET",`/api/document-import?action=job&jobId=${id}`);
  return{request,requestStream,post,upload,job,extractDocument,service,draft,runtime,storeJob,workspace,other};
}

describe("S3 TEST middleware core boundary",()=>{
  it("publishes effective GLM disclosure and both admitted formats without a legacy provider call",async()=>{
    const h=await setup(true,true);expect((await h.request("GET","/api/document-import?action=capabilities")).json()).toMatchObject({formats:["pdf","xlsx"],extractionDisclosure:expect.stringContaining("GLM")});
    expect(h.runtime.extract).not.toHaveBeenCalled();expect(h.extractDocument).not.toHaveBeenCalled();
  });
  it("persists extracted jobs and applies through the real core seam with its actual prior",async()=>{
    const h=await setup(true,true),created=await h.post({action:"upload",fileName:"synthetic.pdf",kind:"proforma",sizeBytes:14,workspaceId:h.workspace.id});
    const id=String(created.json().jobId);await h.request("PUT",String(created.json().uploadUrl),Buffer.from("%PDF-synthetic"));
    await h.post({action:"uploaded",jobId:id,workspaceId:h.workspace.id});expect(h.storeJob).toHaveBeenCalledWith(expect.objectContaining({id,workspaceId:h.workspace.id,kind:"proforma",result:h.draft}));
    const command={action:"apply",workspaceId:h.workspace.id,jobId:id,expectedRevision:0,commandId:"synthetic-command"};await h.post(command);
    expect(h.service.applyImport).toHaveBeenCalledWith(expect.anything(),h.workspace,{kind:"client",id:"synthetic-user"},command);
    expect(h.service.saveWorkspace).not.toHaveBeenCalled();expect(h.extractDocument).not.toHaveBeenCalled();
  });
  it("never attaches a late extraction to a newer server revision or a different case",async()=>{
    const h=await setup(true,true),created=await h.post({action:"upload",fileName:"synthetic.pdf",kind:"combined",sizeBytes:14,workspaceId:h.workspace.id}),id=String(created.json().jobId);
    await h.request("PUT",String(created.json().uploadUrl),Buffer.from("%PDF-synthetic"));h.runtime.extract.mockImplementationOnce(async()=>{h.workspace.revision++;return h.draft;});
    expect((await h.post({action:"uploaded",jobId:id,workspaceId:h.workspace.id})).json()).toMatchObject({status:"failed"});expect(h.storeJob).not.toHaveBeenCalled();
    expect((await h.request("GET",`/api/document-import?action=job&jobId=${id}&workspaceId=${h.other.id}`)).status).toBe(404);
    expect((await h.request("POST","/qa/reset")).status).toBe(409);
  });
});

describe("SDD-0473 PDF QA · lectura e idempotencia",()=>{
  beforeEach(()=>{vi.clearAllMocks();});
  it("el modo por defecto conserva CSV y XLSX y devuelve la propuesta CSV sin guardarla automáticamente",async()=>{
    const h=await setup();expect((await h.request("GET","/api/document-import?action=capabilities")).json()).toMatchObject({formats:["xlsx","csv","pdf"]});
    const id=await h.upload("synthetic.csv");expect((await h.post({action:"uploaded",jobId:id})).json()).toEqual({jobId:id,status:"ready"});
    expect((await h.job(id)).json()).toEqual({job:{status:"ready",result:h.draft,errorCode:null}});
    expect(h.extractDocument).toHaveBeenCalledWith(expect.any(Uint8Array),{fileName:"synthetic.csv",kind:"combined",sourceId:id});expect(h.service.saveWorkspace).not.toHaveBeenCalled();
  });
  it("PDF deshabilitado falla sin invocar el extractor aunque el proceso pudiera tener una clave",async()=>{
    const h=await setup(),id=await h.upload("synthetic.pdf");
    expect((await h.post({action:"uploaded",jobId:id})).json()).toEqual({jobId:id,status:"failed"});
    expect((await h.job(id)).json()).toEqual({job:{status:"failed",result:null,errorCode:"configuration_missing"}});
    expect(h.extractDocument).not.toHaveBeenCalled();expect(h.service.saveWorkspace).not.toHaveBeenCalled();
  });
  it("la instancia opt-in ofrece sólo PDF y no abre un fallback IA para Excel",async()=>{
    const h=await setup(true);
    expect((await h.request("GET","/api/document-import?action=capabilities")).json()).toMatchObject({formats:["pdf"]});
    expect((await h.post({action:"upload",fileName:"other.xlsx"})).status).toBe(400);
    expect(h.extractDocument).not.toHaveBeenCalled();
  });
  it("uploaded concurrente devuelve processing y luego ready sin una segunda extracción ni aplicación automática",async()=>{
    const h=await setup(true),id=await h.upload(),pending=deferred<typeof h.draft>(),entered=deferred<void>();
    h.extractDocument.mockImplementationOnce(()=>{entered.resolve();return pending.promise;});
    const first=h.post({action:"uploaded",jobId:id});await entered.promise;
    expect((await h.post({action:"uploaded",jobId:id})).json()).toEqual({jobId:id,status:"processing"});
    expect((await h.job(id)).json()).toEqual({job:{status:"processing",result:null,errorCode:null}});
    expect(h.extractDocument).toHaveBeenCalledTimes(1);
    pending.resolve(h.draft);expect((await first).json()).toEqual({jobId:id,status:"ready"});
    expect((await h.post({action:"uploaded",jobId:id})).json()).toEqual({jobId:id,status:"ready"});
    expect((await h.job(id)).json()).toEqual({job:{status:"ready",result:h.draft,errorCode:null}});
    expect(h.extractDocument).toHaveBeenCalledTimes(1);expect(h.service.saveWorkspace).not.toHaveBeenCalled();
  });
  it.each(["configuration_invalid","extraction_unavailable","extraction_invalid"])("preserva el código SSR %s sin mensajes privados y no reintenta failed",async code=>{
    const h=await setup(true),id=await h.upload();
    h.extractDocument.mockRejectedValueOnce(new SsrDocumentImportError(code,"PRIVATE provider-body synthetic-key /private/path"));
    await h.post({action:"uploaded",jobId:id});const first=await h.job(id);
    expect(first.json()).toEqual({job:{status:"failed",result:null,errorCode:code}});
    expect(first.output).not.toMatch(/PRIVATE|synthetic-key|private\/path|stack|provider-body/);
    expect((await h.post({action:"uploaded",jobId:id})).json()).toEqual({jobId:id,status:"failed"});
    expect(h.extractDocument).toHaveBeenCalledTimes(1);expect(h.service.saveWorkspace).not.toHaveBeenCalled();
  });
  it("un error desconocido con nombre y code falsos no se confunde con DocumentImportError del SSR",async()=>{
    const h=await setup(true),id=await h.upload();
    h.extractDocument.mockRejectedValueOnce(Object.assign(new Error("PRIVATE stack and key"),{name:"DocumentImportError",code:"configuration_missing"}));
    await h.post({action:"uploaded",jobId:id});const response=await h.job(id);
    expect(response.json()).toEqual({job:{status:"failed",result:null,errorCode:"extraction_unavailable"}});
    expect(response.output).not.toMatch(/PRIVATE|stack|key/);
  });
  it("el fallo concurrente queda terminal y un nuevo intento requiere crear otro job explícitamente",async()=>{
    const h=await setup(true),id=await h.upload(),pending=deferred<typeof h.draft>(),entered=deferred<void>();
    h.extractDocument.mockImplementationOnce(()=>{entered.resolve();return pending.promise;});
    const first=h.post({action:"uploaded",jobId:id});await entered.promise;
    expect((await h.post({action:"uploaded",jobId:id})).json()).toMatchObject({status:"processing"});
    pending.reject(new SsrDocumentImportError("extraction_unavailable","PRIVATE"));await first;
    await h.post({action:"uploaded",jobId:id});expect(h.extractDocument).toHaveBeenCalledTimes(1);
    const retryId=await h.upload();expect(retryId).not.toBe(id);
    expect((await h.post({action:"uploaded",jobId:retryId})).json()).toEqual({jobId:retryId,status:"ready"});
    expect(h.extractDocument).toHaveBeenCalledTimes(2);expect(h.service.saveWorkspace).not.toHaveBeenCalled();
  });
  it("un trabajo procesado no permite sustituir sus bytes con otro PUT",async()=>{
    const h=await setup(true),id=await h.upload();await h.post({action:"uploaded",jobId:id});
    const response=await h.request("PUT",`/qa/upload/${id}`,Buffer.from("replacement"));
    expect(response.status).toBe(409);expect(response.json()).toEqual({code:"upload_closed"});
    await h.post({action:"uploaded",jobId:id});expect(h.extractDocument).toHaveBeenCalledTimes(1);
  });
  it("un PUT iniciado antes de processing no sobrescribe los bytes si termina durante la extracción",async()=>{
    const h=await setup(true),id=await h.upload(),body=deferred<Buffer>(),bodyEntered=deferred<void>(),result=deferred<typeof h.draft>(),extractEntered=deferred<void>();
    h.extractDocument.mockImplementationOnce(()=>{extractEntered.resolve();return result.promise;});
    const slowPut=h.requestStream("PUT",`/qa/upload/${id}`,Readable.from((async function*(){bodyEntered.resolve();yield await body.promise;})()));
    await bodyEntered.promise;const first=h.post({action:"uploaded",jobId:id});await extractEntered.promise;
    body.resolve(Buffer.from("replacement after extraction began"));expect((await slowPut).status).toBe(409);
    expect(h.extractDocument).toHaveBeenCalledWith(expect.any(Uint8Array),{fileName:"synthetic.pdf",kind:"combined",sourceId:id});
    expect(Buffer.from(h.extractDocument.mock.calls[0][0] as Uint8Array).toString()).toBe("%PDF-synthetic-unit-input");
    result.resolve(h.draft);await first;
    expect((await h.post({action:"uploaded",jobId:id})).json()).toMatchObject({status:"ready"});expect(h.extractDocument).toHaveBeenCalledTimes(1);
  });
  it("uploaded sin bytes conserva el fallo de carga y no invoca el servicio IA",async()=>{
    const h=await setup(true),created=await h.post({action:"upload",fileName:"synthetic.pdf"}),id=String(created.json().jobId);
    const response=await h.post({action:"uploaded",jobId:id});
    expect(response.status).toBe(400);expect(response.json()).toEqual({code:"upload_failed"});expect(h.extractDocument).not.toHaveBeenCalled();
  });
});
