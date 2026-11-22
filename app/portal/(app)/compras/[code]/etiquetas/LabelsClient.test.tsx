import { afterEach,beforeEach,describe,expect,it,vi } from "vitest";
import { cleanup,fireEvent,render,screen,waitFor } from "@testing-library/react";
import { resolveBrand } from "@/lib/shared/brand-context";
import { DocumentRequestError,type DocumentClient } from "@/components/document-import/document-client";
import { LabelsClient } from "./LabelsClient";
vi.mock("next/link",()=>({default:({children,...props}:React.AnchorHTMLAttributes<HTMLAnchorElement>)=><a {...props}>{children}</a>}));
const labels=[{code:"DTD-DEMO-1",boxN:1,totalBoxes:1,boxCode:"DTD-B-000001"}];
const props={code:"DTD-DEMO-1",markbox:"DTD-DEMO",clientName:"Demo",supplierName:"Proveedor",description:"Mercancía sintética",brand:resolveBrand(null),labels};
beforeEach(()=>{vi.spyOn(window,"print").mockImplementation(()=>{});vi.stubGlobal("requestAnimationFrame",(callback:FrameRequestCallback)=>{callback(0);return 1;});});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
describe("etiquetas compartidas del portal",()=>{
  describe("descarga PDF SDD-0473 B portal",()=>{
    beforeEach(()=>{const BaseURL=URL;vi.stubGlobal("URL",class extends BaseURL{static createObjectURL=vi.fn(()=>"blob:synthetic-pdf");static revokeObjectURL=vi.fn();});vi.spyOn(HTMLAnchorElement.prototype,"click").mockImplementation(()=>{});});
    it.each(["packing-list","labels"] as const)("descarga %s con revisión explícita y conserva impresión",async(surface)=>{
      const download=vi.fn().mockResolvedValue(new Blob(["%PDF-test"]));render(<LabelsClient {...props} documentWorkspace={{id:"workspace",revision:3}} documentClient={{download} as unknown as DocumentClient}/>);
      fireEvent.click(screen.getByRole("button",{name:surface==="labels"?"Descargar etiquetas PDF":"Descargar documento PDF"}));await waitFor(()=>expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce());expect(download).toHaveBeenCalledWith("workspace",{format:"pdf",surface,expectedRevision:3});expect(window.print).not.toHaveBeenCalled();
    });
    it("fuente503 mantiene códigos y acción de impresión disponible",async()=>{
      const download=vi.fn().mockRejectedValue(new DocumentRequestError(503,"pdf_font_unavailable",""));render(<LabelsClient {...props} documentWorkspace={{id:"workspace",revision:3}} documentClient={{download} as unknown as DocumentClient}/>);fireEvent.click(screen.getByRole("button",{name:"Descargar etiquetas PDF"}));await screen.findByText(/El PDF no está disponible en este momento/);expect(screen.getByText("DTD-B-000001")).toBeVisible();expect(screen.getByRole("button",{name:"Descargar / imprimir"})).toBeEnabled();expect(URL.createObjectURL).not.toHaveBeenCalled();
    });
    it("409 retira códigos y bloquea PDF sin entregar un blob viejo",async()=>{
      const download=vi.fn().mockRejectedValue(new DocumentRequestError(409,"revision_conflict",""));render(<LabelsClient {...props} documentWorkspace={{id:"workspace",revision:3}} documentClient={{download} as unknown as DocumentClient}/>);fireEvent.click(screen.getByRole("button",{name:"Descargar documento PDF"}));await screen.findByRole("alert");expect(screen.queryByText("DTD-B-000001")).not.toBeInTheDocument();expect(screen.getByRole("button",{name:"Descargar etiquetas PDF"})).toBeDisabled();expect(URL.createObjectURL).not.toHaveBeenCalled();
    });
    it("no agrega descargas PDF al flujo legacy",()=>{render(<LabelsClient {...props}/>);expect(screen.queryByRole("button",{name:"Descargar documento PDF"})).not.toBeInTheDocument();expect(screen.queryByRole("button",{name:"Descargar etiquetas PDF"})).not.toBeInTheDocument();});
  });
  it("una revisión nueva reemplaza la grilla anterior al refrescar",()=>{
    const view=render(<LabelsClient {...props} documentWorkspace={{id:"workspace",revision:3}}/>);
    view.rerender(<LabelsClient {...props} labels={[{...labels[0],boxCode:"DTD-B-000002"}]} documentWorkspace={{id:"workspace",revision:4}}/>);
    expect(screen.queryByText("DTD-B-000001")).not.toBeInTheDocument();expect(screen.getByText("DTD-B-000002")).toBeVisible();
  });
  it("conserva impresión legacy sin acceder al nuevo servicio",()=>{render(<LabelsClient {...props}/>);fireEvent.click(screen.getByRole("button",{name:"Descargar / imprimir"}));expect(window.print).toHaveBeenCalledOnce();});
  it("consulta la revisión vigente antes de imprimir códigos físicos",async()=>{
    const get=vi.fn().mockResolvedValue({revision:3,labels});const client={get} as unknown as DocumentClient;
    render(<LabelsClient {...props} documentWorkspace={{id:"workspace",revision:3}} documentClient={client}/>);
    fireEvent.click(screen.getByRole("button",{name:"Descargar / imprimir"}));
    await waitFor(()=>expect(window.print).toHaveBeenCalledOnce());expect(get).toHaveBeenCalledWith("labels",{workspaceId:"workspace",expectedRevision:"3"});
  });
  it("retira etiquetas obsoletas sin imprimir cuando otro actor guardó",async()=>{
    const get=vi.fn().mockRejectedValue(new Error("revision_conflict"));const client={get} as unknown as DocumentClient;
    render(<LabelsClient {...props} documentWorkspace={{id:"workspace",revision:3}} documentClient={client}/>);
    expect(screen.getByText("DTD-B-000001")).toBeVisible();fireEvent.click(screen.getByRole("button",{name:"Descargar / imprimir"}));
    await screen.findByRole("alert");expect(window.print).not.toHaveBeenCalled();expect(screen.queryByText("DTD-B-000001")).not.toBeInTheDocument();expect(screen.getByRole("button",{name:"Descargar / imprimir"})).toBeDisabled();
  });
});
