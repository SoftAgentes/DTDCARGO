import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { aplicarChina, semillaChina, type ChinaPractica, type ComandoChina } from "./china";
import { aplicarFactura, semillaFacturacion, type FacturacionPractica, type ComandoFactura } from "./facturacion";
import type { DestinoPractica, OrigenPractica } from "./config";
import { API_PRACTICA, esToken, esUuid, sonPermisosPractica, type VistaPractica } from "./contrato";

const huella = (valor: string) => createHash("sha256").update(valor).digest("hex");
const token = () => randomBytes(32).toString("hex");

export function canalValido(header: string | null, secreto: string): boolean {
  const recibido = header?.startsWith("Bearer ") ? header.slice(7) : null;
  return esToken(recibido) && timingSafeEqual(Buffer.from(recibido, "hex"), Buffer.from(secreto, "hex"));
}

async function pedir(url: string, secreto: string, datos: object): Promise<unknown> {
  const respuesta = await fetch(url, {
    method: "POST", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5000),
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + secreto },
    body: JSON.stringify(datos),
  });
  if (!respuesta.ok) throw new Error("Servicio de práctica indisponible");
  return respuesta.json();
}

function rpc(cfg: DestinoPractica, op: string, datos: object) {
  // PostgREST dedicado, sin acceso desde el navegador. Todas sus funciones verifican la instancia.
  return pedir(cfg.rest + "/rpc/practica_" + op, cfg.tokenDatos, { ...datos, p_instancia: cfg.instancia });
}

export async function emitirEnDestino(cfg: OrigenPractica, identidad: { propietario: string; referencia: string }) {
  const res = await pedir(cfg.prueba + API_PRACTICA + "reservar", cfg.canal, identidad);
  if (!res || typeof res !== "object" || !("pase" in res) || !esToken(res.pase)) throw new Error("Destino sin confirmar");
  return res.pase;
}

export async function reservar(cfg: DestinoPractica, propietario: string, referencia: string) {
  const pase = token();
  if (await rpc(cfg, "reservar", { p_huella: huella(pase), p_propietario: propietario, p_referencia: referencia }) !== true) {
    throw new Error("El destino no confirmó el pase");
  }
  return pase;
}

export async function canjear(cfg: DestinoPractica, pase: string) {
  const sesion = token();
  const ok = await rpc(cfg, "canjear", { p_huella: huella(pase), p_sesion: huella(sesion) });
  return ok === true ? sesion : null;
}

export async function cerrar(cfg: DestinoPractica, sesion: string) {
  if (await rpc(cfg, "cerrar", { p_sesion: huella(sesion) }) !== true) throw new Error("Cierre pendiente");
}

export async function espacioDeSesion(cfg: DestinoPractica, sesion: string) {
  const registro = await rpc(cfg, "sesion", { p_sesion: huella(sesion) });
  if (registro === null) return null;
  if (!registro || typeof registro !== "object" || !("espacio" in registro) || !esUuid(registro.espacio)
      || !("referencia" in registro) || typeof registro.referencia !== "string") throw new Error("Respuesta de sesión inválida");
  return { espacio: registro.espacio, referencia: registro.referencia };
}

export async function consultarPractica(cfg: DestinoPractica, sesion: string, esperado?: string): Promise<VistaPractica | null> {
  const registro = await espacioDeSesion(cfg, sesion);
  if (!registro || (esperado && registro.espacio !== esperado)) return null;
  const vivo = await pedir(cfg.real + API_PRACTICA + "permisos", cfg.canal, { referencia: registro.referencia });
  if (vivo && typeof vivo === "object" && "permisos" in vivo && vivo.permisos === null) return null;
  if (!vivo || typeof vivo !== "object" || !("permisos" in vivo) || !sonPermisosPractica(vivo.permisos)) throw new Error("Respuesta de permisos inválida");
  return { espacio: registro.espacio, permisos: vivo.permisos };
}

