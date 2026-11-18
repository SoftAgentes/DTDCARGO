/**
 * SDD-0650 F2 · El panel de conversaciones de la ficha, armado en el servidor.
 *
 * El doble de Supabase FILTRA de verdad: aplica los `.eq()` sobre filas en memoria de
 * dos tenants y dos fichas, y además hace lo que hace la RLS de la 0554 (sin Bandeja,
 * ninguna fila). El doble de Chatwoot devuelve conversaciones con texto y nombre
 * sintéticos para comprobar que solo salen a quien corresponde y nunca a los logs.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ChatwootResult } from "../chatwoot-types";
import { cargarPanelConversaciones, type AccesoFicha } from "../ficha-panel";

/** SINT: teléfono imposible en Venezuela (ningún código de área empieza por 0). */
const TELEFONO_SINT = "+58 000-000-0650";
const T1 = "11111111-1111-1111-1111-111111111111";
const T2 = "22222222-2222-2222-2222-222222222222";
const FICHA = "c0000000-0000-0000-0000-0000000000a1";
const OTRA = "c0000000-0000-0000-0000-0000000000a2";
const ARCHIVO = 9;
const TEXTO_ARCHIVO = "SINT-0650 texto del Archivo Kommo";
const TEXTO_WA = "SINT-0650 texto de WhatsApp";
const NOMBRE = "SINT Nombre del Chat";

const FILAS = [
  { tenant_id: T1, client_id: FICHA, chatwoot_contact_id: 501, origen: "kommo", created_at: "2026-11-01" },
  { tenant_id: T1, client_id: FICHA, chatwoot_contact_id: 502, origen: "webhook", created_at: "2026-11-02" },
  { tenant_id: T1, client_id: OTRA, chatwoot_contact_id: 600, origen: "webhook", created_at: "2026-11-02" },
  { tenant_id: T2, client_id: FICHA, chatwoot_contact_id: 700, origen: "manual", created_at: "2026-11-02" },
];

/** Cliente de sesión con la RLS de la 0554: sin Bandeja no hay filas; con, solo su tenant. */
function sesion(opts: { conBandeja: boolean; tenantSesion: string; error?: { code: string } }) {
  const consultas: string[] = [];
  return {
    consultas,
    cliente: {
      from(tabla: string) {
        consultas.push(tabla);
        const filtros: Array<[string, unknown]> = [];
        const q = {
          select: () => q,
          eq: (col: string, v: unknown) => {
            filtros.push([col, v]);
            return q;
          },
          order: () => q,
          limit: async () => {
            if (opts.error) return { data: null, error: opts.error };
            const visibles = opts.conBandeja ? FILAS.filter((f) => f.tenant_id === opts.tenantSesion) : [];
            const data = visibles.filter((f) => filtros.every(([c, v]) => (f as Record<string, unknown>)[c] === v));
            return { data: data.map(({ chatwoot_contact_id, origen }) => ({ chatwoot_contact_id, origen })), error: null };
          },
        };
        return q;
      },
    } as unknown as Parameters<typeof cargarPanelConversaciones>[0]["supabase"],
  };
}

function conversacion(id: number, inbox: number, texto: string, cuando: number) {
  return {
    id,
    inbox_id: inbox,
    status: "open",
    unread_count: 0,
    last_activity_at: cuando,
    meta: { sender: { id: 1, name: NOMBRE, phone_number: TELEFONO_SINT } },
    last_non_activity_message: { id: id * 10, content: texto, message_type: 0, created_at: cuando },
  };
}

const POR_CONTACTO: Record<number, unknown[]> = {
  501: [conversacion(11, ARCHIVO, TEXTO_ARCHIVO, 1_763_000_000)],
  502: [conversacion(12, 3, TEXTO_WA, 1_763_000_100)],
};

function chatwoot(fallan: number[] = []) {
  return vi.fn(async (_cfg: unknown, contacto: number): Promise<ChatwootResult<unknown[]>> =>
    fallan.includes(contacto) ? { ok: false, error: "red" } : { ok: true, data: POR_CONTACTO[contacto] ?? [] },
  );
}

const COMERCIAL: AccesoFicha = { role: "commercial" };
const SOPORTE: AccesoFicha = { role: "support" };
const ADMIN: AccesoFicha = { role: "admin" };
const OPERACIONES: AccesoFicha = { role: "operations" };
const CONTABILIDAD_CON_BANDEJA: AccesoFicha = { role: "accounting", grants: { bandeja: { view: true, edit: false } } };

