import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { calcularEnvioLCL, type CalcParams, type Ciudad, type EnvioInput } from "@/lib/calculadora";
import { getPublicCbmRate,getPublicCalculatorConfig,getPublicCalculatorCities,getPublicCarrierTariffs,combinarDestinos,type PublicCbmRate } from "@/lib/public/rates-queries";
import { aggregateTransportDeclarations,computeDocumentTotals,confirmationIssues,parseDocumentDraft } from "@/lib/shared/document-import";
import { authorizeWorkspace,requirePortal,requirePortalScope,ImportHttpError,type WorkspaceRow } from "./access";
import { getWorkspace } from "./service";

type EstimateRates={rate:PublicCbmRate;params:CalcParams;cities:Ciudad[]};
export function combinedLogistics(workspaces:WorkspaceRow[]) {
  if(!workspaces.length || workspaces.length>50 || new Set(workspaces.map(w=>w.id)).size!==workspaces.length) throw new ImportHttpError(400,"invalid_selection","Selecciona cada compra una sola vez (hasta 50).");
  // `cartons` arranca en 0 pero se vuelve null en cuanto UNA compra no lo declara:
  // sumar como cero diría "10 cajas" cuando en realidad son "10 más lo que no sé".
  // El peso y el CBM no necesitan esto porque abajo se exigen presentes y > 0.
  let cbm=0,weight=0,cartons:number|null=0;
  for(const w of workspaces) {
    const draft=parseDocumentDraft(w.draft);
    const totals=computeDocumentTotals(draft);
    if(totals.cbm==null || totals.cbm<=0 || totals.grossWeightKg==null || totals.grossWeightKg<=0) throw new ImportHttpError(422,"missing_logistics","Completa el peso bruto y el CBM de todas las compras antes de calcular.");
    const freightIndependent=new Set(["contact_missing","name_missing","price_missing","currency_missing","multiple_currencies","unsupported_currency","quantity_missing","unit_review","groups_missing","allocation_mismatch","contents_missing","unequal_carton_contents","packing_pattern_unknown","cartons_missing"]);
    const globalCbm=draft.declaredTotals.cbm!==null&&draft.declaredTotals.cbm>0;
    const globalGross=draft.declaredTotals.grossWeightKg!==null&&draft.declaredTotals.grossWeightKg>0;
    const blockers=confirmationIssues(draft).filter(i=>i.blocking&&!i.resolved&&!freightIndependent.has(i.code)
      // Global totals cover the shipment once, including partially described groups.
      // Known disagreements (including subtotals exceeding the global total) still block.
      && !(globalCbm && i.code==="cbm_missing")
      && !(globalGross && i.code==="grossWeightKg_missing"));
    if(blockers.length) throw new ImportHttpError(422,"review_required","Revisa las diferencias y la lectura parcial de los documentos antes de calcular.");
    cbm+=totals.cbm;weight+=totals.grossWeightKg;cartons=cartons===null||totals.cartons===null?null:cartons+totals.cartons;
  }
  return {cbm:Number(cbm.toFixed(6)),grossWeightKg:Number(weight.toFixed(3)),cartons};
}
export function estimateDocuments(workspaces:WorkspaceRow[],body:Record<string,unknown>,rates:EstimateRates) {
  const totals=combinedLogistics(workspaces);
  const declarations=aggregateTransportDeclarations(workspaces.map(w=>parseDocumentDraft(w.draft)));
  if(declarations.battery.pending || declarations.specialCargo.pending) throw new ImportHttpError(422,"transport_review_required",
    (declarations.battery.value===true?"La selección incluye baterías. ":"")+(declarations.specialCargo.value===true?"La selección incluye carga especial. ":"")+"Revisa y guarda la declaración de baterías y carga regulada de todas las compras antes de cotizar.");
  const cityId=String(body.cityId??"");
  if(!rates.cities.some(c=>c.id===cityId)) throw new ImportHttpError(422,"destination_required","Selecciona el destino en Venezuela.");
  const input:EnvioInput={modo:"ddp",cbmTotal:totals.cbm,pesoKg:totals.grossWeightKg,ciudadId:cityId,
    embalaje:body.packaging==="especial"?"especial":"estandar",bateria:declarations.battery.value===true,cargaEspecial:declarations.specialCargo.value===true,
    tarifaCBMOverride:rates.rate.per_cbm,minChargeOverride:rates.rate.min_charge??undefined};
  const result=calcularEnvioLCL(input,rates.params,rates.cities);
  return {kind:"transport_estimate",currency:"USD",totals,result,input,rates:{rate:rates.rate,params:rates.params,city:rates.cities.find(c=>c.id===cityId)},
    documentRevisions:workspaces.map(w=>({workspaceId:w.id,revision:w.revision,confirmed:w.revision===w.confirmed_revision})),
    generatedAt:new Date().toISOString(),notice:"Estimado de transporte sujeto a confirmación de datos y tarifa por DTD. El valor de la mercancía se presenta por separado."};
}
export async function getEstimateRates():Promise<EstimateRates> {
  const [rate,params,cities,tariffs]=await Promise.all([getPublicCbmRate(),getPublicCalculatorConfig(),getPublicCalculatorCities(),getPublicCarrierTariffs()]);
  if(!rate || !params || !Number.isFinite(rate.per_cbm) || rate.per_cbm<=0 || (rate.valid_until && rate.valid_until<new Date().toISOString().slice(0,10))) throw new ImportHttpError(503,"tariff_unavailable","La tarifa vigente no está disponible. Conserva los datos y consulta a tu asesor.");
  return {rate,params,cities:combinarDestinos(cities,tariffs)};
}
export async function estimateForRequest(admin:SupabaseClient,session:SupabaseClient,headers:Headers,body:Record<string,unknown>) {
  if(!Array.isArray(body.workspaceIds) || !body.workspaceIds.length || body.workspaceIds.length>50 || body.workspaceIds.some(id=>typeof id!=="string")) throw new ImportHttpError(400,"invalid_selection","Selecciona los documentos para calcular.");
  const ids=body.workspaceIds as string[];
  if(new Set(ids).size!==ids.length) throw new ImportHttpError(400,"duplicate_selection","Cada compra se incluye una sola vez.");
  if(new Set(ids.map(id=>id.toLowerCase())).size!==ids.length) throw new ImportHttpError(400,"invalid_selection","Selecciona cada compra una sola vez.");
  if(!Array.isArray(body.expectedRevisions) || body.expectedRevisions.length!==ids.length) throw new ImportHttpError(400,"invalid_revision","Actualiza la revisión de cada documento antes de calcular.");
  const revisions=new Map<string,number>();
  for(const row of body.expectedRevisions) {
    if(!row || typeof row!=="object" || Array.isArray(row) || Object.keys(row).some(k=>!["workspaceId","revision"].includes(k)) || typeof row.workspaceId!=="string" || !ids.includes(row.workspaceId) || !Number.isInteger(row.revision) || row.revision<0 || revisions.has(row.workspaceId)) throw new ImportHttpError(400,"invalid_revision","Actualiza la revisión de cada documento antes de calcular.");
    revisions.set(row.workspaceId,row.revision);
  }
  // Varias compras o guardar el estimado son cosas del portal: sin su interruptor,
  // sólo se cotiza el documento anónimo del cotizador. Se niega ANTES de calcular.
  if(ids.length>1 || body.save===true) requirePortalScope();
  if(ids.length>1) await requirePortal(session);
  const workspaces:WorkspaceRow[]=[];
  async function readAuthorized(id:string,prior?:WorkspaceRow) {
    const w=await getWorkspace(admin,id);const actor=await authorizeWorkspace(admin,session,w,headers);
    if(actor.kind==="supplier" || (ids.length>1 && actor.kind!=="client")) throw new ImportHttpError(403,"not_allowed","Selecciona tus compras desde el portal.");
    if(w.revision!==revisions.get(id) || (prior && (w.tenant_id!==prior.tenant_id || w.client_id!==prior.client_id || w.prealerta_id!==prior.prealerta_id || w.anonymous_hash!==prior.anonymous_hash))) throw new ImportHttpError(409,"revision_conflict","El documento cambió. Carga la revisión compartida y vuelve a calcular.");
    return w;
  }
  for(const id of ids)workspaces.push(await readAuthorized(id));
  const rates=await getEstimateRates();
  const revalidate=async()=>{for(const w of workspaces)await readAuthorized(w.id,w);};
  // These are explicit rechecks, not a transactional database snapshot.
  await revalidate();
  const result=estimateDocuments(workspaces,body,rates);
  if(body.save===true){
    const principal=await requirePortal(session);
    if(workspaces.some(w=>w.tenant_id!==principal.tenantId||w.client_id!==principal.client.id)) throw new ImportHttpError(403,"not_allowed","Selecciona tus compras desde el portal.");
    await revalidate();
    const {data:saved,error}=await admin.from("document_estimate_snapshots").insert({tenant_id:principal.tenantId,client_id:principal.client.id,created_by:principal.userId,
      inputs:{...result.input,documents:result.documentRevisions},rates:result.rates,result:result.result}).select("id").single();
    if(error) throw new ImportHttpError(503,"save_failed","El estimado se calculó, pero no pudimos guardarlo. Intenta de nuevo.");
    await revalidate();
    return {...result,savedId:saved.id};
  }
  await revalidate();
  return result;
}
