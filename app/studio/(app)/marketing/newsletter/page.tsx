import { createClient } from "@/lib/db/server";
import { requireModuleView } from "@/lib/studio/rbac-guard";
import type { NewsletterCampaign, NewsletterCampaignStatus } from "@/lib/studio/newsletter/types";
import { Badge, type BadgeTone } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { CampaignComposer } from "./_components/CampaignComposer";
import { CampaignActions } from "./_components/CampaignActions";

export const metadata = { title: "Campañas de Actualidad · DTD Studio" };
export const dynamic = "force-dynamic";

const STATUS: Record<NewsletterCampaignStatus, { label: string; tone: BadgeTone }> = {
  draft: { label: "Borrador", tone: "neutral" },
  pending_approval: { label: "Por aprobar", tone: "warning" },
  approved: { label: "Aprobada", tone: "info" },
  sending: { label: "Enviando", tone: "wine" },
  sent: { label: "Enviada", tone: "success" },
  partial: { label: "Parcial", tone: "warning" },
  failed: { label: "Falló", tone: "danger" },
  cancelled: { label: "Cancelada", tone: "neutral" },
};

export default async function NewsletterCampaignsPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const role = await requireModuleView("marketing");
  const supabase = await createClient();
  const { data: tenant } = await supabase.from("user_tenants").select("tenant_id").is("disabled_at", null).limit(1).maybeSingle<{ tenant_id: string }>();
  if (!tenant?.tenant_id) return <EmptyState eyebrow="Sin tenant" title="No encontramos un espacio de trabajo activo" />;

  const { data, error } = await supabase.rpc("newsletter_list_campaigns", { p_tenant_id: tenant.tenant_id });
  const campaigns = (data ?? []) as NewsletterCampaign[];
  const params = await searchParams;
  const editable = campaigns.find((campaign) => campaign.id === params.edit && campaign.status === "draft") ?? null;

  return (
    <div style={{ maxWidth: 1280 }}>
      <header style={{ marginBottom: "var(--s-7)" }}>
        <div className="studio-eyebrow" style={{ color: "var(--wine-text)", marginBottom: "var(--s-2)" }}>Marketing · Actualidad</div>
        <h1 className="studio-display" style={{ margin: "0 0 var(--s-2)", fontSize: 30, color: "var(--ink)" }}>Campañas por email</h1>
        <p style={{ margin: 0, maxWidth: "68ch", color: "var(--ink-soft)", font: "500 14px/1.5 var(--f-sans)" }}>
          Redacta, revisa y aprueba cada envío. Publicar una noticia nunca dispara una campaña automáticamente.
        </p>
      </header>

      {error ? (
        <EmptyState eyebrow="Configuración pendiente" title="El módulo está listo, pero falta la migración 0260" description="La base de datos aún no tiene las tablas privadas de campañas. No se aplicó ninguna migración desde esta pantalla." />
      ) : (
        <>
          <CampaignComposer campaign={editable} />
          <section>
            <div className="studio-eyebrow" style={{ marginBottom: "var(--s-3)" }}>Historial y aprobaciones</div>
            {campaigns.length === 0 ? (
              <EmptyState title="Todavía no hay campañas" description="Crea el primer borrador y envíalo a revisión cuando esté listo." />
            ) : (
              <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", overflow: "hidden" }}>
                {campaigns.map((campaign) => {
                  const meta = STATUS[campaign.status];
                  return (
                    <article key={campaign.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "var(--s-4)", padding: "var(--s-4) var(--s-5)", borderBottom: "1px solid var(--border)" }}>
                      <div style={{ minWidth: "min(100%, 280px)", flex: "1 1 360px" }}>
                        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "var(--s-2)", marginBottom: "var(--s-1)" }}>
                          <p style={{ margin: 0, color: "var(--ink)", font: "700 15px/1.3 var(--f-sans)" }}>{campaign.internal_name}</p>
                          <Badge tone={meta.tone} size="sm">{meta.label}</Badge>
                        </div>
                        <p style={{ margin: 0, color: "var(--ink-soft)", font: "500 12px/1.45 var(--f-sans)" }}>{campaign.subject}</p>
                        <CampaignActions id={campaign.id} status={campaign.status} isAdmin={role === "admin"} />
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(68px, 1fr))", gap: "var(--s-4)", minWidth: 240 }}>
                        <Metric label="Audiencia" value={campaign.recipient_count} />
                        <Metric label="Enviados" value={campaign.sent_count} />
                        <Metric label="Fallos" value={campaign.failed_count} />
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div><div style={{ color: "var(--ink)", font: "800 16px/1 var(--f-display)" }}>{value}</div><div style={{ marginTop: 4, color: "var(--ink-mute)", font: "600 10px/1.2 var(--f-sans)" }}>{label}</div></div>;
}
