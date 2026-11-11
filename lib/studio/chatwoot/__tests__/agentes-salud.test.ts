/**
 * SDD-0585 · paso 2.5 · reglas del ciclo de vida de los agentes. Los casos
 * reales del VPS (Director, 2026-10-30): el usuario de servicio (id 1) es admin
 * de la cuenta 1, y hasta crear a vzla@ (id 3) era el ÚNICO admin.
 */
import { describe, expect, it } from "vitest";

import { bloqueoDeBaja, decidirBaja, evaluarSalud } from "../agentes-salud";

const SERVICIO = 1;
const ADMIN_HUMANO = 3;
const AGENTE = 7;
const cuenta = (...m: [number, "agent" | "administrator"][]) => m.map(([userId, rol]) => ({ userId, rol }));

describe("decidirBaja (2.5)", () => {
  it("activo y con Bandeja: se queda", () => {
    expect(decidirBaja({ userId: "u", activo: true, puedeBandeja: true })).toBeNull();
  });
  it("desactivado, fuera del tenant o sin Bandeja: baja con su motivo", () => {
    expect(decidirBaja({ userId: "u", activo: false, puedeBandeja: true })).toBe("desactivado");
    expect(decidirBaja(undefined)).toBe("fuera_del_tenant");
    expect(decidirBaja({ userId: "u", activo: true, puedeBandeja: false })).toBe("sin_bandeja");
  });
});

describe("bloqueoDeBaja (2.5)", () => {
  it("el usuario de servicio nunca se saca", () => {
    expect(bloqueoDeBaja(SERVICIO, cuenta([SERVICIO, "administrator"], [ADMIN_HUMANO, "administrator"]), SERVICIO)).toBe("servicio");
  });

  it("el último admin humano no se saca, aunque el de servicio siga siendo admin", () => {
    expect(bloqueoDeBaja(ADMIN_HUMANO, cuenta([SERVICIO, "administrator"], [ADMIN_HUMANO, "administrator"]), SERVICIO)).toBe(
      "ultimo_admin_humano",
    );
  });

  it("con otro admin humano, sí se saca", () => {
    expect(bloqueoDeBaja(ADMIN_HUMANO, cuenta([SERVICIO, "administrator"], [ADMIN_HUMANO, "administrator"], [9, "administrator"]), SERVICIO)).toBeNull();
  });

  it("un agente se saca aunque no quede ningún admin humano", () => {
    expect(bloqueoDeBaja(AGENTE, cuenta([SERVICIO, "administrator"], [AGENTE, "agent"]), SERVICIO)).toBeNull();
  });

  it("sin el id de servicio, cuenta a todos los demás admins (conservador)", () => {
    expect(bloqueoDeBaja(ADMIN_HUMANO, cuenta([SERVICIO, "administrator"], [ADMIN_HUMANO, "administrator"]), null)).toBeNull();
    expect(bloqueoDeBaja(ADMIN_HUMANO, cuenta([ADMIN_HUMANO, "administrator"]), null)).toBe("ultimo_admin_humano");
  });

  it("alguien que ya no está en la cuenta no bloquea", () => {
    expect(bloqueoDeBaja(AGENTE, cuenta([SERVICIO, "administrator"]), SERVICIO)).toBeNull();
  });
});

describe("evaluarSalud (2.5)", () => {
  it("cuenta sana: un admin humano, vínculos dentro de la cuenta", () => {
    const s = evaluarSalud({
      miembrosCuenta: { ok: true, data: cuenta([SERVICIO, "administrator"], [ADMIN_HUMANO, "administrator"], [AGENTE, "agent"]) },
      servicioId: SERVICIO,
      vinculos: [{ userId: "u", chatwootUserId: AGENTE }],
    });
    expect(s).toEqual({ alertas: [], adminsHumanos: 1, vinculosFueraDeCuenta: [] });
  });

  it("el caso del VPS antes de vzla@: el único admin es el de servicio → sin_admin_humano", () => {
    const s = evaluarSalud({ miembrosCuenta: { ok: true, data: cuenta([SERVICIO, "administrator"]) }, servicioId: SERVICIO, vinculos: [] });
    expect(s.alertas).toEqual(["sin_admin_humano"]);
    expect(s.adminsHumanos).toBe(0);
  });

  it("un vínculo a un agente que ya no está en la cuenta → vinculo_fuera_de_cuenta", () => {
    const s = evaluarSalud({
      miembrosCuenta: { ok: true, data: cuenta([SERVICIO, "administrator"], [ADMIN_HUMANO, "administrator"]) },
      servicioId: SERVICIO,
      vinculos: [{ userId: "u", chatwootUserId: AGENTE }],
    });
    expect(s.alertas).toEqual(["vinculo_fuera_de_cuenta"]);
    expect(s.vinculosFueraDeCuenta).toEqual([AGENTE]);
  });

  it("sin el id de servicio no puede decir cuántos admins humanos hay", () => {
    const s = evaluarSalud({ miembrosCuenta: { ok: true, data: cuenta([SERVICIO, "administrator"]) }, servicioId: null, vinculos: [] });
    expect(s.alertas).toEqual(["servicio_sin_configurar"]);
    expect(s.adminsHumanos).toBeNull();
  });

  it("Chatwoot no responde → una sola alerta, con el código", () => {
    const s = evaluarSalud({ miembrosCuenta: { ok: false, error: "red" }, servicioId: SERVICIO, vinculos: [] });
    expect(s).toEqual({ alertas: ["chatwoot_no_responde"], adminsHumanos: null, vinculosFueraDeCuenta: [], error: "red" });
  });
});
