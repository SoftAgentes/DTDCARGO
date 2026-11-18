/**
 * SDD-0528 · los textos públicos que todavía prometían rastreo, continuación de
 * la SDD-0521, mientras el seguimiento del Portal está en construcción
 * (SDD-0514).
 *
 * - `/entrar`: dos beneficios y el párrafo del panel lateral dicen lo que el
 *   Portal ya ofrece. Es el login: sólo cambia el texto, el acceso es el mismo
 *   con el interruptor en cualquier posición.
 * - `/glosario`: DTDU y POD explican el mismo concepto sin prometer que el
 *   cliente los sigue en el Portal, en la ficha y en el JSON-LD. Los demás
 *   términos no cambian.
 * - `public/llms.txt`: es estático y no lee el interruptor; su enlace al Portal
 *   dice algo cierto en las dos posiciones.
 *
 * Apagado el interruptor, vuelven los textos de siempre. Se mide lo que lee el
 * visitante (la página renderizada y su JSON-LD) y el archivo que se publica,
 * no el fuente. `EntrarForm` arma sus listas al cargar el módulo, así que cada
 * caso lo vuelve a importar con el interruptor ya puesto.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { GLOSSARY_TERMS } from "@/lib/design-tokens";

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
// /entrar: las acciones de servidor no se ejecutan en estas pruebas.
vi.mock("@/app/entrar/actions", () => ({
  requestMagicLink: vi.fn(async () => ({})),
}));
vi.mock("@/app/portal/actions", () => ({
  signOutAction: vi.fn(async () => {}),
}));

/**
 * Cualquier promesa de rastreo activo, en el texto que lee el visitante.
 * «Sigues el estado», «sigue tus envíos» o «sigue tu carga» cuentan cuando se
 * le dicen al cliente; «nuestro equipo sigue tu envío» es lo que pasa hoy y no
 * cuenta.
 */
const PROMESA =
  /rastre|tiempo real|(?<!equipo )sigues?\s+(tu|tus|el|cada)\b|portal de tracking|tu tracking|cada paso|en todo momento|en vivo/i;

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

// ── /entrar ─────────────────────────────────────────────────────

const ENTRAR = {
  prendido: {
    nuevo: [
      "El código que identifica tus cajas",
      "La dirección de nuestra bodega en China",
      "Acompañamiento hasta tu puerta",
    ],
    lateral: [
      "Tus compras y pre-alertas en un solo lugar",
      "Cotización puerta a puerta",
      "Documentos y facturas al día",
    ],
    resumen: "Tu Shipping Mark identifica tu carga de punta a punta. Cotiza y paga, todo en un lugar.",
  },
  apagado: {
    nuevo: [
      "El código que identifica tus cajas",
      "La dirección de nuestra bodega en China",
      "Seguimiento hasta tu puerta",
    ],
    lateral: [
      "Seguimiento por compra y contenedor",
      "Cotización puerta a puerta",
      "Documentos y facturas al día",
    ],
    resumen:
      "Tu Shipping Mark identifica tu carga de punta a punta. Cotiza, sigue tus envíos y paga, todo en un lugar.",
  },
};

async function entrar(prendido: boolean) {
  const { EntrarForm } = await cargar(prendido, () => import("../entrar/EntrarForm"));
  const { container } = render(<EntrarForm notice={null} authedNotBound={false} />);
  const fila = screen
    .getByRole("heading", { name: /crear mi cuenta y shipping mark/i })
    .closest("section")!;
  const lateral = screen.getByRole("heading", { name: "Con confianza, en cada contenedor." });
  const items = (raiz: HTMLElement) =>
    within(raiz)
      .getAllByRole("listitem")
      .map((li) => plano(li.textContent));
  return {
    todo: plano(container.textContent),
    nuevo: items(fila),
    lateral: items(lateral.parentElement!),
    resumen: plano(lateral.nextElementSibling?.textContent),
    /**
     * Lo que hace la puerta, sin el texto de los beneficios: campos, botones,
     * enlaces con su destino y títulos. Tiene que ser idéntico con el
     * interruptor en las dos posiciones.
     */
    acceso: {
      campos: [...container.querySelectorAll("input")].map(
        (i) => `${i.name}:${i.type}:${i.required}`,
      ),
      formularios: container.querySelectorAll("form").length,
      botones: screen.getAllByRole("button").map((b) => `${plano(b.textContent)}:${b.getAttribute("type")}`),
      enlaces: screen.getAllByRole("link").map((a) => `${plano(a.textContent)}→${a.getAttribute("href")}`),
      titulos: screen.getAllByRole("heading").map((t) => plano(t.textContent)),
    },
  };
}

