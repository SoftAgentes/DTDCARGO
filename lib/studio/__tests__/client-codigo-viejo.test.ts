/**
 * SDD-0664 · Buscar un cliente por un Shipping Mark que ya no es el suyo.
 *
 * Todos los códigos son inventados: `DTD-Z9xx` hace de código de vendedor,
 * `DTD-89xx` de código del legado y `DTD-90xx` de cliente de la casa.
 */
import { describe, expect, it } from "vitest";
import {
  clientesPorCodigoViejo,
  markboxVigenteDeCodigoViejo,
  nucleoDeCodigo,
} from "../client-codigo-viejo";
import { conCodigoAnterior, listClients } from "../client-queries";
import type { Client } from "../client-types";
import { dobleSupabase, type Fila } from "./privacidad-cn-double";

const T_A = "00000000-0000-4000-8000-00000000000a";
const T_B = "00000000-0000-4000-8000-00000000000b";

const cliente = (id: string, markbox: string, over: Fila = {}): Fila => ({
  id,
  tenant_id: T_A,
  markbox,
  name: `Cliente ${id}`,
  rif: null,
  person_id: null,
  merged_into_client_id: null,
  deleted_at: null,
  created_at: "2026-01-01T00:00:00Z",
  ...over,
});
const viejo = (clientId: string, markbox: string, over: Fila = {}): Fila => ({
  id: `h-${markbox}`,
  tenant_id: T_A,
  client_id: clientId,
  markbox,
  retired_at: "2026-08-14T00:00:00Z",
  ...over,
});

type Cadena = { or: (s: string) => Cadena };
type ConFrom = { from: (t: string) => { select: (...a: unknown[]) => Cadena } };

/** El doble no filtra `or`: se anota lo que recibe para afirmar sobre la consulta. */
function conOrAnotado(tablas: Record<string, Fila[]>) {
  const base = dobleSupabase({ tablas }).client as ConFrom;
  const ors: string[] = [];
  const client = {
    from(tabla: string) {
      const q = base.from(tabla);
      return {
        select(...args: unknown[]) {
          const cadena = q.select(...args);
          const original = cadena.or.bind(cadena);
          cadena.or = (s: string) => {
            ors.push(s);
            return original(s);
          };
          return cadena;
        },
      };
    },
  };
  return { client: client as never, ors };
}

const sb = (tablas: Record<string, Fila[]>) => dobleSupabase({ tablas }).client as never;

describe("nucleoDeCodigo", () => {
  it("quita el prefijo DTD, los espacios y los guiones", () => {
    for (const q of ["DTD-Z901", "dtd-z901", "dtd z901", "DTDZ901", " z901 ", "Z-901", "dtd - z901"]) {
      expect(nucleoDeCodigo(q)?.toLowerCase(), q).toBe("z901");
    }
    expect(nucleoDeCodigo("DTD-8901")).toBe("8901");
    expect(nucleoDeCodigo("8901")).toBe("8901");
  });

  it("no trata como código lo que no lo parece", () => {
    for (const q of ["", "  ", "maría pérez", "dtd", "DTD-", "8", "z", "%", "%%8%%", "a_1", "12345678901234567", null, undefined]) {
      expect(nucleoDeCodigo(q as string), String(q)).toBeNull();
    }
  });

  it("los comodines no llegan a la consulta", () => {
    expect(nucleoDeCodigo("*901*")).toBe("901");
    expect(nucleoDeCodigo("(901)")).toBe("901");
  });
});

