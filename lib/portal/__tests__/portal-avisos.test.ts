/**
 * SDD-0526 · Bandeja de avisos del Portal — lecturas, «visto» y reglas puras.
 *
 * Las consultas no filtran en PostgREST: llaman a las RPC de la migración 0479,
 * que filtran en la base (tenant, Shipping Mark, ancla viva, «Visible en el
 * portal»). Esa frontera se prueba en PGlite
 * (`portal-bandeja-avisos.migration.test.ts`). Acá el doble de la RPC aplica lo
 * que la RPC recibe del código —la compra y el tope— igual que la base, devuelve
 * COPIAS y rechaza argumentos que la firma real no tiene: si el código dejara de
 * pasar la compra, el filtro por compra se rompería también acá.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AVISO_TEXTO_GENERICO,
  AVISO_TITULO_GENERICO,
  avisoDesdeFila,
  avisosSinLeer,
  contadorVisible,
  etiquetaDelEvento,
  fechaDelAviso,
  historialDesdeAviso,
  hrefDelAviso,
  masReciente,
  type PortalAviso,
} from "../portal-avisos";
import {
  BANDEJA_LIMITE,
  listMyPortalAvisos,
  markMyPortalAvisosSeen,
} from "../portal-avisos-queries";

type Fila = {
  id: string;
  trigger_event: string;
  anchor_kind: string;
  anchor_code: string;
  title: string | null;
  body: string | null;
  channel: string;
  sent_at: string | null;
  unread: boolean;
  /** Interno del doble: de qué compra cuelga (la RPC no lo devuelve). */
  __prealerta_id: string | null;
};

const FIRMAS: Record<string, string[]> = {
  portal_list_my_notifications: ["p_prealerta_id", "p_limit"],
  portal_mark_my_notifications_seen: ["p_hasta"],
};

/** Doble de `db.rpc` con la semántica de la 0479 para lo que viene del código. */
function dobleRpc(
  filas: Fila[],
  modo: "ok" | "error" | "sin-lista" | "lanza" = "ok",
) {
  const llamadas: { fn: string; args: Record<string, unknown> }[] = [];
  const rpc = vi.fn(async (fn: string, args: Record<string, unknown> = {}) => {
    llamadas.push({ fn, args: structuredClone(args) });
    const firma = FIRMAS[fn];
    if (!firma) throw new Error(`RPC inexistente: ${fn}`);
    for (const k of Object.keys(args)) {
      if (!firma.includes(k)) throw new Error(`argumento que la firma no tiene: ${k}`);
    }
    if (modo === "lanza") throw new Error("red caída");
    if (modo === "error") {
      return { data: null, error: { code: "PGRST202", message: "Could not find the function" } };
    }
    if (fn === "portal_mark_my_notifications_seen") {
      return { data: args.p_hasta, error: null };
    }
    if (modo === "sin-lista") return { data: { algo: 1 }, error: null };
    const compra = (args.p_prealerta_id ?? null) as string | null;
    const pedido = args.p_limit == null ? 20 : Number(args.p_limit);
    const tope = Math.min(Math.max(pedido, 1), 50);
    const data = filas
      .filter((f) => compra === null || f.__prealerta_id === compra)
      .slice(0, tope)
      .map((f) => {
        // La RPC no devuelve de qué compra cuelga el aviso.
        const publica: Record<string, unknown> = structuredClone(f);
        delete publica.__prealerta_id;
        return publica;
      });
    return { data, error: null };
  });
  return { db: { rpc } as unknown as SupabaseClient, rpc, llamadas };
}

function fila(over: Partial<Fila> & Pick<Fila, "id">): Fila {
  return {
    trigger_event: "status:shipped",
    anchor_kind: "envio",
    anchor_code: "ENV-0001",
    title: "Tu carga fue embarcada",
    body: "Tu mercancía zarpó de China rumbo a Venezuela.",
    channel: "email",
    sent_at: "2026-10-15T14:30:00+00:00",
    unread: true,
    __prealerta_id: null,
    ...over,
  };
}

