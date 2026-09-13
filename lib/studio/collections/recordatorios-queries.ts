/**
 * SDD-0306 · Lo que hay que leer de la base para decidir el recordatorio.
 *
 * Separado de `recordatorios.ts` a propósito: allá vive el **criterio** (puro y
 * probado), acá las **consultas**. El criterio no sabe de Supabase y las
 * consultas no deciden a quién se le escribe.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Receivable } from "@/lib/studio/payment-queries";
import type { ContextoEnvio } from "./recordatorios";

/** `YYYY-MM-DD` a partir de un ISO con o sin hora. */
const dia = (v: string | null | undefined) => (v ?? "").slice(0, 10);

type CollectionsMailContextRow = {
  invoice_id: string;
  client_markbox: string;
  has_email: boolean;
  complained: boolean;
  last_reminder_on: string | null;
};

/**
 * Resuelve los tres conjuntos que el criterio consulta.
 *
 * ## Por qué son consultas SEPARADAS y filtradas en la base
 *
 * La primera versión traía «los últimos 1000 correos» y filtraba en memoria.
 * Eso tiene un modo de fallo en la **dirección peligrosa**: una queja de spam
 * más vieja que esos 1000 registros se cae del conjunto, el cliente no aparece
 * como quejoso, y **se le vuelve a escribir**. Justo lo que la regla existe
 * para impedir.
 *
 * Ahora cada conjunto sale de su propia consulta acotada en el servidor y
 * paginada entera: las quejas son pocas y las queremos TODAS, sin importar
 * cuándo ocurrieron.
 */
export async function contextoDeEnvio(
  supabase: SupabaseClient,
  cola: readonly Receivable[],
): Promise<ContextoEnvio> {
  const invoiceIds = [...new Set(cola.map((r) => r.invoice.id))];
  const porId = new Map(cola.map((r) => [r.invoice.id, r.invoice.invoice_code]));

  const conCorreo = new Set<string>();
  const marcaronSpam = new Set<string>();
  const ultimoRecordatorio = new Map<string, string>();

  if (invoiceIds.length === 0) {
    return { conCorreo, marcaronSpam, ultimoRecordatorio };
  }

  // La RPC devuelve únicamente señales booleanas + fecha por las facturas
  // solicitadas. Email, metadata y el resto de mail_logs no salen de la base.
  const { data, error } = await supabase.rpc("collections_mail_context", {
    p_invoice_ids: invoiceIds,
  });
  if (error) throw new Error(error.message);

  for (const row of (data ?? []) as CollectionsMailContextRow[]) {
    if (row.has_email) conCorreo.add(row.client_markbox);
    if (row.complained) marcaronSpam.add(row.client_markbox);
    const code = porId.get(row.invoice_id);
    const cuando = dia(row.last_reminder_on);
    if (code && cuando) ultimoRecordatorio.set(code, cuando);
  }

  return { conCorreo, marcaronSpam, ultimoRecordatorio };
}
