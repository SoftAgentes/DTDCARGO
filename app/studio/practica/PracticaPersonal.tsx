"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { API_PRACTICA, AVISO_LISTO, AVISO_PASE, AVISO_ABIERTA, esToken, esVistaPractica, MODULOS_PRACTICA, type VistaPractica } from "@/lib/studio/practica/contrato";
import estilos from "./practica.module.css";
import { FacturacionPractica } from "./FacturacionPractica";
import { ChinaPractica } from "./ChinaPractica";
import { DestinoPractica } from "./DestinoPractica";
import type { ResumenDocumentoPractica } from "@/lib/studio/practica/facturacion";
import { ConfirmDialog } from "@/app/studio/_components/ui/ConfirmDialog";

const ESPACIO_DE_PESTANA = "dtd-practica-espacio";
class AccesoDenegado extends Error {}

async function operacion(nombre: string, body: object = {}, signal?: AbortSignal) {
  const respuesta = await fetch(API_PRACTICA + nombre, {
    method: "POST", credentials: "same-origin", cache: "no-store", redirect: "error",
    headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal,
  });
  if (respuesta.status === 401 || respuesta.status === 403) throw new AccesoDenegado();
  if (!respuesta.ok) throw new Error("Comprobación indisponible");
  return respuesta.json();
}

