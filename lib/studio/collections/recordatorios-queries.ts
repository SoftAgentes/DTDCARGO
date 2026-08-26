/**
 * SDD-0306 · Lo que hay que leer de la base para decidir el recordatorio.
 *
 * Separado de `recordatorios.ts` a propósito: allá vive el **criterio** (puro y
 * probado), acá las **consultas**. El criterio no sabe de Supabase y las
 * consultas no deciden a quién se le escribe.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPaged } from "@/lib/db/paginate";
import type { Receivable } from "@/lib/studio/payment-queries";
import type { ContextoEnvio } from "./recordatorios";

/** `YYYY-MM-DD` a partir de un ISO con o sin hora. */
const dia = (v: string | null | undefined) => (v ?? "").slice(0, 10);

type LogRow = {
  to_email: string | null;
  sent_at: string | null;
  metadata: { source_ref?: { id?: string } } | null;
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
  const markboxes = [...new Set(cola.map((r) => r.invoice.client_markbox))];
  const porId = new Map(cola.map((r) => [r.invoice.id, r.invoice.invoice_code]));

  const conCorreo = new Set<string>();
  const marcaronSpam = new Set<string>();
  const ultimoRecordatorio = new Map<string, string>();

  if (markboxes.length === 0) {
    return { conCorreo, marcaronSpam, ultimoRecordatorio };
  }

  // ── 1 · Quién tiene correo cargado ─────────────────────────────────────
  const { data: clientes } = await supabase
    .from("clients")
    .select("markbox, email")
    .in("markbox", markboxes)
    .is("deleted_at", null);

  /** correo → markbox, para cruzar las quejas (que se registran por email). */
  const correoPorMarkbox = new Map<string, string>();
  for (const c of clientes ?? []) {
    const email = ((c as { email: string | null }).email ?? "").trim();
    const mb = (c as { markbox: string }).markbox;
    if (email) {
      conCorreo.add(mb);
      correoPorMarkbox.set(email.toLowerCase(), mb);
    }
  }

  // ── 2 · Quejas de spam · TODAS, sin ventana ────────────────────────────
  //
  // Se mira sobre todos los correos del cliente, no sólo los de cobranza: quien
  // marcó spam en un aviso de embarque tampoco quiere uno de cobranza. La queja
  // es sobre el remitente, no sobre el tema.
  const { rows: quejas } = await fetchAllPaged<{ to_email: string | null }>((d, h) =>
    supabase
      .from("mail_logs")
      .select("to_email")
      .not("complained_at", "is", null)
      .order("id", { ascending: true })
      .range(d, h),
  );
  for (const q of quejas) {
    const mb = correoPorMarkbox.get((q.to_email ?? "").toLowerCase());
    if (mb) marcaronSpam.add(mb);
  }

  // ── 3 · Último recordatorio POR FACTURA ────────────────────────────────
  //
  // Filtrado por evento en la base. Del más reciente al más viejo: el primero
  // que aparece por factura es el último que se mandó.
  const { rows: previos } = await fetchAllPaged<LogRow>((d, h) =>
    supabase
      .from("mail_logs")
      .select("to_email, sent_at, metadata")
      .eq("metadata->>event", "invoice_overdue")
      .order("sent_at", { ascending: false })
      .range(d, h),
  );
  for (const row of previos) {
    const id = row.metadata?.source_ref?.id;
    if (!id) continue;
    const code = porId.get(id);
    if (!code || ultimoRecordatorio.has(code)) continue;
    const cuando = dia(row.sent_at);
    if (cuando) ultimoRecordatorio.set(code, cuando);
  }

  return { conCorreo, marcaronSpam, ultimoRecordatorio };
}
