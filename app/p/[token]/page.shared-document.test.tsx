// @vitest-environment node
import { afterEach,beforeEach,describe,expect,it,vi } from "vitest";
import { emptyDocumentDraft } from "@/lib/shared/document-import";
const h=vi.hoisted(()=>({workspace:null as unknown,authorize:vi.fn(),data:{tenantId:"tenant",code:"DTD-DEMO-1",markbox:"DTD-DEMO",boxes:1,supplierName:null,supplierWechat:null,predeclaredBoxes:[]}}));
vi.mock("@/lib/fonts",()=>({jetbrainsMonoUi:{variable:"mono"},sora:{variable:"sora"},nunitoSans:{variable:"nunito"}}));
vi.mock("@/lib/db/admin",()=>({createAdminClient:()=>{const chain={select:()=>chain,eq:()=>chain,maybeSingle:async()=>({data:h.workspace,error:null})};return {from:()=>chain};}}));
vi.mock("@/lib/studio/prealertas/queries",()=>({getProviderShareByToken:async()=>h.data,getPrealertaIdsByToken:async()=>({prealertaId:"purchase",tenantId:"tenant",markbox:"DTD-DEMO"})}));
vi.mock("@/lib/studio/aliados/brand-resolve",()=>({resolveBrandForClient:async()=>({name:"DTD Cargo"})}));
vi.mock("@/lib/studio/label-presentation-queries",()=>({getLabelPresentation:async()=>({settings:{}})}));
vi.mock("@/lib/studio/document-import/access",async(original)=>({...await original<typeof import("@/lib/studio/document-import/access")>(),authorizeWorkspace:h.authorize}));
vi.mock("./ProviderShareClient",()=>({ProviderShareClient:()=>null}));
import ProviderSharePage from "./page";
const token="11111111-1111-4111-8111-111111111111";
beforeEach(()=>{vi.stubEnv("DOCUMENT_IMPORT_ENABLED","true");vi.stubEnv("DOCUMENT_IMPORT_PORTAL_ENABLED","true");h.authorize.mockReset();h.authorize.mockResolvedValue({kind:"supplier",id:"supplier:demo"});const draft=emptyDocumentDraft();draft.supplier.company="Proveedor de prueba";draft.sources=[{id:"private",fileName:"original-privado.csv",kind:"combined",locations:[]}];h.workspace={id:"workspace",revision:2,confirmed_revision:null,expires_at:null,draft};});
afterEach(()=>vi.unstubAllEnvs());
describe("frontera SSR del proveedor con documento compartido",()=>{
  it("autoriza la compra viva antes de proyectar; no expone archivos privados",async()=>{
    const view=await ProviderSharePage({params:Promise.resolve({token})});
    expect(h.authorize).toHaveBeenCalledOnce();expect(h.authorize.mock.calls[0][3].get("x-supplier-token")).toBe(token);
    const props=view.props.children.props;expect(props.sharedWorkspace.draft.supplier.company).toBe("Proveedor de prueba");expect(props.sharedWorkspace.draft.sources).toEqual([]);expect(JSON.stringify(props.sharedWorkspace)).not.toContain("original-privado.csv");
  });
  it("un dueño de compra incompatible deja la vista cerrada sin draft ni formulario alterno",async()=>{
    h.authorize.mockRejectedValueOnce(new Error("owner_changed"));const view=await ProviderSharePage({params:Promise.resolve({token})});const props=view.props.children.props;
    expect(props.sharedWorkspace).toBeNull();expect(props.sharedUnavailable).toBe(true);
  });
  it("sin documento compartido conserva el formulario legacy",async()=>{
    h.workspace=null;const view=await ProviderSharePage({params:Promise.resolve({token})});const props=view.props.children.props;
    expect(props.sharedWorkspace).toBeNull();expect(props.sharedUnavailable).toBe(false);expect(h.authorize).not.toHaveBeenCalled();
  });
});