const FILAS: Fila[] = [
  fila({ id: "a3", sent_at: "2026-10-15T14:30:00+00:00" }),
  fila({
    id: "a2",
    trigger_event: "status:in_warehouse",
    anchor_kind: "compra",
    anchor_code: "DTD-0001-1-1",
    title: "Tu carga llegó a nuestra bodega en China",
    body: "Recibimos tu mercancía en Yiwu.",
    sent_at: "2026-10-14T13:00:00+00:00",
    __prealerta_id: "p-1",
  }),
  fila({
    id: "a1",
    trigger_event: "status:in_warehouse",
    anchor_kind: "compra",
    anchor_code: "DTD-0001-1-2",
    sent_at: "2026-10-13T09:05:00+00:00",
    unread: false,
    __prealerta_id: "p-2",
  }),
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe("listMyPortalAvisos", () => {
  it("pide la bandeja con su tope y sin compra, y le da forma a cada aviso", async () => {
    const { db, llamadas } = dobleRpc(FILAS);
    const avisos = await listMyPortalAvisos(db);

    expect(llamadas).toEqual([
      { fn: "portal_list_my_notifications", args: { p_prealerta_id: null, p_limit: BANDEJA_LIMITE } },
    ]);
    expect(BANDEJA_LIMITE).toBe(20);
    expect(avisos.map((a) => a.id)).toEqual(["a3", "a2", "a1"]);
    expect(avisos[0]).toEqual({
      id: "a3",
      title: "Tu carga fue embarcada",
      body: "Tu mercancía zarpó de China rumbo a Venezuela.",
      sentAt: "2026-10-15T14:30:00+00:00",
      sentAtLabel: "15 oct 2026 · 10:30",
      eventLabel: "Embarcado",
      channel: "email",
      anchorKind: "envio",
      anchorCode: "ENV-0001",
      anchorLabel: "Envío",
      href: "/portal/envios/ENV-0001",
      unread: true,
    } satisfies PortalAviso);
    expect(avisos[1]).toMatchObject({
      anchorKind: "compra",
      anchorLabel: "Compra",
      href: "/portal/compras/DTD-0001-1-1",
      eventLabel: "En bodega",
    });
    expect(avisos[2].unread).toBe(false);
  });

  it("acota a una compra: la compra viaja a la RPC y vuelve sólo lo suyo", async () => {
    const { db, llamadas } = dobleRpc(FILAS);
    const avisos = await listMyPortalAvisos(db, { prealertaId: "p-1", limit: 50 });

    expect(llamadas[0].args).toEqual({ p_prealerta_id: "p-1", p_limit: 50 });
    expect(avisos.map((a) => a.id)).toEqual(["a2"]);
  });

  it("control del doble: sin compra vuelven las tres, así que el filtro de arriba no es del fixture", async () => {
    const { db } = dobleRpc(FILAS);
    expect((await listMyPortalAvisos(db, { limit: 50 })).map((a) => a.id)).toEqual(["a3", "a2", "a1"]);
  });

  it("respeta el tope que pide", async () => {
    const { db } = dobleRpc(FILAS);
    expect(await listMyPortalAvisos(db, { limit: 1 })).toHaveLength(1);
  });

  it("devuelve objetos nuevos: tocar uno no cambia la siguiente lectura", async () => {
    const { db } = dobleRpc(FILAS);
    const primera = await listMyPortalAvisos(db);
    primera[0].title = "cambiado";
    const segunda = await listMyPortalAvisos(db);
    expect(segunda[0].title).toBe("Tu carga fue embarcada");
    expect(FILAS[0].title).toBe("Tu carga fue embarcada");
  });

  it("título o texto vacíos usan el genérico, que no le dice envío a una compra", async () => {
    const { db } = dobleRpc([
      fila({ id: "x", anchor_kind: "compra", anchor_code: "DTD-9-1-1", title: null, body: "  " }),
    ]);
    const [aviso] = await listMyPortalAvisos(db);
    expect(aviso.title).toBe(AVISO_TITULO_GENERICO);
    expect(aviso.body).toBe(AVISO_TEXTO_GENERICO);
    expect(`${aviso.title} ${aviso.body}`).not.toMatch(/env[ií]o/i);
  });

  it("descarta filas sin lo indispensable en vez de inventarlo", async () => {
    const { db } = dobleRpc([
      fila({ id: "bien" }),
      fila({ id: "" }),
      fila({ id: "sin-ancla", anchor_code: "" }),
      fila({ id: "ancla-rara", anchor_kind: "factura" }),
      fila({ id: "sin-fecha", sent_at: null }),
      fila({ id: "fecha-rota", sent_at: "ayer" }),
    ]);
    expect((await listMyPortalAvisos(db)).map((a) => a.id)).toEqual(["bien"]);
  });

  it.each([
    ["error de la RPC (sin la migración)", "error" as const, "PGRST202"],
    ["respuesta que no es lista", "sin-lista" as const, "respuesta sin lista"],
    ["excepción", "lanza" as const, "red caída"],
  ])("%s → bandeja vacía y un log sin datos del cliente", async (_l, modo, esperado) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { db } = dobleRpc(FILAS, modo);
    expect(await listMyPortalAvisos(db, { prealertaId: "p-1" })).toEqual([]);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]).toEqual(["[portal-avisos] la bandeja no se pudo leer:", esperado]);
  });
});

