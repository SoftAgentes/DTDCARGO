"use client";

/**
 * Por facturar (SDD-0574) — las tarjetas de «Embarques sin facturar» en
 * Dirección: lo que llegó sin factura (la factura sale al llegar, decisión 9),
 * lo que no tiene tarifa congelada y lo que va en camino con tarifa. Cada
 * celda lleva al reporte. Solo tokens var(--*).
 */

import Link from "next/link";
import { Icon } from "@/app/studio/_components/icons";
import type { ImporteUsdExacto, ResumenSinFacturar, TotalesSinFacturar } from "@/lib/studio/rate-snapshots/sin-facturar";
import { MiniStat } from "./MiniStat";

const REPORTE = "/studio/reportes/embarques-sin-facturar";

/** Solo presentación del decimal exacto; no importa consultas al cliente. */
function fmtTotalUsd(importe: ImporteUsdExacto): string {
  const [entero, centavos] = importe.split(".");
  return `$${entero.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${centavos}`;
}

function textoImporte(total: TotalesSinFacturar, completo: boolean): string {
  if (total.aFacturar !== null) return `${fmtTotalUsd(total.aFacturar)} a facturar`;
  if (total.cantidad > total.sinTarifa) return `Subtotal conocido: ${fmtTotalUsd(total.subtotalConocido)}`;
  return !completo && total.cantidad === 0 ? "Importe no concluyente" : "Importe no disponible";
}

export function SinFacturarCard({
  resumen,
  total,
  completo,
  tarifasDisponibles,
}: {
  resumen: ResumenSinFacturar;
  total: TotalesSinFacturar;
  completo: boolean;
  tarifasDisponibles: boolean;
}) {
  const llego = resumen.llego_sin_factura;
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        padding: "var(--s-5) var(--s-5)",
        minWidth: 0,
        overflowWrap: "anywhere",
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--s-3)", justifyContent: "space-between", alignItems: "baseline", marginBottom: "var(--s-4)" }}>
        <span
          style={{
            font: "700 10px/1 var(--f-sans)",
            color: "var(--wine-text)",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          Por facturar
        </span>
        <Link
          href={REPORTE}
          style={{
            font: "600 11.5px/1 var(--f-sans)",
            color: "var(--wine-text)",
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--s-1)",
            textDecoration: "none",
          }}
        >
          Embarques sin facturar {Icon.arrowR(11)}
        </Link>
      </div>

      <p role="status" aria-label="Resumen global por facturar" style={{ margin: "0 0 var(--s-4)", font: "500 12.5px/1.5 var(--f-sans)", color: "var(--ink)" }}>
        {total.cantidad} {total.cantidad === 1 ? "recepción" : "recepciones"}{!completo ? " observadas · Lectura parcial" : ""}
        {" · "}{total.sinTarifa} sin tarifa disponible. {textoImporte(total, completo)}.
        {total.aFacturar === null && " El importe total no es concluyente."}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))", gap: "var(--s-3)" }}>
        <MiniStat
          label="Llegó sin factura"
          value={llego.cantidad}
          sub={`${textoImporte(llego, completo)}${llego.sinTarifa > 0 ? ` · ${llego.sinTarifa} sin tarifa disponible` : ""}`}
          icon={Icon.invoice(16)}
          tone={llego.cantidad > 0 ? "danger" : completo ? "success" : "warning"}
          href={REPORTE}
        />
        <MiniStat
          label="Sin tarifa disponible"
          value={total.sinTarifa}
          sub="incluye las que ya llegaron"
          icon={Icon.warehouse(16)}
          tone={total.sinTarifa > 0 || !completo || !tarifasDisponibles ? "warning" : "success"}
          href={REPORTE}
        />
        <MiniStat
          label="En camino"
          value={resumen.en_camino.cantidad}
          sub={textoImporte(resumen.en_camino, completo)}
          icon={Icon.ship(16)}
          href={REPORTE}
        />
      </div>

      <p style={{ margin: "var(--s-3) 0 0", font: "500 11.5px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
        El contador sin tarifa se cruza con los estados; no sumes las tarjetas.
      </p>

      {!tarifasDisponibles && (
        <p role="status" style={{ margin: "var(--s-3) 0 0", font: "500 11.5px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
          La tarifa congelada todavía no está disponible en esta base. El contador indica las recepciones
          sin tarifa disponible en esta lectura; la prioridad de llegada se conserva.
        </p>
      )}
      {!completo && (
        <p role="status" style={{ margin: "var(--s-3) 0 0", font: "500 11.5px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
          Lectura parcial: se alcanzó el tope de páginas. Cantidades y subtotales describen solo la parte leída;
          no permiten concluir el total de pendientes.
        </p>
      )}
    </div>
  );
}
