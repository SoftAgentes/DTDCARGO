/**
 * SDD-0704 §3-§4 · La cadena de hasta tres modelos por función y el cambio automático.
 *
 * Cada llamada nueva empieza por el puesto 1 (D-2 de Sam). Si falla con una clase que salta (§4.1:
 * `proveedor_caido`, `falta_de_pago`, `cuenta_suspendida`, `llave_invalida`), prueba el siguiente puesto; con
 * cualquier otra clase (un 400, un 429 de ritmo) se detiene y relanza el error ORIGINAL, para que la función siga su
 * salida manual de siempre. Si el último puesto también falla, relanza el último error.
 *
 * Cada intento se anota (resultado `ok` o la clase, status y código; nunca texto). Leer la cadena o anotar un intento
 * nunca rompe la función: sin la 0571, o si la base no responde, vale el modelo por defecto y no se anota nada.
 *
 * F1-B: A1 (noticias) y A2 (brief), con modelos de Anthropic y la llave que ya existe (nivel 1 de la 0639). La
 * Oficina es la fase 1b.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { CATALOGO_MODELOS, type Proveedor, esProveedor, proveedorPermitido } from "./catalogo";
import { type Clase, type ErrorClasificado, clasificarError, entradaDesdeErrorAnthropic, salta } from "./clasificar-error";

/** Techo duro de puestos (§3.1). Está también en la base (CHECK de `ia_cadenas`). */
export const TECHO_DE_PUESTOS = 3;

export type FuncionConCadena = "a1_noticias" | "a2_brief";

/**
 * El modelo de cada función cuando la pantalla no tiene cadena (o falta la 0571). Es el que tenían fijo en el código
 * antes de la 0704. Cambiarlo es una PR; elegir otro sin el chat se hace en la pantalla.
 */
export const MODELO_POR_DEFECTO: Readonly<Record<FuncionConCadena, string>> = {
  a1_noticias: "claude-sonnet-4-6",
  a2_brief: "claude-sonnet-4-6",
};

export interface Puesto {
  puesto: number;
  proveedor: Proveedor;
  modelo: string;
}

export interface Intento {
  puesto: number;
  proveedor: Proveedor;
  modelo: string;
  resultado: "ok" | Clase;
  status: number | null;
  codigo: string | null;
  tokensEntrada: number | null;
  tokensSalida: number | null;
}

/** De dónde sale la cadena y dónde se anotan los intentos. */
export interface FuenteDeCadena {
  /** null = no hay cadena guardada o no se pudo leer: vale el modelo por defecto. */
  leer(funcion: FuncionConCadena): Promise<Puesto[] | null>;
  /** Nunca lanza. */
  registrar(funcion: FuncionConCadena, intento: Intento): Promise<void>;
}

/** En la F1-B la llave que existe es la de Anthropic: la cadena solo usa sus modelos (§11, fase 1). */
const PROVEEDOR_DE_LA_FASE: Proveedor = "anthropic";

/**
 * La cadena que de verdad se recorre: los puestos válidos (del catálogo, del proveedor de la fase, permitidos por la
 * D-2, sin repetir), en orden y hasta el techo. Si no queda ninguno, el modelo por defecto.
 */
export function cadenaEfectiva(funcion: FuncionConCadena, leida: Puesto[] | null): Puesto[] {
  const vistos = new Set<string>();
  const validos = [...(leida ?? [])]
    .sort((a, b) => a.puesto - b.puesto)
    .filter((p) => {
      if (!esProveedor(p.proveedor) || p.proveedor !== PROVEEDOR_DE_LA_FASE) return false;
      if (!proveedorPermitido(funcion, p.proveedor)) return false;
      if (!CATALOGO_MODELOS.some((m) => m.proveedor === p.proveedor && m.modelo === p.modelo)) return false;
      if (vistos.has(p.modelo)) return false;
      vistos.add(p.modelo);
      return true;
    })
    .slice(0, TECHO_DE_PUESTOS)
    .map((p, i) => ({ puesto: i + 1, proveedor: p.proveedor, modelo: p.modelo }));
  return validos.length ? validos : [{ puesto: 1, proveedor: PROVEEDOR_DE_LA_FASE, modelo: MODELO_POR_DEFECTO[funcion] }];
}

export interface Recorrido<T> {
  funcion: FuncionConCadena;
  puestos: Puesto[];
  llamar(modelo: string): Promise<T>;
  clasificar(err: unknown): ErrorClasificado;
  tokens?(respuesta: T): { entrada: number | null; salida: number | null } | null;
  registrar?(intento: Intento): Promise<void>;
}

