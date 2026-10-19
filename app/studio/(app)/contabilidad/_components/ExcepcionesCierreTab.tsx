"use client";

/**
 * Tab «Excepciones al cierre» (`?tab=excepciones`, SDD-0566). Solo lectura.
 *
 * Como el reporte «Exceptions to Closing Date» de QuickBooks: cada alta,
 * cambio o borrado con fecha dentro del cierre, con quién, cómo se autorizó,
 * cuándo, el motivo y el monto antes y después. Debajo, el historial del
 * cierre: fecha, modo y superclave (nunca su valor), intentos fallidos y
 * bloqueos. Las dos tablas tienen su CSV.
 */

import {
  describirEvento,
  ETIQUETA_AUTORIZACION,
  ETIQUETA_OPERACION,
  excepcionesCsv,
  fechaCorta,
  fechaHoraCaracas,
  historialCsv,
  type EventoDelCierre,
  type ExcepcionAlCierre,
} from "@/lib/studio/accounting/cierre-excepciones";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { TableFrame } from "@/app/studio/_components/ui/DataTable";
import { downloadTextFile } from "@/app/studio/_components/ui/download";
import { Icon } from "@/app/studio/_components/icons";
import { fmtAmount } from "./format";

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
  verticalAlign: "top",
};
const num: React.CSSProperties = {
  ...td,
  font: "600 12.5px/1 var(--f-mono)",
  textAlign: "right",
  whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
};
const fecha: React.CSSProperties = { ...td, font: "600 12px/1.3 var(--f-mono)", whiteSpace: "nowrap" };

function Encabezado({ id, titulo, sub, accion }: { id: string; titulo: string; sub: string; accion: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "var(--s-3)", flexWrap: "wrap" }}>
      <div>
        <h2 id={id} style={{ margin: 0, font: "900 16px/1.2 var(--f-display)", color: "var(--ink)" }}>
          {titulo}
        </h2>
        <p style={{ margin: "var(--s-1) 0 0", font: "500 12px/1.4 var(--f-sans)", color: "var(--ink-soft)", maxWidth: "80ch" }}>
          {sub}
        </p>
      </div>
      {accion}
    </div>
  );
}

function BotonCsv({ csv, vacio }: { csv: { filename: string; content: string } | null; vacio: string }) {
  return (
    <ActionButton
      variant="ghost"
      size="sm"
      idleLabel="Exportar CSV"
      idleIcon={Icon.download(14)}
      successLabel="Descargado"
      successIcon={Icon.check(14)}
      disabled={!csv}
      title={csv ? "Descargar en CSV" : vacio}
      onAction={async () => {
        if (!csv) return { error: vacio };
        downloadTextFile(csv.filename, csv.content);
      }}
    />
  );
}

export function ExcepcionesCierreTab({
  excepciones,
  historial,
}: {
  excepciones: ExcepcionAlCierre[];
  historial: EventoDelCierre[];
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-6)" }}>
      <section aria-labelledby="titulo-excepciones" style={{ display: "flex", flexDirection: "column", gap: "var(--s-3)" }}>
        <Encabezado
          id="titulo-excepciones"
          titulo="Excepciones al cierre"
          sub="Cada alta, cambio o borrado de un asiento con fecha dentro del cierre: quién lo hizo, cómo se autorizó, cuándo, el motivo y el monto antes y después."
          accion={<BotonCsv csv={excepciones.length ? excepcionesCsv(excepciones) : null} vacio="No hay excepciones que exportar." />}
        />
        {excepciones.length === 0 ? (
          <EmptyState
            eyebrow="Sin excepciones"
            title="Nadie cambió un período cerrado."
            description="Cuando alguien cree, asiente, anule o elimine un asiento con fecha dentro del cierre, queda aquí."
          />
        ) : (
          <TableFrame>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 920 }}>
              <thead>
                <tr>
                  <th scope="col" style={th}>Cuándo</th>
                  <th scope="col" style={th}>Asiento</th>
                  <th scope="col" style={th}>Cambio</th>
                  <th scope="col" style={th}>Usuario</th>
                  <th scope="col" style={th}>Autorización</th>
                  <th scope="col" style={th}>Motivo</th>
                  <th scope="col" style={{ ...th, textAlign: "right" }}>Antes</th>
                  <th scope="col" style={{ ...th, textAlign: "right" }}>Después</th>
                </tr>
              </thead>
              <tbody>
                {excepciones.map((x) => (
                  <tr key={x.id}>
                    <td style={fecha}>{fechaHoraCaracas(x.createdAt)}</td>
                    <th scope="row" style={{ ...td, textAlign: "left", whiteSpace: "nowrap" }}>
                      <span style={{ font: "700 12.5px/1.3 var(--f-mono)" }}>{x.entryCode}</span>
                      <br />
                      <span style={{ font: "500 11.5px/1.3 var(--f-sans)", color: "var(--ink-soft)" }}>
                        del {fechaCorta(x.entryDate)} · cierre al {fechaCorta(x.closingDate)}
                      </span>
                    </th>
                    <td style={td}>{ETIQUETA_OPERACION[x.operation]}</td>
                    <td style={td}>{x.userName}</td>
                    <td style={td}>{ETIQUETA_AUTORIZACION[x.authorizedBy]}</td>
                    <td style={{ ...td, maxWidth: 280 }}>{x.reason}</td>
                    <td style={num}>{fmtAmount(x.amountBefore)}</td>
                    <td style={num}>{fmtAmount(x.amountAfter)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableFrame>
        )}
        <p style={{ margin: 0, font: "500 11.5px/1.5 var(--f-sans)", color: "var(--ink-soft)", maxWidth: "90ch" }}>
          «Con superclave» dice quién hizo el cambio, no quién tecleó la superclave: si varias personas la conocen, cámbiala cuando alguien deje de deber conocerla. Horas de Caracas.
        </p>
      </section>

      <section aria-labelledby="titulo-historial-cierre" style={{ display: "flex", flexDirection: "column", gap: "var(--s-3)" }}>
        <Encabezado
          id="titulo-historial-cierre"
          titulo="Historial del cierre"
          sub="Quién movió la fecha de cierre y cuándo, los cambios de modo, la superclave definida, cambiada o restablecida (nunca su valor) y los intentos fallidos."
          accion={<BotonCsv csv={historial.length ? historialCsv(historial) : null} vacio="No hay historial que exportar." />}
        />
        {historial.length === 0 ? (
          <EmptyState eyebrow="Sin historial" title="El cierre no tiene cambios registrados." description="El historial empieza con la migración 0493." />
        ) : (
          <TableFrame>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
              <thead>
                <tr>
                  <th scope="col" style={th}>Cuándo</th>
                  <th scope="col" style={th}>Qué pasó</th>
                  <th scope="col" style={th}>Usuario</th>
                  <th scope="col" style={th}>Motivo</th>
                </tr>
              </thead>
              <tbody>
                {historial.map((e) => (
                  <tr key={e.id}>
                    <td style={fecha}>{fechaHoraCaracas(e.createdAt)}</td>
                    <td style={td}>{describirEvento(e)}</td>
                    <td style={td}>{e.userName}</td>
                    <td style={{ ...td, maxWidth: 320 }}>{e.reason ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableFrame>
        )}
      </section>
    </div>
  );
}
