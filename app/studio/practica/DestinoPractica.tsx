"use client";
import { useEffect, useRef, useState } from "react";
import { API_PRACTICA, type PermisoPractica } from "@/lib/studio/practica/contrato";
import { CONSOLIDADOS_CHINA, type ConsolidadoEjercicio, type EtapaLecturaChina } from "@/lib/studio/practica/ejercicio-china";
import { parseScannedLabel } from "@/lib/studio/etiquetas-qr";
import type { CasoDestino, ComandoDestino, VistaDestinoPersonal } from "@/lib/studio/practica/destino";
import { ConfirmDialog } from "@/app/studio/_components/ui/ConfirmDialog";
import estilos from "./practica.module.css";

const estados = {en_transito:"En tránsito",en_destino:"Llegada física registrada",recepcion_parcial:"Recepción física parcial",recepcion_completa:"Recepción física completa"};
export function DestinoPractica({espacio,permisos,suspendida,onBloqueoSalida,onRevalidarPermisos}: {
  espacio:string;permisos:PermisoPractica[];suspendida:boolean;
  onBloqueoSalida:(activo:boolean)=>void;onRevalidarPermisos:()=>Promise<boolean>;
}) {
  const [etapa,setEtapa]=useState<EtapaLecturaChina>(permisos.some(p=>p.id==="shipments" && p.edicion) ? "shipments" : permisos.some(p=>p.id==="ve") ? "ve" : "shipments");
  const [caso,setCaso]=useState<CasoDestino>(permisos.some(p=>p.id==="cn" && p.ejercicioCn) ? "china" : "preparado");
  const etapaActiva:EtapaLecturaChina=permisos.some(p=>p.id===etapa) ? etapa : permisos.some(p=>p.id==="shipments") ? "shipments" : "ve";
  const [consolidado,setConsolidado]=useState<ConsolidadoEjercicio>(CONSOLIDADOS_CHINA[0]);
  const [vista,setVista]=useState<VistaDestinoPersonal>();
  const [ocupado,setOcupado]=useState(false),[error,setError]=useState(""),[mensaje,setMensaje]=useState("");
  const [codigo,setCodigo]=useState("");
  const [confirmacion,setConfirmacion]=useState<"abrir_incidencia"|"resolver_incidencia"|null>(null);
  const [reintento,setReintento]=useState<{comando:ComandoDestino;revision:number}>();
  const bloqueo=useRef(false),montado=useRef(true),lectura=useRef<AbortController|null>(null);
  const aviso=useRef<HTMLParagraphElement>(null);
  const datos=vista?.consolidado===consolidado && vista.etapa===etapaActiva && vista.caso===caso ? vista : undefined;
  // La proyección guardada no conserva una autorización que el padre ya retiró.
  const permisoVigente=permisos.find(p=>p.id===etapaActiva);
  const puedeEditar=datos?.edicion===true && permisoVigente?.edicion===true;
  const puedeGestionarIncidencia=puedeEditar && datos?.incidenciaDestino===true && permisoVigente?.incidenciaDestino===true;
  async function pedir(destino?:ComandoDestino,revision=datos?.revision) {
    if (bloqueo.current || (destino && suspendida)) return;
    bloqueo.current=true;setOcupado(true);setError("");setMensaje("");
    if (destino) {onBloqueoSalida(true);setReintento({comando:destino,revision:revision ?? -1});}
    const control=new AbortController();if (!destino) lectura.current=control;
    try {
      const res=await fetch(API_PRACTICA+"china",{method:"POST",headers:{"Content-Type":"application/json"},cache:"no-store",redirect:"error",
        signal:destino ? undefined : control.signal,body:JSON.stringify({espacio,etapa:etapaActiva,consolidado,caso,revision,destino})});
      if(res.status===413){setReintento(undefined);throw new Error("Acorta el motivo inventado y vuelve a confirmar; el avance anterior se conserva.");}
      const resultado=await res.json();
      if (!res.ok) {
        if (res.status===401 || res.status===403) {setVista(undefined);setReintento(undefined);void onRevalidarPermisos();}
        if (res.status===400 || (res.status===409 && !String(resultado?.error).startsWith("La práctica cambió"))) setReintento(undefined);
        throw new Error(resultado?.error ?? "No se pudo comprobar el avance de destino.");
      }
      if (!montado.current) return;
      setVista(resultado);
      if (!destino) setReintento(actual=>actual ? {...actual,revision:resultado.revision} : undefined);
      if (destino) {setReintento(undefined);setConfirmacion(null);setCodigo("");setMensaje("Operación ficticia confirmada. El avance está guardado en tu práctica.");}
    } catch(e) {
      if (!control.signal.aborted && montado.current) setError(e instanceof TypeError || e instanceof SyntaxError ? "No pudimos comprobar el resultado. Reintenta la misma operación para recuperar su avance." : e instanceof Error ? e.message : "Servicio de práctica indisponible.");
    } finally {
      bloqueo.current=false;
      if (destino) onBloqueoSalida(false);
      if (montado.current) setOcupado(false);
    }
  }
  useEffect(()=>{
    montado.current=true;let vigente=true;
    queueMicrotask(()=>{if(vigente)void pedir();});
    return ()=>{vigente=false;montado.current=false;lectura.current?.abort();};
  },[espacio,etapaActiva,consolidado,caso]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>{if(error)aviso.current?.focus();},[error]);
  useEffect(()=>{
    const prevenir=(e:BeforeUnloadEvent)=>{if(bloqueo.current){e.preventDefault();e.returnValue="";}};
    window.addEventListener("beforeunload",prevenir);return()=>window.removeEventListener("beforeunload",prevenir);
  },[]);
  function actuar(accion:ComandoDestino["accion"],extra:Partial<ComandoDestino>={}) {
    if (!datos || reintento) return;
    void pedir({id:crypto.randomUUID(),accion,consolidado:datos.consolidado,caso,...extra});
  }
  const inhabilitado=ocupado || suspendida || !!reintento;
  return <section className={estilos.facturacion} aria-labelledby="titulo-destino">
    <h2 id="titulo-destino">Viajes parciales y recepción física de práctica</h2>
    <p>Simulación · Datos inventados. {caso==="preparado" ? "Caso preparado personal: cuatro cajas ya recibidas y estibadas para practicar tu etapa." : "Desde tu recepción en China: los dos viajes conservan sus cajas de origen."} Este ejercicio conserva independiente el caso financiero y no crea ni emite una preorden.</p>
    <div className={estilos.acciones}>
      <label>Ejercicio de destino <select aria-label="Ejercicio de destino" value={caso} disabled={ocupado || !!reintento} onChange={e=>setCaso(e.target.value as CasoDestino)}>
        <option value="china">Desde mi recepción en China</option><option value="preparado">Caso preparado para mi etapa</option>
      </select></label>
      <label>Vista de destino <select aria-label="Vista de destino" value={etapaActiva} disabled={ocupado || !!reintento} onChange={e=>setEtapa(e.target.value as EtapaLecturaChina)}>
        {permisos.some(p=>p.id==="shipments") && <option value="shipments">Embarques de práctica</option>}
        {permisos.some(p=>p.id==="ve") && <option value="ve">Recepción física VE de práctica</option>}
      </select></label>
      <label>Consolidado de destino <select aria-label="Consolidado de destino" value={consolidado} disabled={ocupado || !!reintento} onChange={e=>setConsolidado(e.target.value as ConsolidadoEjercicio)}>
        {CONSOLIDADOS_CHINA.map(c=><option key={c}>{c}</option>)}
      </select></label>
      <button type="button" disabled={ocupado} onClick={async()=>{if(await onRevalidarPermisos() && montado.current)await pedir();}}>Recargar destino y permisos</button>
    </div>
    <details><summary aria-label="Ayuda: Viajes parciales">ⓘ Viajes parciales y manifiesto</summary><p>Las cajas se leen por consolidado y recepción de origen. Embarcar fija ese manifiesto; una estiba posterior en el mismo viaje se rechaza. Las cajas disponibles pueden montarse en otro consolidado. Cambiar de viaje conserva el avance.</p></details>
    <details><summary aria-label="Ayuda: Recepción física por caja">ⓘ Recepción física por caja</summary><p>Registra la llegada y escanea una etiqueta DTD-B o escribe su código. Una caja se recibe una sola vez. Frágil indica cómo manipularla, sin costo ni bloqueo. Recepción completa significa que llegaron las cajas de este viaje; la entrega posterior es otro paso.</p></details>
    <details><summary aria-label="Ayuda: Observación de destino">ⓘ Observación aduanal ficticia</summary><p>Esta observación logística es propia del destino. Requiere capacidad vigente y motivo inventado para registrar y resolver. Mientras está pendiente impide continuar su viaje. No modifica los indicadores de China, no constituye autorización ni simula la liberación formal SENIAT. Faro no está disponible; esta ayuda local permanece operable.</p></details>
    {ocupado && <p role="status">Comprobando o guardando el viaje ficticio…</p>}
    {error && <p ref={aviso} role="alert" tabIndex={-1}>{error}</p>}
    {mensaje && <p role="status">{mensaje}</p>}
    {reintento && !ocupado && <button type="button" disabled={suspendida} onClick={()=>void pedir(reintento.comando,reintento.revision)}>Reintentar la misma operación de destino</button>}
    {datos && <>
      {datos.caso==="preparado" && <p>Plantilla personal preparada para {datos.preparadoPara==="ve" ? "Recepción física VE, con dos viajes en tránsito" : "Embarques, con dos viajes listos para despachar"}. Tu ejercicio desde cero se conserva por separado.</p>}
      {!puedeEditar && <p>Solo consulta: puedes revisar las cajas y su estado con tu permiso vigente.</p>}
      <h3>{datos.consolidado} · {etapaActiva==="ve" ? "Recepción física VE" : "Embarques"}</h3>
      {!datos.cajas.length && <p>Todavía no hay cajas montadas en este consolidado. Completa la recepción y estiba de esta compra en China.</p>}
      {datos.viaje && <p role="status" aria-label="Estado del viaje">{estados[datos.viaje.estado]} · Recepción física: {datos.viaje.recibidas.length} de {datos.viaje.cajas.length} cajas.</p>}
      {datos.viaje?.incidencia && <p>Observación de destino: {datos.viaje.incidencia.estado}. {puedeGestionarIncidencia && <>{datos.viaje.incidencia.motivo} {datos.viaje.incidencia.resolucion}</>}</p>}
      <ul aria-label="Cajas del viaje">{datos.cajas.map(c=><li key={c.codigo}>
        <strong>{c.codigo}</strong> · {datos.viaje?.recibidas.includes(c.codigo) ? "Recibida físicamente" : "Pendiente de recepción física"}
        <p>Compra: {c.compra} · Marca: {c.markbox} · Recepción de origen: {c.recepcion} · Lote: {c.lote} · Orden: {c.orden+1} · Ancho: {c.ancho}</p>
        {c.indicadores.map(i=><p key={i.codigo}>{i.nombre} · {i.origen}</p>)}
      </li>)}</ul>
      <div className={estilos.acciones}>
        {etapaActiva==="shipments" && puedeEditar && !datos.viaje && <button type="button" disabled={inhabilitado || !datos.cajas.length} onClick={()=>actuar("embarcar")}>Embarcar este parcial de práctica</button>}
        {etapaActiva==="ve" && puedeEditar && datos.viaje?.estado==="en_transito" && <button type="button" disabled={inhabilitado} onClick={()=>actuar("registrar_llegada")}>Registrar llegada física de este parcial</button>}
        {puedeGestionarIncidencia && datos.viaje && ["en_destino","recepcion_parcial"].includes(datos.viaje.estado) && !datos.viaje.incidencia && <button type="button" disabled={inhabilitado} onClick={()=>setConfirmacion("abrir_incidencia")}>Registrar observación aduanal ficticia</button>}
        {puedeGestionarIncidencia && datos.viaje?.incidencia?.estado==="pendiente" && <button type="button" disabled={inhabilitado} onClick={()=>setConfirmacion("resolver_incidencia")}>Resolver observación ficticia de destino</button>}
      </div>
      {etapaActiva==="ve" && puedeEditar && datos.viaje && datos.viaje.estado!=="en_transito" && <form onSubmit={e=>{
        e.preventDefault();const etiqueta=parseScannedLabel(codigo);
        if(etiqueta.kind!=="box_code"){setError("Usa el código DTD-B de una caja de este parcial; la etiqueta de cliente no recibe cajas.");return;}
        actuar("recibir_caja",{caja:etiqueta.code});
      }}><fieldset disabled={inhabilitado || datos.viaje.incidencia?.estado==="pendiente"}>
        <legend>Conteo físico de este parcial</legend>
        <label>Código DTD-B en destino<input aria-label="Código DTD-B en destino" maxLength={512} value={codigo} onChange={e=>setCodigo(e.target.value)} autoComplete="off" /></label>
        <button type="submit">Recibir caja física de práctica</button>
      </fieldset></form>}
      <ConfirmDialog key={confirmacion ?? "cerrada"} open={!!confirmacion && puedeGestionarIncidencia} title={confirmacion==="abrir_incidencia" ? "Observación aduanal ficticia" : "Resolver observación ficticia"}
        message={`Viaje ${datos.consolidado}. ${confirmacion==="abrir_incidencia" ? "Quedará pendiente de revisión y se detendrá su recepción física." : "Se registra la resolución logística y se permite continuar el conteo físico."} No declara liberación formal SENIAT ni modifica facturas.`}
        reason reasonRequired reasonLabel="Motivo ficticio de destino" reasonPlaceholder="Usa solo un motivo inventado" pending={ocupado} error={error}
        confirmLabel={confirmacion==="abrir_incidencia" ? "Confirmar observación ficticia" : "Confirmar resolución ficticia"}
        onCancel={()=>setConfirmacion(null)} onConfirm={motivo=>{if(confirmacion)actuar(confirmacion,{motivo});}} />
    </>}
  </section>;
}
