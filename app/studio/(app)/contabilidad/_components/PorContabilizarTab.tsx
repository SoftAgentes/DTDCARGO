"use client";

/**
 * Tab "Por contabilizar" (`?tab=subdiario`, SDD-0557). Solo lectura.
 *
 * Responde «¿por qué el mayor no cuadra con las facturas y las CxP?»:
 *  1. Subdiario contra mayor: saldo abierto de los documentos contra 1.1.2
 *     (clientes) y 2.1.1 (proveedores), a hoy.
 *  2. Documentos vivos sin asiento vivo (B3), con enlace al documento.
 *  3. Conteo de anulados que conservan un asiento vivo (B1); el detalle va en
 *     el CSV de documentos.
 *
 * No asienta nada: reparar el posting es la fase 2 del plan contable.
 */

import { Badge, type BadgeTone } from "@/app/studio/_components/ui/Badge";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { TableFrame } from "@/app/studio/_components/ui/DataTable";
import { downloadTextFile } from "@/app/studio/_components/ui/download";
import { Icon } from "@/app/studio/_components/icons";
import {
  ETIQUETA_CUADRE,
  ETIQUETA_MOTIVO,
  ETIQUETA_TIPO,
  LISTADO_POR_TIPO,
  TIPOS_DE_DOCUMENTO,
  sinAsientoCsv,
  subdiarioCsv,
  type CuadreDelLibro,
  type EstadoCuadre,
  type LadoCuadre,
  type MotivoHallazgo,
} from "@/lib/studio/accounting/libro-control";
import { fmtAmount } from "./format";

const TONO_CUADRE: Record<EstadoCuadre, BadgeTone> = {
  cuadra: "success",
  no_cuadra: "warning",
  no_comparable: "neutral",
  sin_cuenta: "danger",
  sin_movimiento: "neutral",
};

const TONO_MOTIVO: Record<MotivoHallazgo, BadgeTone> = {
  sin_asiento: "warning",
  asiento_anulado: "danger",
  sin_monto: "neutral",
  anulado_con_asiento_vivo: "danger",
};

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

