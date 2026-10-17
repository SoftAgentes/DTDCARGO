/**
 * SDD-0521 · los componentes públicos no prometen rastreo mientras el
 * seguimiento del Portal está en construcción (SDD-0514).
 *
 * - El pie de página, en «Enlaces rápidos»: «Rastrea tu envío» pasa a decir lo
 *   mismo que el aviso del Portal, con el mismo destino (/entrar).
 * - La tarjeta de trazabilidad de /brochure (`Philosophy`): quien sigue la carga
 *   es el equipo, no el cliente desde el Portal.
 * - El paso 06 de /shipping-mark: la carga ya no «empieza a verse en tu
 *   tracking».
 *
 * Apagado el interruptor, vuelven los textos de siempre. Se mide lo que lee el
 * visitante. `ShippingMark` arma sus pasos al cargar el módulo, así que se
 * vuelve a importar con el interruptor ya puesto.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { PHILOSOPHY } from "@/lib/design-tokens";
import { Footer } from "./Footer";
import { Philosophy } from "./Philosophy";

const h = vi.hoisted(() => ({ prendido: true }));

vi.mock("@/lib/portal/tracking-en-construccion", () => ({
  get TRACKING_EN_CONSTRUCCION() {
    return h.prendido;
  },
}));

/**
 * Cualquier promesa de rastreo activo, en el texto que lee el visitante.
 * «Sigue tu carga» cuenta como promesa cuando se le dice al cliente; «nuestro
 * equipo sigue tu carga» es lo que pasa hoy y no cuenta.
 */
const PROMESA = /rastre|tiempo real|(?<!equipo )sigue tu carga|sigues? cada paso|tu tracking|tracking etapa/i;

const plano = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

