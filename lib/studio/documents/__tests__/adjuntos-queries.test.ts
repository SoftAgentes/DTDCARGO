// @vitest-environment node
/**
 * SDD-0507 · Las lecturas de «adjuntos visibles».
 *
 * El doble de PostgREST de este archivo FILTRA de verdad: aplica `.eq`, `.is`,
 * `.in`, `.order` y `.range`, recorta cada respuesta al tope del servidor,
 * rechaza columnas que la tabla no tiene, exige `.select()` antes de filtrar y
 * `.order()` antes de paginar, y devuelve copias. Un doble que no filtra deja
 * verde un conteo que no filtra (memoria «Doble que no filtra no prueba el
 * filtro»).
 *
 * La RLS se simula con `visible`: lo que el doble no devuelve, el código no lo
 * puede contar. Así se prueba que el módulo no «amplía» por su cuenta.
 */
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  IDS_POR_LOTE_ADJUNTOS,
  contarAdjuntosDeClientes,
  contarAdjuntosDeEmbarques,
  listarAdjuntosDelCliente,
} from "../adjuntos-queries";

type Row = Record<string, unknown>;
type Tablas = Record<string, Row[]>;

const COLUMNAS: Record<string, string[]> = {
  documents: [
    "id", "tenant_id", "entity_type", "entity_id", "name", "doc_type", "folder",
    "content_type", "size_bytes", "storage_path", "created_at", "version_no",
    "is_current", "deleted_at",
  ],
  shipment_documents: [
    "id", "tenant_id", "shipment_id", "doc_type", "file_name", "content_type",
    "size_bytes", "storage_path", "created_at", "deleted_at",
  ],
  shipments: ["id", "tenant_id", "code", "origin", "destination", "client_markbox", "deleted_at"],
};

type Llamada = { tabla: string; inLargo: number; from: number; to: number };

function doble(
  tablas: Tablas,
  opts: {
    tope?: number;
    visible?: (tabla: string, row: Row) => boolean;
    falla?: (tabla: string) => boolean;
  } = {},
) {
  const tope = opts.tope ?? 1000;
  const llamadas: Llamada[] = [];
  const client = {
    from(tabla: string) {
      if (!COLUMNAS[tabla]) throw new Error(`tabla desconocida: ${tabla}`);
      return {
        select(cols: string) {
          const pedidas = cols.split(",").map((c) => c.trim());
          for (const c of pedidas) {
            if (!COLUMNAS[tabla].includes(c)) throw new Error(`42703: ${tabla}.${c} no existe`);
          }
          const filtros: ((r: Row) => boolean)[] = [];
          let orden: string | null = null;
          let inLargo = 0;
          const q = {
            eq(col: string, val: unknown) {
              filtros.push((r) => r[col] === val);
              return q;
            },
            is(col: string, val: null) {
              filtros.push((r) => (r[col] ?? null) === val);
              return q;
            },
            in(col: string, vals: readonly unknown[]) {
              // El filtro viaja en la URL: con lotes de más de ~200 UUID se
              // pasa de 8 KB, que es donde un gateway corta con 414.
              const url = vals.map(String).join(",").length;
              if (url > 8000) throw new Error(`414: in.(${vals.length}) arma ${url} bytes de URL`);
              inLargo = vals.length;
              const set = new Set(vals);
              filtros.push((r) => set.has(r[col]));
              return q;
            },
            order(col: string, o?: { ascending?: boolean }) {
              orden = col;
              if (o?.ascending === false) throw new Error("el doble sólo ordena ascendente");
              return q;
            },
            range(from: number, to: number) {
              if (!orden) throw new Error("paginar sin .order() repite o saltea filas");
              llamadas.push({ tabla, inLargo, from, to });
              if (opts.falla?.(tabla)) {
                return Promise.resolve({ data: null, error: { message: "boom" } });
              }
              const col = orden;
              const filas = (tablas[tabla] ?? [])
                .filter((r) => opts.visible?.(tabla, r) ?? true)
                .filter((r) => filtros.every((f) => f(r)))
                .sort((a, b) => String(a[col]).localeCompare(String(b[col])));
              const pagina = filas
                .slice(from, from + Math.min(to - from + 1, tope))
                .map((r) => Object.fromEntries(pedidas.map((c) => [c, r[c] ?? null])));
              return Promise.resolve({ data: structuredClone(pagina), error: null });
            },
          };
          return q;
        },
      };
    },
  } as unknown as SupabaseClient;
  return { client, llamadas };
}

