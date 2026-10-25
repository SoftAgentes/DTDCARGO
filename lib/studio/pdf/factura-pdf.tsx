/**
 * SDD-0281 · La factura en PDF (@react-pdf/renderer).
 *
 * El botón "PDF" de Facturación estaba deshabilitado desde que se construyó el
 * módulo (SDD-0021). El motor ya existía —SDD-0117 lo montó para los documentos
 * de nómina—; lo que faltaba era aplicarlo al carril que le habla al cliente.
 *
 * ## Una entrada, dos llamadores
 *
 * El Studio lee la factura con `getInvoiceByCode` (forma `Invoice`) y el portal
 * con `getMyInvoice` (forma `PortalInvoiceDetail`, acotada por RLS al markbox
 * del cliente). Las dos formas NO coinciden. Para no tener dos facturas de
 * papel que se desincronizan, este módulo define su propia entrada estrecha
 * —`FacturaPdfInput`— y cada route mapea la suya. El documento no sabe quién lo
 * pidió, así que el cliente y el equipo ven exactamente el mismo papel.
 *
 * ## Qué es puro y qué no
 *
 * `construirFilas` y `calcularTotales` no renderizan ni tocan la DB: se prueban
 * en Vitest y son la fuente única de lo que dice el documento. El componente
 * sólo los pinta. Mismo reparto que `buildPayslipLines` en SDD-0117.
 *
 * ## La identidad fiscal del emisor: excepción CONCEDIDA (SDD-0297)
 *
 * La regla de marca manda razón social y RIF sólo al schema, nunca a texto
 * visible, y el finiquito sigue respetándola. Para la factura el founder
 * concedió la excepción el 2026-08-25: es un documento fiscal y sin la
 * identidad del emisor no le sirve al contador del cliente.
 *
 * Los datos ya existían — `tenants.legal_name` y `tenants.rif` (SDD-0120, la
 * razón social es obligatoria en el validador). Lo que faltaba era que la ruta
 * los pasara: armaba el emisor con `tradeName` y los dejaba afuera.
 *
 * ## Lo que sigue sin llevar: el RIF del CLIENTE
 *
 * `invoices` congela `client_name` y `client_markbox` al emitir, pero no el
 * documento. Sacarlo en vivo de `clients` haría que una factura vieja cambiara
 * si el cliente corrige su RIF — y una factura que se reescribe sola deja de
 * ser un comprobante. Denormalizarlo pide migración y sólo cubre las nuevas.
 * Es una bifurcación de diseño, no un olvido: decisión abierta en el spec.
 *
 * Colores hardcodeados a valores de luz: react-pdf no lee CSS vars, y el PDF es
 * un documento formal, no la app.
 */

import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { isInvoiceStatus, statusLabel } from "@/lib/studio/invoice-types";
import { lineaDocumentoCliente } from "@/lib/studio/invoice-client-doc";
import { PDF, Membrete } from "./pdf-doc";
import { indicacionPagosEnAnuladas } from "@/lib/portal/saldo-de-cuenta";

// ╔═══════════════════════════════════════════════════════════╗
// ║ Entrada                                                   ║
// ╚═══════════════════════════════════════════════════════════╝

/** Una línea tal como la guarda `invoices.lines`. */
export type FacturaPdfLinea = {
  desc: string;
  qty: number;
  unitPrice: number;
};

/**
 * Lo mínimo que el papel necesita saber. Deliberadamente NO es `Invoice` ni
 * `PortalInvoiceDetail`: es el contrato entre los dos.
 */
export type FacturaPdfInput = {
  code: string;
  clientName: string;
  /** Documento fiscal del cliente, congelado al emitir (SDD-0298). */
  clientRif?: string | null;
  /** `empresa` (RIF) o `persona` (cédula) — decide la etiqueta. */
  clientDocKind?: string | null;
  /** Domicilio fiscal del titular, sellado al emitir (SDD-0487). null = no se imprime. */
  clientFiscalAddress?: string | null;
  /** Shipping Mark del cliente (`DTD-NNNN`). El portal no lo trae → null. */
  clientMarkbox: string | null;
  shipmentCode: string | null;
  currency: string;
  /** Tasa de cambio del día si la factura no está en USD. */
  fxRate: number | null;
  ivaRate: number;
  base: number;
  ivaAmount: number;
  total: number;
  paid: number;
  status: string;
  /** `YYYY-MM-DD` */
  issuedAt: string | null;
  /** `YYYY-MM-DD` */
  dueDate: string | null;
  lines: FacturaPdfLinea[];
  notes: string | null;
};

