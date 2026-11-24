"use client";
import { useEffect, useRef, useState } from "react";
import { API_PRACTICA, MODULOS_PRACTICA, type PermisoPractica } from "@/lib/studio/practica/contrato";
import type { ChinaPractica as Datos, ComandoChina } from "@/lib/studio/practica/china";
import type { ResumenDocumentoPractica } from "@/lib/studio/practica/facturacion";
import estilos from "./practica.module.css";
import { ConfirmDialog } from "@/app/studio/_components/ui/ConfirmDialog";

type Vista = { revision: number; documento: Datos; edicion: boolean; permisos: PermisoPractica[] };
export function ChinaPractica({ espacio, permisos, onAbrirFactura, onReinicio, onBloqueoSalida, documentos = [] }: { documentos?: ResumenDocumentoPractica[]; espacio: string; permisos: PermisoPractica[]; onAbrirFactura: (codigo: string) => void; onReinicio: () => void; onBloqueoSalida: (activo: boolean) => void }) {
  const [vista, setVista] = useState<Vista>();
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const bloqueo = useRef(false);
  const montado = useRef(true);
  const [permisosActuales, setPermisosActuales] = useState<PermisoPractica[]>([]);
  const aviso = useRef<HTMLParagraphElement>(null);
  const modulo = permisosActuales.find(p => ["cn", "naviera", "shipments", "ve"].includes(p.id))?.id ?? permisos.find(p => ["cn", "naviera", "shipments", "ve"].includes(p.id))!.id;
  async function pedir(comando?: ComandoChina) {
    if (bloqueo.current) return;
    bloqueo.current = true; onBloqueoSalida(true); setOcupado(true); setError("");
    try {
      const res = await fetch(API_PRACTICA + "china", { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", redirect: "error", body: JSON.stringify({ espacio, modulo: comando?.accion === "reiniciar" ? (permisosActuales.find(p => (["cn", "naviera", "shipments", "ve"].includes(p.id)) && p.edicion)?.id ?? modulo) : comando?.accion === "consolidar" ? "naviera" : comando?.accion === "embarcar" ? "shipments" : comando && ["aduana", "recibir_ve"].includes(comando.accion) ? "ve" : modulo, revision: vista?.revision, comando }) });
      const datos = await res.json();
      if (!res.ok) throw new Error(datos?.error ?? "No se pudo consultar la carga.");
      setVista(datos); setPermisosActuales(datos.permisos);
      if (comando?.accion === "reiniciar") { setConfirmar(false); onReinicio(); }
    } catch (e) { setVista(undefined); setPermisosActuales([]); setError(e instanceof Error ? e.message : "Servicio indisponible."); }
    finally { bloqueo.current = false; if (montado.current) { setOcupado(false); onBloqueoSalida(false); } }
  }
  useEffect(() => {
    let vigente = true; montado.current = true;
    queueMicrotask(() => { if (vigente) void pedir(); });
    return () => { vigente = false; montado.current = false; onBloqueoSalida(false); };
  }, [espacio]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (error) aviso.current?.focus(); }, [error]);
  const puede = (id: string) => permisosActuales.some(p => p.id === id && p.edicion);
  return <section className={estilos.facturacion} aria-labelledby="titulo-china">
    <h2 id="titulo-china">Almacén China y Consolidado de práctica</h2>
    <p>Datos inventados. Cada carga conserva su envío y sus cajas al consolidarse.</p>
    <button type="button" disabled={ocupado} onClick={() => void pedir()}>Recargar cargas y permisos</button>
    {ocupado && <p role="status">Guardando o consultando tu avance…</p>}
    {error && <p ref={aviso} role="alert" tabIndex={-1}>{error}</p>}
    <details><summary aria-label="Ayuda: recibir en China">ⓘ Recibir en China</summary><p>Recibir registra la llegada de estas cajas. La regla vigente no crea una Pre-orden al recibir: la recepción nueva queda en Almacén China y todavía no tiene un documento para facturar. Identificar una carga huérfana tampoco crea un documento financiero.</p></details>
    <details><summary aria-label="Ayuda: consolidar">ⓘ Consolidar</summary><p>Primero recibe e identifica la carga. Este ejercicio conserva las mismas cajas en PRA-CON-001. En este ejercicio, agregar al consolidado no emite otra factura. En el trabajo real, el paso de China a consolidado puede emitir una factura cuando reúne los requisitos; consulta el estado en Facturación. El caso avanzado ya trae PRA-PRE-001 preparada para practicar Facturación según tus permisos.</p></details>
    <h3>Embarques y Recepción Venezuela</h3><details><summary aria-label="Ayuda: Embarques">ⓘ Embarques</summary><p>Conserva las cajas y la preorden de la misma carga. Facturar abre el documento correcto en Facturación para revisarlo; todavía no emite. Guarda allí CBM, sobrepeso y el tercer artículo antes de confirmar. Una emitida conserva su código y sus conceptos; con pagos vivos no se anula.</p></details>
    <details><summary aria-label="Ayuda: Recepción Venezuela">ⓘ Recepción Venezuela</summary><p>Registra primero la llegada a aduana y luego la liberación y recepción en destino. Son transiciones de ejemplo, sin acciones del ERP. Salir conserva este avance. Faro no está habilitado en este destino; esta ayuda local permanece disponible.</p></details>
    <details><summary aria-label="Ayuda: Embarcar">ⓘ Embarcar</summary><p>Pasa la carga consolidada a tránsito conservando sus cajas, cliente y documento. Requiere edición de Embarques; un reintento no agrega otro evento.</p></details>
    <details><summary aria-label="Ayuda: Facturar desde Embarques">ⓘ Facturar desde Embarques</summary><p>Abre la preorden de ese cliente y envío en Facturación. El primer clic no emite. Revisa sus conceptos y confirma los datos y luego la emisión final. Cancelar conserva el documento. Una factura ya emitida muestra su estado y permite consultar el detalle.</p></details>
    <details><summary aria-label="Ayuda: Llegada a aduana">ⓘ Llegada a aduana</summary><p>Registra la llegada del embarque en tránsito. Todavía no registra su liberación. Requiere edición de Recepción Venezuela.</p></details>
    <details><summary aria-label="Ayuda: Recibir en Venezuela">ⓘ Recibir en Venezuela</summary><p>Desde aduana, confirma la liberación y recepción en destino de las mismas cajas. Espera la respuesta antes de salir; el avance se conserva al reanudar. Requiere edición de Recepción Venezuela.</p></details>
    {vista && <p>{permisosActuales.map(p => `${MODULOS_PRACTICA.find(m => m.id === p.id)?.nombre}: ${p.edicion ? "Consulta y edición" : "Solo consulta"}`).join(" · ")}</p>}
    {vista && <p>Tu avance está guardado. Reiniciar mi práctica restablece también estas cargas.</p>}
    {vista?.documento.cargas.map(c => <fieldset key={c.envio} disabled={ocupado}>
      <legend>{c.envio}</legend>
      <p>{c.preparada ? "Caso avanzado preparado · Documento existente" : "Caso nuevo · Sin preorden creada al recibir"}</p>
      <p>Marca de cliente: {c.cliente ?? "Sin identificar (huérfana)"} · Estado: {c.estado}</p>
      <p>Cajas: {c.cajas.join(", ")}</p>
      {c.consolidado && <p>Consolidado: {c.consolidado}</p>}
      {c.preorden && permisos.some(p => p.id === "invoices") && <button type="button" disabled={ocupado} onClick={() => onAbrirFactura(c.preorden!)}>Revisar {c.preorden} en Facturación</button>}
      {c.consolidado && c.preorden && documentos.some(f => f.codigo === c.preorden && f.embarque === c.envio && f.cliente === c.cliente && f.estado === "borrador") && permisos.some(p => p.id === "invoices") && <button type="button" disabled={ocupado} onClick={() => onAbrirFactura(c.preorden!)}>Facturar · revisar {c.envio} · {c.cliente}</button>}
      {permisos.some(p => p.id === "invoices") && documentos.filter(f => f.codigo === c.preorden && f.embarque === c.envio && f.estado !== "borrador").map(f => <p key={f.codigo}>Documento ficticio: {f.codigo} - {f.estado}. {f.conPagos ? "Con pagos: no se puede anular." : f.estado === "emitida" ? "Se puede anular con motivo en Facturaci\u00f3n; los conceptos se conservan." : "El original permanece en el historial."}</p>)}
      <div className={estilos.acciones}>
        {puede("shipments") && <button type="button" disabled={c.estado !== "consolidada"} onClick={() => void pedir({accion:"embarcar",envio:c.envio})}>Embarcar {c.envio}</button>}
        {puede("ve") && <button type="button" disabled={c.estado !== "embarcada"} onClick={() => void pedir({accion:"aduana",envio:c.envio})}>Registrar llegada a aduana</button>}
        {puede("ve") && <button type="button" disabled={c.estado !== "en_aduana"} onClick={() => void pedir({accion:"recibir_ve",envio:c.envio})}>Confirmar liberación y recepción Venezuela</button>}
        {puede("cn") && <button type="button" disabled={c.estado !== "pendiente"} onClick={() => void pedir({ accion: "recibir", envio: c.envio })}>Recibir {c.envio}</button>}
        {!c.cliente && puede("cn") && <button type="button" disabled={!puede("cn") || c.estado !== "recibida"} onClick={() => void pedir({ accion: "identificar", envio: c.envio })}>Identificar con marca ficticia</button>}
        {puede("naviera") && <button type="button" disabled={c.estado !== "recibida" || !c.cliente} onClick={() => void pedir({ accion: "consolidar", envio: c.envio })}>Consolidar {c.envio}</button>}
      </div>
    </fieldset>)}
    {vista && !permisos.some(p => p.id === "invoices") && (puede("cn") || puede("naviera") || puede("shipments") || puede("ve")) && <>
      <button type="button" disabled={ocupado || !(puede("cn") || puede("naviera") || puede("shipments") || puede("ve"))} onClick={() => setConfirmar(true)}>Reiniciar mi práctica</button>
      <ConfirmDialog open={confirmar} title="Reiniciar mi práctica" message="Se restablecerán tus cargas, facturas y pagos inventados. El historial se conserva. La práctica de otras personas no cambia." danger pending={ocupado} error={error} confirmLabel="Confirmar reiniciar" onCancel={() => setConfirmar(false)} onConfirm={() => void pedir({accion:"reiniciar",envio:"espacio"})} />
    </>}
  </section>;
}
