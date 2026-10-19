/**
 * Tarjeta «Ingreso del período» (SDD-0557).
 *
 * La misma presentación de la cifra oficial en Contabilidad › Reportes y en
 * Reportes › Estado de resultados: facturado sin IVA en USD por fecha de
 * emisión, el control contra la cuenta 4.5 del mayor y los avisos (fondos de
 * terceros, facturas sin convertir, otros ingresos del mayor). Los textos
 * salen de `describirIngreso`, que también usa Dirección.
 *
 * Componente de módulo, sin estado: no entra al registro de componentes del
 * sistema (CMP-01).
 */

import { StatusIcon } from "@/components/StatusIcon";
import { fmtUsd } from "@/lib/money";
import {
  CUENTA_VENTAS,
  describirIngreso,
  type IngresoPeriodo,
} from "@/lib/studio/accounting/ingreso-periodo";

/** A dónde mandar cuando el mayor no cuadra con lo facturado. */
export const ENLACE_POR_CONTABILIZAR = "/studio/contabilidad?tab=subdiario";

export function IngresoDelPeriodoCard({
  ingreso,
  style,
}: {
  ingreso: IngresoPeriodo;
  style?: React.CSSProperties;
}) {
  const d = describirIngreso(ingreso);
  const revisar = d.estado === "mayor_menor" || d.estado === "mayor_mayor";
  const linea = {
    display: "flex",
    alignItems: "flex-start",
    gap: "var(--s-2)",
    margin: 0,
    font: "500 12.5px/1.45 var(--f-sans)",
    color: "var(--ink)",
  } as const;

  return (
    <section
      aria-label="Ingreso del período"
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        padding: "var(--s-5)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--s-3)",
        ...style,
      }}
    >
      <div>
        <span className="studio-eyebrow">Ingreso del período</span>
        <div
          data-testid="ingreso-facturado"
          style={{
            font: "900 28px/1.1 var(--f-display)",
            color: "var(--ink)",
            fontVariantNumeric: "tabular-nums",
            margin: "var(--s-2) 0 var(--s-1)",
          }}
        >
          {fmtUsd(ingreso.facturado.total)}
        </div>
        <p style={{ margin: 0, font: "500 12px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
          Facturado sin IVA · USD · por fecha de emisión · del {ingreso.rango.from} al{" "}
          {ingreso.rango.to} · {ingreso.facturas}{" "}
          {ingreso.facturas === 1 ? "factura" : "facturas"}
        </p>
      </div>

      {ingreso.mayor && (
        <p style={linea}>
          <StatusIcon
            tone={d.estado === "cuadra" ? "success" : "warning"}
            size={15}
            style={{ color: d.estado === "cuadra" ? "var(--success)" : "var(--warning)", marginTop: 1 }}
          />
          <span>
            En el mayor (cuenta {CUENTA_VENTAS}):{" "}
            <strong style={{ fontVariantNumeric: "tabular-nums" }}>
              {ingreso.mayor.ventas == null ? "—" : fmtUsd(ingreso.mayor.ventas)}
            </strong>
            . {d.diferenciaTexto}
          </span>
        </p>
      )}
      {d.avisoTerceros && (
        <p style={linea}>
          <StatusIcon tone="info" size={15} style={{ color: "var(--info)", marginTop: 1 }} />
          <span>
            {d.avisoTerceros} La cifra los suma, igual que el mayor; si son ingreso propio
            está por decidir.
          </span>
        </p>
      )}
      {d.avisoSinConvertir && (
        <p style={linea}>
          <StatusIcon tone="warning" size={15} style={{ color: "var(--warning)", marginTop: 1 }} />
          <span>{d.avisoSinConvertir}</span>
        </p>
      )}
      {d.otrosIngresosTexto && (
        <p style={{ ...linea, color: "var(--ink-soft)" }}>
          <StatusIcon tone="neutral" size={15} style={{ color: "var(--ink-soft)", marginTop: 1 }} />
          <span>{d.otrosIngresosTexto}</span>
        </p>
      )}
      {revisar && (
        <a
          href={ENLACE_POR_CONTABILIZAR}
          style={{ font: "700 12.5px/1.2 var(--f-sans)", color: "var(--wine-text)" }}
        >
          Revisa qué falta en Por contabilizar
        </a>
      )}
    </section>
  );
}
