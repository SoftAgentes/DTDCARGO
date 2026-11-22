/**
 * SDD-0650 F1 · Los envíos de la ficha salen de TODOS sus códigos.
 *
 * Antes la ficha filtraba los envíos solo por el código vigente, mientras el
 * saldo (0492) ya sumaba el historial (0367) y las fichas fusionadas (0341). En
 * una ficha DTD-8xxx con su código viejo como alias, lo cargado con el código
 * viejo no se veía.
 *
 * El doble APLICA los filtros (`listados-double.ts`). Los fixtures son
 * infelices: hay una ficha de OTRO tenant fusionada «en» la nuestra, una ficha
 * borrada sin fusión, un ciclo de fusiones y un envío borrado con un código de
 * la familia. Cada uno solo queda fuera si el filtro que le toca está.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { listCodigosDeLaFicha, listShipmentsDeLaFicha } from "../client-queries";
import { dobleListados, type Fila } from "./listados-double";

const T = "t1";
const FICHA = { id: "c-vigente", tenant_id: T, markbox: "DTD-8001" };

function cliente(parcial: Fila & { id: string }): Fila {
  return { tenant_id: T, markbox: null, merged_into_client_id: null, deleted_at: null, ...parcial };
}

function envio(parcial: Fila & { id: string; client_markbox: string }): Fila {
  return {
    tenant_id: T,
    code: `ENV-${parcial.id}`,
    origin: "Yiwu",
    destination: "Valencia",
    shipment_service: "consolidado_lcl",
    status: "in_transit",
    created_at: "2026-10-01T00:00:00Z",
    deleted_at: null,
    ...parcial,
  };
}

describe("listCodigosDeLaFicha", () => {
  it("junta el vigente, su historial, las fusionadas (dos saltos) y sus historiales, sin repetir", async () => {
    const { client } = dobleListados({
      clients: [
        cliente({ id: FICHA.id, markbox: FICHA.markbox }),
        cliente({ id: "c-f1", markbox: "DTD-0457", merged_into_client_id: FICHA.id, deleted_at: "2026-09-01T00:00:00Z" }),
        cliente({ id: "c-f2", markbox: "DTD-0300", merged_into_client_id: "c-f1", deleted_at: "2026-08-01T00:00:00Z" }),
        // Borrada sin fusión: no es de la familia.
        cliente({ id: "c-borrada", markbox: "DTD-0999", deleted_at: "2026-09-01T00:00:00Z" }),
        // Otro tenant que apunta a nuestra ficha: la RLS la taparía; el filtro también.
        cliente({ id: "c-ajena", tenant_id: "t2", markbox: "DTD-7777", merged_into_client_id: FICHA.id }),
      ],
      client_markbox_history: [
        { client_id: "c-f2", markbox: "LEG-12" },
        { client_id: "c-otra", markbox: "LEG-99" },
      ],
    });

    const codigos = await listCodigosDeLaFicha(client, FICHA, ["DTD-0457", " DTD-0100 "]);

    expect(codigos).toEqual(["DTD-8001", "DTD-0457", "DTD-0100", "DTD-0300", "LEG-12"]);
  });

  it("sin fusiones ni historial queda solo el vigente y no lee historiales ajenos", async () => {
    const doble = dobleListados({ clients: [cliente({ id: FICHA.id, markbox: FICHA.markbox })] });
    expect(await listCodigosDeLaFicha(doble.client, FICHA, [])).toEqual(["DTD-8001"]);
    expect(doble.filtros.some((f) => f.table === "client_markbox_history")).toBe(false);
  });

  it("un ciclo corto no vuelve a meter la ficha vigente en la frontera", async () => {
    // Ciclo de dos: A está fusionada en la vigente y la vigente «en» A. Bajo el
    // tope, solo `vistos` corta la vuelta: sin él, la vigente regresa a la
    // frontera y la cadena gira hasta los 10 saltos.
    const { client, filtros } = dobleListados({
      clients: [
        cliente({ id: FICHA.id, markbox: FICHA.markbox, merged_into_client_id: "c-a" }),
        cliente({ id: "c-a", markbox: "DTD-0457", merged_into_client_id: FICHA.id }),
      ],
      client_markbox_history: [],
    });

    const codigos = await listCodigosDeLaFicha(client, FICHA, []);

    expect(codigos).toEqual(["DTD-8001", "DTD-0457"]);
    const fronteras = filtros
      .filter((f) => f.table === "clients" && f.op === "in")
      .map((f) => f.val);
    expect(fronteras).toEqual([[FICHA.id], ["c-a"]]);
  });

  it("una cadena larga se corta en 10 saltos", async () => {
    const cadena: Fila[] = [cliente({ id: FICHA.id, markbox: FICHA.markbox })];
    let padre = FICHA.id;
    for (let i = 1; i <= 12; i++) {
      cadena.push(cliente({ id: `c-${i}`, markbox: `DTD-${1000 + i}`, merged_into_client_id: padre }));
      padre = `c-${i}`;
    }
    // Ciclo: la vigente «fusionada» en la última; ya está vista.
    cadena[0] = { ...cadena[0], merged_into_client_id: "c-2" };
    const { client, filtros } = dobleListados({ clients: cadena, client_markbox_history: [] });

    const codigos = await listCodigosDeLaFicha(client, FICHA, []);

    expect(codigos).toHaveLength(11); // vigente + 10 saltos
    expect(codigos).not.toContain("DTD-1011");
    expect(filtros.filter((f) => f.table === "clients" && f.op === "in")).toHaveLength(10);
  });

  it("si la lectura falla, lanza (la ficha decide caer al vigente)", async () => {
    const roto = {
      from: () => ({
        select: () => ({
          eq: () => ({ in: () => Promise.resolve({ data: null, error: new Error("sin red") }) }),
        }),
      }),
    } as unknown as SupabaseClient;
    await expect(listCodigosDeLaFicha(roto, FICHA, [])).rejects.toThrow("sin red");
  });
});

describe("listShipmentsDeLaFicha", () => {
  it("trae los envíos vivos de todos los códigos, con su código, del más reciente al más viejo", async () => {
    const { client } = dobleListados({
      shipments: [
        envio({ id: "1", client_markbox: "DTD-8001", created_at: "2026-10-05T00:00:00Z" }),
        envio({ id: "2", client_markbox: "DTD-0457", created_at: "2026-10-09T00:00:00Z" }),
        // Borrado y más reciente: solo el filtro de eliminados lo deja fuera.
        envio({ id: "3", client_markbox: "DTD-0457", created_at: "2026-10-10T00:00:00Z", deleted_at: "2026-10-11T00:00:00Z" }),
        // Otro cliente.
        envio({ id: "4", client_markbox: "DTD-5555", created_at: "2026-10-12T00:00:00Z" }),
        // Mismo código en otro tenant: solo el filtro de tenant lo deja fuera.
        envio({ id: "5", tenant_id: "t2", client_markbox: "DTD-0457", created_at: "2026-10-13T00:00:00Z" }),
      ],
    }, { proyectar: true });

    const filas = (await listShipmentsDeLaFicha(client, T, ["DTD-8001", "DTD-0457"])) as Fila[];

    expect(filas.map((f) => f.id)).toEqual(["2", "1"]);
    expect(filas[0].client_markbox).toBe("DTD-0457");
  });

  it("sin códigos no consulta", async () => {
    const doble = dobleListados({ shipments: [envio({ id: "1", client_markbox: "DTD-8001" })] });
    expect(await listShipmentsDeLaFicha(doble.client, T, [])).toEqual([]);
    expect(doble.filtros).toHaveLength(0);
  });
});
