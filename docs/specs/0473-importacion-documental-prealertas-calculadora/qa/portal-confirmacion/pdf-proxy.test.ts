// @vitest-environment node
import { describe,expect,it,vi } from "vitest";
import type { IncomingMessage,ServerResponse } from "node:http";
import { emptyDocumentDraft } from "@/lib/shared/document-import";
import { createPdfProxy } from "./pdf-proxy";

const id="11111111-1111-4111-8111-111111111111";
function setup(surface="packing-list") {
  let revision=4,confirmed=4;
  const headers=new Map<string,unknown>();let output:unknown;
  const res={statusCode:0,setHeader:(key:string,value:unknown)=>headers.set(key,value),end:(value:unknown)=>{output=value;}};
  const req={method:"GET",url:`/api/document-import?action=pdf&workspaceId=${id}&expectedRevision=4&surface=${surface}`,headers:{"x-supplier-token":"synthetic-only"}};
  const labels=[{code:"DTD-DEMO-1",boxN:1,totalBoxes:1,boxCode:"DTD-B-000001"}];
  const request=vi.fn(async(url:string|URL|Request)=>{
    const action=new URL(String(url)).searchParams.get("action");
    return new Response(JSON.stringify(action==="workspace"?{workspace:{id,revision,confirmedRevision:confirmed,draft:emptyDocumentDraft()}}:{revision,folio:"PL-TEST",versionNo:1,labels}),{headers:{"Content-Type":"application/json"}});
  });
  const render=vi.fn(async()=>({bytes:new TextEncoder().encode("%PDF-synthetic-contract")}));
  const proxy=createPdfProxy({backend:"http://127.0.0.1:4320",markbox:"DTD-DEMO",request,render});
  return {request,render,headers,res,req,run:()=>proxy(req as unknown as IncomingMessage,res as unknown as ServerResponse),output:()=>output,change:()=>{revision=5;confirmed=4;},changeCode:()=>{labels[0].boxCode="DTD-B-000002";}};
}
describe("proxy PDF SDD-0473 B",()=>{
  it.each(["packing-list","labels"])("produce %s desde autoridad4320 y revalida después de renderizar",async(surface)=>{
    const h=setup(surface);expect(await h.run()).toBe(true);expect(h.res.statusCode).toBe(200);expect(h.headers.get("Content-Type")).toBe("application/pdf");expect(h.headers.get("Cache-Control")).toBe("private, no-store");expect(Buffer.from(h.output() as Uint8Array).toString()).toContain("%PDF-");
    expect(h.request).toHaveBeenCalledTimes(4);for(const call of h.request.mock.calls)expect(String(call[0])).toMatch(/^http:\/\/127\.0\.0\.1:4320\/api\/document-import/);expect(h.render).toHaveBeenCalledWith(expect.objectContaining({markbox:"DTD-DEMO",revision:4,labels:[expect.objectContaining({boxCode:"DTD-B-000001"})]}),surface);
  });
  it("una revisión que cambia en el render responde409 y no envía el buffer viejo",async()=>{
    const h=setup();h.render.mockImplementationOnce(async()=>{h.change();return {bytes:new TextEncoder().encode("%PDF-stale")};});await h.run();expect(h.res.statusCode).toBe(409);expect(String(h.output())).not.toContain("%PDF-stale");expect(JSON.parse(String(h.output())).code).toBe("revision_conflict");
  });
  it("el cambio de código físico también devuelve409 sin bytes aunque la revisión siga igual",async()=>{
    const h=setup();h.render.mockImplementationOnce(async()=>{h.changeCode();return {bytes:new TextEncoder().encode("%PDF-old-code")};});await h.run();expect(h.res.statusCode).toBe(409);expect(JSON.parse(String(h.output())).code).toBe("revision_conflict");expect(String(h.output())).not.toContain("%PDF-old-code");
  });
  it("503 de fuente preserva un mensaje seguro, sin rutas locales",async()=>{
    const h=setup();h.render.mockRejectedValueOnce({status:503,code:"pdf_font_unavailable",message:"C:/PRIVATE/FONT.ttf"});await h.run();expect(h.res.statusCode).toBe(503);expect(String(h.output())).toContain("pdf_font_unavailable");expect(String(h.output())).not.toContain("PRIVATE");
  });
  it("sin confirmar no invoca el renderer",async()=>{
    const h=setup();h.change();await h.run();expect(h.res.statusCode).toBe(409);expect(h.render).not.toHaveBeenCalled();
  });
  it("rechaza backend remoto sin emitir solicitudes",()=>{
    const render=vi.fn();expect(()=>createPdfProxy({backend:"https://dtdcargo.com",markbox:"DTD-DEMO",render})).toThrow("loopback");expect(render).not.toHaveBeenCalled();
  });
  it("no intercepta ni reinicia operaciones ajenas a PDF",async()=>{
    const h=setup();h.req.url="/qa/reset";expect(await h.run()).toBe(false);expect(h.request).not.toHaveBeenCalled();expect(h.render).not.toHaveBeenCalled();
  });
});
