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
import { moduleEditDenial } from "@/lib/studio/rbac-guard";
import {
  validateClientInput,
  type ClientActionState,
  type ClientDocKind,
  type ClientInput,
  type ClientTier,
} from "@/lib/studio/client-types";
import { validateClientAddressInput } from "@/lib/studio/client-address-types";
import {
  insertClientDeliveryAddress,
  clearDefaultForClient,
  setDefaultDeliveryAddress,
  softDeleteClientDeliveryAddress,
} from "@/lib/studio/client-address-queries";
import { geocodeAddress, type GeocodeResult } from "@/lib/studio/geocoding";
import { validateMarkboxFormat } from "@/lib/studio/markbox-utils";
import { sendWelcomeEmail } from "@/lib/studio/welcome-email";
import {
  sendPortalInviteEmail,
  generatePortalAccessLink,
} from "@/lib/studio/portal-invite-email";
import { toWhatsAppRaw } from "@/lib/portal/portal-types";
import { verifyIdentity, type VerifyResult } from "@/lib/studio/identity";
import { notifyIdentityMismatch } from "@/lib/studio/identity/notify-mismatch";
import { identityResetOnChange } from "@/lib/studio/identity/reset-on-change";
import type { DocumentKind } from "@/lib/studio/identity/document";

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

  // SDD-0131: tipo de documento del alta (persona/empresa). Default 'persona'.
  const docKindRaw = String(formData.get("doc_kind") ?? "persona");
  const doc_kind: ClientDocKind =
    docKindRaw === "empresa" ? "empresa" : "persona";

  return {
    doc_kind,
    name: parseStringOrNull(formData.get("name")) ?? undefined,
    contact_name: parseStringOrNull(formData.get("contact_name")),
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

  const denial = await moduleEditDenial(supabase, "clients");
  if (denial) return { error: denial };

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
    return { error: "No se pudo generar el Shipping Mark." };
  }
  const markbox = String(markboxData);

  // SDD-0032: defensive double check del formato post-RPC
  if (!validateMarkboxFormat(markbox)) {
    return {
      error: `Shipping Mark inválido generado: ${markbox}. Verifica el RPC next_markbox.`,
    };
  }

  const { error } = await supabase.from("clients").insert({
    tenant_id: link.tenant_id,
    markbox,
    name: input!.name,
    contact_name: input!.contact_name,
    email: input!.email,
    phone: input!.phone,
    address: input!.address,
    rif: input!.rif,
    doc_kind: input!.doc_kind,
    tier: input!.tier,
    notes: input!.notes,
    lat: input!.lat,
    lng: input!.lng,
  });

  if (error) {
    // Unique-violation del índice clients_tenant_doc_unique (documento normalizado
    // por tenant) → mensaje amable en vez del error crudo de Postgres.
    if (error.code === "23505") {
      return { error: "Ya existe un cliente con ese RIF/cédula en este tenant." };
    }
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

  const denial = await moduleEditDenial(supabase, "clients");
  if (denial) return { error: denial };

  const partial = inputFromFormData(formData);
  const { input, fieldErrors } = validateClientInput(partial);
  if (fieldErrors) return { fieldErrors };

  // Si cambia el nombre o el RIF/cédula, la verificación previa (SDD-0046) queda
  // desalineada → resetear doc_verify_* para forzar re-verificación.
  const { data: currentRow } = await supabase
    .from("clients")
    .select("name, rif")
    .eq("markbox", markbox)
    .maybeSingle<{ name: string | null; rif: string | null }>();
  const identityReset = identityResetOnChange(
    { name: currentRow?.name ?? null, rif: currentRow?.rif ?? null },
    { name: input!.name, rif: input!.rif },
  );

  const { error } = await supabase
    .from("clients")
    .update({
      name: input!.name,
      contact_name: input!.contact_name,
      email: input!.email,
      phone: input!.phone,
      address: input!.address,
      rif: input!.rif,
      doc_kind: input!.doc_kind,
      tier: input!.tier,
      notes: input!.notes,
      lat: input!.lat,
      lng: input!.lng,
      ...(identityReset ?? {}),
    })
    .eq("markbox", markbox);

  if (error) {
    // Editar el rif a uno ya usado por otro cliente del tenant viola
    // clients_tenant_doc_unique (documento normalizado) → 23505.
    if (error.code === "23505") {
      return { error: "Ya existe otro cliente con ese RIF/cédula." };
    }
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
  if (!userResp.user) return { ok: false, error: "Inicia sesión primero." };

  // Default a Venezuela (la mayoría de clientes están allá). Si la
  // dirección incluye otro país, Nominatim igual lo intenta — el
  // countrycodes solo filtra cuando hay ambigüedad.
  return geocodeAddress(address, { countryCode: "ve" });
}

export async function softDeleteClientAction(
  markbox: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, "clients");
  if (denial) return { error: denial };

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
): Promise<{ ok?: boolean; error?: string; email?: string; warning?: string }> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, "clients");
  if (denial) return { error: denial };

  const { data, error } = await supabase.rpc("portal_invite_client", {
    p_client_id: clientId,
  });

  if (error) {
    const msg = error.message.includes("no tiene email")
      ? "El cliente no tiene email — agrégalo antes de habilitar el portal."
      : `No se pudo habilitar el portal: ${error.message}`;
    return { error: msg };
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | { client_email?: string }
    | null;
  const email = row?.client_email ?? null;

  // Correo de invitación (best-effort · NO rompe la habilitación si falla). El
  // correo lleva al cliente a /portal/login con su email precargado; ahí pide su
  // propio enlace de acceso (magic-link). SDD-0042.
  let warning: string | undefined;
  if (email) {
    const { data: link } = await supabase
      .from("user_tenants")
      .select("tenant_id")
      .maybeSingle<{ tenant_id: string }>();
    // Nombre del cliente para el saludo (RLS ya scopea al tenant del usuario).
    const { data: client } = await supabase
      .from("clients")
      .select("name")
      .eq("id", clientId)
      .maybeSingle<{ name: string }>();

    if (link?.tenant_id) {
      const admin = createAdminClient();
      const sent = await sendPortalInviteEmail(admin, link.tenant_id, {
        email,
        name: client?.name ?? null,
      });
      if (!sent.ok) {
        warning = `Portal habilitado, pero el correo de invitación no salió: ${sent.error}`;
        console.warn("[invitePortalAction] invite email failed:", sent.error);
      }
    } else {
      warning = "Portal habilitado, pero no pude resolver el tenant para enviar el correo.";
    }
  }

  revalidatePath(`/studio/clientes/${markbox}`);
  return { ok: true, email: email ?? undefined, warning };
}

