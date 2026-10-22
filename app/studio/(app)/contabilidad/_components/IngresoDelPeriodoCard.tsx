/**
 * Tarjeta «Ingreso del período» (SDD-0557).
 *
 * La misma presentación de la cifra oficial en Contabilidad › Reportes y en
 * Reportes › Estado de resultados: facturado sin IVA en USD por fecha de
 * emisión, el control contra la cuenta 4.5 del mayor (solo asientos de
 * factura) y los avisos (fondos de terceros, facturas sin convertir, otros
 * ingresos del mayor). Los textos salen de `describirIngreso`, cuyo estado
 * usan también Dirección y el CSV del P&L.
 *
 * El ícono del control sigue al estado: éxito solo cuando cuadra; «no
 * comparable» y «sin movimiento» van neutros, porque ninguno de los dos es
 * una verificación; y el enlace a Por contabilizar sale solo con una
 * diferencia real (también con el mayor vacío, B3). Con «no comparable» el
 * saldo de 4.5 no se pinta como dólares: es «nominal mixto (no USD)».
 *
 * Componente de módulo, sin estado: no entra al registro de componentes del
 * sistema (CMP-01).
 */

import { StatusIcon } from "@/components/StatusIcon";
import { fmtUsd } from "@/lib/money";
import {
  CUENTA_VENTAS,
  describirIngreso,
  causaDelControlI2,
  type EstadoDelIngreso,
  type IngresoPeriodo,
} from "@/lib/studio/accounting/ingreso-periodo";

/** A dónde mandar cuando el mayor no cuadra con lo facturado. */
export const ENLACE_POR_CONTABILIZAR = "/studio/contabilidad?tab=subdiario";

/** Tono del ícono del control por estado. */
export const TONO_DEL_CONTROL: Record<EstadoDelIngreso, "success" | "warning" | "neutral"> = {
  cuadra: "success",
  mayor_menor: "warning",
  mayor_mayor: "warning",
  sin_cuenta: "warning",
  requiere_revision: "warning",
  no_comparable: "neutral",
  sin_movimiento: "neutral",
  sin_mayor: "neutral",
};

const COLOR_DEL_TONO = {
  success: "var(--success)",
  warning: "var(--warning)",
  neutral: "var(--ink-soft)",
} as const;

/** Lo que se lee en el mayor para «no comparable»: no es una cifra en USD. */
export const NOMINAL_MIXTO = "nominal mixto (no USD)";

/**
 * El saldo de 4.5 de los asientos de factura como se pinta. Con «no
 * comparable» ese saldo mezcla el nominal en bolívares o yuanes (B2): no se
 * pinta con signo de dólar.
 */
function cifraDelMayor(unidad: IngresoPeriodo["controlI2"]["unidadMayor"], ventas: number | null): string {
  if (ventas == null) return "—";
  if (unidad === "nominal_mixto") return NOMINAL_MIXTO;
  if (unidad === "sin_verificar") return "unidad sin verificar";
  return fmtUsd(ventas);
}

export function IngresoDelPeriodoCard({
  ingreso,
  style,
}: {
  ingreso: IngresoPeriodo;
  style?: React.CSSProperties;
}) {
  const d = describirIngreso(ingreso);
  const revisar = d.estado === "mayor_menor" || d.estado === "mayor_mayor";
  const tono = TONO_DEL_CONTROL[d.estado];
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
        <p style={linea} data-testid="ingreso-control" data-estado={d.estado} data-tono={tono}>
          <StatusIcon
            tone={tono}
            size={15}
            style={{ color: COLOR_DEL_TONO[tono], marginTop: 1 }}
          />
          <span>
            En el mayor (cuenta {CUENTA_VENTAS}, asientos de factura):{" "}
            <strong data-testid="ingreso-mayor-ventas" style={{ fontVariantNumeric: "tabular-nums" }}>
              {cifraDelMayor(ingreso.controlI2.unidadMayor, ingreso.mayor.ventas)}
            </strong>
            . {d.diferenciaTexto}
          </span>
        </p>
      )}
      {ingreso.mayor && (
        <div style={{ ...linea, flexDirection: "column" }} data-testid="ingreso-puente">
          <span>Ajuste documental por anulaciones (USD): <strong>{ingreso.ajusteAnulacionesUsd == null ? "No disponible" : fmtUsd(ingreso.ajusteAnulacionesUsd)}</strong></span>
          <span>Base comparada · facturado + ajuste (USD): <strong>{ingreso.baseComparacionUsd == null ? "No disponible" : fmtUsd(ingreso.baseComparacionUsd)}</strong></span>
          <span>Diferencia base − mayor (USD): <strong>{ingreso.diferenciaUsd == null ? "No disponible" : fmtUsd(ingreso.diferenciaUsd)}</strong></span>
          {causaDelControlI2(ingreso) && <span>{causaDelControlI2(ingreso)}</span>}
        </div>
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
