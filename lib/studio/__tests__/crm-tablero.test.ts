// @vitest-environment node
/**
 * Tablero del CRM propio (SDD-0587 · 6.3): dónde se pinta cada tarjeta.
 *
 * El tablero no se guarda: sale del segmento en el momento. Estas pruebas fijan
 * los cuatro casos del contrato §4.5 —lead → cliente, cliente → lead, gana el
 * manual posterior y la tarjeta que nació cliente— y las columnas.
 */
import { describe, expect, it } from "vitest";
import {
  ETAPA_VUELTA_A_LEAD,
  armarColumnas,
  coincideBusqueda,
  destinosDe,
  diasDesde,
  resolverTablero,
  rolUsaCrm,
  tableroDeSegmento,
  ubicarTarjeta,
  type CrmEtapa,
  type CrmTarjetaFila,
  type CrmTarjetaTablero,
} from "@/lib/studio/crm-tablero";

const T0 = "2026-10-01T12:00:00.000Z";
const T1 = "2026-10-10T12:00:00.000Z";
const T2 = "2026-10-20T12:00:00.000Z";

function fila(over: Partial<CrmTarjetaFila> = {}): CrmTarjetaFila {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    client_id: null,
    nombre_visible: "Lead de prueba",
    etapa_leads: "nuevo",
    etapa_leads_at: T0,
    etapa_clientes: "activo",
    etapa_clientes_at: T0,
    asesor_id: null,
    fuente: "manual",
    ultima_actividad_at: T0,
    ...over,
  };
}

const SIN_RASTRO = { clientesAt: null, enLeads: false };

describe("tablero por segmento", () => {
  it("cliente va a Clientes; lead registrado y lead nuevo, a Leads", () => {
    expect(tableroDeSegmento("cliente")).toBe("clientes");
    expect(tableroDeSegmento("lead_registrado")).toBe("leads");
    expect(tableroDeSegmento("lead_nuevo")).toBe("leads");
  });

  it("el tablero de la URL cae en Leads si no se entiende", () => {
    expect(resolverTablero("clientes")).toBe("clientes");
    expect(resolverTablero("todo")).toBe("leads");
    expect(resolverTablero(undefined)).toBe("leads");
  });

  it("solo admin y commercial usan el CRM, como crm_puede_usar() de la 0506", () => {
    expect(rolUsaCrm("admin")).toBe(true);
    expect(rolUsaCrm("commercial")).toBe(true);
    for (const r of ["support", "operator", "accounting", "", null, undefined]) {
      expect(rolUsaCrm(r)).toBe(false);
    }
  });
});

describe("ubicarTarjeta · paso automático entre embudos (§4.5)", () => {
  it("lead que se vuelve cliente: aparece en Clientes, en su etapa, y dice de dónde vino", () => {
    const u = ubicarTarjeta(
      fila({ etapa_leads: "aceptado_esperando_carga", etapa_leads_at: T1 }),
      "cliente",
      { clientesAt: null, enLeads: true },
    );
    expect(u).toEqual({
      tablero: "clientes",
      etapa: "activo",
      desde: T0,
      origen: { tablero: "leads", etapa: "aceptado_esperando_carga", vuelta: false },
    });
  });

  it("tarjeta que nació cliente (Nuevo por defecto, sin historial en Leads) no inventa origen", () => {
    expect(ubicarTarjeta(fila(), "cliente", SIN_RASTRO).origen).toBeNull();
  });

  it("cliente que vuelve a lead: va a «Registrado / recontacto», no a su etapa vieja", () => {
    const u = ubicarTarjeta(
      fila({ etapa_leads: "aceptado_esperando_carga", etapa_leads_at: T0, etapa_clientes: "postventa" }),
      "lead_registrado",
      { clientesAt: T1, enLeads: true },
    );
    expect(u.tablero).toBe("leads");
    expect(u.etapa).toBe(ETAPA_VUELTA_A_LEAD);
    expect(u.desde).toBe(T1);
    expect(u.origen).toEqual({ tablero: "clientes", etapa: "postventa", vuelta: true });
  });

  it("gana el manual posterior: movida a mano en Leads después, manda su etapa guardada", () => {
    const u = ubicarTarjeta(
      fila({ etapa_leads: "negociacion", etapa_leads_at: T2 }),
      "lead_registrado",
      { clientesAt: T1, enLeads: true },
    );
    expect(u.etapa).toBe("negociacion");
    expect(u.desde).toBe(T2);
    // Sigue diciendo que fue cliente.
    expect(u.origen?.vuelta).toBe(true);
  });

  it("lead que nunca fue cliente queda en su etapa, sin origen", () => {
    const u = ubicarTarjeta(fila({ etapa_leads: "contactado", etapa_leads_at: T1 }), "lead_nuevo", SIN_RASTRO);
    expect(u).toEqual({ tablero: "leads", etapa: "contactado", desde: T1, origen: null });
  });
});

