"use server";

/**
 * Solicitud de cotización desde el portal (Norte). El cliente registrado pide que
 * le coticen un servicio; se crea un `quote` source='studio' (cliente conocido,
 * precio en 0) que el asesor cotiza en `/studio/cotizador`, y se le avisa.
 *
 * SEGURIDAD: tenant, `markbox` y `nombre` salen de la SESIÓN
 * (`getPortalClientPrincipal`: vínculo activo, cliente vivo del mismo tenant),
 * NUNCA del FormData → un cliente no puede crear cotizaciones a nombre de otro.
 * El insert corre con admin client (el cliente del portal no tiene RLS de INSERT
 * sobre `quotes`; mismo criterio que los demás writes del portal), pero scopeado
 * al tenant y al markbox de SU sesión. SDD-0552: el tenant ya no se relee de
 * `clients` con el admin.
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
import {
  isClientRequestConflict,
  isMissingClientRequestColumn,
  readClientRequestId,
} from "@/lib/shared/client-request";

export type CotizacionRequestState = {
  ok?: boolean;
  createdCode?: string;
  /** La cotización ya existía: un reintento del mismo envío (SDD-0599). */
  replayed?: boolean;
  error?: string;
  fieldErrors?: CotizacionFieldErrors;
};

/** El código de la cotización que ya creó este intento. Sin 0512 la columna no existe, y sigue como un envío nuevo. */
async function findQuoteCodeByRequest(
  admin: ReturnType<typeof createAdminClient>,
  args: { tenantId: string; markbox: string; requestId: string },
): Promise<string | null> {
  const { data, error } = await admin
    .from("quotes")
    .select("quote_code")
    .eq("tenant_id", args.tenantId)
    .eq("client_markbox", args.markbox)
    .eq("client_request_id", args.requestId)
    .is("deleted_at", null)
    .maybeSingle<{ quote_code: string }>();
  return error ? null : (data?.quote_code ?? null);
}

/** Un reintento del mismo envío responde lo mismo que el primero, sin otro correlativo ni otro aviso al asesor. */
function replayCotizacion(createdCode: string): CotizacionRequestState {
  revalidatePath("/portal/cotizaciones");
  revalidatePath("/portal");
  return { ok: true, createdCode, replayed: true };
}

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

  // 2. Resolver al cliente y su tenant DESDE LA SESIÓN (no del form). La quote
  //    debe vivir en SU tenant para que el asesor la vea.
  const supabase = await createClient();
  const principal = await getPortalClientPrincipal(supabase);
  if (!principal) {
    return { error: "Tu sesión expiró. Vuelve a entrar e intenta de nuevo." };
  }
  const { client, tenantId } = principal;

  // 3. Admin client (service_role) para el insert + correlativo + aviso.
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return {
      error: "No pudimos registrar tu cotización ahora. Escríbele a tu asesor.",
    };
  }

  // Antes de gastar un correlativo: si este intento ya creó la cotización, no crea otra.
  const requestId = readClientRequestId(formData);
  const scope = { tenantId, markbox: client.markbox };
  if (requestId) {
    const existing = await findQuoteCodeByRequest(admin, { ...scope, requestId });
    if (existing) return replayCotizacion(existing);
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
  const fila = { tenant_id: tenantId, quote_code: code, ...row };
  const insertar = (valores: typeof fila & { client_request_id?: string }) =>
    admin.from("quotes").insert(valores);

  let { error: insertErr } = await insertar(
    requestId ? { ...fila, client_request_id: requestId } : fila,
  );
  // Sin 0512 la columna no existe: la cotización entra sin candado, como antes.
  if (isMissingClientRequestColumn(insertErr)) {
    ({ error: insertErr } = await insertar(fila));
  }
  if (requestId && isClientRequestConflict(insertErr)) {
    // Otro intento del mismo envío ganó la carrera: esa es la cotización.
    const existing = await findQuoteCodeByRequest(admin, { ...scope, requestId });
    if (existing) return replayCotizacion(existing);
  }
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
