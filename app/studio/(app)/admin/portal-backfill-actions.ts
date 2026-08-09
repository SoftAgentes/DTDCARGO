/**
 * Server action del backfill de invitaciones al portal (adopción · 2026-07-11).
 *
 * Provisiona acceso + manda la invitación (magic-link) a los clientes existentes
 * que aún no tienen portal (solo 23 de 397 lo tenían). Reusa la MISMA lógica que
 * la invitación 1×1 (portal_invite_client + sendPortalInviteEmail), en lote.
 *
 * SEGURIDAD/CUIDADO: es outward-facing (manda correos reales). Tope de MAX_PER_BATCH
 * por invocación (rate-limits de Resend/Auth + timeout de la action) — el founder
 * corre varias tandas. portal_invite_client es idempotente (no re-invita a un
 * activo), así que reintentar es seguro.
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { moduleEditDenial } from "@/lib/studio/rbac-guard";
import {
  beginD5ExternalEffect,
  finishD5ExternalEffect,
} from "@/lib/studio/audit/external-effect-adapter";
import { sendPortalInviteEmail } from "@/lib/studio/portal-invite-email";
import { createAccessLink } from "@/lib/studio/portal/access-link";
import { toWhatsAppRaw } from "@/lib/portal/portal-types";

export type BulkInviteState = {
  ok?: boolean;
  error?: string;
  /** invitados con correo enviado OK. */
  invited?: number;
  /** provisionados pero el correo no salió (reintentar). */
  emailFailed?: number;
  /** no se pudo ni provisionar (ej. sin email). */
  failed?: number;
  /** seleccionados que no se procesaron por el tope de la tanda. */
  remaining?: number;
  details?: string;
};

/** Tope por tanda: acota correos y el tiempo de la action (cada uno pega a Auth+Resend). */
const MAX_PER_BATCH = 20;

/** Validación de correo (misma regla que el listado de candidatos). */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ContactCaptureState = {
  ok?: boolean;
  error?: string;
  /** id del cliente guardado (para que la fila marque ✓). */
  clientId?: string;
  /** true si tras guardar el cliente quedó invitable (correo válido). */
  invitable?: boolean;
};

/**
 * Guarda correo/teléfono de un cliente SIN contacto (adopción · captura de contacto).
 * No manda correos — solo persiste el dato para que el cliente pase a ser invitable.
 * El correo, si viene, debe ser válido; el teléfono es libre. Al menos uno de los dos.
 */
export async function updateClientContactAction(
  _prev: ContactCaptureState,
  formData: FormData,
): Promise<ContactCaptureState> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, "clients");
  if (denial) return { error: denial };

  const clientId = String(formData.get("client_id") ?? "").trim();
  if (!clientId) return { error: "Falta el cliente." };

  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  if (!email && !phone) {
    return { error: "Escribe un correo o un teléfono.", clientId };
  }
  if (email && !EMAIL_RE.test(email)) {
    return { error: "El correo no tiene un formato válido.", clientId };
  }

  // Solo tocamos lo que el equipo escribió (no pisamos con vacío lo que no cargó).
  const patch: { email?: string; phone?: string } = {};
  if (email) patch.email = email;
  if (phone) patch.phone = phone;

  const { error } = await supabase
    .from("clients")
    .update(patch)
    .eq("id", clientId)
    .is("deleted_at", null);
  if (error) return { error: `No se pudo guardar: ${error.message}`, clientId };

  revalidatePath("/studio/admin");
  return { ok: true, clientId, invitable: EMAIL_RE.test(email) };
}

export type WhatsAppInviteResult =
  | { ok: true; link: string; whatsappRaw: string | null; name: string | null }
  | { ok: false; error: string };

/**
 * Invitación al portal por WhatsApp (adopción · canal WA). Provisiona el acceso
 * (`portal_invite_client`, idempotente → crea la fila `client_users 'invited'` para
 * que el bind funcione) y genera un enlace mágico fresco, pero NO manda correo: el
 * equipo lo comparte por WhatsApp (canal de mayor apertura en VE). Requiere email
 * (el magic-link se ata al correo) — los solo-teléfono deben capturarlo primero.
 *
 * ⚠️ El enlace LOGUEA como el cliente: se comparte SOLO a su WhatsApp. Un solo uso,
 * vence pronto (TTL de Auth). Mismo patrón que la tarjeta del cliente (PortalAccessCard).
 */
