"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  fmtDescuento,
  nombreListaDeAliado,
  type PriceBookOption,
} from "@/lib/studio/price-books/price-book-types";
import type { AliadoActionState } from "@/lib/studio/aliados/aliado-types";
import { guardarTarifaAliadoAction } from "../actions";

/**
 * La tarifa pactada con un aliado (SDD-0269).
 *
 * Hasta la migr 0382 esto era PROSA: la ficha decía «Tarifa fija por CBM · El
 * monto se define aparte» y ese «aparte» no existía en ningún lado. Acá vive de
 * verdad, en una lista de precios propia del aliado.
 *
 * Se pacta de dos formas, y no son excluyentes:
 *   · DESCUENTO   — un % sobre la tarifa vigente de la casa. Es lo más rápido y
 *                   se mueve solo cuando la casa sube o baja.
 *   · TARIFA PROPIA — filas suyas en /studio/tarifas. Manda donde exista.
 *
 * Un sub-aliado no pacta nada: le factura a su padre, no a DTD.
 */
export function AliadoTarifaPanel({
  aliadoId,
  markbox,
  tradeName,
  esSubAliado,
  raiz,
  book,
  canEdit,
}: {
  aliadoId: string;
  /** Shipping Mark del cliente-aliado, para revalidar su ficha. */
  markbox: string;
  tradeName: string;
  esSubAliado: boolean;
  /** El aliado raíz del que hereda, cuando éste es un sub-aliado. */
  raiz: { cadena: string; tradeName: string; markbox: string | null } | null;
  book: PriceBookOption | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);

  const [state, formAction, pending] = useActionState<AliadoActionState, FormData>(
    async (prev, fd) => {
      const res = await guardarTarifaAliadoAction(aliadoId, markbox, prev, fd);
      if (res?.ok) {
        setAbierto(false);
        router.refresh();
      }
      return res;
    },
    null,
  );

  return (
    <div
      style={{
        background: "var(--bg-base)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        padding: 12,
        marginBottom: 14,
      }}
    >
      <div
        style={{
          font: "600 11px/1.3 var(--f-sans)",
          color: "var(--ink-soft)",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          marginBottom: 8,
        }}
      >
        Tarifa pactada
      </div>

      {esSubAliado ? (
        <p style={{ font: "500 12.5px/1.45 var(--f-sans)", color: "var(--ink-soft)", margin: 0 }}>
          Hereda la tarifa de{" "}
          <b style={{ color: "var(--ink)" }}>
            {raiz ? `${raiz.cadena} · ${raiz.tradeName}` : "su aliado raíz"}
          </b>
          . Un sub-aliado le factura a su padre, no a DTD, así que no pacta tarifa
          propia con nosotros.
          {raiz?.markbox && (
            <>
              {" "}
              <Link
                href={`/studio/clientes/${encodeURIComponent(raiz.markbox)}`}
                style={{ color: "var(--ink-soft)", textDecoration: "underline" }}
              >
                ver su ficha
              </Link>
            </>
          )}
        </p>
      ) : !book ? (
        <p style={{ font: "500 12.5px/1.45 var(--f-sans)", color: "var(--ink-soft)", margin: 0 }}>
          Todavía no tiene tarifa propia:{" "}
          <b style={{ color: "var(--ink)" }}>hoy cotiza con la de la casa</b>, igual
          que un cliente directo.
        </p>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              gap: 24,
              flexWrap: "wrap",
              alignItems: "baseline",
              marginBottom: 8,
            }}
          >
            <Dato
              etiqueta="Descuento sobre la casa"
              valor={fmtDescuento(book.discountPct)}
              destacado={book.discountPct != null}
            />
            <Dato
              etiqueta="Tarifas propias"
              valor={book.tarifas === 0 ? "ninguna" : String(book.tarifas)}
              destacado={book.tarifas > 0}
            />
          </div>

          <p style={{ font: "500 12px/1.45 var(--f-sans)", color: "var(--ink-soft)", margin: 0 }}>
            {book.tarifas > 0 && book.discountPct != null ? (
              <>
                Su tarifa propia manda donde exista; donde no tenga, se le aplica el{" "}
                {fmtDescuento(book.discountPct)} sobre la de la casa.
              </>
            ) : book.tarifas > 0 ? (
              <>
                Cotiza con sus tarifas propias. Donde no tenga una, paga la de la
                casa sin descuento.
              </>
            ) : book.discountPct != null ? (
              <>
                Cotiza con la tarifa de la casa menos {fmtDescuento(book.discountPct)}.
                El piso (<i>min_charge</i>) no lleva descuento.
              </>
            ) : (
              <>
                Su lista existe pero está vacía y sin descuento: hoy cotiza igual
                que un cliente directo.
              </>
            )}
          </p>

          <Link
            href={`/studio/tarifas?book=${encodeURIComponent(book.id)}`}
            className="studio-btn studio-btn-ghost studio-btn-xs"
            style={{ marginTop: 10, display: "inline-flex" }}
          >
            {book.tarifas > 0 ? "Ver sus tarifas" : "Cargarle tarifas propias"}
          </Link>
        </>
      )}

      {!esSubAliado && canEdit && (
        <div style={{ marginTop: 10 }}>
          {!abierto ? (
            <button
              type="button"
              className="studio-btn studio-btn-ghost studio-btn-xs"
              onClick={() => setAbierto(true)}
            >
              {book ? "Editar la tarifa" : "Pactar su tarifa"}
            </button>
          ) : (
            <form action={formAction} style={{ display: "grid", gap: 10 }}>
              <div>
                <label
                  htmlFor="tarifa-descuento"
                  className="studio-label"
                  style={{ display: "block", marginBottom: 6 }}
                >
                  Descuento sobre la tarifa de la casa (%)
                </label>
                <input
                  id="tarifa-descuento"
                  name="discountPct"
                  className="studio-input"
                  defaultValue={book?.discountPct != null ? String(book.discountPct) : ""}
                  placeholder="12"
                  inputMode="decimal"
                  autoComplete="off"
                  style={{ width: 140, font: "600 15px/1.3 var(--f-mono)" }}
                />
                <p
                  style={{
                    font: "500 12px/1.4 var(--f-sans)",
                    color: "var(--ink-soft)",
                    margin: "6px 0 0",
                  }}
                >
                  Déjalo vacío si no pactaron descuento. Se aplica al precio por CBM
                  y a la tarifa flat; <b style={{ color: "var(--ink)" }}>el piso no</b>,
                  porque es un término aparte del precio.
                </p>
              </div>

              <div>
                <label
                  htmlFor="tarifa-nombre"
                  className="studio-label"
                  style={{ display: "block", marginBottom: 6 }}
                >
                  Nombre de su lista de precios
                </label>
                <input
                  id="tarifa-nombre"
                  name="bookName"
                  className="studio-input"
                  defaultValue={book?.name ?? nombreListaDeAliado(tradeName)}
                  maxLength={120}
                  style={{ width: "100%" }}
                />
              </div>

              {state?.error && (
                <p style={{ font: "500 12.5px/1.4 var(--f-sans)", color: "var(--danger)", margin: 0 }}>
                  {state.error}
                </p>
              )}

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="submit"
                  className="studio-btn studio-btn-dark studio-btn-sm"
                  disabled={pending}
                  aria-busy={pending}
                >
                  {pending ? "Guardando…" : "Guardar tarifa"}
                </button>
                <button
                  type="button"
                  className="studio-btn studio-btn-ghost studio-btn-sm"
                  onClick={() => setAbierto(false)}
                  disabled={pending}
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

function Dato({
  etiqueta,
  valor,
  destacado,
}: {
  etiqueta: string;
  valor: string;
  destacado: boolean;
}) {
  return (
    <div>
      <div
        style={{
          font: "600 10.5px/1.3 var(--f-sans)",
          color: "var(--ink-soft)",
          letterSpacing: "0.05em",
          textTransform: "uppercase",
        }}
      >
        {etiqueta}
      </div>
      <div
        style={{
          font: `${destacado ? 700 : 500} 18px/1.2 var(--f-mono)`,
          color: destacado ? "var(--ink)" : "var(--ink-soft)",
          marginTop: 2,
        }}
      >
        {valor}
      </div>
    </div>
  );
}