function args(acceso: AccesoFicha, extra: Partial<Parameters<typeof cargarPanelConversaciones>[0]> = {}) {
  const s = sesion({ conBandeja: acceso.role !== "operations", tenantSesion: T1 });
  return { s, a: { supabase: s.cliente, tenantId: T1, clientId: FICHA, acceso, puedeVerDatos: true, fichaSinNombre: true, ...extra } };
}

let avisos: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  vi.stubEnv("CHATWOOT_FICHA_TOKEN", "token-sintetico-ficha");
  vi.stubEnv("CHATWOOT_ACCOUNT_ID", "1");
  vi.stubEnv("CHATWOOT_INBOX_ARCHIVO_KOMMO_ID", String(ARCHIVO));
  vi.stubEnv("CHATWOOT_URL", "https://chat.example.test");
  vi.stubEnv("CHATWOOT_TENANT_ID", T1);
  avisos = vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  avisos.mockRestore();
});

describe("barreras antes de tocar el token", () => {
  it("un rol sin Bandeja: apagado, sin leer uniones ni llamar a Chatwoot", async () => {
    const leer = chatwoot();
    const { s, a } = args(OPERACIONES);
    expect(await cargarPanelConversaciones({ ...a, leer })).toEqual({ estado: "apagado" });
    expect(leer).not.toHaveBeenCalled();
    expect(s.consultas).toEqual([]);
  });

  it("contabilidad sin acceso extra a la Bandeja: tampoco", async () => {
    const leer = chatwoot();
    const { a } = args({ role: "accounting" });
    expect(await cargarPanelConversaciones({ ...a, leer })).toEqual({ estado: "apagado" });
    expect(leer).not.toHaveBeenCalled();
  });

  it.each([
    ["sin token", "CHATWOOT_FICHA_TOKEN", undefined],
    ["token vacío", "CHATWOOT_FICHA_TOKEN", ""],
    ["token de espacios", "CHATWOOT_FICHA_TOKEN", "   "],
    ["sin bandeja del Archivo Kommo", "CHATWOOT_INBOX_ARCHIVO_KOMMO_ID", ""],
    ["cuenta inválida", "CHATWOOT_ACCOUNT_ID", "uno"],
    ["sin tenant dueño de la cuenta", "CHATWOOT_TENANT_ID", ""],
  ])("%s: apagado, como en la F1", async (_n, variable, valor) => {
    vi.stubEnv(variable, valor as string);
    const leer = chatwoot();
    const { s, a } = args(COMERCIAL);
    expect(await cargarPanelConversaciones({ ...a, leer })).toEqual({ estado: "apagado" });
    expect(leer).not.toHaveBeenCalled();
    expect(s.consultas).toEqual([]);
  });

  it("una sesión de OTRO tenant (con Bandeja): apagado, sin leer uniones ni usar el token", async () => {
    const leer = chatwoot();
    const s = sesion({ conBandeja: true, tenantSesion: T2 });
    const r = await cargarPanelConversaciones({ ...args(ADMIN).a, supabase: s.cliente, tenantId: T2, leer });
    expect(r).toEqual({ estado: "apagado" });
    expect(leer).not.toHaveBeenCalled();
    expect(s.consultas).toEqual([]);
  });

  it("sin la 0554 (PGRST205): apagado, sin aviso en el log", async () => {
    const leer = chatwoot();
    const s = sesion({ conBandeja: true, tenantSesion: T1, error: { code: "PGRST205" } });
    const r = await cargarPanelConversaciones({ ...args(COMERCIAL).a, supabase: s.cliente, leer });
    expect(r).toEqual({ estado: "apagado" });
    expect(leer).not.toHaveBeenCalled();
    expect(avisos).not.toHaveBeenCalled();
  });

  it("ficha sin uniones: sin_uniones (la página muestra la tarjeta de la F1)", async () => {
    const leer = chatwoot();
    const r = await cargarPanelConversaciones({ ...args(COMERCIAL).a, clientId: "c0000000-0000-0000-0000-0000000000ff", leer });
    expect(r).toEqual({ estado: "sin_uniones" });
    expect(leer).not.toHaveBeenCalled();
  });
});

