/**
 * SDD-0510 · El selector de «Generar Bill of Lading» ofrece los embarques vivos
 * y abiertos.
 *
 * El modal filtraba con `(entregado,cancelado)`, etiquetas que el enum
 * `shipment_status` no tiene: PostgREST respondía 400 con 22P02 y el modal caía
 * a «No hay embarques activos». Un doble que acepta cualquier etiqueta no ve
 * ese defecto, así que este:
 *
 *  - lee las etiquetas del enum de las MIGRACIONES (el `create type` y cualquier
 *    `add value`/`rename value` posterior), no de una lista copiada;
 *  - responde como PostgREST (400, 22P02, `data: null`) si un filtro sobre
 *    `status` usa un valor fuera del enum. El mensaje es el que devolvió el
 *    PostgREST local en `docs/specs/0510-generar-bl-envios-enum/evidencia/`;
 *  - aplica de verdad `eq/in/not.in/is`, ordena y corta, y devuelve copias
 *    con sólo las columnas del `select`;
 *  - lanza si se filtra antes de `select()`, como supabase-js.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { GenerateBLModal } from "../GenerateBLModal";

type Fila = Record<string, unknown>;

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../..");
const MIGRACIONES = join(RAIZ, "supabase/migrations");

/** Las etiquetas de `shipment_status` tras aplicar las migraciones en orden. */
function etiquetasShipmentStatus(): string[] {
  let etiquetas: string[] | null = null;
  const archivos = readdirSync(MIGRACIONES).filter((f) => f.endsWith(".sql")).sort();
  for (const archivo of archivos) {
    const sql = readFileSync(join(MIGRACIONES, archivo), "utf8").replace(/--.*$/gm, "");
    const crea = sql.match(
      /create\s+type\s+(?:public\.)?shipment_status\s+as\s+enum\s*\(([\s\S]*?)\)/i,
    );
    if (crea) etiquetas = [...crea[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    for (const m of sql.matchAll(
      /alter\s+type\s+(?:public\.)?shipment_status\s+add\s+value\s+(?:if\s+not\s+exists\s+)?'([^']+)'/gi,
    )) {
      etiquetas?.push(m[1]);
    }
    for (const m of sql.matchAll(
      /alter\s+type\s+(?:public\.)?shipment_status\s+rename\s+value\s+'([^']+)'\s+to\s+'([^']+)'/gi,
    )) {
      if (etiquetas) etiquetas = etiquetas.map((e) => (e === m[1] ? m[2] : e));
    }
  }
  if (!etiquetas) throw new Error("no encontré el enum shipment_status en las migraciones");
  return etiquetas;
}

const ENUM_STATUS = etiquetasShipmentStatus();

type Respuesta = {
  data: Fila[] | null;
  error: { code: string; message: string } | null;
  status: number;
};