export async function portalWhatsAppInviteAction(
  clientId: string,
): Promise<WhatsAppInviteResult> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, "clients");
  if (denial) return { ok: false, error: denial };
  if (!clientId) return { ok: false, error: "Falta el cliente." };

  // Provisiona el acceso (idempotente): sin la fila client_users 'invited', el bind
  // por email falla al abrir el enlace.
  const { data, error } = await supabase.rpc("portal_invite_client", {
    p_client_id: clientId,
  });
  if (error) {
    return {
      ok: false,
      error: error.message.includes("no tiene email")
        ? "El cliente no tiene email — captúralo antes (el enlace se ata al correo)."
        : "No se pudo habilitar el acceso.",
    };
  }
  const row = (Array.isArray(data) ? data[0] : data) as
    | { client_email?: string }
    | null;
  const email = row?.client_email ?? null;
  if (!email) {
    return {
      ok: false,
      error: "El cliente no tiene email — captúralo antes (el enlace se ata al correo).",
    };
  }

  let operationId: string;
  try {
    operationId = await beginD5ExternalEffect(
      supabase,
      "portal.whatsapp_link",
      clientId,
    );
  } catch {
    return { ok: false, error: "No se pudo registrar la intención del enlace." };
  }

  // SDD-0253: enlace corto propio, NO el magic-link crudo — el robot de vista
  // previa de WhatsApp quemaba el token antes que el cliente.
  const issued = await createAccessLink(supabase, clientId);
  if (!issued.ok) {
    await finishD5ExternalEffect(supabase, operationId, {
      ok: false,
      errorCode: "access_link_failed",
    }).catch(() => undefined);
    return { ok: false, error: issued.error };
  }
  const link = issued.url;
  try {
    await finishD5ExternalEffect(supabase, operationId, { ok: true });
  } catch {
    return { ok: false, error: "El enlace se generó, pero falta reconciliarlo." };
  }

  // Contador anti-spam del canal WhatsApp (best-effort).
  await supabase.rpc("portal_bump_invite_count", {
    p_client_id: clientId,
    p_channel: "whatsapp",
  });

  const { data: c } = await supabase
    .from("clients")
    .select("name, phone")
    .eq("id", clientId)
    .maybeSingle<{ name: string | null; phone: string | null }>();

  // NO revalidamos: refrescar sacaría al cliente de "Sin invitar" y desmontaría la
  // fila antes de que el equipo abra el WhatsApp con el enlace. El conteo se pone al
  // día en la próxima carga.
  return {
    ok: true,
    link,
    whatsappRaw: toWhatsAppRaw(c?.phone ?? null),
    name: c?.name ?? null,
  };
}

/** Tope del lote de enlaces WhatsApp: cada uno pega a Auth (generateLink), más chico. */
const WA_BATCH_MAX = 10;

export type WhatsAppBatchItem = {
  clientId: string;
  name: string | null;
  whatsappRaw: string | null;
  link: string;
};

export type WhatsAppBatchState = {
  ok?: boolean;
  error?: string;
  items?: WhatsAppBatchItem[];
  /** seleccionados sin teléfono o sin correo (no se pudo preparar). */
  skipped?: number;
  /** seleccionados que no entraron por el tope del lote. */
  remaining?: number;
};

/**
 * Prepara enlaces de WhatsApp para VARIOS clientes de una (adopción · lista WA).
 * Provisiona + genera el magic-link de cada uno y devuelve la lista para que el
 * equipo la copie o abra chat por chat (WhatsApp no se puede automatizar en lote).
 * Solo clientes con teléfono (para poder abrir wa.me a su número) y correo (el
 * enlace se ata al correo). Cuenta cada uno en el contador WA (anti-spam). Tope
 * chico (cada uno genera un link contra Auth). Los enlaces vencen pronto → mandar ya.
 */
