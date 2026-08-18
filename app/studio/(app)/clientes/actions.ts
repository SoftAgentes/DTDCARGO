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
import { redirect } from "next/navigation";
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
  validateAliadoInput,
  type AliadoActionState,
} from "@/lib/studio/aliados/aliado-types";
import {
  nombreListaDeAliado,
  validateDescuento,
  validatePriceBookName,
} from "@/lib/studio/price-books/price-book-types";
import { getPriceBookByAliado } from "@/lib/studio/price-books/price-book-queries";
import { parseMarkbox } from "@/lib/shared/markbox-chain";
import {
  parseLoteResult,
  type LoteLegadoActionState,
} from "@/lib/studio/markbox-legacy-types";
import {
  validateNuevoMarkbox,
  type RenameMarkboxActionState,
} from "@/lib/studio/markbox-history-types";
import {
  insertClientDeliveryAddress,
  clearDefaultForClient,
  setDefaultDeliveryAddress,
  softDeleteClientDeliveryAddress,
} from "@/lib/studio/client-address-queries";
import { geocodeAddress, type GeocodeResult } from "@/lib/studio/geocoding";
import { validateMarkboxFormat } from "@/lib/studio/markbox-utils";
import { sendWelcomeEmail } from "@/lib/studio/welcome-email";
import { sendPortalInviteEmail } from "@/lib/studio/portal-invite-email";
import { createAccessLink } from "@/lib/studio/portal/access-link";
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

  // ── El Shipping Mark: de la casa o del aliado (SDD-0255) ─────────────────
  // Si el cliente cuelga de un aliado, el código NO sale de `next_markbox`: sale
  // de `next_markbox_aliado`, que numera por cadena exacta. Los dos correlativos
  // son independientes por construcción — `HR-0001` no matchea `^DTD-\d+$`, así
  // que meter clientes de aliado no mueve el contador de la casa.
  const aliadoIdRaw = String(formData.get("aliadoId") ?? "").trim();
  const aliadoId = aliadoIdRaw === "" ? null : aliadoIdRaw;

  let markbox: string;

  if (aliadoId) {
    // Se lee el prefijo del aliado para poder verificar el código emitido contra
    // el aliado que el usuario eligió (y no sólo contra "parece un código").
    const { data: aliadoRow } = await supabase
      .from("aliados")
      .select("prefix, status")
      .eq("id", aliadoId)
      .is("deleted_at", null)
      .maybeSingle<{ prefix: string; status: string }>();

    if (!aliadoRow) return { error: "Ese aliado no existe o no está disponible." };
    if (aliadoRow.status !== "activo") {
      return { error: "Ese aliado no está activo: no se le pueden dar de alta clientes nuevos." };
    }

    const { data, error: rpcErr } = await supabase.rpc("next_markbox_aliado", {
      p_aliado_id: aliadoId,
    });
    if (rpcErr || !data) {
      return { error: "No se pudo generar el Shipping Mark del aliado." };
    }
    markbox = String(data);

    // Doble chequeo defensivo, equivalente al del camino de la casa: el código
    // tiene que parsear como cadena Y terminar en el prefijo del aliado elegido.
    const parsed = parseMarkbox(markbox);
    if (!parsed || parsed.prefixes[parsed.prefixes.length - 1] !== aliadoRow.prefix.toUpperCase()) {
      return {
        error: `Shipping Mark inválido generado: ${markbox}. Verifica el RPC next_markbox_aliado.`,
      };
    }
  } else {
    const { data: markboxData, error: markboxErr } = await supabase.rpc(
      "next_markbox",
      { p_tenant_id: link.tenant_id },
    );
    if (markboxErr || !markboxData) {
      return { error: "No se pudo generar el Shipping Mark." };
    }
    markbox = String(markboxData);

    // SDD-0032: defensive double check del formato post-RPC
    if (!validateMarkboxFormat(markbox)) {
      return {
        error: `Shipping Mark inválido generado: ${markbox}. Verifica el RPC next_markbox.`,
      };
    }
  }

  const { data: created, error } = await supabase
    .from("clients")
    .insert({
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
      aliado_id: aliadoId,
    })
    .select("id")
    .single<{ id: string }>();

  if (error) {
    // ⚠️ Hay DOS índices únicos que devuelven 23505 y significan cosas distintas.
    // Antes se traducían los dos como "ya existe ese RIF/cédula", así que una
    // colisión de correlativo —que existe: el MAX+1 del RPC no tiene lock— se le
    // reportaba al usuario como documento duplicado y lo mandaba a buscar una
    // ficha que no existe. Se distinguen por el nombre del constraint.
    if (error.code === "23505") {
      if (/clients_tenant_id_markbox_key/.test(error.message)) {
        return {
          error: "Dos altas tomaron el mismo Shipping Mark al mismo tiempo. Intenta otra vez — el código siguiente ya está libre.",
        };
      }
      return { error: "Ya existe un cliente con ese RIF/cédula en este tenant." };
    }
    // El trigger clients_guard_markbox_aliado_t (migr 0362) rechaza con 23514 si
    // el código y el aliado no se corresponden.
    if (error.code === "23514" && /insignia|Shipping Mark/i.test(error.message)) {
      return { error: error.message };
    }
    return { error: `No se pudo crear el cliente: ${error.message}` };
  }

  // SDD-0032: Email de bienvenida (soft · no rompe creación si falla)
  const warnings: string[] = [];
  if (input!.email) {
    const admin = createAdminClient();
    const welcome = await sendWelcomeEmail(admin, link.tenant_id, {
      markbox,
      name: input!.name,
      email: input!.email,
    });
    if (!welcome.ok) {
      warnings.push(`Email de bienvenida no se pudo encolar: ${welcome.error}`);
      console.warn("[createClientAction] welcome email failed:", welcome.error);
    }

    // Adopción del portal (founder 2026-07-10): el cliente creado por el equipo
    // recibe acceso al portal + invitación con magic-link, igual que un
    // auto-registro. Arregla la fuga (antes el acceso se daba a mano, 1×1 → 23/397).
    // Best-effort: NUNCA rompe la creación del cliente.
    if (created?.id) {
      const { data: inv, error: invErr } = await supabase.rpc(
        "portal_invite_client",
        { p_client_id: created.id },
      );
      if (invErr) {
        warnings.push(
          `Cliente creado, pero no se pudo habilitar el portal automáticamente: ${invErr.message}`,
        );
        console.warn("[createClientAction] portal invite failed:", invErr.message);
      } else {
        const row = (Array.isArray(inv) ? inv[0] : inv) as
          | { client_email?: string }
          | null;
        const inviteEmail = row?.client_email ?? input!.email;
        const sent = await sendPortalInviteEmail(admin, link.tenant_id, {
          email: inviteEmail,
          name: input!.name,
        });
        if (!sent.ok) {
          warnings.push(
            `Portal habilitado, pero el correo de invitación no salió: ${sent.error}`,
          );
        }
      }
    }
  }

  revalidatePath("/studio/clientes");
  return {
    ok: true,
    createdMarkbox: markbox,
    warning: warnings.length ? warnings.join(" · ") : undefined,
  };
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

  // Estado previo (para el reset de verificación + la traza de auditoría).
  const { data: currentRow } = await supabase
    .from("clients")
    .select("id, tenant_id, name, rif, phone")
    .eq("markbox", markbox)
    .maybeSingle<{
      id: string;
      tenant_id: string;
      name: string | null;
      rif: string | null;
      phone: string | null;
    }>();
  // Si cambia el nombre o el RIF/cédula, la verificación previa (SDD-0046) queda
  // desalineada → resetear doc_verify_* para forzar re-verificación.
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

  // Traza (SDD-0151): si el equipo cambió nombre/RIF/teléfono directo en la ficha,
  // se registra como fila source='admin' auto-aprobada → aparece en el historial
  // de la ficha junto a lo que propone el cliente. Best-effort, nunca rompe el save.
  if (currentRow) {
    const changed = (a: string | null, b: string | null) =>
      (a ?? "").trim().toLowerCase() !== (b ?? "").trim().toLowerCase();
    const nameChanged = changed(currentRow.name, input!.name);
    const rifChanged = changed(currentRow.rif, input!.rif);
    const phoneChanged = changed(currentRow.phone, input!.phone);
    if (nameChanged || rifChanged || phoneChanged) {
      try {
        const admin = createAdminClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        await admin.from("client_change_requests").insert({
          tenant_id: currentRow.tenant_id,
          client_id: currentRow.id,
          proposed_name: nameChanged ? input!.name : null,
          proposed_rif: rifChanged ? input!.rif : null,
          proposed_phone: phoneChanged ? input!.phone : null,
          prev_name: currentRow.name,
          prev_rif: currentRow.rif,
          prev_phone: currentRow.phone,
          status: "approved",
          source: "admin",
          reviewed_by: user?.id ?? null,
          reviewed_at: new Date().toISOString(),
        });
      } catch (e) {
        console.error("[updateClientAction] audit log falló:", e);
      }
    }
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
 * Genera un enlace de acceso al portal para COMPARTIR por WhatsApp (founder
 * 2026-07-01). Devuelve el link + el número wa.me del cliente (si tiene) para que
 * la tarjeta arme el `wa.me/…?text=`.
 *
 * ⚠️ **Ya NO devuelve el magic-link crudo de Supabase (SDD-0253).** Devuelve un
 * enlace corto propio, `dtdcargo.com/entrar/<código>`, que abre una página con un
 * botón. El magic-link se acuña cuando el CLIENTE aprieta ese botón.
 *
 * Por qué cambió: el robot de previsualización de WhatsApp recorría la cadena del
 * magic-link para armar la tarjeta del chat y **consumía el token de un solo uso
 * antes que el cliente** (medido el 2026-08-09 con DTD-9017). Un crawler hace GET;
 * la página nueva sólo gasta el código en el POST del botón. De regalo se cae el
 * TTL de 30 minutos: el token nace cuando el cliente lee, no cuando el asesor
 * manda.
 *
 * ⚠️ Seguridad: el código sigue LOGUEANDO como el cliente a quien lo abra →
 * mandarlo SOLO a su WhatsApp. Un solo uso, vence en 72 h, revocable.
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

  // El RPC valida el tenant adentro → va con la sesión del asesor, no con admin.
  const issued = await createAccessLink(supabase, clientId);
  if (!issued.ok) return { ok: false, error: issued.error };

  return {
    ok: true,
    link: issued.url,
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

// ── Aliados white-label (SDD-0255) ─────────────────────────────────────────
// El founder marca a mano: entra a la ficha de un cliente y lo convierte en
// aliado. El aliado ES un cliente; la fila de `aliados` le cuelga por client_id.
//
// Toda la validación dura vive en la base (migr 0362): formato e insignia
// reservada por CHECK, unicidad global del prefijo por índice único, y el
// anti-ciclo por trigger. Acá se valida lo mismo antes de viajar para dar un
// mensaje decente, y se traducen los errores de Postgres que igual pueden llegar
// (dos ventanas marcando aliados a la vez).

export async function convertirEnAliadoAction(
  markbox: string,
  _prev: AliadoActionState,
  formData: FormData,
): Promise<AliadoActionState> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, "clients");
  if (denial) return { error: denial };

  const parsed = validateAliadoInput(formData);
  if (parsed.error) return { error: parsed.error };
  const input = parsed.value!;

  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  if (!link?.tenant_id) return { error: "No se pudo resolver el tenant." };

  const { error } = await supabase.from("aliados").insert({
    tenant_id: link.tenant_id,
    client_id: input.clientId,
    parent_aliado_id: input.parentAliadoId,
    prefix: input.prefix,
    trade_name: input.tradeName,
    agreement_notes: input.agreementNotes,
    status: input.status,
  });

  if (error) return { error: mensajeDeErrorAliado(error) };

  revalidatePath(`/studio/clientes/${markbox}`);
  return { ok: true };
}

