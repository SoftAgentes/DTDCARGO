// @vitest-environment node
/** SDD-0700 · Tapar los datos personales del cliente antes de la llamada al modelo (casos de Venezuela). */
import { describe, expect, it } from "vitest";

import { detectorDelCable } from "../cable-textos";
import { AVISO_DATOS_TAPADOS, armarEntrada } from "../despachador";
import { GUIONES_SOPORTE, type Guion } from "../guiones-soporte";
import { MARCADORES, PALABRAS_DE_CALLE, quedanDatos, taparDatosPersonales, taparMensajes } from "../tapar-datos";

describe("taparDatosPersonales", () => {
  it.each([
    ["mi teléfono es +58 414 555 1234, gracias", "mi teléfono es [teléfono], gracias"],
    ["llámame al 0414-555-1234", "llámame al [teléfono]"],
    ["o al 0412.555.12.34 en la tarde", "o al [teléfono] en la tarde"],
    ["whatsapp 58-424-5551234", "whatsapp [teléfono]"],
    ["el de mi proveedor en China: +86 138 1234 5678", "el de mi proveedor en China: [teléfono]"],
    ["mi cédula es V-12.345.678", "mi cédula es [cédula]"],
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

  it("las palabras de calle salen de la misma expresión de dirección del detector (si cambia de forma, esto cae)", () => {
    expect(PALABRAS_DE_CALLE).not.toBeNull();
    expect("calle avenida av. urbanizacion edif. apto".match(PALABRAS_DE_CALLE!)).toHaveLength(6);
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
