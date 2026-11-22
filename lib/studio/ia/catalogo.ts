/**
 * SDD-0704 §3.2 · El catálogo de modelos aprobado por PR.
 *
 * Es la misma lista que siembra la migración 0570 en `ia_catalogo_modelos`; una prueba compara las dos. Sumar un
 * modelo es una migración con OK nominal de Sam: lo que se cambia sin el chat es la elección entre los que ya
 * están aquí. DATA PURA (sin React, sin server-only).
 *
 * Regla D-2 de Sam: los datos de clientes nunca van a un proveedor chino (Z.AI/GLM, DeepSeek). El origen sale del
 * proveedor, nunca del modelo, y la base lo ata con un CHECK.
 */

export const PROVEEDORES = ["anthropic", "openai", "zai", "deepseek"] as const;
export type Proveedor = (typeof PROVEEDORES)[number];

export type Origen = "chino" | "no_chino";

export const ORIGEN_DEL_PROVEEDOR: Readonly<Record<Proveedor, Origen>> = {
  anthropic: "no_chino",
  openai: "no_chino",
  zai: "chino",
  deepseek: "chino",
};

export const NOMBRE_DEL_PROVEEDOR: Readonly<Record<Proveedor, string>> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  zai: "Z.AI (GLM)",
  deepseek: "DeepSeek",
};

export interface ModeloDelCatalogo {
  proveedor: Proveedor;
  modelo: string;
}

/** Igual que el `insert into public.ia_catalogo_modelos` de la 0570, en el mismo orden. */
export const CATALOGO_MODELOS: readonly ModeloDelCatalogo[] = [
  { proveedor: "anthropic", modelo: "claude-opus-5-5" },
  { proveedor: "anthropic", modelo: "claude-sonnet-5-5" },
  { proveedor: "anthropic", modelo: "claude-haiku-5-5" },
  { proveedor: "anthropic", modelo: "claude-sonnet-4-6" },
  { proveedor: "zai", modelo: "glm-5.3" },
  { proveedor: "zai", modelo: "glm-4.6" },
  { proveedor: "deepseek", modelo: "deepseek-chat" },
];

export function esProveedor(v: unknown): v is Proveedor {
  return typeof v === "string" && (PROVEEDORES as readonly string[]).includes(v);
}

export function esChino(proveedor: Proveedor): boolean {
  return ORIGEN_DEL_PROVEEDOR[proveedor] === "chino";
}

export function modelosDe(proveedor: Proveedor): string[] {
  return CATALOGO_MODELOS.filter((m) => m.proveedor === proveedor).map((m) => m.modelo);
}

export function estaEnElCatalogo(proveedor: Proveedor, modelo: string): boolean {
  return CATALOGO_MODELOS.some((m) => m.proveedor === proveedor && m.modelo === modelo);
}

/**
 * Funciones con su marca de datos (0639 §4). En la F1-A solo la Oficina tiene costo en la pantalla; el resto
 * entra con su cadena en la F1-B y las fases siguientes.
 */
export type MarcaDeDatos = "sin_datos" | "solo_shipping_mark" | "con_datos";

export const MARCA_DE_LA_FUNCION: Readonly<Record<string, MarcaDeDatos>> = {
  oficina: "con_datos",
  a1_noticias: "sin_datos",
  a2_brief: "sin_datos",
  a3_actas: "con_datos",
  a4a_resumen_interno: "con_datos",
  a4b_resumen_portal: "con_datos",
  a5_documentos: "con_datos",
  a6_agentes: "con_datos",
  a8_analisis_chatwoot: "sin_datos",
};

/** D-2: en una función con datos de clientes no se ofrece un proveedor chino. */
export function proveedorPermitido(funcion: string, proveedor: Proveedor): boolean {
  const marca = MARCA_DE_LA_FUNCION[funcion];
  if (!marca) return false;
  return marca !== "con_datos" || !esChino(proveedor);
}