export function PracticaPersonal({ real }: { real: string }) {
  const pagina = useRef<HTMLElement>(null);
  const editor = useRef<HTMLDivElement>(null);
  const [vista, setVista] = useState<VistaPractica | null>(null);
  const [mensaje, setMensaje] = useState("Comprobando tu acceso…");
  const [saliendo, setSaliendo] = useState(false);
  const [reinicio, setReinicio] = useState(0);
  const [documentos, setDocumentos] = useState<ResumenDocumentoPractica[]>([]);
  const [documentoPedido, setDocumentoPedido] = useState<{codigo: string; id: number}>();
  const [salidaBloqueada, setSalidaBloqueada] = useState(false);
  const bloqueos = useRef({ financiero: false, operativo: false, destino: false });
  const cambiarBloqueo = useCallback((motivo: "financiero" | "operativo" | "destino", activo: boolean) => {
    bloqueos.current[motivo] = activo;
    setSalidaBloqueada(bloqueos.current.financiero || bloqueos.current.operativo || bloqueos.current.destino);
  }, []);
  const bloqueoFinanciero = useCallback((activo: boolean) => cambiarBloqueo("financiero", activo), [cambiarBloqueo]);
  const bloqueoOperativo = useCallback((activo: boolean) => cambiarBloqueo("operativo", activo), [cambiarBloqueo]);
  const bloqueoDestino = useCallback((activo: boolean) => cambiarBloqueo("destino", activo), [cambiarBloqueo]);
  const [revalidando, setRevalidando] = useState(true);
  const [falloComprobacion, setFalloComprobacion] = useState(false);
  const [confirmarSalida, setConfirmarSalida] = useState(false);
  const [cierrePendiente, setCierrePendiente] = useState(false);
  const consultaActual = useRef<AbortController | null>(null);
  const salidaEnCurso = useRef(false);
  const vistaActual = useRef<VistaPractica | null>(null);
  const focoAnterior = useRef<HTMLElement | null>(null);
  const ultimaConsulta = useRef(0);
  useLayoutEffect(() => {
    const aviso = document.querySelector<HTMLElement>("[data-entorno-prueba]");
    if (!aviso) return;
    // Reserva su altura real, también cuando cambia el texto o el viewport.
    const reservar = () => pagina.current?.style.setProperty("--practica-aviso-global", `${aviso.getBoundingClientRect().bottom}px`);
    reservar();
    const observador = new ResizeObserver(reservar);
    observador.observe(aviso, { box: "border-box" });
    window.addEventListener("resize", reservar);
    return () => { observador.disconnect(); window.removeEventListener("resize", reservar); };
  }, []);
  const consultar = useCallback(async (signal: AbortSignal) => {
    if (salidaEnCurso.current) return false;
    const turno = ++ultimaConsulta.current;
    consultaActual.current?.abort();
    const consulta = new AbortController(); consultaActual.current = consulta;
    const alCancelar = () => consulta.abort();
    signal.addEventListener("abort", alCancelar, {once:true});
    if (signal.aborted) consulta.abort();
    if (document.activeElement instanceof HTMLElement && editor.current?.contains(document.activeElement)) focoAnterior.current = document.activeElement;
    setRevalidando(true); setFalloComprobacion(false); setMensaje("");
    try {
      const espacio = sessionStorage.getItem(ESPACIO_DE_PESTANA);
      const datos: unknown = await operacion("estado", { espacio }, consulta.signal);
      if (!esVistaPractica(datos)) throw new Error("Respuesta de práctica inválida");
      if (!consulta.signal.aborted && turno === ultimaConsulta.current) {
        if (datos.espacio !== espacio) throw new AccesoDenegado();
        const anterior = vistaActual.current;
        const mismaVista = anterior !== null && anterior.espacio === datos.espacio && JSON.stringify(anterior.permisos) === JSON.stringify(datos.permisos);
        vistaActual.current = datos;
        if (!datos.permisos.some(p => p.id === "invoices")) setDocumentos([]);
        setVista(datos); setMensaje(""); setRevalidando(false);
        if (mismaVista) requestAnimationFrame(() => {
          if (turno === ultimaConsulta.current && focoAnterior.current?.isConnected && document.visibilityState === "visible") focoAnterior.current.focus({preventScroll:true});
        });
        else focoAnterior.current = null;
        return true;
      }
    } catch (error) {
      if (!consulta.signal.aborted && turno === ultimaConsulta.current) {
        if (error instanceof AccesoDenegado) {
          setVista(null); vistaActual.current = null; focoAnterior.current = null;
          setRevalidando(false); setSalidaBloqueada(false);
          setMensaje("Para abrir tu práctica, entra desde Mi perfil en el Studio real.");
        } else {
          setFalloComprobacion(true);
          setMensaje("No pudimos comprobar tu acceso. Tu edición sigue en memoria, oculta y bloqueada hasta verificar identidad y permisos.");
        }
      }
    } finally { signal.removeEventListener("abort", alCancelar); }
    return false;
  }, []);

  useEffect(() => {
    const origen: Window | null = window.opener;
    const control = new AbortController();
    let canjeado = false;
    async function recibir(evento: MessageEvent) {
      if (!origen || evento.origin !== real || evento.source !== origen || canjeado) return;
      if (evento.data?.tipo !== AVISO_PASE || !esToken(evento.data.pase)) return;
      canjeado = true;
      try {
        const datos = await operacion("canjear", { pase: evento.data.pase }, control.signal);
        if (!esVistaPractica(datos)) throw new Error("Respuesta de práctica inválida");
        if (control.signal.aborted) return;
        sessionStorage.setItem(ESPACIO_DE_PESTANA, datos.espacio);
        setVista(datos);
        vistaActual.current = datos; setRevalidando(false);
        setMensaje("");
        origen.postMessage(AVISO_ABIERTA, real);
        window.opener = null;
      } catch {
        if (!control.signal.aborted) { setRevalidando(false); setMensaje("No se pudo validar el acceso. Vuelve al Studio real e inténtalo desde tu perfil."); }
      }
    }
    function restaurar(evento: PageTransitionEvent) {
      if (evento.persisted) void consultar(control.signal);
    }
    function volverAVer() {
      if (document.visibilityState === "hidden" && document.activeElement instanceof HTMLElement && editor.current?.contains(document.activeElement)) focoAnterior.current = document.activeElement;
      if (document.visibilityState === "visible" && !window.opener) void consultar(control.signal);
    }
    document.addEventListener("visibilitychange", volverAVer);
    window.addEventListener("pageshow", restaurar);
    window.addEventListener("message", recibir);
    if (origen) origen.postMessage(AVISO_LISTO, real);
    else queueMicrotask(() => { if (!control.signal.aborted) void consultar(control.signal); });
    return () => {
      control.abort();
      consultaActual.current?.abort();
      document.removeEventListener("visibilitychange", volverAVer);
      window.removeEventListener("pageshow", restaurar);
      window.removeEventListener("message", recibir);
    };
  }, [real, consultar]);

  async function salir(descartar = false) {
    if (bloqueos.current.operativo || saliendo || (!descartar && (bloqueos.current.financiero || revalidando))) return;
    salidaEnCurso.current = true;
    ++ultimaConsulta.current; consultaActual.current?.abort();
    setConfirmarSalida(false);
    setVista(null); vistaActual.current = null; focoAnterior.current = null;
    setSalidaBloqueada(false); setRevalidando(false); setFalloComprobacion(false);
    setSaliendo(true);
    setCierrePendiente(false);
    try {
      const espacio = sessionStorage.getItem(ESPACIO_DE_PESTANA);
      if (espacio) await operacion("salir", { espacio });
      sessionStorage.removeItem(ESPACIO_DE_PESTANA);
      window.location.replace(real + "/studio/dashboard");
    } catch {
      salidaEnCurso.current = false;
      setSaliendo(false);
      setCierrePendiente(true);
      setMensaje("No se pudo confirmar el cierre remoto. La edición sin guardar se descartó; el avance guardado permanece. Puedes reintentar el cierre o volver al Studio real; la sesión de práctica podría seguir abierta hasta vencer.");
    }
  }

  return (
    <main ref={pagina} className={estilos.pagina}>
      <header className={estilos.franja}>
        <strong>Modo de prueba · Datos inventados</strong>
        <button type="button" className="studio-btn studio-btn-dark" onClick={() => void salir()} disabled={saliendo || salidaBloqueada || revalidando} title={salidaBloqueada ? "Espera la operación o guarda o descarta tus conceptos." : undefined}>
          {saliendo ? "Volviendo…" : "Volver al Studio real"}
        </button>
      </header>
      <section className={estilos.contenido} aria-labelledby="titulo-practica">
        <h1 id="titulo-practica">Mi práctica</h1>
        {mensaje && <p role="status">{mensaje}</p>}
        {cierrePendiente && <button type="button" disabled={(bloqueos.current.operativo || bloqueos.current.destino)} onClick={() => {
          if (bloqueos.current.operativo || bloqueos.current.destino) return;
          salidaEnCurso.current = true;
          ++ultimaConsulta.current; consultaActual.current?.abort();
          sessionStorage.removeItem(ESPACIO_DE_PESTANA);
          window.location.replace(real + "/studio/dashboard");
        }}>Volver sin confirmar el cierre</button>}
        {revalidando && !falloComprobacion && <p role="status">Comprobando identidad y permisos…</p>}
        {revalidando && <div>
          {falloComprobacion && <button type="button" onClick={() => void consultar(new AbortController().signal)}>Reintentar comprobación</button>}
          <button type="button" disabled={saliendo || (bloqueos.current.operativo || bloqueos.current.destino)} onClick={() => setConfirmarSalida(true)}>Descartar edición y volver al Studio real</button>
        </div>}
        {vista && <div ref={editor} inert={revalidando} style={{ visibility: revalidando ? "hidden" : "visible" }}>
          {vista.permisos.some(p => p.id === "invoices") && <FacturacionPractica key={`${vista.espacio}:${vista.permisos.find(p => p.id === "invoices")?.edicion}`} espacio={vista.espacio} suspendida={revalidando} onDocumentos={setDocumentos} onBloqueoSalida={bloqueoFinanciero} solicitudDocumento={documentoPedido} onReinicio={() => setReinicio(n => n + 1)} />}
          {vista.permisos.some(p => p.id === "cn" || p.id === "naviera" || p.id === "shipments" || p.id === "ve") && <ChinaPractica key={`china-${vista.espacio}-${reinicio}`} espacio={vista.espacio} permisos={vista.permisos} documentos={documentos} onRevalidarPermisos={() => consultar(AbortSignal.timeout(15000))} onBloqueoSalida={bloqueoOperativo} onAbrirFactura={codigo => setDocumentoPedido(actual => ({codigo,id:(actual?.id ?? 0)+1}))} onReinicio={() => setReinicio(n => n + 1)} />}
          {vista.permisos.some(p=>p.id==="shipments" || p.id==="ve") && <DestinoPractica key={`destino-${vista.espacio}-${reinicio}`} espacio={vista.espacio} permisos={vista.permisos} suspendida={salidaBloqueada || revalidando} onBloqueoSalida={bloqueoDestino} onRevalidarPermisos={()=>consultar(AbortSignal.timeout(15000))} />}
          <h2>Permisos de tu práctica</h2>
          {vista.permisos.length ? <ul className={estilos.modulos}>
            {vista.permisos.map(p => <li key={p.id}>
              <span>{MODULOS_PRACTICA.find(m => m.id === p.id)?.nombre}</span>
              <span>{p.edicion ? "Consulta y edición" : "Solo consulta"}</span>
            </li>)}
          </ul> : <p>Tu rol actual no tiene acceso a los módulos de este recorrido.</p>}
        </div>}
      </section>
      <ConfirmDialog open={confirmarSalida} title="Descartar la edición sin guardar" message="Se eliminarán los cambios que solo están en este editor. El avance ya guardado permanece en tu práctica." confirmLabel="Descartar y salir" cancelLabel="Seguir aquí" danger pending={saliendo || (bloqueos.current.operativo || bloqueos.current.destino)} onConfirm={() => void salir(true)} onCancel={() => setConfirmarSalida(false)} />
    </main>
  );
}