/**
 * Genera un enlace de acceso DIRECTO al portal para COMPARTIR por WhatsApp (founder
 * 2026-07-01). El asesor lo manda al WhatsApp del cliente y coordina en vivo → así
 * el TTL corto del enlace (30 min) no molesta. Devuelve el link + el número wa.me
 * del cliente (si tiene) para que la tarjeta arme el `wa.me/…?text=`.
 *
 * ⚠️ Seguridad: el enlace LOGUEA a quien lo abra como el cliente → mandarlo SOLO a
 * su WhatsApp. Es de un solo uso y caduca. El botón que llama esto solo se muestra
 * cuando el cliente ya está invitado/activo (si no, el bind por email fallaría).
 */
export async function portalAccessLinkAction(
  clientId: string,
): Promise<
  | { ok: true; link: string; whatsappRaw: string | null; name: string | null }
  | { ok: false; error: string }
> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, "clients");
  if (denial) return { ok: false, error: denial };

  // Cliente (RLS scopea al tenant del usuario): email obligatorio + teléfono para wa.me.
  const { data: client } = await supabase
    .from("clients")
    .select("email, name, phone")
    .eq("id", clientId)
    .maybeSingle<{ email: string | null; name: string | null; phone: string | null }>();
  if (!client?.email) {
    return {
      ok: false,
      error: "El cliente no tiene email — agrégalo antes de generar el acceso.",
    };
  }

  const admin = createAdminClient();
  const link = await generatePortalAccessLink(admin, client.email);
  if (!link) {
    return { ok: false, error: "No se pudo generar el enlace de acceso. Intenta de nuevo." };
  }

  return {
    ok: true,
    link,
    whatsappRaw: toWhatsAppRaw(client.phone),
    name: client.name,
  };
}

export async function revokePortalAction(
  clientId: string,
  markbox: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, "clients");
  if (denial) return { error: denial };

  const { error } = await supabase.rpc("portal_revoke_client", {
    p_client_id: clientId,
  });

  if (error) {
    return { error: `No se pudo revocar el acceso: ${error.message}` };
  }

  revalidatePath(`/studio/clientes/${markbox}`);
  return { ok: true };
}

