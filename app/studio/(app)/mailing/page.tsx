/**
 * /studio/mailing · Mailing (SDD-0026 Fase 3a — Logs).
 *
 * Server component:
 *  1. Auth + role admin.
 *  2. Parse filters de query params.
 *  3. Fetch mail_logs (limit 200, recent desc).
 *  4. Render MailingClient con tabs Logs / Templates / Reglas.
 *
 * Fase 3a: Logs implementado · Templates y Reglas placeholders.
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { listRules, listTemplates } from "@/lib/studio/mail-queries";
import { MailingClient } from "./_components/MailingClient";
import type {
  MailBlacklistRow,
  MailConfigRow,
  MailingAdminTab,
  MailLogRow,
  MailLogStatus,
} from "./_components/mailing-types";

export const metadata = { title: "Mailing · DTD Studio" };
export const dynamic = "force-dynamic";

type SearchParams = { [key: string]: string | string[] | undefined };

const VALID_STATUSES: MailLogStatus[] = [
  "queued",
  "sent",
  "delivered",
  "bounced",
  "complained",
  "opened",
  "clicked",
  "failed",
];

export default async function MailingAdminPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) redirect("/studio/login");

  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id, role")
    .maybeSingle<{ tenant_id: string; role: string }>();

  if (!link?.tenant_id) {
    return (
      <EmptyState
        eyebrow="Sin tenant"
        title="Tu cuenta no está vinculada a ningún tenant"
        description="Pediles a un admin que te agregue al equipo."
      />
    );
  }
  if (link.role !== "admin") {
    redirect("/studio/dashboard");
  }

  const params = await searchParams;
  const singleParam = (k: string): string | undefined => {
    const v = params[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const tabRaw = singleParam("tab");
  const tab: MailingAdminTab =
    tabRaw === "templates" ||
    tabRaw === "reglas" ||
    tabRaw === "config" ||
    tabRaw === "blacklist"
      ? (tabRaw as MailingAdminTab)
      : "logs";

  const statusRaw = singleParam("status");
  const status: MailLogStatus | "all" =
    statusRaw && (VALID_STATUSES as string[]).includes(statusRaw)
      ? (statusRaw as MailLogStatus)
      : "all";
  const templateSlug = singleParam("template");
  const search = singleParam("q");

  // Query mail_logs con filters
  let query = supabase
    .from("mail_logs")
    .select(
      "id, template_slug, to_email, to_name, subject, status, resend_message_id, " +
        "error, metadata, created_at, sent_at, delivered_at, opened_at, clicked_at, bounced_at",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (status !== "all") query = query.eq("status", status);
  if (templateSlug) query = query.eq("template_slug", templateSlug);
  if (search) {
    const q = search.trim();
    query = query.or(
      `to_email.ilike.%${q}%,subject.ilike.%${q}%,to_name.ilike.%${q}%`,
    );
  }

  const { data: logs, error: logsErr } = await query;
  if (logsErr) {
    console.error("[mailing] mail_logs query failed:", logsErr);
  }

  // Templates + rules + config + blacklist para los tabs correspondientes
  // (siempre cargamos los templates para usar como filter dropdown en tab Logs)
  const [templatesFull, rules, config, blacklistResp] = await Promise.all([
    listTemplates(supabase, { limit: 100 }),
    tab === "reglas" ? listRules(supabase) : Promise.resolve([]),
    tab === "config"
      ? supabase
          .from("mail_config")
          .select(
            "tenant_id, from_email, from_name, reply_to, test_mode, internal_test_email, domain_verified, updated_at",
          )
          .eq("tenant_id", link.tenant_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    tab === "blacklist"
      ? supabase
          .from("mail_blacklist")
          .select("id, email, reason, notes, added_by, added_at")
          .order("added_at", { ascending: false })
          .limit(200)
      : Promise.resolve({ data: [] }),
  ]);

  const templates = templatesFull.map((t) => ({ slug: t.slug, name: t.name }));
  const blacklist =
    (blacklistResp?.data ?? []) as unknown as MailBlacklistRow[];

  return (
    <div style={{ maxWidth: 1480 }}>
      <div style={{ marginBottom: 24 }}>
        <span className="studio-eyebrow">Sistema · Comunicaciones</span>
        <h1
          className="studio-display"
          style={{ fontSize: 30, margin: "8px 0 8px", color: "var(--ink)" }}
        >
          Mailing
        </h1>
        <p
          style={{
            font: "400 13px/1.4 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
            maxWidth: "76ch",
          }}
        >
          Historial de emails enviados desde el Studio (invitaciones, bug
          reporter, futuras campañas). Webhooks de Resend actualizan
          automáticamente el estado de entrega (sent · delivered · opened ·
          bounced).
        </p>
      </div>

      <MailingClient
        tab={tab}
        logs={(logs ?? []) as unknown as MailLogRow[]}
        templates={templates}
        templatesFull={templatesFull}
        rules={rules}
        config={(config?.data ?? null) as unknown as MailConfigRow | null}
        blacklist={blacklist}
        filters={{ status, template: templateSlug ?? "all", search: search ?? "" }}
      />
    </div>
  );
}
