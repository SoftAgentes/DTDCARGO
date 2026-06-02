import {
  INVOICE_TONE_COLOR,
  invoiceDisplayStatus,
  invoiceStatusLabel,
  invoiceStatusTone,
  type InvoiceStatus,
} from "@/lib/portal/portal-types";

/**
 * Badge de estado de factura. Deriva "vencida" visualmente (igual que el Studio,
 * `invoiceDisplayStatus`: due_date pasada y no pagada/anulada) y pinta con los
 * tokens de estado de marca — mismo look que el badge de envíos.
 */
export function InvoiceStatusBadge({
  status,
  dueDate,
}: {
  status: InvoiceStatus;
  dueDate: string | null;
}) {
  const effective = invoiceDisplayStatus({ status, due_date: dueDate });
  const color = INVOICE_TONE_COLOR[invoiceStatusTone(effective)];
  const label = invoiceStatusLabel(effective);
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[12px] font-semibold rounded-full px-2.5 py-1 whitespace-nowrap"
      style={{
        color,
        background: `${color}14`, // ~8% alpha (hex8)
        border: `1px solid ${color}33`, // ~20% alpha
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}
