/**
 * Tests de portal-invite-email (SDD-0042). El correo de invitación lleva un enlace
 * DIRECTO (un clic → adentro, `generatePortalAccessLink`); si no se puede generar,
 * cae al fallback `/entrar` con el email precargado.
 *
 * `sendEmail` se mockea — sin red ni DB. El admin de Auth se mockea con
 * `makeAdmin` (auth.admin.generateLink/createUser). Verificamos el contrato.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const sendEmailMock = vi.fn();
vi.mock("@/lib/studio/mail/send-email", () => ({
  sendEmail: (...args: unknown[]) => sendEmailMock(...args),
}));

import {
  sendPortalInviteEmail,
  portalInviteUrl,
  generatePortalAccessLink,
} from "../portal-invite-email";

/** fakeAdmin sin `.auth` → generateLink tira → generatePortalAccessLink cae a null
 *  → sendPortalInviteEmail usa el fallback `/entrar`. */
const fakeAdmin = {} as never;

type GenResult = {
  data: { properties: { action_link: string } } | null;
  error: { message: string } | null;
};

/** Mock del admin de Auth: generateLink devuelve `results` en orden; createUser resuelve. */
function makeAdmin(results: GenResult[]) {
  let i = 0;
  const generateLink = vi.fn(async (args: unknown) => {
    void args;
    return results[Math.min(i++, results.length - 1)];
  });
  const createUser = vi.fn(async (args: unknown) => {
    void args;
    return { data: { user: {} }, error: null };
  });
  const admin = { auth: { admin: { generateLink, createUser } } } as unknown as never;
  return { admin, generateLink, createUser };
}

beforeEach(() => {
  sendEmailMock.mockReset();
});

describe("generatePortalAccessLink", () => {
  it("devuelve el action_link cuando generateLink funciona (sin crear user)", async () => {
    const { admin, generateLink, createUser } = makeAdmin([
      { data: { properties: { action_link: "https://sb/verify?token=abc" } }, error: null },
    ]);
    const link = await generatePortalAccessLink(admin, " Cliente@Mail.com ");
    expect(link).toBe("https://sb/verify?token=abc");
    expect(generateLink).toHaveBeenCalledTimes(1);
    // email normalizado (trim + lower) en la llamada a Auth
    expect(generateLink.mock.calls[0][0]).toMatchObject({
      type: "magiclink",
      email: "cliente@mail.com",
    });
    expect(createUser).not.toHaveBeenCalled();
  });

  it("crea el auth.user y reintenta si el 1er generateLink falla (cliente sin cuenta)", async () => {
    const { admin, generateLink, createUser } = makeAdmin([
      { data: null, error: { message: "User not found" } },
      { data: { properties: { action_link: "https://sb/verify?token=xyz" } }, error: null },
    ]);
    const link = await generatePortalAccessLink(admin, "nuevo@mail.com");
    expect(link).toBe("https://sb/verify?token=xyz");
    expect(createUser).toHaveBeenCalledTimes(1);
    expect(generateLink).toHaveBeenCalledTimes(2);
  });

  it("devuelve null si no se pudo generar tras el reintento", async () => {
    const { admin } = makeAdmin([
      { data: null, error: { message: "boom" } },
      { data: null, error: { message: "boom" } },
    ]);
    expect(await generatePortalAccessLink(admin, "x@y.com")).toBeNull();
  });

  it("null (no tira) si el admin no puede generar — best-effort", async () => {
    expect(await generatePortalAccessLink(fakeAdmin, "x@y.com")).toBeNull();
  });
});

describe("portalInviteUrl", () => {
  it("apunta a /entrar con el email precargado y normalizado", () => {
    const link = portalInviteUrl("  Ecotextil2015@Gmail.com ");
    expect(link).toContain("/entrar?email=");
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
    // fakeAdmin no puede generar el enlace directo → CTA cae al fallback /entrar
    expect(input.html).toContain("/entrar?email=carlos%40empresa.com");
    // el saludo usa el nombre del cliente
    expect(input.html).toContain("Carlos Pérez");
    expect(input.metadata?.source).toBe("portal_invite");
  });

  it("usa el enlace DIRECTO en el correo cuando se puede generar (un clic)", async () => {
    sendEmailMock.mockResolvedValue({ ok: true, logId: "l", resendId: null, queued: false });
    const { admin } = makeAdmin([
      { data: { properties: { action_link: "https://sb/verify?token=direct" } }, error: null },
    ]);
    await sendPortalInviteEmail(admin, "t", { email: "ana@mail.com", name: "Ana" });
    const [, , input] = sendEmailMock.mock.calls[0] as [unknown, string, { html?: string }];
    // el CTA lleva el enlace mágico real, NO el /entrar
    expect(input.html).toContain("https://sb/verify?token=direct");
    expect(input.html).not.toContain("/entrar");
    // copy del flujo directo
    expect(input.html).toContain("un clic");
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
