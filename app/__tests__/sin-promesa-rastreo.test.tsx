/**
 * SDD-0521 · la web pública no promete rastreo mientras el seguimiento del
 * Portal está en construcción (SDD-0514).
 *
 * El rastreo público se retiró (`/track` hace 301 al Portal) y dentro del
 * Portal el seguimiento todavía no existe: la bodega de China registra en
 * Excel. Con `TRACKING_EN_CONSTRUCCION` prendido, cada página dice algo cierto
 * y conserva su destino; apagado, vuelven los textos de siempre. La 404 es la
 * excepción: su texto hablaba de un «buscador de tracking en la home» que ya no
 * existe y queda corregido en las dos posiciones.
 *
 * Se mide lo que lee el visitante (la página renderizada, sus metadatos y su
 * JSON-LD), no el fuente. Varias páginas arman sus textos al cargar el módulo
 * (`metadata`, la lista de enlaces), así que cada caso lo vuelve a importar con
 * el interruptor ya puesto.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

const h = vi.hoisted(() => ({ prendido: true }));

vi.mock("@/lib/portal/tracking-en-construccion", () => ({
  get TRACKING_EN_CONSTRUCCION() {
    return h.prendido;
  },
}));
// El menú, el pie y el botón flotante no son de estas páginas: el pie tiene
// su propia prueba en `components/sin-promesa-rastreo.test.tsx`.
vi.mock("@/components/Nav", () => ({ Nav: () => null }));
vi.mock("@/components/Footer", () => ({ Footer: () => null }));
vi.mock("@/components/WhatsAppFAB", () => ({ WhatsAppFAB: () => null }));
// next/font/local sólo funciona dentro de Next.
vi.mock("@/lib/fonts", () => ({ jetbrainsMono: { variable: "fuente-mono" } }));
// /verificar consulta la base: un Shipping Mark que existe y sin throttle.
vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => ({ rpc: async () => ({ data: true, error: null }) }),
}));
vi.mock("@/lib/http/request-ip", () => ({ getRequestIp: async () => "203.0.113.7" }));
vi.mock("@/lib/public/verify-throttle", () => ({ isVerifyThrottled: async () => false }));

/**
 * Cualquier promesa de rastreo activo, en el texto que lee el visitante.
 * «Sigue tu carga» cuenta como promesa cuando se le dice al cliente; «nuestro
 * equipo sigue tu carga» es lo que pasa hoy y no cuenta.
 */
const PROMESA = /rastre|tiempo real|(?<!equipo )sigue tu carga|sigues? cada paso|tu tracking|tracking etapa/i;

const plano = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

/** Importa el módulo de nuevo, con el interruptor en la posición pedida. */
async function cargar<T>(prendido: boolean, importar: () => Promise<T>): Promise<T> {
  h.prendido = prendido;
  vi.resetModules();
  return importar();
}

beforeEach(() => {
  h.prendido = true;
});
afterEach(cleanup);

// ── /enlaces ────────────────────────────────────────────────────

const ENLACES = {
  prendido: {
    label: "Seguimiento en construcción",
    sub: "Te avisaremos apenas esté activo",
    descripcion:
      "Todos los enlaces de DTD Cargo en un solo lugar: cotiza por WhatsApp, calcula tu envío y entra a tu portal. China → Venezuela, con Confianza.",
    resumen: "Cotiza por WhatsApp, calcula tu envío y entra a tu portal.",
  },
  apagado: {
    label: "Rastrear mi embarque",
    sub: "Sigue tu carga en tiempo real",
    descripcion:
      "Todos los enlaces de DTD Cargo en un solo lugar: cotiza por WhatsApp, calcula tu envío, rastrea tu carga y entra a tu portal. China → Venezuela, con Confianza.",
    resumen: "Cotiza por WhatsApp, calcula tu envío, rastrea tu carga y entra a tu portal.",
  },
};

async function enlaces(prendido: boolean) {
  const mod = await cargar(prendido, () => import("../enlaces/page"));
  const { container } = render(<mod.default />);
  const filas = [...container.querySelectorAll<HTMLAnchorElement>("a.enlaces-row")];
  const tarjeta = filas.find((a) => new URL(a.href).pathname === "/entrar");
  expect(tarjeta, "la tarjeta que lleva a /entrar").toBeDefined();
  return {
    container,
    filas,
    tarjeta: tarjeta!,
    label: plano(tarjeta!.querySelector(".tx b")?.textContent),
    sub: plano(tarjeta!.querySelector(".tx > span")?.textContent),
    metadata: mod.metadata,
  };
}

