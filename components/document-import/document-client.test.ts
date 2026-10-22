// @vitest-environment node
import { describe,expect,it,vi } from "vitest";
import { createDocumentClient } from "./document-client";

describe("transporte PDF SDD-0473 B",()=>{
  it("download sin opciones conserva exactamente el export XLSX",async()=>{
    const request=vi.fn().mockResolvedValue(new Response("xlsx"));const client=createDocumentClient({request});await client.download("workspace");
    expect(request.mock.calls[0][0]).toBe("/api/document-import?action=export&workspaceId=workspace");
  });
  it("envía superficie/revisión y autorización del proveedor sin usar originales",async()=>{
    const request=vi.fn().mockResolvedValue(new Response("%PDF-test",{headers:{"Content-Type":"application/pdf"}}));const client=createDocumentClient({supplierToken:"synthetic-token",request});
    const blob=await client.download("workspace",{format:"pdf",surface:"labels",expectedRevision:4});expect(await blob.text()).toBe("%PDF-test");
    expect(request).toHaveBeenCalledWith("/api/document-import?action=pdf&workspaceId=workspace&surface=labels&expectedRevision=4",expect.objectContaining({cache:"no-store",headers:{"x-supplier-token":"synthetic-token"}}));
  });
  it("409 rechaza antes de devolver un blob obsoleto",async()=>{
    const request=vi.fn().mockResolvedValue(new Response(JSON.stringify({code:"revision_conflict"}),{status:409}));await expect(createDocumentClient({request}).download("workspace",{format:"pdf",surface:"packing-list",expectedRevision:3})).rejects.toMatchObject({status:409,code:"revision_conflict"});
  });
  it("una respuesta HTML200 no se descarga como si fuera PDF",async()=>{
    const request=vi.fn().mockResolvedValue(new Response("<html>error</html>",{headers:{"Content-Type":"text/html"}}));await expect(createDocumentClient({request}).download("workspace",{format:"pdf",surface:"labels",expectedRevision:4})).rejects.toMatchObject({code:"invalid_pdf_response"});
  });
  it("también valida los bytes cuando una respuesta declara application/pdf incorrectamente",async()=>{
    const request=vi.fn().mockResolvedValue(new Response("<html>error</html>",{headers:{"Content-Type":"application/pdf"}}));await expect(createDocumentClient({request}).download("workspace",{format:"pdf",surface:"labels",expectedRevision:4})).rejects.toMatchObject({code:"invalid_pdf_response"});
  });
});
