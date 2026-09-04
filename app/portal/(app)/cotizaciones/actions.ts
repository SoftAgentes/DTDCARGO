"use server";

/**
 * Solicitud de cotización desde el portal (Norte). El cliente registrado pide que
 * le coticen un servicio; se crea un `quote` source='studio' (cliente conocido,
 * precio en 0) que el asesor cotiza en `/studio/cotizador`, y se le avisa.
 *
 * SEGURIDAD: tenant/Shipping Mark/nombre salen del principal de sesión, nunca del
 * FormData. El admin client sólo se construye después de validarlo y el INSERT se
 * fija a ese principal.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { getPortalClientPrincipal } from "@/lib/portal/portal-queries";
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
  const principal = await getPortalClientPrincipal(supabase);
  if (!principal) {
    return { error: "Tu sesión expiró. Vuelve a entrar e intenta de nuevo." };
  }
  const client = principal.client;
  const tenantId = principal.tenantId;

  // 3. Admin client (service_role) para el insert + correlativo + aviso.
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return {
      error: "No pudimos registrar tu cotización ahora. Escríbele a tu asesor.",
    };
  }

  // 4. Correlativo EST-YYYY-NNNN (misma serie que el resto de estimados/cotizaciones).
  const { data: codeData, error: codeErr } = await admin.rpc(
    "next_estimate_code",
    { p_tenant_id: tenantId },
  );
  if (codeErr || !codeData) {
    return { error: "No pudimos generar el código. Intenta de nuevo." };
  }
  const code = String(codeData);

  // 5. Insert de la cotización (precio en 0 → lo cotiza el asesor).
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

  // 6. Avisar al asesor (best-effort: no rompe el alta).
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
