"use client";
import { useEffect, useRef, useState } from "react";
import { API_PRACTICA } from "@/lib/studio/practica/contrato";
import { totalPractica, erroresLineaPractica, type FacturacionPractica as Datos, type ComandoFactura, type LineaPractica } from "@/lib/studio/practica/facturacion";
import estilos from "./practica.module.css";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { ConfirmDialog } from "@/app/studio/_components/ui/ConfirmDialog";
import { NumericInput } from "@/app/studio/_components/ui/NumericInput";
type Vista = { revision: number; documento: Datos; edicion: boolean };
const dinero = (centavos: number) => Number.isSafeInteger(centavos) ? new Intl.NumberFormat("es-VE", { style: "currency", currency: "USD" }).format(centavos / 100) : "Importe no válido";
function Ayuda({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return <details><summary aria-label={`Ayuda: ${titulo}`}>ⓘ {titulo}</summary><p>{children}</p></details>;
}
export function FacturacionPractica({ espacio, suspendida = false, onBloqueoSalida }: { espacio: string; suspendida?: boolean; onBloqueoSalida: (bloqueada: boolean) => void }) {
  const [vista, setVista] = useState<Vista>();
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const bloqueo = useRef(false);
  const avisoError = useRef<HTMLParagraphElement>(null);
  const formulario = useRef<HTMLFormElement>(null);
  const [seleccion, setSeleccion] = useState("PRA-PRE-001");
  const [lineas, setLineas] = useState<LineaPractica[]>([]);
  const [confirmacion, setConfirmacion] = useState<"reiniciar" | "anular" | null>(null);
  const [descarte, setDescarte] = useState<string | null>(null);
  const [previa, setPrevia] = useState("");
  const [validar, setValidar] = useState(false);
  const [textoPendiente, setTextoPendiente] = useState(false);
  const [versionEditor, setVersionEditor] = useState(0);
  const secuenciaLinea = useRef(0);
  const [identificadores, setIdentificadores] = useState<number[]>([]);
  function nuevasIdentidades(cantidad: number) { return Array.from({length:cantidad}, () => ++secuenciaLinea.current); }
  async function pedir(comando?: ComandoFactura) {
    if (bloqueo.current || suspendida) return;
    bloqueo.current = true; setOcupado(true); setError("");
    try {
      const res = await fetch(API_PRACTICA + "facturacion", { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", redirect: "error", body: JSON.stringify({ espacio, revision: vista?.revision, comando }) });
      if (res.status === 401 || res.status === 403) {
        setVista(undefined); setLineas([]); setPrevia(""); setConfirmacion(null); setTextoPendiente(false);
      }
      if (res.status === 413) throw new Error("El contenido supera 24 KiB. Acorta los conceptos o el motivo y vuelve a guardar; tus cambios siguen en el editor.");
      const datos = await res.json();
      if (!res.ok) throw new Error(datos?.error ?? "No se pudo consultar la práctica.");
      setVista(datos); setPrevia(""); setConfirmacion(null);
      const cargadas = datos.documento.facturas.find((f: { codigo: string }) => f.codigo === seleccion)?.lineas ?? [];
      setLineas(cargadas); setIdentificadores(nuevasIdentidades(cargadas.length));
      setTextoPendiente(false); setVersionEditor(v => v + 1);
    } catch (e) { if (!comando) setVista(undefined); const mensaje = e instanceof Error ? e.message : "Servicio indisponible."; setError(mensaje); return { error: mensaje }; }
    finally { bloqueo.current = false; setOcupado(false); }
  }
  // El servidor revalida la identidad y los permisos en cada petición.
  useEffect(() => { void pedir(); }, [espacio]); // eslint-disable-line react-hooks/exhaustive-deps
  const factura = vista?.documento.facturas.find(f => f.codigo === seleccion);
  const editable = !!vista?.edicion && factura?.estado === "borrador";
  const sucio = !!factura && (textoPendiente || JSON.stringify(lineas) !== JSON.stringify(factura.lineas));
  useEffect(() => { onBloqueoSalida(ocupado || sucio); return () => onBloqueoSalida(false); }, [ocupado, sucio, onBloqueoSalida]);
  useEffect(() => { if (error) avisoError.current?.focus(); }, [error]);
  useEffect(() => {
    const avisar = (e: BeforeUnloadEvent) => { if (sucio) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [sucio]);
  const actuar = (accion: ComandoFactura["accion"]) => {
    if (accion === "guardar") setValidar(true);
    if (accion === "guardar" || accion === "emitir") {
      if (!formulario.current?.reportValidity() || !lineas.length || lineas.some(l => Object.values(erroresLineaPractica(l)).some(Boolean))) {
        const mensaje = "Revisa los campos señalados. Conservamos el texto para que puedas corregirlo.";
        setError(mensaje); return Promise.resolve({error:mensaje});
      }
    }
    return pedir({ accion, codigo: seleccion, lineas });
  };
  function cambiarDocumento(codigo: string) {
    const cargadas = vista?.documento.facturas.find(f => f.codigo === codigo)?.lineas ?? [];
    setSeleccion(codigo); setLineas(cargadas); setIdentificadores(nuevasIdentidades(cargadas.length));
    setPrevia(""); setConfirmacion(null); setValidar(false);
    setTextoPendiente(false); setVersionEditor(v => v + 1);
  }
  function reemplazarLineas(nuevas: LineaPractica[]) {
    setLineas(nuevas); setIdentificadores(nuevasIdentidades(nuevas.length)); setTextoPendiente(true); setVersionEditor(v => v + 1);
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
      <form ref={formulario} onSubmit={e => e.preventDefault()} onInputCapture={() => { setTextoPendiente(true); setError(""); }}>
      <fieldset disabled={!editable || ocupado || suspendida} aria-describedby="reglas-conceptos"><legend>Conceptos de la factura</legend>
        <p id="reglas-conceptos">Concepto, cantidad y precio son obligatorios. Cantidad entera; precio con hasta dos decimales.</p>
        {lineas.map((l, i) => <div key={identificadores[i]} className={estilos.linea}>
          <label>Concepto {i + 1}<input aria-invalid={validar && !!erroresLineaPractica(l).concepto} aria-describedby={validar && erroresLineaPractica(l).concepto ? `error-${i}-concepto` : undefined} maxLength={100} value={l.concepto} onChange={e => setLineas(lineas.map((v, n) => n === i ? { ...v, concepto: e.target.value } : v))} /></label>
          <label>Cantidad {i + 1}<NumericInput key={`cantidad-${seleccion}-${versionEditor}-${identificadores[i]}`} aria-label={`Cantidad ${i + 1}`} type="count" required min={1} max={10000} decimales={0} value={Number.isFinite(l.cantidad) ? l.cantidad : null} aria-invalid={validar && !!erroresLineaPractica(l).cantidad} aria-describedby={validar && erroresLineaPractica(l).cantidad ? `error-${i}-cantidad` : undefined} onChange={n => setLineas(lineas.map((v, pos) => pos === i ? {...v,cantidad:n ?? NaN} : v))} /></label>
          <label>Precio USD {i + 1}<NumericInput key={`precio-${seleccion}-${versionEditor}-${identificadores[i]}`} aria-label={`Precio USD ${i + 1}`} type="currency" currency="USD" required min={0.01} max={1000000} decimales={2} value={Number.isFinite(l.centavos) ? l.centavos / 100 : null} aria-invalid={validar && !!erroresLineaPractica(l).centavos} aria-describedby={validar && erroresLineaPractica(l).centavos ? `error-${i}-centavos` : undefined} onChange={n => setLineas(lineas.map((v, pos) => pos === i ? {...v,centavos:n === null ? NaN : Math.round(n * 100)} : v))} /></label>
          <output>Subtotal: {dinero(l.cantidad * l.centavos)}</output>
          {validar && Object.entries(erroresLineaPractica(l)).map(([campo, texto]) => texto && <p id={`error-${i}-${campo}`} key={campo} role="alert">Concepto {i + 1}: {texto}</p>)}
          <button type="button" onClick={() => { setLineas(lineas.filter((_, n) => n !== i)); setIdentificadores(identificadores.filter((_, n) => n !== i)); }}>Quitar concepto {i + 1}</button>
        </div>)}
        <button type="button" onClick={() => reemplazarLineas([{ concepto: "Carga por CBM", cantidad: 1, centavos: 25000 }, { concepto: "Sobrepeso", cantidad: 1, centavos: 5000 }])}>Repartir USD 300 en carga y sobrepeso</button>
        <button type="button" onClick={() => reemplazarLineas([{ concepto: "Carga por CBM", cantidad: 1, centavos: 20000 }, { concepto: "Sobrepeso", cantidad: 1, centavos: 5000 }, { concepto: "Artículo elegido", cantidad: 1, centavos: 5000 }])}>Repartir USD 300 en tres conceptos</button>
        <button type="button" onClick={() => { setLineas([...lineas, { concepto: "", cantidad: 1, centavos: 0 }]); setIdentificadores([...identificadores, ...nuevasIdentidades(1)]); }}>Agregar artículo elegido por ti</button>
        <p>Total propuesto: <output>{dinero(totalPractica(lineas))}</output></p>
        <ActionButton idleLabel="Guardar conceptos" loadingLabel="Guardando conceptos…" variant="primary" size="default" onAction={() => actuar("guardar")} />
      </fieldset>
      </form>
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
