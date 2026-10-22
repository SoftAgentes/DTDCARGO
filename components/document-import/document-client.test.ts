// @vitest-environment node
import { describe,expect,it,vi } from "vitest";
import { emptyDocumentDraft } from "@/lib/shared/document-import";
import { createDocumentClient, documentEdit, receiptWorkspace } from "./document-client";

describe("transporte PDF SDD-0473 B",()=>{
  it("descarga XLSX con revisión explícita y niega el caller sin revisión antes de la red",async()=>{
    const request=vi.fn().mockResolvedValue(new Response("xlsx"));const client=createDocumentClient({request});
    await expect(client.download("workspace")).rejects.toMatchObject({code:"invalid_revision"});expect(request).not.toHaveBeenCalled();
    await client.download("workspace",{format:"xlsx",expectedRevision:4});
    expect(request.mock.calls[0][0]).toBe("/api/document-import?action=export&workspaceId=workspace&expectedRevision=4");
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

it("adopta sólo un recibo del workspace y revisión esperados; no usa el clon del navegador",()=>{
  const draft=emptyDocumentDraft();draft.supplier.company="Guardado por servidor";
  const workspace={id:"w1",revision:4,confirmedRevision:null,expiresAt:null,draft};
  expect(receiptWorkspace({revision:4,confirmed:false,workspace},"w1").draft.supplier.company).toBe("Guardado por servidor");
  expect(()=>receiptWorkspace({revision:4,confirmed:false},"w1")).toThrow();
  expect(()=>receiptWorkspace({revision:3,confirmed:false,workspace},"w1")).toThrow();
  expect(()=>receiptWorkspace({revision:4,confirmed:false,workspace},"w2")).toThrow();
});

it("el navegador manda sólo cambios de negocio sin duplicar la evidencia autoritativa",()=>{
  const d=emptyDocumentDraft();d.supplier.company="Proveedor";
  d.sources=[{id:"s1",kind:"invoice",fileName:"PRIVATE-FILE",locations:[]}];d.fieldDecisions=[{path:"supplier.company",origin:"manual",references:[]}];
  const submitted=documentEdit(d);expect(submitted.sources).toEqual([]);expect(submitted).not.toHaveProperty("fieldDecisions");
  expect(submitted.supplier.company).toBe("Proveedor");expect(d.sources[0].fileName).toBe("PRIVATE-FILE");
});
