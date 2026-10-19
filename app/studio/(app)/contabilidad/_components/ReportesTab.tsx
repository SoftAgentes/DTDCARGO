"use client";

/**
 * Tab "Reportes" (SDD-0040 · SDD-0557).
 *
 * Todo con período explícito, en el orden en que se lee:
 *  1. Desde / Hasta (GET; por defecto, el mes en curso). Una fecha inválida o
 *     un rango al revés NO se corrige en silencio: se muestra el error junto
 *     al formulario y no se calcula nada (DAT-01).
 *  2. La cifra oficial de ingreso del período con el control de la 4.5.
 *  3. P&L del período, desde el mayor.
 *  4. Balance general AL CORTE (= hasta): resultado acumulado, sin cierre a 3.4.
 *  5. Balance de comprobación al corte, con su cuadre y CSV. El enlace al
 *     diario que va al lado es «hasta el corte», SIN desde: así Σ debe del
 *     archivo = total debe de esta tabla.
 */

import { useId } from "react";
import type { BalanceSheet, ProfitAndLoss } from "@/lib/studio/accounting/reports";
import {
  comprobacionCsv,
  enlaceDelDiario,
  type BalanceComprobacion,
  type FiltroReportes,
  type ReportesDelLibro,
} from "@/lib/studio/accounting/libro-control";
import { ACCT_TYPE_LABEL } from "@/lib/studio/account-types";
import { Icon } from "@/app/studio/_components/icons";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { TableFrame } from "@/app/studio/_components/ui/DataTable";
import { downloadTextFile } from "@/app/studio/_components/ui/download";
import { StatusIcon } from "@/components/StatusIcon";
import { fmtAmount } from "./format";
import { IngresoDelPeriodoCard } from "./IngresoDelPeriodoCard";

export function ReportesTab({
  reportes,
  filtro,
}: {
  reportes: ReportesDelLibro | null;
  filtro: FiltroReportes;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-5)" }}>
      <FiltroDelPeriodo filtro={filtro} />
      {/* Con un error del filtro no se pinta nada, aunque llegaran reportes:
          debajo del error no puede aparecer otro período (DAT-01). */}
      {reportes && !filtro.error && (
        <>
          <IngresoDelPeriodoCard ingreso={reportes.ingreso} style={{ maxWidth: 760 }} />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(380px, 100%), 1fr))",
              gap: 18,
              alignItems: "start",
            }}
          >
            <EstadoDeResultados pnl={reportes.pnl} rango={reportes.rango} />
            <BalanceGeneral balance={reportes.balance} corte={reportes.rango.to} />
          </div>
          <Comprobacion comprobacion={reportes.comprobacion} />
        </>
      )}
    </div>
  );
}

function FiltroDelPeriodo({ filtro }: { filtro: FiltroReportes }) {
  const id = useId();
  const errorId = `${id}-error`;
  const invalido = filtro.error ? true : undefined;
  return (
    <form
      // Remonta al cambiar la URL: los valores vienen del servidor.
      key={`${filtro.desde}|${filtro.hasta}`}
      method="get"
      action="/studio/contabilidad"
      aria-label="Período de los reportes"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--s-2)",
        padding: "var(--s-4)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        background: "var(--bg-elevated)",
      }}
    >
      <input type="hidden" name="tab" value="reportes" />
      <div style={{ display: "flex", alignItems: "flex-end", gap: "var(--s-3)", flexWrap: "wrap" }}>
        <label style={{ display: "flex", flexDirection: "column" }}>
          <span className="studio-label">Desde</span>
          <input
            type="date"
            name="desde"
            className="studio-input"
            defaultValue={filtro.desde}
            aria-invalid={invalido}
            aria-describedby={filtro.error ? errorId : undefined}
            style={{ minWidth: 160 }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column" }}>
          <span className="studio-label">Hasta (corte)</span>
          <input
            type="date"
            name="hasta"
            className="studio-input"
            defaultValue={filtro.hasta}
            aria-invalid={invalido}
            aria-describedby={filtro.error ? errorId : undefined}
            style={{ minWidth: 160 }}
          />
        </label>
        <button type="submit" className="studio-btn studio-btn-primary studio-btn-sm">
          Aplicar
        </button>
        <span style={{ font: "500 11.5px/1.4 var(--f-sans)", color: "var(--ink-soft)", maxWidth: "48ch" }}>
          Sin fechas, el mes en curso. Las fechas son las que guarda el sistema (UTC).
        </span>
      </div>
      {filtro.error && (
        <p
          id={errorId}
          role="alert"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--s-2)",
            margin: 0,
            font: "600 12.5px/1.4 var(--f-sans)",
            color: "var(--ink)",
          }}
        >
          <StatusIcon tone="danger" size={15} style={{ color: "var(--danger-text)" }} />
          {filtro.error} No se calculó ningún reporte.
        </p>
      )}
    </form>
  );
}

