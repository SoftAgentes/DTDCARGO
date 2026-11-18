/**
 * SDD-0643 · Lectura de contenedores de una lista de embarques, con un doble
 * de Supabase que SÍ filtra por `.in(...)` y `.is("deleted_at", null)` (un
 * doble que no filtra dejaría pasar la prueba sin mirar nada).
 */
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { leerContenedoresDeEmbarques } from "../embarques-contenedores-queries";

type Fila = Record<string, unknown>;

function doble(tablas: Record<string, Fila[]>, falla?: string) {
  const consultas: { tabla: string; ids: number }[] = [];
  const cliente = {
    from(tabla: string) {
      let filas = [...(tablas[tabla] ?? [])];
      const q = {
        select: () => q,
        in(col: string, vals: string[]) {
          consultas.push({ tabla, ids: vals.length });
          filas = filas.filter((f) => vals.includes(String(f[col])));
          return q;
        },
        is(col: string, val: null) {
          filas = filas.filter((f) => (f[col] ?? null) === val);
          return q;
        },
        order(col: string, o: { ascending: boolean }) {
          filas.sort((a, b) => String(a[col]).localeCompare(String(b[col])) * (o.ascending ? 1 : -1));
          return q;
        },
        then(res: (r: { data: Fila[] | null; error: unknown }) => unknown) {
          return Promise.resolve(
            falla === tabla ? { data: null, error: { message: "x" } } : { data: filas, error: null },
          ).then(res);
        },
      };
      return q;
    },
  };
  return { supabase: cliente as unknown as SupabaseClient, consultas };
}

const TABLAS: Record<string, Fila[]> = {
  consolidation_items: [
    { shipment_id: "s1", consolidation_id: "c-viejo", created_at: "2026-09-01T00:00:00Z" },
    { shipment_id: "s1", consolidation_id: "c64", created_at: "2026-09-29T00:00:00Z" },
    { shipment_id: "s2", consolidation_id: "c64", created_at: "2026-09-29T00:00:00Z" },
    { shipment_id: "s3", consolidation_id: "c-borrado", created_at: "2026-09-29T00:00:00Z" },
    { shipment_id: "otro", consolidation_id: "c64", created_at: "2026-09-29T00:00:00Z" },
  ],
  consolidations: [
    { id: "c64", ref: "DTD-CONSOL-0002", container_no: "ABCU7792550", status: "zarpado",
      notes: "Carga carga-consolidado:64:abcd · contenedor DTD #64 · DDP", sailing_id: "z1",
      created_at: "2026-09-29T00:00:00Z", deleted_at: null },
    { id: "c-viejo", ref: "DTD-CONSOL-0001", container_no: null, status: "arribado", notes: null,
      sailing_id: null, created_at: "2026-09-01T00:00:00Z", deleted_at: null },
    { id: "c-borrado", ref: "DTD-CONSOL-0003", container_no: null, status: "zarpado", notes: null,
      sailing_id: null, created_at: "2026-09-29T00:00:00Z", deleted_at: "2026-10-01T00:00:00Z" },
  ],
  sailings: [{ id: "z1", eta: "2026-12-12", carrier_id: "n1" }],
  carriers: [{ id: "n1", name: "Naviera Uno" }],
};

describe("leerContenedoresDeEmbarques", () => {
  it("la asignación más reciente gana y trae naviera, ETA y número DTD", async () => {
    const { supabase } = doble(TABLAS);
    const r = await leerContenedoresDeEmbarques(supabase, ["s1", "s2", "s3", "s4"]);
    expect(r).not.toBeNull();
    expect(r!.porEmbarque).toEqual({ s1: "c64", s2: "c64" });
    const c64 = r!.contenedores.find((c) => c.id === "c64")!;
    expect(c64).toMatchObject({
      ref: "DTD-CONSOL-0002", containerNo: "ABCU7792550", numeroDtd: 64,
      status: "zarpado", naviera: "Naviera Uno", eta: "2026-12-12",
    });
  });

  it("un contenedor eliminado no agrupa: su embarque queda sin contenedor", async () => {
    const { supabase } = doble(TABLAS);
    const r = await leerContenedoresDeEmbarques(supabase, ["s3"]);
    expect(r!.porEmbarque).toEqual({});
    expect(r!.contenedores.some((c) => c.id === "c-borrado")).toBe(false);
  });

  it("si una lectura falla devuelve null (la vista lo dice)", async () => {
    for (const tabla of ["consolidation_items", "consolidations", "sailings", "carriers"]) {
      const { supabase } = doble(TABLAS, tabla);
      expect(await leerContenedoresDeEmbarques(supabase, ["s1"])).toBeNull();
    }
  });

  it("parte los ids en tramos de 100", async () => {
    const { supabase, consultas } = doble(TABLAS);
    const ids = Array.from({ length: 250 }, (_, i) => `x${i}`);
    await leerContenedoresDeEmbarques(supabase, ids);
    expect(consultas.filter((c) => c.tabla === "consolidation_items").map((c) => c.ids)).toEqual([100, 100, 50]);
  });

  it("sin embarques no consulta nada", async () => {
    const { supabase, consultas } = doble(TABLAS);
    expect(await leerContenedoresDeEmbarques(supabase, [])).toEqual({ contenedores: [], porEmbarque: {} });
    expect(consultas).toHaveLength(0);
  });
});