/**
 * Datos de contacto y cobro del emisor, tal como los guarda Administración ›
 * Datos de la empresa. Todo opcional: un tenant que no los cargó saca igual su
 * factura, sólo que sin el pie de pago.
 */
export type FacturaPdfEmisor = {
  /** Nombre comercial ("DTD Cargo"). */
  tradeName: string;
  /** Razón social ("INVERSIONES DTD SERVICES, C.A"). Vacío si no se cargó. */
  legalName: string;
  /** RIF del emisor ("J-50648869-8"). Vacío si no se cargó. */
  rif: string;
  email: string;
  phone: string;
  website: string;
  cuentas: {
    bankName: string;
    accountType: string;
    currency: string;
    accountNumber: string;
  }[];
};

// ╔═══════════════════════════════════════════════════════════╗
// ║ Capa pura                                                 ║
// ╚═══════════════════════════════════════════════════════════╝

/**
 * Las líneas de identidad fiscal que van bajo el membrete.
 *
 * Pura y probada: si el tenant no cargó los datos devuelve `[]` y el membrete
 * sale como antes. **Nunca inventa un RIF** — sin dato, no hay línea; una
 * factura con un identificador fiscal equivocado es peor que una sin él.
 */
export function lineasDeEmisor(
  emisor?: Pick<FacturaPdfEmisor, "legalName" | "rif">,
): string[] {
  if (!emisor) return [];
  const razon = emisor.legalName.trim();
  const rif = emisor.rif.trim();
  if (!razon && !rif) return [];
  // Van juntos en un renglón: es como se lee en una factura venezolana.
  return [[razon, rif ? `RIF ${rif}` : ""].filter(Boolean).join(" · ")];
}

export type FacturaPdfFila = {
  desc: string;
  qty: number;
  unitPrice: number;
  /** `qty × unitPrice`, redondeado a centavo. */
  amount: number;
};

function round2(n: number): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

/**
 * Las filas del cuerpo. Descarta las líneas sin descripción Y sin monto (basura
 * de un borrador a medio llenar); una línea con descripción y cantidad 0 SÍ se
 * imprime — puede ser un concepto informativo, y silenciarla cambiaría el
 * documento sin avisar.
 */
export function construirFilas(lineas: FacturaPdfLinea[]): FacturaPdfFila[] {
  if (!Array.isArray(lineas)) return [];
  const filas: FacturaPdfFila[] = [];
  for (const l of lineas) {
    const desc = typeof l?.desc === "string" ? l.desc.trim() : "";
    const qty = Number.isFinite(Number(l?.qty)) ? Number(l.qty) : 0;
    const unitPrice = Number.isFinite(Number(l?.unitPrice)) ? Number(l.unitPrice) : 0;
    if (!desc && qty === 0 && unitPrice === 0) continue;
    filas.push({
      desc: desc || "Concepto",
      qty,
      unitPrice,
      amount: round2(qty * unitPrice),
    });
  }
  return filas;
}

export type FacturaPdfTotales = {
  /** Suma de las filas — lo que el papel puede demostrar. */
  sumaLineas: number;
  base: number;
  ivaRate: number;
  ivaAmount: number;
  total: number;
  paid: number;
  balance: number;
  /**
   * `true` si la suma de las líneas NO cuadra con la base guardada. No se
   * corrige ni se oculta: el documento imprime la base de la DB (que es la que
   * se cobró) y esta bandera deja que el papel lo diga. Un documento que
   * "arregla" el número en silencio es peor que uno que no cuadra.
   */
  descuadre: boolean;
};