describe("/entrar (SDD-0528)", () => {
  it("prendido: los beneficios y el panel lateral no prometen seguimiento", async () => {
    const p = await entrar(true);
    expect(p.nuevo).toEqual(ENTRAR.prendido.nuevo);
    expect(p.lateral).toEqual(ENTRAR.prendido.lateral);
    expect(p.resumen).toBe(ENTRAR.prendido.resumen);
    expect(p.todo).not.toMatch(PROMESA);
    expect(p.todo).not.toMatch(/seguimiento/i);
  });

  it("el acceso es el mismo con el interruptor en cualquier posición: sólo cambia el texto", async () => {
    const prendido = (await entrar(true)).acceso;
    cleanup();
    const apagado = (await entrar(false)).acceso;
    expect(prendido.campos).toContain("email:email:true");
    expect(prendido.campos.some((c) => c.includes(":password:"))).toBe(false);
    expect(prendido.enlaces).toContain("Crear mi cuenta→/registro");
    expect(apagado).toEqual(prendido);
  });

  it("apagado: vuelven los textos de siempre", async () => {
    const p = await entrar(false);
    expect(p.nuevo).toEqual(ENTRAR.apagado.nuevo);
    expect(p.lateral).toEqual(ENTRAR.apagado.lateral);
    expect(p.resumen).toBe(ENTRAR.apagado.resumen);
    for (const texto of [...ENTRAR.prendido.nuevo, ...ENTRAR.prendido.lateral]) {
      if (ENTRAR.apagado.nuevo.includes(texto) || ENTRAR.apagado.lateral.includes(texto)) continue;
      expect(p.todo).not.toContain(texto);
    }
  });
});

// ── /glosario ───────────────────────────────────────────────────

const GLOSARIO = {
  dtdu: {
    prendido: [
      "Código interno de DTD Cargo que identifica un envío de extremo a extremo. Formato: `DTDU-NNNNNN-XXXX`. Te lo damos al confirmar la cotización y con él nuestro equipo sigue tu envío. El seguimiento desde tu portal del cliente (dtdcargo.com/portal) está en construcción.",
      "El DTDU agrupa el BL marítimo, los documentos de aduana y el last mile bajo un solo identificador — más cómodo que recordar múltiples números.",
    ],
    apagado: [
      "Código interno de DTD Cargo que identifica un envío de extremo a extremo. Formato: `DTDU-NNNNNN-XXXX`. Te lo damos al confirmar la cotización y lo ves entrando a tu portal del cliente (dtdcargo.com/portal), donde sigues el estado en tiempo real.",
      "El DTDU agrupa el BL marítimo, los documentos de aduana y el last mile bajo un solo identificador — más cómodo que recordar múltiples números.",
    ],
  },
  pod: {
    prendido: [
      "Documento firmado por el destinatario cuando recibe la carga en su puerta. Cierra el ciclo logístico y sirve como prueba legal de que la entrega se completó.",
      "Es el último evento del envío: lleva la fecha de la entrega y la firma de quien recibe.",
    ],
    apagado: [
      "Documento firmado por el destinatario cuando recibe la carga en su puerta. Cierra el ciclo logístico y sirve como prueba legal de que la entrega se completó.",
      "En el portal de tracking, el POD aparece como el último evento del envío junto con la fecha y firma escaneada.",
    ],
  },
};

