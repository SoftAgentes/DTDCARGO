/**
 * SDD-0117 · Primitivas compartidas de los documentos PDF del Studio
 * (@react-pdf/renderer). Colores hardcodeados a valores de luz — react-pdf NO
 * lee CSS vars; el PDF es un documento formal, no la app. Extraído al llegar el
 * Slice B (finiquito) para no duplicar membrete/estilos/formateo.
 */

import { Text, View, StyleSheet } from "@react-pdf/renderer";

export const PDF = {
  NAVY: "#0F1E3D",
  INK: "#1A2433",
  MUTE: "#6B7280",
  DANGER: "#B42318",
  BORDER: "#E5E7EB",
} as const;

/** Formato monetario USD con separador de miles (sin signo; el caller pone "-"). */
export function usd(n: number): string {
  return (
    "$" +
    Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}

const styles = StyleSheet.create({
  header: { borderBottomWidth: 2, borderBottomColor: PDF.NAVY, paddingBottom: 12, marginBottom: 16 },
  brand: { fontSize: 16, fontFamily: "Helvetica-Bold", color: PDF.NAVY, letterSpacing: 1 },
  docTitle: { fontSize: 13, fontFamily: "Helvetica-Bold", color: PDF.INK, marginTop: 6 },
  meta: { fontSize: 9.5, color: PDF.MUTE, marginTop: 3 },
  emisor: { fontSize: 9, color: PDF.INK, marginTop: 4 },
});

/**
 * Membrete estándar: marca + título de documento + líneas de metadata.
 *
 * `emisorLines` es OPCIONAL y va debajo de la marca: es donde la factura pone
 * la identidad fiscal (razón social · RIF), que en Venezuela se imprime bajo el
 * membrete. Los demás documentos no la pasan y salen igual que antes —
 * la identidad legal completa es una excepción a pedir, no el default
 * (regla de marca, founder 2026-07-20; ver `finiquito-pdf.tsx`).
 */
export function Membrete({
  docTitle,
  metaLines,
  emisorLines,
}: {
  docTitle: string;
  metaLines: string[];
  emisorLines?: string[];
}) {
  return (
    <View style={styles.header}>
      <Text style={styles.brand}>DTD CARGO</Text>
      {emisorLines?.filter(Boolean).map((l, i) => (
        <Text key={`e${i}-${l}`} style={styles.emisor}>
          {l}
        </Text>
      ))}
      <Text style={styles.docTitle}>{docTitle}</Text>
      {metaLines.map((l, i) => (
        <Text key={`${i}-${l}`} style={styles.meta}>
          {l}
        </Text>
      ))}
    </View>
  );
}
