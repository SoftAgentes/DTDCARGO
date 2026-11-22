import { describe, expect, it, vi } from "vitest";
import { destinoChat, resolverConversacion, type LecturasChat } from "../crm-chat";

const lecturas = (over: Partial<LecturasChat> = {}): LecturasChat => ({
  ultimaDeFicha: vi.fn(async () => null),
  delContacto: vi.fn(async () => []),
  ...over,
});

describe("resolverConversacion (SDD-0648 §4)", () => {
  it("con ficha usa la conversación más reciente del espejo y no llama a Chatwoot", async () => {
    const leer = lecturas({ ultimaDeFicha: vi.fn(async () => 812) });
    const r = await resolverConversacion({ client_id: "c-1", chatwoot_contact_id: 44 }, leer);
    expect(r).toEqual({ ok: true, conversacion: 812 });
    expect(leer.delContacto).not.toHaveBeenCalled();
  });

  it("sin conversación en la ficha cae al contacto y toma la más nueva", async () => {
    const leer = lecturas({ delContacto: vi.fn(async () => [12, 97, 40]) });
    const r = await resolverConversacion({ client_id: "c-1", chatwoot_contact_id: 44 }, leer);
    expect(r).toEqual({ ok: true, conversacion: 97 });
    expect(leer.delContacto).toHaveBeenCalledWith(44);
  });

  it("un lead sin ficha usa solo el contacto", async () => {
    const leer = lecturas({ delContacto: vi.fn(async () => [5]) });
    const r = await resolverConversacion({ client_id: null, chatwoot_contact_id: 9 }, leer);
    expect(r).toEqual({ ok: true, conversacion: 5 });
    expect(leer.ultimaDeFicha).not.toHaveBeenCalled();
  });

  it("sin ficha ni contacto, o sin conversaciones, no hay chat", async () => {
    expect(await resolverConversacion({ client_id: null, chatwoot_contact_id: null }, lecturas())).toEqual({
      ok: false,
      motivo: "sin_chat",
    });
    expect(await resolverConversacion({ client_id: null, chatwoot_contact_id: 9 }, lecturas())).toEqual({
      ok: false,
      motivo: "sin_chat",
    });
  });

  it("si Chatwoot no responde, lo dice como error y no como «sin chat»", async () => {
    const leer = lecturas({ delContacto: vi.fn(async () => null) });
    expect(await resolverConversacion({ client_id: null, chatwoot_contact_id: 9 }, leer)).toEqual({
      ok: false,
      motivo: "error",
    });
  });
});

describe("destinoChat", () => {
  it("lleva a la Bandeja (pestaña del CRM, SDD-0655) en esa conversación", () => {
    expect(destinoChat({ ok: true, conversacion: 97 })).toBe("/studio/bandeja?c=97");
  });
  it("sin chat o con error vuelve al tablero con aviso", () => {
    expect(destinoChat({ ok: false, motivo: "sin_chat" })).toBe("/studio/crm?tab=embudos&chat=sin");
    expect(destinoChat({ ok: false, motivo: "error" })).toBe("/studio/crm?tab=embudos&chat=error");
    expect(destinoChat({ ok: false, motivo: "sin_bandeja" })).toBe("/studio/crm?tab=embudos&chat=sin_bandeja");
  });
});
