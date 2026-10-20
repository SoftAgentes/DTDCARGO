/**
 * Reporte «Embarques sin facturar» (SDD-0574, 4.5 del plan contable).
 *
 * Server component, READ-ONLY. Lo protege el layout de Reportes
 * (`requireModuleView("reports")`: accounting + admin), que son también quienes
 * leen `invoices` por la RLS (0414). La regla vive en
 * `lib/studio/rate-snapshots/sin-facturar.ts`, con su prueba.
 *
 * Hasta la 4.2 la unidad es la recepción en Yiwu (por cliente, con su tarifa
 * congelada de la SDD-0571): el contenedor `C-` mezcla clientes.
 */

import Link from "next/link";
import { createClient } from "@/lib/db/server";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { KpiCard } from "@/app/studio/_components/ui/KpiCard";
import { fmtUsd } from "@/lib/money";
import {
  ESTADOS_SIN_FACTURAR,
  ESTADO_SIN_FACTURAR_LABEL,
  reporteSinFacturar,
  type EstadoSinFacturar,
} from "@/lib/studio/rate-snapshots/sin-facturar";

export const metadata = { title: "Embarques sin facturar · Reportes" };
export const dynamic = "force-dynamic";

const TONO: Record<EstadoSinFacturar, "danger" | "warning" | "info"> = {
  llego_sin_factura: "danger",
  sin_tarifa: "warning",
  en_camino: "info",
};

const AYUDA: Record<EstadoSinFacturar, string> = {
  llego_sin_factura: "Ya llegó a Venezuela: la factura sale al llegar, con vencimiento inmediato.",
  sin_tarifa: "No tiene tarifa congelada: congélala en Almacén CN antes de facturar.",
  en_camino: "Tiene tarifa y todavía no llegó: se factura al llegar.",
};

function fmtCbm(n: number | null): string {
  return n == null ? "—" : n.toLocaleString("es-VE", { maximumFractionDigits: 3 });
}

export default async function EmbarquesSinFacturarPage() {
  const supabase = await createClient();
  const r = await reporteSinFacturar(supabase);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-5)", maxWidth: 1280 }}>
      <header style={{ display: "flex", flexDirection: "column", gap: "var(--s-1)" }}>
        <Link href="/studio/reportes?cat=con" style={{ font: "600 12px/1 var(--f-sans)", color: "var(--ink-soft)" }}>
          ← Reportes
        </Link>
        <span className="studio-eyebrow">Reportes · Contables</span>
        <h1 className="studio-display" style={{ fontSize: 26, margin: 0, color: "var(--ink)" }}>
          Embarques sin facturar
        </h1>
        <p style={{ margin: 0, font: "500 13px/1.5 var(--f-sans)", color: "var(--ink-soft)", maxWidth: "75ch" }}>
          Cada recepción de Yiwu que todavía no tiene factura fiscal. «A facturar» sale de su tarifa
          congelada (CBM × tarifa, o el mínimo). Una pre-factura en borrador no cuenta como facturada.
        </p>
      </header>

      {!r.tarifasDisponibles && (
        <p role="status" style={{ margin: 0, padding: "10px 12px", borderRadius: "var(--r-sm)", background: "var(--warning-bg)", color: "var(--ink)", font: "600 12.5px/1.4 var(--f-sans)" }}>
          La tarifa congelada todavía no está disponible en esta base: todas las recepciones aparecen sin tarifa.
        </p>
      )}
      {!r.completo && (
        <p role="status" style={{ margin: 0, padding: "10px 12px", borderRadius: "var(--r-sm)", background: "var(--warning-bg)", color: "var(--ink)", font: "600 12.5px/1.4 var(--f-sans)" }}>
          La lectura se cortó en el tope de páginas: los totales de abajo no son todos.
        </p>
      )}

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "var(--s-4)" }}>
        {ESTADOS_SIN_FACTURAR.map((e) => (
          <KpiCard
            key={e}
            value={String(r.resumen[e].cantidad)}
            label={ESTADO_SIN_FACTURAR_LABEL[e]}
            sub={e === "sin_tarifa" ? AYUDA[e] : `${fmtUsd(r.resumen[e].aFacturar)} a facturar`}
            valueColor={e === "llego_sin_factura" ? "var(--danger)" : "var(--ink)"}
          />
        ))}
      </section>

      {r.filas.length === 0 ? (
        <EmptyState
          eyebrow="Al día"
          title="No hay embarques sin facturar"
          description="Toda recepción con cliente tiene su factura fiscal."
        />
      ) : (
        <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", background: "var(--bg-surface)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", font: "500 12.5px/1.4 var(--f-sans)" }}>
            <caption className="studio-eyebrow" style={{ textAlign: "left", padding: "12px 16px" }}>
              {r.filas.length} recepción(es) sin factura fiscal
            </caption>
            <thead>
              <tr style={{ background: "var(--bg-elevated)", color: "var(--ink-soft)", textAlign: "left" }}>
                <th scope="col" style={{ padding: "10px 16px" }}>Estado</th>
                <th scope="col" style={{ padding: "10px 16px" }}>Recepción</th>
                <th scope="col" style={{ padding: "10px 16px" }}>Shipping Mark</th>
                <th scope="col" style={{ padding: "10px 16px" }}>Envío</th>
                <th scope="col" style={{ padding: "10px 16px", textAlign: "right" }}>CBM</th>
                <th scope="col" style={{ padding: "10px 16px", textAlign: "right" }}>Tarifa</th>
                <th scope="col" style={{ padding: "10px 16px", textAlign: "right" }}>A facturar</th>
                <th scope="col" style={{ padding: "10px 16px", textAlign: "right" }}>Días</th>
                <th scope="col" style={{ padding: "10px 16px" }}>Pre-factura</th>
              </tr>
            </thead>
            <tbody>
              {r.filas.map((f) => (
                <tr key={f.receiptId} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "10px 16px" }} title={AYUDA[f.estado]}>
                    <Badge tone={TONO[f.estado]} size="sm">{ESTADO_SIN_FACTURAR_LABEL[f.estado]}</Badge>
                  </td>
                  <td className="mono" style={{ padding: "10px 16px", fontFamily: "var(--f-mono)", whiteSpace: "nowrap" }}>{f.receiptCode}</td>
                  <td className="mono" style={{ padding: "10px 16px", fontFamily: "var(--f-mono)", whiteSpace: "nowrap" }}>{f.markbox}</td>
                  <td className="mono" style={{ padding: "10px 16px", fontFamily: "var(--f-mono)", whiteSpace: "nowrap" }}>{f.shipmentCode ?? "—"}</td>
                  <td className="mono" style={{ padding: "10px 16px", fontFamily: "var(--f-mono)", textAlign: "right" }}>{fmtCbm(f.cbm)}</td>
                  <td className="mono" style={{ padding: "10px 16px", fontFamily: "var(--f-mono)", textAlign: "right", whiteSpace: "nowrap" }}>
                    {f.perCbm == null ? "—" : `${fmtUsd(f.perCbm)}/m³`}
                  </td>
                  <td className="mono" style={{ padding: "10px 16px", fontFamily: "var(--f-mono)", textAlign: "right", whiteSpace: "nowrap", fontWeight: 700 }}>
                    {f.aFacturar == null ? "Sin tarifa" : fmtUsd(f.aFacturar)}
                  </td>
                  <td className="mono" style={{ padding: "10px 16px", fontFamily: "var(--f-mono)", textAlign: "right" }}>{f.dias}</td>
                  <td className="mono" style={{ padding: "10px 16px", fontFamily: "var(--f-mono)", whiteSpace: "nowrap" }}>{f.preFactura ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