export async function bulkWhatsAppInviteAction(
  _prev: WhatsAppBatchState,
  formData: FormData,
): Promise<WhatsAppBatchState> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, "clients");
  if (denial) return { error: denial };

  const raw = String(formData.get("client_ids") ?? "").trim();
  const ids = raw
    ? [...new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))]
    : [];
  if (ids.length === 0) return { error: "No seleccionaste ningún cliente." };

  const batch = ids.slice(0, WA_BATCH_MAX);
  const remaining = ids.length - batch.length;

  const items: WhatsAppBatchItem[] = [];
  let skipped = 0;

  for (const clientId of batch) {
    // Necesitamos teléfono para wa.me; si no hay, no tiene sentido prepararlo.
    const { data: c } = await supabase
      .from("clients")
      .select("name, phone")
      .eq("id", clientId)
      .maybeSingle<{ name: string | null; phone: string | null }>();
    const whatsappRaw = toWhatsAppRaw(c?.phone ?? null);
    if (!whatsappRaw) {
      skipped++;
      continue;
    }

    const { data, error } = await supabase.rpc("portal_invite_client", {
      p_client_id: clientId,
    });
    if (error) {
      skipped++;
      continue;
    }
    const row = (Array.isArray(data) ? data[0] : data) as
      | { client_email?: string }
      | null;
    const email = row?.client_email ?? null;
    if (!email) {
      skipped++;
      continue;
    }

    let operationId: string;
    try {
      operationId = await beginD5ExternalEffect(
        supabase,
        "portal.bulk_whatsapp_link",
        clientId,
      );
    } catch {
      skipped++;
      continue;
    }

    // SDD-0253: enlace corto propio (ver el 1×1 de arriba).
    const issued = await createAccessLink(supabase, clientId);
    if (!issued.ok) {
      await finishD5ExternalEffect(supabase, operationId, {
        ok: false,
        errorCode: "access_link_failed",
      }).catch(() => undefined);
      skipped++;
      continue;
    }
    const link = issued.url;
    try {
      await finishD5ExternalEffect(supabase, operationId, { ok: true });
    } catch {
      skipped++;
      continue;
    }

    await supabase.rpc("portal_bump_invite_count", {
      p_client_id: clientId,
      p_channel: "whatsapp",
    });

    items.push({ clientId, name: c?.name ?? null, whatsappRaw, link });
  }

  // No revalidamos (igual que el 1×1): la lista de enlaces debe sobrevivir en pantalla.
  return { ok: true, items, skipped, remaining };
}

export async function bulkInvitePortalAction(
  _prev: BulkInviteState,
  formData: FormData,
): Promise<BulkInviteState> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, "clients");
  if (denial) return { error: denial };

  const raw = String(formData.get("client_ids") ?? "").trim();
  const ids = raw
    ? [...new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))]
    : [];
  if (ids.length === 0) return { error: "No seleccionaste ningún cliente." };

  const batch = ids.slice(0, MAX_PER_BATCH);
  const remaining = ids.length - batch.length;

  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  const tenantId = link?.tenant_id ?? null;
  if (!tenantId) return { error: "No se pudo resolver el tenant." };

  const admin = createAdminClient();

  let invited = 0;
  let emailFailed = 0;
  let failed = 0;
  const reasons: string[] = [];

  for (const clientId of batch) {
    const { data, error } = await supabase.rpc("portal_invite_client", {
      p_client_id: clientId,
    });
    if (error) {
      failed++;
      reasons.push(
        error.message.includes("no tiene email") ? "sin email" : "no se pudo habilitar",
      );
      continue;
    }
    const row = (Array.isArray(data) ? data[0] : data) as
      | { client_email?: string }
      | null;
    const email = row?.client_email ?? null;
    if (!email) {
      emailFailed++;
      reasons.push("acceso creado, sin correo");
      continue;
    }
    const { data: c } = await supabase
      .from("clients")
      .select("name")
      .eq("id", clientId)
      .maybeSingle<{ name: string }>();
    let operationId: string;
    try {
      operationId = await beginD5ExternalEffect(
        supabase,
        "portal.email_invite",
        clientId,
      );
    } catch {
      failed++;
      reasons.push("auditoría no disponible");
      continue;
    }

    const sent = await sendPortalInviteEmail(admin, tenantId, {
      email,
      name: c?.name ?? null,
    });
    if (sent.ok) {
      try {
        await finishD5ExternalEffect(supabase, operationId, { ok: true });
      } catch {
        emailFailed++;
        reasons.push("correo enviado, reconciliación pendiente");
        continue;
      }
      invited++;
      // Contador anti-spam (best-effort: {error} se ignora, no tira).
      await supabase.rpc("portal_bump_invite_count", {
        p_client_id: clientId,
        p_channel: "email",
      });
    } else {
      await finishD5ExternalEffect(supabase, operationId, {
        ok: false,
        errorCode: "email_send_failed",
      }).catch(() => undefined);
      emailFailed++;
      reasons.push("correo no salió");
    }
  }

  revalidatePath("/studio/admin");
  return {
    ok: true,
    invited,
    emailFailed,
    failed,
    remaining,
    details: reasons.length
      ? [...new Set(reasons)].slice(0, 5).join(" · ")
      : undefined,
  };
}

