"use client";
import { useEffect, useRef, useState } from "react";
import { API_PRACTICA, type PermisoPractica } from "@/lib/studio/practica/contrato";
import type { ChinaPractica as Datos, ComandoChina } from "@/lib/studio/practica/china";
import estilos from "./practica.module.css";

type Vista = { revision: number; documento: Datos; edicion: boolean };
export function ChinaPractica({ espacio, permisos }: { espacio: string; permisos: PermisoPractica[] }) {
  const [vista, setVista] = useState<Vista>();
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const bloqueo = useRef(false);
  const aviso = useRef<HTMLParagraphElement>(null);
  const modulo = permisos.some(p => p.id === "cn") ? "cn" : "naviera";
  async function pedir(comando?: ComandoChina) {
    if (bloqueo.current) return;
    bloqueo.current = true; setOcupado(true); setError("");
    try {
      const res = await fetch(API_PRACTICA + "china", { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", redirect: "error", body: JSON.stringify({ espacio, modulo: comando?.accion === "consolidar" ? "naviera" : modulo, revision: vista?.revision, comando }) });
      const datos = await res.json();
      if (!res.ok) throw new Error(datos?.error ?? "No se pudo consultar la carga.");
      setVista(datos);
    } catch (e) { setVista(undefined); setError(e instanceof Error ? e.message : "Servicio indisponible."); }
    finally { bloqueo.current = false; setOcupado(false); }
  }
  useEffect(() => {
    let vigente = true;
    queueMicrotask(() => { if (vigente) void pedir(); });
    return () => { vigente = false; };
  }, [espacio]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (error) aviso.current?.focus(); }, [error]);
  const puede = (id: string) => permisos.some(p => p.id === id && p.edicion);
  return <section className={estilos.facturacion} aria-labelledby="titulo-china">
    <h2 id="titulo-china">Almacén China y Consolidado de práctica</h2>
    <p>Datos inventados. Cada carga conserva su envío y sus cajas al consolidarse.</p>
    <button type="button" disabled={ocupado} onClick={() => void pedir()}>Recargar cargas y permisos</button>
    {ocupado && <p role="status">Guardando o consultando tu avance…</p>}
    {error && <p ref={aviso} role="alert" tabIndex={-1}>{error}</p>}
    <details><summary aria-label="Ayuda: recibir en China">ⓘ Recibir en China</summary><p>Recibir registra la llegada de estas cajas. La regla vigente no crea una Pre-orden al recibir: los seis casos ensayados no crearon facturas ni borradores. La preorden inmediata es un criterio pendiente de decisión. Identificar una carga huérfana tampoco crea un documento financiero.</p></details>
    <details><summary aria-label="Ayuda: consolidar">ⓘ Consolidar</summary><p>Primero recibe e identifica la carga. Este ejercicio conserva las mismas cajas en PRA-CON-001. El ERP puede autoemitir al consolidar si cumple sus requisitos; esta práctica no reproduce esa emisión condicional. No crea otra factura. El caso avanzado ya trae PRA-PRE-001 preparada para practicar Facturación según tus permisos.</p></details>
    {vista && <p>Generación {vista.documento.generacion} · revisión {vista.revision}. Reiniciar mi práctica en Facturación restablece también estas cargas; recarga para ver el nuevo comienzo.</p>}
    {vista?.documento.cargas.map(c => <fieldset key={c.envio} disabled={ocupado}>
      <legend>{c.envio}</legend>
      <p>{c.preparada ? "Recepción avanzada preparada · Pre-orden existente PRA-PRE-001" : "Caso nuevo · Sin preorden creada al recibir"}</p>
      <p>Marca de cliente: {c.cliente ?? "Sin identificar (huérfana)"} · Estado: {c.estado}</p>
      <p>Cajas: {c.cajas.join(", ")}</p>
      {c.consolidado && <p>Consolidado: {c.consolidado}</p>}
      {c.preorden && permisos.some(p => p.id === "invoices") && <a href="#titulo-facturacion">Revisar {c.preorden} en Facturación</a>}
      <div className={estilos.acciones}>
        <button type="button" disabled={!puede("cn") || c.estado !== "pendiente"} onClick={() => void pedir({ accion: "recibir", envio: c.envio })}>Recibir {c.envio}</button>
        {!c.cliente && <button type="button" disabled={!puede("cn") || c.estado !== "recibida"} onClick={() => void pedir({ accion: "identificar", envio: c.envio })}>Identificar con marca ficticia</button>}
        <button type="button" disabled={!puede("naviera") || c.estado !== "recibida" || !c.cliente} onClick={() => void pedir({ accion: "consolidar", envio: c.envio })}>Consolidar {c.envio}</button>
      </div>
    </fieldset>)}
  </section>;
}
