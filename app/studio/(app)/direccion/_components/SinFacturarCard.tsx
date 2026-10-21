"use client";

/**
 * Por facturar (SDD-0574) — las tarjetas de «Embarques sin facturar» en
 * Dirección: lo que llegó sin factura (la factura sale al llegar, decisión 9),
 * lo que no tiene tarifa congelada y lo que va en camino con tarifa. Cada
 * celda lleva al reporte. Solo tokens var(--*).
 */

import Link from "next/link";
import { Icon } from "@/app/studio/_components/icons";
import { fmtUsd } from "@/lib/money";
import type { ResumenSinFacturar } from "@/lib/studio/rate-snapshots/sin-facturar";
import { MiniStat } from "./MiniStat";

const REPORTE = "/studio/reportes/embarques-sin-facturar";

export function SinFacturarCard({
  resumen,
  completo,
  tarifasDisponibles,
}: {
  resumen: ResumenSinFacturar;
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
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "var(--s-4)" }}>
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

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--s-3)" }}>
        <MiniStat
          label="Llegó sin factura"
          value={llego.cantidad}
          sub={`${fmtUsd(llego.aFacturar)} a facturar`}
          icon={Icon.invoice(16)}
          tone={llego.cantidad > 0 ? "danger" : "success"}
          href={REPORTE}
        />
        <MiniStat
          label="Sin tarifa"
          value={resumen.sin_tarifa.cantidad}
          sub="congelar en Almacén CN"
          icon={Icon.warehouse(16)}
          tone={resumen.sin_tarifa.cantidad > 0 ? "warning" : "success"}
          href={REPORTE}
        />
        <MiniStat
          label="En camino"
          value={resumen.en_camino.cantidad}
          sub={`${fmtUsd(resumen.en_camino.aFacturar)} al llegar`}
          icon={Icon.ship(16)}
          href={REPORTE}
        />
      </div>

      {(!completo || !tarifasDisponibles) && (
        <p role="status" style={{ margin: "var(--s-3) 0 0", font: "500 11.5px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
          {!tarifasDisponibles
            ? "La tarifa congelada todavía no está disponible: todo cuenta como sin tarifa."
            : "La lectura se cortó en el tope de páginas: los números no son todos."}
        </p>
      )}
    </div>
  );
}
