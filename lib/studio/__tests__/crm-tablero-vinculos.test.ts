// @vitest-environment node
/**
 * SDD-0676 · El tablero del CRM con chats vinculados.
 *
 *  - Una tarjeta ABSORBIDA (la del lead cuyo chat se vinculó a un cliente) no se pinta.
 *  - La tarjeta del cliente lleva, además del logo de su fuente, el de los otros canales
 *    vinculados a su ficha.
 *  - Sin la migración (la columna no existe) o si la lectura de las uniones falla, el
 *    tablero sale igual, sin logos extra.
 *
 * El doble de Supabase FILTRA de verdad (`is`, `in`, `eq`): los canales de otra ficha no
 * se le pegan a esta.
 */
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { canalesExtraDe, canalesVinculados, cargarTableroCrm } from "@/lib/studio/crm-tablero-queries";

type Fila = Record<string, unknown>;
type Err = { code: string; message: string } | null;

const AHORA = Date.parse("2026-11-18T12:00:00.000Z");
const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const FICHA_A = ID(101);
const FICHA_B = ID(102);

function doble(
  tablas: Record<string, Fila[]>,
  opciones: { sinColumnaAbsorbida?: boolean; errorUniones?: Err } = {},
) {
  const consultas: { tabla: string; filtros: string[] }[] = [];
  const client = {
    from(tabla: string) {
      let filas = [...(tablas[tabla] ?? [])];
      let desde = 0;
      let hasta = Number.POSITIVE_INFINITY;
      let tope = Number.POSITIVE_INFINITY;
      const registro = { tabla, filtros: [] as string[] };
      consultas.push(registro);
      const q = {
        select: () => q,
        order: () => q,
        is: (col: string, v: unknown) => {
          registro.filtros.push(`is:${col}`);
          filas = filas.filter((f) => (f[col] ?? null) === v);
          return q;
        },
        eq: (col: string, v: unknown) => {
          registro.filtros.push(`eq:${col}`);
          filas = filas.filter((f) => f[col] === v);
          return q;
        },
        in: (col: string, vs: unknown[]) => {
          registro.filtros.push(`in:${col}`);
          filas = filas.filter((f) => vs.includes(f[col]));
          return q;
        },
        limit: (n: number) => {
          tope = n;
          return q;
        },
        range: (a: number, b: number) => {
          desde = a;
          hasta = b;
          return q;
        },
        then: (res: (r: { data: Fila[] | null; error: Err }) => unknown) => {
          let error: Err = null;
          if (tabla === "crm_tarjetas" && opciones.sinColumnaAbsorbida && registro.filtros.includes("is:absorbida_en")) {
            error = { code: "42703", message: "column crm_tarjetas.absorbida_en does not exist" };
          }
          if (tabla === "chatwoot_contact_links" && opciones.errorUniones) error = opciones.errorUniones;
          const data = error ? null : filas.slice(desde, Math.min(hasta + 1, desde + tope));
          return Promise.resolve(res({ data, error }));
        },
      };
      return q;
    },
    async rpc(_nombre: string, args: { p_tarjeta_ids: string[] }) {
      return {
        data: args.p_tarjeta_ids.map((id) => ({ tarjeta_id: id, segmento: id === ID(1) ? "cliente" : "lead_nuevo" })),
        error: null,
      };
    },
  };
  return { client: client as unknown as SupabaseClient, consultas };
}

const ETAPAS: Fila[] = [
  { tablero: "leads", clave: "nuevo", nombre: "Nuevo", orden: 10, terminal: false, sistema: true, activa: true },
  { tablero: "clientes", clave: "activo", nombre: "Activo", orden: 10, terminal: false, sistema: true, activa: true },
];

function tarjeta(n: number, over: Fila = {}): Fila {
  return {
    id: ID(n),
    client_id: null,
    nombre_visible: `Lead ${n}`,
    etapa_leads: "nuevo",
    etapa_leads_at: "2026-11-01T12:00:00.000Z",
    etapa_clientes: "activo",
    etapa_clientes_at: "2026-11-01T12:00:00.000Z",
    asesor_id: null,
    fuente: "instagram",
    utm_source: null,
    ultima_actividad_at: "2026-11-01T12:00:00.000Z",
    anonimizada_at: null,
    absorbida_en: null,
    ...over,
  };
}

