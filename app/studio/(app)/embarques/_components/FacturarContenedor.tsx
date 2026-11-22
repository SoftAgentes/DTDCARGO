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
 *
 * SDD-0690 (Sam, 2026-11-20):
 *   · Un cliente con pre-orden (los precios del Excel) no teclea nada: «Facturar» emite la pre-orden tal
 *     como está. El precio se corrige en Facturación, no aquí. El código lleva a la pre-orden.
 *   · «Facturar todo» emite todas las pre-órdenes pendientes del contenedor en una sola llamada.
 *   · Un cliente sin pre-orden (sin precio en el Excel) sigue con el monto tecleado.
 *   · Con todos los clientes facturados: «Facturado», sin botones.
 *   · En pantalla se dice «pre-orden», nunca «borrador».
 *   · Todo se calcula sobre el contenedor ENTERO (`grupo.completo.clientes`), no sobre lo que dejó el
 *     filtro: si no, un cliente con pre-orden cuyo envío quedó fuera de la búsqueda se ofrecería a
 *     teclear y la pre-orden seguiría viva (revisión de la 0690).
 *   · Una pre-orden en $0 o en otra moneda no se emite ni se teclea: se corrige en Facturación.
 */

import Link from "next/link";
import { useId, useRef, useState, useTransition } from "react";
import { fmtUsd } from "@/lib/money";
import {
  claveMarkbox,
  parsearMontoUsd,
  type FacturadoExc0674,
} from "@/lib/studio/exc0674";
import type { GrupoContenedor, ClienteDeContenedor } from "@/lib/studio/embarques-contenedores";
import { Aviso } from "@/app/studio/_components/ui/Aviso";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { useDialogA11y } from "@/app/studio/_components/ui/drawer/useDialogA11y";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import {
  emitirPreordenesExc0674Action,
  facturarExc0674Action,
  type ResultadoFacturarExc0674,
} from "../facturar-actions";

/** SDD-0690: la pre-orden pendiente de un cliente. `totalUsd` null = no está en USD. */
export type PreordenDeCliente = { invoiceId: string; invoiceCode: string; totalUsd: number | null };

/** Se emite desde Embarques solo si está en USD y es mayor que 0. */
function preordenValida(po: PreordenDeCliente): po is PreordenDeCliente & { totalUsd: number } {
  return po.totalUsd != null && po.totalUsd > 0;
}

function hrefFacturacion(codigo: string): string {
  return `/studio/facturacion/${encodeURIComponent(codigo)}`;
}