export async function actualizarAliadoAction(
  aliadoId: string,
  markbox: string,
  _prev: AliadoActionState,
  formData: FormData,
): Promise<AliadoActionState> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, "clients");
  if (denial) return { error: denial };

  const parsed = validateAliadoInput(formData);
  if (parsed.error) return { error: parsed.error };
  const input = parsed.value!;

  if (input.parentAliadoId === aliadoId) {
    return { error: "Un aliado no puede colgar de sí mismo." };
  }

  const { error } = await supabase
    .from("aliados")
    .update({
      parent_aliado_id: input.parentAliadoId,
      prefix: input.prefix,
      trade_name: input.tradeName,
      agreement_notes: input.agreementNotes,
      status: input.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", aliadoId);

  if (error) return { error: mensajeDeErrorAliado(error) };

  revalidatePath(`/studio/clientes/${markbox}`);
  return { ok: true };
}

/**
 * Pacta (o repacta) la tarifa de un aliado — SDD-0269.
 *
 * La tarifa vive en una LISTA DE PRECIOS propia del aliado (`price_books`,
 * migr 0382). Esta acción crea la lista si todavía no existe y guarda su
 * descuento; las tarifas propias, si las pacta, se cargan después desde
 * /studio/tarifas eligiendo su lista.
 *
 * Sólo el aliado RAÍZ tiene lista: un sub-aliado le factura a su padre, no a
 * DTD. La base lo impide igual (trigger `price_books_guard_aliado_t`); acá se
 * corta antes para poder dar un mensaje que se entienda.
 */
export async function guardarTarifaAliadoAction(
  aliadoId: string,
  markbox: string,
  _prev: AliadoActionState,
  formData: FormData,
): Promise<AliadoActionState> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, "clients");
  if (denial) return { error: denial };

  const { data: aliado } = await supabase
    .from("aliados")
    .select("id, tenant_id, parent_aliado_id, trade_name")
    .eq("id", aliadoId)
    .is("deleted_at", null)
    .maybeSingle<{
      id: string;
      tenant_id: string;
      parent_aliado_id: string | null;
      trade_name: string;
    }>();

  if (!aliado) return { error: "No se encontró el aliado." };
  if (aliado.parent_aliado_id) {
    return {
      error:
        "La tarifa se pacta con el aliado raíz. Este es un sub-aliado: hereda la de su raíz.",
    };
  }

  const descuento = validateDescuento(String(formData.get("discountPct") ?? ""));
  if (descuento.error) return { error: descuento.error };

  const nombre = validatePriceBookName(
    String(formData.get("bookName") ?? "") || nombreListaDeAliado(aliado.trade_name),
  );
  if (nombre.error) return { error: nombre.error };

  const existente = await getPriceBookByAliado(supabase, aliadoId);

  const { error } = existente
    ? await supabase
        .from("price_books")
        .update({
          name: nombre.value!,
          discount_pct: descuento.value,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existente.id)
    : await supabase.from("price_books").insert({
        tenant_id: aliado.tenant_id,
        aliado_id: aliadoId,
        name: nombre.value!,
        discount_pct: descuento.value,
      });

  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Este aliado ya tiene una lista de precios."
          : `No se pudo guardar la tarifa: ${error.message}`,
    };
  }

  revalidatePath(`/studio/clientes/${markbox}`);
  revalidatePath("/studio/tarifas");
  return { ok: true };
}

