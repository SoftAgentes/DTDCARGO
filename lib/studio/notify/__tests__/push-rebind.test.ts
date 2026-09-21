// @vitest-environment node
/**
 * SDD-0499 · el rebind de un endpoint de push exige posesión.
 *
 * `endpoint` es único global, así que las rutas que registran una sub resolvían
 * el choque re-asignando la fila al que llamaba — con el endpoint llegando en el
 * cuerpo del request. Conocerlo bastaba para dejar a otro sin notificaciones.
 *
 * El caso legítimo (equipo compartido) se conserva porque el navegador presenta
 * también `keys.auth`, el secreto de 16 bytes de ESA suscripción: el mismo
 * registro de service worker devuelve siempre el mismo par, y quien sólo se
 * enteró del endpoint no lo tiene.
 */
import { describe, it, expect } from "vitest";
import {
  operarioPushRebindDenial,
  userPushRebindDenial,
  PUSH_REBIND_DENIAL,
} from "@/lib/studio/notify/push-rebind";
import { makePushDouble, type PushDouble } from "./push-tables-double";
import { SYNTHETIC_PUSH_KEYS } from "./push-subscription-fixture";

const ENDPOINT = "https://fcm.googleapis.com/fcm/send/compartido";
const AUTH_DUENO = SYNTHETIC_PUSH_KEYS.auth;
const AUTH_OTRO = Buffer.from("0f0e0d0c0b0a09080706050403020100", "hex").toString("base64url");

type Admin = Parameters<typeof userPushRebindDenial>[0];
const admin = (d: PushDouble) => d.client as unknown as Admin;

describe("userPushRebindDenial", () => {
  const conFila = () =>
    makePushDouble({
      user_push_subscriptions: [
        {
          endpoint: ENDPOINT,
          user_id: "victima",
          subscription: { endpoint: ENDPOINT, keys: { ...SYNTHETIC_PUSH_KEYS } },
        },
      ],
    });

  it("endpoint libre → deja pasar", async () => {
    const d = makePushDouble({ user_push_subscriptions: [] });
    expect(await userPushRebindDenial(admin(d), ENDPOINT, "quien-sea", AUTH_DUENO)).toBeNull();
  });

  it("el endpoint ya es suyo → deja pasar (es renovación, no rebind)", async () => {
    const d = conFila();
    expect(await userPushRebindDenial(admin(d), ENDPOINT, "victima", AUTH_OTRO)).toBeNull();
  });

  it("otro user con el MISMO auth → deja pasar (equipo compartido de verdad)", async () => {
    const d = conFila();
    expect(await userPushRebindDenial(admin(d), ENDPOINT, "segundo-turno", AUTH_DUENO)).toBeNull();
  });

  it("otro user que sólo conoce el endpoint → deniega", async () => {
    const d = conFila();
    expect(await userPushRebindDenial(admin(d), ENDPOINT, "atacante", AUTH_OTRO)).toBe(
      PUSH_REBIND_DENIAL,
    );
  });

  it("fila sin claves guardadas → deniega (no se asume posesión)", async () => {
    const d = makePushDouble({
      user_push_subscriptions: [
        { endpoint: ENDPOINT, user_id: "victima", subscription: { endpoint: ENDPOINT } },
      ],
    });
    expect(await userPushRebindDenial(admin(d), ENDPOINT, "atacante", AUTH_DUENO)).toBe(
      PUSH_REBIND_DENIAL,
    );
  });

  it("el mensaje no delata de quién es el endpoint", () => {
    expect(PUSH_REBIND_DENIAL).not.toMatch(/victima|user|id/i);
  });
});

describe("operarioPushRebindDenial", () => {
  const conFila = () =>
    makePushDouble({
      operario_push_subscriptions: [
        { endpoint: ENDPOINT, operario_id: "op-victima", auth: AUTH_DUENO },
      ],
    });

  it("otro operario con el MISMO auth → deja pasar (móvil compartido)", async () => {
    const d = conFila();
    expect(
      await operarioPushRebindDenial(admin(d), ENDPOINT, "op-segundo", AUTH_DUENO),
    ).toBeNull();
  });

  it("otro operario que sólo conoce el endpoint → deniega", async () => {
    const d = conFila();
    expect(await operarioPushRebindDenial(admin(d), ENDPOINT, "op-atacante", AUTH_OTRO)).toBe(
      PUSH_REBIND_DENIAL,
    );
  });

  it("endpoint libre → deja pasar", async () => {
    const d = makePushDouble({ operario_push_subscriptions: [] });
    expect(await operarioPushRebindDenial(admin(d), ENDPOINT, "op-1", AUTH_DUENO)).toBeNull();
  });
});

describe("el doble filtra de verdad (control)", () => {
  // Si este control falla, las pruebas de arriba no verifican nada: un doble que
  // devuelve la fila sin mirar el `.eq()` daría verde con el bug adentro.
  it("un endpoint distinto no encuentra la fila", async () => {
    const d = makePushDouble({
      user_push_subscriptions: [
        {
          endpoint: ENDPOINT,
          user_id: "victima",
          subscription: { endpoint: ENDPOINT, keys: { ...SYNTHETIC_PUSH_KEYS } },
        },
      ],
    });
    expect(
      await userPushRebindDenial(admin(d), `${ENDPOINT}-otro`, "atacante", AUTH_OTRO),
    ).toBeNull();
  });
});
