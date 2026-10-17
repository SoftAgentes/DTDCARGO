import { describe, expect, it } from "vitest";
import { avisoDeMantenimiento, fechaVe, horaVe } from "../maintenance-notice";

// Ventana real del corte (decisión de Sam, 2026-10-13): 22:00-23:00 de Caracas.
const VENTANA = {
  MAINTENANCE_NOTICE_START: "2026-10-14T02:00:00Z",
  MAINTENANCE_NOTICE_END: "2026-10-14T03:00:00Z",
};
const t = (iso: string) => new Date(iso);

describe("avisoDeMantenimiento · cuándo aparece", () => {
  it("sin variables no hay aviso", () => {
    expect(avisoDeMantenimiento({}, t("2026-10-13T15:00:00Z"))).toBeNull();
  });

  it("con una sola variable no hay aviso", () => {
    expect(
      avisoDeMantenimiento({ MAINTENANCE_NOTICE_START: VENTANA.MAINTENANCE_NOTICE_START }, t("2026-10-13T15:00:00Z")),
    ).toBeNull();
    expect(
      avisoDeMantenimiento({ MAINTENANCE_NOTICE_END: VENTANA.MAINTENANCE_NOTICE_END }, t("2026-10-13T15:00:00Z")),
    ).toBeNull();
  });

  it("fechas inválidas, sin zona o con el fin antes del inicio: no hay aviso", () => {
    const ahora = t("2026-10-13T15:00:00Z");
    expect(avisoDeMantenimiento({ ...VENTANA, MAINTENANCE_NOTICE_START: "mañana" }, ahora)).toBeNull();
    // Sin zona: Date la leería en la hora local del servidor y diría otra hora.
    // El inicio va 14 h antes del fin para que, en CUALQUIER zona local (−12…+14),
    // siga siendo anterior al fin: así el null solo puede venir del rechazo por
    // falta de zona y no de «fin antes del inicio» (control del mutante).
    expect(
      avisoDeMantenimiento(
        { MAINTENANCE_NOTICE_START: "2026-10-13T12:00:00", MAINTENANCE_NOTICE_END: "2026-10-14T03:00:00Z" },
        t("2026-10-12T00:00:00Z"),
      ),
    ).toBeNull();
    expect(
      avisoDeMantenimiento(
        { MAINTENANCE_NOTICE_START: "2026-10-13T12:00:00Z", MAINTENANCE_NOTICE_END: "2026-10-14T03:00:00" },
        t("2026-10-12T00:00:00Z"),
      ),
    ).toBeNull();
    expect(
      avisoDeMantenimiento(
        { MAINTENANCE_NOTICE_START: VENTANA.MAINTENANCE_NOTICE_END, MAINTENANCE_NOTICE_END: VENTANA.MAINTENANCE_NOTICE_START },
        ahora,
      ),
    ).toBeNull();
    expect(
      avisoDeMantenimiento({ MAINTENANCE_NOTICE_START: VENTANA.MAINTENANCE_NOTICE_START, MAINTENANCE_NOTICE_END: VENTANA.MAINTENANCE_NOTICE_START }, ahora),
    ).toBeNull();
  });

  it("acepta la zona como desplazamiento (-04:00) además de Z", () => {
    const aviso = avisoDeMantenimiento(
      { MAINTENANCE_NOTICE_START: "2026-10-13T22:00:00-04:00", MAINTENANCE_NOTICE_END: "2026-10-13T23:00:00-04:00" },
      t("2026-10-13T15:00:00Z"),
    );
    expect(aviso?.texto).toContain("de 10:00 p. m. a 11:00 p. m.");
  });

  it("desaparece solo al llegar el fin (sin redeploy)", () => {
    expect(avisoDeMantenimiento(VENTANA, t("2026-10-14T03:00:00Z"))).toBeNull();
    expect(avisoDeMantenimiento(VENTANA, t("2026-10-14T09:00:00Z"))).toBeNull();
  });
});

