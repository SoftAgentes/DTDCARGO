/**
 * lib/studio/conversaciones/monthly-digest.ts · SDD-0149 — runner del resumen mensual.
 *
 * Por tenant: encuentra las conversaciones con actividad en el mes, junta el hilo del
 * mes, lo resume con IA (digest-extract) y hace upsert en conversation_monthly_digests
 * (idempotente por conversation_id+period). Sin actividad → nada. Best-effort por
 * conversación (un fallo no frena a las demás). SIEMPRE con service_role (lo llama el
 * cron). Nunca lanza.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  summarizeMonthThread,
  summarizeMonthThreadForClient,
  type DigestMessage,
} from "./digest-extract";

export interface DigestRunResult {
  tenantId: string;
  processed: number; // conversaciones con actividad en el mes
  generated: number; // digests guardados OK
  skipped: number; // sin mensajes / error de IA / error de guardado
}

export async function runConversationDigestsForTenant(
  admin: SupabaseClient,
  tenantId: string,
  monthStart: string, // YYYY-MM-DD · primer día del mes resumido
  monthEndExcl: string, // YYYY-MM-DD · primer día del mes siguiente (exclusivo)
  periodLabel: string, // ej. "julio de 2026"
): Promise<DigestRunResult> {
  const res: DigestRunResult = { tenantId, processed: 0, generated: 0, skipped: 0 };

  try {
    // Conversaciones del tenant con ≥1 mensaje en el rango del mes.
    const { data: msgRows } = await admin
      .from("conversation_messages")
      .select("conversation_id")
      .eq("tenant_id", tenantId)
      .gte("sent_at", monthStart)
      .lt("sent_at", monthEndExcl);

    const convIds = [
      ...new Set(
        (msgRows ?? [])
          .map((r) => (r as { conversation_id: string }).conversation_id)
          .filter(Boolean),
      ),
    ];
    if (convIds.length === 0) return res;

    for (const convId of convIds) {
      res.processed += 1;
      try {
        const { data: conv } = await admin
          .from("conversations")
          .select("id, client_id")
          .eq("id", convId)
          .is("deleted_at", null)
          .maybeSingle<{ id: string; client_id: string }>();
        if (!conv) {
          res.skipped += 1;
          continue;
        }

        const { data: client } = await admin
          .from("clients")
          .select("name")
          .eq("id", conv.client_id)
          .maybeSingle<{ name: string }>();
        const clientName = client?.name ?? "Cliente";

        const { data: msgs } = await admin
          .from("conversation_messages")
          .select("direction, body, author_name")
          .eq("conversation_id", convId)
          .gte("sent_at", monthStart)
          .lt("sent_at", monthEndExcl)
          .order("sent_at", { ascending: true })
          .limit(500);

        const list: DigestMessage[] = (msgs ?? []).map((m) => {
          const r = m as {
            direction: "in" | "out";
            body: string;
            author_name: string | null;
          };
          return { direction: r.direction, body: r.body, authorName: r.author_name };
        });
        if (list.length === 0) {
          res.skipped += 1;
          continue;
        }

        const inN = list.filter((m) => m.direction === "in").length;
        const outN = list.length - inN;

        const r = await summarizeMonthThread(list, { clientName, periodLabel });
        if ("error" in r) {
          // Antes se tragaba en silencio → digest en 0 sin rastro. Ahora queda en logs.
          console.error(
            `[monthly-digest] IA sin resumen (conv=${convId}, ${periodLabel}):`,
            r.error,
          );
          res.skipped += 1;
          continue;
        }

        // Resumen client-facing (F3 · portal). Best-effort: si falla, guardamos el
        // interno igual y client_summary queda null (el portal simplemente no lo muestra).
        const rc = await summarizeMonthThreadForClient(list, { clientName, periodLabel });
        let clientSummary: string | null = null;
        if ("error" in rc) {
          console.error(
            `[monthly-digest] IA cliente sin resumen (conv=${convId}, ${periodLabel}):`,
            rc.error,
          );
        } else {
          clientSummary = rc.summary;
        }

        const { error: upErr } = await admin
          .from("conversation_monthly_digests")
          .upsert(
            {
              tenant_id: tenantId,
              client_id: conv.client_id,
              conversation_id: convId,
              period: monthStart,
              summary: r.summary,
              client_summary: clientSummary,
              message_count: list.length,
              in_count: inN,
              out_count: outN,
              model: r.model,
              generated_at: new Date().toISOString(),
            },
            { onConflict: "conversation_id,period" },
          );
        if (upErr) {
          console.error("[monthly-digest] upsert falló:", upErr.message);
          res.skipped += 1;
          continue;
        }
        res.generated += 1;
      } catch (err) {
        console.error("[monthly-digest] conversación falló:", err);
        res.skipped += 1;
      }
    }
  } catch (err) {
    console.error("[monthly-digest] tenant falló:", err);
  }

  return res;
}
