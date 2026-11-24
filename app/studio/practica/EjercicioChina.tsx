"use client";
import { useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Icon } from "@/app/studio/_components/icons";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { CODIGOS_CHINA, CONSOLIDADOS_CHINA, consultarEtiquetaChina, type ComandoEjercicioChina, type EjercicioChina as Datos, type ConsolidadoEjercicio } from "@/lib/studio/practica/ejercicio-china";
import estilos from "./practica.module.css";

type Consulta = ReturnType<typeof consultarEtiquetaChina>;
export function EjercicioChina({ estado, ocupado, permitido, onConsultar, onOperacion }: {
  estado: Datos; ocupado: boolean; permitido: boolean;
  onConsultar: (codigo: string) => Promise<Consulta | undefined>;
  onOperacion: (comando: ComandoEjercicioChina) => Promise<Datos | undefined>;
}) {
  const entrada=useRef<HTMLInputElement>(null), bloqueo=useRef(false);
  const [codigo,setCodigo]=useState("");
  const [muestra,setMuestra]=useState<string>(CODIGOS_CHINA[0]);
  const [consulta,setConsulta]=useState<Consulta>();
  const [cantidad,setCantidad]=useState(1), [montar,setMontar]=useState(1);
  const [consolidado,setConsolidado]=useState<ConsolidadoEjercicio>(CONSOLIDADOS_CHINA[0]);
  const [ancho,setAncho]=useState(1);
  const [mensaje,setMensaje]=useState("");
  const [ultimo,setUltimo]=useState<ComandoEjercicioChina>();
  const [recibo,setRecibo]=useState<string>();
  const [recepcion,setRecepcion]=useState("");
  const [motivo,setMotivo]=useState("");
  const [resolucion,setResolucion]=useState("");
  const [evidencia,setEvidencia]=useState("");
  const recibidas=estado.cajas.filter(c=>c.recepcion).length;
  const disponibles=estado.cajas.filter(c=>c.recepcion&&!c.estiba).length;
  async function consultar() {
    if (ocupado || bloqueo.current) return;
    bloqueo.current=true;setMensaje("");
    try {
      const datos=await onConsultar(codigo);
      setConsulta(datos);
      if(datos){setCantidad(Math.max(1,datos.pendientes.length));setMontar(Math.max(1,datos.disponibles.length));setMensaje(datos.yaRecibida ? "Esta caja ya fue recibida. Consulta las que siguen por llegar y las disponibles antes de confirmar otra operación." : "Etiqueta identificada. Revisa la cantidad que llegó antes de confirmar.");}
    } finally {bloqueo.current=false;}
  }
  async function actuar(comando: ComandoEjercicioChina) {
    if(ocupado || bloqueo.current || !permitido) return;
    bloqueo.current=true; setUltimo(comando);setMensaje("");
    try {
      const siguiente=await onOperacion(comando);
      if(!siguiente){setMensaje("La operación no quedó confirmada en pantalla. Puedes recargar y reintentar la misma referencia.");return;}
      setUltimo(undefined);
      if(comando.accion==="recibir"){
        const evento=siguiente.eventos.find(e=>e.id===comando.id);
        const nuevo=evento?.despues.recepciones.at(-1);
        if(nuevo){setRecibo(nuevo.id);setRecepcion(nuevo.id);setMensaje(`Recibo ${nuevo.id}: ${nuevo.cajas.length} cajas registradas. No se creó una preorden al recibir.`);}
      } else if(comando.accion==="cargar") setMensaje(`Lote guardado en ${comando.consolidado}. Las cajas no montadas siguen en China.`);
      else setMensaje("Cambio de práctica guardado con su historial.");
      if(consulta) setConsulta(consultarEtiquetaChina(siguiente,consulta.codigo));
    } finally {bloqueo.current=false;}
  }
  const seleccion=estado.recepciones.find(r=>r.id===recepcion);
  return <section className={estilos.facturacion} aria-labelledby="titulo-ejercicio-china">
    <h3 id="titulo-ejercicio-china">China de principio a fin</h3>
    <p>Compra de práctica {estado.compra} · Marca {estado.markbox} · Datos inventados.</p>
    <p>4 anunciadas: llegan 3; monta 2 en A. Quedan una en almacén y una por llegar. Recibe la cuarta y monta las 2 restantes en B.</p>
    <p role="status" aria-label="Resumen de cajas">{estado.cajas.length-recibidas} por llegar · {disponibles} disponibles en China · {estado.cajas.filter(c=>c.estiba?.consolidado===CONSOLIDADOS_CHINA[0]).length} en A · {estado.cajas.filter(c=>c.estiba?.consolidado===CONSOLIDADOS_CHINA[1]).length} en B</p>
    {!permitido && <p>Consulta del ejercicio. Tu rol, región y permiso de edición vigentes determinan qué puedes confirmar.</p>}
    <details><summary>Etiqueta de práctica y ayuda para el lector</summary>
      <p>Usa un lector compatible con QR configurado como teclado y terminación Enter, o escribe el código manualmente. Enfoca el campo antes de escanear. No se activa cámara ni se abre ninguna dirección. El aparato físico no ha sido probado.</p>
      <label>Etiqueta de muestra<select value={muestra} onChange={e=>setMuestra(e.target.value)}>{CODIGOS_CHINA.map(c=><option key={c}>{c}</option>)}</select></label>
      <div style={{background:"var(--color-white)",color:"var(--color-black)",padding:"var(--s-3)",width:"fit-content"}}>
        <QRCodeSVG value={muestra} size={192} marginSize={4} level="M" role="img" aria-label="QR de caja inventada" title={`Datos inventados · ${muestra}`} />
      </div>
      <p>Código de muestra: <code>{muestra}</code>. Todas las etiquetas de esta sección son inventadas.</p>
    </details>
    <form onSubmit={e=>{e.preventDefault();void consultar();}}>
      <label>Código de etiqueta de práctica<input ref={entrada} value={codigo} onChange={e=>setCodigo(e.target.value)} maxLength={512} autoComplete="off" spellCheck={false} enterKeyHint="go" disabled={ocupado} /></label>
      <div className={estilos.acciones}><button type="button" disabled={ocupado} onClick={()=>entrada.current?.focus()}>Enfocar lector de teclado</button><button type="submit" disabled={ocupado}>Consultar etiqueta de práctica</button></div>
    </form>
    <details><summary>ⓘ Escanear, recibir y montar</summary><p>Escanear solo identifica la compra y sus cajas; todavía no recibe ni monta nada. La etiqueta del proveedor que solo tiene la marca del cliente no confirma una recepción. Al recibir confirmas la llegada física y obtienes un recibo, sin crear una preorden automática. Recibir menos deja cajas por llegar; montar menos deja cajas ya recibidas disponibles en China para otro consolidado. En ambos pasos se toma primero la caja escaneada. Esta compra admite hasta cuatro cajas en el ejercicio.</p></details>
    {consulta && <fieldset disabled={ocupado}>
      <legend>Revisar {consulta.codigo}</legend>
      <p>{consulta.compra} · {consulta.markbox} · {consulta.pendientes.length} pendientes de llegada · {consulta.disponibles.length} recibidas sin montar.</p>
      {consulta.montadaEn && <p>Esta caja ya está montada en {consulta.montadaEn}. Para otra carga, consulta una caja recibida que siga disponible.</p>}
      <label>Cajas que llegaron<input type="number" min={1} max={consulta.pendientes.length || 1} step={1} value={cantidad} onChange={e=>setCantidad(Number(e.target.value))} disabled={!permitido || !consulta.pendientes.length} /></label>
      <div className={estilos.acciones}><button type="button" disabled={!permitido || !consulta.pendientes.length || !Number.isSafeInteger(cantidad) || cantidad<1 || cantidad>consulta.pendientes.length} onClick={()=>void actuar({id:crypto.randomUUID(),accion:"recibir",codigo:consulta.codigo,cantidad})}>Confirmar recepción de práctica</button><button type="button" onClick={()=>{setConsulta(undefined);setMensaje("Consulta cancelada. No se registró recepción ni carga.");}}>Cancelar consulta sin recibir</button></div>
      <label>Consolidado de práctica<select value={consolidado} disabled={!permitido} onChange={e=>setConsolidado(e.target.value as ConsolidadoEjercicio)}>{CONSOLIDADOS_CHINA.map(c=><option key={c}>{c}</option>)}</select></label>
      <label>Cajas a montar<input type="number" min={1} max={consulta.disponibles.length || 1} step={1} value={montar} disabled={!permitido} onChange={e=>setMontar(Number(e.target.value))}/></label>
      <label>Posición al ancho<select value={ancho} disabled={!permitido} onChange={e=>setAncho(Number(e.target.value))}><option value={0}>Izquierda</option><option value={1}>Centro</option><option value={2}>Derecha</option></select></label>
      <button type="button" disabled={!permitido || !consulta.yaRecibida || !!consulta.montadaEn || !Number.isSafeInteger(montar) || montar<1 || montar>consulta.disponibles.length} onClick={()=>void actuar({id:crypto.randomUUID(),accion:"cargar",codigo:consulta.codigo,cantidad:montar,consolidado,ancho})}>Confirmar carga del lote</button>
    </fieldset>}
    {mensaje && <p role="status">{mensaje}</p>}
    {ultimo && permitido && <button type="button" disabled={ocupado} onClick={()=>void actuar(ultimo)}>Reintentar la misma operación</button>}
    {recibo && <p>Último recibo confirmado: {recibo}. Revisa sus códigos en la lista de recepciones.</p>}
    <details open><summary>Estado de las cuatro cajas</summary><ul>{estado.cajas.map(c=><li key={c.codigo}><code>{c.codigo}</code> · {c.recepcion ? `Recibida en ${c.recepcion}` : "Por llegar"} · {c.estiba ? `${c.estiba.consolidado} · ${["Izquierda","Centro","Derecha"][c.estiba.ancho]} · orden ${c.estiba.orden+1}` : c.recepcion ? "Disponible en China" : "Sin montar"}</li>)}</ul></details>
    {estado.recepciones.length>0 && <fieldset disabled={ocupado}>
      <legend>Indicadores de la recepción de China</legend>
      <label>Recepción para indicadores<select value={recepcion} onChange={e=>setRecepcion(e.target.value)}><option value="">Elige una recepción</option>{estado.recepciones.map(r=><option key={r.id}>{r.id}</option>)}</select></label>
      {seleccion && <>
        <p>Cajas de {seleccion.id}: {seleccion.cajas.join(", ")}</p>
        {seleccion.fragil && <Badge tone="neutral" style={{color:"var(--ink-soft)"}}><span aria-hidden="true">{Icon.box(18)}</span>Frágil / 易碎 · CN · Sin cobro</Badge>}
        {seleccion.marcaSinAutorizacion && <Badge tone="warning">Marca sin autorización · tarea interna</Badge>}
        <label>Motivo inventado del indicador<input value={motivo} maxLength={300} disabled={!permitido} onChange={e=>setMotivo(e.target.value)} /></label>
        {permitido && <div className={estilos.acciones}>
          <button type="button" disabled={motivo.trim().length<4} onClick={()=>void actuar({id:crypto.randomUUID(),accion:"fragil",recepcion,activo:!seleccion.fragil,motivo})}>{seleccion.fragil ? "Retirar Frágil de práctica" : "Aplicar Frágil de práctica"}</button>
          <button type="button" disabled={motivo.trim().length<4 || seleccion.marcaSinAutorizacion} onClick={()=>void actuar({id:crypto.randomUUID(),accion:"marca",recepcion,motivo})}>Registrar Marca sin autorización de práctica</button>
        </div>}
      </>}
      <details><summary>ⓘ Indicadores y disponibilidad real</summary><p>Frágil / 易碎 acompaña las cajas de esta recepción hasta Venezuela y no añade un cobro. Marca sin autorización abre una tarea interna para pedir y revisar la carta; no representa un bloqueo aduanal automático. Esta pantalla simula las reglas aprobadas de indicadores: su disponibilidad real en cada entorno depende de la entrega de SDD-0697. Aquí solo se usan motivos y documentos de muestra.</p></details>
    </fieldset>}
    {estado.recepciones.length>0 && <details><summary>Recepciones y sus cajas</summary><ul>{estado.recepciones.map(r=><li key={r.id}>{r.id} · {r.cajas.join(", ")} · {r.fragil ? "Frágil / 易碎" : "Sin Frágil"} · {r.marcaSinAutorizacion ? "Marca sin autorización" : "Sin tarea documental pendiente"}</li>)}</ul></details>}
    {estado.tareas.map(t=><fieldset key={t.id} disabled={ocupado}>
      <legend>{t.id} · Marca sin autorización</legend><p>Recepción {t.recepcion} · Estado: {t.estado}</p>
      {t.estado==="pendiente" && permitido && <button type="button" onClick={()=>void actuar({id:crypto.randomUUID(),accion:"revisar_tarea",tarea:t.id})}>Tomar tarea documental de práctica</button>}
      {t.estado==="en_revision" && <>
        <label>Evidencia documental de muestra<select value={evidencia} disabled={!permitido} onChange={e=>setEvidencia(e.target.value)}><option value="">Elige una evidencia</option><option value="PRA-CARTA-001">PRA-CARTA-001 · Carta inventada de autorización</option></select></label>
        <p>La carta es una muestra del ejercicio, sin validez ni datos de personas reales.</p>
        <label>Resolución interna inventada<input value={resolucion} maxLength={300} disabled={!permitido} onChange={e=>setResolucion(e.target.value)}/></label>
        {permitido && <button type="button" disabled={evidencia!=="PRA-CARTA-001" || resolucion.trim().length<8} onClick={()=>void actuar({id:crypto.randomUUID(),accion:"resolver_tarea",tarea:t.id,evidencia:"PRA-CARTA-001",resolucion})}>Resolver tarea documental de práctica</button>}
      </>}
      {t.estado==="resuelta" && <p>Evidencia: {t.evidencia} · Resolución: {t.resolucion}. El indicador documental fue retirado y el historial se conserva.</p>}
    </fieldset>)}
    <details><summary>Historial del ejercicio completo</summary><ol>{estado.eventos.map(e=><li key={e.id}>{e.fecha} · {e.comando.accion} · {e.id}{"motivo" in e.comando ? ` · ${e.comando.motivo}` : ""}{"resolucion" in e.comando ? ` · ${e.comando.resolucion}` : ""}</li>)}</ol></details>
  </section>;
}
