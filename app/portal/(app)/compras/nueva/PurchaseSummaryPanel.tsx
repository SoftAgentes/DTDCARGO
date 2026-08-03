"use client";

/**
 * SDD-0173 · El panel lateral de los pasos 2 y 3, ya con la compra registrada.
 *
 * Es el mismo lugar donde vivía "tu orden en vivo" en el paso 1, pero ahora
 * arriba manda el hecho consumado: la compra tiene código. Debajo, un checklist
 * de lo que el cliente puede adelantar — sin regaños: lo que falta se ve
 * pendiente, no en rojo, porque nada de eso es obligatorio.
 *
 * Sólo tokens `var(--*)`. Tema oscuro por default: sobre relleno wine va
 * `--color-on-accent`, nunca `text-white`.
 */

import { useState } from "react";
import { CheckIcon, DocIcon } from "@/components/Icon";
import type { PurchaseOrderLine } from "@/lib/portal/purchase-order-lines";

export type ChecklistItem = { key: string; label: string; done: boolean };

export type OrderRecap = {
  supplierName: string | null;
  lines: PurchaseOrderLine[];
};

export function PurchaseSummaryPanel({
  code,
  checklist,
  order,
  children,
}: {
  code: string;
  checklist: ChecklistItem[];
  /**
   * La orden que el cliente armó en el paso 1. Sin esto, al registrar
   * desaparecía de la pantalla lo que acababa de pedir — y en el paso 3 ya no
   * había forma de recordarlo. El Norte la conserva plegada en el panel.
   */
  order?: OrderRecap;
  /** CTA del paso (avanzar / terminar). */
  children?: React.ReactNode;
}) {
  const [orderOpen, setOrderOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <div
        className="rounded-[14px] p-4 border"
        style={{
          borderColor: "var(--color-status-success)",
          background: "var(--color-paper)",
        }}
      >
        <div className="flex items-start gap-2.5">
          <span
            className="flex-shrink-0 mt-0.5"
            style={{ color: "var(--color-status-success)" }}
          >
            <CheckIcon size={18} />
          </span>
          <div className="min-w-0">
            <div className="text-[14px] font-bold text-ink leading-[1.2]">
              Tu compra quedó registrada.
            </div>
            <div className="mt-1 text-[12px] text-grey-700">
              Código de la compra · prealerta
            </div>
            <div
              className="mt-1 text-[18px] leading-none text-ink"
              style={{
                fontFamily:
                  "var(--font-jetbrains-mono), ui-monospace, monospace",
                letterSpacing: "-0.01em",
              }}
            >
              {code}
            </div>
          </div>
        </div>
      </div>

      {order && (
        <div>
          <button
            type="button"
            onClick={() => setOrderOpen((v) => !v)}
            aria-expanded={orderOpen}
            className="w-full flex items-center justify-between gap-2 rounded-[14px] px-4 py-3 border text-left"
            style={{
              borderColor: "var(--color-wine)",
              background: "var(--color-paper)",
            }}
          >
            <span
              className="inline-flex items-center gap-2 text-[10px] font-bold tracking-[0.1em] uppercase"
              style={{ color: "var(--color-wine-text)" }}
            >
              <DocIcon size={13} /> Resumen de tu orden
            </span>
            <span
              className="text-[11px] font-bold flex-shrink-0"
              style={{ color: "var(--color-wine-text)" }}
            >
              {orderOpen ? "Ocultar" : "Revisa aquí"}
            </span>
          </button>

          {orderOpen && (
            <div
              className="mt-2 rounded-[14px] p-4 border text-[13px] leading-[1.6] text-ink"
              style={{
                borderColor: "var(--color-wine)",
                background: "var(--color-paper)",
              }}
            >
              <p className="m-0">
                Hola, DTD Cargo. Te aviso que viene mercancía de mi proveedor{" "}
                <strong>{order.supplierName?.trim() || "mi proveedor"}</strong>{" "}
                para ser enviada por barco.
              </p>
              {order.lines.length > 0 && (
                <>
                  <p className="mt-2 mb-1.5 font-bold">Aparte, pide:</p>
                  <ol className="m-0 pl-[18px] flex flex-col gap-1.5">
                    {order.lines.map((l) => (
                      <li key={l.code} className="text-[12.5px] leading-[1.5]">
                        <strong>{l.desc}</strong>
                        <span className="block mt-0.5 font-medium text-grey-700">
                          {l.fee}
                        </span>
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </div>
          )}
        </div>
      )}

      <div className="rounded-[14px] p-4 border border-grey-200">
        <div className="text-[10px] font-bold tracking-[0.1em] uppercase text-grey-500">
          Lo que puedes adelantar
        </div>
        <ul className="mt-2.5 flex flex-col gap-1.5 list-none p-0 m-0">
          {checklist.map((it) => (
            <li key={it.key} className="flex items-center gap-2">
              <span
                className="flex-shrink-0 grid place-items-center"
                style={{
                  width: 14,
                  height: 14,
                  color: it.done
                    ? "var(--color-status-success)"
                    : "var(--color-grey-500)",
                }}
              >
                {it.done ? (
                  <CheckIcon size={13} />
                ) : (
                  <span
                    className="block rounded-full"
                    style={{
                      width: 10,
                      height: 10,
                      border: "1.5px solid var(--color-grey-500)",
                    }}
                  />
                )}
              </span>
              <span
                className="text-[12.5px] leading-[1.3]"
                style={{
                  color: it.done ? "var(--color-ink)" : "var(--color-grey-700)",
                }}
              >
                {it.label}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2.5 text-[11px] text-grey-700 leading-[1.5] m-0">
          Nada de esto es obligatorio. Si lo tienes a mano, nos ayudas a
          procesar tu compra más rápido.
        </p>
      </div>

      {children}
    </div>
  );
}
