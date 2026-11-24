"use client";
import { useEffect, useRef, useState } from "react";
import { API_PRACTICA, type PermisoPractica } from "@/lib/studio/practica/contrato";
import type { ChinaPractica as Datos, ComandoChina } from "@/lib/studio/practica/china";
import estilos from "./practica.module.css";
import { ConfirmDialog } from "@/app/studio/_components/ui/ConfirmDialog";

type Vista = { revision: number; documento: Datos; edicion: boolean; permisos: PermisoPractica[] };
export function ChinaPractica({ espacio, permisos, onAbrirFactura, onReinicio, onBloqueoSalida }: { espacio: string; permisos: PermisoPractica[]; onAbrirFactura: (codigo: string) => void; onReinicio: () => void; onBloqueoSalida: (activo: boolean) => void }) {
  const [vista, setVista] = useState<Vista>();
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const bloqueo = useRef(false);
  const montado = useRef(true);
  const [permisosActuales, setPermisosActuales] = useState<PermisoPractica[]>([]);
  const aviso = useRef<HTMLParagraphElement>(null);
  const modulo = permisosActuales.find(p => ["cn", "naviera", "shipments", "ve"].includes(p.id))?.id ?? permisos[0].id;
  async function pedir(comando?: ComandoChina) {
    if (bloqueo.current) return;
    bloqueo.current = true; onBloqueoSalida(true); setOcupado(true); setError("");
    try {
      const res = await fetch(API_PRACTICA + "china", { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", redirect: "error", body: JSON.stringify({ espacio, modulo: comando?.accion === "reiniciar" ? (permisosActuales.find(p => (p.id === "cn" || p.id === "naviera") && p.edicion)?.id ?? modulo) : comando?.accion === "consolidar" ? "naviera" : comando?.accion === "embarcar" ? "shipments" : comando && ["aduana", "recibir_ve"].includes(comando.accion) ? "ve" : modulo, revision: vista?.revision, comando }) });
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
    {vista && <p>{permisosActuales.map(p => `${p.id}: ${p.edicion ? "Consulta y edición" : "Solo consulta"}`).join(" · ")}</p>}
    {vista && <p>Tu avance está guardado. Reiniciar mi práctica restablece también estas cargas.</p>}
    {vista?.documento.cargas.map(c => <fieldset key={c.envio} disabled={ocupado}>
      <legend>{c.envio}</legend>
      <p>{c.preparada ? "Caso avanzado preparado · Documento existente" : "Caso nuevo · Sin preorden creada al recibir"}</p>
      <p>Marca de cliente: {c.cliente ?? "Sin identificar (huérfana)"} · Estado: {c.estado}</p>
      <p>Cajas: {c.cajas.join(", ")}</p>
      {c.consolidado && <p>Consolidado: {c.consolidado}</p>}
      {c.preorden && permisos.some(p => p.id === "invoices") && <button type="button" disabled={ocupado} onClick={() => onAbrirFactura(c.preorden!)}>Revisar {c.preorden} en Facturación</button>}
      {c.preorden && permisos.some(p => p.id === "invoices") && <button type="button" disabled={ocupado} onClick={() => onAbrirFactura(c.preorden!)}>Facturar · revisar {c.envio} · {c.cliente}</button>}
      <div className={estilos.acciones}>
        <button type="button" disabled={!puede("shipments") || c.estado !== "consolidada"} onClick={() => void pedir({accion:"embarcar",envio:c.envio})}>Embarcar {c.envio}</button>
        <button type="button" disabled={!puede("ve") || c.estado !== "embarcada"} onClick={() => void pedir({accion:"aduana",envio:c.envio})}>Registrar llegada a aduana</button>
        <button type="button" disabled={!puede("ve") || c.estado !== "en_aduana"} onClick={() => void pedir({accion:"recibir_ve",envio:c.envio})}>Confirmar liberación y recepción Venezuela</button>
        {puede("cn") && <button type="button" disabled={c.estado !== "pendiente"} onClick={() => void pedir({ accion: "recibir", envio: c.envio })}>Recibir {c.envio}</button>}
        {!c.cliente && puede("cn") && <button type="button" disabled={!puede("cn") || c.estado !== "recibida"} onClick={() => void pedir({ accion: "identificar", envio: c.envio })}>Identificar con marca ficticia</button>}
        {puede("naviera") && <button type="button" disabled={c.estado !== "recibida" || !c.cliente} onClick={() => void pedir({ accion: "consolidar", envio: c.envio })}>Consolidar {c.envio}</button>}
      </div>
    </fieldset>)}
    {vista && !permisos.some(p => p.id === "invoices") && (puede("cn") || puede("naviera")) && <>
      <button type="button" disabled={ocupado || !(puede("cn") || puede("naviera"))} onClick={() => setConfirmar(true)}>Reiniciar mi práctica</button>
      <ConfirmDialog open={confirmar} title="Reiniciar mi práctica" message="Se restablecerán tus cargas, facturas y pagos inventados. El historial se conserva. La práctica de otras personas no cambia." danger pending={ocupado} error={error} confirmLabel="Confirmar reiniciar" onCancel={() => setConfirmar(false)} onConfirm={() => void pedir({accion:"reiniciar",envio:"espacio"})} />
    </>}
  </section>;
}