describe("markMyPortalAvisosSeen", () => {
  it("manda la fecha del aviso más nuevo que se mostró", async () => {
    const { db, llamadas } = dobleRpc([]);
    expect(await markMyPortalAvisosSeen(db, "2026-10-15T14:30:00+00:00")).toBe(true);
    expect(llamadas).toEqual([
      { fn: "portal_mark_my_notifications_seen", args: { p_hasta: "2026-10-15T14:30:00+00:00" } },
    ]);
  });

  it("una fecha que no se entiende no llega a la base", async () => {
    const { db, rpc } = dobleRpc([]);
    expect(await markMyPortalAvisosSeen(db, "ayer")).toBe(false);
    expect(await markMyPortalAvisosSeen(db, undefined as unknown as string)).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["error de la RPC", "error" as const, "PGRST202"],
    ["excepción", "lanza" as const, "red caída"],
  ])("%s → false y un log sin datos", async (_l, modo, esperado) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { db } = dobleRpc([], modo);
    expect(await markMyPortalAvisosSeen(db, "2026-10-15T14:30:00+00:00")).toBe(false);
    expect(log.mock.calls[0]).toEqual(["[portal-avisos] no se pudo marcar como visto:", esperado]);
  });
});

describe("reglas puras de la bandeja", () => {
  const base = avisoDesdeFila(fila({ id: "base" }))!;
  const aviso = (id: string, sentAt: string, unread = true): PortalAviso => ({ ...base, id, sentAt, unread });

  it("sin leer: lo que la base marcó y es posterior a lo visto en esta pestaña", () => {
    const lista = [
      aviso("n3", "2026-10-15T14:30:00Z"),
      aviso("n2", "2026-10-15T12:00:00Z"),
      aviso("n1", "2026-10-15T10:00:00Z", false),
    ];
    expect(avisosSinLeer(lista, null).map((a) => a.id)).toEqual(["n3", "n2"]);
    expect(avisosSinLeer(lista, "2026-10-15T12:00:00Z").map((a) => a.id)).toEqual(["n3"]);
    expect(avisosSinLeer(lista, "2026-10-15T14:30:00Z")).toEqual([]);
  });

  it("el más reciente no depende del orden de la lista", () => {
    expect(masReciente([])).toBeNull();
    expect(
      masReciente([aviso("a", "2026-10-15T10:00:00Z"), aviso("b", "2026-10-15T14:30:00Z"), aviso("c", "2026-10-14T23:00:00Z")]),
    ).toBe("2026-10-15T14:30:00Z");
  });

  it("contador: nada, el número o 9+", () => {
    expect(contadorVisible(0)).toBeNull();
    expect(contadorVisible(-1)).toBeNull();
    expect(contadorVisible(1)).toBe("1");
    expect(contadorVisible(9)).toBe("9");
    expect(contadorVisible(10)).toBe("9+");
  });

  it("fecha en hora de Venezuela, también al cruzar la medianoche", () => {
    expect(fechaDelAviso("2026-10-16T02:00:00Z")).toBe("15 oct 2026 · 22:00");
    expect(fechaDelAviso("2026-01-01T04:05:00Z")).toBe("1 ene 2026 · 00:05");
    expect(fechaDelAviso("no es fecha")).toBeNull();
  });

  it("etiquetas del evento desde lib/shared, sin el catálogo del Studio", () => {
    expect(etiquetaDelEvento("status:shipped")).toBe("Embarcado");
    expect(etiquetaDelEvento("status:in_warehouse")).toBe("En bodega");
    expect(etiquetaDelEvento("consolidated")).toBe("Consolidado");
    expect(etiquetaDelEvento("eta_set")).toBe("Fecha de llegada");
    expect(etiquetaDelEvento("received_ve")).toBe("En Venezuela");
    expect(etiquetaDelEvento("status:no-existe")).toBe("Actualización");
    expect(etiquetaDelEvento("otro")).toBe("Actualización");
  });

  it("el enlace codifica el código y apunta a la pantalla del ancla", () => {
    expect(hrefDelAviso("compra", "DTD-0001-1-1")).toBe("/portal/compras/DTD-0001-1-1");
    expect(hrefDelAviso("envio", "ENV 1/2")).toBe("/portal/envios/ENV%201%2F2");
  });

  it("el historial de la compra lleva lo mismo que el del envío", () => {
    expect(historialDesdeAviso(base)).toEqual({
      id: "base",
      eventLabel: "Embarcado",
      channel: "email",
      title: base.title,
      body: base.body,
      sentAt: base.sentAt,
    });
  });
});
