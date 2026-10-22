// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { emptyDocumentDraft } from "@/lib/shared/document-import";
import { parseScannedLabel } from "@/lib/studio/etiquetas-qr";
import { buildConfirmedPdfModel, parsePdfSurface, renderConfirmedDocumentPdf, requireStaticPdfFont, type ConfirmedPdfInput } from "./pdf";

const measuredRender = vi.hoisted(() => ({ layout: null as unknown }));
vi.mock("@react-pdf/renderer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@react-pdf/renderer")>();
  const { cloneElement } = await import("react");
  return {
    ...actual,
    // Keep the real renderer and inspect its computed, paginated layout, not JSX props.
    renderToBuffer: (element: Parameters<typeof actual.renderToBuffer>[0]) => actual.renderToBuffer(cloneElement(element, {
      onRender: (event) => {
        measuredRender.layout = (event as unknown as { _INTERNAL__LAYOUT__DATA_: unknown })._INTERNAL__LAYOUT__DATA_;
        element.props.onRender?.(event);
      },
    })),
  };
});
type MeasuredNode = { type?: string; value?: string; children?: MeasuredNode[]; style?: { fontSize?: number } };
function measuredPages() {
  const layout = measuredRender.layout as MeasuredNode | null;
  expect(layout).toBeTruthy();
  const pages = layout?.children?.filter(node => node.type === "PAGE") ?? [];
  expect(pages.length).toBeGreaterThan(0);
  return pages;
}
function measuredText(node: MeasuredNode): string {
  return (node.value ?? "") + (node.children ?? []).map(measuredText).join("");
}

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
afterEach(()=>{vi.unstubAllEnvs();measuredRender.layout=null;});

