"use client";

import { useState } from "react";
import Link from "next/link";
import { buildChinaSupplierClipText } from "@/components/ChinaSupplierClip";
import { partesCodigo, type ProveedorSimple } from "@/lib/portal/simple/bloques";
import { EVENTO_ABRIR_TUTORIAL } from "@/lib/portal/simple/eventos";
import { Ayuda, Glosario } from "./Ayuda";

/**
 * SDD-0654 fase 2 · Bloque 5: «¿Vas a comprar en China? Envíale esto a tu
 * proveedor» (§6, AC-13, AC-14).
 *
 *   A · El cliente elige uno de SUS proveedores: no hay campo para escribir un
 *       número (no se inventa el «proveedor 5»).
 *   B · El código de esa compra, parte por parte, explicado con sus datos. Es el
 *       `nextCode` que calcula `summarizeSuppliers`, el mismo de «Mis compras».
 *   C · El mismo mensaje que «Mis compras» (`buildChinaSupplierClipText`), con
 *       ese código. Copiar no registra la compra: lo dice y enlaza a «Nueva
 *       compra» (D-13).
 *
 * La selección va en tinta (BD-037); el vino claro solo pinta la parte
 * «proveedor» del código y el número de su fila (EXC-0654-01).
 */
type Parte = "prefijo" | "cliente" | "proveedor" | "compra";

function veces(n: number): string {
  return n === 1 ? "1 vez" : `${n} veces`;
}

export function BloqueProveedor({ proveedores, markbox }: { proveedores: ProveedorSimple[]; markbox: string }) {
  const [elegidoId, setElegidoId] = useState<string | null>(proveedores[0]?.id ?? null);
  const [parte, setParte] = useState<Parte | null>(null);
  const [copiado, setCopiado] = useState<"" | "ok" | "error">("");

  const elegido = proveedores.find((p) => p.id === elegidoId) ?? null;
  const partes = elegido ? partesCodigo(elegido.codigo) : null;
  const mensaje = elegido ? buildChinaSupplierClipText(elegido.codigo) : "";

  function explicar(p: Parte): string {
    if (!elegido || !partes) return "";
    switch (p) {
      case "prefijo":
        return `${partes.prefijo} · DTD Cargo: le dice al almacén que la caja es nuestra.`;
      case "cliente":
        return `${partes.cliente} · tú: es tu número de cliente. Con «DTD» adelante forma tu Shipping Mark ${markbox}.`;
      case "proveedor":
        return `${partes.proveedor} · tu proveedor: es ${elegido.nombre}.`;
      case "compra":
        return elegido.compras === 0
          ? `${partes.compra} · la compra: es tu primera compra a ${elegido.nombre}.`
          : `${partes.compra} · la compra: ya le compraste ${veces(elegido.compras)}; esta es la número ${partes.compra}.`;
    }
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(mensaje);
      setCopiado("ok");
    } catch {
      setCopiado("error");
    }
  }

  const botonParte = (p: Parte, texto: string, ancla: string, clase = "") => (
    <button
      type="button"
      data-guia={ancla}
      aria-pressed={parte === p}
      onClick={() => setParte(p)}
      className={`vs-codigo-parte ${clase} inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[10px] px-3 font-mono text-[18px] font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink`}
    >
      {texto}
    </button>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[15px] leading-[1.55]">
          Cada caja lleva un código. Nos dice de quién es, de cuál proveedor viene y cuál compra es.
        </p>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event(EVENTO_ABRIR_TUTORIAL))}
          disabled={!elegido}
          className="vs-btn-secundario"
        >
          Ver el tutorial del código (1 minuto)
        </button>
      </div>

      {/* A · ¿A cuál proveedor le vas a comprar? */}
      <div className="flex flex-col gap-2">
        <h3 className="text-[15px] font-extrabold">A · Elige a tu proveedor</h3>
        {proveedores.length === 0 ? (
          <p className="text-[15px] leading-[1.55]">
            Todavía no tienes proveedores registrados. Regístralo primero en «Mis compras» y aquí te damos su
            código.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5" data-guia="proveedores" aria-label="Tus proveedores">
            {proveedores.map((p) => {
              const activo = p.id === elegidoId;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    aria-pressed={activo}
                    onClick={() => {
                      setElegidoId(p.id);
                      setParte(null);
                      setCopiado("");
                    }}
                    className={`vs-proveedor flex min-h-[44px] w-full items-center gap-3 rounded-[12px] px-3 py-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${activo ? "vs-proveedor-activo" : ""}`}
                  >
                    <span className="vs-codigo-proveedor inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2 font-mono text-[15px] font-bold">
                      {p.numero}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-bold">{p.nombre}</span>
                      <span className="block text-[13px] text-grey-700">
                        {p.compras === 0 ? "Todavía no le has comprado" : `Le compraste ${veces(p.compras)}`}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <Link href="/portal/proveedores" className="text-[15px] font-bold text-ink underline underline-offset-2">
          + Es un proveedor nuevo: regístralo primero
        </Link>
      </div>

      {elegido && (
        <>
          {/* B · El código para esa compra, parte por parte. */}
          <div className="flex flex-col gap-2">
            <h3 className="text-[15px] font-extrabold">B · Este es su código. Toca cada parte</h3>
            {partes ? (
              <div className="flex flex-wrap items-center gap-1.5" aria-label={`Código ${elegido.codigo}`} role="group">
                {botonParte("prefijo", partes.prefijo, "codigo-dtd")}
                <span aria-hidden="true">-</span>
                {botonParte("cliente", partes.cliente, "codigo-cliente")}
                <span aria-hidden="true">-</span>
                {botonParte("proveedor", partes.proveedor, "codigo-proveedor", "vs-codigo-proveedor")}
                <span aria-hidden="true">-</span>
                {botonParte("compra", partes.compra, "codigo-compra", "vs-codigo-compra")}
              </div>
            ) : (
              <p className="font-mono text-[18px] font-bold">{elegido.codigo}</p>
            )}
            <p role="status" aria-live="polite" className="min-h-[1.5em] text-[15px] leading-[1.55]">
              {parte ? explicar(parte) : "Toca una parte del código y te decimos qué significa."}
            </p>
          </div>

          {/* C · El mensaje listo para copiar. */}
          <div className="flex flex-col gap-2">
            <h3 className="text-[15px] font-extrabold">C · Copia el mensaje y envíaselo</h3>
            <pre
              data-guia="mensaje"
              className="vs-mensaje whitespace-pre-wrap break-words rounded-[12px] p-3 text-[14px] leading-[1.6]"
            >
              {mensaje}
            </pre>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={copiar} className="vs-btn-principal">
                Copiar mensaje
              </button>
              <span role="status" aria-live="polite" className="text-[14px] font-semibold">
                {copiado === "ok" ? "Copiado." : copiado === "error" ? "No se pudo copiar. Selecciona el texto y cópialo." : ""}
              </span>
            </div>
            <p className="text-[14px] leading-[1.55] text-grey-700">
              <b>Copiar no registra tu compra.</b> Cuando tu proveedor confirme, avísala con{" "}
              <Link href="/portal/compras/nueva" className="font-bold text-ink underline underline-offset-2">
                «Nueva compra»
              </Link>{" "}
              para que el código quede tuyo.
            </p>
          </div>
        </>
      )}

      <Ayuda tipo="atencion">
        No inventes el número del proveedor: si no está en tu lista, regístralo primero. Y pídele una foto de la caja
        ya marcada.
      </Ayuda>
      <Glosario id="shipping-mark" />
      <Glosario id="prealerta" />
    </div>
  );
}
