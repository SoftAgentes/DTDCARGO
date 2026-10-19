/**
 * SDD-0558 · «Saldo pendiente» del panel de contexto de un hilo.
 *
 * Una línea por moneda, sin sumar ni convertir: el saldo sale de la definición
 * única (`client_outstanding`, migración 0492) y puede tener USD y VES a la
 * vez. Antes pintaba un solo monto en la moneda dominante y enlazaba a
 * Cobranzas, que solo abre finanzas: comercial, operaciones y soporte
 * terminaban rebotados. Ahora enlaza a la ficha del cliente, que es donde
 * cualquiera que ve clientes encuentra el saldo completo.
 *
 * Mismo formato de monto que la cabecera de la ficha (`formatInvoiceAmount`:
 * «USD 1,250.00»). Sin hooks: lo monta `ConversationThread`, que ya es cliente.
 */

import Link from "next/link";
import { formatInvoiceAmount } from "@/lib/portal/portal-types";
import type { ConversationClientContext } from "@/lib/studio/conversaciones/conversations-types";

const ETIQUETA = {
  font: "700 9.5px/1 var(--f-sans)",
  letterSpacing: "0.14em",
  textTransform: "uppercase" as const,
  color: "var(--ink-soft)",
  marginBottom: "var(--s-2)",
};

const NOTA = { font: "500 11.5px/1.4 var(--f-sans)", color: "var(--ink-soft)" };

export function SaldoPendienteContexto({
  context,
  loading,
}: {
  context: ConversationClientContext | null;
  loading: boolean;
}) {
  const saldo = context?.outstanding;
  return (
    <div>
      <div style={ETIQUETA}>Saldo pendiente</div>
      {loading ? (
        <span style={{ ...NOTA, color: "var(--ink-mute)" }}>—</span>
      ) : !context ? (
        <span style={NOTA}>—</span>
      ) : saldo === null || saldo === undefined ? (
        <span style={NOTA}>No se pudo calcular el saldo. Ábrelo en la ficha.</span>
      ) : saldo.length === 0 ? (
        <span style={{ font: "800 18px/1 var(--f-display)", color: "var(--ink)" }}>Al día</span>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "var(--s-1)" }}>
          {saldo.map((s) => (
            <li
              key={s.currency}
              style={{ font: "800 16px/1.15 var(--f-display)", color: "var(--danger)" }}
            >
              {formatInvoiceAmount(s.amount, s.currency)}
            </li>
          ))}
        </ul>
      )}
      {context && !loading ? (
        <Link
          href={`/studio/clientes/${encodeURIComponent(context.markbox)}`}
          style={{
            display: "inline-block",
            font: "600 11px/1.4 var(--f-sans)",
            color: "var(--ink-soft)",
            marginTop: "var(--s-1)",
          }}
        >
          Ver en la ficha →
        </Link>
      ) : null}
    </div>
  );
}
