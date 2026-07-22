import { afterEach, describe, expect, it, vi } from "vitest";
import { renderNewsletterEmail } from "../render-email";
import { newsletterContentHash, validateNewsletterCampaignInput } from "../validation";
import { resendBatchSend } from "../../mail/resend-api";
import { resolveNewsletterSiteUrl } from "../sender";

const VALID = {
  internalName: "Actualidad julio",
  subject: "Cambios que afectan tu importación",
  previewText: "Tres datos para planificar tu próxima carga.",
  heading: "Lo que cambió esta semana",
  bodyText: "Reunimos los datos más importantes para que tomes una decisión con información clara.",
  ctaLabel: "Leer la guía",
  ctaUrl: "https://dtdcargo.com/noticias/guia",
};

describe("campañas del newsletter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.RESEND_API_KEY;
  });

  it("valida contenido y exige que el CTA esté completo", () => {
    expect(validateNewsletterCampaignInput(VALID).ok).toBe(true);
    expect(validateNewsletterCampaignInput({ ...VALID, ctaUrl: "" })).toEqual({
      ok: false,
      error: "El botón necesita texto y enlace, o ambos campos vacíos.",
    });
    expect(validateNewsletterCampaignInput({ ...VALID, ctaUrl: "http://dtdcargo.com" }).ok).toBe(false);
  });

  it("genera un hash estable y cambia cuando cambia el contenido", () => {
    expect(newsletterContentHash(VALID)).toBe(newsletterContentHash({ ...VALID }));
    expect(newsletterContentHash(VALID)).not.toBe(newsletterContentHash({ ...VALID, subject: "Otro asunto" }));
  });

  it("mantiene el enlace de baja en el deployment de Preview", () => {
    expect(resolveNewsletterSiteUrl({
      VERCEL_ENV: "preview",
      VERCEL_URL: "dtdcargo-preview.vercel.app",
      NEXT_PUBLIC_SITE_URL: "https://dtdcargo.com",
    })).toBe("https://dtdcargo-preview.vercel.app");
  });

  it("usa la URL canónica fuera de Preview", () => {
    expect(resolveNewsletterSiteUrl({
      VERCEL_ENV: "production",
      VERCEL_URL: "dtdcargo-production.vercel.app",
      NEXT_PUBLIC_SITE_URL: "https://dtdcargo.com/",
    })).toBe("https://dtdcargo.com");
  });

  it("escapa HTML, incluye versión texto y enlace de baja", () => {
    const rendered = renderNewsletterEmail(
      { ...VALID, heading: "Importa <sin sorpresas>" },
      "https://dtdcargo.com/api/email/unsubscribe/v2.abc.def.ghi",
    );
    expect(rendered.html).toContain("Importa &lt;sin sorpresas&gt;");
    expect(rendered.html).not.toContain("Importa <sin sorpresas>");
    expect(rendered.html).toContain("Darte de baja");
    expect(rendered.text).toContain("https://dtdcargo.com/api/email/unsubscribe/v2.abc.def.ghi");
  });

  it("rechaza lotes mayores de 100 sin llamar a Resend", async () => {
    process.env.RESEND_API_KEY = "re_test";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const messages = Array.from({ length: 101 }, (_, index) => ({
      from: "DTD Cargo <actualidad@dtdcargo.com>",
      to: `persona${index}@example.com`,
      subject: "Prueba",
      html: "<p>Prueba</p>",
    }));
    await expect(resendBatchSend(messages, "campaign/test")).resolves.toEqual({
      ok: false,
      error: "El lote debe contener entre 1 y 100 correos.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("envía un lote con Idempotency-Key", async () => {
    process.env.RESEND_API_KEY = "re_test";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ id: "email_1" }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await resendBatchSend([{ from: "DTD Cargo <actualidad@dtdcargo.com>", to: "persona@example.com", subject: "Prueba", html: "<p>Prueba</p>" }], "campaign/dispatch");
    expect(result).toEqual({ ok: true, ids: ["email_1"] });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.resend.com/emails/batch",
      expect.objectContaining({ headers: expect.objectContaining({ "Idempotency-Key": "campaign/dispatch" }) }),
    );
  });
});
