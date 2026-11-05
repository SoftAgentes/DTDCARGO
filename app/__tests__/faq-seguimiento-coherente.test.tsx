/** SDD-0579: capacidad real, fuente única DOM/JSON-LD y reversión del interruptor. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, within } from "@testing-library/react";

const h = vi.hoisted(() => ({ construccion: true }));
vi.mock("@/lib/portal/tracking-en-construccion", () => ({
  get TRACKING_EN_CONSTRUCCION() { return h.construccion; },
}));
vi.mock("@/components/Nav", () => ({ Nav: () => null }));
vi.mock("@/components/Footer", () => ({ Footer: () => null }));
vi.mock("@/components/WhatsAppFAB", () => ({ WhatsAppFAB: () => null }));
vi.mock("@/lib/fonts", () => ({ jetbrainsMono: { variable: "font-mono-local" } }));
// Sólo la dependencia de datos remotos se sustituye. Las páginas y sus FAQ son reales.
vi.mock("@/lib/public/servicios-queries", async () => ({
  getServiciosParaSitio: async () => (await import("@/lib/servicios-detalle")).SERVICIOS_DETALLE,
}));

const ANTERIORES = new Map([
  ["¿Cómo me registro y qué obtengo al instante?", "Regístrate gratis en dtdcargo.com/registro: en un minuto recibes tu Shipping Mark (tu código DTD-XXXX para marcar tus cajas en China) y tu acceso al portal de seguimiento. No necesitas contraseña —entras al portal con un enlace que te llega a tu correo— y un asesor termina de activar tu cuenta para que empieces a importar."],
  ["¿Cómo entro a mi portal de cliente y qué puedo hacer ahí?", "Tu portal es tu panel privado en dtdcargo.com/portal: entras con tu correo —te llega un enlace de acceso, sin contraseña— y ahí ves tus envíos y pre-alertas paso a paso, tus facturas y saldos, tus documentos y tus mensajes con el equipo. Si el enlace te dice que tu correo todavía no tiene el portal habilitado, pídele a tu asesor que te active el acceso."],
  ["¿Cada cuánto sale el barco y dónde veo cómo va mi envío?", "El barco sale cada 15 a 21 días. Si ya eres cliente, en tu portal ves en qué etapa va cada uno de tus envíos, actualizado a medida que avanza. Si todavía no eres cliente, escríbenos por WhatsApp y un asesor te confirma la próxima salida para tu carga."],
  ["¿Puedo hacerle seguimiento a mi envío para saber dónde va?", "Sí. El seguimiento se hace entrando a tu portal del cliente en dtdcargo.com/portal: ahí ves los eventos de cada envío en vivo, con su BL (Bill of Lading) y su código DTDU. Entras con un enlace que te llega a tu correo, sin contraseña. Si no tienes acceso a la mano, escríbenos por WhatsApp y te ayudamos a entrar."],
  ["¿Puedo rastrear con el número que me dio mi proveedor chino?", "No. Ese número es del courier interno de China y solo sirve para el trayecto hasta nuestra bodega en Yiwu. Para seguir tu envío con DTD entra a tu portal del cliente en dtdcargo.com/portal: ahí aparece el embarque con el código que te damos al abrirlo."],
]);
const PROMESA = /eventos.{0,40}en vivo|tiempo real|portal de seguimiento|envíos y pre-alertas paso a paso|en tu portal ves en qué etapa|para seguir tu envío con DTD entra|muy pronto|en todo momento/i;
const plano = (s: string | null) => (s ?? "").replace(/\s+/g, " ").trim();
afterEach(cleanup);

async function cargar(construccion: boolean) {
  h.construccion = construccion;
  vi.resetModules();
  return import("@/lib/faqs");
}

function schema(container: HTMLElement) {
  const schemas = [...container.querySelectorAll('script[type="application/ld+json"]')]
    .map((script) => JSON.parse(script.textContent ?? "{}"));
  return schemas.find((s) => s["@type"] === "FAQPage").mainEntity as Array<{
    name: string; acceptedAnswer: { text: string };
  }>;
}

describe("cinco FAQ y el interruptor único", () => {
  it("en construcción declara el canal real y no promete rastreo disponible ni fecha", async () => {
    const { FAQS } = await cargar(true);
    const afectadas = FAQS.filter((f) => ANTERIORES.has(f.pregunta));
    expect(afectadas).toHaveLength(5);
    for (const faq of afectadas) {
      expect(faq.respuesta).toContain("El seguimiento de la carga dentro del portal está en construcción.");
      expect(faq.respuesta).toContain("WhatsApp");
      expect(faq.respuesta).toContain("Te avisaremos apenas esté activo.");
      expect(faq.respuesta).not.toMatch(PROMESA);
      expect(faq.respuesta).not.toMatch(/(?:dentro de|en) \d+ días.*activo|te avisaremos (?:por|en)/i);
    }
  });

  it("apagado restaura exactamente las respuestas previas; el resto y sus propiedades son invariantes", async () => {
    const actual = await cargar(true);
    const anterior = await cargar(false);
    expect(actual.FAQ_CATEGORIAS).toEqual(anterior.FAQ_CATEGORIAS);
    expect(actual.FAQS).toHaveLength(42);
    expect(anterior.FAQS).toHaveLength(actual.FAQS.length);
    for (const [i, faq] of anterior.FAQS.entries()) {
      if (ANTERIORES.has(faq.pregunta)) {
        expect(faq.respuesta).toBe(ANTERIORES.get(faq.pregunta));
        expect({ ...actual.FAQS[i], respuesta: null }).toEqual({ ...faq, respuesta: null });
      } else expect(actual.FAQS[i]).toEqual(faq);
    }
    const flagReal = readFileSync(join(process.cwd(), "lib/portal/tracking-en-construccion.ts"), "utf8");
    expect(flagReal).toMatch(/export const TRACKING_EN_CONSTRUCCION: boolean = true;/);
  });
});

describe.each([true, false])("páginas reales, construcción=%s", (construccion) => {
  it("/faq: cada respuesta afectada coincide en UI y FAQPage sin romper widgets/categorías", async () => {
    const { FAQS } = await cargar(construccion);
    const { default: Page } = await import("@/app/faq/page");
    const { container } = render(<Page />);
    const entidades = schema(container);
    expect(entidades).toHaveLength(FAQS.length);
    for (const faq of FAQS.filter((f) => ANTERIORES.has(f.pregunta))) {
      const pregunta = within(container).getByText(faq.pregunta, { selector: "summary *" });
      const details = pregunta.closest("details")!;
      expect(plano(details.textContent)).toContain(faq.respuesta);
      expect(entidades.find((q) => q.name === faq.pregunta)?.acceptedAnswer.text).toBe(faq.respuesta);
    }
    expect(container.querySelectorAll("details")).toHaveLength(FAQS.length);
    expect(FAQS.filter((f) => f.widget).map((f) => f.widget)).toEqual(["cbm-explicador", "alibaba-guide"]);
  });

  it("/shipping-mark: selección completa no vacía y registro coherente en UI/JSON-LD", async () => {
    const { FAQS } = await cargar(construccion);
    const { default: Page } = await import("@/app/shipping-mark/page");
    const { container } = render(<Page />);
    const esperadas = FAQS.filter((f) => f.categoria === "bodega-china-shipping-mark");
    const entidades = schema(container);
    expect(esperadas.length).toBeGreaterThan(0);
    expect(entidades.map((e) => e.name)).toEqual(esperadas.map((f) => f.pregunta));
    for (const faq of esperadas) {
      expect(plano(container.textContent)).toContain(faq.respuesta);
      expect(entidades.find((e) => e.name === faq.pregunta)?.acceptedAnswer.text).toBe(faq.respuesta);
    }
  });

  it("/puerta-a-puerta: conserva seis FAQ y equivalencia DOM/JSON-LD", async () => {
    const { FAQS } = await cargar(construccion);
    const { default: Page } = await import("@/app/puerta-a-puerta/page");
    const { container } = render(await Page());
    const entidades = schema(container);
    expect(entidades).toHaveLength(6);
    const bloqueFaq = within(container).getByRole("heading", { name: "Puerta a puerta: dudas comunes." }).closest("section")!;
    expect(bloqueFaq.querySelectorAll("dl dt")).toHaveLength(6);
    for (const entidad of entidades) {
      const faq = FAQS.find((f) => f.pregunta === entidad.name)!;
      expect(entidad.acceptedAnswer.text).toBe(faq.respuesta);
      expect(plano(container.textContent)).toContain(faq.respuesta);
    }
  });
});

describe("fuentes estáticas alineadas y privacidad", () => {
  it("KB conserva consulta con el asesor y elimina cuatro promesas sin definir fecha/canal nuevo", () => {
    const kb = readFileSync(join(process.cwd(), "docs/specs/0062-crm-erp-cierres-automaticos/assets/faq-knowledge-base.md"), "utf8");
    expect(kb).toContain("fuente preparada **localmente**, sin convertir ni subir a Kommo");
    expect(kb).toContain("no cambia automáticamente al apagar");
    expect(kb).not.toMatch(/Si quieres seguir tu envío paso a paso|ahí sigues tus compras y tus envíos|muy pronto lo vas a ver todo|portal de seguimiento de tus propios envíos|le \*\*haces seguimiento\*\* a esa compra/);
    expect(kb).toContain("con ese dato un asesor te dice exactamente en qué punto va tu carga");
    expect(kb).toContain("Te avisaremos apenas esté activo.");
    const infografia = readFileSync(join(process.cwd(), "docs/marketing/servicios-infografias/prealerta-compra.md"), "utf8");
    expect(infografia).toContain("Tu compra queda **registrada en tu portal** desde el primer día.");
    expect(infografia).not.toContain("Ves el estado de tu compra en todo momento");
  });

  it("privacidad describe consulta con el equipo y conserva finalidades operativas", async () => {
    const { default: Page } = await import("@/app/privacidad/page");
    const { container } = render(<Page />);
    expect(plano(container.textContent)).toContain("El Shipping Mark o el número de envío que nos indicas al consultar con nuestro equipo el estado de tu carga.");
    expect(plano(container.textContent)).not.toContain("El código de rastreo que introduces");
    expect(plano(container.textContent)).toContain("cotizar, coordinar y dar seguimiento a tus envíos puerta a puerta.");
    // SDD-0587: la fecha se movió al nombrar Instagram entre los canales de chat y en la fila de Meta.
    expect(plano(container.textContent)).toContain("5 de noviembre de 2026");
  });

  // SDD-0587, 2026-11-05: lo que lee la persona, ya renderizado. Texto aprobado por Sam.
  it("privacidad se lee como Sam aprobó en la fila de Meta, el proveedor de gestión de clientes y §5", async () => {
    const { default: Page } = await import("@/app/privacidad/page");
    const { container } = render(<Page />);
    const leido = plano(container.textContent);
    expect(leido).toContain(
      "Meta (WhatsApp e Instagram), que transporta los mensajes que nos envías y te enviamos por esos canales.",
    );
    expect(leido).toContain(
      "Proveedor de gestión de clientes, que todavía usamos para llevar el seguimiento de clientes y atender parte de las conversaciones por WhatsApp e Instagram. Recibe tu nombre, tu correo, tu teléfono o usuario y esos mensajes. Si te atendemos como cliente o te preparamos un estimado, también puede recibir tu Shipping Mark, el valor del estimado y las notas de seguimiento. Estamos pasando esa atención a nuestro propio sistema, alojado en nuestro servidor.",
    );
    expect(leido).toContain(
      "Mientras terminamos ese cambio, lo que pasa por ese proveedor también se guarda en sus servidores y en los de quienes le prestan servicio, que pueden estar en Estados Unidos o en otros países.",
    );
    expect(leido).not.toMatch(/kommo/i);
  });
});