// ── Fixture ──────────────────────────────────────────────────────────────

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const T = uuid(1);
let seq = 1000;
const nid = () => uuid(++seq);

function docHub(entity_type: string, entity_id: string, extra: Row = {}): Row {
  const id = nid();
  return {
    id, tenant_id: T, entity_type, entity_id, name: `doc ${id.slice(-4)}`, doc_type: null,
    folder: "op-kyc", content_type: "application/pdf", size_bytes: 1000,
    storage_path: `${T}/${entity_type}/${entity_id}/${id}.pdf`,
    created_at: `2026-10-${String((seq % 27) + 1).padStart(2, "0")}T10:00:00Z`,
    version_no: 1, is_current: true, deleted_at: null, ...extra,
  };
}

function docPortal(shipment_id: string, extra: Row = {}): Row {
  const id = nid();
  return {
    id, tenant_id: T, shipment_id, doc_type: "bl", file_name: `bl ${id.slice(-4)}.pdf`,
    content_type: "application/pdf", size_bytes: 2000,
    storage_path: `${T}/${shipment_id}/${id}.pdf`,
    created_at: `2026-10-${String((seq % 27) + 1).padStart(2, "0")}T12:00:00Z`,
    deleted_at: null, ...extra,
  };
}

function embarque(markbox: string, extra: Row = {}): Row {
  const id = nid();
  return {
    id, tenant_id: T, code: `S-2026-${id.slice(-4)}`, origin: "Yiwu",
    destination: "Valencia", client_markbox: markbox, deleted_at: null, ...extra,
  };
}

// ── Embarques ────────────────────────────────────────────────────────────

describe("contarAdjuntosDeEmbarques", () => {
  it("cuenta internos y portal, y deja fuera lo que las fichas no muestran", async () => {
    const s1 = embarque("DTD-0001");
    const s2 = embarque("DTD-0001");
    const id1 = s1.id as string;
    const tablas: Tablas = {
      shipments: [s1, s2],
      documents: [
        docHub("shipment", id1),
        docHub("shipment", id1),
        docHub("shipment", id1, { is_current: false }), // versión vieja
        docHub("shipment", id1, { deleted_at: "2026-10-01T00:00:00Z" }), // borrado
        docHub("invoice", id1), // otra entidad con el mismo id
      ],
      shipment_documents: [
        docPortal(id1),
        docPortal(id1, { deleted_at: "2026-10-01T00:00:00Z" }),
      ],
    };
    const { client } = doble(tablas);
    const conteos = await contarAdjuntosDeEmbarques(client, [id1, s2.id as string]);
    expect(conteos?.get(id1)).toEqual({ internos: 2, portal: 1, total: 3 });
    // Sin adjuntos también tiene entrada: el que pinta no confunde «cero» con
    // «no se pudo contar».
    expect(conteos?.get(s2.id as string)).toEqual({ internos: 0, portal: 0, total: 0 });
    expect(conteos?.size).toBe(2);
  });

  it("sin ids no consulta nada y devuelve un mapa vacío", async () => {
    const { client, llamadas } = doble({ shipments: [], documents: [], shipment_documents: [] });
    expect(await contarAdjuntosDeEmbarques(client, [])).toEqual(new Map());
    expect(llamadas).toHaveLength(0);
  });

  it("lee más allá del tope del servidor: 2.500 documentos son 2.500", async () => {
    const s = embarque("DTD-0002");
    const sid = s.id as string;
    const documents = Array.from({ length: 2500 }, () => docHub("shipment", sid));
    for (const tope of [1000, 300]) {
      const { client } = doble({ shipments: [s], documents, shipment_documents: [] }, { tope });
      const conteos = await contarAdjuntosDeEmbarques(client, [sid]);
      expect(conteos?.get(sid)?.total).toBe(2500);
    }
  });

  it("si no pudo leer todo (más de 60 páginas), null en vez de un número corto", async () => {
    // Con un servidor que devuelve 1 fila por página, 61 filas agotan el
    // cortacircuitos de `fetchAllPaged` (60 páginas) y la lectura queda
    // incompleta. Contar 60 sería mentir con cara de verdad.
    const s = embarque("DTD-0005");
    const sid = s.id as string;
    const documents = Array.from({ length: 61 }, () => docHub("shipment", sid));
    const { client } = doble({ shipments: [s], documents, shipment_documents: [] }, { tope: 1 });
    expect(await contarAdjuntosDeEmbarques(client, [sid])).toBeNull();
  });

  it("parte la lista de ids en lotes que caben en una URL", async () => {
    const embarques = Array.from({ length: 250 }, () => embarque("DTD-0003"));
    const documents = embarques.map((e) => docHub("shipment", e.id as string));
    const { client, llamadas } = doble({ shipments: embarques, documents, shipment_documents: [] });
    const conteos = await contarAdjuntosDeEmbarques(
      client,
      embarques.map((e) => e.id as string),
    );
    expect([...conteos!.values()].every((c) => c.total === 1)).toBe(true);
    expect(Math.max(...llamadas.map((l) => l.inLargo))).toBeLessThanOrEqual(IDS_POR_LOTE_ADJUNTOS);
  });

  it("si una lectura falla, devuelve null (no un conteo corto)", async () => {
    const s = embarque("DTD-0004");
    const { client } = doble(
      { shipments: [s], documents: [docHub("shipment", s.id as string)], shipment_documents: [] },
      { falla: (t) => t === "shipment_documents" },
    );
    expect(await contarAdjuntosDeEmbarques(client, [s.id as string])).toBeNull();
  });
});