function tablas(): Record<string, Fila[]> {
  return {
    crm_etapas: ETAPAS,
    crm_tarjetas: [
      // 1: la del cliente A (entró por WhatsApp). 2: el lead de Instagram que A absorbió. 3: un lead suelto.
      tarjeta(1, { client_id: FICHA_A, nombre_visible: null, fuente: "whatsapp_clientes" }),
      tarjeta(2, { absorbida_en: ID(1), nombre_visible: "Lead absorbido" }),
      tarjeta(3, { nombre_visible: "Lead suelto" }),
    ],
    clients: [
      { id: FICHA_A, name: "SINT Cliente A", markbox: "DTD-0001", deleted_at: null },
      { id: FICHA_B, name: "SINT Cliente B", markbox: "DTD-0002", deleted_at: null },
    ],
    chatwoot_contact_links: [
      { client_id: FICHA_A, chatwoot_contact_id: 10, canal_chat: "whatsapp" },
      { client_id: FICHA_A, chatwoot_contact_id: 11, canal_chat: "instagram" },
      { client_id: FICHA_A, chatwoot_contact_id: 12, canal_chat: null },
      { client_id: FICHA_A, chatwoot_contact_id: 13, canal_chat: "otro" },
      // De OTRA ficha: no se le pega a A.
      { client_id: FICHA_B, chatwoot_contact_id: 20, canal_chat: "messenger" },
    ],
    crm_historial_etapas: [],
    crm_tareas: [],
  };
}

describe("cargarTableroCrm con chats vinculados", () => {
  it("la tarjeta absorbida no se pinta; la del cliente y la del lead suelto, sí", async () => {
    const d = doble(tablas());
    const r = await cargarTableroCrm(d.client, { asesores: new Map(), ahoraMs: AHORA });
    if (!r.ok) throw new Error("el tablero no cargó");
    expect(r.tarjetas.map((t) => t.id).sort()).toEqual([ID(1), ID(3)]);
    expect(r.tarjetas.some((t) => t.nombre === "Lead absorbido")).toBe(false);
    // La absorbida no cuenta como «oculta por ficha borrada».
    expect(r.ocultas).toBe(0);
  });

  it("la tarjeta del cliente lleva el logo de los otros canales vinculados, sin repetir el suyo ni tomar los de otra ficha", async () => {
    const d = doble(tablas());
    const r = await cargarTableroCrm(d.client, { asesores: new Map(), ahoraMs: AHORA });
    if (!r.ok) throw new Error("el tablero no cargó");
    const cliente = r.tarjetas.find((t) => t.id === ID(1));
    // Su fuente es WhatsApp: el extra es Instagram. «otro» y nulo no llevan logo; Messenger es de la ficha B.
    expect(cliente?.canalesExtra).toEqual(["instagram"]);
    // Un lead sin ficha no lleva extras (el campo ni viaja).
    expect(r.tarjetas.find((t) => t.id === ID(3))).not.toHaveProperty("canalesExtra");
    // Las uniones se piden SOLO de las fichas del tablero.
    expect(d.consultas.find((c) => c.tabla === "chatwoot_contact_links")?.filtros).toEqual(["in:client_id"]);
  });

  it("sin la migración (42703 en absorbida_en) el tablero se lee como antes", async () => {
    const d = doble(tablas(), { sinColumnaAbsorbida: true });
    const r = await cargarTableroCrm(d.client, { asesores: new Map(), ahoraMs: AHORA });
    if (!r.ok) throw new Error("el tablero no cargó");
    // Sin la columna no hay absorbidas que esconder: salen las tres filas.
    expect(r.tarjetas).toHaveLength(3);
    expect(d.consultas.filter((c) => c.tabla === "crm_tarjetas").map((c) => c.filtros)).toEqual([
      ["is:anonimizada_at", "is:absorbida_en"],
      ["is:anonimizada_at"],
    ]);
  });

  it("si la lectura de las uniones falla, el tablero sale igual, sin logos extra", async () => {
    const d = doble(tablas(), { errorUniones: { code: "42703", message: "column canal_chat does not exist" } });
    const r = await cargarTableroCrm(d.client, { asesores: new Map(), ahoraMs: AHORA });
    if (!r.ok) throw new Error("el tablero no cargó");
    expect(r.tarjetas.map((t) => t.id).sort()).toEqual([ID(1), ID(3)]);
    expect(r.tarjetas.every((t) => t.canalesExtra === undefined)).toBe(true);
  });
});

describe("canalesVinculados y canalesExtraDe", () => {
  it("sin fichas no consulta", async () => {
    const d = doble(tablas());
    expect((await canalesVinculados(d.client, [])).size).toBe(0);
    expect(d.consultas).toEqual([]);
  });

  it("agrupa por ficha y traduce al logo del CRM (Messenger → Facebook)", async () => {
    const d = doble(tablas());
    const m = await canalesVinculados(d.client, [FICHA_A, FICHA_B]);
    expect([...(m.get(FICHA_A) ?? [])].sort()).toEqual(["instagram", "whatsapp"]);
    expect([...(m.get(FICHA_B) ?? [])]).toEqual(["facebook"]);
  });

  it("canalesExtraDe quita el canal propio y ordena", () => {
    expect(canalesExtraDe("whatsapp", new Set(["whatsapp", "tiktok", "instagram"] as const))).toEqual(["instagram", "tiktok"]);
    expect(canalesExtraDe(null, new Set(["instagram"] as const))).toEqual(["instagram"]);
    expect(canalesExtraDe("instagram", undefined)).toEqual([]);
  });
});
