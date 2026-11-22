/**
 * SDD-0704 F1-B · Lo que lee y valida la pestaña «Funciones»: la cadena de A1 y A2 y el último salto de cada una.
 *
 * Lee con la sesión del superadministrador (la RLS de la 0571 deja ver solo su tenant). Sin la 0571, la pestaña dice
 * que falta la migración y A1 y A2 siguen con su modelo por defecto. DATA PURA salvo `leerFunciones`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { CATALOGO_MODELOS, NOMBRE_DEL_PROVEEDOR, type Proveedor, esProveedor, proveedorPermitido } from "@/lib/studio/ia/catalogo";
import { type FuncionConCadena, MODELO_POR_DEFECTO, type Puesto, TECHO_DE_PUESTOS } from "@/lib/studio/ia/cadena";
import { faltaLa0570 } from "@/lib/studio/ia/pantalla";

export const FUNCIONES_EDITABLES: ReadonlyArray<{ clave: FuncionConCadena; nombre: string; descripcion: string }> = [
  { clave: "a1_noticias", nombre: "A1 · Noticias web", descripcion: "Redacta y traduce las noticias del sitio." },
  { clave: "a2_brief", nombre: "A2 · Brief diario", descripcion: "Resume los números del día para Sam." },
];

export function esFuncionEditable(v: unknown): v is FuncionConCadena {
  return FUNCIONES_EDITABLES.some((f) => f.clave === v);
}

/** Los modelos que se ofrecen en una función: del catálogo, del proveedor de la fase y permitidos por la D-2. */
export function modelosOfrecidos(funcion: FuncionConCadena): Array<{ proveedor: Proveedor; modelo: string; etiqueta: string }> {
  return CATALOGO_MODELOS.filter((m) => m.proveedor === "anthropic" && proveedorPermitido(funcion, m.proveedor)).map((m) => ({
    proveedor: m.proveedor,
    modelo: m.modelo,
    etiqueta: `${m.modelo} · ${NOMBRE_DEL_PROVEEDOR[m.proveedor]}`,
  }));
}

export interface UltimoSalto {
  ts: string;
  puesto: number;
  modelo: string;
  resultado: string;
}

export interface DatosFunciones {
  cadenas: Record<FuncionConCadena, Puesto[]>;
  ultimoSalto: Record<FuncionConCadena, UltimoSalto | null>;
}

export type LecturaFunciones = { ok: true; datos: DatosFunciones } | { ok: false; motivo: "sin_migracion" | "error" };

const vacio = (): DatosFunciones => ({
  cadenas: { a1_noticias: [], a2_brief: [] },
  ultimoSalto: { a1_noticias: null, a2_brief: null },
});

export async function leerFunciones(supabase: SupabaseClient): Promise<LecturaFunciones> {
  const claves = FUNCIONES_EDITABLES.map((f) => f.clave);
  const [cadenas, eventos] = await Promise.all([
    supabase.from("ia_cadenas").select("funcion, puesto, proveedor, modelo").in("funcion", claves).order("puesto"),
    // Un intento que no fue ok es un salto (o el fallo final): el más reciente de cada función.
    supabase
      .from("ia_eventos")
      .select("funcion, ts, puesto, modelo, resultado")
      .in("funcion", claves)
      .neq("resultado", "ok")
      .order("ts", { ascending: false })
      .limit(50),
  ]);
  if (cadenas.error || eventos.error) {
    return { ok: false, motivo: faltaLa0570(cadenas.error) || faltaLa0570(eventos.error) ? "sin_migracion" : "error" };
  }
  const datos = vacio();
  for (const f of (cadenas.data ?? []) as Array<Record<string, unknown>>) {
    if (!esFuncionEditable(f.funcion) || !esProveedor(f.proveedor) || typeof f.modelo !== "string") continue;
    datos.cadenas[f.funcion].push({ puesto: Number(f.puesto), proveedor: f.proveedor, modelo: f.modelo });
  }
  for (const e of (eventos.data ?? []) as Array<Record<string, unknown>>) {
    if (!esFuncionEditable(e.funcion) || datos.ultimoSalto[e.funcion]) continue;
    datos.ultimoSalto[e.funcion] = {
      ts: String(e.ts),
      puesto: Number(e.puesto),
      modelo: String(e.modelo),
      resultado: String(e.resultado),
    };
  }
  return { ok: true, datos };
}

