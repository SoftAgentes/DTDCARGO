"use server";

/**
 * Solicitud de cotización desde el portal (Norte). El cliente registrado pide que
 * le coticen un servicio; se crea un `quote` source='studio' (cliente conocido,
 * precio en 0) que el asesor cotiza en `/studio/cotizador`, y se le avisa.
 *
 * SEGURIDAD: el `markbox`/`nombre` salen de la SESIÓN (getPortalClient resuelve el
 * principal del portal vía get_portal_client_id, RLS-safe), NUNCA del FormData →
 * un cliente no puede crear cotizaciones a nombre de otro. El insert corre con
 * admin client (el cliente del portal no tiene RLS de INSERT sobre `quotes`; mismo
 * criterio que los demás writes del portal), pero scopeado al markbox de SU sesión.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { getPortalClient } from "@/lib/portal/portal-queries";
import {
  validateCotizacionRequest,
  buildCotizacionRow,
  type CotizacionFieldErrors,
} from "@/lib/portal/cotizacion-request";
import { notifyCotizacionRequestToAdmin } from "@/lib/studio/cotizacion-request-notify";

export type CotizacionRequestState = {
  ok?: boolean;
  createdCode?: string;
  error?: string;
  fieldErrors?: CotizacionFieldErrors;
};

export async function requestCotizacionAction(
  _prev: CotizacionRequestState,
  formData: FormData,
): Promise<CotizacionRequestState> {
  // 1. Validar el form (puro).
  const { input, fieldErrors } = validateCotizacionRequest({
    service: formData.get("service") as string | null,
    origin: formData.get("origin") as string | null,
    destination: formData.get("destination") as string | null,
    description: formData.get("description") as string | null,
    cbm: formData.get("cbm") as string | null,
    weightKg: formData.get("weightKg") as string | null,
    boxes: formData.get("boxes") as string | null,
  });
  if (fieldErrors) return { fieldErrors };

  // 2. Resolver al cliente DESDE LA SESIÓN (no del form).
  const supabase = await createClient();
  const client = await getPortalClient(supabase);
  if (!client) {
    return { error: "Tu sesión expiró. Vuelve a entrar e intenta de nuevo." };
  }

  // 3. Admin client (service_role) para el insert + correlativo + aviso.
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return {
      error: "No pudimos registrar tu cotización ahora. Escríbele a tu asesor.",
    };
  }

  // 4. Tenant del cliente (la quote debe vivir en SU tenant para que el asesor la
  //    vea). Lo leemos de su propio registro, no asumimos "primer tenant".
  const { data: clientRow, error: tenantErr } = await admin
    .from("clients")
    .select("tenant_id")
    .eq("id", client.id)
    .maybeSingle<{ tenant_id: string }>();
  if (tenantErr || !clientRow?.tenant_id) {
    return { error: "No pudimos registrar tu cotización. Intenta más tarde." };
  }
  const tenantId = clientRow.tenant_id;

  // 5. Correlativo EST-YYYY-NNNN (misma serie que el resto de estimados/cotizaciones).
  const { data: codeData, error: codeErr } = await admin.rpc(
    "next_estimate_code",
    { p_tenant_id: tenantId },
  );
  if (codeErr || !codeData) {
    return { error: "No pudimos generar el código. Intenta de nuevo." };
  }
  const code = String(codeData);

  // 6. Insert de la cotización (precio en 0 → lo cotiza el asesor).
  const row = buildCotizacionRow(input, {
    clientMarkbox: client.markbox,
    clientName: client.name,
  });
  const { error: insertErr } = await admin.from("quotes").insert({
    tenant_id: tenantId,
    quote_code: code,
    ...row,
  });
  if (insertErr) {
    return { error: "No pudimos registrar tu cotización. Intenta de nuevo." };
  }

  // 7. Avisar al asesor (best-effort: no rompe el alta).
  await notifyCotizacionRequestToAdmin(admin, tenantId, {
    code,
    markbox: client.markbox,
    clientName: client.name,
    service: input.service,
    origin: input.origin,
    destination: input.destination,
    description: input.description,
  });

  revalidatePath("/portal/cotizaciones");
  revalidatePath("/portal");
  return { ok: true, createdCode: code };
}
