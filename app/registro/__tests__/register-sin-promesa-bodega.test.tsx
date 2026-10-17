/**
 * SDD-0517 · el registro público no promete el aviso de llegada a bodega
 * mientras el seguimiento está en construcción.
 *
 * La bodega de China todavía registra en Excel y los avisos automáticos al
 * cliente sólo salen por correo o push, nunca por WhatsApp. Con
 * `TRACKING_EN_CONSTRUCCION` prendido, el paso Contacto dice para qué sirve el
 * WhatsApp sin prometer avisos.
 *
 * SDD-0524 · apagado ya no vuelve el texto de siempre: ese prometía los avisos
 * POR WHATSAPP, que no existe. Dice el canal real: correo, y push si el
 * cliente activa las notificaciones del Portal.
 *
 * Se mira el `<p>` que va debajo del título del paso: ahí vive el texto, y para
 * una empresa empieza por «Registras a …», que no se puede perder.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const h = vi.hoisted(() => ({ prendido: true }));

vi.mock("@/lib/portal/tracking-en-construccion", () => ({
  get TRACKING_EN_CONSTRUCCION() {
    return h.prendido;
  },
}));
vi.mock("../actions", () => ({ registerClientAction: vi.fn(async () => ({})) }));
vi.mock("@/components/Analytics", () => ({ trackLead: vi.fn() }));

import { RegisterForm } from "../RegisterForm";

const NEUTRO = "El WhatsApp es por donde hablamos contigo sobre tu carga.";
const APAGADO =
  "El WhatsApp es por donde hablamos contigo sobre tu carga. Los avisos de cuando llega a bodega en China, cuando zarpa y cuando está lista para entrega te llegan por correo y, si activas las notificaciones en tu Portal, también en tu teléfono o tu computadora.";
/** El texto viejo (antes de la 0524): prometía los avisos por WhatsApp. */
const PROMESA_WHATSAPP = /WhatsApp es por donde te avisamos|te avisamos por WhatsApp|avisos? por WhatsApp/i;
const PROMESA = /bodega|te avisamos|te notificamos|te avisaremos/i;

const CIUDADES = [{ city: "Valencia", state: "Carabobo" }];

/** Completa el paso 1 como persona natural y llega al paso 2 (Contacto). */
async function irAContactoPersona() {
  const user = userEvent.setup();
  await user.type(screen.getByPlaceholderText("Carlos Pérez"), "Carlos Pérez");
  await user.type(screen.getByPlaceholderText("18456321"), "18456321");
  await user.type(screen.getByPlaceholderText("cperez@empresa.com"), "carlos@empresa.com");
  await user.click(screen.getByRole("button", { name: /continuar/i }));
  // El paso 2 se reconoce por su campo: el rail lista los cinco títulos siempre.
  await screen.findByPlaceholderText("412 1668021");
}

/**
 * Lo mismo, como empresa. La razón social va sin punto final a propósito: el
 * formulario le agrega un punto detrás («Registras a X.»), así que con «C.A.»
 * sale «C.A..». Es de antes de esta tarea y no es lo que se mide aquí.
 */
async function irAContactoEmpresa() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /empresa/i }));
  await user.type(screen.getByPlaceholderText("Carlos Pérez"), "Carlos Pérez");
  await user.type(
    await screen.findByPlaceholderText("Importadora Pérez C.A."),
    "Importadora Pérez",
  );
  await user.type(screen.getByPlaceholderText("J-12345678-9"), "J-12345678-9");
  await user.type(screen.getByPlaceholderText("cperez@empresa.com"), "carlos@empresa.com");
  await user.click(screen.getByRole("button", { name: /continuar/i }));
  await screen.findByPlaceholderText("412 1668021");
}

/** El texto bajo el título del paso Contacto (el `<p>` hermano del `<h2>`). */
function textoDelPaso(): string {
  const titulo = screen.getByRole("heading", { level: 2, name: /cómo te ubicamos/i });
  const sub = titulo.nextElementSibling;
  expect(sub?.tagName).toBe("P");
  return (sub?.textContent ?? "").replace(/\s+/g, " ").trim();
}

describe("registro · sin promesa de aviso de bodega (SDD-0517)", () => {
  beforeEach(() => {
    h.prendido = true;
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ exists: false }))) as never;
  });
  afterEach(() => cleanup());

  it("prendido: el paso Contacto no promete avisos y dice para qué sirve el WhatsApp", async () => {
    const { container } = render(<RegisterForm cities={CIUDADES} />);
    await irAContactoPersona();

    expect(textoDelPaso()).toBe(NEUTRO);
    // En ninguna parte del formulario, no sólo en ese párrafo.
    expect(container.textContent).not.toMatch(PROMESA);
  });

  it("prendido, empresa: conserva «Registras a …» delante del texto neutro", async () => {
    render(<RegisterForm cities={CIUDADES} />);
    await irAContactoEmpresa();

    expect(textoDelPaso()).toBe(`Registras a Importadora Pérez. ${NEUTRO}`);
  });

  it("apagado (SDD-0524): promete los avisos por el canal real, correo y push, palabra por palabra", async () => {
    h.prendido = false;
    const { container } = render(<RegisterForm cities={CIUDADES} />);
    await irAContactoPersona();

    expect(textoDelPaso()).toBe(APAGADO);
    // En ninguna parte del formulario se promete un aviso por WhatsApp.
    expect(container.textContent).not.toMatch(PROMESA_WHATSAPP);
  });

  it("apagado, empresa: «Registras a …» y el texto con el canal real", async () => {
    h.prendido = false;
    render(<RegisterForm cities={CIUDADES} />);
    await irAContactoEmpresa();

    expect(textoDelPaso()).toBe(`Registras a Importadora Pérez. ${APAGADO}`);
  });

  it("control: la expresión de la promesa vieja sí reconoce el texto de antes", () => {
    // Sin esto, un `not.toMatch` con una expresión rota pasaría siempre.
    expect(
      "El WhatsApp es por donde te avisamos de tu carga: cuando llega a bodega en China, cuando zarpa y cuando está lista para entrega.",
    ).toMatch(PROMESA_WHATSAPP);
  });
});