const ETAPAS: CrmEtapa[] = [
  { tablero: "leads", clave: "contactado", nombre: "Contactado", orden: 20, terminal: false, sistema: true, activa: true },
  { tablero: "leads", clave: "nuevo", nombre: "Nuevo", orden: 10, terminal: false, sistema: true, activa: true },
  { tablero: "leads", clave: "perdido", nombre: "Perdido", orden: 90, terminal: true, sistema: true, activa: true },
  { tablero: "leads", clave: "frio", nombre: "Frío", orden: 70, terminal: false, sistema: false, activa: false },
  { tablero: "leads", clave: "vip", nombre: "VIP", orden: 75, terminal: false, sistema: false, activa: false },
  { tablero: "clientes", clave: "activo", nombre: "Activo", orden: 10, terminal: false, sistema: true, activa: true },
];

function tarjeta(id: string, etapa: string, over: Partial<CrmTarjetaTablero> = {}): CrmTarjetaTablero {
  return {
    id,
    nombre: `Tarjeta ${id}`,
    shippingMark: null,
    segmento: "lead_nuevo",
    tablero: "leads",
    etapa,
    origen: null,
    diasEnEtapa: 0,
    asesorNombre: null,
    tareasAbiertas: 0,
    tareasVencidas: 0,
    ...over,
  };
}

describe("armarColumnas", () => {
  it("ordena por `orden`, deja solo las del tablero y reparte cada tarjeta en su etapa", () => {
    const cols = armarColumnas(
      ETAPAS,
      [tarjeta("a", "contactado"), tarjeta("b", "nuevo"), tarjeta("c", "activo", { tablero: "clientes" })],
      "leads",
    );
    expect(cols.map((c) => c.etapa.clave)).toEqual(["nuevo", "contactado", "perdido"]);
    expect(cols.map((c) => c.tarjetas.map((t) => t.id))).toEqual([["b"], ["a"], []]);
  });

  it("una etapa apagada aparece solo si todavía tiene tarjetas", () => {
    const cols = armarColumnas(ETAPAS, [tarjeta("a", "frio")], "leads");
    expect(cols.map((c) => c.etapa.clave)).toEqual(["nuevo", "contactado", "frio", "perdido"]);
  });

  it("una etapa desconocida no pierde la tarjeta: cae en la primera activa", () => {
    const cols = armarColumnas(ETAPAS, [tarjeta("a", "no_existe")], "leads");
    expect(cols[0].tarjetas.map((t) => t.id)).toEqual(["a"]);
  });

  it("los destinos son las etapas activas del tablero menos la actual", () => {
    expect(destinosDe(ETAPAS, "leads", "nuevo").map((e) => e.clave)).toEqual(["contactado", "perdido"]);
  });
});

describe("búsqueda y antigüedad", () => {
  it("busca por nombre sin tildes ni mayúsculas y por Shipping Mark", () => {
    const t = tarjeta("a", "nuevo", { nombre: "Ramón Pérez", shippingMark: "DTD-0042" });
    expect(coincideBusqueda(t, "ramon")).toBe(true);
    expect(coincideBusqueda(t, "dtd-0042")).toBe(true);
    expect(coincideBusqueda(t, "  ")).toBe(true);
    expect(coincideBusqueda(t, "otro")).toBe(false);
  });

  it("días enteros desde la fecha; null si no hay fecha", () => {
    expect(diasDesde(T0, Date.parse(T1))).toBe(9);
    expect(diasDesde(null, Date.parse(T1))).toBeNull();
    expect(diasDesde("no es fecha", Date.parse(T1))).toBeNull();
  });
});
