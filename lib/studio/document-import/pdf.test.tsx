// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { emptyDocumentDraft } from "@/lib/shared/document-import";
import { parseScannedLabel } from "@/lib/studio/etiquetas-qr";
import { buildConfirmedPdfModel, parsePdfSurface, renderConfirmedDocumentPdf, type ConfirmedPdfInput } from "./pdf";

function sample(): ConfirmedPdfInput {
  const draft=emptyDocumentDraft();draft.currency="USD";draft.supplier.company="Proveedor sintético";draft.supplier.wechat="demo";
  draft.products=[
    {id:"cups",name:"Vasos",nameZh:"杯子",code:"VAS-01",brand:"",material:"Vidrio",quantity:80,unitPrice:2,currency:"USD",unit:"pcs"},
    {id:"lids",name:"Tapas",nameZh:"盖子",code:"TAP-01",brand:"",material:"",quantity:80,unitPrice:0.75,currency:"USD",unit:"pcs"},
    {id:"bottles",name:"Botellas",nameZh:"瓶子",code:"BOT-01",brand:"",material:"",quantity:60,unitPrice:2,currency:"USD",unit:"pcs"},
  ];
  draft.groups=[{id:"A",label:"A",cartons:4,grossWeightKg:52,cbm:0.28,items:[{productId:"cups",quantity:80},{productId:"lids",quantity:80}]},{id:"B",label:"B",cartons:6,grossWeightKg:78,cbm:0.42,items:[{productId:"bottles",quantity:60}]}];
  draft.declaredTotals={cartons:10,grossWeightKg:130,cbm:0.7,amount:340};
  draft.sources=[{id:"private",fileName:"PRIVATE-CLIENT-ORIGINAL.pdf",kind:"combined",locations:[]}];
  return {draft,markbox:"DTD-DEMO",code:"DTD-DEMO-1-1",revision:4,folio:"DTD-PL-2026-0001",versionNo:2,labels:Array.from({length:10},(_,index)=>({code:"DTD-DEMO-1-1",boxN:index+1,totalBoxes:10,boxCode:`DTD-B-${String(index+1).padStart(6,"0")}`}))};
}
afterEach(()=>vi.unstubAllEnvs());

