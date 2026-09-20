// @vitest-environment node
/**
 * scheduleIdToDowngrade · ¿un rebote debe degradar el aviso al cliente?
 *
 * EL BUG QUE CIERRA: el drain marca la fila 'sent' como claim atómico ANTES de
 * despachar. Cuando el correo rebotaba, se actualizaba mail_logs y nadie tocaba
 * client_notification_schedule → el equipo veía "Enviado" para un aviso que el
 * cliente nunca recibió. Peor que no avisar, porque cierra la pregunta.
 *
 * El hilo ya existía (el drain guarda schedule_id en la metadata del mail_log);
 * lo que faltaba era usarlo.
 */
import { describe, it, expect } from "vitest";
import { scheduleIdToDowngrade } from "../mark-notification-undelivered";

const META = { source: "client-notification-drain", schedule_id: "sch-1" };

describe("scheduleIdToDowngrade", () => {
  it.each(["bounced", "complained", "failed"])(
    "degrada el aviso cuando el correo terminó en %s",
    (status) => {
      expect(scheduleIdToDowngrade(status, META)).toBe("sch-1");
    },
  );

  it.each(["delivered", "sent", "opened", "clicked"])(
    "NO toca nada cuando el correo sí llegó (%s)",
    (status) => {
      expect(scheduleIdToDowngrade(status, META)).toBeNull();
    },
  );

  it("no hace nada si el correo no venía de un aviso al cliente", () => {
    // Un welcome o un aviso interno rebotado no tiene schedule_id: no hay fila
    // de aviso que degradar y no debemos inventar una.
    expect(scheduleIdToDowngrade("bounced", { source: "welcome_markbox" })).toBeNull();
    expect(scheduleIdToDowngrade("bounced", null)).toBeNull();
  });

  it("ignora un schedule_id que no sea string no vacío", () => {
    expect(scheduleIdToDowngrade("bounced", { schedule_id: "" })).toBeNull();
    expect(scheduleIdToDowngrade("bounced", { schedule_id: 42 })).toBeNull();
  });

  it("tolera un evento sin status traducido (ej. delivery_delayed)", () => {
    expect(scheduleIdToDowngrade(undefined, META)).toBeNull();
  });
});