/**
 * Cambia el Shipping Mark de un cliente (SDD-0258).
 *
 * NO hace el UPDATE acá: llama a la RPC `rename_client_markbox()` (migr 0367),
 * que mueve las 30 tablas que copian el código en UNA transacción y jubila el
 * viejo en `client_markbox_history`. Hacerlo desde la app serían 30 llamadas
 * sueltas de PostgREST, y el primer error dejaría al cliente partido a la mitad.
 *
 * ⚠️ Termina en `redirect()` y no en `return { ok: true }` a propósito: la ruta
 * es `/studio/clientes/[markbox]`, así que después del renombrado la URL actual
 * ya no existe. Sin el redirect el operador se queda mirando un 404 de la ficha
 * que acaba de editar.
 */
export async function renombrarMarkboxAction(
  clientId: string,
  markboxActual: string,
  _prev: RenameMarkboxActionState,
  formData: FormData,
): Promise<RenameMarkboxActionState> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, "clients");
  if (denial) return { error: denial };

  const parsed = validateNuevoMarkbox(String(formData.get("nuevoMarkbox") ?? ""), markboxActual);
  if (parsed.error) return { error: parsed.error };

  const motivoRaw = String(formData.get("motivo") ?? "").trim();

  const { data, error } = await supabase.rpc("rename_client_markbox", {
    p_client_id: clientId,
    p_new_markbox: parsed.value!,
    p_reason: motivoRaw === "" ? null : motivoRaw.slice(0, 500),
  });

  if (error) return { error: mensajeDeErrorRenombrado(error) };

  const nuevo = (data as { new_markbox?: string } | null)?.new_markbox ?? parsed.value!;

  // Las dos rutas: la vieja para que no quede cacheada apuntando a nada, y la
  // nueva porque es a donde vamos.
  revalidatePath(`/studio/clientes/${markboxActual}`);
  revalidatePath(`/studio/clientes/${nuevo}`);
  revalidatePath("/studio/clientes");

  redirect(`/studio/clientes/${encodeURIComponent(nuevo)}`);
}

