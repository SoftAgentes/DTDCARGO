"use client";

/**
 * SDD-0674 · EXC-0674 — «Facturar» en un contenedor de la lista transitoria (hoy solo el 64).
 *
 * Solo se pinta si la página pasó `facturacion`, que lee en el servidor solo para accounting y
 * admin. Aquí no se decide ningún permiso. Decisiones de Sam (2026-11-18):
 *   · Por cliente y por contenedor completo, DOS confirmaciones seguidas de la misma persona («por
 *     embarque con doble confirmación que muestre los datos»): la primera, «¿Estás seguro de los
 *     datos?», con todo visible (el monto grande, las cajas y el CBM) y «Sí, los datos están bien»;
 *     la segunda vuelve a mostrar los datos, avisa que va al portal del cliente y a la contabilidad, y
 *     emite con «Confirmado». Nada se emite antes.
 *   · El monto lo teclea la persona: el TOTAL CON IVA en USD, mayor que 0 y con dos decimales como
 *     máximo. Se factura al aliado raíz si el cliente tiene uno (lo resuelve la base).
 */

import { useId, useRef, useState, useTransition } from "react";
import { fmtUsd } from "@/lib/money";
import {
  claveMarkbox,
  parsearMontoUsd,
  type FacturadoExc0674,
} from "@/lib/studio/exc0674";
import type { GrupoContenedor, ClienteDeContenedor } from "@/lib/studio/embarques-contenedores";
import { Aviso } from "@/app/studio/_components/ui/Aviso";
import { useDialogA11y } from "@/app/studio/_components/ui/drawer/useDialogA11y";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { facturarExc0674Action, type ResultadoFacturarExc0674 } from "../facturar-actions";

type Pedido = {
  modo: "cliente" | "contenedor";
  filas: { cliente: ClienteDeContenedor; centavos: number }[];
  paso: 1 | 2;
};

const TH = {
  font: "700 11px/1 var(--f-sans)",
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  color: "var(--ink-soft)",
  textAlign: "right" as const,
  padding: "var(--s-2)",
  whiteSpace: "nowrap" as const,
};
const TD = {
  font: "500 13px/1.3 var(--f-mono)",
  color: "var(--ink)",
  textAlign: "right" as const,
  padding: "var(--s-2)",
  borderTop: "1px solid var(--border)",
  whiteSpace: "nowrap" as const,
  verticalAlign: "middle" as const,
};

function cbm(c: ClienteDeContenedor): string {
  return c.stats.totalCbm.toFixed(2);
}