describe("clientesPorCodigoViejo", () => {
  const tablas = {
    clients: [
      cliente("c1", "DTD-8901"),
      cliente("c2", "DTD-9001"),
      cliente("c3", "DTD-8902"),
    ],
    client_markbox_history: [viejo("c1", "DTD-Z901"), viejo("c3", "DTD-z902")],
  };

  it("un código viejo lleva al cliente que hoy lo reemplaza", async () => {
    const mapa = await clientesPorCodigoViejo(sb(tablas), "DTD-Z901");
    expect([...mapa]).toEqual([["c1", "DTD-Z901"]]);
  });

  it("con o sin «DTD-», con espacio y sin distinguir mayúsculas", async () => {
    for (const q of ["z901", "Z901", "dtd z901", "DTDZ901", "dtd-z901"]) {
      const mapa = await clientesPorCodigoViejo(sb(tablas), q);
      expect([...mapa.keys()], q).toEqual(["c1"]);
    }
    // El historial guardó la letra en minúscula: igual aparece.
    expect([...(await clientesPorCodigoViejo(sb(tablas), "DTD-Z902")).keys()]).toEqual(["c3"]);
  });

  it("por fragmento trae a todos los que coinciden", async () => {
    const mapa = await clientesPorCodigoViejo(sb(tablas), "z90");
    expect([...mapa.keys()].sort()).toEqual(["c1", "c3"]);
  });

  it("un nombre o un texto sin dígitos no consulta nada", async () => {
    const doble = dobleSupabase({ tablas });
    expect((await clientesPorCodigoViejo(doble.client as never, "maría")).size).toBe(0);
    expect((await clientesPorCodigoViejo(doble.client as never, "%")).size).toBe(0);
    expect(doble.lecturas).toEqual([]);
  });

  it("el código vigente del propio cliente no cuenta como viejo", async () => {
    const mapa = await clientesPorCodigoViejo(
      sb({ clients: [cliente("c1", "DTD-8901")], client_markbox_history: [viejo("c1", "DTD-8901")] }),
      "8901",
    );
    expect(mapa.size).toBe(0);
  });

  it("un código viejo de otro tenant no se pega a un cliente de este", async () => {
    const mapa = await clientesPorCodigoViejo(
      sb({
        clients: [cliente("c1", "DTD-8901")],
        // Fila del historial de OTRO tenant que apunta a un cliente de este.
        client_markbox_history: [viejo("c1", "DTD-Z901", { tenant_id: T_B })],
      }),
      "DTD-Z901",
    );
    expect(mapa.size).toBe(0);
  });

  it("un código viejo cuyo cliente no se puede leer no devuelve nada", async () => {
    // Lo que deja la RLS cuando el historial apunta a un cliente de otro tenant.
    const mapa = await clientesPorCodigoViejo(
      sb({ clients: [cliente("c2", "DTD-9001")], client_markbox_history: [viejo("ajeno", "DTD-Z901")] }),
      "DTD-Z901",
    );
    expect(mapa.size).toBe(0);
  });

  describe("fusiones", () => {
    it("el código viejo de una ficha absorbida lleva a la que sobrevive", async () => {
      const mapa = await clientesPorCodigoViejo(
        sb({
          clients: [
            cliente("vivo", "DTD-8901"),
            cliente("tumba", "DTD-9050", {
              merged_into_client_id: "vivo",
              deleted_at: "2026-09-01T00:00:00Z",
            }),
          ],
          client_markbox_history: [viejo("tumba", "DTD-Z901")],
        }),
        "z901",
      );
      expect([...mapa]).toEqual([["vivo", "DTD-Z901"]]);
    });

    it("el código de la propia ficha absorbida también lleva a la viva", async () => {
      const mapa = await clientesPorCodigoViejo(
        sb({
          clients: [
            cliente("vivo", "DTD-8901"),
            cliente("tumba", "DTD-9050", {
              merged_into_client_id: "vivo",
              deleted_at: "2026-09-01T00:00:00Z",
            }),
          ],
          client_markbox_history: [],
        }),
        "DTD-9050",
      );
      expect([...mapa]).toEqual([["vivo", "DTD-9050"]]);
    });

    it("sigue una cadena de dos fusiones", async () => {
      const mapa = await clientesPorCodigoViejo(
        sb({
          clients: [
            cliente("vivo", "DTD-8901"),
            cliente("t2", "DTD-9051", { merged_into_client_id: "vivo", deleted_at: "2026-09-02T00:00:00Z" }),
            cliente("t1", "DTD-9050", { merged_into_client_id: "t2", deleted_at: "2026-09-01T00:00:00Z" }),
          ],
          client_markbox_history: [viejo("t1", "DTD-Z901")],
        }),
        "DTD-Z901",
      );
      expect([...mapa]).toEqual([["vivo", "DTD-Z901"]]);
    });

    it("no llega a un cliente eliminado ni se queda en un ciclo", async () => {
      const eliminado = await clientesPorCodigoViejo(
        sb({
          clients: [cliente("borrado", "DTD-8901", { deleted_at: "2026-09-01T00:00:00Z" })],
          client_markbox_history: [viejo("borrado", "DTD-Z901")],
        }),
        "DTD-Z901",
      );
      expect(eliminado.size).toBe(0);

      const ciclo = await clientesPorCodigoViejo(
        sb({
          clients: [
            cliente("a", "DTD-9050", { merged_into_client_id: "b", deleted_at: "2026-09-01T00:00:00Z" }),
            cliente("b", "DTD-9051", { merged_into_client_id: "a", deleted_at: "2026-09-01T00:00:00Z" }),
          ],
          client_markbox_history: [viejo("a", "DTD-Z901")],
        }),
        "DTD-Z901",
      );
      expect(ciclo.size).toBe(0);
    });
  });

  it("modo exacto: solo ese código, con o sin «DTD-»", async () => {
    const t = {
      clients: [cliente("c1", "DTD-8901"), cliente("c4", "DTD-8904")],
      client_markbox_history: [viejo("c1", "DTD-Z901"), viejo("c4", "DTD-Z9011")],
    };
    expect([...(await clientesPorCodigoViejo(sb(t), "DTD-Z901", "exacto")).keys()]).toEqual(["c1"]);
    expect([...(await clientesPorCodigoViejo(sb(t), "z901", "exacto")).keys()]).toEqual(["c1"]);
    expect((await clientesPorCodigoViejo(sb(t), "z90", "exacto")).size).toBe(0);
    // «contiene» sí trae los dos.
    expect((await clientesPorCodigoViejo(sb(t), "z901")).size).toBe(2);
  });

  it("si la lectura falla, lanza: no devuelve «nada» en silencio", async () => {
    const doble = dobleSupabase({ tablas, fallar: ["client_markbox_history"] });
    await expect(clientesPorCodigoViejo(doble.client as never, "z901")).rejects.toBeTruthy();
  });
});

