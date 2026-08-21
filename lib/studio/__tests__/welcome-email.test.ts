/**
 * Tests de welcome-email (SDD-0059): el correo de bienvenida ahora ENVÍA de
 * verdad delegando en `sendEmail` (Resend), no solo encola; y el link apunta a
 * `/entrar` del sitio, no al subdominio inexistente.
 *
 * `sendEmail` se mockea — sin red ni DB. Verificamos el contrato de delegación.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const sendEmailMock = vi.fn();
vi.mock("@/lib/studio/mail/send-email", () => ({
  sendEmail: (...args: unknown[]) => sendEmailMock(...args),
}));

import { sendWelcomeEmail, portalLoginUrl } from "../welcome-email";

const fakeAdmin = {} as never;

beforeEach(() => {
  sendEmailMock.mockReset();
});

describe("portalLoginUrl", () => {
  it("apunta a /entrar del sitio, NO al subdominio inexistente", () => {
    const link = portalLoginUrl();
    expect(link).toContain("/entrar");
    expect(link).not.toContain("portal.dtdcargo.com");
  });
});

describe("sendWelcomeEmail", () => {
  it("delega en sendEmail con el template welcome_markbox + vars correctas (envío real, no queued)", async () => {
    sendEmailMock.mockResolvedValue({
      ok: true,
      logId: "log-1",
      resendId: "re-1",
      queued: false,
    });

    const res = await sendWelcomeEmail(fakeAdmin, "tenant-1", {
      markbox: "DTD-5452",
      name: "Carlos Pérez",
      email: "carlos@empresa.com",
    });

    expect(res).toEqual({ ok: true, log_id: "log-1", queued: false });
    expect(sendEmailMock).toHaveBeenCalledTimes(1);

    const [, tenantId, input] = sendEmailMock.mock.calls[0] as [
      unknown,
      string,
      {
        templateSlug?: string;
        to?: string;
        vars?: Record<string, string>;
      },
    ];
    expect(tenantId).toBe("tenant-1");
    expect(input.templateSlug).toBe("welcome_markbox");
    expect(input.to).toBe("carlos@empresa.com");
    expect(input.vars?.markbox).toBe("DTD-5452");
    expect(input.vars?.client_name).toBe("Carlos Pérez");
    expect(input.vars?.portal_link).toContain("/entrar");
    expect(input.vars?.portal_link).not.toContain("portal.dtdcargo.com");
  });

  it("propaga queued:true cuando el correo NO salió (Resend sin key)", async () => {
    // El bug que esto cierra: sendEmail devuelve ok:true con queued:true cuando
    // el correo quedó registrado pero nunca se entregó a Resend. Antes esta
    // señal se perdía acá, el alta reportaba éxito y el cliente veía su Shipping
    // Mark en pantalla sin recibirlo nunca por correo. Tres clientes de junio
    // siguen esperándolo.
    sendEmailMock.mockResolvedValue({
      ok: true,
      logId: "log-2",
      resendId: null,
      queued: true,
    });

    const res = await sendWelcomeEmail(fakeAdmin, "t", {
      markbox: "DTD-1",
      name: "X",
      email: "x@y.com",
    });

    expect(res).toEqual({ ok: true, log_id: "log-2", queued: true });
  });

  it("propaga el error cuando sendEmail falla", async () => {
    sendEmailMock.mockResolvedValue({ ok: false, error: "destinatario en blacklist" });
    const res = await sendWelcomeEmail(fakeAdmin, "t", {
      markbox: "DTD-1",
      name: "X",
      email: "x@y.com",
    });
    expect(res).toEqual({ ok: false, error: "destinatario en blacklist" });
  });

  it("email vacío → no invoca sendEmail", async () => {
    const res = await sendWelcomeEmail(fakeAdmin, "t", {
      markbox: "DTD-1",
      name: "X",
      email: "   ",
    });
    expect(res.ok).toBe(false);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});
