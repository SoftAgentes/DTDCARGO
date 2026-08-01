"use client";

/**
 * TransportistasPanel — sub-pestaña "Transportistas" de Calculadora pública
 * (Administración · grupo PRO). SDD-0236.
 *
 * Dos cosas en una pantalla:
 *   · Quiénes son los transportistas y CUÁL cotiza la web (el predeterminado).
 *   · Cuánto cuesta cada ciudad con el que esté seleccionado.
 *
 * El precio se edita acá y se refleja en la calculadora pública SIN deploy —
 * ese era el punto de todo el modelo.
 *
 * ⚠️ La columna "Margen" es una RESTA (venta − costo), no un porcentaje. La
 * venta NO se deriva del costo: son dos números negociados por separado. Ver
 * SDD-0236 antes de "arreglar" esto con un multiplicador.
 */

import { useActionState, useMemo, useState } from "react";
import type { CarrierTariff, FreightCarrier } from "@/lib/studio/freight-carriers/types";
import {
  cbmAFt3,
  margenPorCbm,
  margenTone,
  tardaMasDeLoNormal,
} from "@/lib/studio/freight-carriers/types";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { Icon } from "@/app/studio/_components/icons";
import { setDefaultCarrierAction, type CarrierActionState } from "../../carrier-actions";

