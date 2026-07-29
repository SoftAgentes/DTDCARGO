import type { NewsletterCampaignInput } from "./types";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function paragraphs(value: string): string {
  return value
    .split(/\n\s*\n/)
    .map((part) => `<p style="margin:0 0 18px;font-size:16px;line-height:1.65;color:#283653">${escapeHtml(part).replaceAll("\n", "<br>")}</p>`)
    .join("");
}

export function renderNewsletterEmail(
  input: NewsletterCampaignInput,
  unsubscribeUrl: string,
): { html: string; text: string } {
  const cta = input.ctaLabel && input.ctaUrl
    ? `<p style="margin:28px 0"><a href="${escapeHtml(input.ctaUrl)}" style="display:inline-block;background:#8F1019;color:#ffffff;text-decoration:none;font-weight:700;padding:13px 20px;border-radius:8px">${escapeHtml(input.ctaLabel)}</a></p>`
    : "";
  const preheader = input.previewText
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(input.previewText)}</div>`
    : "";
  const safeUnsubscribe = escapeHtml(unsubscribeUrl);

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(input.subject)}</title></head>
<body style="margin:0;background:#F6F3EE;font-family:Archivo,Arial,sans-serif;color:#0F1E3D">${preheader}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F6F3EE"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #E3DED5;border-radius:12px;overflow:hidden">
<tr><td style="background:#0F1E3D;padding:24px 28px;color:#ffffff"><div style="font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#F0A8AD">DTD Cargo · Actualidad</div></td></tr>
<tr><td style="padding:34px 28px 20px"><h1 style="margin:0 0 20px;font-size:30px;line-height:1.15;color:#0F1E3D">${escapeHtml(input.heading)}</h1>${paragraphs(input.bodyText)}${cta}</td></tr>
<tr><td style="padding:20px 28px 28px;border-top:1px solid #E3DED5;font-size:12px;line-height:1.6;color:#5D677A">Recibes este correo porque te suscribiste a Actualidad de DTD Cargo.<br><a href="${safeUnsubscribe}" style="color:#8F1019">Darte de baja</a> · DTD Cargo, Valencia, Venezuela.</td></tr>
</table></td></tr></table></body></html>`;

  const text = `${input.heading}\n\n${input.bodyText}${input.ctaLabel && input.ctaUrl ? `\n\n${input.ctaLabel}: ${input.ctaUrl}` : ""}\n\nDarte de baja: ${unsubscribeUrl}`;
  return { html, text };
}
