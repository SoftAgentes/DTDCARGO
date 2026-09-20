// @vitest-environment node
/**
 * alta-health · el aviso de "tiene Shipping Mark y la puerta no abre".
 *
 * EL CASO REAL: DTD-9017 se registró el 15-jul, recibió su correo de bienvenida
 * invitándolo al portal, y el insert de `client_users` había fallado en un
 * console.error. Quedó `portal_approved_at` puesto —"activo" en toda la UI— sin
 * cuenta con la cual entrar. Tres semanas invisible.
 *
 * Acá se prueba el mensaje, que es la parte que decide si el aviso sirve o se
 * archiva: tiene que traer el markbox (para buscarlo) y la acción (qué hacer).
 */
import { describe, it, expect } from "vitest";
import { buildAltaHealthMessage, type AltaSinAcceso } from "../alta-health";

const SITE = "https://dtdcargo.com";

const alta = (over: Partial<AltaSinAcceso> = {}): AltaSinAcceso => ({
  markbox: "DTD-9017",
  name: "Alain de Cardenas",
  created_at: "2026-07-15T14:02:00.000Z",
  ...over,
});

describe("buildAltaHealthMessage", () => {
  it("nombra el markbox, el cliente y la fecha del alta", () => {
    const msg = buildAltaHealthMessage([alta()], SITE);

    expect(msg).toContain("DTD-9017");
    expect(msg).toContain("Alain de Cardenas");
    expect(msg).toContain("2026-07-15");
  });

  it("manda a Administración, que es donde SÍ se puede arreglar", () => {
    // Un aviso sin la acción se lee una vez y se archiva. Y peor que sin acción
    // es con la acción equivocada: quien provisiona el acceso es
    // `portal_invite_client` (Studio › Administración). Desde la ficha del
    // cliente no se puede, así que mandar a /studio/clientes es un callejón.
    const msg = buildAltaHealthMessage([alta()], SITE);
    expect(msg).toMatch(/administraci/i);
    expect(msg).toContain(`${SITE}/studio/admin`);
    expect(msg).not.toContain(`${SITE}/studio/clientes`);
  });

  it("cuenta cuántos son en el encabezado", () => {
    const msg = buildAltaHealthMessage(
      [alta(), alta({ markbox: "DTD-9100", name: "Otro" })],
      SITE,
    );
    expect(msg).toContain("2 cliente(s)");
    expect(msg).toContain("DTD-9100");
  });

  it("no revienta con un cliente sin nombre", () => {
    const msg = buildAltaHealthMessage([alta({ name: null })], SITE);
    expect(msg).toContain("DTD-9017");
    expect(msg).toContain("(sin nombre)");
  });
});
