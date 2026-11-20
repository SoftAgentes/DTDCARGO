/**
 * SDD-0684 fase 2 · `/cookies` y `/privacidad` declaran Microsoft Clarity con el
 * texto EXACTO que Sam aprobó palabra por palabra el 2026-11-20 (opción A, y las
 * correcciones C1, C2 y C3 de ese mismo día; la huella del texto aprobado está en
 * la spec 0684).
 *
 * Se renderiza la página real (Nav, Footer y el botón de WhatsApp se sustituyen)
 * y se busca cada texto en lo que ve el visitante, no en el archivo fuente. Si
 * esta prueba falla porque cambió una palabra, se le vuelve a preguntar a Sam:
 * no se ajusta la prueba.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

vi.mock("@/components/Nav", () => ({ Nav: () => null }));
vi.mock("@/components/Footer", () => ({ Footer: () => null }));
vi.mock("@/components/WhatsAppFAB", () => ({ WhatsAppFAB: () => null }));

const plano = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

afterEach(cleanup);

async function texto(ruta: "cookies" | "privacidad") {
  const mod =
    ruta === "cookies" ? await import("../cookies/page") : await import("../privacidad/page");
  const Page = mod.default;
  return plano(render(<Page />).container.textContent);
}

const COOKIES = [
  "Las herramientas de analítica y publicidad (Google y Microsoft Clarity) arrancan en un modo restringido, sin guardar nada en tu equipo, hasta que das tu consentimiento. En ese modo, Microsoft Clarity igual registra cómo usas cada página por separado (ver sección 3c).",
  // C1 (versión 2, aprobada por Sam el 2026-11-20): GA4 sí carga en /registro y /cotizador.
  "Usamos Google Analytics 4 y Microsoft Clarity solo en las páginas públicas del sitio. Ninguno de los dos carga dentro del Portal del Cliente, en el inicio de sesión ni en páginas cuya dirección contenga datos tuyos (tu número de cliente o Shipping Mark, tokens o enlaces personales). Microsoft Clarity tampoco carga en el registro ni en el cotizador, porque ahí podría grabar lo que escribes; Google Analytics 4 sí cuenta las visitas a esas páginas y si se completa el registro, sin grabar lo que escribes. Esas zonas quedan excluidas para no enviar información personal a terceros.",
  "Qué hace Microsoft Clarity. Clarity nos muestra cómo se usan las páginas: dónde haces clic, hasta dónde bajas y si algo no responde. Para eso reconstruye tu visita a partir de esos movimientos; no graba tu pantalla ni tu cámara. Lo que escribes en formularios, los números y los correos se ocultan en tu navegador, antes de enviarse. Si no aceptas las cookies, Clarity funciona sin ellas: ve cada página por separado y no puede unir tu visita. Microsoft guarda las grabaciones 30 días y los datos de clics y mapas de calor 9 meses.",
  "No compartimos los datos de tu Portal con Google, con Microsoft ni con ninguna plataforma de publicidad o analítica. La analítica del sitio y los datos del Portal están separados. Si algún día quisiéramos medir el uso del Portal, te lo avisaremos antes y cambiaremos primero esta política.",
  "Los terceros que pueden instalar cookies en tu navegador a través de nuestro sitio son Google (Google Analytics 4 y Google Ads) y Microsoft (Clarity), y solo si aceptas las cookies opcionales. Las cookies de Clarity (_clck y _clsk) quedan guardadas bajo nuestro dominio; no permitimos las cookies publicitarias de Microsoft. Puedes consultar cómo tratan la información la política de privacidad de Google, cómo usa Google las cookies y la declaración de privacidad de Microsoft.",
  "Sin consentimiento, Microsoft Clarity solo registra la interacción con cada página por separado, sin cookies, para mejorar el sitio.",
];

const PRIVACIDAD = [
  "Cómo usas las páginas públicas del sitio: clics, desplazamiento y movimiento del puntero, con lo que escribes oculto. Sin cookies, cada página por separado; si aceptas las cookies de analítica, también la visita completa. Ver Política de Cookies.",
  // C3 (aprobada por Sam el 2026-11-20): la medición de campañas también va sin cookies sin consentimiento.
  "Mejorar el sitio, viendo dónde se traban las personas en las páginas públicas (analítica seudónima, sin tu nombre ni tus datos de contacto), y medir nuestras campañas. Sin tu consentimiento, esa medición va sin cookies; la medición con cookies y la unión de tu visita completa son solo si aceptas las cookies correspondientes.",
  // C2 (versión 3, aprobada por Sam el 2026-11-20): sin consentimiento Google recibe avisos sin cookies de visitas y acciones.
  "Herramientas de analítica y publicidad. Google (Analytics y Ads): si no aceptas las cookies opcionales, solo recibe avisos sin cookies, de tus visitas y de acciones como escribirnos por WhatsApp, enviarnos un formulario o completar el registro; sus cookies, solo si las aceptas. Microsoft Clarity, solo en las páginas públicas: registra cómo usas cada página, con lo que escribes oculto. Microsoft trata esos datos también para sus propios fines, según su declaración de privacidad. No le enviamos tu nombre, tu documento, tu correo, tu teléfono ni tu Shipping Mark.",
  "No compartimos la información de tu Portal con plataformas de publicidad ni de analítica. La analítica del sitio público y tus datos de cliente están separados.",
  "Las grabaciones de uso del sitio que guarda Microsoft Clarity se borran a los 30 días, y los datos de clics y mapas de calor a los 9 meses. Clarity no permite borrar la visita de una sola persona antes de esos plazos.",
];

describe("/cookies · Microsoft Clarity (SDD-0684 fase 2)", () => {
  it.each(COOKIES)("trae el texto aprobado: %s", async (frase) => {
    expect(await texto("cookies")).toContain(frase);
  });

  it("lista _clck y _clsk como cookies de analítica de Microsoft Clarity", async () => {
    const { default: Page } = await import("../cookies/page");
    const filas = [...render(<Page />).container.querySelectorAll("tbody tr")].map((tr) =>
      [...tr.querySelectorAll("td")].map((td) => plano(td.textContent)),
    );
    expect(filas).toContainEqual([
      "_clck",
      "Microsoft Clarity",
      "1 año",
      "Reconocer de forma seudónima que es el mismo navegador entre visitas.",
    ]);
    expect(filas).toContainEqual([
      "_clsk",
      "Microsoft Clarity",
      "1 día",
      "Unir las páginas de una misma visita.",
    ]);
  });

  it("ya no promete que Google es el único tercero ni el «nunca» del Portal", async () => {
    const t = await texto("cookies");
    expect(t).not.toContain("El único tercero que puede instalar cookies");
    expect(t).not.toContain("Nunca cargamos analítica");
    // C1: GA4 sí carga en el registro y el cotizador; la frase vieja lo negaba.
    expect(t).not.toContain("No los cargamos dentro del Portal del Cliente, en el registro");
  });
});

describe("/privacidad · Microsoft Clarity (SDD-0684 fase 2)", () => {
  it.each(PRIVACIDAD)("trae el texto aprobado: %s", async (frase) => {
    expect(await texto("privacidad")).toContain(frase);
  });

  it("ya no dice que la navegación se recoge solo con cookies aceptadas", async () => {
    const t = await texto("privacidad");
    expect(t).not.toContain("Datos técnicos anónimos de uso del sitio (solo si aceptas las cookies de analítica)");
    expect(t).not.toContain("(analítica anónima)");
    // C2: la versión 1 decía que Google recibe datos solo con las cookies aceptadas.
    expect(t).not.toContain("Google (Analytics y Ads), solo si aceptas las cookies opcionales");
    // C2 v2 y la v1 de «Mejorar el sitio», reemplazadas por la versión 3.
    expect(t).not.toContain("solo recibe avisos de visita sin cookies");
    expect(t).not.toContain("La medición de campañas y la unión de tu visita completa son solo si aceptas");
  });
});