/**
 * Traduce los errores de `rename_client_markbox()`. Cada rama corresponde a una
 * guarda REAL de la migr 0367 — no son mensajes defensivos genéricos.
 */
function mensajeDeErrorRenombrado(error: { code?: string; message: string }): string {
  if (error.code === "23505") {
    if (/retirado/i.test(error.message)) {
      return "Ese Shipping Mark ya lo tuvo alguien y quedó reservado para él. Un código retirado no se reutiliza nunca: si se reasignara, la carga rotulada con ese código llegaría a la ficha equivocada.";
    }
    return "Ese Shipping Mark ya es de otro cliente.";
  }
  if (error.code === "23514") {
    // Guard de coherencia con el módulo de aliados.
    return error.message;
  }
  if (error.code === "42501") {
    return "No tienes permiso para cambiar el Shipping Mark. Hace falta rol de administración, comercial u operaciones.";
  }
  if (error.code === "P0002") {
    return "No se encontró ese cliente.";
  }
  return `No se pudo cambiar el Shipping Mark: ${error.message}`;
}

/**
 * Migración por lote de los códigos del legado (SDD-0258, migr 0369).
 *
 * Un solo camino para simular y para ejecutar, con la misma función de la base:
 * lo que se previsualiza es exactamente lo que se va a correr. Si la simulación
 * la hiciera otra consulta, podría desincronizarse del ejecutor y el operador
 * estaría aprobando algo distinto de lo que pasa.
 */
