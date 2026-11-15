// @vitest-environment node
/**
 * SDD-0626 §3.1 · La regla de escritura de los textos libres del cable (opción A de la
 * media 1 de la revisión de la #572, con el OK de Sam del 15/11/2026).
 *
 * MUTANTE: el mismo revisor con un detector que no detecta nada tiene que dejar pasar
 * los casos de rechazo; así se ve que los casos dependen de la regla y no de otra cosa.
 * La expresión de identificador tiene que ser la misma que la de los CHECK de la 0541.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tieneDatosPersonales } from "@/lib/news/autopublicar/control";
import { describe, expect, it } from "vitest";
import {
  IDENTIFICADOR_RE,
  TextoDelCableRechazado,
  crearRevisorDeTextos,
  detectorDelCable,
  exigirTextosDelCable,
  revisarTextosDelCable,
  type CodigoTextoCable,
  type TextosDelCable,
} from "../cable-textos";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const MIGRACION = readFileSync(resolve(ROOT, "supabase/migrations/0541_oficina_cable_tablas.sql"), "utf8");

// Ficticios: ninguno es de una persona real.
const RECHAZOS: Array<[string, TextosDelCable, CodigoTextoCable]> = [
  ["correo en el título", { titulo: "Responder a cliente.prueba@ejemplo.test" }, "titulo_con_datos_personales"],
  ["teléfono de Venezuela en el resumen", { resumen: "El cliente dejó el 0414-123.45.67" }, "resumen_con_datos_personales"],
  ["teléfono con +58 en el resumen", { resumen: "Llamar al +58 412 1234567" }, "resumen_con_datos_personales"],
  ["teléfono de China en el resumen", { resumen: "Proveedor: +86 138 1234 5678" }, "resumen_con_datos_personales"],
  ["cédula en el título", { titulo: "Envío de V-12.345.678" }, "titulo_con_datos_personales"],
  ["RIF en el resumen", { resumen: "Factura a J-12345678-9" }, "resumen_con_datos_personales"],
  ["dirección en el resumen", { resumen: "Entregar en la calle 5 con avenida 3" }, "resumen_con_datos_personales"],
  [
    "correo dentro de meta_datos",
    { metaDatos: { inbox: "prueba", cliente: { contactos: ["cliente.prueba@ejemplo.test"] } } },
    "meta_datos_con_datos_personales",
  ],
  ["teléfono como clave de meta_datos", { metaDatos: { "0414-1234567": true } }, "meta_datos_con_datos_personales"],
  ["actor con nombre", { actor: "Juan Pérez" }, "actor_no_es_identificador"],
  ["actor persona sin uuid", { actor: "persona:juan-perez" }, "actor_no_es_identificador"],
  ["asignado_a con nombre", { asignadoA: "María" }, "asignado_a_no_es_identificador"],
];

const UUID_CON_DIGITOS = "0a412345-6789-4abc-8def-012345678901";

describe("SDD-0626 · regla de escritura de los textos del cable", () => {
  it.each(RECHAZOS)("rechaza: %s", (_n, entrada, codigo) => {
    expect(revisarTextosDelCable(entrada)).toContain(codigo);
    expect(() => exigirTextosDelCable(entrada)).toThrow(TextoDelCableRechazado);
  });

  it("deja pasar lo que el cable sí escribe: referencias, identificadores, conteos", () => {
    const limpio: TextosDelCable = {
      titulo: "Responder conversación de prueba",
      resumen: `Acuse enviado con el guión G-01; corrida ${UUID_CON_DIGITOS} terminada en 3 pasos`,
      metaDatos: { inbox: "prueba", conversacion_id: 123, pasos: 3, corrida: UUID_CON_DIGITOS, banderas: ["acuse"] },
      actor: "agente:soporte-chatwoot",
      asignadoA: `persona:${UUID_CON_DIGITOS}`,
    };
    expect(revisarTextosDelCable(limpio)).toEqual([]);
    expect(() => exigirTextosDelCable(limpio)).not.toThrow();
    expect(revisarTextosDelCable({ actor: "sistema:despachador", asignadoA: null, metaDatos: null })).toEqual([]);
  });

  it("un uuid no cuenta como teléfono: sin quitarlo, la regla de noticias lo confundiría", () => {
    expect(tieneDatosPersonales(`corrida ${UUID_CON_DIGITOS}`)).toBe(true);
    expect(revisarTextosDelCable({ resumen: `corrida ${UUID_CON_DIGITOS}` })).toEqual([]);
  });

  it("junta todos los códigos de una sola vez", () => {
    const error = (() => {
      try {
        exigirTextosDelCable({ titulo: "cliente.prueba@ejemplo.test", actor: "Juan" });
      } catch (e) {
        return e;
      }
      return null;
    })();
    expect(error).toBeInstanceOf(TextoDelCableRechazado);
    expect((error as TextoDelCableRechazado).codigos).toEqual(["titulo_con_datos_personales", "actor_no_es_identificador"]);
  });

  it("la expresión de identificador es la misma de los CHECK de la 0541 (actor y asignado_a)", () => {
    const checks = [...MIGRACION.matchAll(/(?:actor|asignado_a) ~ '([^']+)'/g)].map((m) => m[1]);
    expect(checks).toHaveLength(2);
    for (const check of checks) expect(check).toBe(IDENTIFICADOR_RE.source);
  });

  it("mutante: solo con la regla de noticias, el móvil de China agrupado pasa (por eso el cable la complementa)", () => {
    const soloNoticias = crearRevisorDeTextos(tieneDatosPersonales);
    expect(soloNoticias({ resumen: "Proveedor: +86 138 1234 5678" })).toEqual([]);
    expect(detectorDelCable("Proveedor: +86 138 1234 5678")).toBe(true);
    // Y el complemento no confunde conteos ni montos con teléfonos.
    expect(detectorDelCable("3 pasos, +2 reintentos, costo 0.001234 USD")).toBe(false);
  });

  it("mutante: sin el detector de datos personales, los rechazos de texto caen", () => {
    const sinRegla = crearRevisorDeTextos(() => false);
    const deTexto = RECHAZOS.filter(([, , codigo]) => codigo.endsWith("_con_datos_personales"));
    expect(deTexto.length).toBeGreaterThan(0);
    for (const [nombre, entrada, codigo] of deTexto) {
      expect(sinRegla(entrada), nombre).not.toContain(codigo);
    }
  });
});