// ── Clientes y «Todos los adjuntos» ──────────────────────────────────────

/** Cliente con ficha, dos embarques vivos, uno eliminado y un vecino. */
function escenario() {
  const ana = { id: nid(), markbox: "DTD-0100" };
  const beto = { id: nid(), markbox: "DTD-0101" };
  const a1 = embarque(ana.markbox);
  const a2 = embarque(ana.markbox);
  const aBorrado = embarque(ana.markbox, { deleted_at: "2026-09-30T00:00:00Z" });
  const b1 = embarque(beto.markbox);
  const tablas: Tablas = {
    shipments: [a1, a2, aBorrado, b1],
    documents: [
      docHub("client", ana.id),
      docHub("client", ana.id),
      docHub("client", ana.id, { is_current: false }),
      docHub("client", beto.id),
      docHub("shipment", a1.id as string),
      docHub("shipment", aBorrado.id as string), // embarque eliminado: no suma
      docHub("shipment", b1.id as string),
    ],
    shipment_documents: [
      docPortal(a1.id as string),
      docPortal(a2.id as string),
      docPortal(aBorrado.id as string), // embarque eliminado: no suma
      docPortal(b1.id as string, { deleted_at: "2026-10-02T00:00:00Z" }),
    ],
  };
  return { ana, beto, a1, a2, aBorrado, b1, tablas };
}

describe("contarAdjuntosDeClientes", () => {
  it("suma la ficha y los embarques vivos, sin los del vecino", async () => {
    const { ana, beto, tablas } = escenario();
    const { client } = doble(tablas);
    const conteos = await contarAdjuntosDeClientes(client, [ana, beto]);
    expect(conteos?.get(ana.id)).toEqual({ ficha: 2, internosEmbarques: 1, portal: 2, total: 5 });
    expect(conteos?.get(beto.id)).toEqual({ ficha: 1, internosEmbarques: 1, portal: 0, total: 2 });
  });

  it("un cliente sin nada tiene su cero", async () => {
    const solo = { id: nid(), markbox: "DTD-0999" };
    const { client } = doble({ shipments: [], documents: [], shipment_documents: [] });
    const conteos = await contarAdjuntosDeClientes(client, [solo]);
    expect(conteos?.get(solo.id)).toEqual({ ficha: 0, internosEmbarques: 0, portal: 0, total: 0 });
  });

  it("lo que la RLS oculta no se cuenta: sin `tracking`, sólo la ficha", async () => {
    const { ana, tablas } = escenario();
    // Un rol con `clients` y sin `tracking`: la policy de documents y la de
    // shipment_documents le niegan los documentos de embarque.
    const sinTracking = (tabla: string, r: Row) =>
      tabla === "shipment_documents" ? false : tabla !== "documents" || r.entity_type !== "shipment";
    const { client } = doble(tablas, { visible: sinTracking });
    const conteos = await contarAdjuntosDeClientes(client, [ana]);
    expect(conteos?.get(ana.id)).toEqual({ ficha: 2, internosEmbarques: 0, portal: 0, total: 2 });
    const lista = await listarAdjuntosDelCliente(client, ana);
    expect(lista?.total).toBe(2);
  });

  it("si falla cualquier lectura, null", async () => {
    const { ana, tablas } = escenario();
    for (const tabla of ["documents", "shipments", "shipment_documents"]) {
      const { client } = doble(tablas, { falla: (t) => t === tabla });
      expect(await contarAdjuntosDeClientes(client, [ana])).toBeNull();
      expect(await listarAdjuntosDelCliente(client, ana)).toBeNull();
    }
  });
});

