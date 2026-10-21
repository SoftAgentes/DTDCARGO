import { afterEach,beforeEach,describe,expect,it,vi } from "vitest";
import { cleanup,fireEvent,render,screen,waitFor,within } from "@testing-library/react";
import { emptyDocumentDraft } from "@/lib/shared/document-import";
import { resolveBrand } from "@/lib/shared/brand-context";
import { DocumentRequestError,type DocumentClient,type DocumentWorkspace } from "@/components/document-import/document-client";
import { SharedSupplierDocument } from "./SharedSupplierDocument";
import { ProviderShareClient } from "./ProviderShareClient";

const code="DTD-0000-1-1";
function fixture(weight:number|null=null):DocumentWorkspace {
  const draft=emptyDocumentDraft();draft.currency="USD";draft.supplier.company="Proveedor sintético";draft.supplier.wechat="demo-contact";
  draft.products=[{id:"original-product",name:"Vasos",nameZh:"杯子",code:"VAS-01",brand:"",material:"",quantity:100,unitPrice:3.5,currency:"USD",unit:"pcs"}];
  draft.groups=[{id:"original-group",label:"1-10",cartons:10,grossWeightKg:weight,cbm:0.6,items:[{productId:"original-product",quantity:100}]}];
  return {id:"11111111-1111-4111-8111-111111111111",revision:1,confirmedRevision:null,expiresAt:null,draft};
}
function setup(workspace=fixture()) {
  const get=vi.fn(async(action:string)=>action==="workspace"?{workspace}:action==="labels"?{revision:3,folio:"PL-TEST",versionNo:1,labels:Array.from({length:10},(_,index)=>({code,boxN:index+1,totalBoxes:10,boxCode:`DTD-B-${index+1}`}))}:{versions:[]});
  const post=vi.fn(async(action:string)=>({revision:action==="confirm"?3:2,confirmed:action==="confirm",folio:action==="confirm"?"PL-TEST":undefined,versionNo:action==="confirm"?1:undefined}));
  const client={get,post,id:vi.fn(()=>crypto.randomUUID()),upload:vi.fn(),download:vi.fn(),setAnonymousToken:vi.fn()} as unknown as DocumentClient;
  const view=render(<SharedSupplierDocument initialWorkspace={workspace} token="test-only" code={code} markbox="DTD-0000" locale="es" brand={resolveBrand(null)} client={client}/>);
  return {...view,get,post,client};
}
const step=(number:number)=>fireEvent.click(within(screen.getByRole("navigation")).getByRole("button",{name:new RegExp(`^${number} `)}));
const ready=()=>waitFor(()=>expect(within(screen.getByRole("navigation")).getAllByRole("button")[0]).toBeEnabled());
beforeEach(()=>{vi.spyOn(window,"print").mockImplementation(()=>{});vi.stubGlobal("requestAnimationFrame",(callback:FrameRequestCallback)=>{callback(0);return 1;});});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();delete document.documentElement.dataset.printSurface;});

