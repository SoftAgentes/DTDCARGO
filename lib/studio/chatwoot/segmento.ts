/**
 * Reglas puras del enrutamiento por segmento (SDD-0586, E10). Sin red ni base.
 *
 * El segmento lo decide el ERP (`chatwoot_segmento_contacto`, 0505); acá solo
 * se traduce a etiqueta de Chatwoot y a la respuesta del bot. La respuesta va
 * en UN mensaje (decisión de Sam en 0.8): cada mensaje que sale cuenta contra
 * el cupo de 1.000 gratis al mes del número.
 */

export type Segmento = "cliente" | "lead_registrado" | "lead_nuevo";

/** Etiquetas de Chatwoot por segmento. Chatwoot las guarda en minúscula. */
export const ETIQUETA_SEGMENTO: Readonly<Record<Segmento, string>> = {
  cliente: "cliente",
  lead_registrado: "lead-registrado",
  lead_nuevo: "lead-nuevo",
};

const DE_SEGMENTO: ReadonlySet<string> = new Set(Object.values(ETIQUETA_SEGMENTO));

/**
 * Las etiquetas que tiene que quedar: las que no son de segmento se conservan
 * y la de segmento se reemplaza. `null` si ya están así (no hace falta escribir:
 * el POST de Chatwoot reemplaza todas).
 */
export function etiquetasConSegmento(actuales: readonly string[], segmento: Segmento): string[] | null {
  const propia = ETIQUETA_SEGMENTO[segmento];
  const otras = actuales.filter((e) => !DE_SEGMENTO.has(e));
  const deSegmento = actuales.filter((e) => DE_SEGMENTO.has(e));
  if (deSegmento.length === 1 && deSegmento[0] === propia) return null;
  return [...otras, propia];
}

/** Enlace `wa.me` al número de clientes con un saludo ya escrito. */
export function enlaceClientes(numeroClientes: string): string {
  return `https://wa.me/${numeroClientes}?text=${encodeURIComponent("Hola, soy cliente de DTD Cargo")}`;
}

export interface RespuestaBot {
  tipo: "redireccion_cliente" | "neutra_sin_telefono";
  texto: string;
}

/**
 * Qué responde el bot, sin IA:
 *   - cliente con teléfono → la redirección al número de clientes;
 *   - sin teléfono (10.3) → la respuesta neutra, IGUAL para todos: no dice si
 *     la persona, su número o su código existen;
 *   - lead registrado o nuevo con teléfono → nada (lo atiende el equipo Leads).
 */
export function respuestaPara(segmento: Segmento, sinTelefono: boolean, numeroClientes: string): RespuestaBot | null {
  const enlace = enlaceClientes(numeroClientes);
  if (sinTelefono) {
    return {
      tipo: "neutra_sin_telefono",
      texto:
        `¡Hola! Gracias por escribir a DTD Cargo. Si ya eres cliente, escríbenos por nuestro número de clientes: ${enlace} ` +
        "Si quieres cotizar o conocer nuestros servicios, sigue por aquí y te atendemos.",
    };
  }
  if (segmento === "cliente") {
    return {
      tipo: "redireccion_cliente",
      texto:
        `¡Hola! Como ya eres cliente de DTD Cargo, te atendemos por nuestro número de clientes. Escríbenos aquí: ${enlace}`,
    };
  }
  return null;
}