/**
 * Aprobar la cuenta del cliente para que vea el dashboard del portal (SDD-0042
 * Fase 5 · gate de activación). Llama la RPC `portal_approve_client` (SECURITY
 * DEFINER, membresía de tenant) que setea `clients.portal_approved_at = now()`.
 */
export async function approvePortalAction(
  clientId: string,
  markbox: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, "clients");
  if (denial) return { error: denial };

  const { error } = await supabase.rpc("portal_approve_client", {
    p_client_id: clientId,
  });

  if (error) {
    return { error: `No se pudo aprobar la cuenta: ${error.message}` };
  }

  revalidatePath(`/studio/clientes/${markbox}`);
  return { ok: true };
}

// ── Verificación de identidad (SDD-0046 · Slice B) ─────────────────────────
// Herramienta interna/CRM: cotea documento ↔ nombre del cliente contra el
// registro oficial (CNE para persona / SENIAT para empresa). Resultado ADVISORY
// — nunca bloquea al cliente. El motor vive en lib/studio/identity (server-only).

/**
 * Verifica la identidad del cliente contra el registro oficial y persiste el
 * resultado en `clients.doc_verify_*`. Si el resultado es `mismatch`, dispara una
 * alerta interna al equipo (best-effort, no rompe).
 *
 * Authz: `createClient()` (RLS scopea al tenant del usuario) + filtro explícito
 * `tenant_id` defensivo en el UPDATE.
 */
export async function verifyIdentityAction(
  clientId: string,
  markbox: string,
): Promise<{ ok?: boolean; error?: string; result?: VerifyResult }> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, "clients");
  if (denial) return { error: denial };

  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) return { error: "Inicia sesión primero." };

  // Tenant del usuario (para el filtro defensivo del UPDATE + la alerta).
  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  if (!link?.tenant_id) return { error: "No se pudo resolver el tenant." };

  // Leer el cliente por id (RLS ya garantiza que es del tenant del usuario).
  const { data: client, error: readErr } = await supabase
    .from("clients")
    .select("id, name, rif, doc_kind")
    .eq("id", clientId)
    .maybeSingle<{
      id: string;
      name: string;
      rif: string | null;
      doc_kind: DocumentKind | null;
    }>();
  if (readErr) return { error: `No se pudo leer el cliente: ${readErr.message}` };
  if (!client) return { error: "Cliente no encontrado." };

  // Motor de verificación (nunca tira; degrada a 'unavailable').
  const result = await verifyIdentity({
    rif: client.rif,
    name: client.name,
    docKind: client.doc_kind,
  });

  // Persistir el resultado (filtro tenant_id defensivo además del scope de RLS).
  const { error: updErr } = await supabase
    .from("clients")
    .update({
      doc_verify_status: result.status,
      doc_verify_source: result.source,
      doc_registry_name: result.registryName ?? null,
      doc_verified_at: new Date().toISOString(),
      doc_verified_by: userResp.user.id,
    })
    .eq("id", clientId)
    .eq("tenant_id", link.tenant_id);
  if (updErr) {
    return { error: `No se pudo guardar la verificación: ${updErr.message}` };
  }

  // Mismatch → alerta interna al equipo (best-effort, no rompe la acción).
  if (result.status === "mismatch") {
    const admin = createAdminClient();
    await notifyIdentityMismatch(admin, link.tenant_id, {
      markbox,
      clientName: client.name,
      registryName: result.registryName ?? null,
      source: result.source,
    });
  }

  revalidatePath(`/studio/clientes/${markbox}`);
  return { ok: true, result };
}

/**
 * Marca manual del asesor (piso manual del SDD-0046): cuando el auto falla/degrada
 * o el asesor quiere overridear, marca `ok | mismatch` con `source='manual'`.
 * No dispara alerta (es una decisión humana, no un hallazgo automático).
 */
