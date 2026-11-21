// @vitest-environment node
/** SDD-0700 · Tapar los datos personales del cliente antes de la llamada al modelo (casos de Venezuela). */
import { describe, expect, it } from "vitest";

import { tieneDatosPersonales } from "@/lib/news/autopublicar/control";

import { detectorDelCable } from "../cable-textos";
import { revisarRespuesta } from "../eval-automatico";
import { AVISO_DATOS_TAPADOS, armarEntrada } from "../despachador";
import { GUIONES_SOPORTE, type Guion } from "../guiones-soporte";
import { PALABRAS_DE_CALLE } from "../datos-personales";
import { MARCADORES, quedanDatos, taparDatosPersonales, taparMensajes } from "../tapar-datos";

describe("taparDatosPersonales", () => {
  it.each([
    ["mi teléfono es +58 414 555 1234, gracias", "mi teléfono es [teléfono], gracias"],
    ["llámame al 0414-555-1234", "llámame al [teléfono]"],
    ["o al 0412.555.12.34 en la tarde", "o al [teléfono] en la tarde"],
    ["whatsapp 58-424-5551234", "whatsapp [teléfono]"],
    ["el de mi proveedor en China: +86 138 1234 5678", "el de mi proveedor en China: [teléfono]"],
    ["mi cédula es V-12.345.678", "mi [cédula]"],
    ["envío a V-12.345.678", "envío a [cédula]"],
    ["soy E 1234567", "soy [cédula]"],
    ["C.I. 12345678 a nombre de mi hermana", "[cédula] a nombre de mi hermana"],
    ["la factura sale a J-30123456-7 por favor", "la factura sale a [RIF] por favor"],
    ["RIF V-12345678-9", "RIF [RIF]"],
    ["escríbeme a maria.perez@ejemplo.com", "escríbeme a [correo]"],
    ["o a CONTACTO@Ejemplo.com.ve", "o a [correo]"],
  ])("%s", (entrada, esperado) => {
    expect(taparDatosPersonales(entrada)).toBe(esperado);
  });

  it("una dirección se tapa entera hasta el final de la frase, aunque traiga abreviaturas con punto", () => {
    const t = "Hola. Vivo en la Av. Bolívar, Edif. Torre Sur, piso 3, apto 3B, Caracas. ¿Dónde está mi caja?";
    expect(taparDatosPersonales(t)).toBe("Hola. Vivo en la [dirección]. ¿Dónde está mi caja?");
    expect(taparDatosPersonales("Urbanización La Viña, calle 2, casa 14\nGracias")).toBe("[dirección]\nGracias");
    expect(taparDatosPersonales("Envíen a la Calle 5 de Julio, casa 12. Gracias")).toBe("Envíen a la [dirección]. Gracias");
  });

  it("las palabras de calle para estirar hacia atrás no confunden palabras que empiezan igual", () => {
    expect("calle avenida av. av urbanizacion edif. apto sector casa torre".match(PALABRAS_DE_CALLE)).toHaveLength(10);
    expect("avion calleja sectorial casamiento torreon".match(PALABRAS_DE_CALLE)).toBeNull();
  });

  it("varios datos en un mismo mensaje, cada uno con su marcador, y el resto del texto intacto", () => {
    const t = "Soy V-12.345.678, mi correo es ana@ejemplo.com y mi número 0424 555 12 34. ¿Llegó la guía DTD-4521?";
    expect(taparDatosPersonales(t)).toBe("Soy [cédula], mi correo es [correo] y mi número [teléfono]. ¿Llegó la guía DTD-4521?");
  });

  it("el ejemplo de la spec (§3.3)", () => {
    expect(
      taparDatosPersonales("Soy V-12.345.678, vivo en la Av. Bolívar, Edif. Torre Sur, piso 3, Caracas. ¿Llegó la guía DTD-4521?"),
    ).toBe("Soy [cédula], vivo en la [dirección]. ¿Llegó la guía DTD-4521?");
  });

  it("un texto sin datos personales sale igual (la guía, una cifra o un monto no son datos personales)", () => {
    for (const t of ["¿Dónde está mi caja?", "Mandé 3 cajas de 25 kg el 12/11", "La guía es DTD-4521", ""]) {
      expect(taparDatosPersonales(t)).toBe(t);
    }
  });

  it("los marcadores son estables y el detector no los ve como datos personales", () => {
    expect(Object.values(MARCADORES)).toEqual(["[correo]", "[teléfono]", "[cédula]", "[RIF]", "[dirección]"]);
    for (const m of Object.values(MARCADORES)) expect(detectorDelCable(`mi dato es ${m}`)).toBe(false);
    // Tapar dos veces da lo mismo que tapar una.
    const una = taparDatosPersonales("mi correo es ana@ejemplo.com, cédula V-12.345.678");
    expect(taparDatosPersonales(una)).toBe(una);
  });

  it("después de tapar, el detector del cable ya no ve nada en ninguno de los casos", () => {
    const casos = [
      "+58 414 555 1234",
      "0414-555-1234",
      "V-12.345.678",
      "J-30123456-7",
      "maria.perez@ejemplo.com",
      "Calle 5 de Julio, casa 12",
      "+86 138 1234 5678",
    ];
    for (const c of casos) {
      expect(detectorDelCable(c), c).toBe(true);
      expect(detectorDelCable(taparDatosPersonales(c)), c).toBe(false);
    }
  });
});