describe("/enlaces (SDD-0521)", () => {
  it("prendido: la tarjeta dice que el seguimiento está en construcción y sigue llevando a /entrar", async () => {
    const p = await enlaces(true);
    expect(p.label).toBe(ENLACES.prendido.label);
    expect(p.sub).toBe(ENLACES.prendido.sub);
    const url = new URL(p.tarjeta.href);
    expect(url.pathname).toBe("/entrar");
    expect(url.searchParams.get("origen")).toBe("rastreo");
    expect(plano(p.container.textContent)).not.toMatch(PROMESA);
  });

  it("prendido: ninguna tarjeta repite el nombre de otra, y el Portal del Cliente sigue en /portal", async () => {
    const p = await enlaces(true);
    const nombres = p.filas.map((a) => plano(a.querySelector(".tx b")?.textContent));
    expect(new Set(nombres).size).toBe(nombres.length);
    const portal = p.filas.find((a) => plano(a.querySelector(".tx b")?.textContent) === "Portal del Cliente");
    expect(new URL(portal!.href).pathname).toBe("/portal");
  });

  it("prendido: la descripción, Open Graph y Twitter no prometen rastreo", async () => {
    const { metadata } = await enlaces(true);
    expect(metadata.description).toBe(ENLACES.prendido.descripcion);
    expect(metadata.openGraph?.description).toBe(ENLACES.prendido.resumen);
    expect(metadata.twitter?.description).toBe(ENLACES.prendido.resumen);
  });

  it("apagado: vuelven la tarjeta y los metadatos de siempre", async () => {
    const p = await enlaces(false);
    expect(p.label).toBe(ENLACES.apagado.label);
    expect(p.sub).toBe(ENLACES.apagado.sub);
    expect(new URL(p.tarjeta.href).pathname).toBe("/entrar");
    expect(p.metadata.description).toBe(ENLACES.apagado.descripcion);
    expect(p.metadata.openGraph?.description).toBe(ENLACES.apagado.resumen);
    expect(p.metadata.twitter?.description).toBe(ENLACES.apagado.resumen);
    expect(p.container.textContent).not.toContain(ENLACES.prendido.label);
    expect(p.container.textContent).not.toContain(ENLACES.prendido.sub);
  });
});

// ── 404 ─────────────────────────────────────────────────────────

const TEXTO_404 = "No encontramos la página que buscas. Vuelve al inicio o entra a tu portal.";

async function noEncontrada(prendido: boolean) {
  const mod = await cargar(prendido, () => import("../not-found"));
  render(<mod.default />);
  const main = screen.getByRole("main");
  return {
    main,
    texto: plano(within(main).getByText(/No encontramos la página/).textContent),
    boton: within(main).getByRole("link", { name: /portal|rastrear/i }),
  };
}

describe("404 (SDD-0521)", () => {
  it("prendido: el texto ya no habla del buscador de tracking y el botón no promete rastreo", async () => {
    const p = await noEncontrada(true);
    expect(p.texto).toBe(TEXTO_404);
    expect(plano(p.boton.textContent)).toBe("Entrar a mi portal");
    expect(p.boton).toHaveAttribute("href", "/entrar");
    expect(within(p.main).getByRole("link", { name: "Ir al inicio" })).toHaveAttribute("href", "/");
    expect(plano(p.main.textContent)).not.toMatch(PROMESA);
    expect(p.main.textContent).not.toMatch(/buscador/i);
  });

  it("apagado: vuelve el botón de siempre, pero el texto sigue corregido", async () => {
    const p = await noEncontrada(false);
    expect(p.texto).toBe(TEXTO_404);
    expect(p.main.textContent).not.toMatch(/buscador/i);
    expect(plano(p.boton.textContent)).toBe("Rastrear envío");
    expect(p.boton).toHaveAttribute("href", "/entrar");
  });
});

// ── Actualidad ──────────────────────────────────────────────────

async function actualidad(prendido: boolean) {
  const { ActualidadHub } = await cargar(prendido, () => import("../noticias/_components/ActualidadHub"));
  render(<ActualidadHub posts={[]} />);
  const accesos = screen.getByLabelText("Accesos rápidos");
  return { accesos, entrar: within(accesos).getAllByRole("link").filter((a) => a.getAttribute("href") === "/entrar") };
}

describe("Actualidad · accesos rápidos (SDD-0521)", () => {
  it("prendido: el acceso a /entrar no promete rastreo", async () => {
    const { accesos, entrar } = await actualidad(true);
    expect(entrar).toHaveLength(1);
    expect(plano(entrar[0].textContent)).toBe("Entrar a mi portal");
    expect(plano(accesos.textContent)).not.toMatch(PROMESA);
  });

  it("apagado: vuelve «Rastrear un envío»", async () => {
    const { entrar } = await actualidad(false);
    expect(entrar).toHaveLength(1);
    expect(plano(entrar[0].textContent)).toBe("Rastrear un envío");
  });
});

// ── /verificar ──────────────────────────────────────────────────