export async function markIdentityAction(
  clientId: string,
  markbox: string,
  verdict: "ok" | "mismatch",
): Promise<{ ok?: boolean; error?: string }> {
  if (verdict !== "ok" && verdict !== "mismatch") {
    return { error: "Veredicto inválido." };
  }

  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, "clients");
  if (denial) return { error: denial };

  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) return { error: "Inicia sesión primero." };

  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  if (!link?.tenant_id) return { error: "No se pudo resolver el tenant." };

  const { error } = await supabase
    .from("clients")
    .update({
      doc_verify_status: verdict,
      doc_verify_source: "manual",
      doc_registry_name: null,
      doc_verified_at: new Date().toISOString(),
      doc_verified_by: userResp.user.id,
    })
    .eq("id", clientId)
    .eq("tenant_id", link.tenant_id);
  if (error) {
    return { error: `No se pudo guardar la marca: ${error.message}` };
  }

  revalidatePath(`/studio/clientes/${markbox}`);
  return { ok: true };
}

// ── Asesor asignado (ERP→Norte · clients.advisor_id) ───────────────────────
// Asigna / desasigna el asesor (account-director) del cliente. El portal lo
// muestra como "Tu asesor" (card de /portal/mensajes) y rutea su contacto. El
// trigger clients_advisor_same_tenant (migr 0151) garantiza que el asesor sea
// miembro activo del mismo tenant; acá filtramos tenant_id defensivo en el UPDATE.

export async function assignAdvisorAction(
  clientId: string,
  markbox: string,
  advisorId: string | null,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, "clients");
  if (denial) return { error: denial };

  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) return { error: "Inicia sesión primero." };

  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  if (!link?.tenant_id) return { error: "No se pudo resolver el tenant." };

  const value = advisorId && advisorId.trim() ? advisorId.trim() : null;

  const { error } = await supabase
    .from("clients")
    .update({ advisor_id: value })
    .eq("id", clientId)
    .eq("tenant_id", link.tenant_id);

  if (error) {
    // El trigger clients_advisor_same_tenant rechaza con check_violation (23514)
    // si el asesor no es miembro activo del tenant → mensaje amable.
    if (error.code === "23514" || /miembro activo del tenant/i.test(error.message)) {
      return { error: "Ese asesor no es un miembro activo de tu equipo." };
    }
    return { error: `No se pudo asignar el asesor: ${error.message}` };
  }

  revalidatePath(`/studio/clientes/${markbox}`);
  return { ok: true };
}

// ── Direcciones de entrega (SDD-0138 Slice B · client_delivery_addresses) ──
// El asesor gestiona las direcciones del cliente desde el detalle; el cliente
// gestiona LAS SUYAS desde /portal/perfil — mismo esquema, dos superficies. Van
// con el client de SESIÓN: la RLS por tenant cubre la propiedad y el trigger de
// la migración 0198 sella tenant_id/client_markbox desde `clients`.

export async function addClientAddressAction(
  clientId: string,
  markbox: string,
  formData: FormData,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, "clients");
  if (denial) return { error: denial };

  const parsed = validateClientAddressInput(formData);
  if (!parsed.ok) {
    // La card del Studio muestra un solo mensaje — devolvemos el primero.
    const first = Object.values(parsed.errors)[0];
    return { error: first ?? "Revisa los datos de la dirección." };
  }

  try {
    if (parsed.value.isDefault) {
      await clearDefaultForClient(supabase, clientId);
    }
    await insertClientDeliveryAddress(supabase, clientId, parsed.value);
  } catch (e) {
    return {
      error: `No se pudo guardar la dirección: ${e instanceof Error ? e.message : "error inesperado"}`,
    };
  }

  revalidatePath(`/studio/clientes/${markbox}`);
  return { ok: true };
}

export async function setDefaultClientAddressAction(
  clientId: string,
  markbox: string,
  addressId: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, "clients");
  if (denial) return { error: denial };

  try {
    await setDefaultDeliveryAddress(supabase, clientId, addressId);
  } catch (e) {
    return {
      error: `No se pudo marcar la predeterminada: ${e instanceof Error ? e.message : "error inesperado"}`,
    };
  }

  revalidatePath(`/studio/clientes/${markbox}`);
  return { ok: true };
}

export async function deleteClientAddressAction(
  markbox: string,
  addressId: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, "clients");
  if (denial) return { error: denial };

  try {
    await softDeleteClientDeliveryAddress(supabase, addressId);
  } catch (e) {
    return {
      error: `No se pudo eliminar la dirección: ${e instanceof Error ? e.message : "error inesperado"}`,
    };
  }

  revalidatePath(`/studio/clientes/${markbox}`);
  return { ok: true };
}