/**
 * Lo que manda el formulario: `puesto_1` (obligatorio), `puesto_2` y `puesto_3`, cada uno «proveedor/modelo» o vacío.
 * Devuelve la cadena en orden, o el código del aviso si no vale.
 */
export function cadenaDelFormulario(
  funcion: FuncionConCadena,
  valores: Array<string | null>,
): { ok: true; proveedores: string[]; modelos: string[] } | { ok: false; codigo: "cadena_invalida" | "no_permitido" | "repetido" } {
  const llenos = valores.slice(0, TECHO_DE_PUESTOS).map((v) => (typeof v === "string" ? v.trim() : ""));
  if (!llenos[0]) return { ok: false, codigo: "cadena_invalida" };
  // Un puesto vacío entre dos llenos no vale: la cadena va en orden.
  const ultimoLleno = llenos.reduce((u, v, i) => (v ? i : u), -1);
  if (llenos.slice(0, ultimoLleno + 1).some((v) => !v)) return { ok: false, codigo: "cadena_invalida" };
  const proveedores: string[] = [];
  const modelos: string[] = [];
  const ofrecidos = modelosOfrecidos(funcion);
  for (const v of llenos.filter(Boolean)) {
    const [proveedor, modelo, ...resto] = v.split("/");
    if (resto.length || !proveedor || !modelo) return { ok: false, codigo: "cadena_invalida" };
    // D-2 y fase: solo lo que la lista ofrece, aunque el formulario llegue manipulado.
    if (!ofrecidos.some((o) => o.proveedor === proveedor && o.modelo === modelo)) return { ok: false, codigo: "no_permitido" };
    if (modelos.includes(modelo)) return { ok: false, codigo: "repetido" };
    proveedores.push(proveedor);
    modelos.push(modelo);
  }
  return { ok: true, proveedores, modelos };
}

/** Del error de la base al código del aviso de esta pestaña. Nunca el texto de la base. */
export function codigoDeErrorDeCadena(error: { code?: string | null; message?: string | null } | null): string {
  if (!error) return "ok_cadena";
  if (faltaLa0570(error)) return "sin_migracion";
  const m = error.message ?? "";
  for (const codigo of ["solo_superadmin", "motivo", "sin_sesion", "funcion_no_editable", "cadena_invalida"]) {
    if (m.includes(`ia:${codigo}`)) return codigo;
  }
  if (m.includes("ia_cadenas_sin_repetir")) return "repetido";
  if (m.includes("ia_cadenas_datos_no_chino")) return "no_permitido";
  if (error.code === "23503") return "fuera_del_catalogo";
  return "error";
}

export const AVISOS_FUNCIONES: Readonly<Record<string, string>> = {
  ok_cadena: "Cadena guardada. Vale desde la próxima llamada de esa función.",
  cadena_invalida: "La cadena necesita el 1.º puesto y va en orden: no dejes un puesto vacío entre dos llenos.",
  repetido: "Un modelo no puede estar en dos puestos de la misma cadena.",
  no_permitido:
    "Ese modelo no se puede usar en esta función. En esta fase la cadena usa modelos de Anthropic, y una función con datos de clientes nunca usa un proveedor chino (regla D-2).",
  funcion_no_editable: "Esa función todavía no se elige desde aquí.",
};

export function descripcionDelResultado(resultado: string): string {
  switch (resultado) {
    case "proveedor_caido":
      return "el proveedor no respondió";
    case "falta_de_pago":
      return "falta de saldo o de pago";
    case "cuenta_suspendida":
      return "cuenta suspendida";
    case "llave_invalida":
      return "llave no válida";
    case "limite_de_uso":
      return "límite de uso";
    default:
      return "otro error";
  }
}

export { MODELO_POR_DEFECTO };
