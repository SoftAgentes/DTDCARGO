import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { DestinoPractica, OrigenPractica } from "./config";
import { API_PRACTICA, esToken, esUuid, MODULOS_PRACTICA, type PermisoPractica, type VistaPractica } from "./contrato";

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

function sonPermisos(value: unknown): value is PermisoPractica[] {
  return Array.isArray(value) && value.every(p => p && MODULOS_PRACTICA.some(m => m.id === p.id) && typeof p.edicion === "boolean");
}

export async function espacioDeSesion(cfg: DestinoPractica, sesion: string) {
  const registro = await rpc(cfg, "sesion", { p_sesion: huella(sesion) });
  if (!registro || typeof registro !== "object" || !("espacio" in registro) || !esUuid(registro.espacio)
      || !("referencia" in registro) || typeof registro.referencia !== "string") return null;
  return { espacio: registro.espacio, referencia: registro.referencia };
}

export async function consultarPractica(cfg: DestinoPractica, sesion: string, esperado?: string): Promise<VistaPractica | null> {
  const registro = await espacioDeSesion(cfg, sesion);
  if (!registro || (esperado && registro.espacio !== esperado)) return null;
  const vivo = await pedir(cfg.real + API_PRACTICA + "permisos", cfg.canal, { referencia: registro.referencia });
  if (!vivo || typeof vivo !== "object" || !("permisos" in vivo) || !sonPermisos(vivo.permisos)) return null;
  return { espacio: registro.espacio, permisos: vivo.permisos };
}
