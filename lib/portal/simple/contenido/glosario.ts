/**
 * SDD-0654 fase 2 · Glosario de la Vista simple (§6, «Glosario en línea»).
 *
 * Las palabras que el cliente no tiene por qué saber, explicadas en una o dos
 * frases. Es contenido revisado: el mismo archivo lo va a leer Faro del cliente
 * (fase 3), así que no lleva datos de nadie ni promesas de fechas o precios.
 *
 * Reglas de copy: tuteo, voz activa, frases cortas. «Contenedor» o
 * «consolidado», nunca «lote». En pantalla se dice «Shipping Mark», nunca
 * «Markbox».
 */

export type EntradaGlosario = {
  /** Clave estable, para enlazarla desde un bloque. */
  id: string;
  /** La palabra tal como la ve el cliente. */
  termino: string;
  /** Qué significa, en palabras sencillas. */
  explicacion: string;
};

export const GLOSARIO: readonly EntradaGlosario[] = Object.freeze([
  {
    id: "shipping-mark",
    termino: "Shipping Mark",
    explicacion:
      "Es tu código de cliente, por ejemplo DTD-1234. Va en cada caja para que el almacén sepa que es tuya.",
  },
  {
    id: "consolidado",
    termino: "Consolidado",
    explicacion:
      "Es un contenedor que compartes con otros clientes. Pagas solo por el espacio que ocupa tu carga.",
  },
  {
    id: "m3",
    termino: "m³ (metro cúbico)",
    explicacion:
      "Es la medida del espacio que ocupa tu carga: largo por ancho por alto. En marítimo se cobra por espacio.",
  },
  {
    id: "packing-list",
    termino: "Lista de empaque",
    explicacion:
      "Es el detalle de lo que viene en cada caja: cuántas piezas, cuánto pesa y cuánto mide. En inglés le dicen «packing list».",
  },
  {
    id: "prealerta",
    termino: "Compra avisada (prealerta)",
    explicacion:
      "Es el aviso que nos das de una compra antes de que llegue al almacén. Así sabemos de quién es cada caja.",
  },
  {
    id: "aduana",
    termino: "Aduana",
    explicacion:
      "Es la oficina del Estado que revisa lo que entra al país. Pide la factura de tu proveedor para dejar pasar la carga.",
  },
]);

export function entradaGlosario(id: string): EntradaGlosario | undefined {
  return GLOSARIO.find((e) => e.id === id);
}
