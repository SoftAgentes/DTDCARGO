"use server";

/**
 * SDD-0704 F1-A · Acciones de la pantalla «IA»: tope de la Oficina, cuentas con tipo de cobro y tarifas por modelo.
 *
 * El control real está en la base (0570): cada función exige `is_platform_admin()`, el motivo y, para lo que afloja
 * el freno, AAL2 o una autenticación con contraseña de menos de 5 minutos (`ia_exigir_aal2_si`, D-5 de Sam del
 * 2026-11-21: «Pantalla IA: opción A, pedir la contraseña otra vez»). Aquí se avisa antes (los dos candados de
 * siempre), se validan los números y se revisa que el motivo no lleve datos personales, porque queda en la auditoría
 * para siempre. Ninguna acción toca llaves.
 *
 * LA CONTRASEÑA: si el formulario la trae, se vuelve a autenticar con ella (`signInWithPassword`, la sesión queda
 * renovada y su JWT lleva el `amr` que mira la base). Nunca se guarda, nunca va a un log, a la auditoría ni a la URL,
 * y un error de autenticación vuelve solo como «contrasena_incorrecta».
 */
import { redirect } from "next/navigation";

import { createClient } from "@/lib/db/server";
import { esProveedor, proveedorPermitido } from "@/lib/studio/ia/catalogo";
import { codigoDeError, leerNumero } from "@/lib/studio/ia/pantalla";
import { detectorDelCable } from "@/lib/studio/oficina/cable-textos";
import { platformAdminDenial } from "@/lib/studio/platform-admin";
import { moduleEditDenial } from "@/lib/studio/rbac-guard";

const RUTA = "/studio/admin/ia";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MODELO = /^[a-z0-9][a-z0-9._-]{0,63}$/;
type Pestana = "gasto" | "cuentas";

function volver(pestana: Pestana, codigo: string): never {
  const q = new URLSearchParams({ tab: pestana, r: codigo, n: Date.now().toString(36) });
  redirect(`${RUTA}?${q.toString()}`);
}

async function candados(pestana: Pestana, formData: FormData) {
  const supabase = await createClient();
  if (await moduleEditDenial(supabase, "admin")) volver(pestana, "sin_permiso");
  if (await platformAdminDenial(supabase)) volver(pestana, "solo_superadmin");
  await reautenticar(supabase, formData, pestana);
  return supabase;
}

/** D-5: con la contraseña, una autenticación nueva para lo que afloja el freno. Sin contraseña no hace nada. */
async function reautenticar(supabase: Awaited<ReturnType<typeof createClient>>, formData: FormData, pestana: Pestana) {
  const contrasena = formData.get("contrasena");
  if (typeof contrasena !== "string" || contrasena.length === 0) return;
  if (contrasena.length > 200) volver(pestana, "contrasena_incorrecta");
  const { data } = await supabase.auth.getUser();
  const correo = data?.user?.email;
  if (!correo) volver(pestana, "sin_sesion");
  let fallo = true;
  try {
    const { error } = await supabase.auth.signInWithPassword({ email: correo, password: contrasena });
    fallo = Boolean(error);
  } catch {
    fallo = true;
  }
  if (fallo) volver(pestana, "contrasena_incorrecta");
}

function motivoDe(formData: FormData, pestana: Pestana): string {
  const motivo = String(formData.get("motivo") ?? "").trim();
  if (motivo.length < 4 || motivo.length > 200) volver(pestana, "motivo");
  if (detectorDelCable(motivo)) volver(pestana, "motivo_con_datos");
  return motivo;
}

export async function guardarTopeAction(formData: FormData): Promise<void> {
  const supabase = await candados("gasto", formData);
  const tope = leerNumero(formData.get("tope"));
  if (tope === null || tope <= 0) volver("gasto", "invalido");
  const motivo = motivoDe(formData, "gasto");
  const { error } = await supabase.rpc("ia_guardar_tope", { p_funcion: "oficina", p_tope_usd: tope, p_motivo: motivo });
  volver("gasto", error ? codigoDeError(error) : "ok_tope");
}

