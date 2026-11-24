"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { API_PRACTICA, AVISO_LISTO, AVISO_PASE, AVISO_ABIERTA, esToken, MODULOS_PRACTICA, type VistaPractica } from "@/lib/studio/practica/contrato";
import estilos from "./practica.module.css";
import { FacturacionPractica } from "./FacturacionPractica";

const ESPACIO_DE_PESTANA = "dtd-practica-espacio";

async function operacion(nombre: string, body: object = {}, signal?: AbortSignal) {
  const respuesta = await fetch(API_PRACTICA + nombre, {
    method: "POST", credentials: "same-origin", cache: "no-store", redirect: "error",
    headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal,
  });
  if (!respuesta.ok) throw new Error();
  return respuesta.json();
}

export function PracticaPersonal({ real }: { real: string }) {
  const pagina = useRef<HTMLElement>(null);
  const [vista, setVista] = useState<VistaPractica | null>(null);
  const [mensaje, setMensaje] = useState("Comprobando tu acceso…");
  const [saliendo, setSaliendo] = useState(false);
  const [salidaBloqueada, setSalidaBloqueada] = useState(false);
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
    const turno = ++ultimaConsulta.current;
    try {
      const espacio = sessionStorage.getItem(ESPACIO_DE_PESTANA);
      const datos = await operacion("estado", { espacio }, signal);
      if (!signal.aborted && turno === ultimaConsulta.current) { setVista(datos); setMensaje(""); }
    } catch {
      if (!signal.aborted && turno === ultimaConsulta.current) {
        setVista(null);
        setMensaje("Para abrir tu práctica, entra desde Mi perfil en el Studio real.");
      }
    }
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
        if (control.signal.aborted) return;
        sessionStorage.setItem(ESPACIO_DE_PESTANA, datos.espacio);
        setVista(datos);
        setMensaje("");
        origen.postMessage(AVISO_ABIERTA, real);
        window.opener = null;
      } catch {
        if (!control.signal.aborted) setMensaje("No se pudo validar el acceso. Vuelve al Studio real e inténtalo desde tu perfil.");
      }
    }
    function restaurar(evento: PageTransitionEvent) {
      if (evento.persisted) { setVista(null); void consultar(control.signal); }
    }
    function volverAVer() {
      if (document.visibilityState === "visible" && !window.opener) { setVista(null); void consultar(control.signal); }
    }
    document.addEventListener("visibilitychange", volverAVer);
    window.addEventListener("pageshow", restaurar);
    window.addEventListener("message", recibir);
    if (origen) origen.postMessage(AVISO_LISTO, real);
    else queueMicrotask(() => { if (!control.signal.aborted) void consultar(control.signal); });
    return () => {
      control.abort();
      document.removeEventListener("visibilitychange", volverAVer);
      window.removeEventListener("pageshow", restaurar);
      window.removeEventListener("message", recibir);
    };
  }, [real, consultar]);

  async function salir() {
    setSaliendo(true);
    try {
      const espacio = sessionStorage.getItem(ESPACIO_DE_PESTANA);
      if (espacio) await operacion("salir", { espacio });
      sessionStorage.removeItem(ESPACIO_DE_PESTANA);
      window.location.replace(real + "/studio/dashboard");
    } catch {
      setSaliendo(false);
      setMensaje("No se pudo cerrar la práctica. Tu avance está guardado. Vuelve a intentarlo.");
    }
  }

  return (
    <main ref={pagina} className={estilos.pagina}>
      <header className={estilos.franja}>
        <strong>Modo de prueba · Datos inventados</strong>
        <button type="button" className="studio-btn studio-btn-dark" onClick={salir} disabled={saliendo || salidaBloqueada} title={salidaBloqueada ? "Espera la operación o guarda o descarta tus conceptos." : undefined}>
          {saliendo ? "Volviendo…" : "Volver al Studio real"}
        </button>
      </header>
      <section className={estilos.contenido} aria-labelledby="titulo-practica">
        <h1 id="titulo-practica">Mi práctica</h1>
        {mensaje && <p role="status">{mensaje}</p>}
        {vista && <>
          {vista.permisos.some(p => p.id === "invoices") && <FacturacionPractica key={vista.espacio} espacio={vista.espacio} onBloqueoSalida={setSalidaBloqueada} />}
          <h2>Permisos de tu práctica</h2>
          {vista.permisos.length ? <ul className={estilos.modulos}>
            {vista.permisos.map(p => <li key={p.id}>
              <span>{MODULOS_PRACTICA.find(m => m.id === p.id)?.nombre}</span>
              <span>{p.edicion ? "Consulta y edición" : "Solo consulta"}</span>
            </li>)}
          </ul> : <p>Tu rol actual no tiene acceso a los módulos de este recorrido.</p>}
        </>}
      </section>
    </main>
  );
}