export function calcularTotales(inv: FacturaPdfInput): FacturaPdfTotales {
  // 🔴 Se suman los productos CRUDOS y se redondea UNA vez al final, que es
  // exactamente lo que hace `calcInvoiceTotals` al calcular `base_amount`.
  //
  // Sumar los montos ya redondeados de cada fila NO es lo mismo y da distinto:
  // tres líneas de 33.333 dan 99.99 redondeando por línea y 100.00 redondeando
  // al final. Con la primera fórmula el papel habría gritado "descuadre" en
  // facturas perfectamente sanas, y una alarma que suena sin motivo se aprende
  // a ignorar — que es la forma de que el descuadre de verdad pase inadvertido.
  //
  // El `amount` de cada fila SÍ se redondea: es un monto que se imprime, y un
  // monto impreso tiene dos decimales. Que las filas visibles sumen un centavo
  // menos que la base es inherente a mostrar dinero, y es lo mismo que hace la
  // app en pantalla.
  const sumaLineas = round2(
    construirFilas(inv.lines).reduce((a, f) => a + f.qty * f.unitPrice, 0),
  );
  const base = round2(inv.base);
  const paid = round2(inv.paid);
  const total = round2(inv.total);
  return {
    sumaLineas,
    base,
    ivaRate: Number.isFinite(Number(inv.ivaRate)) ? Number(inv.ivaRate) : 0,
    ivaAmount: round2(inv.ivaAmount),
    total,
    paid,
    // SDD-0556 · una anulada no tiene saldo, aunque se le haya pagado una
    // parte: el papel no puede pedirle al cliente que pague una factura que ya
    // no existe. Lo abonado se sigue imprimiendo.
    balance: facturaAnulada(inv) ? 0 : round2(total - paid),
    descuadre: Math.abs(sumaLineas - base) >= 0.01,
  };
}

/** ¿El papel es de una factura anulada? Decide el saldo y el aviso visible. */
export function facturaAnulada(inv: Pick<FacturaPdfInput, "status">): boolean {
  return inv.status === "anulada";
}

/** `USD 1,234.50` — código de moneda delante, como en el resto del ERP. */
export function montoConMoneda(n: number, currency: string): string {
  const v = Number.isFinite(Number(n)) ? Number(n) : 0;
  const formateado = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);
  return `${currency} ${formateado}`;
}

/** `2026-08-23` → `23/08/2026`. Devuelve `—` si no hay fecha. */
export function fechaCorta(iso: string | null): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/**
 * La etiqueta del estado sale de `invoice-types` — la MISMA que pinta el badge
 * en pantalla. Tener un mapa propio acá dejaría el papel diciendo "Pago
 * parcial" donde la app dice "Parcial", y nadie lo notaría hasta que un cliente
 * preguntara por la diferencia. Si el status llega fuera del enum (un valor
 * nuevo que el papel todavía no conoce), se imprime crudo en vez de mentir.
 */
export function estadoLabel(status: string): string {
  return isInvoiceStatus(status) ? statusLabel(status) : status;
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Documento                                                 ║
// ╚═══════════════════════════════════════════════════════════╝

const styles = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 48, paddingHorizontal: 44, fontSize: 10, color: PDF.INK },
  bloque: { marginBottom: 18 },
  bloqueTitulo: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: PDF.MUTE,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 5,
  },
  dosColumnas: { flexDirection: "row", justifyContent: "space-between" },
  columna: { flexGrow: 1, flexBasis: 0, paddingRight: 12 },
  dato: { fontSize: 10, marginBottom: 2 },
  datoFuerte: { fontSize: 10.5, fontFamily: "Helvetica-Bold" },

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
  cDesc: { flexGrow: 1, flexBasis: 0 },
  cQty: { width: 54, textAlign: "right" },
  cPrecio: { width: 84, textAlign: "right" },
  cMonto: { width: 92, textAlign: "right" },

  totalFila: { flexDirection: "row", justifyContent: "flex-end", paddingVertical: 3 },
  totalEtiqueta: { width: 132, textAlign: "right", fontSize: 10, color: PDF.MUTE },
  totalValor: { width: 100, textAlign: "right", fontSize: 10 },
  granTotalFila: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingTop: 7,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: PDF.NAVY,
  },
  granTotalEtiqueta: {
    width: 132,
    textAlign: "right",
    fontSize: 11.5,
    fontFamily: "Helvetica-Bold",
  },
  granTotalValor: {
    width: 100,
    textAlign: "right",
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: PDF.NAVY,
  },
  saldoEtiqueta: {
    width: 132,
    textAlign: "right",
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: PDF.INK,
  },
  saldoValor: {
    width: 100,
    textAlign: "right",
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: PDF.DANGER,
  },

  aviso: { fontSize: 8.5, color: PDF.DANGER, marginTop: 8 },
  nota: { fontSize: 9, color: PDF.INK, marginTop: 4, lineHeight: 1.4 },
  pie: { fontSize: 8.5, color: PDF.MUTE, marginTop: 22, lineHeight: 1.45 },
});