describe("PDF confirmado SDD-0473 B",()=>{
  it("proyecta cajas mixtas una vez y sólo campos permitidos, sin originales privados",()=>{
    const model=buildConfirmedPdfModel(sample());
    expect(model.totals).toEqual({cartons:10,grossWeightKg:130,cbm:0.7,quantities:{pcs:220},amounts:{USD:340}});
    expect(model.groups[0]).toMatchObject({cartons:4,grossWeightKg:52,cbm:0.28,rows:[{name:"Vasos",code:"VAS-01",quantity:80,amount:160},{name:"Tapas",code:"TAP-01",quantity:80,amount:60}]});
    expect(JSON.stringify(model)).not.toContain("PRIVATE-CLIENT");expect(model).not.toHaveProperty("sources");expect(model).not.toHaveProperty("client");
  });
  it("usa cantidades asignadas cuando un producto ocupa dos grupos, sin repetir su total",()=>{
    const input=sample();input.draft.products=input.draft.products.slice(0,1);input.draft.groups[0].items=[{productId:"cups",quantity:32}];input.draft.groups[1].items=[{productId:"cups",quantity:48}];input.draft.declaredTotals.amount=160;
    const model=buildConfirmedPdfModel(input);expect(model.groups.map(g=>g.rows[0].quantity)).toEqual([32,48]);expect(model.groups.map(g=>g.rows[0].amount)).toEqual([64,96]);expect(model.totals.amounts).toEqual({USD:160});expect(model.totals.quantities).toEqual({pcs:80});
  });
  it("no produce un modelo final con declarado .66 distinto del CBM confirmado .70",()=>{
    const input=sample();input.draft.declaredTotals.cbm=0.66;expect(()=>buildConfirmedPdfModel(input)).toThrow();
  });
  it("conserva exactamente los diez códigos físicos y el payload c/n/b del helper",()=>{
    const input=sample(),model=buildConfirmedPdfModel(input);expect(new Set(model.labels.map(label=>label.boxCode)).size).toBe(10);
    for(const [index,label]of model.labels.entries()){const url=new URL(label.qr);expect(url.pathname).toBe("/verificar");expect(url.searchParams.get("c")).toBe(input.markbox);expect(url.searchParams.get("n")).toBe(`${index+1}/10`);expect(url.searchParams.get("b")).toBe(input.labels[index].boxCode);expect(parseScannedLabel(label.qr)).toEqual({kind:"box_code",code:input.labels[index].boxCode});}
  });
  it("rechaza códigos ausentes, duplicados o de otra compra, sin inventar secuencias",()=>{
    for(const mode of ["missing","duplicate","purchase"]){const input=sample();if(mode==="missing")input.labels[0].boxCode=null;else if(mode==="duplicate")input.labels[0].boxCode=input.labels[1].boxCode;else input.labels[0].code="OTRA-COMPRA";expect(()=>buildConfirmedPdfModel(input)).toThrow();}
  });
  it("rechaza superficies no permitidas",()=>{expect(parsePdfSurface("labels")).toBe("labels");expect(parsePdfSurface("packing-list")).toBe("packing-list");expect(()=>parsePdfSurface("../../secreto")).toThrow();});
  it("sin fuente configurada falla con503 recuperable y nunca una ruta interna",async()=>{
    vi.stubEnv("DOCUMENT_IMPORT_PDF_CJK_FONT_PATH","");await expect(renderConfirmedDocumentPdf(sample(),"packing-list")).rejects.toMatchObject({status:503,code:"pdf_font_unavailable"});
  });
  it("fuente inválida no filtra su ruta ni omite silenciosamente el chino",async()=>{
    vi.stubEnv("DOCUMENT_IMPORT_PDF_CJK_FONT_PATH",path.join(process.cwd(),"NO-EXISTE-FUENTE-PRIVADA.ttf"));
    try{await renderConfirmedDocumentPdf(sample(),"labels");expect.fail("Debe rechazar la fuente");}catch(error){expect(error).toMatchObject({status:503,code:"pdf_font_unavailable"});expect(String(error)).not.toContain("NO-EXISTE");}
  });
  it("una fuente latina configurada como CJK no puede reemplazar caracteres por cuadros",async()=>{
    vi.stubEnv("DOCUMENT_IMPORT_PDF_CJK_FONT_PATH",path.join(process.cwd(),"lib/font-files/nunito-sans-latin-wght.woff2"));await expect(renderConfirmedDocumentPdf(sample(),"packing-list")).rejects.toMatchObject({status:503,code:"pdf_font_unavailable"});
  });
  // Requires an explicitly provisioned local font. No download, Windows default or licence claim.
  it.skipIf(!process.env.DOCUMENT_IMPORT_PDF_CJK_FONT_PATH).each(["packing-list","labels"] as const)("genera PDF real %s con fuente local explícita y registra flags de embedding",async(surface)=>{
    const result=await renderConfirmedDocumentPdf(sample(),surface);
    expect(Buffer.from(result.bytes.subarray(0,5)).toString()).toBe("%PDF-");expect(result.bytes.length).toBeGreaterThan(1000);expect(result.fontAudit.licenceAndServerPortabilityCertified).toBe(false);expect(result.fontAudit.cjk.postscriptName).toBeTruthy();
    const output=process.env.DOCUMENT_IMPORT_PDF_TEST_OUTPUT_DIR;if(output){await mkdir(output,{recursive:true});await writeFile(path.join(output,`${surface}-confirmado.pdf`),result.bytes);await writeFile(path.join(output,`${surface}-font-audit.json`),JSON.stringify(result.fontAudit,null,2));}
  });
  it.skipIf(!process.env.DOCUMENT_IMPORT_PDF_CJK_FONT_PATH)("genera 60 productos únicos en PDF real y manifiesto para verificar paginación completa",async()=>{
    const input=sample();
    input.draft.products=Array.from({length:60},(_,index)=>({id:`long-${index+1}`,name:`Producto de muestra ${index+1}`,nameZh:"样品",code:`LONG-${String(index+1).padStart(3,"0")}`,brand:"",material:"",quantity:10,unitPrice:1,currency:"USD",unit:"pcs"}));
    input.draft.groups=[{id:"long",label:"Largo",cartons:10,grossWeightKg:130,cbm:0.7,items:input.draft.products.map(product=>({productId:product.id,quantity:10}))}];
    input.draft.declaredTotals.amount=600;
    const model=buildConfirmedPdfModel(input);expect(model.groups[0].rows).toHaveLength(60);expect(model.totals).toMatchObject({cartons:10,quantities:{pcs:600},amounts:{USD:600}});
    const result=await renderConfirmedDocumentPdf(input,"packing-list");expect(Buffer.from(result.bytes.subarray(0,5)).toString()).toBe("%PDF-");expect(result.bytes.length).toBeGreaterThan(1000);
    const output=process.env.DOCUMENT_IMPORT_PDF_TEST_OUTPUT_DIR;if(output){
      await mkdir(output,{recursive:true});await writeFile(path.join(output,"packing-list-largo-60.pdf"),result.bytes);
      await writeFile(path.join(output,"packing-list-largo-60-manifest.json"),JSON.stringify({provenance:"synthetic-renderer-test-not-portal-acceptance",revision:input.revision,expectedCodes:model.groups.flatMap(group=>group.rows.map(row=>row.code)),checkpoints:["LONG-001","LONG-030","LONG-060"],totals:model.totals,fontAudit:result.fontAudit},null,2));
    }
  });
});
