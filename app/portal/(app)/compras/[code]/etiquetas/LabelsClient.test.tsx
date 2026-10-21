import { afterEach,beforeEach,describe,expect,it,vi } from "vitest";
import { cleanup,fireEvent,render,screen,waitFor } from "@testing-library/react";
import { resolveBrand } from "@/lib/shared/brand-context";
import type { DocumentClient } from "@/components/document-import/document-client";
import { LabelsClient } from "./LabelsClient";
vi.mock("next/link",()=>({default:({children,...props}:React.AnchorHTMLAttributes<HTMLAnchorElement>)=><a {...props}>{children}</a>}));
const labels=[{code:"DTD-DEMO-1",boxN:1,totalBoxes:1,boxCode:"DTD-B-000001"}];
const props={code:"DTD-DEMO-1",markbox:"DTD-DEMO",clientName:"Demo",supplierName:"Proveedor",description:"Mercancía sintética",brand:resolveBrand(null),labels};
beforeEach(()=>{vi.spyOn(window,"print").mockImplementation(()=>{});vi.stubGlobal("requestAnimationFrame",(callback:FrameRequestCallback)=>{callback(0);return 1;});});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
describe("etiquetas compartidas del portal",()=>{
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