export function FacturaDocument({
  invoice,
  emisor,
}: {
  invoice: FacturaPdfInput;
  emisor?: FacturaPdfEmisor;
}) {
  const filas = construirFilas(invoice.lines);
  const t = calcularTotales(invoice);
  const llevaIva = t.ivaRate > 0;

  // SDD-0298: el documento va ARRIBA del Shipping Mark — el Mark es un código
  // interno nuestro; el que identifica al cliente ante el fisco es éste.
  const docCliente = lineaDocumentoCliente(invoice.clientRif, invoice.clientDocKind);

  const metaLines = [
    `Emitida: ${fechaCorta(invoice.issuedAt)}`,
    `Vence: ${fechaCorta(invoice.dueDate)}`,
    `Estado: ${estadoLabel(invoice.status)}`,
  ];
  if (invoice.fxRate) metaLines.push(`Tasa aplicada: ${invoice.fxRate}`);

  return (
    <Document title={`Factura ${invoice.code}`} author="DTD Cargo">
      <Page size="A4" style={styles.page}>
        <Membrete
          docTitle={`Factura ${invoice.code}`}
          metaLines={metaLines}
          emisorLines={lineasDeEmisor(emisor)}
        />

        <View style={[styles.bloque, styles.dosColumnas]}>
          <View style={styles.columna}>
            <Text style={styles.bloqueTitulo}>Cliente</Text>
            <Text style={styles.datoFuerte}>{invoice.clientName}</Text>
            {docCliente ? <Text style={styles.dato}>{docCliente}</Text> : null}
            {invoice.clientFiscalAddress ? (
              <Text style={styles.dato}>Domicilio fiscal: {invoice.clientFiscalAddress}</Text>
            ) : null}
            {invoice.clientMarkbox ? (
              <Text style={styles.dato}>Shipping Mark: {invoice.clientMarkbox}</Text>
            ) : null}
          </View>
          <View style={styles.columna}>
            <Text style={styles.bloqueTitulo}>Envío</Text>
            <Text style={styles.dato}>{invoice.shipmentCode ?? "Sin envío ligado"}</Text>
            <Text style={styles.dato}>Moneda: {invoice.currency}</Text>
          </View>
        </View>

        <View style={styles.thead}>
          <Text style={[styles.th, styles.cDesc]}>Concepto</Text>
          <Text style={[styles.th, styles.cQty]}>Cant.</Text>
          <Text style={[styles.th, styles.cPrecio]}>P. unitario</Text>
          <Text style={[styles.th, styles.cMonto]}>Monto</Text>
        </View>

        {filas.length === 0 ? (
          <View style={styles.tr}>
            <Text style={[styles.dato, styles.cDesc]}>Sin líneas detalladas.</Text>
          </View>
        ) : (
          filas.map((f, i) => (
            <View key={`${f.desc}-${i}`} style={styles.tr}>
              <Text style={[styles.dato, styles.cDesc]}>{f.desc}</Text>
              <Text style={[styles.dato, styles.cQty]}>{f.qty}</Text>
              <Text style={[styles.dato, styles.cPrecio]}>
                {montoConMoneda(f.unitPrice, invoice.currency)}
              </Text>
              <Text style={[styles.dato, styles.cMonto]}>
                {montoConMoneda(f.amount, invoice.currency)}
              </Text>
            </View>
          ))
        )}

        <View style={{ marginTop: 10 }}>
          {llevaIva ? (
            <>
              <View style={styles.totalFila}>
                <Text style={styles.totalEtiqueta}>Base imponible</Text>
                <Text style={styles.totalValor}>{montoConMoneda(t.base, invoice.currency)}</Text>
              </View>
              <View style={styles.totalFila}>
                <Text style={styles.totalEtiqueta}>IVA {t.ivaRate}%</Text>
                <Text style={styles.totalValor}>
                  {montoConMoneda(t.ivaAmount, invoice.currency)}
                </Text>
              </View>
            </>
          ) : (
            <View style={styles.totalFila}>
              <Text style={styles.totalEtiqueta}>Subtotal</Text>
              <Text style={styles.totalValor}>{montoConMoneda(t.base, invoice.currency)}</Text>
            </View>
          )}

          <View style={styles.granTotalFila}>
            <Text style={styles.granTotalEtiqueta}>Total</Text>
            <Text style={styles.granTotalValor}>{montoConMoneda(t.total, invoice.currency)}</Text>
          </View>

          {t.paid > 0 ? (
            <View style={styles.totalFila}>
              <Text style={styles.totalEtiqueta}>Abonado</Text>
              <Text style={styles.totalValor}>
                -{montoConMoneda(t.paid, invoice.currency)}
              </Text>
            </View>
          ) : null}

          {t.balance > 0 ? (
            <View style={styles.totalFila}>
              <Text style={styles.saldoEtiqueta}>Saldo pendiente</Text>
              <Text style={styles.saldoValor}>{montoConMoneda(t.balance, invoice.currency)}</Text>
            </View>
          ) : null}
        </View>

        {/* SDD-0556 · «Estado: Anulada» va en letra chica en el meta; con el
            total completo, el papel seguía pareciendo una factura vigente. */}
        {facturaAnulada(invoice) ? (
          <Text style={styles.aviso}>
            Factura anulada: no hay saldo por pagar.
            {t.paid > 0
              ? ` Lo abonado (${montoConMoneda(t.paid, invoice.currency)}) no se descuenta de tu saldo pendiente: ${indicacionPagosEnAnuladas({ singular: true })}.`
              : ""}
          </Text>
        ) : null}

        {/* El descuadre se DENUNCIA, no se corrige: el total que vale es el de
            la DB (el que se cobró). Callarlo dejaría un papel que no se puede
            reconstruir desde sus propias líneas. */}
        {t.descuadre ? (
          <Text style={styles.aviso}>
            Nota de control: la suma de las líneas (
            {montoConMoneda(t.sumaLineas, invoice.currency)}) no coincide con la base de la
            factura. Prevalece el total emitido.
          </Text>
        ) : null}

        {invoice.notes ? (
          <View style={{ marginTop: 16 }}>
            <Text style={styles.bloqueTitulo}>Notas</Text>
            <Text style={styles.nota}>{invoice.notes}</Text>
          </View>
        ) : null}

        {/* SDD-0556 · una anulada no se paga: no lleva «Datos para el pago». */}
        {emisor && emisor.cuentas.length > 0 && !facturaAnulada(invoice) ? (
          <View style={{ marginTop: 18 }}>
            <Text style={styles.bloqueTitulo}>Datos para el pago</Text>
            {emisor.cuentas.map((c) => (
              <Text key={c.accountNumber} style={styles.dato}>
                {c.bankName} · {c.accountType} · {c.currency} · {c.accountNumber}
              </Text>
            ))}
          </View>
        ) : null}

        <Text style={styles.pie}>
          {[emisor?.tradeName || "DTD Cargo", emisor?.email, emisor?.phone, emisor?.website]
            .filter(Boolean)
            .join(" · ")}
          {"\n"}
          Documento emitido por DTD Cargo. Los montos se expresan en {invoice.currency}.
        </Text>
      </Page>
    </Document>
  );
}
