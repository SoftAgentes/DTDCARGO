/**
 * Server actions del módulo Clientes (SDD-0010).
 *
 * - createClient: autogenera MARKBOX via rpc('next_markbox') + insert
 * - updateClient: edit por markbox (no toca markbox)
 * - softDeleteClient: set deleted_at = now()
 *
 * Validación con validateClientInput() — sin zod, patrón del proyecto.
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import {
  validateClientInput,
  type ClientActionState,
  type ClientInput,
  type ClientTier,
} from "@/lib/studio/client-types";
import { geocodeAddress, type GeocodeResult } from "@/lib/studio/geocoding";
import { validateMarkboxFormat } from "@/lib/studio/markbox-utils";
import { sendWelcomeEmail } from "@/lib/studio/welcome-email";

function parseStringOrNull(v: FormDataEntryValue | null): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function parseNumberOrNull(v: FormDataEntryValue | null): number | null {
  const s = parseStringOrNull(v);
  if (s === null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : Number.NaN;
}

function inputFromFormData(formData: FormData): Partial<ClientInput> {
  const tierRaw = String(formData.get("tier") ?? "");
  const tier =
    tierRaw === "regular" || tierRaw === "vip" || tierRaw === "premium"
      ? (tierRaw as ClientTier)
      : undefined;

  return {
    name: parseStringOrNull(formData.get("name")) ?? undefined,
    email: parseStringOrNull(formData.get("email")),
    phone: parseStringOrNull(formData.get("phone")),
    address: parseStringOrNull(formData.get("address")),
    rif: parseStringOrNull(formData.get("rif")),
    tier,
    notes: parseStringOrNull(formData.get("notes")),
    lat: parseNumberOrNull(formData.get("lat")),
    lng: parseNumberOrNull(formData.get("lng")),
  };
}

export async function createClientAction(
  _prev: ClientActionState,
  formData: FormData,
): Promise<ClientActionState> {
  const supabase = await createClient();

  const partial = inputFromFormData(formData);
  const { input, fieldErrors } = validateClientInput(partial);
  if (fieldErrors) return { fieldErrors };

  // Resolver tenant_id (necesario para insert y para next_markbox)
  const { data: link, error: linkErr } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  if (linkErr || !link?.tenant_id) {
    return { error: "No se pudo resolver el tenant del usuario." };
  }

  // Generar MARKBOX atómico
  const { data: markboxData, error: markboxErr } = await supabase.rpc(
    "next_markbox",
    { p_tenant_id: link.tenant_id },
  );
  if (markboxErr || !markboxData) {
    return { error: "No se pudo generar el MARKBOX." };
  }
  const markbox = String(markboxData);

  // SDD-0032: defensive double check del formato post-RPC
  if (!validateMarkboxFormat(markbox)) {
    return {
      error: `MARKBOX inválido generado: ${markbox}. Verificá el RPC next_markbox.`,
    };
  }

  const { error } = await supabase.from("clients").insert({
    tenant_id: link.tenant_id,
    markbox,
    name: input!.name,
    email: input!.email,
    phone: input!.phone,
    address: input!.address,
    rif: input!.rif,
    tier: input!.tier,
    notes: input!.notes,
    lat: input!.lat,
    lng: input!.lng,
  });

  if (error) {
    return { error: `No se pudo crear el cliente: ${error.message}` };
  }

  // SDD-0032: Email de bienvenida (soft · no rompe creación si falla)
  let warning: string | undefined;
  if (input!.email) {
    const admin = createAdminClient();
    const welcome = await sendWelcomeEmail(admin, link.tenant_id, {
      markbox,
      name: input!.name,
      email: input!.email,
    });
    if (!welcome.ok) {
      warning = `Email de bienvenida no se pudo encolar: ${welcome.error}`;
      console.warn("[createClientAction] welcome email failed:", welcome.error);
    }
  }

  revalidatePath("/studio/clientes");
  return { ok: true, createdMarkbox: markbox, warning };
}

export async function updateClientAction(
  markbox: string,
  _prev: ClientActionState,
  formData: FormData,
): Promise<ClientActionState> {
  const supabase = await createClient();

  const partial = inputFromFormData(formData);
  const { input, fieldErrors } = validateClientInput(partial);
  if (fieldErrors) return { fieldErrors };

  const { error } = await supabase
    .from("clients")
    .update({
      name: input!.name,
      email: input!.email,
      phone: input!.phone,
      address: input!.address,
      rif: input!.rif,
      tier: input!.tier,
      notes: input!.notes,
      lat: input!.lat,
      lng: input!.lng,
    })
    .eq("markbox", markbox);

  if (error) {
    return { error: `No se pudo guardar el cliente: ${error.message}` };
  }

  revalidatePath("/studio/clientes");
  revalidatePath(`/studio/clientes/${markbox}`);
  return { ok: true };
}

/**
 * Geocoding wrapper · address → lat/lng via Nominatim. Devuelve null si
 * no encontró o si la API falla. UI muestra mensaje al user.
 *
 * Auth wall: requiere sesión Studio · evita usar el endpoint como proxy
 * de geocoding gratis para terceros.
 */
export async function geocodeClientAddressAction(
  address: string,
): Promise<
  | { ok: true; result: GeocodeResult }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) return { ok: false, error: "Iniciá sesión primero." };

  // Default a Venezuela (la mayoría de clientes están allá). Si la
  // dirección incluye otro país, Nominatim igual lo intenta — el
  // countrycodes solo filtra cuando hay ambigüedad.
  return geocodeAddress(address, { countryCode: "ve" });
}

export async function softDeleteClientAction(
  markbox: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("clients")
    .update({ deleted_at: new Date().toISOString() })
    .eq("markbox", markbox);

  if (error) {
    return { error: `No se pudo eliminar el cliente: ${error.message}` };
  }

  revalidatePath("/studio/clientes");
  return { ok: true };
}

// ── Portal del Cliente (SDD-0042) ──────────────────────────────────────────
// Habilitar / revocar el acceso del cliente al portal. Llaman a las RPCs
// SECURITY DEFINER (portal_invite_client / portal_revoke_client) que validan
// membresía de tenant. El cliente entra luego en /portal/login con su email.

export async function invitePortalAction(
  clientId: string,
  markbox: string,
): Promise<{ ok?: boolean; error?: string; email?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("portal_invite_client", {
    p_client_id: clientId,
  });

  if (error) {
    const msg = error.message.includes("no tiene email")
      ? "El cliente no tiene email — agregalo antes de habilitar el portal."
      : `No se pudo habilitar el portal: ${error.message}`;
    return { error: msg };
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | { client_email?: string }
    | null;
  revalidatePath(`/studio/clientes/${markbox}`);
  return { ok: true, email: row?.client_email };
}

export async function revokePortalAction(
  clientId: string,
  markbox: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("portal_revoke_client", {
    p_client_id: clientId,
  });

  if (error) {
    return { error: `No se pudo revocar el acceso: ${error.message}` };
  }

  revalidatePath(`/studio/clientes/${markbox}`);
  return { ok: true };
}
