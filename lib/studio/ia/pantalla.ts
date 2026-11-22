/**
 * SDD-0704 F1-A · Lecturas y mensajes de la pantalla «IA» (`/studio/admin/ia`).
 *
 * Lee con la sesión del superadministrador: la RLS de la 0570 solo le deja ver su tenant. Nunca toca llaves. Los
 * errores de la base solo llevan su código; el mensaje para Sam sale de `AVISOS_IA`, no del texto de la base.
 */
import type { createClient } from "@/lib/db/server";

import { type CostoAplicado, aplicarCosto, interpretarCostoOficina } from "./costo";

type StudioClient = Awaited<ReturnType<typeof createClient>>;

export interface CuentaIa {
  id: string;
  alias: string;
  proveedor: string;
  uso: "erp" | "oficina";
  tipoCobro: "por_token" | "plan_fijo";
  topeLlamadasMes: number | null;
}

export interface ModeloIa {
  id: string;
  cuentaId: string;
  proveedor: string;
  modelo: string;
  entrada: number | null;
  salida: number | null;
}

export interface GastoIa {
  funcion: string;
  modelo: string;
  llamadas: number;
  tokensEntrada: number;
  tokensSalida: number;
  costoUsd: number;
}

export interface PantallaIa {
  cuentas: CuentaIa[];
  modelos: ModeloIa[];
  catalogo: Array<{ proveedor: string; modelo: string }>;
  topeOficinaUsd: number | null;
  gasto: GastoIa[];
}

export type Lectura = { ok: true; datos: PantallaIa } | { ok: false; motivo: "sin_migracion" | "error" };

/** Códigos de PostgREST y Postgres que dicen «la tabla o la función no existen todavía». */
export function faltaLa0570(error: { code?: string | null } | null | undefined): boolean {
  const c = error?.code ?? "";
  return c === "42P01" || c === "42883" || c === "PGRST202" || c === "PGRST205";
}

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

export async function leerPantallaIa(supabase: StudioClient): Promise<Lectura> {
  const [cuentas, modelos, catalogo, topes, gasto] = await Promise.all([
    supabase.from("ia_cuentas").select("id, alias, proveedor, uso, tipo_cobro, tope_llamadas_mes").order("alias"),
    supabase.from("ia_modelos").select("id, cuenta_id, proveedor, modelo, tarifa_entrada_usd_mtok, tarifa_salida_usd_mtok").order("modelo"),
    supabase.from("ia_catalogo_modelos").select("proveedor, modelo").order("proveedor").order("modelo"),
    supabase.from("ia_topes").select("funcion, tope_usd"),
    supabase.rpc("ia_gasto_del_mes"),
  ]);
  const errores = [cuentas.error, modelos.error, catalogo.error, topes.error, gasto.error];
  if (errores.some(faltaLa0570)) return { ok: false, motivo: "sin_migracion" };
  if (errores.some(Boolean)) return { ok: false, motivo: "error" };
  const filas = <T>(v: unknown) => (Array.isArray(v) ? (v as T[]) : []);
  return {
    ok: true,
    datos: {
      cuentas: filas<Record<string, unknown>>(cuentas.data).map((c) => ({
        id: String(c.id),
        alias: String(c.alias),
        proveedor: String(c.proveedor),
        uso: c.uso === "oficina" ? "oficina" : "erp",
        tipoCobro: c.tipo_cobro === "plan_fijo" ? "plan_fijo" : "por_token",
        topeLlamadasMes: num(c.tope_llamadas_mes),
      })),
      modelos: filas<Record<string, unknown>>(modelos.data).map((m) => ({
        id: String(m.id),
        cuentaId: String(m.cuenta_id),
        proveedor: String(m.proveedor),
        modelo: String(m.modelo),
        entrada: num(m.tarifa_entrada_usd_mtok),
        salida: num(m.tarifa_salida_usd_mtok),
      })),
      catalogo: filas<Record<string, unknown>>(catalogo.data).map((m) => ({ proveedor: String(m.proveedor), modelo: String(m.modelo) })),
      topeOficinaUsd: num(filas<Record<string, unknown>>(topes.data).find((t) => t.funcion === "oficina")?.tope_usd),
      gasto: filas<Record<string, unknown>>(gasto.data).map((g) => ({
        funcion: String(g.funcion),
        modelo: String(g.modelo),
        llamadas: num(g.llamadas) ?? 0,
        tokensEntrada: num(g.tokens_entrada) ?? 0,
        tokensSalida: num(g.tokens_salida) ?? 0,
        costoUsd: num(g.costo_usd) ?? 0,
      })),
    },
  };
}

/** El costo efectivo de la Oficina con lo que ve la pantalla: el mismo cálculo que hace el despachador. */
export function costoEfectivoOficina(
  datos: PantallaIa,
  entorno: { topeMensualUsd: number; precios: { entradaPorMTok: number; salidaPorMTok: number }; techoUsd: number },
): CostoAplicado {
  const cuenta = datos.cuentas.find((c) => c.uso === "oficina") ?? null;
  const base = interpretarCostoOficina({
    version: 1,
    tope_usd: datos.topeOficinaUsd,
    cuenta: cuenta ? { tipo_cobro: cuenta.tipoCobro, tope_llamadas_mes: cuenta.topeLlamadasMes } : null,
    modelos: cuenta
      ? datos.modelos.filter((m) => m.cuentaId === cuenta.id).map((m) => ({ proveedor: m.proveedor, modelo: m.modelo, entrada: m.entrada, salida: m.salida }))
      : [],
  });
  return aplicarCosto(base, entorno, true);
}

