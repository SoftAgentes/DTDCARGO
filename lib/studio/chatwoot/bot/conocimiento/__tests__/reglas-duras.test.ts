/**
 * SDD-0618 · 7.4 · reglas duras de `dtd-bot`. Puro. Los textos de los casos rojos son
 * inventados; los teléfonos de prueba usan el 555.
 */
import { describe, expect, it } from "vitest";

import { CONTACT } from "@/lib/design-tokens";

import base from "../base.json";
import { comprobarSalida, disparadoresDeEntrada, type ReglaSalida } from "../reglas-duras";

const TELEFONOS_DTD = [CONTACT.ve.whatsappRaw, CONTACT.ve.phoneRaw];

function reglas(texto: string): ReglaSalida[] {
  const r = comprobarSalida(texto, TELEFONOS_DTD);
  return r.ok ? [] : r.reglas;
}

describe("la base aprobada pasa las reglas duras (no son más estrictas que lo que Sam aprobó)", () => {
  it.each(base.fichas.map((f) => [f.id, f.texto] as const))("ficha %s", (_id, texto) => {
    expect(reglas(texto)).toEqual([]);
  });

  it("hay fichas que mirar (el contrato no corre sobre una lista vacía)", () => {
    expect(base.fichas.length).toBeGreaterThanOrEqual(30);
  });
});

describe("comprobarSalida: lo que bloquea", () => {
  it.each<[ReglaSalida, string]>([
    ["vacia", "   "],
    ["direccion_completa", "Envía a 浙江省义乌市义乌港二期直通仓2栋2号 货7-货11"],
    ["direccion_completa", "La bodega es Warehouse 2, Cargo 7-11"],
    ["direccion_completa", "Contacto de bodega: Lin Guan"],
    ["direccion_completa", "Código postal 322000"],
    ["termino_retirado", "Nuestro servicio DDP incluye todo"],
    ["termino_retirado", "Tenemos financiamiento 100% para ti"],
    ["termino_retirado", "Trabajamos con prepago"],
    ["termino_retirado", "Operamos desde 2008 en Venezuela"],
    ["termino_retirado", "Fuimos fundados en 2010"],
    ["anos_fijos", "Tenemos 18 años de experiencia"],
    ["anos_fijos", "Más de 15 años en el mercado"],
    ["monto", "El envío te sale en US$ 350"],
    ["monto", "Son 120 dólares por CBM"],
    ["monto", "Cuesta $99"],
    ["monto", "Pagas 500 Bs"],
    ["monto", "Unos 2.000 RMB"],
    ["estado_de_carga", "Tu carga ya está en Valencia"],
    ["estado_de_carga", "Tu envío salió ayer de Ningbo"],
    ["estado_de_carga", "Llega el 15 de diciembre"],
    ["pide_dato_sensible", "Envíame tu cédula para registrarte"],
    ["pide_dato_sensible", "Pásame la foto de tu cédula"],
    ["pide_dato_sensible", "Dime tu contraseña del portal"],
    ["pide_dato_sensible", "Necesito el número de tu tarjeta"],
    ["documento_de_identidad", "Tu cédula V-12.345.678 quedó anotada"],
    ["documento_de_identidad", "RIF J-12345678-9"],
    ["enlace_no_permitido", "Mira https://ejemplo-falso.net/oferta"],
    ["enlace_no_permitido", "Escríbele a ventas@otro-dominio.com"],
    ["enlace_no_permitido", "Entra a bit.ly/abc"],
    ["telefono_no_permitido", "Llama al +58 412 555 0101"],
    ["telefono_no_permitido", "Escribe al 0414-5550101"],
  ])("%s: %s", (regla, texto) => {
    expect(reglas(texto)).toContain(regla);
  });

  it("junta todas las reglas que fallan y no devuelve el texto", () => {
    const r = comprobarSalida("Cuesta $99 y te escribe el +58 412 555 0101", TELEFONOS_DTD);
    expect(r).toEqual({ ok: false, reglas: ["monto", "telefono_no_permitido"] });
    expect(JSON.stringify(r)).not.toContain("99");
  });
});

describe("comprobarSalida: lo que deja pasar", () => {
  it.each([
    "Calcula tu estimado en dtdcargo.com/tarifas",
    "Regístrate en **www.dtdcargo.com/registro**",
    "Escríbenos a info@dtdcargo.com",
    `Nuestro WhatsApp: +${CONTACT.ve.whatsappRaw}`,
    `WhatsApp ${CONTACT.ve.whatsapp}`,
    "Síguenos en https://www.instagram.com/dtdcargo.ve/ y en TikTok @dtdcargo.ve",
    "Tarda 60 a 90 días por barco, con salidas cada 15-21 días",
    "Tu carga va en barco.",
    "No tienes que inventar ninguna contraseña",
    "Te atendemos de 8:00 a.m. a 8:00 p.m.",
    "Tu Shipping Mark es como DTD-1014",
    "Dirección de referencia: Yiwu Port Phase II, Warehouse 2, No. 2, Yiwu City, Zhejiang, China",
    "Operamos en Venezuela desde 2015; en el comercio con China desde 2008",
  ])("%s", (texto) => {
    expect(reglas(texto)).toEqual([]);
  });
});

describe("disparadoresDeEntrada", () => {
  it.each([
    ["Quiero hablar con una persona", ["pide_persona"]],
    ["¿Eres un bot?", ["pide_persona"]],
    ["necesito un asesor por favor", ["pide_persona"]],
    ["Quiero cambiar el destinatario de mi envío", ["cambio_de_destinatario"]],
    ["¿Puedo cambiar la dirección de entrega?", ["cambio_de_destinatario"]],
    ["Hola, ¿cuánto tarda un envío?", []],
    ["¿Cómo me registro?", []],
  ])("%s → %j", (texto, esperado) => {
    expect(disparadoresDeEntrada(texto)).toEqual(esperado);
  });
});
