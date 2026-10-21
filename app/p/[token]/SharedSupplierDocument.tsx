"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { confirmationIssues, type DocumentDraft } from "@/lib/shared/document-import";
import { printDocument } from "@/lib/shared/print-document";
import type { BrandContext } from "@/lib/shared/brand-context";
import type { LabelPresentation } from "@/lib/shared/label-presentation";
import { ShippingBoxLabel } from "@/app/portal/_components/ShippingBoxLabel";
import { StatusIcon } from "@/components/StatusIcon";
import { DocumentEditor, DocumentSummary, documentIssueLabel } from "@/components/document-import/DocumentEditor";
import { createDocumentClient, documentText, DocumentRequestError, type DocumentClient, type DocumentLocale, type DocumentReceipt, type DocumentWorkspace } from "@/components/document-import/document-client";
import s from "@/components/document-import/document-import.module.css";

type Labels = { revision:number;folio:string;versionNo:number;labels:{code:string;boxN:number;totalBoxes:number;boxCode?:string|null}[] };
type Version = { revision:number;actor_kind:string;confirmed:boolean;created_at:string;draft:DocumentDraft };

export function SharedSupplierDocument({initialWorkspace,token,code,markbox,locale,brand,presentation,client,attachments,attachmentsSummary,delivery}:{initialWorkspace:DocumentWorkspace;token:string;code:string;markbox:string;locale:DocumentLocale;brand:BrandContext;presentation?:LabelPresentation;client?:DocumentClient;attachments?:ReactNode;attachmentsSummary?:ReactNode;delivery?:ReactNode}) {
  const t=(zh:string,es:string,en:string)=>documentText(locale,zh,es,en);
  const [transport]=useState(()=>client??createDocumentClient({supplierToken:token}));
  const [workspace,setWorkspace]=useState(initialWorkspace);
  const [draft,setDraft]=useState(initialWorkspace.draft);
  const [dirty,setDirty]=useState(false);
  const [busy,setBusy]=useState(false);
  const [step,setStep]=useState(initialWorkspace.revision===initialWorkspace.confirmedRevision?3:0);
  const [notice,setNotice]=useState<string|null>(null);
  const [conflict,setConflict]=useState(false);
  const [comparison,setComparison]=useState<DocumentWorkspace|null>(null);
  const [labels,setLabels]=useState<Labels|null>(null);
  const [receipt,setReceipt]=useState<DocumentReceipt|null>(null);
  const [history,setHistory]=useState<Version[]|null>(null);
  const [historyRevision,setHistoryRevision]=useState<number|null>(null);
  const [checked,setChecked]=useState(false);
  const [editingProduct,setEditingProduct]=useState(false);
  const [loaded,setLoaded]=useState(false);
  const command=useRef<{key:string;id:string}|null>(null);
  const heading=useRef<HTMLHeadingElement>(null);
  const noticeRef=useRef<HTMLDivElement>(null);
  const confirmed=!dirty&&workspace.revision===workspace.confirmedRevision;
  const blockers=confirmationIssues(draft).filter(issue=>issue.blocking);
  const steps=[t("供应商资料","Datos del proveedor","Supplier details"),t("产品与箱组","Productos y cajas","Products and cartons"),t("照片与附件","Fotos y archivos","Photos and files"),t("核对并确认发货","Revisar y confirmar","Review and confirm")];
  const adopt=useCallback((next:DocumentWorkspace)=>{setWorkspace(next);setDraft(next.draft);setDirty(false);setConflict(false);setComparison(null);setLabels(null);setReceipt(null);setChecked(false);setStep(next.revision===next.confirmedRevision?3:0);},[]);

  useEffect(()=>{let active=true;transport.get<{workspace:DocumentWorkspace}>("workspace",{workspaceId:initialWorkspace.id}).then(result=>{if(active){adopt(result.workspace);setLoaded(true);}}).catch(()=>{if(active){setNotice(t("无法读取最新修订版，请重试。","No pudimos consultar la revisión vigente. Reintenta antes de editar.","We could not load the current revision. Retry before editing."));}});return()=>{active=false;};
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[transport,initialWorkspace.id,adopt]);
  useEffect(()=>{if(!dirty)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();};window.addEventListener("beforeunload",warn);return()=>window.removeEventListener("beforeunload",warn);},[dirty]);

  function change(next:DocumentDraft){setDraft(next);setDirty(true);setChecked(false);setLabels(null);setReceipt(null);}
  function navigate(next:number){if(editingProduct){setNotice(t("请先保存或移除正在编辑的产品。","Guarda o quita el producto que estás editando antes de cambiar de paso.","Save or remove the product you are editing before changing steps."));return;}if(!conflict)setNotice(null);setStep(next);requestAnimationFrame(()=>heading.current?.focus());}
  async function compare(){setBusy(true);try{const next=await transport.get<{workspace:DocumentWorkspace}>("workspace",{workspaceId:workspace.id});setComparison(next.workspace);setLoaded(true);}catch{setNotice(t("无法读取共享版本，你的修改仍在此处。","No pudimos consultar la versión compartida. Tus cambios siguen aquí.","We could not load the shared revision. Your edits remain here."));}finally{setBusy(false);}}
  async function reload(){setBusy(true);try{const next=await transport.get<{workspace:DocumentWorkspace}>("workspace",{workspaceId:workspace.id});adopt(next.workspace);setLoaded(true);setNotice(null);}catch{setNotice(t("无法读取共享版本，请重试。","No pudimos consultar la versión compartida. Intenta otra vez.","We could not load the shared revision. Try again."));}finally{setBusy(false);}}
  async function save(confirm=false){
    if(busy||!loaded||editingProduct)return;
    if(confirm&&(!checked||blockers.length)){setNotice(t("请补充必要信息并确认实际发货内容。","Completa los pendientes y confirma que revisaste el despacho.","Complete the missing information and confirm you reviewed the dispatch."));requestAnimationFrame(()=>noticeRef.current?.focus());return;}
    setBusy(true);setNotice(null);
    const action=confirm?"confirm":"save";
    const key=JSON.stringify({action,revision:workspace.revision,draft});
    if(command.current?.key!==key)command.current={key,id:transport.id()};
    try{
      const result=await transport.post<DocumentReceipt>(action,{workspaceId:workspace.id,draft,expectedRevision:workspace.revision,commandId:command.current.id});
      setWorkspace({...workspace,draft,revision:result.revision,confirmedRevision:result.confirmed?result.revision:workspace.confirmedRevision});
      setDirty(false);setConflict(false);setComparison(null);setReceipt(result);setLabels(null);setHistory(null);command.current=null;
      if(result.confirmed){setStep(3);setNotice(t("发货已确认。可以打印文件和箱标。","Despacho confirmado. Ya puedes imprimir el documento y las etiquetas.","Dispatch confirmed. You can now print the document and carton labels."));}
      else setNotice(t("共享草稿已保存，客户会看到本次修订版。","Borrador compartido guardado. El cliente verá esta revisión.","Shared draft saved. The client will see this revision."));
    }catch(error){
      if(error instanceof DocumentRequestError&&error.status===409){setConflict(true);setLabels(null);setReceipt(null);setNotice(error.code==="received_boxes"?t("已有箱子入库，包装变更须由 DTD 核对。你的修改仍在此处。","Ya hay cajas recibidas. DTD debe revisar los cambios de embalaje. Tus cambios siguen aquí.","Cartons have already been received. DTD must review packaging changes. Your edits remain here."):t("共享文件已有更新。你的修改仍在此处；先比较最新修订版。","El documento compartido cambió. Tus cambios siguen aquí; compara la revisión vigente.","The shared document changed. Your edits remain here; compare the current revision."));}
      else setNotice(t("无法确认操作结果。修改仍保留，请重试。","No pudimos confirmar el resultado. Conservamos tus cambios; reintenta la misma acción.","We could not confirm the result. Your edits are preserved; retry the same action."));
      requestAnimationFrame(()=>noticeRef.current?.focus());
    }finally{setBusy(false);}
  }
  async function printable(surface:"labels"|"packing-list"|"preview"){
    if(!confirmed||busy||conflict)return;
    setBusy(true);setNotice(null);
    try{
      const current=await transport.get<Labels>("labels",{workspaceId:workspace.id,expectedRevision:String(workspace.revision)});
      if(current.revision!==workspace.revision||!current.labels.length||current.labels.some(label=>!label.boxCode))throw new DocumentRequestError(409,"revision_conflict","");
      setLabels(current);
      if(surface!=="preview"){
        if(typeof window.print!=="function"){setNotice(t("此浏览器无法打印。你可以查看下方箱标，或使用其他浏览器打印。","Este navegador no permite imprimir. Puedes ver las etiquetas aquí o abrir el enlace en otro navegador.","This browser cannot print. View the labels here or open the link in another browser."));return;}
        requestAnimationFrame(()=>requestAnimationFrame(()=>{try{printDocument(surface);}catch{setNotice(t("无法打开打印窗口，箱标仍显示在下方。","No pudimos abrir la impresión. Las etiquetas siguen disponibles en pantalla.","We could not open printing. Labels remain available on screen."));}}));
      }
    }catch(error){setLabels(null);if(error instanceof DocumentRequestError&&error.status===409)setConflict(true);setNotice(error instanceof DocumentRequestError&&error.code==="labels_need_operations"?t("实际箱子与文件不一致。请联系 DTD 核对箱标。","Las cajas físicas no coinciden con el documento. Contacta a DTD para revisar las etiquetas.","Physical cartons differ from the document. Contact DTD to review the labels."):t("无法打印当前修订版。请读取共享版本并核对确认状态。","No pudimos validar esta revisión para imprimir. Consulta la versión compartida y su confirmación.","This revision could not be validated for printing. Check the shared revision and confirmation."));}
    finally{setBusy(false);}
  }
  async function download(){setBusy(true);try{const file=await transport.download(workspace.id);const url=URL.createObjectURL(file);const link=document.createElement("a");link.href=url;link.download=`PackingList-${code.replace(/[^a-z0-9-]/gi,"_")}.xlsx`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch{setNotice(t("无法下载，请重试。","No pudimos descargar el Excel. Intenta otra vez.","We could not download the Excel. Try again."));}finally{setBusy(false);}}
  async function loadHistory(){setBusy(true);try{const result=await transport.get<{versions:Version[]}>("history",{workspaceId:workspace.id});setHistory(result.versions);}catch{setNotice(t("无法加载历史记录，请重试。","No pudimos consultar el historial. Intenta otra vez.","We could not load the history. Try again."));}finally{setBusy(false);}}

  return <div className={[s.root,s.stack].join(" ")}>
    <div className={[s.notice,s.status,s.noPrint].join(" ")}><StatusIcon tone={confirmed?"success":"info"} size={20}/><span>{confirmed?t("已确认发货","Despacho confirmado","Dispatch confirmed"):dirty?t("有未保存的更改","Cambios sin guardar","Unsaved changes"):t("共享草稿 · 待供应商确认","Borrador compartido · pendiente del proveedor","Shared draft · supplier confirmation pending")} · {t("修订版","Revisión","Revision")} {workspace.revision}</span></div>
    <p className={[s.muted,s.noPrint].join(" ")}>{t("客户已提供以下资料。请核对实际发货的产品、箱数、毛重和体积；无需重新录入。","El cliente adelantó estos datos. Revisa productos, cajas, peso bruto y CBM del despacho real; completa lo que falte.","The client provided these details. Check products, cartons, gross weight and CBM against the actual dispatch, then complete anything missing.")}</p>
    <div className={[s.bar,s.noPrint].join(" ")}><p><strong>{t("采购编号","Compra","Purchase")}</strong> {code} · <strong>Shipping Mark</strong> {markbox}</p><div className={s.actions}><button type="button" className="btn btn-ghost" disabled={busy} onClick={loadHistory}>{t("历史记录","Historial","History")}</button><button type="button" className="btn btn-ghost" disabled={busy||dirty} onClick={download}>{t("下载 Excel","Descargar Excel","Download Excel")}</button></div></div>
    {!loaded&&<button type="button" className="btn btn-ghost" disabled={busy} onClick={reload}>{t("重新读取共享版本","Reintentar lectura","Retry loading")}</button>}
    {notice&&<div ref={noticeRef} tabIndex={-1} role="status" className={[s.notice,s.noPrint].join(" ")}><p>{notice}</p>{conflict&&<button type="button" className="btn btn-ghost" disabled={busy} onClick={compare}>{t("比较共享版本","Comparar versión compartida","Compare shared revision")}</button>}</div>}
    {comparison&&<section className={[s.card,s.stack,s.noPrint].join(" ")} aria-label={t("共享版本","Versión compartida","Shared revision")}><h2>{t("共享修订版","Revisión compartida","Shared revision")} {comparison.revision}</h2><p>{t("你的修改仍在编辑器内。以下内容是服务器上的版本。","Tus cambios siguen en el editor. Aquí puedes consultar lo que está guardado en el servidor.","Your edits remain in the editor. This is the revision currently saved on the server.")}</p><DocumentSummary draft={comparison.draft} locale={locale}/><details><summary>{t("查看完整版本","Ver documento completo","View full document")}</summary><DocumentEditor draft={comparison.draft} locale={locale} readOnly/></details><button type="button" className="btn btn-ghost" disabled={busy} onClick={()=>{adopt(comparison);setNotice(t("已载入共享版本。","Versión compartida cargada.","Shared revision loaded."));}}>{t("放弃我的修改并载入此版本","Descartar mis cambios y cargar esta versión","Discard my edits and load this revision")}</button></section>}
    {history&&<section className={[s.card,s.stack,s.noPrint].join(" ")}><div className={s.bar}><h2>{t("修订历史","Historial de revisiones","Revision history")}</h2><button type="button" className="btn btn-ghost" onClick={()=>{setHistory(null);setHistoryRevision(null);}}>{t("关闭","Cerrar","Close")}</button></div>{history.map(version=><div key={version.revision}><button type="button" className="btn btn-ghost" onClick={()=>setHistoryRevision(version.revision)}>{t("修订版","Revisión","Revision")} {version.revision} · {version.confirmed?t("已确认","Confirmada","Confirmed"):t("草稿","Borrador","Draft")} · {new Date(version.created_at).toLocaleString()}</button>{historyRevision===version.revision&&<DocumentEditor draft={version.draft} locale={locale} readOnly revision={version.revision} confirmed={version.confirmed}/>}</div>)}</section>}
    <nav className={[s.steps,s.noPrint].join(" ")} aria-label={t("文件步骤","Pasos del documento","Document steps")}>{steps.map((name,index)=><button key={index} type="button" aria-label={`${index+1} ${name}`} aria-current={step===index?"step":undefined} disabled={busy||!loaded} onClick={()=>navigate(index)}><strong>{index+1}</strong><span>{name}</span></button>)}</nav>
    <div className={s.workspace}><main className={s.stepPanel}>
      <h2 ref={heading} tabIndex={-1} className={s.noPrint}>{steps[step]}</h2>
      {step<2&&<DocumentEditor draft={draft} onChange={change} locale={locale} section={step===0?"supplier":"cargo"} hideSummary hidePrint disabled={busy||!loaded} onProductEditingChange={setEditingProduct}/>}
      {step===2&&<div className={[s.card,s.stack,s.noPrint].join(" ")}><p>{t("可选：补充货物照片或发货附件。文件上传不等于确认发货。","Opcional: agrega fotos de la mercancía o archivos del despacho. Recibir un archivo no confirma el documento.","Optional: add product photos or dispatch files. Receiving a file does not confirm the document.")}</p>{attachments}</div>}
      {step===3&&<><div className={[s.card,s.stack,s.noPrint].join(" ")}><DocumentEditor draft={draft} locale={locale} readOnly shippingMark={markbox} revision={workspace.revision} confirmed={confirmed}/>{!confirmed&&<><p>{t("核对实际发货内容后确认。确认后将生成每箱唯一标签。","Confirma lo que realmente vas a despachar. Después tendrás una etiqueta única por caja.","Confirm the goods you will actually dispatch. Each carton will then receive its own unique label.")}</p>{blockers.length>0&&<div className={s.notice}><h3>{t("确认前需要补充","Pendientes para confirmar","Required before confirmation")}</h3><ul className={s.reviewList}>{blockers.map(issue=><li key={issue.id}>{documentIssueLabel(issue,locale)}</li>)}</ul><button type="button" className="btn btn-ghost" onClick={()=>navigate(1)}>{t("更正产品与箱组","Corregir productos y cajas","Correct products and cartons")}</button></div>}<label className={s.actions}><input type="checkbox" checked={checked} disabled={busy} onChange={event=>setChecked(event.target.checked)}/><span>{t("我已核对产品、箱数、总毛重和总体积，与实际发货一致。","Revisé los productos, las cajas, el peso bruto total y el CBM del despacho real.","I checked the products, cartons, total gross weight and CBM against the actual dispatch.")}</span></label><button type="button" className="btn btn-primary" disabled={busy||!checked||blockers.length>0||conflict} onClick={()=>save(true)}>{busy?t("正在确认…","Confirmando…","Confirming…"):t("确认发货并发送给 DTD","Confirmar despacho y enviar a DTD","Confirm dispatch and send to DTD")}</button></>}{attachmentsSummary}</div>
      {confirmed&&<section className={[s.receipt,s.noPrint].join(" ")}><h2 className={s.status}><StatusIcon tone="success" size={24}/>{t("发货已确认","Despacho confirmado","Dispatch confirmed")}</h2><p>{receipt?.folio??labels?.folio??t("已确认的共享文件","Documento compartido confirmado","Confirmed shared document")} · {t("修订版","Revisión","Revision")} {workspace.revision}{(receipt?.versionNo??labels?.versionNo)?` · ${t("版本","Versión","Version")} ${receipt?.versionNo??labels?.versionNo}`:""}</p><p>{t("每箱贴一张标签。若修改装箱数据，请再次确认后重新打印。","Pega una etiqueta en cada caja. Si corriges el embalaje, vuelve a confirmar e imprime las etiquetas vigentes.","Attach one label to each carton. After changing packaging, confirm again and print the current labels.")}</p><div className={s.actions}><button type="button" className="btn btn-primary" disabled={busy||conflict} onClick={()=>printable("labels")}>{t("打印箱标","Imprimir etiquetas","Print labels")}</button><button type="button" className="btn btn-ghost" disabled={busy||conflict} onClick={()=>printable("packing-list")}>{t("打印文件","Imprimir documento","Print document")}</button><button type="button" className="btn btn-ghost" onClick={()=>navigate(1)}>{t("更正文件","Corregir documento","Correct document")}</button></div></section>}</>}
      {confirmed&&step===3&&<div className={[s.actions,s.noPrint].join(" ")}><button type="button" className="btn btn-ghost" disabled={busy||conflict} onClick={()=>printable("preview")}>{t("查看箱标","Ver etiquetas","View labels")}</button><p className={s.muted}>{t("无需打印也能查看每箱的唯一编码。","Puedes consultar el código de cada caja en pantalla.","You can view each carton code on screen without printing.")}</p></div>}
      <div className={[s.bar,s.noPrint].join(" ")}><div className={s.actions}>{step>0&&<button type="button" className="btn btn-ghost" disabled={busy} onClick={()=>navigate(step-1)}>{t("上一步","Anterior","Back")}</button>}<button type="button" className="btn btn-ghost" disabled={busy||!dirty||!loaded||conflict||editingProduct} onClick={()=>save()}>{busy?t("保存中…","Guardando…","Saving…"):t("保存共享草稿","Guardar borrador compartido","Save shared draft")}</button></div>{step<3&&<button type="button" className="btn btn-primary" disabled={busy||!loaded} onClick={()=>navigate(step+1)}>{t("下一步","Continuar","Continue")}</button>}</div>
      {delivery&&<div className={s.noPrint}>{delivery}</div>}
    </main><aside className={[s.summary,s.noPrint].join(" ")}><DocumentSummary draft={draft} locale={locale} revision={workspace.revision} confirmed={confirmed}/><p className={s.muted}>{t("共享草稿保存在服务器，不会被此设备的旧草稿覆盖。","Este borrador se guarda en la compra. Los borradores antiguos de este dispositivo no lo reemplazan.","This draft is saved with the purchase. Older drafts on this device do not replace it.")}</p></aside></div>
    <div className={[s.print,"pl-doc","pl-print-only"].join(" ")}><DocumentEditor draft={draft} locale={locale} readOnly shippingMark={markbox} revision={workspace.revision} confirmed={confirmed}/></div>
    {labels&&confirmed&&!conflict&&<section aria-label={t("箱标","Etiquetas de las cajas","Carton labels")}><h2 className={s.noPrint}>{labels.labels.length} {t("个箱标","etiquetas de cajas","carton labels")}</h2><div className={[s.labels,"labels-print-area"].join(" ")}>{labels.labels.map(label=><ShippingBoxLabel key={label.boxCode} label={label} markbox={markbox} brandName={brand.name} presentation={presentation}/>)}</div></section>}
  </div>;
}
