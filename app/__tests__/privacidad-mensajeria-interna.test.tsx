/**
 * SDD-0606 / SDD-0608 · `/privacidad` declara la mensajería interna del equipo
 * con el texto EXACTO que Sam aprobó el 2026-11-06 (por el Director General).
 *
 * Se renderiza la página real (sólo Nav, Footer y el botón de WhatsApp se
 * sustituyen) y se busca cada texto en lo que ve el visitante, no en el
 * archivo fuente. Si esta prueba falla porque cambió una palabra, se le vuelve
 * a preguntar a Sam: no se ajusta la prueba.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

vi.mock("@/components/Nav", () => ({ Nav: () => null }));
vi.mock("@/components/Footer", () => ({ Footer: () => null }));
vi.mock("@/components/WhatsAppFAB", () => ({ WhatsAppFAB: () => null }));

const PARRAFO_4 =
  "Mensajería interna del equipo. Nuestro equipo usa una herramienta de mensajería con servidores en Estados Unidos. Ahí recibe avisos internos con tu Shipping Mark y un enlace a nuestro sistema, sin tu nombre ni tus datos de contacto. Cuando alguien del equipo con permiso para ver clientes busca un cliente por su nombre o por su Shipping Mark, la herramienta le muestra solo a esa persona el nombre y el Shipping Mark de los clientes que coinciden. Tus datos de contacto, tus envíos y tus pagos se consultan solo en nuestro sistema. Esa herramienta se rige por sus propios términos de servicio.";
const FRASE_5 =
  "El nombre y el Shipping Mark que ve nuestro equipo en su herramienta de mensajería interna también pasan por servidores en Estados Unidos.";

const plano = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

afterEach(cleanup);

async function pagina() {
  const { default: PrivacidadPage } = await import("../privacidad/page");
  return render(<PrivacidadPage />).container;
}

function seccion(container: HTMLElement, titulo: string): HTMLElement {
  const h2 = [...container.querySelectorAll("h2")].find((h) => plano(h.textContent).startsWith(titulo));
  if (!h2?.parentElement) throw new Error(`no está la sección «${titulo}»`);
  return h2.parentElement;
}

describe("/privacidad · mensajería interna del equipo (SDD-0606, SDD-0608)", () => {
  it("§4 trae el párrafo aprobado, entero y en un párrafo propio", async () => {
    const s4 = seccion(await pagina(), "4. Con quién compartimos datos");
    const parrafos = [...s4.querySelectorAll("p")].map((p) => plano(p.textContent));
    expect(parrafos).toContain(PARRAFO_4);
  });

  it("el párrafo va fuera de la lista y antes de «No compartimos…»", async () => {
    const s4 = seccion(await pagina(), "4. Con quién compartimos datos");
    expect(plano(s4.querySelector("ul")?.textContent)).not.toContain("Mensajería interna del equipo");
    const parrafos = [...s4.querySelectorAll(":scope > p")].map((p) => plano(p.textContent));
    const propio = parrafos.indexOf(PARRAFO_4);
    const publicidad = parrafos.findIndex((p) => p.startsWith("No compartimos la información de tu Portal"));
    expect(propio).toBeGreaterThan(-1);
    expect(publicidad).toBe(propio + 1);
    expect(s4.querySelector("ul")?.compareDocumentPosition(s4.querySelectorAll(":scope > p")[propio])).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it("§5 cierra su primer párrafo con la frase aprobada", async () => {
    const s5 = seccion(await pagina(), "5. Transferencias internacionales");
    const primero = plano(s5.querySelector("p")?.textContent);
    expect(primero.endsWith(FRASE_5)).toBe(true);
  });

  it("no nombra a la herramienta y la fecha se movió", async () => {
    const texto = plano((await pagina()).textContent);
    expect(texto).not.toMatch(/discord/i);
    expect(texto).toContain("Última actualización: 6 de noviembre de 2026");
  });
});
