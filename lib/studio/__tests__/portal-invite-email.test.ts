/**
 * Tests de portal-invite-email (SDD-0042): al habilitar el portal de un cliente,
 * se le envía un correo con el enlace a `/portal/login` con su email precargado.
 * Ahí el cliente pide su propio magic-link (la invitación no caduca).
 *
 * `sendEmail` se mockea — sin red ni DB. Verificamos el contrato de delegación.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const sendEmailMock = vi.fn();
vi.mock("@/lib/studio/mail/send-email", () => ({
  sendEmail: (...args: unknown[]) => sendEmailMock(...args),
}));

import { sendPortalInviteEmail, portalInviteUrl } from "../portal-invite-email";

const fakeAdmin = {} as never;

beforeEach(() => {
  sendEmailMock.mockReset();
});

describe("portalInviteUrl", () => {
  it("apunta a /portal/login con el email precargado y normalizado", () => {
    const link = portalInviteUrl("  Ecotextil2015@Gmail.com ");
    expect(link).toContain("/portal/login?email=");
    // el email va lower-case + url-encoded (@ → %40)
    expect(link).toContain("ecotextil2015%40gmail.com");
    expect(link).not.toContain("portal.dtdcargo.com");
  });
});

describe("sendPortalInviteEmail", () => {
  it("delega en sendEmail con subject+html inline (sin template) y el link precargado", async () => {
    sendEmailMock.mockResolvedValue({
      ok: true,
      logId: "log-1",
      resendId: "re-1",
      queued: false,
    });

    const res = await sendPortalInviteEmail(fakeAdmin, "tenant-1", {
      email: "carlos@empresa.com",
      name: "Carlos Pérez",
    });

    expect(res).toEqual({ ok: true, log_id: "log-1" });
    expect(sendEmailMock).toHaveBeenCalledTimes(1);

    const [, tenantId, input] = sendEmailMock.mock.calls[0] as [
      unknown,
      string,
      {
        subject?: string;
        html?: string;
        templateSlug?: string;
        to?: string;
        metadata?: Record<string, unknown>;
      },
    ];
    expect(tenantId).toBe("tenant-1");
    expect(input.templateSlug).toBeUndefined();
    expect(input.subject).toContain("portal");
    expect(input.to).toBe("carlos@empresa.com");
    // el CTA del html apunta al login con el email precargado
    expect(input.html).toContain("/portal/login?email=carlos%40empresa.com");
    // el saludo usa el nombre del cliente
    expect(input.html).toContain("Carlos Pérez");
    expect(input.metadata?.source).toBe("portal_invite");
  });

  it("escapa el nombre del cliente en el saludo (no inyecta HTML)", async () => {
    sendEmailMock.mockResolvedValue({ ok: true, logId: "l", resendId: null, queued: false });
    await sendPortalInviteEmail(fakeAdmin, "t", {
      email: "x@y.com",
      name: "<script>oops</script>",
    });
    const [, , input] = sendEmailMock.mock.calls[0] as [unknown, string, { html?: string }];
    expect(input.html).not.toContain("<script>oops</script>");
    expect(input.html).toContain("&lt;script&gt;");
  });

  it("sin nombre → saludo genérico, igual envía", async () => {
    sendEmailMock.mockResolvedValue({ ok: true, logId: "l", resendId: null, queued: false });
    const res = await sendPortalInviteEmail(fakeAdmin, "t", { email: "x@y.com" });
    expect(res.ok).toBe(true);
    const [, , input] = sendEmailMock.mock.calls[0] as [unknown, string, { html?: string }];
    expect(input.html).toContain("Hola,");
  });

  it("propaga el error cuando sendEmail falla", async () => {
    sendEmailMock.mockResolvedValue({ ok: false, error: "destinatario en blacklist" });
    const res = await sendPortalInviteEmail(fakeAdmin, "t", { email: "x@y.com" });
    expect(res).toEqual({ ok: false, error: "destinatario en blacklist" });
  });

  it("email vacío → no invoca sendEmail", async () => {
    const res = await sendPortalInviteEmail(fakeAdmin, "t", { email: "   " });
    expect(res.ok).toBe(false);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});