async function verificar(prendido: boolean) {
  const mod = await cargar(prendido, () => import("../verificar/page"));
  render(await mod.default({ searchParams: Promise.resolve({ c: "DTD-1234" }) }));
  const main = screen.getByRole("main");
  return {
    main,
    entrar: within(main)
      .getAllByRole("link")
      .filter((a) => a.getAttribute("href") === "/entrar"),
  };
}

describe("/verificar (SDD-0521)", () => {
  it("prendido: junto a WhatsApp, el botón a /entrar no promete rastreo", async () => {
    const { main, entrar } = await verificar(true);
    expect(within(main).getByRole("link", { name: "Escríbenos por WhatsApp" })).toBeInTheDocument();
    expect(entrar).toHaveLength(1);
    expect(plano(entrar[0].textContent)).toBe("Entrar a mi portal");
    expect(plano(main.textContent)).not.toMatch(PROMESA);
  });

  it("apagado: vuelve «Rastrear un envío»", async () => {
    const { entrar } = await verificar(false);
    expect(entrar).toHaveLength(1);
    expect(plano(entrar[0].textContent)).toBe("Rastrear un envío");
  });
});

// ── /pre-alertas ────────────────────────────────────────────────

const PRE_ALERTAS = {
  prendido: {
    desc: "Pre-alerta tu carga antes de que salga de China: registra tu compra, define la modalidad de envío y tu Shipping Mark la identifica desde la bodega en Yiwu hasta tu puerta en Venezuela.",
    entrada:
      "Avísanos que viene tu mercancía y define cómo debe viajar. Nuestro equipo en Yiwu la recibe con tu Shipping Mark, la revisa y la consolida. Te acompañamos hasta tu puerta.",
    beneficio: "Nuestro equipo la sigue de punta a punta",
  },
  apagado: {
    desc: "Pre-alerta tu carga antes de que salga de China: registra tu compra, define la modalidad de envío y sigue cada paso con tu Shipping Mark, desde la bodega en Yiwu hasta tu puerta en Venezuela.",
    entrada:
      "Avísanos que viene tu mercancía y define cómo debe viajar. Nuestro equipo en Yiwu la recibe con tu Shipping Mark, la revisa y la consolida — tú sigues cada paso desde el portal.",
    beneficio: "Seguimiento de punta a punta desde el portal",
  },
};

async function preAlertas(prendido: boolean) {
  const mod = await cargar(prendido, () => import("../pre-alertas/page"));
  const { container } = render(<mod.default />);
  const servicio = [...container.querySelectorAll('script[type="application/ld+json"]')]
    .map((s) => JSON.parse(s.textContent ?? "null"))
    .find((j) => j?.["@type"] === "Service");
  // El bloque del Shipping Mark: su lista de dos beneficios.
  const bloque = screen.getByRole("heading", { name: "Tu carga, siempre identificada" }).parentElement!;
  const beneficios = [...bloque.querySelectorAll(".pa-b-list li")].map((li) => plano(li.textContent));
  expect(beneficios).toHaveLength(2);
  return {
    main: screen.getByRole("main"),
    metadata: mod.metadata,
    servicio,
    entrada: plano(container.querySelector(".pa-lead")?.textContent),
    beneficios,
  };
}

describe("/pre-alertas (SDD-0521)", () => {
  it("prendido: entrada, beneficio, metadatos y JSON-LD sin promesa de seguimiento", async () => {
    const p = await preAlertas(true);
    expect(p.entrada).toBe(PRE_ALERTAS.prendido.entrada);
    expect(p.beneficios).toEqual(["Recepción sin confusiones en bodega", PRE_ALERTAS.prendido.beneficio]);
    expect(p.metadata.description).toBe(PRE_ALERTAS.prendido.desc);
    expect(p.metadata.openGraph?.description).toBe(PRE_ALERTAS.prendido.desc);
    expect(p.metadata.twitter?.description).toBe(PRE_ALERTAS.prendido.desc);
    expect(p.servicio?.description).toBe(PRE_ALERTAS.prendido.desc);
    expect(plano(p.main.textContent)).not.toMatch(PROMESA);
    expect(p.main.textContent).not.toMatch(/desde el portal/i);
  });

  it("apagado: vuelven los textos de siempre", async () => {
    const p = await preAlertas(false);
    expect(p.entrada).toBe(PRE_ALERTAS.apagado.entrada);
    expect(p.beneficios).toEqual(["Recepción sin confusiones en bodega", PRE_ALERTAS.apagado.beneficio]);
    expect(p.metadata.description).toBe(PRE_ALERTAS.apagado.desc);
    expect(p.servicio?.description).toBe(PRE_ALERTAS.apagado.desc);
    expect(p.main.textContent).not.toContain(PRE_ALERTAS.prendido.beneficio);
  });
});