describe("proveedor del documento compartido",()=>{
  it("reabre confirmados en el recibo y permite ver códigos sin imprimir",async()=>{
    const w=fixture(120);w.revision=3;w.confirmedRevision=3;setup(w);await ready();
    expect(screen.getByRole("heading",{name:"Despacho confirmado"})).toBeVisible();fireEvent.click(screen.getByRole("button",{name:"Ver etiquetas"}));
    await screen.findByText("DTD-B-10");expect(window.print).not.toHaveBeenCalled();expect(screen.getByText("PL-TEST · Revisión 3 · Versión 1")).toBeVisible();
  });
  it("cambiar de enlace desmonta edición y transporte de la compra anterior",async()=>{
    const a=fixture();const b=fixture();b.id="22222222-2222-4222-8222-222222222222";b.draft.supplier.company="Proveedor B";
    const clientA={get:vi.fn().mockResolvedValue({workspace:a}),id:vi.fn(),post:vi.fn()} as unknown as DocumentClient;
    const clientB={get:vi.fn().mockReturnValue(new Promise(()=>{})),id:vi.fn(),post:vi.fn()} as unknown as DocumentClient;
    const props={token:"token-A",code,markbox:"DTD-0000",supplierName:null,supplierWechat:null,labels:[],brand:resolveBrand(null)};
    const view=render(<ProviderShareClient {...props} sharedWorkspace={a} documentClient={clientA}/>);
    fireEvent.change(screen.getByRole("combobox",{name:"语言 / Idioma / Language"}),{target:{value:"es"}});await ready();
    fireEvent.change(screen.getByRole("textbox",{name:"Empresa"}),{target:{value:"Edición A"}});
    view.rerender(<ProviderShareClient {...props} token="token-B" code="DTD-B-1" sharedWorkspace={b} documentClient={clientB}/>);
    expect(screen.queryByDisplayValue("Edición A")).not.toBeInTheDocument();expect(screen.getByRole("textbox",{name:"Empresa"})).toHaveValue("Proveedor B");
    expect(clientB.get).toHaveBeenCalledWith("workspace",{workspaceId:b.id});expect(clientA.post).not.toHaveBeenCalled();
  });
  it("conserva el producto en edición y pide aceptarlo antes de cambiar de paso",async()=>{
    setup();await ready();step(2);fireEvent.click(screen.getByRole("button",{name:"Agregar producto"}));
    fireEvent.change(screen.getByRole("textbox",{name:"Producto"}),{target:{value:"Nuevo producto"}});
    expect(screen.getByRole("button",{name:"Formato estándar"})).toBeDisabled();
    step(3);expect(screen.getByRole("textbox",{name:"Producto"})).toHaveValue("Nuevo producto");
    expect(screen.getByText(/Guarda o quita el producto que estás editando/)).toBeVisible();
    fireEvent.click(screen.getByRole("button",{name:"Guardar producto"}));step(3);
    expect(screen.queryByText(/Guarda o quita el producto que estás editando/)).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox",{name:"Producto"})).not.toBeInTheDocument();
    step(2);expect(screen.getAllByText("Nuevo producto")[0]).toBeVisible();
  });
  it("abre la revisión compartida, conserva IDs y confirma tras corregir peso sin reingresar productos",async()=>{
    const {get,post}=setup();await ready();
    expect(screen.getByRole("textbox",{name:"Empresa"})).toHaveValue("Proveedor sintético");
    step(2);expect(within(screen.getByRole("main")).getAllByText("Vasos")[0]).toBeVisible();
    fireEvent.change(screen.getByRole("textbox",{name:"Peso bruto TOTAL (kg)"}),{target:{value:"120"}});
    step(4);fireEvent.click(screen.getByRole("checkbox"));fireEvent.click(screen.getByRole("button",{name:"Confirmar despacho y enviar a DTD"}));
    await waitFor(()=>expect(post).toHaveBeenCalledTimes(1));
    const [action,body]=post.mock.calls[0] as unknown as [string,{draft:ReturnType<typeof emptyDocumentDraft>;expectedRevision:number}];
    expect(action).toBe("confirm");expect(body.expectedRevision).toBe(1);expect(body.draft.groups[0]).toMatchObject({id:"original-group",grossWeightKg:120,cbm:0.6});expect(body.draft.products[0].id).toBe("original-product");
    await screen.findByText("Despacho confirmado",{selector:"h2"});
    fireEvent.click(screen.getByRole("button",{name:"Imprimir etiquetas"}));
    await waitFor(()=>expect(window.print).toHaveBeenCalledOnce());expect(get).toHaveBeenCalledWith("labels",{workspaceId:fixture().id,expectedRevision:"3"});
    expect(screen.getByText("10 etiquetas de cajas")).toBeVisible();expect(screen.getByText("DTD-B-10")).toBeVisible();
  });
  it("bloquea confirmación por peso o CBM faltante y nunca muestra etiquetas preexistentes",async()=>{
    setup();await ready();step(4);fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("button",{name:"Confirmar despacho y enviar a DTD"})).toBeDisabled();
    expect(screen.queryByRole("button",{name:"Imprimir etiquetas"})).not.toBeInTheDocument();
    expect(screen.getByText("Completa el peso bruto TOTAL del grupo (kg).")).toBeVisible();
  });
  it("conserva cambios ante409 y requiere reemplazo explícito tras comparar",async()=>{
    const {post,get}=setup();await ready();
    fireEvent.change(screen.getByRole("textbox",{name:"Empresa"}),{target:{value:"Mi edición"}});
    post.mockRejectedValueOnce(new DocumentRequestError(409,"revision_conflict",""));
    fireEvent.click(screen.getByRole("button",{name:"Guardar borrador compartido"}));
    await screen.findByText(/El documento compartido cambió/);
    const latest=fixture();latest.revision=2;latest.draft.supplier.company="Edición del cliente";get.mockResolvedValueOnce({workspace:latest});
    fireEvent.click(screen.getByRole("button",{name:"Comparar versión compartida"}));
    await screen.findByRole("heading",{name:"Revisión compartida 2"});
    expect(screen.getByRole("textbox",{name:"Empresa"})).toHaveValue("Mi edición");
    fireEvent.click(screen.getByRole("button",{name:"Descartar mis cambios y cargar esta versión"}));
    expect(screen.getByRole("textbox",{name:"Empresa"})).toHaveValue("Edición del cliente");
  });
  it("reintenta el mismo comando tras respuesta no confirmada",async()=>{
    const {post,client}=setup();await ready();fireEvent.change(screen.getByRole("textbox",{name:"Empresa"}),{target:{value:"Cambio"}});
    post.mockRejectedValueOnce(new DocumentRequestError(0,"network",""));
    fireEvent.click(screen.getByRole("button",{name:"Guardar borrador compartido"}));await screen.findByText(/No pudimos confirmar el resultado/);
    fireEvent.click(screen.getByRole("button",{name:"Guardar borrador compartido"}));await screen.findByText(/Borrador compartido guardado/);
    const calls=post.mock.calls as unknown as [string,{commandId:string}][];expect(calls[0][1].commandId).toBe(calls[1][1].commandId);expect(client.id).toHaveBeenCalledOnce();
  });
  it("consulta servidor antes de imprimir y retira etiquetas cuando otra sesión cambia la revisión",async()=>{
    const w=fixture(120);w.confirmedRevision=1;const {get}=setup(w);await ready();step(4);
    get.mockRejectedValueOnce(new DocumentRequestError(409,"revision_conflict",""));
    fireEvent.click(screen.getByRole("button",{name:"Imprimir etiquetas"}));
    await screen.findByText(/No pudimos validar esta revisión/);expect(window.print).not.toHaveBeenCalled();expect(screen.queryByText("DTD-B-1")).not.toBeInTheDocument();
    expect(screen.getByRole("button",{name:"Imprimir etiquetas"})).toBeDisabled();
  });
});