export async function recorrerCadena<T>(r: Recorrido<T>): Promise<T> {
  const puestos = r.puestos.slice(0, TECHO_DE_PUESTOS);
  if (!puestos.length) throw new Error("cadena vacía");
  let ultimo: unknown;
  for (const [i, p] of puestos.entries()) {
    try {
      const respuesta = await r.llamar(p.modelo);
      const t = r.tokens?.(respuesta) ?? null;
      await r.registrar?.({
        puesto: p.puesto, proveedor: p.proveedor, modelo: p.modelo, resultado: "ok", status: null, codigo: null,
        tokensEntrada: t?.entrada ?? null, tokensSalida: t?.salida ?? null,
      });
      return respuesta;
    } catch (err) {
      ultimo = err;
      const c = r.clasificar(err);
      await r.registrar?.({
        puesto: p.puesto, proveedor: p.proveedor, modelo: p.modelo, resultado: c.clase, status: c.status, codigo: c.codigo,
        tokensEntrada: null, tokensSalida: null,
      });
      const hayOtro = i < puestos.length - 1;
      if (!salta(c.clase) || !hayOtro) throw err;
    }
  }
  throw ultimo;
}

function entero(v: unknown): number | null {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : null;
}

/**
 * Una llamada de Anthropic recorriendo la cadena de la función. `llamar` recibe el modelo del puesto y hace la
 * llamada de siempre (`client.messages.create({ ...params, model })`).
 */
export async function conCadenaAnthropic<T>(opciones: {
  funcion: FuncionConCadena;
  fuente: FuenteDeCadena | null;
  llamar(modelo: string): Promise<T>;
}): Promise<T> {
  const { funcion, fuente, llamar } = opciones;
  let leida: Puesto[] | null = null;
  try {
    leida = fuente ? await fuente.leer(funcion) : null;
  } catch {
    leida = null;
  }
  return recorrerCadena({
    funcion,
    puestos: cadenaEfectiva(funcion, leida),
    llamar,
    clasificar: (err) => clasificarError(entradaDesdeErrorAnthropic(err, funcion)),
    tokens: (respuesta) => {
      const uso = (respuesta as { usage?: { input_tokens?: unknown; output_tokens?: unknown } } | null)?.usage;
      return uso ? { entrada: entero(uso.input_tokens), salida: entero(uso.output_tokens) } : null;
    },
    registrar: fuente
      ? async (intento) => {
          try {
            await fuente.registrar(funcion, intento);
          } catch {
            // Anotar nunca rompe la función.
          }
        }
      : undefined,
  });
}

// ─── Fuentes ─────────────────────────────────────────────────

function puestosDe(data: unknown): Puesto[] | null {
  if (!Array.isArray(data) || data.length === 0) return null;
  const out: Puesto[] = [];
  for (const f of data) {
    const o = f && typeof f === "object" ? (f as Record<string, unknown>) : null;
    if (!o || typeof o.puesto !== "number" || !esProveedor(o.proveedor) || typeof o.modelo !== "string") continue;
    out.push({ puesto: o.puesto, proveedor: o.proveedor, modelo: o.modelo });
  }
  return out.length ? out : null;
}

/** A1: corre con la sesión de quien redacta. Lee y anota por las funciones de la 0571. */
export function fuenteConSesion(supabase: SupabaseClient): FuenteDeCadena {
  return {
    async leer(funcion) {
      const { data, error } = await supabase.rpc("ia_cadena_de", { p_funcion: funcion });
      return error ? null : puestosDe(data);
    },
    async registrar(funcion, i) {
      await supabase.rpc("ia_registrar_evento", {
        p_funcion: funcion,
        p_puesto: i.puesto,
        p_proveedor: i.proveedor,
        p_modelo: i.modelo,
        p_resultado: i.resultado,
        p_status: i.status,
        p_codigo: i.codigo,
        p_tokens_entrada: i.tokensEntrada,
        p_tokens_salida: i.tokensSalida,
      });
    },
  };
}

/** A2: corre en el cron con la clave de servicio. Lee la cadena del tenant y agrega eventos (grants de la 0571). */
export function fuenteDeServicio(admin: SupabaseClient, tenantId: string): FuenteDeCadena {
  return {
    async leer(funcion) {
      const { data, error } = await admin
        .from("ia_cadenas")
        .select("puesto, proveedor, modelo")
        .eq("tenant_id", tenantId)
        .eq("funcion", funcion)
        .order("puesto");
      return error ? null : puestosDe(data);
    },
    async registrar(funcion, i) {
      await admin.from("ia_eventos").insert({
        tenant_id: tenantId,
        funcion,
        puesto: i.puesto,
        proveedor: i.proveedor,
        modelo: i.modelo,
        resultado: i.resultado,
        status: i.status,
        codigo: i.codigo,
        tokens_entrada: i.tokensEntrada,
        tokens_salida: i.tokensSalida,
      });
    },
  };
}