function expectStaticFontAudit(audit: Awaited<ReturnType<typeof renderConfirmedDocumentPdf>>["fontAudit"]) {
  for(const face of [audit.cjk,...Object.values(audit.latin)]){expect(face.format).toBe("TTF");expect(face.variationAxes).toEqual([]);expect(face.postscriptName).toBeTruthy();}
  expect([audit.latin.body.weightClass,audit.latin.heading.weightClass,audit.latin.mono.weightClass,audit.latin.brand.weightClass]).toEqual([400,600,400,400]);
  expect(JSON.stringify(audit)).not.toMatch(/[A-Z]:[\\/]|font-files|\.ttf|\.woff/i);
}

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
    vi.stubEnv("DOCUMENT_IMPORT_PDF_CJK_FONT_PATH",path.join(process.cwd(),"lib/font-files/pdf/nunito-sans-400.ttf"));await expect(renderConfirmedDocumentPdf(sample(),"packing-list")).rejects.toMatchObject({status:503,code:"pdf_font_unavailable"});
  });
  it("rechaza WOFF2 y contenedores OpenType incompatibles con503 seguro",()=>{
    for(const metadata of [{type:"WOFF2"},{type:"OTF"},{type:"DFONT"},{type:"TTF",directory:{tables:{"CFF ":{}}}},{type:"TTF",directory:{tables:{CFF2:{}}}}]){
      try{requireStaticPdfFont(metadata);expect.fail("Debe rechazar el contenedor incompatible");}catch(error){expect(error).toMatchObject({status:503,code:"pdf_font_unavailable"});expect(String(error)).not.toMatch(/font-files|[A-Z]:[\\/]/i);}
    }
    expect(requireStaticPdfFont({type:"TTF",variationAxes:{}})).toEqual({format:"TTF",variationAxes:[]});expect(requireStaticPdfFont({type:"WOFF",variationAxes:{}})).toEqual({format:"WOFF",variationAxes:[]});
  });
  it("rechaza ejes variables incluso dentro de TTF o WOFF",()=>{
    for(const type of ["TTF","WOFF"]){try{requireStaticPdfFont({type,variationAxes:{wght:{min:100,default:400,max:800}}});expect.fail("Debe rechazar la cara variable");}catch(error){expect(error).toMatchObject({status:503,code:"pdf_font_unavailable"});}}
  });
  // Requires an explicitly provisioned local font. No download, Windows default or licence claim.
  it.skipIf(!process.env.DOCUMENT_IMPORT_PDF_CJK_FONT_PATH).each(["packing-list","labels"] as const)("genera PDF real %s con fuente local explícita y registra flags de embedding",async(surface)=>{
    const result=await renderConfirmedDocumentPdf(sample(),surface);
    expect(Buffer.from(result.bytes.subarray(0,5)).toString()).toBe("%PDF-");expect(result.bytes.length).toBeGreaterThan(1000);expect(result.fontAudit.licenceAndServerPortabilityCertified).toBe(false);expect(result.fontAudit.cjk.postscriptName).toBeTruthy();expectStaticFontAudit(result.fontAudit);
    const output=process.env.DOCUMENT_IMPORT_PDF_TEST_OUTPUT_DIR;if(output){await mkdir(output,{recursive:true});await writeFile(path.join(output,`${surface}-confirmado.pdf`),result.bytes);await writeFile(path.join(output,`${surface}-font-audit.json`),JSON.stringify(result.fontAudit,null,2));}
  });
  it.skipIf(!process.env.DOCUMENT_IMPORT_PDF_CJK_FONT_PATH)("genera 60 productos únicos en PDF real y manifiesto para verificar paginación completa",async()=>{
    const input=sample();
    input.draft.products=Array.from({length:60},(_,index)=>({id:`long-${index+1}`,name:`Producto de muestra ${index+1}`,nameZh:"样品",code:`LONG-${String(index+1).padStart(3,"0")}`,brand:"",material:"",quantity:10,unitPrice:1,currency:"USD",unit:"pcs"}));
    input.draft.groups=[{id:"long",label:"Largo",cartons:10,grossWeightKg:130,cbm:0.7,items:input.draft.products.map(product=>({productId:product.id,quantity:10}))}];
    input.draft.declaredTotals.amount=600;
    const model=buildConfirmedPdfModel(input);expect(model.groups[0].rows).toHaveLength(60);expect(model.totals).toMatchObject({cartons:10,quantities:{pcs:600},amounts:{USD:600}});
    const result=await renderConfirmedDocumentPdf(input,"packing-list");expect(Buffer.from(result.bytes.subarray(0,5)).toString()).toBe("%PDF-");expect(result.bytes.length).toBeGreaterThan(1000);expectStaticFontAudit(result.fontAudit);
    const output=process.env.DOCUMENT_IMPORT_PDF_TEST_OUTPUT_DIR;if(output){
      await mkdir(output,{recursive:true});await writeFile(path.join(output,"packing-list-largo-60.pdf"),result.bytes);
      await writeFile(path.join(output,"packing-list-largo-60-manifest.json"),JSON.stringify({provenance:"synthetic-renderer-test-not-portal-acceptance",revision:input.revision,expectedCodes:model.groups.flatMap(group=>group.rows.map(row=>row.code)),checkpoints:["LONG-001","LONG-030","LONG-060"],totals:model.totals,fontAudit:result.fontAudit},null,2));
    }
  });
  it.skipIf(!process.env.DOCUMENT_IMPORT_PDF_CJK_FONT_PATH)("mantiene compacta la muestra de tres productos y dos grupos con datos completos del proveedor en una página real",async()=>{
    const input=sample();
    input.draft.supplier={company:"Proveedor de muestra Yiwu",contact:"Contacto de muestra",email:"demo@example.invalid",wechat:"dtd-demo",phone:"+86 000 0000 0000",address:"Dirección de muestra 123",city:"Yiwu"};
    input.draft.docDate="2026-10-21";
    const result=await renderConfirmedDocumentPdf(input,"packing-list");
    expect(Buffer.from(result.bytes.subarray(0,5)).toString()).toBe("%PDF-");expectStaticFontAudit(result.fontAudit);
    const pages=measuredPages(),pageTexts=pages.map(measuredText);
    expect(pages).toHaveLength(1);
    for(const [label,firstCode] of [["A","VAS-01"],["B","BOT-01"]]){
      const page=pageTexts.find(text=>text.includes(`箱组 / Grupo ${label}`));
      expect(page).toContain(firstCode);
      expect(page).toContain(label==="A"?"52 kg bruto":"78 kg bruto");
    }
    for(const code of ["VAS-01","TAP-01","BOT-01"])expect(pageTexts.join("").split(code)).toHaveLength(2);
    expect(pageTexts[0]).toContain("Proveedor de muestra Yiwu");expect(pageTexts[0]).toContain("2026-10-21");
    const output=process.env.DOCUMENT_IMPORT_PDF_TEST_OUTPUT_DIR;if(output){
      await mkdir(output,{recursive:true});await writeFile(path.join(output,"packing-list-compact-layout.pdf"),result.bytes);
      await writeFile(path.join(output,"packing-list-compact-layout-manifest.json"),JSON.stringify({provenance:"synthetic-layout-test-not-portal-acceptance",pageCount:pages.length,pageTexts,expectedCodes:["VAS-01","TAP-01","BOT-01"]},null,2));
    }
  });
  it.skipIf(!process.env.DOCUMENT_IMPORT_PDF_CJK_FONT_PATH)("pagina sesenta productos sin truncarlos y repite documento, columnas y contexto de grupo en las páginas reales",async()=>{
    const input=sample();
    input.draft.products=Array.from({length:60},(_,index)=>({id:`layout-${index+1}`,name:`Producto de muestra ${index+1}`,nameZh:"样品",code:`PAGE-${String(index+1).padStart(3,"0")}`,brand:"",material:"",quantity:10,unitPrice:1,currency:"USD",unit:"pcs"}));
    input.draft.groups=[
      {id:"layout-A",label:"Largo A",cartons:5,grossWeightKg:52,cbm:0.28,items:input.draft.products.slice(0,13).map(product=>({productId:product.id,quantity:10}))},
      {id:"layout-B",label:"Largo B",cartons:5,grossWeightKg:78,cbm:0.42,items:input.draft.products.slice(13).map(product=>({productId:product.id,quantity:10}))},
    ];
    input.draft.declaredTotals.amount=600;
    const result=await renderConfirmedDocumentPdf(input,"packing-list");expectStaticFontAudit(result.fontAudit);
    const pages=measuredPages(),pageTexts=pages.map(measuredText),expectedCodes=input.draft.products.map(product=>product.code);
    expect(pages.length).toBeGreaterThan(1);
    expect(pageTexts.join("").match(/PAGE-\d{3}/g)).toEqual(expectedCodes);
    for(const text of pageTexts){
      for(const context of ["Packing List + Factura",input.code,input.markbox,input.folio,`Rev. ${input.revision}`,"Producto · Código","Cantidad","Precio","Importe"])expect(text).toContain(context);
      if(/PAGE-\d{3}/.test(text))expect(text).toContain("Grupo Largo");
    }
    for(const [label,firstCode,logistics] of [["Largo A","PAGE-001","52 kg bruto"],["Largo B","PAGE-014","78 kg bruto"]]){
      const page=pageTexts.find(text=>text.includes(`箱组 / Grupo ${label}`));expect(page).toContain(firstCode);expect(page).toContain(logistics);
    }
    const output=process.env.DOCUMENT_IMPORT_PDF_TEST_OUTPUT_DIR;if(output){
      await mkdir(output,{recursive:true});await writeFile(path.join(output,"packing-list-pagination-layout.pdf"),result.bytes);
      await writeFile(path.join(output,"packing-list-pagination-layout-manifest.json"),JSON.stringify({provenance:"synthetic-layout-test-not-portal-acceptance",pageCount:pages.length,pageTexts,expectedCodes,checkpoints:["PAGE-001","PAGE-030","PAGE-060"]},null,2));
    }
  });
});
