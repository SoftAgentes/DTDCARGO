/**
 * SDD-0650 F2 · El webhook une el contacto con la ficha cuando el teléfono cruzó con UNA (0504).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/studio/feature-flags-queries", () => ({ listFeatureFlags: async () => ({}) }));
vi.mock("@/lib/studio/notify/operario-push-outbox", () => ({ enqueueUserPush: vi.fn(), drainOperarioPushOutbox: vi.fn() }));

import { unirContactoAFicha } from "../union-ficha-manejador";
import { MANEJADORES } from "../webhook-procesar";
import { interpretarContactoDelEvento, interpretarEvento, type EventoChatwoot } from "../webhook-events";
import { mensajeCreado } from "./webhook-fixtures";

const T1 = "11111111-1111-1111-1111-111111111111";
const FICHA = "c0000000-0000-0000-0000-0000000000a1";

function admin(error: { code: string } | null = null) {
  const rpc = vi.fn(async () => ({ data: [{ unidos: 1, ya_estaban: 0, otra_ficha: 0, sin_ficha: 0 }], error }));
  return { rpc, cliente: { rpc } as unknown as Parameters<typeof unirContactoAFicha>[0]["admin"] };
}

const payload = mensajeCreado();
const evento = interpretarEvento(payload) as EventoChatwoot;
const contacto = interpretarContactoDelEvento(payload);

let avisos: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  avisos = vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.stubEnv("CHATWOOT_FICHA_UNIR", "1");
});
afterEach(() => {
  avisos.mockRestore();
  vi.unstubAllEnvs();
});

describe("unirContactoAFicha", () => {
  it("está en MANEJADORES", () => {
    expect(MANEJADORES).toContain(unirContactoAFicha);
  });

  it("con ficha única y contacto: une con origen webhook, solo ids", async () => {
    const a = admin();
    await unirContactoAFicha({ admin: a.cliente, tenantId: T1, contacto }, evento, { nuevo: true, aplicado: true, clientId: FICHA, origenCliente: "telefono" });
    expect(a.rpc).toHaveBeenCalledWith("chatwoot_unir_contactos", {
      p_tenant_id: T1,
      p_origen: "webhook",
      p_pares: [{ client_id: FICHA, contact_id: 5 }],
    });
  });

  it.each([[undefined], [""], ["0"], ["true"], [" 1"]])(
    "con la tabla y CHATWOOT_FICHA_UNIR=%j: no escribe ni llama a la RPC (M1)",
    async (valor) => {
      vi.stubEnv("CHATWOOT_FICHA_UNIR", valor as string);
      const a = admin();
      await unirContactoAFicha({ admin: a.cliente, tenantId: T1, contacto }, evento, { nuevo: true, aplicado: true, clientId: FICHA, origenCliente: "telefono" });
      expect(a.rpc).not.toHaveBeenCalled();
    },
  );

  it("sin ficha (cruce ambiguo o sin teléfono): no llama", async () => {
    const a = admin();
    await unirContactoAFicha({ admin: a.cliente, tenantId: T1, contacto }, evento, { nuevo: true, aplicado: true, clientId: null });
    expect(a.rpc).not.toHaveBeenCalled();
  });

  // SDD-0676: la RPC también devuelve el cliente de una unión que ya existe y el que la
  // conversación conserva. Ninguno prueba que el teléfono cruzó: no se une con ellos.
  it.each([["union"], ["conservado"], [null], [undefined]])(
    "con cliente pero origen %j: no une (solo «telefono» prueba un cruce único)",
    async (origen) => {
      const a = admin();
      await unirContactoAFicha({ admin: a.cliente, tenantId: T1, contacto }, evento, {
        nuevo: true,
        aplicado: true,
        clientId: FICHA,
        origenCliente: origen as "union" | "conservado" | null | undefined,
      });
      expect(a.rpc).not.toHaveBeenCalled();
    },
  );

  it("sin contacto (reproceso): no llama", async () => {
    const a = admin();
    await unirContactoAFicha({ admin: a.cliente, tenantId: T1 }, evento, { nuevo: true, aplicado: true, clientId: FICHA, origenCliente: "telefono" });
    expect(a.rpc).not.toHaveBeenCalled();
  });

  it("sin la 0554 (PGRST202): no lanza y avisa una sola vez", async () => {
    const a = admin({ code: "PGRST202" });
    const ctx = { admin: a.cliente, tenantId: T1, contacto };
    await unirContactoAFicha(ctx, evento, { nuevo: true, aplicado: true, clientId: FICHA, origenCliente: "telefono" });
    await unirContactoAFicha(ctx, evento, { nuevo: true, aplicado: true, clientId: FICHA, origenCliente: "telefono" });
    expect(avisos).toHaveBeenCalledTimes(1);
  });

  it("otro error lanza con el código (el evento queda fallido y se reintenta)", async () => {
    const a = admin({ code: "XX000" });
    await expect(
      unirContactoAFicha({ admin: a.cliente, tenantId: T1, contacto }, evento, { nuevo: true, aplicado: true, clientId: FICHA, origenCliente: "telefono" }),
    ).rejects.toThrow("chatwoot_unir_contactos: XX000");
  });
});
