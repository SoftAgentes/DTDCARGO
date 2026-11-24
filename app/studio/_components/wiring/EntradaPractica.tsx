"use client";

import { useEffect, useRef, useState } from "react";
import { API_PRACTICA, AVISO_LISTO, AVISO_PASE, AVISO_ABIERTA, RUTA_PRACTICA, esToken } from "@/lib/studio/practica/contrato";

export function EntradaPractica({ origen }: { origen: string }) {
  const [pendiente, setPendiente] = useState(false);
  const [error, setError] = useState("");
  const cancelar = useRef<(() => void) | null>(null);
  useEffect(() => () => cancelar.current?.(), []);

  function entrar() {
    if (cancelar.current) return;
    const ventana = window.open(origen + RUTA_PRACTICA, "_blank");
    if (!ventana) {
      setError("Permite abrir la pestaña de práctica y vuelve a intentarlo.");
      return;
    }
    const destino = ventana;
    const controlador = new AbortController();
    let solicitado = false;
    setError("");
    setPendiente(true);
    const reloj = window.setTimeout(() => fallo(), 30000);
    function terminar() {
      controlador.abort();
      window.clearTimeout(reloj);
      window.removeEventListener("message", recibir);
      cancelar.current = null;
    }
    function fallo() {
      terminar();
      destino.close();
      setPendiente(false);
      setError("No se pudo abrir tu práctica. Vuelve a intentarlo desde tu perfil.");
    }
    async function recibir(evento: MessageEvent) {
      if (evento.origin !== origen || evento.source !== destino) return;
      if (evento.data === AVISO_ABIERTA && solicitado) {
        terminar();
        setPendiente(false);
        return;
      }
      if (evento.data !== AVISO_LISTO || solicitado) return;
      solicitado = true;
      try {
        const resp = await fetch(API_PRACTICA + "emitir", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
          cache: "no-store", redirect: "error", signal: controlador.signal,
        });
        if (!resp.ok) throw new Error();
        const { pase } = await resp.json();
        if (!esToken(pase)) throw new Error();
        if (!controlador.signal.aborted) destino.postMessage({ tipo: AVISO_PASE, pase }, origen);
      } catch {
        if (!controlador.signal.aborted) fallo();
      }
    }
    cancelar.current = () => { terminar(); destino.close(); };
    window.addEventListener("message", recibir);
  }

  return (
    <div>
      <button className="studio-btn studio-btn-dark" type="button" onClick={entrar} disabled={pendiente}>
        {pendiente ? "Abriendo tu práctica…" : "Entrar a modo de prueba"}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
