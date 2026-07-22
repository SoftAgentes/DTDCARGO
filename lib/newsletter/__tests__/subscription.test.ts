import { describe, expect, it } from "vitest";
import { NEWSLETTER_HONEYPOT_FIELD } from "../constants";
import { validateNewsletterSubscribePayload } from "../subscription";

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
});