/** `"(a,b)"` → `["a","b"]`, como PostgREST lee la lista de `not.in`. */
const listaPostgrest = (raw: unknown) =>
  String(raw)
    .replace(/^\(|\)$/g, "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

function dobleShipments(filas: Fila[]) {
  function from(tabla: string) {
    const lanzar = (metodo: string) => () => {
      throw new Error(`doble: .${metodo}() antes de .select() sobre ${tabla}`);
    };
    return {
      select(columnas = "*") {
        let visibles = (tabla === "shipments" ? filas : []).map((f) => ({ ...f }));
        let tope = Infinity;
        // Se filtra sobre la fila entera y se devuelven sólo las columnas
        // pedidas, como PostgREST.
        const pedidas = columnas.split(",").map((c) => c.trim());
        const proyectar = (f: Fila): Fila =>
          pedidas.includes("*")
            ? { ...f }
            : Object.fromEntries(pedidas.map((c) => [c, f[c]]));
        let fueraDelEnum: string | null = null;
        const validar = (col: string, valores: unknown[]) => {
          if (tabla !== "shipments" || col !== "status" || fueraDelEnum !== null) return;
          const malo = valores.find((v) => !ENUM_STATUS.includes(String(v)));
          if (malo !== undefined) fueraDelEnum = String(malo);
        };
        const chain = {
          eq(col: string, val: unknown) {
            validar(col, [val]);
            visibles = visibles.filter((r) => r[col] === val);
            return chain;
          },
          in(col: string, vals: unknown[]) {
            validar(col, vals);
            visibles = visibles.filter((r) => vals.includes(r[col]));
            return chain;
          },
          not(col: string, op: string, val: unknown) {
            if (op !== "in") throw new Error(`doble: not(${col}, ${op}) sin modelar`);
            const fuera = listaPostgrest(val);
            validar(col, fuera);
            visibles = visibles.filter((r) => !fuera.includes(String(r[col])));
            return chain;
          },
          is(col: string, val: unknown) {
            if (val !== null) throw new Error(`doble: is(${col}, ${String(val)}) sin modelar`);
            visibles = visibles.filter((r) => r[col] == null);
            return chain;
          },
          order(col: string, opts?: { ascending?: boolean }) {
            const signo = opts?.ascending === false ? -1 : 1;
            visibles = [...visibles].sort(
              (a, b) => signo * String(a[col]).localeCompare(String(b[col])),
            );
            return chain;
          },
          limit(n: number) {
            tope = n;
            return chain;
          },
          then(resolver: (r: Respuesta) => unknown, rechazar?: (e: unknown) => unknown) {
            const r: Respuesta =
              fueraDelEnum !== null
                ? {
                    data: null,
                    error: {
                      code: "22P02",
                      message: `invalid input value for enum shipment_status: "${fueraDelEnum}"`,
                    },
                    status: 400,
                  }
                : { data: visibles.slice(0, tope).map(proyectar), error: null, status: 200 };
            return Promise.resolve(r).then(resolver, rechazar);
          },
        };
        return chain;
      },
      eq: lanzar("eq"),
      in: lanzar("in"),
      not: lanzar("not"),
      is: lanzar("is"),
      order: lanzar("order"),
      limit: lanzar("limit"),
    };
  }
  return { from };
}

const estado = vi.hoisted(() => ({ filas: [] as Record<string, unknown>[] }));
vi.mock("@/lib/db/client", () => ({
  createClient: () => dobleShipments(estado.filas),
}));

const embarque = (id: string, status: string, created_at: string, deleted_at: string | null = null) => ({
  id,
  code: `BL-${id}`,
  client_name: `Cliente Prueba ${id}`,
  destination: "Valencia",
  status,
  deleted_at,
  created_at,
});

// Los cerrados y el eliminado son los MÁS recientes: si un filtro falta,
// aparecen primero en el selector y no se esconden detrás del `limit`.
const ABIERTO_RECIENTE = embarque("A1", "in_transit", "2026-10-05T12:00:00Z");
const ABIERTO_VIEJO = embarque("A2", "in_warehouse", "2026-10-01T12:00:00Z");
const ENTREGADO = embarque("E1", "delivered", "2026-10-06T12:00:00Z");
const CANCELADO = embarque("C1", "cancelled", "2026-10-07T12:00:00Z");
const ELIMINADO = embarque("D1", "in_transit", "2026-10-08T12:00:00Z", "2026-10-09T12:00:00Z");

describe("el doble del enum shipment_status", () => {
  it("lee las etiquetas de las migraciones: en inglés, con delivered y cancelled", () => {
    expect(ENUM_STATUS).toContain("delivered");
    expect(ENUM_STATUS).toContain("cancelled");
    expect(ENUM_STATUS).toContain("in_transit");
    expect(ENUM_STATUS).not.toContain("entregado");
    expect(ENUM_STATUS).not.toContain("cancelado");
  });

  it("control: la cadena que tenía el modal da 22P02 y data null, como PostgREST", async () => {
    const r = (await dobleShipments([ABIERTO_RECIENTE])
      .from("shipments")
      .select("id, code, client_name, destination")
      .not("status", "in", "(entregado,cancelado)")
      .order("created_at", { ascending: false })
      .limit(50)) as Respuesta;
    expect(r.status).toBe(400);
    expect(r.data).toBeNull();
    expect(r.error).toEqual({
      code: "22P02",
      message: 'invalid input value for enum shipment_status: "entregado"',
    });
  });

  it("lanza si se filtra antes de select(), como supabase-js", () => {
    expect(() => dobleShipments([]).from("shipments").not()).toThrow(/antes de \.select\(\)/);
  });
});

describe("<GenerateBLModal> — selector de embarques (SDD-0510)", () => {
  beforeEach(() => {
    estado.filas = [];
  });

  // El defecto de SDD-0510 aislado: sin cerrados ni eliminados en la base, lo
  // único que puede vaciar el selector es que la consulta falle por el enum.
  it("con sólo embarques abiertos, la consulta no falla y los ofrece", async () => {
    estado.filas = [ABIERTO_VIEJO, ABIERTO_RECIENTE];
    render(<GenerateBLModal onClose={() => {}} />);

    const selector = await screen.findByRole("combobox", { name: "Embarque" });
    const ofrecidos = within(selector)
      .getAllByRole("option")
      .map((o) => (o as HTMLOptionElement).value)
      .filter(Boolean);
    expect(ofrecidos).toEqual(["A1", "A2"]);
  });

  it("ofrece sólo los embarques vivos y abiertos, del más reciente al más viejo", async () => {
    estado.filas = [ABIERTO_VIEJO, ENTREGADO, ELIMINADO, ABIERTO_RECIENTE, CANCELADO];
    render(<GenerateBLModal onClose={() => {}} />);

    const selector = await screen.findByRole("combobox", { name: "Embarque" });
    const ofrecidos = within(selector)
      .getAllByRole("option")
      .map((o) => (o as HTMLOptionElement).value)
      .filter(Boolean);
    expect(ofrecidos).toEqual(["A1", "A2"]);
    expect(screen.queryByText(/No hay embarques activos/)).toBeNull();
  });

  it("sin embarques abiertos y vivos, avisa que no hay activos", async () => {
    estado.filas = [ENTREGADO, CANCELADO, ELIMINADO];
    render(<GenerateBLModal onClose={() => {}} />);

    expect(await screen.findByText(/No hay embarques activos/)).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Embarque" })).toBeNull();
  });
});