async function glosario(prendido: boolean) {
  const mod = await cargar(prendido, () => import("../glosario/page"));
  const { container } = render(<mod.default />);
  const conjunto = [...container.querySelectorAll('script[type="application/ld+json"]')]
    .map((s) => JSON.parse(s.textContent ?? "null"))
    .find((j) => j?.["@type"] === "DefinedTermSet");
  expect(conjunto, "el JSON-LD DefinedTermSet").toBeDefined();
  const fichas = [...container.querySelectorAll<HTMLElement>("article.gl-item")];
  const terminos = conjunto.hasDefinedTerm as { "@id": string; name: string; description: string }[];
  return {
    todo: plano(screen.getByRole("main").textContent),
    jsonld: JSON.stringify(conjunto),
    /** Por id: lo que dice la ficha (título y párrafos) y su entrada del JSON-LD. */
    por: Object.fromEntries(
      fichas.map((f) => {
        const enJsonLd = terminos.find((t) => t["@id"].endsWith(`#${f.id}`));
        return [
          f.id,
          {
            titulo: plano(f.querySelector("h3")?.textContent),
            parrafos: [...f.querySelectorAll("p.gl-def")].map((p) => plano(p.textContent)),
            jsonld: enJsonLd?.description,
            nombre: enJsonLd?.name,
          },
        ];
      }),
    ),
  };
}

describe("/glosario (SDD-0528)", () => {
  it("prendido: DTDU y POD explican el concepto sin prometer seguimiento, en la ficha y en el JSON-LD", async () => {
    const g = await glosario(true);
    for (const id of ["dtdu", "pod"] as const) {
      expect(g.por[id].parrafos).toEqual(GLOSARIO[id].prendido);
      expect(g.por[id].jsonld).toBe(GLOSARIO[id].prendido.join(" "));
    }
    expect(g.todo).not.toMatch(PROMESA);
    expect(g.jsonld).not.toMatch(PROMESA);
  });

  it("prendido: los demás términos, y los títulos de DTDU y POD, son los mismos que apagado", async () => {
    const prendido = (await glosario(true)).por;
    cleanup();
    const apagado = (await glosario(false)).por;
    expect(Object.keys(prendido)).toEqual(Object.keys(apagado));
    expect(Object.keys(prendido).length).toBe(GLOSSARY_TERMS.length);
    for (const id of Object.keys(prendido)) {
      if (id === "dtdu" || id === "pod") {
        expect(prendido[id].titulo).toBe(apagado[id].titulo);
        expect(prendido[id].nombre).toBe(apagado[id].nombre);
        continue;
      }
      expect(prendido[id], id).toEqual(apagado[id]);
    }
  });

  it("apagado: vuelven los textos de siempre, en la ficha y en el JSON-LD", async () => {
    const g = await glosario(false);
    for (const id of ["dtdu", "pod"] as const) {
      expect(g.por[id].parrafos).toEqual(GLOSARIO[id].apagado);
      expect(g.por[id].jsonld).toBe(GLOSARIO[id].apagado.join(" "));
    }
    expect(g.todo).not.toContain("está en construcción");
  });

  it("sólo DTDU y POD tienen variante en lib/design-tokens.ts", () => {
    expect(GLOSSARY_TERMS.filter((t) => t.enConstruccion).map((t) => t.id)).toEqual(["pod", "dtdu"]);
  });
});

// ── public/llms.txt ─────────────────────────────────────────────

describe("public/llms.txt (SDD-0528)", () => {
  const llms = readFileSync(join(process.cwd(), "public", "llms.txt"), "utf8");

  it("el enlace al Portal dice algo cierto con el interruptor en las dos posiciones", () => {
    const aPortal = llms.split(/\r?\n/).filter((l) => l.includes("https://dtdcargo.com/portal"));
    // Formato de enlace Markdown desde la auditoría SEO 2026-11-07 (estándar llms.txt);
    // la etiqueta, que es lo que esta prueba protege, no cambia.
    expect(aPortal).toEqual(["- [Portal del cliente](https://dtdcargo.com/portal)"]);
  });

  it("no promete rastreo en ninguna parte", () => {
    expect(llms).not.toMatch(PROMESA);
  });
});
