/**
 * SDD-0281 · El estimado en PDF (@react-pdf/renderer).
 *
 * Hasta hoy el estimado sólo salía del ERP por WhatsApp, como texto plano. Sirve
 * para cerrar rápido, pero no para el cliente que lo tiene que pasar por su
 * contabilidad ni para el aliado que lo reenvía con su propia marca.
 *
 * ## No recalcula nada
 *
 * El desglose sale de `buildQuoteBreakdown` (en `quote-types.ts`), el MISMO que
 * arma el texto de WhatsApp. Antes de este spec ese cálculo vivía suelto dentro
 * del constructor del texto; se extrajo justamente para que el papel y el
 * mensaje no puedan decir números distintos. Si mañana cambia la regla de
 * embalaje, cambia en un solo lugar.
 *
 * ## El estimado no es una factura
 *
 * Es una oferta con fecha de vencimiento. Por eso el documento pone la vigencia
 * arriba y repite abajo, en texto llano, que el precio se sostiene hasta esa
 * fecha y que no constituye un cobro. Un cliente confundiendo un estimado
 * vencido con un precio vigente es un reclamo, no un malentendido.
 *
 * Colores hardcodeados a valores de luz: react-pdf no lee CSS vars.
 */

import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { Quote } from "@/lib/studio/quote-types";
import { buildQuoteBreakdown, isExpired } from "@/lib/studio/quote-types";
import { PDF, Membrete } from "./pdf-doc";

/** Contacto del emisor para el pie. Todo opcional. */
export type EstimadoPdfEmisor = {
  tradeName: string;
  email: string;
  phone: string;
  website: string;
};

const styles = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 48, paddingHorizontal: 44, fontSize: 10, color: PDF.INK },
  bloqueTitulo: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: PDF.MUTE,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  fila: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: PDF.BORDER,
  },
  filaFuerte: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 9,
    paddingBottom: 4,
    marginTop: 5,
    borderTopWidth: 1,
    borderTopColor: PDF.NAVY,
  },
  etiqueta: { fontSize: 10, color: PDF.MUTE },
  valor: { fontSize: 10.5, textAlign: "right" },
  etiquetaFuerte: { fontSize: 11.5, fontFamily: "Helvetica-Bold" },
  valorFuerte: {
    fontSize: 12.5,
    fontFamily: "Helvetica-Bold",
    color: PDF.NAVY,
    textAlign: "right",
  },
  vencido: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    color: PDF.DANGER,
    marginTop: 14,
  },
  nota: { fontSize: 9, color: PDF.INK, marginTop: 6, lineHeight: 1.4 },
  condiciones: { fontSize: 8.5, color: PDF.MUTE, marginTop: 22, lineHeight: 1.5 },
});

export function EstimadoDocument({
  quote,
  emisor,
}: {
  quote: Quote;
  emisor?: EstimadoPdfEmisor;
}) {
  const filas = buildQuoteBreakdown(quote);
  const vencido = isExpired(quote);

  return (
    <Document title={`Estimado ${quote.quote_code}`} author="DTD Cargo">
      <Page size="A4" style={styles.page}>
        <Membrete
          docTitle={`Estimado ${quote.quote_code}`}
          metaLines={[
            `Vigente hasta: ${quote.valid_until}`,
            quote.client_markbox ? `Shipping Mark: ${quote.client_markbox}` : "Prospecto",
          ]}
        />

        <Text style={styles.bloqueTitulo}>Detalle del estimado</Text>

        {filas.map((f, i) =>
          f.strong ? (
            <View key={`${f.label}-${i}`} style={styles.filaFuerte}>
              <Text style={styles.etiquetaFuerte}>{f.label}</Text>
              <Text style={styles.valorFuerte}>{f.value}</Text>
            </View>
          ) : (
            <View key={`${f.label}-${i}`} style={styles.fila}>
              <Text style={styles.etiqueta}>{f.label}</Text>
              <Text style={styles.valor}>{f.value}</Text>
            </View>
          ),
        )}

        {/* Un estimado vencido se sigue pudiendo imprimir —el asesor a veces lo
            necesita para reconstruir una conversación—, pero el papel tiene que
            decirlo. Callarlo convierte un documento de archivo en una oferta. */}
        {vencido ? (
          <Text style={styles.vencido}>
            Este estimado venció el {quote.valid_until}. Los precios ya no están vigentes:
            solicita uno nuevo antes de confirmar el embarque.
          </Text>
        ) : null}

        {quote.notes ? (
          <View style={{ marginTop: 18 }}>
            <Text style={styles.bloqueTitulo}>Notas</Text>
            <Text style={styles.nota}>{quote.notes}</Text>
          </View>
        ) : null}

        <Text style={styles.condiciones}>
          Este documento es un estimado, no una factura: no constituye un cobro. El precio se
          sostiene hasta la fecha de vigencia indicada y está sujeto al volumen y peso reales
          medidos en bodega. Cualquier variación se informa antes de embarcar.
          {"\n"}
          {[emisor?.tradeName || "DTD Cargo", emisor?.email, emisor?.phone, emisor?.website]
            .filter(Boolean)
            .join(" · ")}
        </Text>
      </Page>
    </Document>
  );
}
