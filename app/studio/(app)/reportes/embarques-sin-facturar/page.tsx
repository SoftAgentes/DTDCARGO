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
  type ImporteUsdExacto,
  type TotalesSinFacturar,
} from "@/lib/studio/rate-snapshots/sin-facturar";
import { cbmCambio } from "@/lib/studio/rate-snapshots/types";
import { requireModuleView } from "@/lib/studio/rbac-guard";

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

/** El agregado llega exacto: no atraviesa Number ni el formateador por fila. */
function fmtTotalUsd(importe: ImporteUsdExacto): string {
  const [entero, centavos] = importe.split(".");
  return `$${entero.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${centavos}`;
}

function textoImporte(total: TotalesSinFacturar, completo: boolean): string {
  if (total.aFacturar !== null) return `${fmtTotalUsd(total.aFacturar)} a facturar`;
  if (total.cantidad > total.sinTarifa) return `Subtotal conocido: ${fmtTotalUsd(total.subtotalConocido)}`;
  return !completo && total.cantidad === 0 ? "Importe no concluyente" : "Importe no disponible";
}

export default async function EmbarquesSinFacturarPage() {
  // SDD-0624: el gate va también en la página, no sólo en el layout: un
  // layout compartido no se vuelve a ejecutar en la navegación parcial.
  await requireModuleView("reports");

  const supabase = await createClient();
  const r = await reporteSinFacturar(supabase);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-5)", maxWidth: 1280, width: "100%", minWidth: 0 }}>
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
          congelada (CBM congelado × tarifa, o el mínimo). El CBM actual se muestra aparte.
          Una pre-factura en borrador no cuenta como facturada.
        </p>
      </header>

      {!r.tarifasDisponibles && (
        <p role="status" style={{ margin: 0, padding: "10px 12px", borderRadius: "var(--r-sm)", background: "var(--warning-bg)", color: "var(--ink)", font: "600 12.5px/1.4 var(--f-sans)" }}>
          La tarifa congelada todavía no está disponible en esta base. No se pueden determinar sus importes;
          la prioridad de las recepciones que ya llegaron se conserva.
        </p>
      )}
      {!r.completo && (
        <p role="status" style={{ margin: 0, padding: "10px 12px", borderRadius: "var(--r-sm)", background: "var(--warning-bg)", color: "var(--ink)", font: "600 12.5px/1.4 var(--f-sans)" }}>
          Lectura parcial: se alcanzó el tope de páginas. Cantidades y subtotales describen solo la parte leída;
          no permiten concluir el total de pendientes.
        </p>
      )}

      <p role="status" aria-label="Resumen global por facturar" style={{ margin: 0, font: "500 13px/1.5 var(--f-sans)", color: "var(--ink)", overflowWrap: "anywhere" }}>
        {r.total.cantidad} {r.total.cantidad === 1 ? "recepción" : "recepciones"}{!r.completo ? " observadas · Lectura parcial" : ""}
        {" · "}{r.total.sinTarifa} sin tarifa disponible. {textoImporte(r.total, r.completo)}.
        {r.total.aFacturar === null && " El importe total no es concluyente."}
      </p>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: "var(--s-4)", overflowWrap: "anywhere" }}>
        {ESTADOS_SIN_FACTURAR.map((e) => (
          <KpiCard
            key={e}
            value={String(r.resumen[e].cantidad)}
            label={ESTADO_SIN_FACTURAR_LABEL[e]}
            sub={
              <>
                <span>{textoImporte(r.resumen[e], r.completo)}</span>
                {r.resumen[e].sinTarifa > 0 && <><br /><span>{r.resumen[e].sinTarifa} sin tarifa disponible</span></>}
                {!r.completo && <><br /><span>Solo la parte leída</span></>}
              </>
            }
            valueColor={e === "llego_sin_factura" ? "var(--danger)" : "var(--ink)"}
            style={{ minWidth: 0 }}
          />
        ))}
      </section>

      {r.filas.length === 0 ? (
        <EmptyState
          eyebrow={r.completo ? "Al día" : "Lectura parcial"}
          title={r.completo ? "No hay recepciones elegibles sin factura fiscal" : "No se encontraron pendientes en la parte leída"}
          description={r.completo
            ? "La lectura completa no encontró pendientes entre las recepciones con cliente que cumplen los criterios del reporte."
            : "La lectura está incompleta: no se puede afirmar que no haya otras recepciones pendientes de facturar."}
        />
      ) : (
        <div role="region" aria-labelledby="sin-facturar-tabla" tabIndex={0} style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", background: "var(--bg-surface)" }}>
          <table style={{ width: "100%", minWidth: 1140, borderCollapse: "collapse", font: "500 12.5px/1.4 var(--f-sans)" }}>
            <caption id="sin-facturar-tabla" className="studio-eyebrow" style={{ textAlign: "left", padding: "12px 16px" }}>
              {r.filas.length} recepción(es) sin factura fiscal{!r.completo && " en la parte leída"}
            </caption>
            <thead>
              <tr style={{ background: "var(--bg-elevated)", color: "var(--ink-soft)", textAlign: "left" }}>
                <th scope="col" style={{ padding: "10px 16px" }}>Estado</th>
                <th scope="col" style={{ padding: "10px 16px" }}>Recepción</th>
                <th scope="col" style={{ padding: "10px 16px" }}>Shipping Mark</th>
                <th scope="col" style={{ padding: "10px 16px" }}>Envío</th>
                <th scope="col" style={{ padding: "10px 16px", textAlign: "right" }}>CBM congelado (m³)</th>
                <th scope="col" style={{ padding: "10px 16px", textAlign: "right" }}>CBM actual (m³)</th>
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
                  <td className="mono" style={{ padding: "10px 16px", fontFamily: "var(--f-mono)", textAlign: "right" }}>{fmtCbm(f.cbmCongelado)}</td>
                  <td className="mono" style={{ padding: "10px 16px", fontFamily: "var(--f-mono)", textAlign: "right" }}>
                    {fmtCbm(f.cbm)}
                    {f.cbmCongelado !== null && cbmCambio({ cbm: f.cbmCongelado }, f.cbm) && (
                      <span style={{ display: "block", marginTop: "var(--s-1)", font: "600 11px/1.4 var(--f-sans)", color: "var(--ink)" }}>
                        {f.cbm === null ? "CBM actual no disponible" : "CBM actual cambió"}
                      </span>
                    )}
                  </td>
                  <td className="mono" style={{ padding: "10px 16px", fontFamily: "var(--f-mono)", textAlign: "right", whiteSpace: "nowrap" }}>
                    {f.perCbm == null ? "—" : `${fmtUsd(f.perCbm)}/m³`}
                  </td>
                  <td className="mono" style={{ padding: "10px 16px", fontFamily: "var(--f-mono)", textAlign: "right", whiteSpace: "nowrap", fontWeight: 700 }}>
                    {f.aFacturar == null ? "Sin tarifa" : fmtUsd(f.aFacturar)}
                    {f.minimo !== null && f.minimo > 0 && (
                      <span style={{ display: "block", marginTop: "var(--s-1)", font: "500 11px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
                        Mínimo {fmtUsd(f.minimo)}
                      </span>
                    )}
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
