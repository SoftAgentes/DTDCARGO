// @vitest-environment node
/**
 * SDD-0673 · lectura de la carga del embarque. Lo que importa: si no se puede
 * leer, `estaEnContenedor` responde que sí (falla cerrado) y la ficha no
 * escribe peso ni CBM por el camino sin motivo.
 */
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { estaEnContenedor, leerCargaDelEmbarque, leerGrupoDelEmbarque } from "@/lib/studio/medidas-embarque-queries";

type Res = { data: unknown; error: { code?: string; message?: string } | null };

/** Doble mínimo: cada tabla devuelve su respuesta al final de la cadena. */
function doble(porTabla: Record<string, Res>): SupabaseClient {
  return {
    from(tabla: string) {
      const res = porTabla[tabla] ?? { data: [], error: null };
      const q: Record<string, unknown> = {};
      for (const m of ["select", "eq", "order", "limit", "in", "is"]) q[m] = () => q;
      q.maybeSingle = async () => res;
      q.then = (ok: (r: Res) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(res).then(ok, ko);
      return q;
    },
  } as unknown as SupabaseClient;
}

const ERROR = { code: "XX000", message: "falla de lectura" };

describe("SDD-0673 · leerCargaDelEmbarque y estaEnContenedor", () => {
  it("si falla la lectura de la línea del contenedor, marca lecturaFallida y estaEnContenedor dice que sí", async () => {
    const db = doble({ consolidation_items: { data: null, error: ERROR } });
    const carga = await leerCargaDelEmbarque(db, "s1");
    expect(carga.enContenedor).toBe(false);
    expect(carga.lecturaFallida).toBe(true);
    expect(await estaEnContenedor(db, "s1")).toBe(true);
  });

  it("si falla la lectura del contenedor, también falla cerrado", async () => {
    const db = doble({
      consolidation_items: { data: [{ consolidation_id: "c1", pieces: 5, cbm: 1.78, weight_kg: 300 }], error: null },
      consolidations: { data: null, error: ERROR },
    });
    expect((await leerCargaDelEmbarque(db, "s1")).lecturaFallida).toBe(true);
    expect(await estaEnContenedor(db, "s1")).toBe(true);
  });

  it("sin líneas de contenedor no está en un contenedor", async () => {
    const db = doble({ consolidation_items: { data: [], error: null } });
    expect(await estaEnContenedor(db, "s1")).toBe(false);
  });

  it("con línea en un contenedor vivo devuelve sus medidas", async () => {
    const db = doble({
      consolidation_items: { data: [{ consolidation_id: "c1", pieces: 5, cbm: "1.780", weight_kg: "300.00" }], error: null },
      consolidations: { data: [{ id: "c1", ref: "DTD-CONSOL-0001", container_no: "ABCU1234567", status: "zarpado" }], error: null },
    });
    const carga = await leerCargaDelEmbarque(db, "s1");
    expect(carga).toMatchObject({ enContenedor: true, cajas: 5, cbm: 1.78, pesoKg: 300 });
    expect(carga.lecturaFallida).toBeUndefined();
  });

  it("el grupo de WeChat: undefined si la columna no existe, null si está vacío", async () => {
    expect(await leerGrupoDelEmbarque(doble({ shipments: { data: null, error: { code: "42703" } } }), "s1")).toBeUndefined();
    expect(await leerGrupoDelEmbarque(doble({ shipments: { data: { group_reference: null }, error: null } }), "s1")).toBeNull();
    expect(await leerGrupoDelEmbarque(doble({ shipments: { data: { group_reference: "Grupo X" }, error: null } }), "s1")).toBe("Grupo X");
  });
});
