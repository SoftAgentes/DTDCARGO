"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { getStudioAccess, moduleEditDenial } from "@/lib/studio/rbac-guard";
import { sendNewsletterCampaignBatch, sendNewsletterTest } from "@/lib/studio/newsletter/sender";
import type { NewsletterActionResult, NewsletterCampaign, NewsletterCampaignInput } from "@/lib/studio/newsletter/types";
import { newsletterContentHash, validateNewsletterCampaignInput } from "@/lib/studio/newsletter/validation";

const PATH = "/studio/marketing/newsletter";

async function context(requireAdmin = false) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Tu sesión venció. Vuelve a iniciar sesión." } as const;
  const denial = await moduleEditDenial(supabase, "marketing");
  if (denial) return { error: denial } as const;
  const { role } = await getStudioAccess(supabase);
  if (requireAdmin && role !== "admin") {
    return { error: "Solo un administrador puede aprobar o enviar campañas." } as const;
  }
  const { data: tenant } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .is("disabled_at", null)
    .limit(1)
    .maybeSingle<{ tenant_id: string }>();
  if (!tenant?.tenant_id) return { error: "Tu usuario no tiene un tenant activo." } as const;
  return { supabase, tenantId: tenant.tenant_id, userId: auth.user.id, role } as const;
}

export async function saveNewsletterCampaign(input: NewsletterCampaignInput): Promise<NewsletterActionResult> {
  const ctx = await context();
  if ("error" in ctx) return { error: ctx.error };
  const validation = validateNewsletterCampaignInput(input);
  if (!validation.ok) return { error: validation.error };
  const value = validation.value;
  const hash = newsletterContentHash(value);
  const admin = createAdminClient();
  const row = {
    internal_name: value.internalName,
    subject: value.subject,
    preview_text: value.previewText,
    heading: value.heading,
    body_text: value.bodyText,
    cta_label: value.ctaLabel || null,
    cta_url: value.ctaUrl || null,
    content_hash: hash,
  };

  if (value.id) {
    const { data, error } = await admin
      .from("newsletter_campaigns")
      .update(row)
      .eq("id", value.id)
      .eq("tenant_id", ctx.tenantId)
      .eq("status", "draft")
      .select("id")
      .maybeSingle<{ id: string }>();
    if (error) return { error: error.message };
    if (!data) return { error: "Solo puedes editar campañas en borrador." };
    revalidatePath(PATH);
    return { ok: true, campaignId: data.id, message: "Borrador actualizado." };
  }

  const { data, error } = await admin
    .from("newsletter_campaigns")
    .insert({ ...row, tenant_id: ctx.tenantId, created_by: ctx.userId })
    .select("id")
    .single<{ id: string }>();
  if (error || !data) return { error: error?.message ?? "No se pudo crear la campaña." };
  revalidatePath(PATH);
  return { ok: true, campaignId: data.id, message: "Borrador guardado." };
}

export async function submitNewsletterCampaign(campaignId: string): Promise<NewsletterActionResult> {
  const ctx = await context();
  if ("error" in ctx) return { error: ctx.error };
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("newsletter_campaigns")
    .update({ status: "pending_approval" })
    .eq("id", campaignId)
    .eq("tenant_id", ctx.tenantId)
    .eq("status", "draft")
    .select("id")
    .maybeSingle<{ id: string }>();
  if (error) return { error: error.message };
  if (!data) return { error: "La campaña ya no está en borrador." };
  revalidatePath(PATH);
  return { ok: true, message: "Campaña enviada a aprobación." };
}

export async function approveNewsletterCampaign(campaignId: string): Promise<NewsletterActionResult> {
  const ctx = await context(true);
  if ("error" in ctx) return { error: ctx.error };
  const admin = createAdminClient();
  const { data: campaign, error } = await admin
    .from("newsletter_campaigns")
    .select("*")
    .eq("id", campaignId)
    .eq("tenant_id", ctx.tenantId)
    .eq("status", "pending_approval")
    .maybeSingle<NewsletterCampaign>();
  if (error) return { error: error.message };
  if (!campaign) return { error: "La campaña no está pendiente de aprobación." };

  const [subscribers, blacklist] = await Promise.all([
    fetchAll(admin, "newsletter_subscribers", "id,email", ctx.tenantId, "status", "subscribed"),
    fetchAll(admin, "mail_blacklist", "email", ctx.tenantId),
  ]);
  if (subscribers.error) return { error: subscribers.error };
  if (blacklist.error) return { error: blacklist.error };
  const blocked = new Set(blacklist.rows.map((row) => String(row.email).toLowerCase()));
  const recipients = subscribers.rows.filter((row) => !blocked.has(String(row.email).toLowerCase()));
  if (recipients.length === 0) return { error: "No hay suscriptores activos disponibles para esta campaña." };

  await admin.from("newsletter_campaign_recipients").delete().eq("campaign_id", campaign.id).eq("tenant_id", ctx.tenantId);
  for (let i = 0; i < recipients.length; i += 500) {
    const rows = recipients.slice(i, i + 500).map((row) => ({
      campaign_id: campaign.id,
      tenant_id: ctx.tenantId,
      subscriber_id: row.id,
      email: String(row.email).toLowerCase(),
    }));
    const { error: insertError } = await admin.from("newsletter_campaign_recipients").insert(rows);
    if (insertError) return { error: `No se pudo preparar la audiencia: ${insertError.message}` };
  }

  const now = new Date().toISOString();
  const { error: approveError } = await admin.from("newsletter_campaigns").update({
    status: "approved",
    approved_content_hash: campaign.content_hash,
    approved_by: ctx.userId,
    approved_at: now,
    recipient_count: recipients.length,
    sent_count: 0,
    failed_count: 0,
    skipped_count: 0,
  }).eq("id", campaign.id).eq("tenant_id", ctx.tenantId).eq("status", "pending_approval");
  if (approveError) return { error: approveError.message };
  revalidatePath(PATH);
  return { ok: true, message: `Aprobada para ${recipients.length} suscriptores.` };
}

