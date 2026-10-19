/**
 * SDD-0287 · El estado de cuenta en PDF (@react-pdf/renderer).
 *
 * Es el documento que el cliente le pasa a su contador y el que el asesor manda
 * cuando alguien pregunta "¿cuánto debo?". Hasta ahora el saldo sólo existía en
 * pantalla: en el portal (SDD-0177) y en el Studio (SDD-0281).
 *
 * ## No recalcula nada — y eso es el punto
 *
 * Recibe un `StatementLedger` ya armado por `buildStatementLedger`, la misma
 * función pura que alimenta las dos pantallas. Si el papel tuviera su propio
 * cálculo, el cliente podría estar mirando un saldo en su portal y otro en el
 * PDF que se acaba de bajar — que es exactamente la discusión que un estado de
 * cuenta viene a evitar.
 *
 * Por eso este módulo no tiene ni una suma: sólo formatea y pinta.
 *
 * ## Lo que el papel dice y la pantalla también
 *
 * Dos avisos viajan con el documento porque describen límites reales del dato,
 * no letra chica:
 *
 *  - **La fecha del abono es la del vencimiento de su factura, no la del pago.**
 *    El modelo guarda cuánto se pagó, no cuándo (decisión del founder,
 *    2026-07-29, tomada sabiendo el desvío). Un abono puede aparecer con fecha
 *    futura si su factura todavía no vence. Está en el portal y tiene que estar
 *    acá: un PDF que se guarda y se reenvía sobrevive a la pantalla.
 *  - **Si el cliente tiene facturas en más de una moneda**, el ledger se queda
 *    con la dominante y el resto queda fuera del saldo corrido. Callarlo haría
 *    que el papel pareciera el total de la cuenta cuando es una parte.
 *  - **Pagos recibidos en facturas anuladas** (SDD-0556). La anulada sale en el
 *    libro con cargo 0; lo que se le pagó no entra al saldo, pero el papel lo
 *    dice con el MISMO texto que la pantalla (`notaPagosEnAnuladas`).
 *
 * ## Identidad fiscal del emisor: apagada
 *
 * `legalName` y `rif` son opcionales y, si llegan, van bajo el membrete con
 * `lineasDeEmisor` (nunca se inventan). Hoy ninguna ruta los pasa: la regla de
 * marca los deja sólo en el schema y la excepción de SDD-0297 cubre sólo la
 * factura. Encenderlo es pasarlos desde la ruta cuando Sam lo conceda.
 *
 * Colores hardcodeados a valores de luz: react-pdf no lee CSS vars.
 */

import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { StatementLedger } from "@/lib/portal/statement-ledger";
import { notaPagosEnAnuladas } from "@/lib/portal/saldo-de-cuenta";
import { PDF, Membrete } from "./pdf-doc";
import { lineasDeEmisor } from "./factura-pdf";

/** Contacto del emisor para el pie. Todo opcional. */
export type EstadoDeCuentaEmisor = {
  tradeName: string;
  email: string;
  phone: string;
  website: string;
  /** Razón social. Sólo con la excepción de marca concedida (ver cabecera). */
  legalName?: string;
  /** RIF del emisor. Sólo con la excepción de marca concedida (ver cabecera). */
  rif?: string;
};

export type EstadoDeCuentaPdfInput = {
  clientName: string;
  /** Shipping Mark (`DTD-NNNN`). */
  markbox: string;
  ledger: StatementLedger;
  /** `YYYY-MM-DD` — el día en que se emitió el papel. */
  emitidoEl: string;
};

/** `USD 1,234.50`. */
export function montoConMoneda(n: number, currency: string): string {
  const v = Number.isFinite(Number(n)) ? Number(n) : 0;
  return `${currency} ${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v)}`;
}

/** `2026-08-24` → `24/08/2026`. `null` → `—`. */
export function fechaCorta(iso: string | null): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

const styles = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 48, paddingHorizontal: 44, fontSize: 10, color: PDF.INK },

  resumen: { flexDirection: "row", marginBottom: 20 },
  tarjeta: { flexGrow: 1, flexBasis: 0, paddingRight: 14 },
  tarjetaTitulo: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: PDF.MUTE,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  tarjetaValor: { fontSize: 14, fontFamily: "Helvetica-Bold" },
  saldoValor: { fontSize: 15, fontFamily: "Helvetica-Bold", color: PDF.NAVY },

  thead: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: PDF.NAVY,
    paddingBottom: 4,
    marginBottom: 2,
  },
  tr: {
    flexDirection: "row",
    paddingVertical: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: PDF.BORDER,
  },
  th: { fontSize: 8, fontFamily: "Helvetica-Bold", color: PDF.MUTE, textTransform: "uppercase" },
  cFecha: { width: 62 },
  cConcepto: { flexGrow: 1, flexBasis: 0 },
  cRef: { width: 86 },
  cMonto: { width: 84, textAlign: "right" },
  cSaldo: { width: 88, textAlign: "right" },
  celda: { fontSize: 9.5 },
  celdaFuerte: { fontSize: 9.5, fontFamily: "Helvetica-Bold" },

  aviso: {
    fontSize: 8.5,
    color: PDF.INK,
    marginTop: 14,
    lineHeight: 1.45,
  },
  pie: { fontSize: 8.5, color: PDF.MUTE, marginTop: 18, lineHeight: 1.45 },
});