function Encabezado({
  id,
  titulo,
  sub,
  accion,
}: {
  id: string;
  titulo: string;
  sub: string;
  accion?: React.ReactNode;
}) {
  return (
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

function BotonCsv({
  csv,
  vacio,
}: {
  csv: { filename: string; content: string } | null;
  vacio: string;
}) {
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

function FilaCuadre({ lado }: { lado: LadoCuadre }) {
  return (
    <tr>
      <th scope="row" style={{ ...td, textAlign: "left", fontWeight: 700 }}>
        {lado.nombre}
        <span style={{ font: "600 11.5px/1 var(--f-mono)", color: "var(--ink-soft)" }}> · {lado.cuenta}</span>
      </th>
      <td style={num}>{lado.documentos}</td>
      <td style={num}>{fmtAmount(lado.subdiarioUsd)}</td>
      <td style={num}>{lado.mayorUsd == null ? "—" : fmtAmount(lado.mayorUsd)}</td>
      <td style={num}>{lado.diferenciaUsd == null ? "—" : fmtAmount(lado.diferenciaUsd)}</td>
      <td style={td}>
        <Badge tone={TONO_CUADRE[lado.estado]} size="sm">
          {ETIQUETA_CUADRE[lado.estado]}
        </Badge>
      </td>
    </tr>
  );
}

export function PorContabilizarTab({ cuadre }: { cuadre: CuadreDelLibro }) {
  const { subdiario, documentos } = cuadre;
  const sinAsiento = documentos.sinAsiento;
  const anulados = TIPOS_DE_DOCUMENTO.map((t) => ({
    tipo: t,
    n: documentos.conteo[t].anuladosConAsiento,
  }));
  const totalAnulados = anulados.reduce((s, a) => s + a.n, 0);
  const notas: string[] = [];
  if (subdiario.clientes.estado === "no_comparable") {
    notas.push(
      "Clientes no es comparable: hay facturas en bolívares o yuanes, que hoy se asientan por su monto nominal y el cobro las convierte.",
    );
  }
  const sinConv = subdiario.clientes.sinConvertir;
  if (sinConv > 0) {
    notas.push(
      sinConv === 1
        ? "1 factura con saldo no suma: está en bolívares sin tasa o en yuanes."
        : `${sinConv} facturas con saldo no suman: están en bolívares sin tasa o en yuanes.`,
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-6)" }}>
      {/* 1 · Subdiario contra mayor */}
      <section aria-labelledby="titulo-subdiario" style={{ display: "flex", flexDirection: "column", gap: "var(--s-3)" }}>
        <Encabezado
          id="titulo-subdiario"
          titulo={`Subdiario contra mayor · saldos vivos al ${subdiario.fecha}`}
          sub="Saldo abierto (total menos pagado, en USD) de los documentos contra el saldo de su cuenta de control en el mayor."
          accion={<BotonCsv csv={subdiarioCsv(subdiario)} vacio="No hay datos para exportar." />}
        />
        <TableFrame>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
            <thead>
              <tr>
                <th scope="col" style={th}>Lado</th>
                <th scope="col" style={{ ...th, textAlign: "right" }}>Documentos abiertos</th>
                <th scope="col" style={{ ...th, textAlign: "right" }}>Saldo de documentos (USD)</th>
                <th scope="col" style={{ ...th, textAlign: "right" }}>Saldo en el mayor (USD)</th>
                <th scope="col" style={{ ...th, textAlign: "right" }}>Diferencia (USD)</th>
                <th scope="col" style={th}>Estado</th>
              </tr>
            </thead>
            <tbody>
              <FilaCuadre lado={subdiario.clientes} />
              <FilaCuadre lado={subdiario.proveedores} />
            </tbody>
          </table>
        </TableFrame>
        <p style={{ margin: 0, font: "500 11.5px/1.5 var(--f-sans)", color: "var(--ink-soft)", maxWidth: "90ch" }}>
          Clientes: facturas emitidas, parciales, pagadas o vencidas; sin borradores ni anuladas, por
          eso puede no coincidir con «Por cobrar» de Cobranzas. Proveedores: CxP no anuladas,
          convertidas con la misma regla del asiento. Diferencia = documentos − mayor.
          {notas.length > 0 && " "}
          {notas.join(" ")}
        </p>
      </section>

      {/* 2 · Documentos sin asiento */}
      <section aria-labelledby="titulo-sin-asiento" style={{ display: "flex", flexDirection: "column", gap: "var(--s-3)" }}>
        <Encabezado
          id="titulo-sin-asiento"
          titulo="Documentos sin asiento"
          sub="Facturas, recibos, CxP y pagos vivos que no tienen un asiento asentado de su origen. El CSV incluye también los anulados con asiento vivo."
          accion={<BotonCsv csv={sinAsientoCsv(documentos)} vacio="No hay documentos que exportar." />}
        />
        <ul
          aria-label="Documentos revisados por tipo"
          style={{ display: "flex", gap: "var(--s-4)", flexWrap: "wrap", margin: 0, padding: 0, listStyle: "none" }}
        >
          {TIPOS_DE_DOCUMENTO.map((t) => {
            const c = documentos.conteo[t];
            return (
              <li key={t} style={{ font: "500 12px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
                <strong style={{ color: "var(--ink)" }}>{ETIQUETA_TIPO[t]}</strong>: {c.sinAsiento} sin
                asiento de {c.revisados}
                {c.sinMonto > 0 ? ` · ${c.sinMonto} sin monto` : ""}
              </li>
            );
          })}
        </ul>
        {sinAsiento.length === 0 ? (
          <EmptyState
            eyebrow="Por contabilizar"
            title="Todos los documentos tienen su asiento"
            description="Ninguna factura, recibo, CxP ni pago vivo está fuera del mayor."
          />
        ) : (
          <TableFrame>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
              <thead>
                <tr>
                  <th scope="col" style={th}>Tipo</th>
                  <th scope="col" style={th}>Documento</th>
                  <th scope="col" style={th}>Fecha</th>
                  <th scope="col" style={th}>Moneda</th>
                  <th scope="col" style={{ ...th, textAlign: "right" }}>Monto</th>
                  <th scope="col" style={th}>Motivo</th>
                </tr>
              </thead>
              <tbody>
                {sinAsiento.map((h) => (
                  <tr key={`${h.tipo}:${h.codigo}`}>
                    <td style={td}>{ETIQUETA_TIPO[h.tipo]}</td>
                    <td style={{ ...td, font: "700 12px/1 var(--f-mono)", whiteSpace: "nowrap" }}>
                      <a href={h.enlace} style={{ color: "var(--wine-text)" }}>
                        {h.codigo}
                      </a>
                    </td>
                    <td style={{ ...td, font: "500 12px/1 var(--f-mono)", whiteSpace: "nowrap" }}>{h.fecha ?? "—"}</td>
                    <td style={td}>{h.moneda}</td>
                    <td style={num}>{fmtAmount(h.monto)}</td>
                    <td style={td}>
                      <Badge tone={TONO_MOTIVO[h.motivo]} size="sm">
                        {ETIQUETA_MOTIVO[h.motivo]}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableFrame>
        )}
      </section>

      {/* 3 · Anulados con asiento vivo (B1): conteo; el detalle va en el CSV */}
      <section aria-labelledby="titulo-anulados" style={{ display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
        <h2 id="titulo-anulados" style={{ margin: 0, font: "900 16px/1.2 var(--f-display)", color: "var(--ink)" }}>
          Anulados con asiento vivo
        </h2>
        {totalAnulados === 0 ? (
          <p style={{ margin: 0, font: "500 12.5px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
            Ningún documento anulado conserva un asiento vivo.
          </p>
        ) : (
          <>
            <p style={{ margin: 0, font: "500 12.5px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
              Inflan el mayor: el documento ya no vale y su asiento sigue contando. El detalle está en el CSV de documentos.
            </p>
            <ul style={{ display: "flex", gap: "var(--s-4)", flexWrap: "wrap", margin: 0, padding: 0, listStyle: "none" }}>
              {anulados
                .filter((a) => a.n > 0)
                .map((a) => (
                  <li key={a.tipo} style={{ font: "600 12.5px/1.4 var(--f-sans)" }}>
                    <a href={LISTADO_POR_TIPO[a.tipo]} style={{ color: "var(--wine-text)" }}>
                      {ETIQUETA_TIPO[a.tipo]}: {a.n}
                    </a>
                  </li>
                ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