function EstadoDeResultados({
  pnl,
  rango,
}: {
  pnl: ProfitAndLoss;
  rango: ReportesDelLibro["rango"];
}) {
  return (
    <ReportCard
      title="Estado de resultados"
      subtitle={`del ${rango.from} al ${rango.to} · USD · desde el mayor`}
    >
      <Row label="Ingresos (cuentas 4)" value={pnl.income} />
      <Row label="Costo de ventas" value={pnl.cogs} negative />
      <Divider />
      <Row label="Utilidad bruta" value={pnl.grossProfit} strong />
      <Row label="Gastos operativos" value={pnl.expenses} negative />
      <Divider />
      <Row label="Utilidad neta" value={pnl.netIncome} highlight />
    </ReportCard>
  );
}

function BalanceGeneral({ balance, corte }: { balance: BalanceSheet; corte: string }) {
  return (
    <ReportCard
      title="Balance general"
      subtitle={`al ${corte} · resultado acumulado, sin cierre a 3.4 · USD`}
    >
      <Row label="Activo" value={balance.assets} strong />
      <Divider />
      <Row label="Pasivo" value={balance.liabilities} />
      <Row label="Patrimonio" value={balance.equity} />
      <Row label="Resultado acumulado" value={balance.netIncome} />
      <Divider />
      <Row
        label="Pasivo + Patrimonio + Resultado"
        value={balance.liabilities + balance.equity + balance.netIncome}
        strong
      />
      <div
        style={{
          marginTop: 14,
          paddingTop: 14,
          borderTop: "1px solid var(--ink-inv-mute)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span
          style={{
            font: "600 10.5px/1 var(--f-sans)",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--ink-side-soft)",
          }}
        >
          {balance.ok ? "Balance cuadra" : "Descuadre"}
        </span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            font: "800 13px/1 var(--f-mono)",
            color: balance.ok ? "var(--success)" : "var(--warning)",
          }}
        >
          {balance.ok ? (
            <>
              {Icon.check(13)}
              A = P + PT + R
            </>
          ) : (
            `$${fmtAmount(Math.abs(balance.difference))}`
          )}
        </span>
      </div>
    </ReportCard>
  );
}

const th: React.CSSProperties = {
  padding: "var(--s-3) var(--s-4)",
  font: "700 10px/1.2 var(--f-sans)",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--ink-soft)",
  textAlign: "left",
  background: "var(--bg-elevated)",
  borderBottom: "1px solid var(--border)",
  whiteSpace: "nowrap",
};
const td: React.CSSProperties = {
  padding: "var(--s-3) var(--s-4)",
  font: "500 12.5px/1.3 var(--f-sans)",
  color: "var(--ink)",
  borderTop: "1px solid var(--border)",
};
const num: React.CSSProperties = {
  ...td,
  font: "600 12.5px/1 var(--f-mono)",
  textAlign: "right",
  whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
};