beforeEach(() => {
  h.prendido = true;
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

// ── Pie de página ───────────────────────────────────────────────

/** Los enlaces de una columna del pie, por el título de la columna. */
function columna(titulo: string) {
  const encabezado = screen.getByRole("heading", { level: 2, name: titulo });
  const enlaces = within(encabezado.parentElement!).getAllByRole("link");
  return enlaces.map((a) => ({ nombre: plano(a.textContent), href: a.getAttribute("href") }));
}

describe("Footer · Enlaces rápidos (SDD-0521)", () => {
  it("prendido: el enlace a /entrar dice «Seguimiento en construcción» y nada del pie promete rastreo", () => {
    vi.stubEnv("DOCUMENT_IMPORT_ENABLED", "true");
    const { container } = render(<Footer />);
    expect(columna("Enlaces rápidos")).toEqual([
      { nombre: "Seguimiento en construcción", href: "/entrar" },
      { nombre: "Calculadora de envío", href: "/tarifas" },
      { nombre: "Cotiza con tu proforma", href: "/cotizador" },
      { nombre: "Contáctenos", href: "/contacto" },
      { nombre: "Enlaces", href: "/enlaces" },
    ]);
    expect(plano(container.textContent)).not.toMatch(PROMESA);
  });

  it("prendido: ningún nombre de enlace se repite en el pie, y «Mi portal» sigue en Explora", () => {
    render(<Footer />);
    const nombres = screen.getAllByRole("link").map((a) => plano(a.textContent)).filter(Boolean);
    expect(new Set(nombres).size).toBe(nombres.length);
    expect(columna("Explora")).toContainEqual({ nombre: "Mi portal", href: "/entrar" });
  });

  it("apagado: vuelve «Rastrea tu envío», con el mismo destino", () => {
    h.prendido = false;
    render(<Footer />);
    const enlaces = columna("Enlaces rápidos");
    expect(enlaces[0]).toEqual({ nombre: "Rastrea tu envío", href: "/entrar" });
    expect(enlaces.map((e) => e.nombre)).not.toContain("Seguimiento en construcción");
  });
});

// ── /brochure · Nuestra filosofía ───────────────────────────────

const TRAZABILIDAD = {
  prendido: {
    titulo: "Acompañamiento etapa por etapa",
    texto: "Nuestro equipo sigue tu carga desde la recepción en China hasta la entrega final en Venezuela.",
  },
  apagado: {
    titulo: "Tracking etapa por etapa",
    texto: "Sigue tu carga desde la recepción en China hasta la entrega final en Venezuela.",
  },
};

/** Las cuatro tarjetas: kicker, título y texto, en orden. */
function tarjetas() {
  const { container } = render(<Philosophy />);
  const titulos = [...container.querySelectorAll("h3")];
  expect(titulos).toHaveLength(4);
  return titulos.map((t) => ({
    kicker: plano(t.previousElementSibling?.textContent),
    titulo: plano(t.textContent),
    texto: plano(t.nextElementSibling?.textContent),
  }));
}

describe("Philosophy · tarjeta de trazabilidad (SDD-0521)", () => {
  it("prendido: la tarjeta dice que el equipo sigue la carga y ninguna tarjeta promete tracking", () => {
    const t = tarjetas();
    expect(t[3]).toEqual({ kicker: "TRAZABILIDAD", ...TRAZABILIDAD.prendido });
    expect(t.map((x) => `${x.titulo} ${x.texto}`).join(" ")).not.toMatch(PROMESA);
  });

  it("prendido: las otras tres tarjetas son las mismas que con el interruptor apagado", () => {
    const prendidas = tarjetas().slice(0, 3);
    cleanup();
    h.prendido = false;
    expect(tarjetas().slice(0, 3)).toEqual(prendidas);
  });

  it("apagado: vuelve la tarjeta de siempre", () => {
    h.prendido = false;
    const t = tarjetas();
    expect(t[3]).toEqual({ kicker: "TRAZABILIDAD", ...TRAZABILIDAD.apagado });
  });

  it("los dos textos viven en lib/design-tokens.ts y sólo esa tarjeta tiene variante", () => {
    const tarjeta = PHILOSOPHY.cards[3];
    expect({ titulo: tarjeta.title, texto: tarjeta.copy }).toEqual(TRAZABILIDAD.apagado);
    expect({ titulo: tarjeta.enConstruccion.title, texto: tarjeta.enConstruccion.copy }).toEqual(
      TRAZABILIDAD.prendido,
    );
    // Sólo esa tarjeta tiene variante: las demás no cambian con el interruptor.
    expect(PHILOSOPHY.cards.filter((c) => "enConstruccion" in c)).toHaveLength(1);
  });
});

// ── /shipping-mark · paso 06 ────────────────────────────────────

const PASO_06 = {
  prendido: {
    titulo: "La consolidamos",
    texto: "Se consolida con el resto de tu carga y nuestro equipo la sigue etapa por etapa.",
  },
  apagado: {
    titulo: "Consolidamos y rastreas",
    texto: "Se consolida con el resto de tu carga y empieza a verse en tu tracking, etapa por etapa.",
  },
};

/** Los ocho pasos con el interruptor en la posición pedida. */
async function pasos(prendido: boolean) {
  h.prendido = prendido;
  vi.resetModules();
  const { ShippingMark } = await import("./ShippingMark");
  const { container } = render(<ShippingMark />);
  const items = [...container.querySelectorAll(".sm-step")];
  expect(items).toHaveLength(8);
  return {
    todo: plano(container.textContent),
    pasos: items.map((li) => ({
      n: plano(li.querySelector(".sm-step-n")?.textContent),
      titulo: plano(li.querySelector("h3")?.textContent),
      texto: plano(li.querySelector("p")?.textContent),
    })),
  };
}

describe("ShippingMark · paso 06 (SDD-0521)", () => {
  it("prendido: el paso 06 no promete que la carga se vea en tu tracking", async () => {
    const p = await pasos(true);
    expect(p.pasos[5]).toEqual({ n: "06", ...PASO_06.prendido });
    expect(p.todo).not.toMatch(PROMESA);
  });

  it("los otros siete pasos son los mismos con el interruptor en cualquier posición", async () => {
    const prendidos = (await pasos(true)).pasos.filter((x) => x.n !== "06");
    cleanup();
    const apagados = (await pasos(false)).pasos.filter((x) => x.n !== "06");
    expect(prendidos).toHaveLength(7);
    expect(apagados).toEqual(prendidos);
  });

  it("apagado: vuelve el paso de siempre", async () => {
    const p = await pasos(false);
    expect(p.pasos[5]).toEqual({ n: "06", ...PASO_06.apagado });
  });
});