const money = (n: number) =>
  `$${n.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function TransportistasPanel({
  carriers,
  tariffs,
  cityLabels,
  isAdmin,
}: {
  carriers: FreightCarrier[];
  tariffs: CarrierTariff[];
  /** slug → nombre visible, para no mostrarle slugs al equipo. */
  cityLabels: Record<string, string>;
  isAdmin: boolean;
}) {
  const predeterminado = carriers.find((c) => c.isDefault && c.active) ?? null;
  const [seleccionado, setSeleccionado] = useState<string | null>(
    predeterminado?.id ?? carriers[0]?.id ?? null,
  );

  const delSeleccionado = useMemo(
    () =>
      tariffs
        .filter((t) => t.carrierId === seleccionado)
        .sort((a, b) =>
          (cityLabels[a.citySlug] ?? a.citySlug).localeCompare(
            cityLabels[b.citySlug] ?? b.citySlug,
            "es",
          ),
        ),
    [tariffs, seleccionado, cityLabels],
  );

  return (
    <div style={{ maxWidth: 1000 }}>
      {/* Qué está cotizando la web ahora mismo */}
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "flex-start",
          padding: "var(--s-3) var(--s-4)",
          marginBottom: 18,
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
        }}
      >
        <span style={{ color: "var(--accent)", flexShrink: 0, marginTop: 1 }}>
          {Icon.info(15)}
        </span>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "var(--ink-soft)" }}>
          {predeterminado ? (
            <>
              La calculadora del sitio cotiza el tramo nacional con{" "}
              <strong style={{ color: "var(--ink)" }}>{predeterminado.name}</strong>. El
              cliente nunca ve quién es ni cuánto nos cuesta: solo el precio de venta.
            </>
          ) : (
            <>
              <strong style={{ color: "var(--ink)" }}>No hay transportista predeterminado.</strong>{" "}
              Mientras siga así, la calculadora no cotiza el tramo nacional y deriva al
              asesor — que es lo correcto: no inventa un precio.
            </>
          )}
        </p>
      </div>

      {carriers.length === 0 ? (
        <EmptyState
          title="Todavía no hay transportistas"
          description="Registra el primero para poder cargarle su tarifario por ciudad."
        />
      ) : (
        <>
          {/* ── Los transportistas ── */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--s-2)", marginBottom: 20 }}>
            {carriers.map((c) => (
              <TarjetaTransportista
                key={c.id}
                carrier={c}
                activo={c.id === seleccionado}
                cuantasTarifas={tariffs.filter((t) => t.carrierId === c.id).length}
                isAdmin={isAdmin}
                onSeleccionar={() => setSeleccionado(c.id)}
              />
            ))}
          </div>

          {/* ── El tarifario del seleccionado ── */}
          {delSeleccionado.length === 0 ? (
            <EmptyState
              title="Este transportista no tiene tarifas cargadas"
              description="Sin tarifas, no puede cotizar ninguna ciudad."
            />
          ) : (
            <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: "var(--radius-md)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    <Th>Ciudad</Th>
                    <Th align="right">Costo /m³</Th>
                    <Th align="right">Venta /m³</Th>
                    <Th align="right">Margen /m³</Th>
                    <Th align="right">En ft³</Th>
                    <Th>Cada cuánto sale</Th>
                  </tr>
                </thead>
                <tbody>
                  {delSeleccionado.map((t) => {
                    const margen = margenPorCbm(t);
                    const tono = margenTone(margen);
                    return (
                      <tr key={t.id} style={{ borderTop: "1px solid var(--border)" }}>
                        <Td>
                          {cityLabels[t.citySlug] ?? t.citySlug}
                          {tardaMasDeLoNormal(t.dispatchFrequencyDays) && (
                            <span style={{ marginLeft: 8 }}>
                              <Badge tone="warning">cada {t.dispatchFrequencyDays} días</Badge>
                            </span>
                          )}
                        </Td>
                        <Td align="right" mono muted>
                          {money(t.costUsdCbm)}
                        </Td>
                        <Td align="right" mono>
                          {t.priceUsdCbm === 0 ? (
                            <Badge tone="neutral">sin costo</Badge>
                          ) : (
                            money(t.priceUsdCbm)
                          )}
                        </Td>
                        <Td align="right" mono>
                          <span
                            style={{
                              color:
                                tono === "negative"
                                  ? "var(--danger)"
                                  : tono === "positive"
                                    ? "var(--success)"
                                    : "var(--ink-mute)",
                            }}
                          >
                            {margen >= 0 ? "" : "−"}
                            {money(Math.abs(margen))}
                          </span>
                        </Td>
                        <Td align="right" mono muted>
                          {t.priceUsdFt3 != null
                            ? `$${t.priceUsdFt3.toFixed(2)}`
                            : `$${cbmAFt3(t.priceUsdCbm).toFixed(2)}`}
                        </Td>
                        <Td muted>{t.departureFrequency ?? "—"}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <p style={{ marginTop: 12, fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.5 }}>
            El <strong>margen es una resta</strong>, no un porcentaje: la venta se negoció
            aparte del costo y no se deriva de él. Un margen en rojo es una ciudad que DTD
            está absorbiendo a propósito.
          </p>
        </>
      )}
    </div>
  );
}

// ── Tarjeta de transportista ────────────────────────────────────

function TarjetaTransportista({
  carrier,
  activo,
  cuantasTarifas,
  isAdmin,
  onSeleccionar,
}: {
  carrier: FreightCarrier;
  activo: boolean;
  cuantasTarifas: number;
  isAdmin: boolean;
  onSeleccionar: () => void;
}) {
  const [state, action, pending] = useActionState<CarrierActionState, FormData>(
    setDefaultCarrierAction,
    {},
  );

  return (
    <div
      style={{
        border: `1px solid ${activo ? "var(--accent)" : "var(--border)"}`,
        borderRadius: "var(--radius-md)",
        padding: "var(--s-3)",
        minWidth: 230,
        background: activo ? "var(--bg-elevated)" : "var(--bg-surface)",
      }}
    >
      <button
        type="button"
        onClick={onSeleccionar}
        aria-pressed={activo}
        style={{
          background: "none",
          border: 0,
          padding: 0,
          textAlign: "left",
          cursor: "pointer",
          width: "100%",
          color: "inherit",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <strong style={{ fontSize: 14, color: "var(--ink)" }}>{carrier.name}</strong>
          {carrier.isDefault && carrier.active && <Badge tone="success">cotiza la web</Badge>}
          {!carrier.active && <Badge tone="neutral">inactivo</Badge>}
        </div>
        {carrier.legalName && (
          <div style={{ fontSize: 11.5, color: "var(--ink-mute)", marginTop: 2 }}>
            {carrier.legalName}
            {carrier.taxId ? ` · ${carrier.taxId}` : ""}
          </div>
        )}
        <div style={{ fontSize: 11.5, color: "var(--ink-soft)", marginTop: 6 }}>
          {cuantasTarifas === 0
            ? "sin tarifas cargadas"
            : `${cuantasTarifas} ciudad${cuantasTarifas === 1 ? "" : "es"} con tarifa`}
        </div>
      </button>

      {isAdmin && !carrier.isDefault && carrier.active && (
        <form action={action} style={{ marginTop: 10 }}>
          <input type="hidden" name="id" value={carrier.id} />
          <button
            type="submit"
            disabled={pending}
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--accent)",
              background: "none",
              border: 0,
              padding: 0,
              cursor: pending ? "wait" : "pointer",
              textDecoration: "underline",
              textUnderlineOffset: 2,
            }}
          >
            {pending ? "Cambiando…" : "Que este cotice la web"}
          </button>
        </form>
      )}

      {state.error && (
        <p role="alert" style={{ marginTop: 8, fontSize: 12, color: "var(--danger)" }}>
          {state.error}
        </p>
      )}
    </div>
  );
}

// ── Celdas ──────────────────────────────────────────────────────

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th
      scope="col"
      style={{
        textAlign: align,
        padding: "var(--s-2) var(--s-3)",
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: "var(--ink-mute)",
        background: "var(--bg-elevated)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
  mono = false,
  muted = false,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  mono?: boolean;
  muted?: boolean;
}) {
  return (
    <td
      style={{
        textAlign: align,
        padding: "var(--s-2) var(--s-3)",
        color: muted ? "var(--ink-mute)" : "var(--ink)",
        whiteSpace: "nowrap",
        fontFamily: mono ? "var(--font-mono)" : undefined,
        fontVariantNumeric: mono ? "tabular-nums" : undefined,
      }}
    >
      {children}
    </td>
  );
}
