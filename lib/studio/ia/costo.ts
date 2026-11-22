/**
 * SDD-0704 §7 · El costo de la Oficina con la configuración de la pantalla.
 *
 * DATA PURA: recibe lo que devuelve `ia_costo_oficina()` (0570) y los valores del entorno, y decide el tope, la
 * tarifa de cada llamada y si la cuenta es de plan fijo. Sin la 0570, o sin configuración en la pantalla, todo
 * queda como hoy (variables de entorno, `despachador-config.ts`).
 *
 * Reglas (§7.2 y §7.3):
 *   · tope efectivo = el de la pantalla, si no el del entorno; siempre recortado al techo del código;
 *   · tarifa = la del modelo que respondió (`modelo_usado`, SDD-0702); si no consta o no está declarado, la MÁS
 *     ALTA de los modelos declarados de la cuenta (estimación conservadora); sin modelos declarados, la del entorno;
 *   · plan fijo = 0 USD por llamada, con su propio tope de llamadas del mes.
 */

export interface Precios {
  entradaPorMTok: number;
  salidaPorMTok: number;
}

export interface ModeloConTarifa {
  proveedor: string;
  modelo: string;
  entrada: number | null;
  salida: number | null;
}

export interface CostoOficinaDeLaBase {
  topeUsd: number | null;
  cuenta: { tipoCobro: "por_token" | "plan_fijo"; topeLlamadasMes: number | null } | null;
  modelos: ModeloConTarifa[];
}

export interface CostoAplicado {
  /** La 0570 está en la base: se pueden escribir los tokens de cada llamada. */
  conTokens: boolean;
  topeMensualUsd: number;
  /** Plan fijo: el tope de llamadas del mes. null = por token (o sin cuenta). */
  topeLlamadasMes: number | null;
  /** De dónde salió cada valor, para la pantalla. */
  origenTope: "pantalla" | "entorno";
  precioDe(modelo: string | null): Precios;
}

function numeroPositivo(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

function obj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** Lee el JSON de `ia_costo_oficina()`. Cualquier forma inesperada → null (manda el entorno). */
export function interpretarCostoOficina(v: unknown): CostoOficinaDeLaBase | null {
  const raiz = obj(v);
  if (!raiz || raiz.version !== 1) return null;
  const c = obj(raiz.cuenta);
  const tipo = c?.tipo_cobro;
  const tipoCobro: "por_token" | "plan_fijo" | null = tipo === "por_token" || tipo === "plan_fijo" ? tipo : null;
  const cuenta = c && tipoCobro ? { tipoCobro, topeLlamadasMes: numeroPositivo(c.tope_llamadas_mes) } : null;
  if (cuenta?.tipoCobro === "plan_fijo" && cuenta.topeLlamadasMes === null) return null;
  const modelos: ModeloConTarifa[] = [];
  for (const m of Array.isArray(raiz.modelos) ? raiz.modelos : []) {
    const f = obj(m);
    if (!f || typeof f.proveedor !== "string" || typeof f.modelo !== "string") continue;
    modelos.push({ proveedor: f.proveedor, modelo: f.modelo, entrada: numeroPositivo(f.entrada), salida: numeroPositivo(f.salida) });
  }
  return { topeUsd: numeroPositivo(raiz.tope_usd), cuenta, modelos };
}

/**
 * ¿El `modelo_usado` que dejó la llamada es este modelo declarado? La 0702 guarda `proveedor/modelo` o solo
 * `modelo`; se compara sin distinguir mayúsculas.
 */
export function esElModelo(declarado: { proveedor: string; modelo: string }, usado: string | null): boolean {
  if (!usado) return false;
  const u = usado.trim().toLowerCase();
  const modelo = declarado.modelo.toLowerCase();
  return u === modelo || u === `${declarado.proveedor.toLowerCase()}/${modelo}` || u.endsWith(`/${modelo}`);
}

export function aplicarCosto(
  base: CostoOficinaDeLaBase | null,
  entorno: { topeMensualUsd: number; precios: Precios; techoUsd: number },
  conTokens: boolean,
): CostoAplicado {
  const desdePantalla = base?.topeUsd ?? null;
  const topeMensualUsd = Math.min(desdePantalla ?? entorno.topeMensualUsd, entorno.techoUsd);
  const planFijo = base?.cuenta?.tipoCobro === "plan_fijo";
  const conTarifa = (base?.modelos ?? []).filter(
    (m): m is ModeloConTarifa & { entrada: number; salida: number } => m.entrada !== null && m.salida !== null,
  );
  const masAlta: Precios | null = conTarifa.length
    ? {
        entradaPorMTok: Math.max(...conTarifa.map((m) => m.entrada)),
        salidaPorMTok: Math.max(...conTarifa.map((m) => m.salida)),
      }
    : null;
  return {
    conTokens,
    topeMensualUsd,
    topeLlamadasMes: planFijo ? (base?.cuenta?.topeLlamadasMes ?? null) : null,
    origenTope: desdePantalla !== null ? "pantalla" : "entorno",
    precioDe(modelo) {
      if (planFijo) return { entradaPorMTok: 0, salidaPorMTok: 0 };
      const declarado = conTarifa.find((m) => esElModelo(m, modelo));
      if (declarado) return { entradaPorMTok: declarado.entrada, salidaPorMTok: declarado.salida };
      return masAlta ?? entorno.precios;
    },
  };
}
