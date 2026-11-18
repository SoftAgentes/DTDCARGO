"use client";

/**
 * SDD-0630 · Aviso en el cobro de una factura: el cliente reportó pagos en el
 * portal que siguen sin revisar. Esos pagos se confirman desde la factura, y al
 * confirmar se crea su recibo (migración 0537). Registrar aquí el mismo pago lo
 * contaría dos veces. Carga sus datos por su cuenta, así el drawer sólo lo monta.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PendingReportsSummary } from "@/lib/studio/payment-queries";
import { getPendingPaymentReports } from "../actions";

function fmt(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function PendingReportsNotice({
  invoiceId,
  invoiceCode,
  currency,
}: {
  invoiceId: string;
  invoiceCode: string;
  currency: string;
}) {
  // undefined = cargando; null = no se pudo leer.
  const [pending, setPending] = useState<PendingReportsSummary | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    getPendingPaymentReports(invoiceId)
      .then((r) => { if (active) setPending(r.error ? null : r.pending); })
      .catch(() => { if (active) setPending(null); });
    return () => { active = false; };
  }, [invoiceId]);

  const href = `/studio/facturacion/${encodeURIComponent(invoiceCode)}`;
  if (pending === undefined) return null;
  if (pending === null) {
    return (
      <div role="note" style={{ font: "500 12.5px/1.5 var(--f-sans)", color: "var(--ink-soft)" }}>
        No pudimos revisar si el cliente reportó pagos en esta factura. Míralo en la factura{" "}
        <Link href={href}>{invoiceCode}</Link> antes de registrar un cobro, para no contarlo dos veces.
      </div>
    );
  }
  if (pending.count === 0) return null;
  return (
    <div
      role="note"
      style={{
        background: "var(--warning-bg)",
        borderLeft: "4px solid var(--warning)",
        borderRadius: "var(--r-md)",
        padding: "var(--s-2) var(--s-3)",
        font: "500 12.5px/1.5 var(--f-sans)",
        color: "var(--ink)",
      }}
    >
      {pending.count === 1 ? "El cliente reportó un pago" : `El cliente reportó ${pending.count} pagos`}{" "}
      por {currency} ${fmt(pending.amount)} que siguen sin revisar. Confírmalos desde la factura: al
      confirmar se crea el recibo. Si registras aquí ese mismo pago, se contará dos veces.{" "}
      <Link href={href}>Ir a la factura {invoiceCode}</Link>
    </div>
  );
}