describe("listarAdjuntosDelCliente", () => {
  it("agrupa por origen: primero la ficha, después cada embarque vivo con lo suyo", async () => {
    const { ana, a1, a2, tablas } = escenario();
    const { client } = doble(tablas);
    const r = await listarAdjuntosDelCliente(client, ana);
    expect(r?.total).toBe(5);
    expect(r?.grupos[0].origen).toBe("cliente");
    expect(r?.grupos[0].adjuntos).toHaveLength(2);
    const porEmbarque = Object.fromEntries(
      r!.grupos.flatMap((g) => (g.origen === "embarque" ? [[g.embarque.id, g.adjuntos]] : [])),
    );
    expect(Object.keys(porEmbarque).sort()).toEqual([a1.id, a2.id].sort());
    expect(porEmbarque[a1.id as string].map((a) => a.visibilidad).sort()).toEqual(["interno", "portal"]);
    expect(porEmbarque[a2.id as string].map((a) => a.bucket)).toEqual(["shipment-docs"]);
  });

  it("cada fila trae lo que hace falta para «Ver»: bucket y ruta de la fuente", async () => {
    const { ana, tablas } = escenario();
    const { client } = doble(tablas);
    const r = await listarAdjuntosDelCliente(client, ana);
    for (const g of r!.grupos) {
      for (const a of g.adjuntos) {
        const fila = [...tablas.documents, ...tablas.shipment_documents].find((x) => x.id === a.id)!;
        expect(a.storagePath).toBe(fila.storage_path);
        expect(a.bucket).toBe("shipment_id" in fila ? "shipment-docs" : "documents");
      }
    }
  });
});

// ── La propiedad que importa: la fila y la ficha dicen lo mismo ──────────

/** PRNG determinista: la propiedad corre siempre sobre los mismos 40 clientes. */
function prng(semilla: number) {
  let s = semilla >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

describe("una sola definición (criterio 1 de la SDD)", () => {
  it("para cada cliente, su conteo es el total de su «Todos los adjuntos»", async () => {
    const r = prng(507);
    const clientes = Array.from({ length: 40 }, (_, i) => ({
      id: nid(),
      markbox: `DTD-${String(2000 + i)}`,
    }));
    const tablas: Tablas = { shipments: [], documents: [], shipment_documents: [] };
    const azar = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
    for (const c of clientes) {
      for (let k = Math.floor(r() * 4); k > 0; k--) {
        tablas.documents.push(
          docHub("client", c.id, { is_current: r() > 0.2, deleted_at: r() > 0.85 ? "2026-09-01" : null }),
        );
      }
      for (let k = Math.floor(r() * 4); k > 0; k--) {
        const s = embarque(c.markbox, { deleted_at: r() > 0.8 ? "2026-09-01" : null });
        tablas.shipments.push(s);
        for (let j = Math.floor(r() * 3); j > 0; j--) {
          tablas.documents.push(docHub("shipment", s.id as string, { is_current: r() > 0.2 }));
        }
        for (let j = Math.floor(r() * 3); j > 0; j--) {
          tablas.shipment_documents.push(
            docPortal(s.id as string, { deleted_at: r() > 0.8 ? "2026-09-01" : null }),
          );
        }
      }
    }
    // Ruido que no es de nadie de la lista.
    tablas.documents.push(docHub("invoice", azar(clientes).id));

    const { client } = doble(tablas, { tope: 7 }); // tope chico: fuerza la paginación
    const conteos = await contarAdjuntosDeClientes(client, clientes);
    expect(conteos).not.toBeNull();
    let conAlgo = 0;
    for (const c of clientes) {
      const lista = await listarAdjuntosDelCliente(client, c);
      const conteo = conteos!.get(c.id)!;
      expect(lista?.total, c.markbox).toBe(conteo.total);
      const ficha = lista!.grupos.find((g) => g.origen === "cliente")?.adjuntos.length ?? 0;
      const portal = lista!.grupos
        .flatMap((g) => g.adjuntos)
        .filter((a) => a.visibilidad === "portal").length;
      expect(ficha, c.markbox).toBe(conteo.ficha);
      expect(portal, c.markbox).toBe(conteo.portal);
      if (conteo.total > 0) conAlgo++;
    }
    // La propiedad no vale nada si todos tienen cero.
    expect(conAlgo).toBeGreaterThan(10);
  });
});
