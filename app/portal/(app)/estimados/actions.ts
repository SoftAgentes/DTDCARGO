"use server";

/**
 * "Avanzar a cotización" desde un estimado del portal (Norte · founder 2026-06-21:
 * "esos estimados nosotros los convertimos en cotización"). El cliente toma su
 * estimado rápido (auto, `quotes.source='web'`) y lo formaliza: el MISMO quote pasa
 * a la pista formal (`source='studio'`, arrastra su precio automático como punto de
 * partida) y el asesor lo cotiza/cierra en `/studio/cotizador`. Idempotente: sólo
 * un estimado web elegible se puede avanzar; si ya está en la pista formal, no-op.
 *
 * SEGURIDAD: el dueño se resuelve por el principal de sesión y lectura/UPDATE van
 * scopeados por tenant + Shipping Mark antes y después de elevar a admin.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { getPortalClientPrincipal } from "@/lib/portal/portal-queries";
import { canAdvanceEstimate } from "@/lib/portal/cotizacion-request";
import { notifyCotizacionRequestToAdmin } from "@/lib/studio/cotizacion-request-notify";
import type { QuoteStatus } from "@/lib/studio/quote-types";
import type { ShipmentService } from "@/lib/shared/shipment-public";

export type AdvanceEstimateState = { error?: string };

type QuoteRow = {
  id: string;
  tenant_id: string;
  quote_code: string;
  source: string;
  status: QuoteStatus;
  service: ShipmentService;
  origin: string | null;
  destination: string | null;
  nota: string | null;
  converted_to_shipment_id: string | null;
};

export async function advanceEstimateToCotizacionAction(
  _prev: AdvanceEstimateState,
  formData: FormData,
): Promise<AdvanceEstimateState> {
  const code = String(formData.get("code") ?? "").trim();
  if (!code) return { error: "No pudimos identificar el estimado." };

  // Dueño desde la SESIÓN (no del form).
  const supabase = await createClient();
  const principal = await getPortalClientPrincipal(supabase);
  if (!principal) {
    return { error: "Tu sesión expiró. Vuelve a entrar e intenta de nuevo." };
  }
  const client = principal.client;
  const tenantId = principal.tenantId;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: "No pudimos avanzar tu estimado ahora. Escríbele a tu asesor." };
  }

  // Traer el estimado y CONFIRMAR que es del cliente logueado (por markbox).
  const { data: q, error: fetchErr } = await admin
    .from("quotes")
    .select(
      "id, tenant_id, quote_code, source, status, service, origin, destination, nota, converted_to_shipment_id",
    )
    .eq("quote_code", code)
    .eq("tenant_id", tenantId)
    .eq("client_markbox", client.markbox)
    .is("deleted_at", null)
    .maybeSingle<QuoteRow>();
  if (fetchErr) {
    return { error: "No pudimos avanzar tu estimado. Intenta de nuevo." };
  }
  if (!q) return { error: "No encontramos ese estimado en tu cuenta." };

  // Ya está en la pista formal → idempotente: lo mandamos a Cotizaciones.
  if (q.source !== "web") {
    redirect("/portal/cotizaciones");
  }

  if (
    !canAdvanceEstimate({
      status: q.status,
      convertedToShipmentId: q.converted_to_shipment_id,
    })
  ) {
    return {
      error:
        "Este estimado ya no se puede avanzar. Escríbele a tu asesor si necesitas otro precio.",
    };
  }

  // Avanzar: el MISMO quote pasa a la pista formal (source='studio'). Conserva su
  // precio automático (total_usd) como punto de partida; el asesor lo formaliza.
  const { data: updated, error: updErr } = await admin
    .from("quotes")
    .update({ source: "studio", updated_at: new Date().toISOString() })
    .eq("id", q.id)
    .eq("tenant_id", tenantId)
    .eq("client_markbox", client.markbox)
    .eq("source", "web")
    .select("id");
  if (updErr) {
    return { error: "No pudimos avanzar tu estimado. Intenta de nuevo." };
  }
  // 0 filas = otra pestaña lo avanzó primero → idempotente, seguimos al redirect.

  if ((updated?.length ?? 0) > 0) {
    // Avisar al asesor que el cliente quiere formalizar (best-effort).
    const description = q.nota?.trim()
      ? `Avanzó su estimado ${q.quote_code} a cotización. Nota: ${q.nota.trim()}`
      : `Avanzó su estimado ${q.quote_code} a cotización formal.`;
    await notifyCotizacionRequestToAdmin(admin, tenantId, {
      code: q.quote_code,
      markbox: client.markbox,
      clientName: client.name,
      service: q.service,
      origin: q.origin ?? "China",
      destination: q.destination ?? "Venezuela",
      description,
    });
  }

  revalidatePath("/portal/estimados");
  revalidatePath("/portal/cotizaciones");
  redirect("/portal/cotizaciones");
}
