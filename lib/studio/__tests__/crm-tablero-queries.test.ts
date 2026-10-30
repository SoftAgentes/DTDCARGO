// @vitest-environment node
/**
 * Lectura del tablero del CRM propio (SDD-0587 · 6.3).
 *
 * El doble aplica de verdad los filtros (`is`, `in`, `eq`, `range`): un doble
 * que no filtra no prueba el filtro. Lo que se fija:
 *  - una tarjeta cuya ficha está borrada en suave no se pinta (pendiente de 6.2);
 *  - una anonimizada tampoco;
 *  - el tablero sale del segmento de la RPC y el rastro del historial;
 *  - sin la 0506 la pantalla lo dice en vez de romperse.
 * Fixtures sin datos personales: nombres de prueba y códigos inventados.
 */
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  cargarTableroCrm,
  esModeloAusente,
  rastrosDesdeHistorial,
  separarVisibles,
} from "@/lib/studio/crm-tablero-queries";

type Fila = Record<string, unknown>;
type Err = { code: string; message: string } | null;

const AHORA = Date.parse("2026-10-30T12:00:00.000Z");
const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

function doble(
  tablas: Record<string, Fila[]>,
  segmentos: Record<string, string>,
  errores: { tabla?: Record<string, Err>; rpc?: Err } = {},
) {
  const rpcLlamadas: unknown[] = [];
  const client = {
    from(tabla: string) {
      let filas = [...(tablas[tabla] ?? [])];
      let desde = 0;
      let hasta = Number.POSITIVE_INFINITY;
      let tope = Number.POSITIVE_INFINITY;
      const q = {
        select: () => q,
        order: () => q,
        is: (col: string, v: unknown) => {
          filas = filas.filter((f) => (f[col] ?? null) === v);
          return q;
        },
        eq: (col: string, v: unknown) => {
          filas = filas.filter((f) => f[col] === v);
          return q;
        },
        in: (col: string, vs: unknown[]) => {
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
          const error = errores.tabla?.[tabla] ?? null;
          const data = error ? null : filas.slice(desde, Math.min(hasta + 1, desde + tope));
          return Promise.resolve(res({ data, error }));
        },
      };
      return q;
    },
    async rpc(nombre: string, args: { p_tarjeta_ids: string[] }) {
      rpcLlamadas.push({ nombre, args });
      if (errores.rpc) return { data: null, error: errores.rpc };
      return {
        data: args.p_tarjeta_ids.map((id) => ({ tarjeta_id: id, segmento: segmentos[id] ?? "lead_nuevo" })),
        error: null,
      };
    },
  };
  return { client: client as unknown as SupabaseClient, rpcLlamadas };
}

const ETAPAS: Fila[] = [
  { tablero: "leads", clave: "nuevo", nombre: "Nuevo", orden: 10, terminal: false, sistema: true, activa: true },
  { tablero: "leads", clave: "registrado_recontacto", nombre: "Registrado / recontacto", orden: 30, terminal: false, sistema: true, activa: true },
  { tablero: "leads", clave: "aceptado_esperando_carga", nombre: "Aceptado, esperando carga", orden: 60, terminal: false, sistema: true, activa: true },
  { tablero: "clientes", clave: "activo", nombre: "Activo", orden: 10, terminal: false, sistema: true, activa: true },
];

function tarjeta(n: number, over: Fila = {}): Fila {
  return {
    id: ID(n),
    client_id: null,
    nombre_visible: `Lead ${n}`,
    etapa_leads: "nuevo",
    etapa_leads_at: "2026-10-01T12:00:00.000Z",
    etapa_clientes: "activo",
    etapa_clientes_at: "2026-10-01T12:00:00.000Z",
    asesor_id: null,
    fuente: "manual",
    ultima_actividad_at: "2026-10-01T12:00:00.000Z",
    anonimizada_at: null,
    ...over,
  };
}

describe("separarVisibles", () => {
  it("esconde la tarjeta de una ficha borrada en suave o que no volvió, y deja las sin ficha", () => {
    const fichas = new Map([
      ["c-viva", { id: "c-viva", name: "Ficha", markbox: "DTD-0001", deleted_at: null }],
      ["c-borrada", { id: "c-borrada", name: "Ficha", markbox: "DTD-0002", deleted_at: "2026-10-02T00:00:00Z" }],
    ]);
    const { visibles, ocultas } = separarVisibles(
      [{ client_id: null }, { client_id: "c-viva" }, { client_id: "c-borrada" }, { client_id: "c-purgada" }],
      fichas,
    );
    expect(visibles).toEqual([{ client_id: null }, { client_id: "c-viva" }]);
    expect(ocultas).toBe(2);
  });
});