export async function sendNewsletterCampaign(campaignId: string): Promise<NewsletterActionResult> {
  const ctx = await context(true);
  if ("error" in ctx) return { error: ctx.error };
  const admin = createAdminClient();
  const { data: campaign } = await admin.from("newsletter_campaigns").select("*")
    .eq("id", campaignId).eq("tenant_id", ctx.tenantId)
    .in("status", ["approved", "sending"]).maybeSingle<NewsletterCampaign>();
  if (!campaign) return { error: "La campaña no está aprobada o ya terminó." };
  if (!campaign.approved_content_hash || campaign.approved_content_hash !== campaign.content_hash) {
    return { error: "El contenido cambió después de aprobarse. Debe volver a revisión." };
  }
  if (!campaign.send_requested_at) {
    const { count, error: countError } = await admin
      .from("newsletter_campaigns")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId)
      .neq("id", campaign.id)
      .gte("send_requested_at", monthStartInCaracas());
    if (countError) return { error: `No se pudo verificar la cadencia mensual: ${countError.message}` };
    if ((count ?? 0) >= 2) {
      return { error: "Ya se iniciaron dos campañas este mes. La cadencia aprobada no permite otro envío." };
    }
  }
  await admin.from("newsletter_campaigns").update({
    status: "sending", send_requested_by: ctx.userId,
    send_requested_at: campaign.send_requested_at ?? new Date().toISOString(),
  }).eq("id", campaign.id).eq("tenant_id", ctx.tenantId);
  const result = await sendNewsletterCampaignBatch(admin, ctx.tenantId, campaign, ctx.userId);
  revalidatePath(PATH);
  if (!result.ok) return { error: result.error };
  return {
    ok: true,
    message: result.remaining > 0
      ? `Lote de ${result.sent} enviado. Quedan ${result.remaining}; pulsa Continuar envío.`
      : `Campaña completada: ${result.sent} correos enviados en este lote.`,
  };
}

export async function retryNewsletterCampaign(campaignId: string): Promise<NewsletterActionResult> {
  const ctx = await context(true);
  if ("error" in ctx) return { error: ctx.error };
  const admin = createAdminClient();
  const { data: campaign } = await admin.from("newsletter_campaigns").select("id,content_hash,approved_content_hash,status")
    .eq("id", campaignId).eq("tenant_id", ctx.tenantId)
    .in("status", ["partial", "failed"]).maybeSingle<{ id: string; content_hash: string; approved_content_hash: string | null; status: string }>();
  if (!campaign) return { error: "No hay envíos fallidos para reintentar." };
  if (campaign.content_hash !== campaign.approved_content_hash) return { error: "El contenido cambió y requiere otra aprobación." };
  await admin.from("newsletter_campaign_recipients").update({ status: "pending", dispatch_key: null, error: null })
    .eq("campaign_id", campaignId).eq("tenant_id", ctx.tenantId).eq("status", "failed");
  await admin.from("newsletter_campaigns").update({ status: "approved", completed_at: null }).eq("id", campaignId).eq("tenant_id", ctx.tenantId);
  revalidatePath(PATH);
  return { ok: true, message: "Los fallos quedaron listos para un reintento manual." };
}

export async function sendNewsletterCampaignTest(campaignId: string): Promise<NewsletterActionResult> {
  const ctx = await context();
  if ("error" in ctx) return { error: ctx.error };
  const admin = createAdminClient();
  const { data: campaign } = await admin.from("newsletter_campaigns").select("*")
    .eq("id", campaignId).eq("tenant_id", ctx.tenantId).maybeSingle<NewsletterCampaign>();
  if (!campaign) return { error: "Campaña no encontrada." };
  const result = await sendNewsletterTest(admin, ctx.tenantId, campaign);
  if (!result.ok) return { error: result.error };
  return { ok: true, message: "Prueba enviada al correo interno configurado." };
}

function monthStartInCaracas(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value ?? String(now.getUTCFullYear());
  const month = parts.find((part) => part.type === "month")?.value ?? String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01T04:00:00.000Z`;
}

async function fetchAll(
  admin: ReturnType<typeof createAdminClient>,
  table: string,
  columns: string,
  tenantId: string,
  filterColumn?: string,
  filterValue?: string,
): Promise<{ rows: Record<string, unknown>[]; error?: string }> {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    let query = admin.from(table).select(columns).eq("tenant_id", tenantId).range(from, from + 999);
    if (filterColumn && filterValue) query = query.eq(filterColumn, filterValue);
    const { data, error } = await query;
    if (error) return { rows: [], error: error.message };
    rows.push(...((data ?? []) as unknown as Record<string, unknown>[]));
    if (!data || data.length < 1000) break;
  }
  return { rows };
}
