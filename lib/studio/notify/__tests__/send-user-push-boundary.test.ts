// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const sendNotification = vi.fn();

vi.mock("../vapid", () => ({
  ensureVapid: () => true,
  webpush: { sendNotification: (...args: unknown[]) => sendNotification(...args) },
}));

import { sendPushToUserDevices } from "../send-user-push";
import { SYNTHETIC_PUSH_KEYS } from "./push-subscription-fixture";

function makeAdminWithStoredSubscription(subscription: unknown) {
  const updatedIds: string[] = [];
  const chain = {
    select: () => chain,
    eq: () => chain,
    update: () => chain,
    in: async (_column: string, ids: string[]) => {
      updatedIds.push(...ids);
      return { error: null };
    },
    then: (
      resolve: (value: unknown) => unknown,
      reject?: (error: unknown) => unknown,
    ) =>
      Promise.resolve({
        data: [{ id: "stored-unsafe", subscription }],
        error: null,
      }).then(resolve, reject),
  };

  return {
    admin: { from: () => chain } as never,
    updatedIds,
  };
}

describe("sendPushToUserDevices · frontera de destino persistido", () => {
  beforeEach(() => {
    sendNotification.mockReset();
    sendNotification.mockResolvedValue(undefined);
  });

  it("no entrega un endpoint HTTPS local a web-push", async () => {
    const { admin, updatedIds } = makeAdminWithStoredSubscription({
      endpoint: "https://localhost/private",
      keys: { ...SYNTHETIC_PUSH_KEYS },
    });

    const delivered = await sendPushToUserDevices(admin, "synthetic-user", {
      title: "Prueba",
      body: "Sin red",
    });

    expect(delivered).toBe(0);
    expect(sendNotification).not.toHaveBeenCalled();
    expect(updatedIds).toEqual([]);
  });
});