export async function quitarTopeAction(formData: FormData): Promise<void> {
  const supabase = await candados("gasto", formData);
  const motivo = motivoDe(formData, "gasto");
  const { error } = await supabase.rpc("ia_borrar_tope", { p_funcion: "oficina", p_motivo: motivo });
  volver("gasto", error ? codigoDeError(error) : "ok_tope_quitado");
}

export async function guardarCuentaAction(formData: FormData): Promise<void> {
  const supabase = await candados("cuentas", formData);
  const idCrudo = String(formData.get("id") ?? "");
  const id = idCrudo ? (UUID.test(idCrudo) ? idCrudo : volver("cuentas", "invalido")) : null;
  const alias = String(formData.get("alias") ?? "").trim();
  const proveedor = String(formData.get("proveedor") ?? "");
  const uso = String(formData.get("uso") ?? "");
  const tipoCobro = String(formData.get("tipo_cobro") ?? "");
  const topeCrudo = String(formData.get("tope_llamadas") ?? "").trim();
  const topeLlamadas = topeCrudo ? leerNumero(topeCrudo) : null;
  if (
    alias.length < 2 ||
    alias.length > 60 ||
    !esProveedor(proveedor) ||
    (uso !== "erp" && uso !== "oficina") ||
    (tipoCobro !== "por_token" && tipoCobro !== "plan_fijo") ||
    (topeCrudo && (topeLlamadas === null || !Number.isInteger(topeLlamadas) || topeLlamadas < 1))
  ) {
    volver("cuentas", "invalido");
  }
  if (alias.includes("@") || detectorDelCable(alias)) volver("cuentas", "alias_repetido");
  // D-2: la Oficina lleva conversaciones de clientes; su cuenta nunca es china (la base también lo corta).
  if (uso === "oficina" && !proveedorPermitido("oficina", proveedor)) volver("cuentas", "oficina_china");
  if (tipoCobro === "plan_fijo" && topeLlamadas === null) volver("cuentas", "plan_fijo_sin_tope");
  const motivo = motivoDe(formData, "cuentas");
  const { error } = await supabase.rpc("ia_guardar_cuenta", {
    p_id: id,
    p_alias: alias,
    p_proveedor: proveedor,
    p_uso: uso,
    p_tipo_cobro: tipoCobro,
    p_tope_llamadas: topeLlamadas,
    p_motivo: motivo,
  });
  volver("cuentas", error ? codigoDeError(error) : "ok_cuenta");
}

export async function guardarModeloAction(formData: FormData): Promise<void> {
  const supabase = await candados("cuentas", formData);
  const cuentaId = String(formData.get("cuenta") ?? "");
  const modelo = String(formData.get("modelo") ?? "");
  const conTarifa = formData.get("plan_fijo") !== "1";
  const entrada = conTarifa ? leerNumero(formData.get("entrada")) : null;
  const salida = conTarifa ? leerNumero(formData.get("salida")) : null;
  if (!UUID.test(cuentaId) || !MODELO.test(modelo)) volver("cuentas", "invalido");
  if (conTarifa && (entrada === null || salida === null || entrada <= 0 || salida <= 0 || entrada > 1000 || salida > 1000)) {
    volver("cuentas", "invalido");
  }
  const motivo = motivoDe(formData, "cuentas");
  const { error } = await supabase.rpc("ia_guardar_modelo", {
    p_cuenta_id: cuentaId,
    p_modelo: modelo,
    p_tarifa_entrada: entrada,
    p_tarifa_salida: salida,
    p_motivo: motivo,
  });
  volver("cuentas", error ? codigoDeError(error) : "ok_modelo");
}

export async function quitarModeloAction(formData: FormData): Promise<void> {
  const supabase = await candados("cuentas", formData);
  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) volver("cuentas", "invalido");
  const motivo = motivoDe(formData, "cuentas");
  const { error } = await supabase.rpc("ia_borrar_modelo", { p_id: id, p_motivo: motivo });
  volver("cuentas", error ? codigoDeError(error) : "ok_modelo_quitado");
}