export async function loteLegadoAction(
  batch: number,
  ejecutar: boolean,
): Promise<LoteLegadoActionState> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, "clients");
  if (denial) return { error: denial };

  if (!Number.isInteger(batch) || batch < 1 || batch > 500) {
    return { error: "El tamaño del lote va entre 1 y 500." };
  }

  const { data, error } = await supabase.rpc("rename_legacy_markboxes", {
    p_batch: batch,
    p_dry_run: !ejecutar,
    p_reason: "migración del código de vendedor a la serie de la casa",
  });

  if (error) {
    if (error.code === "42501") {
      return {
        error:
          "Un lote sólo lo puede correr un administrador. El renombrado de a uno sí lo puede hacer comercial u operaciones.",
      };
    }
    return { error: `No se pudo correr el lote: ${error.message}` };
  }

  const result = parseLoteResult(data);
  if (!result) return { error: "La base respondió algo que no se pudo leer." };

  if (ejecutar) {
    // Cada ficha migrada cambia su propia ruta, y el listado muestra los códigos.
    revalidatePath("/studio/clientes");
    revalidatePath("/studio/clientes/migrar-legado");
  }

  return { ok: true, result };
}

/**
 * Traduce los errores que la base puede devolver al marcar o editar un aliado.
 * Cada rama corresponde a una guarda REAL de la migr 0362 — no son mensajes
 * defensivos genéricos.
 */
function mensajeDeErrorAliado(error: { code?: string; message: string }): string {
  // Índice único aliados_prefix_uq (tenant_id, upper(prefix)).
  if (error.code === "23505" && /prefix/i.test(error.message)) {
    return "Ya hay un aliado con esa insignia. Tiene que ser única: la forma impresa del Shipping Mark omite el segmento de la raíz, así que dos insignias iguales harían ambiguo el código en el papel.";
  }
  // Constraint aliados_client_uq (client_id).
  if (error.code === "23505") {
    return "Ese cliente ya está marcado como aliado.";
  }
  // Triggers y CHECKs: anti-ciclo, formato, insignia reservada.
  if (error.code === "23514") {
    if (/ciclo|sí mismo/i.test(error.message)) {
      return "Esa jerarquía haría un ciclo: el aliado padre no puede colgar (directa o indirectamente) del mismo aliado que estás editando.";
    }
    if (/prefix/i.test(error.message)) {
      return "La insignia no es válida: son 2 a 4 letras y no puede ser DTD, ITS, AD ni LEG.";
    }
    return `La base rechazó el cambio: ${error.message}`;
  }
  return `No se pudo guardar el aliado: ${error.message}`;
}
