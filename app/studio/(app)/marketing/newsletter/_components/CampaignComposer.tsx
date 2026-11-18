"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { renderNewsletterEmail } from "@/lib/studio/newsletter/render-email";
import type { NewsletterCampaign, NewsletterCampaignInput } from "@/lib/studio/newsletter/types";
import { saveNewsletterCampaign } from "../actions";
import { Aviso } from "@/app/studio/_components/ui/Aviso";

const EMPTY: NewsletterCampaignInput = {
  internalName: "",
  subject: "",
  previewText: "",
  heading: "",
  bodyText: "",
  ctaLabel: "",
  ctaUrl: "",
};

function fromCampaign(campaign?: NewsletterCampaign | null): NewsletterCampaignInput {
  if (!campaign) return EMPTY;
  return {
    id: campaign.id,
    internalName: campaign.internal_name,
    subject: campaign.subject,
    previewText: campaign.preview_text,
    heading: campaign.heading,
    bodyText: campaign.body_text,
    ctaLabel: campaign.cta_label ?? "",
    ctaUrl: campaign.cta_url ?? "",
  };
}

export function CampaignComposer({ campaign }: { campaign?: NewsletterCampaign | null }) {
  const router = useRouter();
  const [form, setForm] = useState(() => fromCampaign(campaign));
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const preview = useMemo(
    () => renderNewsletterEmail(form, "https://dtdcargo.com/baja-de-prueba").html,
    [form],
  );

  function update(field: keyof NewsletterCampaignInput, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function save() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await saveNewsletterCampaign(form);
      if (result.error) return setError(result.error);
      setMessage(result.message ?? "Guardado.");
      if (result.campaignId && !form.id) {
        setForm((current) => ({ ...current, id: result.campaignId }));
        router.replace(`/studio/marketing/newsletter?edit=${result.campaignId}`);
      }
      router.refresh();
    });
  }

  return (
    <section style={{ marginBottom: "var(--s-8)" }}>
      <div style={{ display: "flex", alignItems: "end", justifyContent: "space-between", gap: "var(--s-4)", marginBottom: "var(--s-4)", flexWrap: "wrap" }}>
        <div>
          <div className="studio-eyebrow" style={{ color: "var(--wine-text)", marginBottom: "var(--s-2)" }}>Editor de campaña</div>
          <h2 className="studio-display" style={{ margin: 0, fontSize: 22, color: "var(--ink)" }}>
            {form.id ? "Editar borrador" : "Nueva campaña"}
          </h2>
        </div>
        {form.id && (
          <button type="button" className="studio-btn studio-btn-ghost studio-btn-sm" onClick={() => router.push("/studio/marketing/newsletter")}>Nueva campaña</button>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))", gap: "var(--s-4)", alignItems: "start" }}>
        <div style={cardStyle}>
          <Field label="Nombre interno" hint="Solo lo ve el equipo.">
            <input className="studio-input" value={form.internalName} maxLength={120} onChange={(e) => update("internalName", e.target.value)} />
          </Field>
          <Field label="Asunto">
            <input className="studio-input" value={form.subject} maxLength={150} onChange={(e) => update("subject", e.target.value)} />
          </Field>
          <Field label="Texto de vista previa" hint="Aparece junto al asunto en la bandeja.">
            <input className="studio-input" value={form.previewText} maxLength={180} onChange={(e) => update("previewText", e.target.value)} />
          </Field>
          <Field label="Título principal">
            <input className="studio-input" value={form.heading} maxLength={160} onChange={(e) => update("heading", e.target.value)} />
          </Field>
          <Field label="Contenido" hint="Separa los párrafos con una línea en blanco.">
            <textarea className="studio-input" rows={9} value={form.bodyText} maxLength={12000} onChange={(e) => update("bodyText", e.target.value)} style={{ resize: "vertical", minHeight: 190 }} />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--s-3)" }}>
            <Field label="Texto del botón" hint="Opcional.">
              <input className="studio-input" value={form.ctaLabel} maxLength={50} onChange={(e) => update("ctaLabel", e.target.value)} />
            </Field>
            <Field label="Enlace HTTPS" hint="Opcional.">
              <input className="studio-input" inputMode="url" value={form.ctaUrl} onChange={(e) => update("ctaUrl", e.target.value)} />
            </Field>
          </div>
          {error && <div style={{ marginBottom: "var(--s-3)" }}><Aviso tono="error" compacto>{error}</Aviso></div>}
          {message && <div style={{ marginBottom: "var(--s-3)" }}><Aviso tono="exito" compacto>{message}</Aviso></div>}
          <button type="button" className="studio-btn studio-btn-primary studio-btn-sm" onClick={save} disabled={pending}>
            {pending ? "Guardando…" : "Guardar borrador"}
          </button>
        </div>

        <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "var(--s-3) var(--s-4)", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", gap: "var(--s-3)" }}>
            <span className="studio-label">Vista previa</span>
            <span style={{ font: "500 11px/1.3 var(--f-sans)", color: "var(--ink-mute)" }}>640 px · email</span>
          </div>
          <iframe title="Vista previa del correo" srcDoc={preview} style={{ display: "block", width: "100%", height: 650, border: 0, background: "var(--bg)" }} />
        </div>
      </div>
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: "var(--s-3)" }}>
      <span className="studio-label">{label}</span>
      {children}
      {hint && <span style={{ font: "500 11px/1.35 var(--f-sans)", color: "var(--ink-mute)" }}>{hint}</span>}
    </label>
  );
}

const cardStyle: React.CSSProperties = {
  background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: "var(--s-5)",
};