export function EstadoDeCuentaDocument({
  input,
  emisor,
}: {
  input: EstadoDeCuentaPdfInput;
  emisor?: EstadoDeCuentaEmisor;
}) {
  const { ledger } = input;
  const moneda = ledger.currency;
  const hayAbonos = ledger.moves.some((m) => m.kind === "abono");
  const notaAnuladas = notaPagosEnAnuladas(ledger.voidedPayments);

  return (
    <Document title={`Estado de cuenta ${input.markbox}`} author="DTD Cargo">
      <Page size="A4" style={styles.page}>
        <Membrete
          docTitle="Estado de cuenta"
          metaLines={[
            input.clientName,
            `Shipping Mark: ${input.markbox}`,
            `Emitido: ${fechaCorta(input.emitidoEl)}`,
          ]}
          emisorLines={lineasDeEmisor(
            emisor ? { legalName: emisor.legalName ?? "", rif: emisor.rif ?? "" } : undefined,
          )}
        />

        <View style={styles.resumen}>
          <View style={styles.tarjeta}>
            <Text style={styles.tarjetaTitulo}>Facturado</Text>
            <Text style={styles.tarjetaValor}>
              {montoConMoneda(ledger.totalCargo, moneda)}
            </Text>
          </View>
          <View style={styles.tarjeta}>
            <Text style={styles.tarjetaTitulo}>Abonado</Text>
            <Text style={styles.tarjetaValor}>
              {montoConMoneda(ledger.totalAbono, moneda)}
            </Text>
          </View>
          <View style={styles.tarjeta}>
            <Text style={styles.tarjetaTitulo}>Saldo</Text>
            <Text style={styles.saldoValor}>
              {montoConMoneda(ledger.balance, moneda)}
            </Text>
          </View>
        </View>

        {ledger.moves.length === 0 ? (
          <Text style={styles.celda}>
            Sin movimientos: todavía no hay facturas emitidas en esta cuenta.
          </Text>
        ) : (
          <>
            <View style={styles.thead}>
              <Text style={[styles.th, styles.cFecha]}>Fecha</Text>
              <Text style={[styles.th, styles.cConcepto]}>Concepto</Text>
              <Text style={[styles.th, styles.cRef]}>Envío</Text>
              <Text style={[styles.th, styles.cMonto]}>Cargo</Text>
              <Text style={[styles.th, styles.cMonto]}>Abono</Text>
              <Text style={[styles.th, styles.cSaldo]}>Saldo</Text>
            </View>

            {ledger.moves.map((m, i) => (
              <View key={`${m.concept}-${i}`} style={styles.tr} wrap={false}>
                <Text style={[styles.celda, styles.cFecha]}>{fechaCorta(m.date)}</Text>
                <Text style={[styles.celda, styles.cConcepto]}>{m.concept}</Text>
                <Text style={[styles.celda, styles.cRef]}>{m.reference ?? "—"}</Text>
                <Text style={[styles.celda, styles.cMonto]}>
                  {m.kind === "cargo" ? montoConMoneda(m.amount, moneda) : ""}
                </Text>
                {/* El signo `−` distingue el abono, no el color: en papel en
                    blanco y negro un verde no se ve (y en pantalla tampoco
                    llegaba al contraste de body — ver StatementLedgerTable). */}
                <Text style={[styles.celda, styles.cMonto]}>
                  {m.kind === "abono" ? `−${montoConMoneda(m.amount, moneda)}` : ""}
                </Text>
                <Text style={[styles.celdaFuerte, styles.cSaldo]}>
                  {montoConMoneda(m.balance, moneda)}
                </Text>
              </View>
            ))}
          </>
        )}

        {ledger.mixedCurrencies ? (
          <Text style={styles.aviso}>
            Esta cuenta tiene facturas en más de una moneda. Acá se muestran sólo
            las de {moneda}; el resto queda fuera de este saldo.
          </Text>
        ) : null}

        {notaAnuladas ? <Text style={styles.aviso}>{notaAnuladas}</Text> : null}

        {hayAbonos ? (
          <Text style={styles.aviso}>
            La fecha del abono es la de vencimiento de su factura, no la del pago:
            el sistema registra cuánto se pagó, no cuándo. Un abono puede aparecer
            con fecha futura si su factura todavía no vence.
          </Text>
        ) : null}

        <Text style={styles.pie}>
          {[emisor?.tradeName || "DTD Cargo", emisor?.email, emisor?.phone, emisor?.website]
            .filter(Boolean)
            .join(" · ")}
          {"\n"}
          Documento informativo emitido por DTD Cargo. Los montos se expresan en{" "}
          {moneda}.
        </Text>
      </Page>
    </Document>
  );
}