type Pedido = {
  modo: "cliente" | "contenedor";
  /** SDD-0690: `preorden` emite pre-órdenes existentes; `tecleado`, el monto escrito (0564). */
  origen: "preorden" | "tecleado";
  filas: { cliente: ClienteDeContenedor; centavos: number; invoiceId?: string }[];
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
  preordenes = {},
  accion = facturarExc0674Action,
  accionPreordenes = emitirPreordenesExc0674Action,
}: {
  grupo: GrupoContenedor;
  /** Shipping Mark (MAYÚSCULAS) → lo ya facturado en este contenedor. */
  facturados: Record<string, FacturadoExc0674>;
  /** SDD-0690 · Shipping Mark (MAYÚSCULAS) → su pre-orden pendiente en USD. */
  preordenes?: Record<string, PreordenDeCliente>;
  /** Para pruebas. */
  accion?: typeof facturarExc0674Action;
  accionPreordenes?: typeof emitirPreordenesExc0674Action;
}) {
  const consolidationId = grupo.contenedor?.id ?? "";
  // El contenedor entero, sin la pestaña ni la búsqueda.
  const clientes = grupo.completo.clientes.filter((c) => !!c.clientMarkbox);
  const [montos, setMontos] = useState<Record<string, string>>({});
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [errorAccion, setErrorAccion] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const tituloId = useId();

  const pendientes = clientes.filter((c) => !facturados[claveMarkbox(c.clientMarkbox)]);
  const preordenDe = (c: ClienteDeContenedor) => preordenes[claveMarkbox(c.clientMarkbox)];
  const conPreorden = pendientes.filter((c) => {
    const po = preordenDe(c);
    return !!po && preordenValida(po);
  });
  // Un cliente con cualquier pre-orden viva (válida o no) NUNCA va al camino tecleado.
  const tecleados = pendientes.filter((c) => !preordenDe(c));

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

  function filaDePreorden(c: ClienteDeContenedor): Pedido["filas"][number] {
    const po = preordenDe(c);
    return { cliente: c, centavos: Math.round((po?.totalUsd ?? 0) * 100), invoiceId: po?.invoiceId };
  }

  function pedirCliente(c: ClienteDeContenedor) {
    setErrorAccion(undefined);
    const po = preordenDe(c);
    if (po) {
      if (!preordenValida(po)) return;
      setPedido({ modo: "cliente", origen: "preorden", filas: [filaDePreorden(c)], paso: 1 });
      return;
    }
    const centavos = leerMonto(c);
    if (centavos === null) return;
    setPedido({ modo: "cliente", origen: "tecleado", filas: [{ cliente: c, centavos }], paso: 1 });
  }

  /** SDD-0690 · «Facturar todo»: todas las pre-órdenes pendientes, en una sola llamada. */
  function pedirTodo() {
    if (conPreorden.length === 0) return;
    setErrorAccion(undefined);
    setPedido({ modo: "contenedor", origen: "preorden", filas: conPreorden.map(filaDePreorden), paso: 1 });
  }

  function pedirContenedor() {
    const filas: Pedido["filas"] = [];
    let ok = true;
    for (const c of tecleados) {
      const centavos = leerMonto(c);
      if (centavos === null) ok = false;
      else filas.push({ cliente: c, centavos });
    }
    if (!ok || filas.length === 0) return;
    setErrorAccion(undefined);
    setPedido({ modo: "contenedor", origen: "tecleado", filas, paso: 1 });
  }

  function confirmar() {
    if (!pedido) return;
    const enviados = pedido.filas.map((f) => ({
      clientMarkbox: claveMarkbox(f.cliente.clientMarkbox),
      total: (f.centavos / 100).toFixed(2),
    }));
    const origen = pedido.origen;
    const ids = pedido.filas.map((f) => f.invoiceId).filter((x): x is string => !!x);
    startTransition(async () => {
      const r: ResultadoFacturarExc0674 =
        origen === "preorden"
          ? await accionPreordenes(consolidationId, ids, "Confirmado")
          : await accion(consolidationId, enviados, "Confirmado");
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
          {pendientes.length === 0
            ? "Todos los clientes tienen su factura."
            : tecleados.length === 0
              ? "Regla transitoria. Se emite la pre-orden de cada cliente; el precio se corrige en Facturación."
              : "Regla transitoria. Con pre-orden se emite su precio; sin pre-orden, escribe el total con IVA en dólares."}
        </span>
        {pendientes.length === 0 && (
          <span data-testid="contenedor-facturado">
            <Badge tone="success" size="sm">
              Facturado
            </Badge>
          </span>
        )}
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
              const po = preordenes[mb];
              const inputId = `exc0674-${consolidationId}-${mb}`;
              const errId = `${inputId}-error`;
              return (
                <tr key={c.groupKey}>
                  <th scope="row" style={{ ...TD, font: "600 13px/1.3 var(--f-sans)", textAlign: "left", whiteSpace: "normal" }}>
                    {c.clientName}
                    <span style={{ marginLeft: "var(--s-2)", font: "700 11px/1 var(--f-mono)", color: "var(--ink)" }}>
                      {c.clientMarkbox}
                    </span>
                  </th>
                  <td style={TD}>{(c.cajas ?? 0).toLocaleString("es-VE")}</td>
                  <td style={TD}>{cbm(c)}</td>
                  {hecho ? (
                    <td style={TD} colSpan={2}>
                      Facturada{" "}
                      <Link
                        href={hrefFacturacion(hecho.invoiceCode)}
                        className="emb-doc-link"
                        title={`Abrir la factura ${hecho.invoiceCode} en Facturación`}
                      >
                        {hecho.invoiceCode}
                      </Link>{" "}
                      · {fmtUsd(hecho.totalUsd)}
                      {hecho.billedMarkbox && hecho.billedMarkbox !== mb ? ` · a ${hecho.billedMarkbox}` : ""}
                    </td>
                  ) : po && !preordenValida(po) ? (
                    <td style={{ ...TD, whiteSpace: "normal" }} colSpan={2} data-testid={`preorden-invalida-${mb}`}>
                      <span style={{ font: "600 12.5px/1.4 var(--f-sans)", color: "var(--ink)" }}>
                        Pre-orden sin monto válido: corrígela en Facturación.
                      </span>{" "}
                      <Link
                        href={hrefFacturacion(po.invoiceCode)}
                        className="emb-doc-link"
                        title={`Abrir la pre-orden ${po.invoiceCode} en Facturación`}
                      >
                        Pre-orden {po.invoiceCode}
                      </Link>
                    </td>
                  ) : po ? (
                    <>
                      <td style={TD}>
                        <Link
                          href={hrefFacturacion(po.invoiceCode)}
                          className="emb-doc-link"
                          title={`Abrir la pre-orden ${po.invoiceCode} en Facturación`}
                        >
                          {fmtUsd(po.totalUsd ?? 0)}
                        </Link>
                        <span style={{ display: "block", font: "500 11px/1.3 var(--f-sans)", color: "var(--ink-soft)" }}>
                          Pre-orden {po.invoiceCode}
                        </span>
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

      {(conPreorden.length > 0 || tecleados.length > 1) && (
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: "var(--s-2)" }}>
          {/* Sin pre-órdenes queda el «contenedor completo» tecleado de la 0674. Con pre-órdenes,
              «Facturar todo» las emite; los clientes sin precio se facturan uno por uno. */}
          {conPreorden.length === 0 && tecleados.length > 1 && (
            <button
              type="button"
              className="studio-btn studio-btn-sm studio-btn-primary"
              disabled={pending}
              onClick={pedirContenedor}
            >
              Facturar contenedor ({tecleados.length} clientes)
            </button>
          )}
          {conPreorden.length > 0 && (
            <button
              type="button"
              className="studio-btn studio-btn-sm studio-btn-primary"
              disabled={pending}
              onClick={pedirTodo}
            >
              Facturar todo ({conPreorden.length === 1 ? "1 pre-orden" : `${conPreorden.length} pre-órdenes`})
            </button>
          )}
        </div>
      )}
      <style>{`
        .emb-doc-link { color: var(--accion-text); font-weight: 700; text-decoration: none; border-radius: var(--r-sm); }
        .emb-doc-link:hover { text-decoration: underline; }
        .emb-doc-link:focus-visible { outline: 2px solid var(--accion); outline-offset: 2px; }
      `}</style>

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
          {grupo.nombre} · {n === 1 ? "1 cliente" : `${n} clientes`}.{" "}
          {pedido.origen === "preorden"
            ? "Se emite la pre-orden tal como está, con los precios del Excel. Para cambiar un precio, corrígelo antes en Facturación."
            : "El monto es el total con IVA, en dólares."}
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
                <span style={{ font: "700 11px/1 var(--f-mono)", color: "var(--ink)" }}>{c.clientMarkbox}</span>
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
            {pedido.origen === "preorden"
              ? n === 1
                ? "La pre-orden pasa a factura"
                : `Las ${n} pre-órdenes pasan a factura`
              : n === 1
                ? "Se emite la factura"
                : `Se emiten ${n} facturas`}{" "}
            en dólares, a nombre del cliente (o de su aliado raíz). El cliente la ve en su portal y queda asentada en contabilidad. Para corregirla después hay que anularla
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