function Comprobacion({ comprobacion: c }: { comprobacion: BalanceComprobacion }) {
  const csv = comprobacionCsv(c);
  return (
    <section aria-labelledby="titulo-comprobacion" style={{ display: "flex", flexDirection: "column", gap: "var(--s-3)" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: "var(--s-3)",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2
            id="titulo-comprobacion"
            style={{ margin: 0, font: "900 16px/1.2 var(--f-display)", color: "var(--ink)" }}
          >
            Balance de comprobación al {c.corte}
          </h2>
          <p style={{ margin: "var(--s-1) 0 0", font: "500 12px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
            Movimientos acumulados de cada cuenta hasta el corte, antes del cierre. USD.
          </p>
        </div>
        <div style={{ display: "flex", gap: "var(--s-2)", alignItems: "center", flexWrap: "wrap" }}>
          {c.filas.length > 0 && (
            <Badge tone={c.cuadra ? "success" : "warning"} size="md">
              {c.cuadra ? "Cuadra" : `Descuadre $${fmtAmount(Math.abs(c.diferencia))}`}
            </Badge>
          )}
          <ActionButton
            variant="ghost"
            size="sm"
            idleLabel="Exportar CSV"
            idleIcon={Icon.download(14)}
            successLabel="Descargado"
            successIcon={Icon.check(14)}
            disabled={!csv}
            title={csv ? "Exportar el balance de comprobación a CSV" : "No hay movimientos para exportar"}
            onAction={async () => {
              if (!csv) return { error: "No hay movimientos para exportar." };
              downloadTextFile(csv.filename, csv.content);
            }}
          />
          <a
            className="studio-btn studio-btn-ghost studio-btn-sm"
            href={enlaceDelDiario({ to: c.corte })}
            title="Todos los asientos asentados hasta el corte: suma lo mismo que esta tabla"
          >
            {Icon.download(14)}
            Diario hasta el corte (CSV)
          </a>
        </div>
      </div>

      {c.filas.length === 0 ? (
        <EmptyState
          eyebrow="Balance de comprobación"
          title="Sin movimientos asentados hasta el corte"
          description="Cuando haya asientos asentados hasta esa fecha, la tabla muestra el debe, el haber y el saldo de cada cuenta."
        />
      ) : (
        <TableFrame>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
            <thead>
              <tr>
                <th scope="col" style={th}>Cuenta</th>
                <th scope="col" style={th}>Nombre</th>
                <th scope="col" style={{ ...th, textAlign: "right" }}>Debe</th>
                <th scope="col" style={{ ...th, textAlign: "right" }}>Haber</th>
                <th scope="col" style={{ ...th, textAlign: "right" }}>Saldo deudor</th>
                <th scope="col" style={{ ...th, textAlign: "right" }}>Saldo acreedor</th>
              </tr>
            </thead>
            <tbody>
              {c.filas.map((f) => (
                <tr key={f.accountId}>
                  <td style={{ ...td, font: "700 12px/1 var(--f-mono)", whiteSpace: "nowrap" }}>{f.code}</td>
                  <td style={td}>
                    {f.name}
                    <span style={{ color: "var(--ink-soft)" }}> · {ACCT_TYPE_LABEL[f.type]}</span>
                  </td>
                  <td style={num}>{fmtAmount(f.debe)}</td>
                  <td style={num}>{fmtAmount(f.haber)}</td>
                  <td style={num}>{f.saldoDeudor ? fmtAmount(f.saldoDeudor) : "—"}</td>
                  <td style={num}>{f.saldoAcreedor ? fmtAmount(f.saldoAcreedor) : "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" colSpan={2} style={{ ...td, fontWeight: 800, textAlign: "left", background: "var(--bg-elevated)" }}>
                  Totales
                </th>
                <td data-testid="comprobacion-total-debe" style={{ ...num, fontWeight: 800, background: "var(--bg-elevated)" }}>
                  {fmtAmount(c.totalDebe)}
                </td>
                <td style={{ ...num, fontWeight: 800, background: "var(--bg-elevated)" }}>{fmtAmount(c.totalHaber)}</td>
                <td style={{ ...num, fontWeight: 800, background: "var(--bg-elevated)" }}>{fmtAmount(c.totalDeudor)}</td>
                <td style={{ ...num, fontWeight: 800, background: "var(--bg-elevated)" }}>{fmtAmount(c.totalAcreedor)}</td>
              </tr>
            </tfoot>
          </table>
        </TableFrame>
      )}
    </section>
  );
}

function ReportCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "var(--bg-sidebar)",
        color: "var(--ink-side)",
        borderRadius: "var(--r-lg)",
        padding: "22px 24px",
      }}
    >
      <div
        style={{
          font: "900 16px/1.1 var(--f-display)",
          color: "var(--ink-side-strong)",
          letterSpacing: "-0.01em",
        }}
      >
        {title}
      </div>
      <div
        style={{
          font: "500 11px/1.3 var(--f-sans)",
          color: "var(--ink-side-soft)",
          marginTop: 4,
          marginBottom: 18,
        }}
      >
        {subtitle}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {children}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
  highlight,
  negative,
}: {
  label: string;
  value: number;
  strong?: boolean;
  highlight?: boolean;
  negative?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: 12,
      }}
    >
      <span
        style={{
          font: `${strong || highlight ? "700" : "500"} ${highlight ? 14 : 13}px/1.2 var(--f-sans)`,
          color: highlight ? "var(--ink-side-strong)" : "var(--ink-side)",
        }}
      >
        {label}
      </span>
      <span
        style={{
          font: `${strong || highlight ? "800" : "600"} ${highlight ? 18 : 13}px/1 var(--f-mono)`,
          color: highlight ? "var(--ink-side-strong)" : "var(--ink-side)",
          whiteSpace: "nowrap",
        }}
      >
        {negative && value !== 0 ? "− " : ""}${fmtAmount(Math.abs(value))}
      </span>
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: "var(--ink-side-soft)" }} />;
}
