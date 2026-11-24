"use client";
import { useEffect, useRef, useState } from "react";
import { API_PRACTICA } from "@/lib/studio/practica/contrato";
import { totalPractica, erroresLineaPractica, type FacturacionPractica as Datos, type ComandoFactura, type LineaPractica } from "@/lib/studio/practica/facturacion";
import estilos from "./practica.module.css";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { ConfirmDialog } from "@/app/studio/_components/ui/ConfirmDialog";
type Vista = { revision: number; documento: Datos; edicion: boolean };
const dinero = (centavos: number) => Number.isSafeInteger(centavos) ? new Intl.NumberFormat("es-VE", { style: "currency", currency: "USD" }).format(centavos / 100) : "Importe no válido";
function Ayuda({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return <details><summary aria-label={`Ayuda: ${titulo}`}>ⓘ {titulo}</summary><p>{children}</p></details>;
}
export function FacturacionPractica({ espacio, onBloqueoSalida }: { espacio: string; onBloqueoSalida: (bloqueada: boolean) => void }) {
  const [vista, setVista] = useState<Vista>();
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const bloqueo = useRef(false);
  const avisoError = useRef<HTMLParagraphElement>(null);
  const [seleccion, setSeleccion] = useState("PRA-PRE-001");
  const [lineas, setLineas] = useState<LineaPractica[]>([]);
  const [confirmacion, setConfirmacion] = useState<"reiniciar" | "anular" | null>(null);
  const [descarte, setDescarte] = useState<string | null>(null);
  const [previa, setPrevia] = useState("");
  const [validar, setValidar] = useState(false);
  async function pedir(comando?: ComandoFactura) {
    if (bloqueo.current) return;
    bloqueo.current = true; setOcupado(true); setError("");
    try {
      const res = await fetch(API_PRACTICA + "facturacion", { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", redirect: "error", body: JSON.stringify({ espacio, revision: vista?.revision, comando }) });
      const datos = await res.json();
      if (!res.ok) throw new Error(datos?.error ?? "No se pudo consultar la práctica.");
      setVista(datos); setPrevia(""); setConfirmacion(null);
      setLineas(datos.documento.facturas.find((f: { codigo: string }) => f.codigo === seleccion)?.lineas ?? []);
    } catch (e) { if (!comando) setVista(undefined); const mensaje = e instanceof Error ? e.message : "Servicio indisponible."; setError(mensaje); return { error: mensaje }; }
    finally { bloqueo.current = false; setOcupado(false); }
  }
  // El servidor revalida la identidad y los permisos en cada petición.
  useEffect(() => { void pedir(); }, [espacio]); // eslint-disable-line react-hooks/exhaustive-deps
  const factura = vista?.documento.facturas.find(f => f.codigo === seleccion);
  const editable = !!vista?.edicion && factura?.estado === "borrador";
  const sucio = !!factura && JSON.stringify(lineas) !== JSON.stringify(factura.lineas);
  useEffect(() => { onBloqueoSalida(ocupado || sucio); return () => onBloqueoSalida(false); }, [ocupado, sucio, onBloqueoSalida]);
  useEffect(() => { if (error) avisoError.current?.focus(); }, [error]);
  useEffect(() => {
    const avisar = (e: BeforeUnloadEvent) => { if (sucio) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [sucio]);
  const actuar = (accion: ComandoFactura["accion"]) => {
    if (accion === "guardar") setValidar(true);
    return pedir({ accion, codigo: seleccion, lineas });
  };
  function cambiarDocumento(codigo: string) {
    setSeleccion(codigo); setLineas(vista?.documento.facturas.find(f => f.codigo === codigo)?.lineas ?? []);
    setPrevia(""); setConfirmacion(null); setValidar(false);
  }
  return <section aria-labelledby="titulo-facturacion" className={estilos.facturacion}>
    <h2 id="titulo-facturacion">Facturación de práctica</h2>
    <p>Solo datos inventados. Tu avance se guarda en tu copia personal.</p>
    <button type="button" disabled={ocupado} onClick={() => { if (sucio) setDescarte("recargar"); else void pedir(); }}>Recargar avance y permisos</button>
    {error && !confirmacion && <p ref={avisoError} tabIndex={-1} role="alert">{error}</p>}
    {vista && factura && <>
      <label>Documento <select aria-label="Documento" value={seleccion} disabled={ocupado} onChange={e => { if (sucio) setDescarte(e.target.value); else cambiarDocumento(e.target.value); }}>
        {vista.documento.facturas.map(f => <option key={f.codigo}>{f.codigo}</option>)}
      </select></label>
      <p><strong>{factura.codigo}</strong> · Embarque {factura.embarque} · {factura.estado}</p>
      <Ayuda titulo="Revisar el documento">PRA-PRE-001 comienza como preorden pendiente y PRA-FAC-002 comienza emitida. Revisa arriba el estado actual de cada documento. Pertenecen a embarques inventados distintos.</Ayuda>
      {!vista.edicion && <p>Tu permiso actual es de consulta.</p>}
      <fieldset disabled={!editable || ocupado} aria-describedby="reglas-conceptos"><legend>Conceptos de la factura</legend>
        <p id="reglas-conceptos">Concepto, cantidad y precio son obligatorios. Cantidad entera; precio con hasta dos decimales.</p>
        {lineas.map((l, i) => <div key={i} className={estilos.linea}>
          <label>Concepto {i + 1}<input aria-invalid={validar && !!erroresLineaPractica(l).concepto} aria-describedby={validar && erroresLineaPractica(l).concepto ? `error-${i}-concepto` : undefined} maxLength={100} value={l.concepto} onChange={e => setLineas(lineas.map((v, n) => n === i ? { ...v, concepto: e.target.value } : v))} /></label>
          <label>Cantidad {i + 1}<input aria-invalid={validar && !!erroresLineaPractica(l).cantidad} aria-describedby={validar && erroresLineaPractica(l).cantidad ? `error-${i}-cantidad` : undefined} type="number" min="1" step="1" value={l.cantidad} onChange={e => setLineas(lineas.map((v, n) => n === i ? { ...v, cantidad: Number(e.target.value) } : v))} /></label>
          <label>Precio USD {i + 1}<input aria-invalid={validar && !!erroresLineaPractica(l).centavos} aria-describedby={validar && erroresLineaPractica(l).centavos ? `error-${i}-centavos` : undefined} type="number" min="0.01" step="0.01" value={Number.isFinite(l.centavos) ? l.centavos / 100 : ""} onChange={e => { const valor = e.target.value; setLineas(lineas.map((v, n) => n === i ? { ...v, centavos: /^\d+(\.\d{0,2})?$/.test(valor) ? Math.round(Number(valor) * 100) : NaN } : v)); }} /></label>
          <output>Subtotal: {dinero(l.cantidad * l.centavos)}</output>
          {validar && Object.entries(erroresLineaPractica(l)).map(([campo, texto]) => texto && <p id={`error-${i}-${campo}`} key={campo} role="alert">Concepto {i + 1}: {texto}</p>)}
          <button type="button" onClick={() => setLineas(lineas.filter((_, n) => n !== i))}>Quitar concepto {i + 1}</button>
        </div>)}
        <button type="button" onClick={() => setLineas([{ concepto: "Carga por CBM", cantidad: 1, centavos: 25000 }, { concepto: "Sobrepeso", cantidad: 1, centavos: 5000 }])}>Repartir USD 300 en carga y sobrepeso</button>
        <button type="button" onClick={() => setLineas([{ concepto: "Carga por CBM", cantidad: 1, centavos: 20000 }, { concepto: "Sobrepeso", cantidad: 1, centavos: 5000 }, { concepto: "Artículo elegido", cantidad: 1, centavos: 5000 }])}>Repartir USD 300 en tres conceptos</button>
        <button type="button" onClick={() => setLineas([...lineas, { concepto: "", cantidad: 1, centavos: 0 }])}>Agregar artículo elegido por ti</button>
        <p>Total propuesto: <output>{dinero(totalPractica(lineas))}</output></p>
        <ActionButton idleLabel="Guardar conceptos" loadingLabel="Guardando conceptos…" variant="primary" size="default" onAction={() => actuar("guardar")} />
      </fieldset>
      {sucio && <><p>Guarda o descarta los conceptos antes de salir de la práctica.</p><button type="button" disabled={ocupado} onClick={() => setDescarte(seleccion)}>Descartar conceptos sin guardar</button></>}
      <Ayuda titulo="Corregir y agregar">Repartir conserva USD 300: carga por CBM USD 250 y sobrepeso USD 50. Agregar un artículo suma un cobro al total. Guarda los conceptos antes de emitir. Este caso usa cantidades enteras y no incluye impuestos.</Ayuda>
      <p>Total guardado: {dinero(totalPractica(factura.lineas))} · Pago ficticio: {dinero(factura.pagado)} · Saldo: {dinero(factura.estado === "anulada" ? 0 : totalPractica(factura.lineas) - factura.pagado)}</p>
      {factura.recibo && <p>Recibo ficticio: {factura.recibo}</p>}
      <div className={estilos.acciones}>
        <ActionButton idleLabel="Emitir factura ficticia" loadingLabel="Emitiendo factura…" variant="dark" size="default" disabled={!editable || ocupado || sucio} onAction={() => actuar("emitir")} />
        <ActionButton idleLabel="Pagar saldo ficticio una vez" loadingLabel="Registrando pago…" variant="dark" size="default" disabled={!vista.edicion || ocupado || factura.estado !== "emitida" || factura.pagado > 0} onAction={() => actuar("pagar")} />
        <button type="button" className="studio-btn studio-btn-danger" disabled={!vista.edicion || ocupado || factura.estado !== "emitida" || factura.pagado > 0} onClick={() => setConfirmacion("anular")}>Anular factura ficticia</button>
      </div>
      <Ayuda titulo="Emitir">La emisión fija conceptos y titular: ya no se editan ni se eliminan. Guarda y revisa los conceptos antes de emitir. La referencia ficticia de la factura queda visible.</Ayuda>
      <Ayuda titulo="Pagar">El pago de muestra crea un recibo y reduce el saldo una sola vez. No se mueve dinero real.</Ayuda>
      <Ayuda titulo="Anular y corregir una emitida">Para corregir, anula con motivo y crea otra factura; conserva la referencia a la anterior. Si hay pagos vivos, primero se anulan los cobros en Cobranzas; esa operación no forma parte de este ejercicio. El ERP también comprueba los antecedentes y el período contable antes del reverso: si lo bloquea, revisa con contabilidad. Esta semilla no tiene bloqueos contables. El original y su historia permanecen.</Ayuda>
      <button type="button" disabled={ocupado || factura.estado === "borrador"} onClick={() => setPrevia(`Simulado · Correo a cliente@ejemplo.invalid: factura ${factura.codigo}, ${factura.estado}, total ${dinero(totalPractica(factura.lineas))}. Sin envío.`)}>Vista previa de correo</button>
      <button type="button" disabled={ocupado || factura.estado === "borrador"} onClick={() => setPrevia(`Simulado · WhatsApp a Cliente ficticio de práctica: referencia ${factura.codigo}, saldo ${dinero(factura.estado === "anulada" ? 0 : totalPractica(factura.lineas) - factura.pagado)}. Sin envío.`)}>Vista previa de WhatsApp</button>
      {previa && <p role="status">{previa}</p>}
      <Ayuda titulo="Correo y WhatsApp">Estas vistas previas permanecen en la pantalla. No existen colas, proveedores ni botones de envío.</Ayuda>
      <button type="button" disabled={!vista.edicion || ocupado} onClick={() => setConfirmacion("reiniciar")}>Reiniciar mi práctica</button>
      <Ayuda titulo="Reanudar y reiniciar">Salir conserva el avance. Reiniciar restablece tus dos ejemplos y conserva el historial de ejercicios; no cambia la copia de otra persona. Cancela para conservar el avance actual.</Ayuda>
      <ConfirmDialog open={!!confirmacion} title={confirmacion === "reiniciar" ? "Reiniciar mi práctica" : "Anular factura ficticia"}
        message={confirmacion === "reiniciar" ? "Se restablecerán tus facturas y pagos ficticios. Tu historial se conserva." : `Se anulará ${factura.codigo}; el original y el motivo se conservarán.`}
        danger reason={confirmacion === "anular"} reasonRequired reasonLabel="Motivo ficticio" pending={ocupado} error={error}
        confirmLabel={`Confirmar ${confirmacion}`} onCancel={() => setConfirmacion(null)}
        onConfirm={motivo => { if (confirmacion) void pedir({accion:confirmacion,codigo:seleccion,motivo}); }} />
      <ConfirmDialog open={!!descarte} title="Descartar conceptos sin guardar" message="Los conceptos sin guardar se perderán; el documento guardado se conserva."
        confirmLabel="Descartar conceptos" pending={ocupado} onCancel={() => setDescarte(null)} onConfirm={() => {
          if (descarte === "recargar") void pedir(); else if (descarte) cambiarDocumento(descarte);
          setDescarte(null);
        }} />
      <details><summary>Historial de esta copia · generación {vista.documento.generacion}</summary><ol>{vista.documento.eventos.map((e, i) => <li key={i}>{e.fecha}: {e.accion} · {e.codigo} {e.motivo}</li>)}</ol></details>
    </>}
  </section>;
}