describe("lectura en vivo", () => {
  it("lee SOLO los contactos de esta ficha y de este tenant", async () => {
    const leer = chatwoot();
    await cargarPanelConversaciones({ ...args(COMERCIAL).a, leer });
    expect(leer.mock.calls.map((c) => c[1]).sort()).toEqual([501, 502]);
  });

  it("comercial: ve el texto del Archivo Kommo pero no recibe su enlace; sí el de WhatsApp", async () => {
    const r = await cargarPanelConversaciones({ ...args(COMERCIAL).a, leer: chatwoot() });
    if (r.estado !== "listo") throw new Error(r.estado);
    expect(r.panel.items.map((i) => [i.conversationId, i.abrirHref])).toEqual([
      [12, "/studio/bandeja?c=12"],
      [11, null],
    ]);
    expect(r.panel.items.find((i) => i.conversationId === 11)?.texto).toBe(TEXTO_ARCHIVO);
    expect(r.panel.hayQueNoAbres).toBe(true);
    expect(JSON.stringify(r)).not.toContain("/studio/bandeja?c=11");
    expect(r.puedeUnir).toBe(true);
  });

  it("soporte: igual que comercial para abrir, y no une (solo lectura)", async () => {
    const r = await cargarPanelConversaciones({ ...args(SOPORTE).a, leer: chatwoot() });
    if (r.estado !== "listo") throw new Error(r.estado);
    expect(JSON.stringify(r)).not.toContain("/studio/bandeja?c=11");
    expect(r.puedeUnir).toBe(false);
  });

  it("admin y contabilidad con Bandeja: reciben el enlace del Archivo Kommo", async () => {
    for (const acceso of [ADMIN, CONTABILIDAD_CON_BANDEJA]) {
      const r = await cargarPanelConversaciones({ ...args(acceso).a, leer: chatwoot() });
      if (r.estado !== "listo") throw new Error(r.estado);
      expect(r.panel.items.find((i) => i.conversationId === 11)?.abrirHref).toBe("/studio/bandeja?c=11");
      expect(r.panel.hayQueNoAbres).toBe(false);
    }
  });

  it("sin poder ver datos (SDD-0531): ni el texto ni el nombre salen del servidor", async () => {
    const r = await cargarPanelConversaciones({ ...args(ADMIN).a, puedeVerDatos: false, leer: chatwoot() });
    const json = JSON.stringify(r);
    expect(json).not.toContain(TEXTO_ARCHIVO);
    expect(json).not.toContain(TEXTO_WA);
    expect(json).not.toContain(NOMBRE);
  });

  it("«Nombre en el chat» con la ficha sin nombre; nunca el teléfono", async () => {
    const r = await cargarPanelConversaciones({ ...args(COMERCIAL).a, leer: chatwoot() });
    if (r.estado !== "listo") throw new Error(r.estado);
    expect(r.panel.nombreEnElChat).toBe(NOMBRE);
    expect(JSON.stringify(r)).not.toContain("000-000");
  });

  it("Chatwoot no responde en ningún contacto: chatwoot_no_responde", async () => {
    const r = await cargarPanelConversaciones({ ...args(COMERCIAL).a, leer: chatwoot([501, 502]) });
    expect(r).toEqual({ estado: "chatwoot_no_responde" });
  });

  it("uno falla: lo que se pudo leer, marcado incompleto", async () => {
    const r = await cargarPanelConversaciones({ ...args(COMERCIAL).a, leer: chatwoot([501]) });
    if (r.estado !== "listo") throw new Error(r.estado);
    expect(r.panel.items.map((i) => i.conversationId)).toEqual([12]);
    expect(r.panel.incompleto).toBe(true);
  });

  it("los avisos del log llevan solo el código: ni texto, ni nombre, ni token", async () => {
    await cargarPanelConversaciones({ ...args(COMERCIAL).a, leer: chatwoot([501]) });
    const log = JSON.stringify(avisos.mock.calls);
    expect(log).toContain("red");
    for (const nada of [TEXTO_ARCHIVO, TEXTO_WA, NOMBRE, "token-sintetico-ficha"]) expect(log).not.toContain(nada);
  });

  it("otro tenant en la sesión no ve las uniones de T1", async () => {
    const leer = chatwoot();
    const s = sesion({ conBandeja: true, tenantSesion: T2 });
    // Aunque la página pidiera T1 por error, la RLS (el doble) solo deja T2: no hay uniones de T1.
    const r = await cargarPanelConversaciones({ ...args(COMERCIAL).a, supabase: s.cliente, leer });
    expect(r).toEqual({ estado: "sin_uniones" });
    expect(leer).not.toHaveBeenCalled();
  });
});