export async function facturacionPersonal(cfg: DestinoPractica, sesion: string, espacio: string, revision?: number, comando?: ComandoFactura) {
  const acceso = await consultarPractica(cfg, sesion, espacio);
  const permiso = acceso?.permisos.find(p => p.id === "invoices");
  if (!permiso || (comando && !permiso.edicion)) throw new Error("No tienes permiso para esta operación.");
  type Registro = { revision: number; documento: FacturacionPractica };
  const leer = () => rpc(cfg, "facturacion", { p_sesion: huella(sesion) }) as Promise<Registro | null>;
  let registro = await leer();
  if (!registro) {
    registro = await rpc(cfg, "facturacion", { p_sesion: huella(sesion), p_revision: -1, p_documento: semillaFacturacion() }) as Registro | null;
    if (!registro) registro = await leer();
  }
  if (!registro) throw new Error("No se pudo preparar tu práctica.");
  if (!comando) return { ...registro, edicion: permiso.edicion };
  if (registro.revision !== revision) throw new Error("La práctica cambió. Recarga antes de continuar.");
  const documento = aplicarFactura(registro.documento, comando);
  const guardado = await rpc(cfg, "facturacion", { p_sesion: huella(sesion), p_revision: revision, p_documento: documento }) as Registro | null;
  if (!guardado) throw new Error("La práctica cambió. Recarga antes de continuar.");
  return { ...guardado, edicion: permiso.edicion };
}

export async function chinaPersonal(cfg: DestinoPractica, sesion: string, espacio: string, modulo: "cn" | "naviera", revision?: number, comando?: ComandoChina): Promise<{ revision: number; documento: ChinaPractica | null; generacion: number; edicion: boolean; permisos: PermisoPractica[] }> {
  const acceso = await consultarPractica(cfg, sesion, espacio);
  const permisos = acceso?.permisos.filter(p => p.id === "cn" || p.id === "naviera") ?? [];
  const permiso = permisos.find(p => p.id === modulo) ?? (!comando ? permisos[0] : undefined);
  if (!permiso || (comando && (!permiso.edicion || (comando.accion !== "reiniciar" && (comando.accion === "consolidar" ? modulo !== "naviera" : modulo !== "cn"))))) throw new Error("No tienes permiso para esta operación.");
  type Registro = { revision: number; documento: ChinaPractica | null; generacion: number };
  const leer = () => rpc(cfg, "china", { p_sesion: huella(sesion) }) as Promise<Registro>;
  let registro = await leer();
  if (!registro.documento) {
    const inicial = await rpc(cfg, "china", { p_sesion: huella(sesion), p_revision: registro.revision, p_documento: semillaChina(registro.generacion) }) as Registro | null;
    registro = inicial ?? await leer();
  }
  if (!registro.documento) throw new Error("La práctica cambió. Recarga antes de continuar.");
  if (!comando) return { ...registro, edicion: permiso.edicion, permisos };
  if (registro.revision !== revision) throw new Error("La práctica cambió. Recarga antes de continuar.");
  if (comando.accion === "reiniciar") {
    await reiniciarDesdeOperacion(cfg, sesion, registro.revision);
    return chinaPersonal(cfg, sesion, espacio, modulo);
  }
  const documento = aplicarChina(registro.documento, comando);
  const guardado = await rpc(cfg, "china", { p_sesion: huella(sesion), p_revision: revision, p_documento: documento });
  if (!guardado) throw new Error("La práctica cambió. Recarga antes de continuar.");
  return { ...guardado as Registro, edicion: permiso.edicion, permisos };
}

export async function reiniciarDesdeOperacion(cfg: DestinoPractica, sesion: string, revision: number) {
  const previo = await rpc(cfg, "facturacion", { p_sesion: huella(sesion) }) as { revision: number; documento: FacturacionPractica } | null;
  const documento = aplicarFactura(previo?.documento ?? semillaFacturacion(), { accion: "reiniciar", codigo: "espacio" });
  const guardado = await rpc(cfg, "reiniciar", { p_sesion: huella(sesion), p_revision: revision, p_fin_revision: previo?.revision ?? -1, p_documento: documento });
  if (!guardado) throw new Error("La práctica cambió. Recarga antes de continuar.");
}