export function FacturarContenedor({
  grupo,
  facturados,
  accion = facturarExc0674Action,
}: {
  grupo: GrupoContenedor;
  /** Shipping Mark (MAYÚSCULAS) → lo ya facturado en este contenedor. */
  facturados: Record<string, FacturadoExc0674>;
  /** Para pruebas. */
  accion?: typeof facturarExc0674Action;
}) {
  const consolidationId = grupo.contenedor?.id ?? "";
  const clientes = grupo.clientes.filter((c) => !!c.clientMarkbox);
  const [montos, setMontos] = useState<Record<string, string>>({});
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [errorAccion, setErrorAccion] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const tituloId = useId();

  const pendientes = clientes.filter((c) => !facturados[claveMarkbox(c.clientMarkbox)]);

  function leerMonto(c: ClienteDeContenedor): number | null {
    const mb = claveMarkbox(c.clientMarkbox);
    const p = parsearMontoUsd(montos[mb] ?? "");
    if (!p.ok) {
      setErrores((e) => ({ ...e, [mb]: p.error }));
      return null;
    }
    setErrores((e) => {
      const { [mb]: _quitar, ...resto } = e;
      void _quitar;
      return resto;
    });
    return p.centavos;
  }

  function pedirCliente(c: ClienteDeContenedor) {
    const centavos = leerMonto(c);
    if (centavos === null) return;
    setErrorAccion(undefined);
    setPedido({ modo: "cliente", filas: [{ cliente: c, centavos }], paso: 1 });
  }

  function pedirContenedor() {
    const filas: Pedido["filas"] = [];
    let ok = true;
    for (const c of pendientes) {
      const centavos = leerMonto(c);
      if (centavos === null) ok = false;
      else filas.push({ cliente: c, centavos });
    }
    if (!ok || filas.length === 0) return;
    setErrorAccion(undefined);
    setPedido({ modo: "contenedor", filas, paso: 1 });
  }

  function confirmar() {
    if (!pedido) return;
    const enviados = pedido.filas.map((f) => ({
      clientMarkbox: claveMarkbox(f.cliente.clientMarkbox),
      total: (f.centavos / 100).toFixed(2),
    }));
    startTransition(async () => {
      const r: ResultadoFacturarExc0674 = await accion(consolidationId, enviados, "Confirmado");
      if (!r.ok) {
        setErrorAccion(r.error);
        return;
      }
      setPedido(null);
      setMontos((m) => {
        const n = { ...m };
        for (const e of enviados) delete n[e.clientMarkbox];
        return n;
      });
      toast.show({
        eventKey: "shipments:exc0674-invoiced",
        tone: "success",
        message:
          r.facturas.length === 1
            ? `Factura ${r.facturas[0].invoiceCode} emitida.`
            : `${r.facturas.length} facturas emitidas.`,
        priority: "normal",
        scope: "module",
        dedupeKey: `shipments:exc0674:${consolidationId}:${r.facturas.map((f) => f.invoiceCode).join(",")}`,
      });
    });
  }

  if (!consolidationId || clientes.length === 0) return null;

  return (
    <section
      aria-labelledby={tituloId}
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        padding: "var(--s-3)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--s-3)",
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "var(--s-2)" }}>
        <h3 id={tituloId} style={{ margin: 0, font: "700 14px/1.2 var(--f-sans)", color: "var(--ink)" }}>
          Facturar {grupo.nombre}
        </h3>
        <span style={{ font: "500 12px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
          Regla transitoria. Escribe el total con IVA de cada cliente, en dólares.
        </span>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontVariantNumeric: "tabular-nums", minWidth: 640 }}>
          <thead>
            <tr>
              <th scope="col" style={{ ...TH, textAlign: "left" }}>Cliente</th>
              <th scope="col" style={TH}>Cajas</th>
              <th scope="col" style={TH}>m³</th>
              <th scope="col" style={TH}>Total con IVA (USD)</th>
              <th scope="col" style={TH}>
                <span className="studio-sr-only">Acción</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {clientes.map((c) => {
              const mb = claveMarkbox(c.clientMarkbox);
              const hecho = facturados[mb];
              const inputId = `exc0674-${consolidationId}-${mb}`;
              const errId = `${inputId}-error`;
              return (
                <tr key={c.groupKey}>
                  <th scope="row" style={{ ...TD, font: "600 13px/1.3 var(--f-sans)", textAlign: "left", whiteSpace: "normal" }}>
                    {c.clientName}
                    <span style={{ marginLeft: "var(--s-2)", font: "700 11px/1 var(--f-mono)", color: "var(--wine-text)" }}>
                      {c.clientMarkbox}
                    </span>
                  </th>
                  <td style={TD}>{(c.cajas ?? 0).toLocaleString("es-VE")}</td>
                  <td style={TD}>{cbm(c)}</td>
                  {hecho ? (
                    <td style={TD} colSpan={2}>
                      Facturada {hecho.invoiceCode} · {fmtUsd(hecho.totalUsd)}
                      {hecho.billedMarkbox && hecho.billedMarkbox !== mb ? ` · a ${hecho.billedMarkbox}` : ""}
                    </td>
                  ) : (
                    <>
                      <td style={TD}>
                        <label htmlFor={inputId} className="studio-sr-only">
                          Total con IVA de {c.clientName} ({c.clientMarkbox}), en dólares
                        </label>
                        <input
                          id={inputId}
                          className="studio-input"
                          inputMode="decimal"
                          autoComplete="off"
                          placeholder="0.00"
                          value={montos[mb] ?? ""}
                          disabled={pending}
                          aria-invalid={errores[mb] ? true : undefined}
                          aria-describedby={errores[mb] ? errId : undefined}
                          onChange={(e) => setMontos((m) => ({ ...m, [mb]: e.target.value }))}
                          style={{ width: 140, textAlign: "right" }}
                        />
                        {errores[mb] && (
                          <div id={errId} role="alert" style={{ font: "500 11.5px/1.3 var(--f-sans)", color: "var(--danger)", whiteSpace: "normal", marginTop: 4 }}>
                            {errores[mb]}
                          </div>
                        )}
                      </td>
                      <td style={TD}>
                        <button
                          type="button"
                          className="studio-btn studio-btn-sm studio-btn-primary"
                          disabled={pending}
                          onClick={() => pedirCliente(c)}
                        >
                          Facturar
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pendientes.length > 1 && (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            className="studio-btn studio-btn-sm studio-btn-primary"
            disabled={pending}
            onClick={pedirContenedor}
          >
            Facturar contenedor ({pendientes.length} clientes)
          </button>
        </div>
      )}

      {pedido && (
        <Confirmacion
          grupo={grupo}
          pedido={pedido}
          pending={pending}
          error={errorAccion}
          onCancelar={() => {
            if (!pending) setPedido(null);
          }}
          onPaso2={() => setPedido((p) => (p ? { ...p, paso: 2 } : p))}
          onConfirmar={confirmar}
        />
      )}
    </section>
  );
}

function Confirmacion({
  grupo,
  pedido,
  pending,
  error,
  onCancelar,
  onPaso2,
  onConfirmar,
}: {
  grupo: GrupoContenedor;
  pedido: Pedido;
  pending: boolean;
  error?: string;
  onCancelar: () => void;
  onPaso2: () => void;
  onConfirmar: () => void;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const cancelarRef = useRef<HTMLButtonElement | null>(null);
  const tituloId = useId();
  useDialogA11y(panelRef, { onClose: onCancelar, pending, initialFocusRef: cancelarRef });

  const totalCentavos = pedido.filas.reduce((s, f) => s + f.centavos, 0);
  const n = pedido.filas.length;
  const titulo =
    pedido.paso === 1 ? "¿Estás seguro de los datos?" : n === 1 ? "Confirma la factura" : `Confirma las ${n} facturas`;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancelar();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--scrim, rgba(15, 30, 61, 0.45))",
        backdropFilter: "var(--scrim-blur)",
        WebkitBackdropFilter: "var(--scrim-blur)",
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        tabIndex={-1}
        style={{
          background: "var(--bg-surface)",
          color: "var(--ink)",
          width: "100%",
          maxWidth: 560,
          maxHeight: "calc(100dvh - 32px)",
          overflowY: "auto",
          borderRadius: "var(--r-lg)",
          border: "1px solid var(--border)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
          padding: 22,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <h2 id={tituloId} className="studio-display" style={{ margin: 0, font: "800 18px/1.2 var(--f-display)" }}>
          {titulo}
        </h2>
        <p style={{ margin: 0, font: "400 13.5px/1.5 var(--f-sans)", color: "var(--ink-soft)" }}>
          {grupo.nombre} · {n === 1 ? "1 cliente" : `${n} clientes`}. El monto es el total con IVA, en dólares.
        </p>

        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
          {pedido.filas.map(({ cliente: c, centavos }) => (
            <li
              key={c.groupKey}
              style={{
                border: "1px solid var(--border)",
                borderRadius: "var(--r-md)",
                padding: "var(--s-2) var(--s-3)",
                display: "flex",
                flexWrap: "wrap",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: "var(--s-2)",
              }}
            >
              <span style={{ font: "600 13px/1.3 var(--f-sans)" }}>
                {c.clientName}{" "}
                <span style={{ font: "700 11px/1 var(--f-mono)", color: "var(--wine-text)" }}>{c.clientMarkbox}</span>
                <span style={{ display: "block", font: "500 12px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
                  {c.stats.count.toLocaleString("es-VE")} envíos · {(c.cajas ?? 0).toLocaleString("es-VE")} cajas · {cbm(c)} m³
                </span>
              </span>
              <span
                data-testid="monto-grande"
                style={{ font: "800 24px/1.1 var(--f-mono)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}
              >
                {fmtUsd(centavos / 100)}
              </span>
            </li>
          ))}
        </ul>

        {n > 1 && (
          <p style={{ margin: 0, font: "700 14px/1.3 var(--f-sans)", textAlign: "right" }}>
            Total del contenedor: <span style={{ font: "800 20px/1.1 var(--f-mono)" }}>{fmtUsd(totalCentavos / 100)}</span>
          </p>
        )}

        {pedido.paso === 2 && (
          <Aviso tono="atencion" titulo="Va al portal del cliente y a la contabilidad">
            {n === 1 ? "Se emite la factura" : `Se emiten ${n} facturas`} en dólares, a nombre del cliente (o de su aliado
            raíz). El cliente la ve en su portal y queda asentada en contabilidad. Para corregirla después hay que anularla
            en Facturación.
          </Aviso>
        )}

        {error && (
          <Aviso tono="error" compacto>
            {error}
          </Aviso>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: 8 }}>
          <button
            ref={cancelarRef}
            type="button"
            className="studio-btn studio-btn-ghost studio-btn-sm"
            onClick={onCancelar}
            disabled={pending}
          >
            Volver
          </button>
          {pedido.paso === 1 ? (
            <button type="button" className="studio-btn studio-btn-sm studio-btn-primary" onClick={onPaso2} disabled={pending}>
              Sí, los datos están bien
            </button>
          ) : (
            <button
              type="button"
              className="studio-btn studio-btn-sm studio-btn-primary"
              onClick={onConfirmar}
              disabled={pending}
              aria-busy={pending || undefined}
            >
              {pending ? "Emitiendo…" : "Confirmado"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