/**
 * Un número escrito por Sam: acepta la coma decimal («2,5», «1.234,50») y el punto («2.5», «0.125»). Con coma, el
 * punto es de miles. Sin coma, algo que parece miles («1.000», «12.500») es ambiguo y se rechaza: nunca se lee
 * «1.000» como 1 (revisión de la #763, M4). Devuelve null si no es un número finito.
 */
export function leerNumero(texto: unknown): number | null {
  const t = String(texto ?? "").trim().replace(/\s/g, "");
  if (!t) return null;
  if (!t.includes(",") && /^[1-9]\d{0,2}(\.\d{3})+$/.test(t)) return null;
  const normal = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  if (!/^\d+(\.\d+)?$/.test(normal)) return null;
  const n = Number(normal);
  return Number.isFinite(n) ? n : null;
}

/** Las cifras de la pantalla, con coma decimal y punto de miles (decisión de Sam del 2026-11-20). */
export function cifra(n: number, decimales = 2): string {
  return new Intl.NumberFormat("es-VE", { minimumFractionDigits: decimales, maximumFractionDigits: decimales }).format(n);
}

export function entero(n: number): string {
  return new Intl.NumberFormat("es-VE", { maximumFractionDigits: 0 }).format(n);
}

/** Del error de la base al código del aviso. Nunca el texto de la base. */
export function codigoDeError(error: { code?: string | null; message?: string | null } | null): string {
  if (!error) return "ok";
  if (faltaLa0570(error)) return "sin_migracion";
  const m = error.message ?? "";
  for (const codigo of [
    "requiere_aal2",
    "solo_superadmin",
    "motivo",
    "sin_sesion",
    "cuenta_inexistente",
    "por_token_sin_tarifa",
    "plan_fijo_con_tarifa",
    "proveedor_distinto_de_la_cuenta",
    "cuenta_con_modelos_no_cambia_de_proveedor",
  ]) {
    if (m.includes(`ia:${codigo}`)) return codigo;
  }
  if (m.includes("ia_cuentas_una_oficina")) return "una_oficina";
  if (m.includes("ia_cuentas_oficina_no_china")) return "oficina_china";
  if (m.includes("ia_cuentas_plan_fijo_con_tope")) return "plan_fijo_sin_tope";
  if (m.includes("ia_topes_techo_oficina")) return "sobre_el_techo";
  if (m.includes("ia_cuentas_tenant_id_alias_key") || m.includes("ia_cuentas_alias_valido")) return "alias_repetido";
  if (error.code === "23503") return "fuera_del_catalogo";
  return "error";
}

export const AVISOS_IA: Readonly<Record<string, string>> = {
  ok_tope: "Tope guardado. El despachador lo usa desde su próxima vuelta (en menos de un minuto).",
  ok_tope_quitado: "Tope quitado. La Oficina vuelve al tope de las variables de entorno.",
  ok_cuenta: "Cuenta guardada.",
  ok_modelo: "Tarifa guardada. Vale desde ahora; lo ya gastado no se recalcula.",
  ok_modelo_quitado: "Modelo quitado de la cuenta.",
  requiere_aal2:
    "Este cambio permite gastar más: escribe tu contraseña en el formulario para confirmarlo (vale 5 minutos). Para bajar el gasto no hace falta.",
  contrasena_incorrecta: "La contraseña no es correcta, así que no se hizo el cambio.",
  solo_superadmin: "Esta pantalla es solo del superadministrador.",
  sin_sesion: "Tu sesión venció. Vuelve a entrar.",
  motivo: "Falta el motivo (de 4 a 200 caracteres, sin espacios al principio ni al final).",
  motivo_con_datos: "El motivo parece llevar datos personales (correo, teléfono, cédula…). Escríbelo sin ellos.",
  invalido: "Faltan datos o un número no se entiende. Usa la coma para los decimales, por ejemplo 2,50.",
  cuenta_inexistente: "Esa cuenta ya no existe. Recarga la página.",
  por_token_sin_tarifa: "Una cuenta por token necesita la tarifa de entrada y de salida de cada modelo.",
  plan_fijo_con_tarifa: "Un plan fijo no lleva tarifa: no suma dólares, cuenta llamadas.",
  proveedor_distinto_de_la_cuenta: "Ese modelo es de otro proveedor que la cuenta.",
  cuenta_con_modelos_no_cambia_de_proveedor: "La cuenta tiene modelos: quítalos antes de cambiarle el proveedor.",
  una_oficina: "Ya hay una cuenta de la Oficina. Edita esa.",
  oficina_china:
    "La Oficina lleva conversaciones de clientes: su cuenta no puede ser de un proveedor chino (regla D-2).",
  plan_fijo_sin_tope: "Un plan fijo necesita su tope de llamadas del mes.",
  sobre_el_techo: "El tope de la Oficina no pasa de 15 USD al mes. Subir el techo es una decisión de Sam con su PR.",
  alias_repetido: "Ya hay una cuenta con ese nombre, o el nombre no vale (de 2 a 60 caracteres y sin @).",
  fuera_del_catalogo:
    "Ese modelo no está en el catálogo. Sumar un modelo es una migración con el OK de Sam; aquí se elige entre los que ya están.",
  sin_migracion: "Falta la migración 0570 en esta base: la Oficina sigue con el tope y la tarifa de las variables de entorno.",
  sin_permiso: "No tienes permiso para cambiar esto.",
  error: "No se pudo guardar. Intenta de nuevo; si sigue pasando, avísale a quien administra el sistema.",
};

export function tonoDelAviso(codigo: string): "exito" | "error" | "atencion" {
  if (codigo.startsWith("ok_")) return "exito";
  if (codigo === "requiere_aal2" || codigo === "sin_migracion") return "atencion";
  return "error";
}
