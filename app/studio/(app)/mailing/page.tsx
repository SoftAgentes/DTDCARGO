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
import { createAdminClient } from "@/lib/db/admin";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import {
  listRules,
  listScheduled,
  listTemplates,
  listTenantSignatures,
} from "@/lib/studio/mail-queries";
import { listMembers } from "@/lib/studio/user-queries";
import { roleLabel, userDisplayName, userInitials } from "@/lib/studio/user-types";
import type { MailScheduled, MailSignature } from "@/lib/studio/mail-types";
import { MailingClient } from "./_components/MailingClient";
import type {
  MailBlacklistRow,
  MailConfigRow,
  MailingAdminTab,
  MailLogRow,
  MailLogStatus,
  SignatureTeamMember,
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

const VALID_TABS: MailingAdminTab[] = [
  "templates",
  "signatures",
  "compose",
  "scheduled",
  "reglas",
  "config",
  "logs",
];

/** Subtítulo del header por tab (portado del Norte erp/modules/mailing.jsx). */
const TAB_SUBTITLE: Record<MailingAdminTab, string> = {
  templates:
    "Plantillas de email y WhatsApp · variables dinámicas · multi-idioma · test send.",
  signatures:
    "Cada empleado configura su firma con los layouts oficiales del Brand Book DTD.",
  compose: "Envío individual con plantilla + firma.",
  scheduled:
    "Correos programados en cola. Se envían en su fecha/hora; puedes adelantarlos o cancelarlos.",
  reglas:
    "Eventos del ERP que disparan correos automáticos. Destinatario cliente vs. interno.",
  config: "Proveedor de envío, límites y lista negra (blacklist).",
  logs: "Histórico de envíos. Estado de entrega, aperturas y rebotes.",
};

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
  const tab: MailingAdminTab = (VALID_TABS as string[]).includes(tabRaw ?? "")
    ? (tabRaw as MailingAdminTab)
    : "templates";

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
  const [templatesFull, rules, config, blacklistResp, scheduled] =
    await Promise.all([
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
    tab === "config"
      ? supabase
          .from("mail_blacklist")
          .select("id, email, reason, notes, added_by, added_at")
          .order("added_at", { ascending: false })
          .limit(200)
      : Promise.resolve({ data: [] }),
    tab === "scheduled"
      ? listScheduled(supabase)
      : Promise.resolve([] as MailScheduled[]),
  ]);

  const templates = templatesFull.map((t) => ({ slug: t.slug, name: t.name }));
  const blacklist =
    (blacklistResp?.data ?? []) as unknown as MailBlacklistRow[];

  // ── Firmas · solo cuando el tab lo necesita ──────────────────
  // La vista Firmas lista/edita la firma de TODO el equipo. Los miembros
  // (nombre/cargo/email) se resuelven con admin client igual que en Usuarios
  // (la RLS de user_tenants tapa a los no-admin más allá de su propia fila).
  let signatures: MailSignature[] = [];
  let members: SignatureTeamMember[] = [];
  if (tab === "signatures") {
    const supabaseAdminForMembers = (() => {
      try {
        return createAdminClient();
      } catch {
        return null;
      }
    })();

    const [sigs, membersRaw] = await Promise.all([
      listTenantSignatures(supabase),
      listMembers(supabaseAdminForMembers ?? supabase, {
        tenantId: link.tenant_id,
      }),
    ]);
    signatures = sigs;

    // Resolver emails de auth.users (listMembers los deja como '').
    const emailMap = new Map<string, string>();
    if (supabaseAdminForMembers) {
      try {
        const { data: authUsers } =
          await supabaseAdminForMembers.auth.admin.listUsers({ perPage: 200 });
        for (const u of authUsers?.users ?? []) {
          if (u.email) emailMap.set(u.id, u.email);
        }
      } catch {
        /* sin admin no hay emails · se cae a '—' */
      }
    }

    members = membersRaw.map((m) => {
      const email = emailMap.get(m.user_id) ?? "";
      return {
        userId: m.user_id,
        name: userDisplayName(m.profile, email || m.user_id),
        roleLabel: roleLabel(m.role),
        positionLabel: m.profile?.position_label ?? null,
        email,
        initials: userInitials(m.profile, email || m.user_id),
        avatarUrl: m.profile?.avatar_url ?? null,
      };
    });
  }

  // ── Firmas para el Envío manual · solo cuando el tab es compose ──────
  // Cargamos aparte de `signatures` (que solo se llena en tab signatures)
  // para no acoplar los dos tabs. El Compose las usa para el bloque "firma
  // adjunta" (select por miembro + preview).
  let composeSignatures: MailSignature[] = [];
  if (tab === "compose") {
    composeSignatures = await listTenantSignatures(supabase);
  }

  return (
    <div style={{ maxWidth: 1480 }}>
      <div style={{ marginBottom: 24 }}>
        <span className="studio-eyebrow">Sistema · Comunicaciones</span>
        <h1
          className="studio-display"
          style={{ fontSize: 30, margin: "8px 0 8px", color: "var(--ink)" }}
        >
          Mailing &amp; Notificaciones
        </h1>
        <p
          style={{
            font: "400 13px/1.4 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
            maxWidth: "76ch",
          }}
        >
          {TAB_SUBTITLE[tab]}
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
        signatures={signatures}
        composeSignatures={composeSignatures}
        members={members}
        scheduled={scheduled}
        filters={{ status, template: templateSlug ?? "all", search: search ?? "" }}
      />
    </div>
  );
}