describe("avisoDeMantenimiento · qué dice", () => {
  it("antes de la ventana, el mismo día en Caracas: «Hoy martes 13 de octubre, de 10:00 p. m. a 11:00 p. m.»", () => {
    // 11:30 de Caracas del martes 13.
    const aviso = avisoDeMantenimiento(VENTANA, t("2026-10-13T15:30:00Z"));
    expect(aviso?.fase).toBe("programado");
    expect(aviso?.titulo).toBe("Mantenimiento programado");
    expect(aviso?.texto).toMatch(/^Hoy martes 13 de octubre, de 10:00 p\. m\. a 11:00 p\. m\. \(hora de Venezuela\)/);
    expect(aviso?.texto).toContain("no se podrán guardar cambios");
    expect(aviso?.texto).toContain("tu usuario y tu contraseña siguen igual");
  });

  it("usa el día de Caracas, no el de UTC: a las 21:00 de Caracas ya es 14 en UTC y sigue diciendo «Hoy martes 13»", () => {
    // 01:00Z del 14 = 21:00 del 13 en Caracas.
    expect(avisoDeMantenimiento(VENTANA, t("2026-10-14T01:00:00Z"))?.texto).toMatch(/^Hoy martes 13 de octubre/);
  });

  it("el día anterior dice «Mañana»; antes, «El …»", () => {
    expect(avisoDeMantenimiento(VENTANA, t("2026-10-12T18:00:00Z"))?.texto).toMatch(/^Mañana martes 13 de octubre/);
    expect(avisoDeMantenimiento(VENTANA, t("2026-10-10T18:00:00Z"))?.texto).toMatch(/^El martes 13 de octubre/);
  });

  it("dentro de la ventana: «Mantenimiento en curso … hasta las 11:00 p. m.»", () => {
    const aviso = avisoDeMantenimiento(VENTANA, t("2026-10-14T02:30:00Z"));
    expect(aviso?.fase).toBe("en_curso");
    expect(aviso?.titulo).toBe("Mantenimiento en curso");
    expect(aviso?.texto).toContain("hasta las 11:00 p. m. (hora de Venezuela)");
  });

  it("si la ventana cruza la medianoche de Caracas, el fin lleva su fecha", () => {
    const aviso = avisoDeMantenimiento(
      { MAINTENANCE_NOTICE_START: "2026-10-14T03:30:00Z", MAINTENANCE_NOTICE_END: "2026-10-14T05:00:00Z" },
      t("2026-10-13T15:00:00Z"),
    );
    expect(aviso?.texto).toContain("de 11:30 p. m. a miércoles 14 de octubre, 1:00 a. m.");
  });

  it("habla de tú, no de vos", () => {
    const textos = [
      avisoDeMantenimiento(VENTANA, t("2026-10-13T15:30:00Z"))?.texto ?? "",
      avisoDeMantenimiento(VENTANA, t("2026-10-14T02:30:00Z"))?.texto ?? "",
    ].join(" ");
    expect(textos).not.toMatch(/\b(tenés|podés|esperá|repetílo|repetilo|hacé)\b/i);
  });
});

describe("horaVe / fechaVe", () => {
  it("formatea la hora de Venezuela en 12 horas", () => {
    expect(horaVe(t("2026-10-14T02:00:00Z"))).toBe("10:00 p. m.");
    expect(horaVe(t("2026-10-14T04:30:00Z"))).toBe("12:30 a. m.");
    expect(horaVe(t("2026-10-13T16:00:00Z"))).toBe("12:00 p. m.");
    expect(horaVe(t("2026-10-13T13:05:00Z"))).toBe("9:05 a. m.");
  });

  it("nombra el día y el mes en español con el calendario de Venezuela", () => {
    expect(fechaVe(t("2026-10-14T02:00:00Z"))).toBe("martes 13 de octubre");
    expect(fechaVe(t("2026-10-14T05:00:00Z"))).toBe("miércoles 14 de octubre");
  });
});
