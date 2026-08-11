/**
 * Tests de la LECTURA del espejo (no de las funciones puras, que ya tienen su
 * suite y siempre estuvieron bien).
 *
 * El bug que fijan: PostgREST corta la respuesta en `db-max-rows` (1000 en
 * Supabase) y un `.limit(5000)` NO lo sortea — devuelve 1000 y no avisa. Como
 * el tablero agrega en JS, eso no daba error: daba números que parecían ciertos.
 * Medido en producción el 2026-08-11: 3.145 leads reales, la pantalla decía
 * "1.000", y el embudo / cementerio / cartera / conversión salían del 32%.
 */
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAnalyticsLeads, getContactEmailFlags } from "../kommo-analytics";

type Call = { table: string; from: number; to: number };

/**
 * Supabase de mentira que imita a PostgREST: nunca devuelve más de
 * `serverMaxRows` filas por request, aunque le pidas un rango mayor.
 */
function fakeSupabase(
  rowsByTable: Record<string, Record<string, unknown>[]>,
  serverMaxRows = 1000,
): { client: SupabaseClient; calls: Call[] } {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      const q = {
        select: () => q,
        order: () => q,
        range: (from: number, to: number) => {
          calls.push({ table, from, to });
          const all = rowsByTable[table] ?? [];
          const requested = to - from + 1;
          const take = Math.min(requested, serverMaxRows);
          return Promise.resolve({ data: all.slice(from, from + take), error: null });
        },
      };
      return q;
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

const leadRows = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    status_id: 142,
    pipeline_id: 14036567,
    price: 1,
    responsible_user_id: 9976747,
    kommo_updated_at: "2026-08-01T00:00:00Z",
  }));

describe("getAnalyticsLeads · lee el espejo COMPLETO", () => {
  it("trae las 3.145 filas de prod pese al tope de 1000 del servidor", async () => {
    const { client } = fakeSupabase({ kommo_leads: leadRows(3145) });
    const { rows, complete } = await getAnalyticsLeads(client);
    expect(rows).toHaveLength(3145);
    expect(complete).toBe(true);
    // Y trae las de verdad, no las primeras repetidas.
    expect(rows[0].id).toBe(1);
    expect(rows[3144].id).toBe(3145);
    expect(new Set(rows.map((r) => r.id)).size).toBe(3145);
  });

  it("el caso borde: EXACTO un múltiplo del tope no se corta antes de tiempo", async () => {
    // 2000 filas con tope 1000: una implementación que corte en "vino menos de
    // lo que pedí" funciona acá, pero una que corte mal se queda en 1000.
    const { client } = fakeSupabase({ kommo_leads: leadRows(2000) });
    const { rows, complete } = await getAnalyticsLeads(client);
    expect(rows).toHaveLength(2000);
    expect(complete).toBe(true);
  });

  it("sobrevive a un tope de servidor MENOR que la página pedida", async () => {
    // Si alguien baja db-max-rows a 300, pedir 1000 devuelve 300. Cortar ahí
    // sería truncar en silencio otra vez — el bug original con otro disfraz.
    const { client, calls } = fakeSupabase({ kommo_leads: leadRows(3145) }, 300);
    const { rows, complete } = await getAnalyticsLeads(client);
    expect(rows).toHaveLength(3145);
    expect(complete).toBe(true);
    expect(calls.length).toBeGreaterThan(10); // avanzó de a 300, no de a 1000
  });

  it("avanza por lo RECIBIDO, sin saltear ni repetir filas", async () => {
    const { client, calls } = fakeSupabase({ kommo_leads: leadRows(2500) }, 400);
    const { rows } = await getAnalyticsLeads(client);
    expect(rows.map((r) => r.id)).toEqual(
      Array.from({ length: 2500 }, (_, i) => i + 1),
    );
    // Cada request arranca DESPUÉS del anterior, nunca antes ni en el mismo
    // sitio (eso repetiría filas) — y la última zancada es corta a propósito,
    // porque la página final trae 100 y el avance es por lo recibido.
    for (let i = 1; i < calls.length; i++) {
      expect(calls[i].from).toBeGreaterThan(calls[i - 1].from);
    }
    expect(calls.at(-1)?.from).toBe(2500); // la vacía arranca justo al final
  });

  it("espejo vacío → cero filas, y completo (no es un error)", async () => {
    const { client } = fakeSupabase({ kommo_leads: [] });
    const { rows, complete } = await getAnalyticsLeads(client);
    expect(rows).toEqual([]);
    expect(complete).toBe(true);
  });

  it("si NO puede leer todo, lo dice: complete=false en vez de subcontar", async () => {
    // 60 páginas × 1000 es el tope de seguridad; 61.000 filas lo pasa.
    const { client } = fakeSupabase({ kommo_leads: leadRows(61_000) });
    const { rows, complete } = await getAnalyticsLeads(client);
    expect(complete).toBe(false);
    expect(rows).toHaveLength(60_000);
  });

  it("propaga el error de la query en vez de devolver una lista corta", async () => {
    const client = {
      from: () => {
        const q = {
          select: () => q,
          order: () => q,
          range: () => Promise.resolve({ data: null, error: { message: "boom" } }),
        };
        return q;
      },
    } as unknown as SupabaseClient;
    await expect(getAnalyticsLeads(client)).rejects.toBeTruthy();
  });
});

describe("getContactEmailFlags · mismo contrato", () => {
  it("trae los 3.161 contactos de prod, no 1.000", async () => {
    const contacts = Array.from({ length: 3161 }, (_, i) => ({
      id: i + 1,
      custom_fields: [],
    }));
    const { client } = fakeSupabase({ kommo_contacts: contacts });
    const { rows, complete } = await getContactEmailFlags(client);
    expect(rows).toHaveLength(3161);
    expect(complete).toBe(true);
  });
});