describe("markboxVigenteDeCodigoViejo", () => {
  const tablas = {
    clients: [cliente("c1", "DTD-8901"), cliente("c2", "DTD-9001")],
    client_markbox_history: [viejo("c1", "DTD-Z901")],
  };

  it("da el Shipping Mark vigente del dueño del código viejo", async () => {
    expect(await markboxVigenteDeCodigoViejo(sb(tablas), "DTD-Z901")).toBe("DTD-8901");
    expect(await markboxVigenteDeCodigoViejo(sb(tablas), "dtd-z901")).toBe("DTD-8901");
  });

  it("un código que nadie tuvo, o solo un fragmento, da null", async () => {
    expect(await markboxVigenteDeCodigoViejo(sb(tablas), "DTD-Z999")).toBeNull();
    expect(await markboxVigenteDeCodigoViejo(sb(tablas), "Z90")).toBeNull();
    expect(await markboxVigenteDeCodigoViejo(sb(tablas), "no-es-un-codigo")).toBeNull();
  });
});

describe("listClients con código viejo", () => {
  const tablas = {
    clients: [cliente("c1", "DTD-8901"), cliente("c2", "DTD-9001")],
    client_markbox_history: [viejo("c1", "DTD-Z901")],
  };

  it("suma a la consulta el cliente del código viejo y lo marca en el resultado", async () => {
    const { client, ors } = conOrAnotado(tablas);
    const lista = await listClients(client, { q: "dtd z901" });
    expect(ors).toHaveLength(1);
    expect(ors[0]).toContain("id.in.(c1)");
    // «dtd z901» también busca el código vigente sin el prefijo ni el espacio.
    expect(ors[0]).toContain("markbox.ilike.%z901%");
    const c1 = lista.find((c) => c.id === "c1");
    expect(c1?.codigo_anterior).toBe("DTD-Z901");
    expect(lista.find((c) => c.id === "c2")?.codigo_anterior).toBeUndefined();
  });

  it("sin coincidencia en el historial, la consulta queda como antes", async () => {
    const { client, ors } = conOrAnotado(tablas);
    await listClients(client, { q: "maría" });
    expect(ors).toHaveLength(1);
    expect(ors[0]).not.toContain("id.in.");
    expect(ors[0].split(",")).toHaveLength(5);
  });

  it("sin texto de búsqueda no toca el historial", async () => {
    const doble = dobleSupabase({ tablas });
    await listClients(doble.client as never, {});
    expect(doble.lecturas).toEqual(["clients"]);
  });

  it("conCodigoAnterior no cambia a quien no apareció por un código viejo", () => {
    const lista = [{ id: "c1" }, { id: "c2" }] as Client[];
    expect(conCodigoAnterior(lista, new Map())).toBe(lista);
    const marcada = conCodigoAnterior(lista, new Map([["c2", "DTD-Z902"]]));
    expect(marcada[0]).toBe(lista[0]);
    expect(marcada[1]).toEqual({ id: "c2", codigo_anterior: "DTD-Z902" });
  });
});