/**
 * Reenvía la invitación (enlace mágico fresco) a clientes que YA tienen acceso al
 * portal pero NUNCA abrieron su enlace (seguimiento de fríos · adopción). No
 * re-provisiona: ya tienen `client_users` — solo dispara `sendPortalInviteEmail`,
 * que genera un enlace de un clic nuevo (el anterior venció). Re-verifica en el
 * servidor que sigan sin vincular (`status = 'invited'`) para no reenviarle a quien
 * ya entró entre el render y el submit. Mismo tope por tanda que la invitación.
 */
export async function bulkResendPortalInviteAction(
  _prev: BulkInviteState,
  formData: FormData,
): Promise<BulkInviteState> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, "clients");
  if (denial) return { error: denial };

  const raw = String(formData.get("client_ids") ?? "").trim();
  const ids = raw
    ? [...new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))]
    : [];
  if (ids.length === 0) return { error: "No seleccionaste ningún cliente." };

  const batch = ids.slice(0, MAX_PER_BATCH);
  const remaining = ids.length - batch.length;

  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  const tenantId = link?.tenant_id ?? null;
  if (!tenantId) return { error: "No se pudo resolver el tenant." };

  // Re-verificar que sigan sin vincular (status invited): nunca abrieron el enlace.
  const { data: coldRows } = await supabase
    .from("client_users")
    .select("client_id, email")
    .in("client_id", batch)
    .eq("status", "invited");
  const cold =
    (coldRows as { client_id: string; email: string | null }[] | null) ?? [];

  // Nombres para el saludo del correo.
  const { data: cli } = await supabase
    .from("clients")
    .select("id, name")
    .in("id", batch);
  const nameById = new Map(
    ((cli as { id: string; name: string | null }[] | null) ?? []).map((c) => [
      String(c.id),
      c.name,
    ]),
  );

  const admin = createAdminClient();

  let invited = 0;
  let emailFailed = 0;
  const reasons: string[] = [];

  for (const row of cold) {
    const email = (row.email ?? "").trim();
    if (!email) {
      emailFailed++;
      reasons.push("sin correo");
      continue;
    }
    let operationId: string;
    try {
      operationId = await beginD5ExternalEffect(
        supabase,
        "portal.email_resend",
        row.client_id,
      );
    } catch {
      emailFailed++;
      reasons.push("auditoría no disponible");
      continue;
    }

    const sent = await sendPortalInviteEmail(admin, tenantId, {
      email,
      name: nameById.get(String(row.client_id)) ?? null,
    });
    if (sent.ok) {
      try {
        await finishD5ExternalEffect(supabase, operationId, { ok: true });
      } catch {
        emailFailed++;
        reasons.push("correo enviado, reconciliación pendiente");
        continue;
      }
      invited++;
      await supabase.rpc("portal_bump_invite_count", {
        p_client_id: row.client_id,
        p_channel: "email",
      });
    } else {
      await finishD5ExternalEffect(supabase, operationId, {
        ok: false,
        errorCode: "email_send_failed",
      }).catch(() => undefined);
      emailFailed++;
      reasons.push("correo no salió");
    }
  }

  // Del batch, los que ya no estaban fríos (vincularon o perdieron acceso).
  const skipped = batch.length - cold.length;
  if (skipped > 0) reasons.push(`${skipped} ya entraron o sin acceso`);

  revalidatePath("/studio/admin");
  return {
    ok: true,
    invited,
    emailFailed,
    failed: 0,
    remaining,
    details: reasons.length
      ? [...new Set(reasons)].slice(0, 5).join(" · ")
      : undefined,
  };
}