/** Los casos de la revisión de la #755 (B1, B2, M1 a M3, L2 y L3). Todos los datos son inventados. */
describe("revisión de la #755", () => {
  it.each([
    // B1: la cédula con puntos detrás de la palabra, entera.
    ["cédula 12.345.678", "[cédula]"],
    ["cédula de identidad N° 12.345.678", "[cédula]"],
    ["Cédula: 12.345.678, gracias", "[cédula], gracias"],
    // B2: «C.I.», «CI:» y «cédula es» con puntos.
    ["C.I. 12.345.678", "[cédula]"],
    ["CI: 12.345.678", "[cédula]"],
    ["mi cedula es 12.345.678", "mi [cédula]"],
    // M1: teléfonos fijos.
    ["(0212) 555 01 01", "[teléfono]"],
    ["llamen al 0212-555-0101 en la mañana", "llamen al [teléfono] en la mañana"],
    ["0241-555-0101", "[teléfono]"],
    ["+58 212 555 0101", "[teléfono]"],
    // El móvil sin el 0, separado.
    ["al 414-555-1234", "al [teléfono]"],
    // M3: direcciones con número.
    ["Sector El Paraíso, casa 12", "[dirección]"],
    ["Casa N.º 14, Sector Los Pinos", "[dirección]"],
    ["Vivo en el Sector La Vega, casa 7, Caracas", "Vivo en el [dirección]"],
    ["Residencias Los Pinos, torre B", "[dirección]"],
    ["Av Bolivar casa 3", "[dirección]"],
    // L3: RIF de 7 dígitos y con puntos.
    ["J-1234567-8", "[RIF]"],
    ["RIF J-12.345.678-9", "RIF [RIF]"],
  ])("tapa: %s", (entrada, esperado) => {
    expect(taparDatosPersonales(entrada)).toBe(esperado);
    expect(quedanDatos([{ rol: "cliente", texto: taparDatosPersonales(entrada) }]), entrada).toBe(false);
  });

  it.each([
    // M2: guías de mensajería y dígitos sueltos: no son teléfonos ni cédulas.
    "¿dónde está mi YT2412345678901?",
    "la guía SF1412345678901",
    "JT1234567890123 llegó?",
    "LP00412345678901",
    "773241234567890",
    "guía 4141234567",
    "MSKU1234567 y 1Z999AA10123456784",
    "Pagué 120,50 USD el 12/11/2026 por 0,25 CBM",
    "F-2026-0001 y DTD-A123",
  ])("no toca: %s", (t) => {
    expect(taparDatosPersonales(t)).toBe(t);
  });

  it("un número tapado a medias no pasa: la cola pegada al marcador la ve `quedanDatos`", () => {
    expect(quedanDatos([{ rol: "cliente", texto: "cédula [cédula].345.678" }])).toBe(true);
    expect(quedanDatos([{ rol: "cliente", texto: "mi [teléfono]-0101" }])).toBe(true);
    // Un número suelto después del marcador no es una cola: «llamé al [teléfono] 3 veces».
    expect(quedanDatos([{ rol: "cliente", texto: "llamé al [teléfono] 3 veces" }])).toBe(false);
  });

  it("L2: un borrador que trae un marcador no se guarda (`marcador`)", () => {
    const guion = GUIONES_SOPORTE.find((g) => g.id === "derivar-equipo")!;
    const r = { tipo: "respuesta" as const, acuse: "Entiendo tu consulta.", texto: `Entiendo tu consulta. ${guion.texto}`, guion: guion.id };
    expect(revisarRespuesta(r, GUIONES_SOPORTE)).not.toContain("marcador");
    for (const m of Object.values(MARCADORES)) {
      expect(revisarRespuesta({ ...r, texto: `${r.texto} Te escribimos al ${m}.` }, GUIONES_SOPORTE)).toContain("marcador");
    }
  });

  it("la regla de noticias no cambió, y lo que ella ve el cable también lo ve (salvo números pegados a otro texto)", () => {
    const casos = [
      "maria.perez@ejemplo.com",
      "0414-555-1234",
      "+58 412 1234567",
      "+57 300 555 1234",
      "V-12.345.678",
      "C.I. 12345678",
      "cedula: 1",
      "J-30123456-7",
      "calle 5 con avenida 3",
      "Urb. La Viña, casa 2",
    ];
    for (const c of casos) {
      expect(tieneDatosPersonales(c), c).toBe(true);
      expect(detectorDelCable(c), c).toBe(true);
    }
    // Lo que la Oficina_Virtual separó a propósito: la guía con un 414 adentro la ve noticias y el cable no.
    expect(tieneDatosPersonales("YT2412345678901")).toBe(true);
    expect(detectorDelCable("YT2412345678901")).toBe(false);
    // Y lo que el cable suma no cambió noticias.
    expect(tieneDatosPersonales("(0212) 555 01 01")).toBe(false);
    expect(tieneDatosPersonales("CI: 12.345.678")).toBe(false);
  });
});

