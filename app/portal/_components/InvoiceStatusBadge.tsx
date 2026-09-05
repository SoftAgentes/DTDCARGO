import { StatusIcon } from "@/components/StatusIcon";
import {
  invoiceDisplayStatus,
  invoiceStatusLabel,
  invoiceStatusTone,
  type InvoiceStatus,
} from "@/lib/portal/portal-types";

/**
 * Badge de estado de factura. Deriva "vencida" visualmente (igual que el Studio,
 * `invoiceDisplayStatus`: due_date pasada y no pagada/anulada) y pinta con las clases
 * `.badge-status-*` tokenizadas (globals.css) — mismas que el badge de envíos. Antes
 * usaba hex fijos de `INVOICE_TONE_COLOR` inline, invisibles sobre la card oscura del
 * portal; el TONO (info/success/warning/danger/neutral) espeja esos colores en claro
 * (cero cambio para clientes reales) y usa los tokens brillantes en oscuro.
 */
export function InvoiceStatusBadge({
  status,
  dueDate,
}: {
  status: InvoiceStatus;
  dueDate: string | null;
}) {
  const effective = invoiceDisplayStatus({ status, due_date: dueDate });
  const tone = invoiceStatusTone(effective);
  const label = invoiceStatusLabel(effective);
  return (
    <span className={`badge-status badge-status-${tone}`}>
      <StatusIcon tone={tone} />
      {label}
    </span>
  );
}
