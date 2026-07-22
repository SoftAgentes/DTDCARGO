import { describe, expect, it } from "vitest";
import { NEWSLETTER_HONEYPOT_FIELD } from "../constants";
import {
  buildNewsletterSubscriberUpsert,
  validateNewsletterSubscribePayload,
} from "../subscription";

describe("newsletter subscription validation", () => {
  it("normaliza email y source válido", () => {
    expect(
      validateNewsletterSubscribePayload({
        email: "  Cliente@DTDcargo.COM ",
        consent: true,
        source: "noticias-articulo",
      }),
    ).toEqual({
      ok: true,
      input: {
        email: "cliente@dtdcargo.com",
        consent: true,
        source: "noticias-articulo",
      },
    });
  });

  it("usa noticias como source seguro si llega un valor desconocido", () => {
    expect(
      validateNewsletterSubscribePayload({
        email: "cliente@dtdcargo.com",
        consent: true,
        source: "externo",
      }),
    ).toEqual({
      ok: true,
      input: {
        email: "cliente@dtdcargo.com",
        consent: true,
        source: "noticias",
      },
    });
  });

  it("rechaza email inválido y consentimiento faltante", () => {
    expect(
      validateNewsletterSubscribePayload({ email: "mal", consent: true }),
    ).toEqual({ ok: false, reason: "email" });

    expect(
      validateNewsletterSubscribePayload({ email: "cliente@dtdcargo.com" }),
    ).toEqual({ ok: false, reason: "consent" });
  });

  it("detecta honeypot sin revelar el motivo al endpoint", () => {
    expect(
      validateNewsletterSubscribePayload({
        email: "cliente@dtdcargo.com",
        consent: true,
        [NEWSLETTER_HONEYPOT_FIELD]: "bot",
      }),
    ).toEqual({ ok: false, reason: "honeypot" });
  });

  it("limpia fecha y motivo de baja al resuscribir", () => {
    expect(buildNewsletterSubscriberUpsert({
      tenantId: "tenant-1",
      email: "cliente@dtdcargo.com",
      source: "noticias",
      consentAt: "2026-07-22T21:30:00.000Z",
      consentIpHash: "hash-ip",
      userAgent: "Vitest",
    })).toMatchObject({
      tenant_id: "tenant-1",
      email: "cliente@dtdcargo.com",
      status: "subscribed",
      unsubscribed_at: null,
      unsubscribe_reason: null,
      consent_at: "2026-07-22T21:30:00.000Z",
      updated_at: "2026-07-22T21:30:00.000Z",
    });
  });
});