describe("taparMensajes y la entrada del agente", () => {
  it("tapa el texto de cada mensaje sin tocar el rol ni el arreglo original", () => {
    const mensajes = [
      { rol: "cliente" as const, texto: "mi correo es ana@ejemplo.com" },
      { rol: "agente" as const, texto: "Gracias, ya lo vi." },
    ];
    const tapados = taparMensajes(mensajes);
    expect(tapados).toEqual([
      { rol: "cliente", texto: "mi correo es [correo]" },
      { rol: "agente", texto: "Gracias, ya lo vi." },
    ]);
    expect(mensajes[0].texto).toBe("mi correo es ana@ejemplo.com");
    expect(quedanDatos(tapados)).toBe(false);
    expect(quedanDatos(mensajes)).toBe(true);
  });

  it("el guion y el conversacion_id no se tocan: solo cambian los mensajes", () => {
    // Un guion de prueba con un correo y un teléfono de DTD: es texto aprobado de la casa y va tal cual.
    const guionConDatos: Guion = {
      ...GUIONES_SOPORTE[0],
      id: "guion-de-prueba",
      texto: "Escríbenos a soporte@dtdcargo.com o al 0414-000-0000.",
    };
    const guiones = [...GUIONES_SOPORTE, guionConDatos];
    const mensajes = taparMensajes([{ rol: "cliente", texto: "soy V-12.345.678, llámame al 0414-555-1234" }]);
    const entrada = armarEntrada(4521, mensajes, guiones);
    expect(entrada.conversacion_id).toBe(4521);
    expect(entrada.guiones).toEqual(guiones.map((g) => ({ id: g.id, cuando: g.cuando, texto: g.texto })));
    expect(entrada.guiones.at(-1)?.texto).toBe("Escríbenos a soporte@dtdcargo.com o al 0414-000-0000.");
    expect(entrada.mensajes).toEqual([{ rol: "cliente", texto: "soy [cédula], llámame al [teléfono]" }]);
    expect(JSON.stringify(entrada)).not.toContain("12.345.678");
  });

  it("el aviso de las instrucciones nombra los mismos marcadores", () => {
    for (const m of Object.values(MARCADORES)) expect(AVISO_DATOS_TAPADOS).toContain(m);
  });
});