describe("rastrosDesdeHistorial", () => {
  it("guarda el último movimiento en Clientes y si tuvo alguno en Leads", () => {
    const r = rastrosDesdeHistorial([
      { tarjeta_id: "a", tablero: "clientes", ocurrio_at: "2026-10-05T00:00:00+00:00" },
      { tarjeta_id: "a", tablero: "clientes", ocurrio_at: "2026-10-09T00:00:00.000Z" },
      { tarjeta_id: "a", tablero: "clientes", ocurrio_at: "2026-10-07T00:00:00Z" },
      { tarjeta_id: "b", tablero: "leads", ocurrio_at: "2026-10-05T00:00:00Z" },
    ]);
    expect(r.get("a")).toEqual({ clientesAt: "2026-10-09T00:00:00.000Z", enLeads: false });
    expect(r.get("b")).toEqual({ clientesAt: null, enLeads: true });
  });
});

describe("esModeloAusente", () => {
  it.each(["42P01", "42883", "PGRST205", "PGRST202"])("%s = falta la 0506", (code) => {
    expect(esModeloAusente({ code })).toBe(true);
  });
  it("otro error no es «falta la migración»", () => {
    expect(esModeloAusente({ code: "42501" })).toBe(false);
    expect(esModeloAusente(null)).toBe(false);
  });
});

describe("cargarTableroCrm", () => {
  const asesores = new Map([[ID(900), "Asesora de prueba"]]);

  it("ubica cada tarjeta, esconde fichas borradas y anonimizadas, y cuenta tareas vencidas", async () => {
    const { client, rpcLlamadas } = doble(
      {
        crm_etapas: ETAPAS,
        crm_tarjetas: [
          tarjeta(1),
          tarjeta(2, { client_id: "c-viva", nombre_visible: null, asesor_id: ID(900), etapa_leads: "aceptado_esperando_carga" }),
          tarjeta(3, { client_id: "c-borrada", nombre_visible: null }),
          tarjeta(4, { anonimizada_at: "2026-09-01T00:00:00Z", nombre_visible: null }),
          tarjeta(5, { client_id: "c-vuelta", nombre_visible: null, etapa_leads: "aceptado_esperando_carga" }),
        ],
        clients: [
          { id: "c-viva", name: "Cliente de prueba", markbox: "DTD-0101", deleted_at: null },
          { id: "c-borrada", name: "Otro de prueba", markbox: "DTD-0102", deleted_at: "2026-10-03T00:00:00Z" },
          { id: "c-vuelta", name: "Vuelve de prueba", markbox: "DTD-0103", deleted_at: null },
        ],
        crm_historial_etapas: [
          { id: 1, tarjeta_id: ID(2), tablero: "leads", ocurrio_at: "2026-10-02T00:00:00Z" },
          { id: 2, tarjeta_id: ID(5), tablero: "clientes", ocurrio_at: "2026-10-20T00:00:00Z" },
        ],
        crm_tareas: [
          { id: "k1", tarjeta_id: ID(1), vence_at: "2026-10-29T13:00:00Z", completada_at: null },
          { id: "k2", tarjeta_id: ID(1), vence_at: "2026-11-02T13:00:00Z", completada_at: null },
          { id: "k3", tarjeta_id: ID(1), vence_at: "2026-10-01T13:00:00Z", completada_at: "2026-10-02T00:00:00Z" },
        ],
      },
      { [ID(2)]: "cliente", [ID(5)]: "lead_registrado" },
    );

    const r = await cargarTableroCrm(client, { asesores, ahoraMs: AHORA });
    if (!r.ok) throw new Error("debía cargar");

    expect(r.ocultas).toBe(1);
    expect(r.tarjetas.map((t) => t.id)).toEqual([ID(1), ID(2), ID(5)]);
    // La RPC no recibe las escondidas.
    expect(rpcLlamadas).toEqual([
      { nombre: "crm_segmento_tarjetas", args: { p_tarjeta_ids: [ID(1), ID(2), ID(5)] } },
    ]);

    const [uno, dos, cinco] = r.tarjetas;
    expect(uno).toMatchObject({ tablero: "leads", etapa: "nuevo", tareasAbiertas: 2, tareasVencidas: 1, nombre: "Lead 1" });
    expect(dos).toMatchObject({
      tablero: "clientes",
      etapa: "activo",
      nombre: "Cliente de prueba",
      shippingMark: "DTD-0101",
      asesorNombre: "Asesora de prueba",
      origen: { tablero: "leads", etapa: "aceptado_esperando_carga", vuelta: false },
    });
    expect(cinco).toMatchObject({
      tablero: "leads",
      etapa: "registrado_recontacto",
      origen: { tablero: "clientes", etapa: "activo", vuelta: true },
      diasEnEtapa: 10,
    });
  });

  it("sin la 0506 responde «sin_modelo»", async () => {
    const { client } = doble({}, {}, {
      tabla: { crm_etapas: { code: "PGRST205", message: "Could not find the table" } },
    });
    expect(await cargarTableroCrm(client, { asesores })).toEqual({ ok: false, motivo: "sin_modelo" });
  });

  it("un error de permisos en la RPC es «error», no «sin_modelo»", async () => {
    const { client } = doble(
      { crm_etapas: ETAPAS, crm_tarjetas: [tarjeta(1)] },
      {},
      { rpc: { code: "42501", message: "sin acceso al CRM" } },
    );
    expect(await cargarTableroCrm(client, { asesores })).toEqual({ ok: false, motivo: "error" });
  });
});
