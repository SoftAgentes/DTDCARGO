// @vitest-environment node
/**
 * canResend · qué correo se puede reenviar y cuál no.
 *
 * Complemento de mail-health: aquel detecta, esto repara. Las reglas importan
 * porque las dos negativas son fáciles de equivocar:
 *
 *   · Reenviar uno que SÍ llegó → el cliente recibe el mensaje dos veces.
 *   · Reenviar un REBOTE al mismo destino → falla igual y castiga la reputación
 *     del dominio. Sin este freno, el operador aprieta el botón cinco veces.
 *
 * Y la tercera es una limitación real que hay que decir, no esconder:
 * `mail_logs` no guarda el cuerpo, así que un correo de cuerpo libre no se
 * puede reconstruir.
 */
import { describe, it, expect } from "vitest";
import { canResend, type StuckMailRow } from "../resend-stuck";

const row = (over: Partial<StuckMailRow> = {}): StuckMailRow => ({
  id: "log-1",
  tenant_id: "t-1",
  to_email: "cliente@ejemplo.com",
  to_name: "Johana Matheus",
  subject: "Bienvenido a DTD Cargo · tu Shipping Mark es DTD-1009",
  template_slug: "welcome_markbox",
  rendered_variables: { markbox: "DTD-1009", client_name: "Johana Matheus" },
  status: "queued",
  ...over,
});

describe("canResend", () => {
  it("⭐ deja reenviar el que quedó atascado sin salir — el caso de los 4 de junio", () => {
    const r = canResend(row());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.templateSlug).toBe("welcome_markbox");
      expect(r.vars.markbox).toBe("DTD-1009");
    }
  });

  it("deja reenviar un 'failed', que puede haber sido transitorio", () => {
    expect(canResend(row({ status: "failed" })).ok).toBe(true);
  });

  it.each(["delivered", "opened", "clicked", "sent"])(
    "NO reenvía uno que ya llegó (%s) — seria duplicarle el mensaje al cliente",
    (status) => {
      const r = canResend(row({ status }));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toMatch(/llegó|duplic/i);
    },
  );

  it.each(["bounced", "complained"])(
    "⭐ NO reenvía un %s al mismo destino: falla igual y quema la reputación",
    (status) => {
      const r = canResend(row({ status }));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toMatch(/rebot|direcci/i);
    },
  );

  it("no reenvía un correo de cuerpo libre: el cuerpo no se guarda", () => {
    const r = canResend(row({ template_slug: null }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/cuerpo/i);
  });

  it("no reenvía sin destinatario", () => {
    expect(canResend(row({ to_email: "   " })).ok).toBe(false);
  });

  it("tolera rendered_variables null sin romperse", () => {
    const r = canResend(row({ rendered_variables: null }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.vars).toEqual({});
  });
});
