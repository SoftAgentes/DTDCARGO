import { useEffect,useState } from "react";
import { createRoot } from "react-dom/client";
import { DocumentReviewClient } from "@/app/portal/(app)/compras/[code]/documento/DocumentReviewClient";
import { ProviderShareClient } from "@/app/p/[token]/ProviderShareClient";
import { createDocumentClient,type DocumentWorkspace } from "@/components/document-import/document-client";
import { resolveBrand } from "@/lib/shared/brand-context";
import { LabelsClient } from "@/app/portal/(app)/compras/[code]/etiquetas/LabelsClient";
import "@/app/globals.css";

const TOKEN="55555555-5555-4555-8555-555555555555";
const CODE="DTD-DEMO-1-1";
const base=window.location.pathname;
function ConfirmedLabels({workspace}:{workspace:DocumentWorkspace}){
  const [labels,setLabels]=useState<{code:string;boxN:number;totalBoxes:number;boxCode:string}[]|null>(null);
  const [error,setError]=useState(false);
  useEffect(()=>{let active=true;createDocumentClient().get<{labels:NonNullable<typeof labels>}>("labels",{workspaceId:workspace.id,expectedRevision:String(workspace.revision)}).then(result=>{if(active)setLabels(result.labels);}).catch(()=>{if(active)setError(true);});return()=>{active=false;};},[workspace.id,workspace.revision]);
  if(error)return <p role="alert">El proveedor debe confirmar la revisión vigente y sus cajas antes de mostrar las etiquetas.</p>;
  if(!labels)return <p role="status">Comprobando las etiquetas físicas…</p>;
  return <LabelsClient code={CODE} markbox="DTD-DEMO" clientName="Cliente ficticio" supplierName="Proveedor de ejemplo" description="Mercancía de demostración" labels={labels} brand={resolveBrand(null)} documentWorkspace={{id:workspace.id,revision:workspace.revision}}/>;
}
function Demo(){
  const [page,setPage]=useState(["supplier","labels"].includes(new URLSearchParams(location.search).get("page")??"")?new URLSearchParams(location.search).get("page")!:"client");
  const [theme,setTheme]=useState(new URLSearchParams(location.search).get("theme")==="dark"?"dark":"light");
  const [workspace,setWorkspace]=useState<DocumentWorkspace|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState(false);
  useEffect(()=>{document.documentElement.dataset.portalTheme=theme;},[theme]);
  useEffect(()=>{let active=true;if(page==="client")return;setLoading(true);setError(false);const client=createDocumentClient(page==="supplier"?{supplierToken:TOKEN}:{});client.post<{workspace:DocumentWorkspace}>("open").then(result=>{if(active)setWorkspace(result.workspace);}).catch(()=>{if(active)setError(true);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[page]);
  function navigate(next:string){setPage(next);history.replaceState(null,"",`${base}?page=${next}&theme=${theme}`);}
  async function reset(){await fetch("/qa/reset",{method:"POST"});location.href=base;}
  return <div className="portal-sys min-h-screen bg-paper text-ink"><div className="no-print border-b border-grey-200 bg-white p-4"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4"><div><strong>Demo local · datos ficticios</strong><p className="text-base text-grey-700">Extracción CSV/XLSX y SQL reales en esta máquina. Sesiones y almacenamiento locales de prueba.</p></div><div className="flex flex-wrap gap-2"><a className="btn btn-ghost" href="/qa/example.csv" download>Descargar ejemplo sin peso</a><button className="btn btn-ghost" onClick={()=>setTheme(theme==="light"?"dark":"light")}>Tema {theme==="light"?"oscuro":"claro"}</button><button className="btn btn-ghost" onClick={reset}>Reiniciar demo</button></div></div></div><div className="no-print mx-auto flex max-w-7xl flex-wrap gap-3 px-4 py-4 sm:px-8"><button className={page==="client"?"btn btn-primary":"btn btn-ghost"} onClick={()=>navigate("client")}>1 · Portal del cliente</button><button className={page==="supplier"?"btn btn-primary":"btn btn-ghost"} onClick={()=>navigate("supplier")}>2 · Abrir enlace del proveedor</button></div>{page==="client"?<div className="mx-auto w-full max-w-7xl px-4 pb-8 sm:px-8"><DocumentReviewClient key={CODE} code={CODE} shareToken={TOKEN}/></div>:loading?<p className="p-8" role="status">Abriendo la revisión compartida…</p>:error?<p className="p-8" role="alert">No pudimos abrir el documento local. Reinicia la demo.</p>:workspace?page==="labels"?<div className="mx-auto max-w-7xl px-4 pb-8 sm:px-8"><ConfirmedLabels workspace={workspace}/></div>:<ProviderShareClient token={TOKEN} code={CODE} markbox="DTD-DEMO" supplierName="Proveedor de ejemplo" supplierWechat="demo-wechat" labels={[]} brand={resolveBrand(null)} sharedWorkspace={workspace}/>:null}</div>;
}
createRoot(document.getElementById("root")!).render(<Demo/>);
