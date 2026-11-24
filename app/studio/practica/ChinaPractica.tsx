"use client";
import { useEffect, useRef, useState } from "react";
import { API_PRACTICA, type PermisoPractica } from "@/lib/studio/practica/contrato";
import type { ChinaPractica as Datos, ComandoChina } from "@/lib/studio/practica/china";
import estilos from "./practica.module.css";
import { EjercicioChina } from "./EjercicioChina";
import { COMPRA_CHINA, type ComandoEjercicioChina, type consultarEtiquetaChina } from "@/lib/studio/practica/ejercicio-china";
import { ConfirmDialog } from "@/app/studio/_components/ui/ConfirmDialog";

type Vista = { revision: number; documento: Datos; edicion: boolean; permisos: PermisoPractica[]; consulta?: ReturnType<typeof consultarEtiquetaChina> };
export function ChinaPractica({ espacio, permisos, onAbrirFactura, onReinicio, onBloqueoSalida }: { espacio: string; permisos: PermisoPractica[]; onAbrirFactura: (codigo: string) => void; onReinicio: () => void; onBloqueoSalida: (activo: boolean) => void }) {
  const [vista, setVista] = useState<Vista>();
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const bloqueo = useRef(false);
  const montado = useRef(true);
  const [permisosRespuesta, setPermisosRespuesta] = useState<{ permisos: PermisoPractica[]; estado: PermisoPractica[] }>();
  // Estado y China usan la misma autoridad de servidor: gana la verificación nueva,
  // tanto para conceder como para retirar. Una respuesta iniciada antes no la revive.
  const permisosActuales = !permisosRespuesta ? [] : (
    permisosRespuesta.estado === permisos ? permisosRespuesta.permisos : permisos
  ).filter(p => p.id === "cn" || p.id === "naviera");
  const puede = (id: string) => permisosActuales.some(p => p.id === id && p.edicion);
  const ejercicioPermitido = permisosActuales.some(p => p.id === "cn" && p.edicion && p.ejercicioCn === true);
  const puedeReiniciar = !!vista && !permisos.some(p => p.id === "invoices") && (puede("cn") || puede("naviera"));
  const aviso = useRef<HTMLParagraphElement>(null);
  const modulo = (permisosActuales.length ? permisosActuales : permisos).some(p => p.id === "cn") ? "cn" : "naviera";
  async function pedir(comando?: ComandoChina, consulta?: string) {
    if (bloqueo.current) return;
    if (comando && !(comando.accion === "reiniciar" ? puede("cn") || puede("naviera")
      : comando.accion === "consolidar" ? puede("naviera")
      : comando.accion === "ejercicio" ? ejercicioPermitido : puede("cn"))) return;
    const estadoAlPedir = permisos;
    bloqueo.current = true; onBloqueoSalida(true); setOcupado(true); setError("");
    try {
      const res = await fetch(API_PRACTICA + "china", { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", redirect: "error", body: JSON.stringify({ espacio, modulo: comando?.accion === "reiniciar" ? (permisosActuales.find(p => (p.id === "cn" || p.id === "naviera") && p.edicion)?.id ?? modulo) : comando?.accion === "consolidar" ? "naviera" : modulo, revision: vista?.revision, comando, consulta }) });
      const datos: Vista & {error?:string} = await res.json();
      if (!res.ok) {
        if(res.status===401 || res.status===403 || (res.status===503 && !comando && consulta===undefined)){setVista(undefined);setPermisosRespuesta(undefined);}
        throw new Error(datos?.error ?? "No se pudo consultar la carga.");
      }
      setVista(datos); setPermisosRespuesta({permisos:datos.permisos,estado:estadoAlPedir});
      if (comando?.accion === "reiniciar") { setConfirmar(false); onReinicio(); }
      return datos;
    } catch (e) { setError(e instanceof Error ? e.message : "Servicio indisponible."); }
    finally { bloqueo.current = false; if (montado.current) { setOcupado(false); onBloqueoSalida(false); } }
  }
  useEffect(() => {
    let vigente = true; montado.current = true;
    queueMicrotask(() => { if (vigente) void pedir(); });
    return () => { vigente = false; montado.current = false; onBloqueoSalida(false); };
  }, [espacio]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (error) aviso.current?.focus(); }, [error]);
  useEffect(() => {
    // También descarta la confirmación, para que no reaparezca al recuperar edición.
    if (!puedeReiniciar) queueMicrotask(() => setConfirmar(false));
  }, [puedeReiniciar]);
  return <section className={estilos.facturacion} aria-labelledby="titulo-china">
    <h2 id="titulo-china">Almacén China y Consolidado de práctica</h2>
    <p>Datos inventados. Cada carga conserva su envío y sus cajas al consolidarse.</p>
    <button type="button" disabled={ocupado} onClick={() => void pedir()}>Recargar cargas y permisos</button>
    {ocupado && <p role="status">Guardando o consultando tu avance…</p>}
    {error && <p ref={aviso} role="alert" tabIndex={-1}>{error}</p>}
    {vista?.documento.ejercicio && <EjercicioChina estado={vista.documento.ejercicio} ocupado={ocupado} permitido={ejercicioPermitido} onConsultar={async codigo=>(await pedir(undefined,codigo))?.consulta} onOperacion={async (operacion:ComandoEjercicioChina)=>(await pedir({accion:"ejercicio",envio:COMPRA_CHINA,operacion}))?.documento.ejercicio} />}
    <details><summary aria-label="Ayuda: recibir en China">ⓘ Recibir en China</summary><p>Recibir registra la llegada de estas cajas. La regla vigente no crea una Pre-orden al recibir: la recepción nueva queda en Almacén China y todavía no tiene un documento para facturar. Identificar una carga huérfana tampoco crea un documento financiero.</p></details>
    <details><summary aria-label="Ayuda: consolidar">ⓘ Consolidar</summary><p>Primero recibe e identifica la carga. Este ejercicio conserva las mismas cajas en PRA-CON-001. En este ejercicio, agregar al consolidado no emite otra factura. En el trabajo real, el paso de China a consolidado puede emitir una factura cuando reúne los requisitos; consulta el estado en Facturación. El caso avanzado ya trae PRA-PRE-001 preparada para practicar Facturación según tus permisos.</p></details>
    {vista && <p>{permisosActuales.map(p => `${p.id === "cn" ? "Almacén China" : "Consolidado"}: ${p.edicion ? "Consulta y edición" : "Solo consulta"}`).join(" · ")}</p>}
    {vista && <p>Tu avance está guardado. Reiniciar mi práctica restablece también estas cargas.</p>}
    {vista?.documento.cargas.map(c => <fieldset key={c.envio} disabled={ocupado}>
      <legend>{c.envio}</legend>
      <p>{c.preparada ? "Recepción avanzada preparada · Pre-orden existente PRA-PRE-001" : "Caso nuevo · Sin preorden creada al recibir"}</p>
      <p>Marca de cliente: {c.cliente ?? "Sin identificar (huérfana)"} · Estado: {c.estado}</p>
      <p>Cajas: {c.cajas.join(", ")}</p>
      {c.consolidado && <p>Consolidado: {c.consolidado}</p>}
      {c.preorden && permisos.some(p => p.id === "invoices") && <button type="button" disabled={ocupado} onClick={() => onAbrirFactura(c.preorden!)}>Revisar {c.preorden} en Facturación</button>}
      <div className={estilos.acciones}>
        {puede("cn") && <button type="button" disabled={c.estado !== "pendiente"} onClick={() => void pedir({ accion: "recibir", envio: c.envio })}>Recibir {c.envio}</button>}
        {!c.cliente && puede("cn") && <button type="button" disabled={!puede("cn") || c.estado !== "recibida"} onClick={() => void pedir({ accion: "identificar", envio: c.envio })}>Identificar con marca ficticia</button>}
        {puede("naviera") && <button type="button" disabled={c.estado !== "recibida" || !c.cliente} onClick={() => void pedir({ accion: "consolidar", envio: c.envio })}>Consolidar {c.envio}</button>}
      </div>
    </fieldset>)}
    {puedeReiniciar && <>
      <button type="button" disabled={ocupado || !(puede("cn") || puede("naviera"))} onClick={() => setConfirmar(true)}>Reiniciar mi práctica</button>
      <ConfirmDialog open={confirmar} title="Reiniciar mi práctica" message="Se restablecerán tus cargas, facturas y pagos inventados. El historial se conserva. La práctica de otras personas no cambia." danger pending={ocupado} error={error} confirmLabel="Confirmar reiniciar" onCancel={() => setConfirmar(false)} onConfirm={() => void pedir({accion:"reiniciar",envio:"espacio"})} />
    </>}
  </section>;
}
