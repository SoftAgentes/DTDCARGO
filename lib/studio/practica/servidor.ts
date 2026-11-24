import { aplicarEjercicioChina, consultarEtiquetaChina, semillaEjercicioChina, proyectarCajasChina, COMPRA_CHINA, CONSOLIDADOS_CHINA, type ConsolidadoEjercicio, type EtapaLecturaChina } from "./ejercicio-china";
import { aplicarDestino, semillaDestino, validarManifiestosDestino, vistaViajeDestino, type ComandoDestino, type VistaDestinoPersonal } from "./destino";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { aplicarChina, semillaChina, normalizarChina, type ChinaPractica, type ComandoChina } from "./china";
import { aplicarFactura, semillaFacturacion, normalizarFacturacion, type FacturacionPractica, type ComandoFactura } from "./facturacion";
import type { DestinoPractica, OrigenPractica } from "./config";
import { API_PRACTICA, esToken, esUuid, sonPermisosPractica, type VistaPractica, type PermisoPractica } from "./contrato";

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
  registro = { ...registro, documento: normalizarFacturacion(registro.documento) };
  if (!comando) return { ...registro, edicion: permiso.edicion };
  if (registro.revision !== revision) throw new Error("La práctica cambió. Recarga antes de continuar.");
  const documento = aplicarFactura(registro.documento, comando);
  const guardado = await rpc(cfg, "facturacion", { p_sesion: huella(sesion), p_revision: revision, p_documento: documento }) as Registro | null;
  if (!guardado) throw new Error("La práctica cambió. Recarga antes de continuar.");
  return { ...guardado, edicion: permiso.edicion };
}

export async function chinaPersonal(cfg: DestinoPractica, sesion: string, espacio: string, modulo: "cn" | "naviera" | "shipments" | "ve", revision?: number, comando?: ComandoChina, consulta?: string): Promise<{ revision: number; documento: ChinaPractica | null; generacion: number; edicion: boolean; permisos: PermisoPractica[]; consulta?: ReturnType<typeof consultarEtiquetaChina> }> {
  const acceso = await consultarPractica(cfg, sesion, espacio);
  const permisos = acceso?.permisos.filter(p => p.id === "cn" || p.id === "naviera" || p.id === "shipments" || p.id === "ve") ?? [];
  const permiso = permisos.find(p => p.id === modulo) ?? (!comando ? permisos[0] : undefined);
  if (!permiso || (comando && (!permiso.edicion || (comando.accion !== "reiniciar" && (comando.accion === "consolidar" ? modulo !== "naviera" : comando.accion === "embarcar" ? modulo !== "shipments" : ["aduana", "recibir_ve"].includes(comando.accion) ? modulo !== "ve" : modulo !== "cn"))))) throw new Error("No tienes permiso para esta operación.");
  if (comando?.accion === "ejercicio" && (modulo !== "cn" || permiso.ejercicioCn !== true)) throw new Error("No tienes permiso para operar este ejercicio de China.");
  if (consulta !== undefined && (modulo !== "cn" || permiso.id !== "cn")) throw new Error("No tienes permiso para consultar el documento de China.");
  type Registro = { revision: number; documento: ChinaPractica | null; generacion: number };
  const leer = () => rpc(cfg, "china", { p_sesion: huella(sesion) }) as Promise<Registro>;
  let registro = await leer();
  const respuesta = (r: Registro) => ({...r, documento:r.documento ? {
    generacion:r.documento.generacion, cargas:structuredClone(r.documento.cargas),
    eventos:modulo === "cn" && permiso.id === "cn" ? structuredClone(r.documento.eventos) : [],
    ...(modulo === "cn" && permiso.id === "cn" ? {ejercicio:structuredClone(r.documento.ejercicio)} : {}),
  } : null,edicion:permiso.edicion,permisos});
  if (consulta !== undefined) {
    const documento=registro.documento ?? semillaChina(registro.generacion);
    return {...respuesta({...registro,documento:{...documento,ejercicio:documento.ejercicio ?? semillaEjercicioChina()}}),consulta:consultarEtiquetaChina(documento.ejercicio ?? semillaEjercicioChina(),consulta)};
  }
  if (!registro.documento) {
    const inicial = await rpc(cfg, "china", { p_sesion: huella(sesion), p_revision: registro.revision, p_documento: semillaChina(registro.generacion) }) as Registro | null;
    registro = inicial ?? await leer();
  }
  if (!registro.documento) throw new Error("La práctica cambió. Recarga antes de continuar.");
  const estadoChina = normalizarChina({...registro.documento,ejercicio:registro.documento.ejercicio ?? semillaEjercicioChina()});
  registro.documento=estadoChina;
  if (!comando) return respuesta(registro);
  if (comando.accion === "ejercicio" && registro.documento.ejercicio!.eventos.some(e=>e.id===comando.operacion?.id)) {
    aplicarEjercicioChina(registro.documento.ejercicio!,comando.operacion);
    return respuesta(registro);
  }
  if (registro.revision !== revision) throw new Error("La práctica cambió. Recarga antes de continuar.");
  if (comando.accion === "reiniciar") {
    await reiniciarDesdeOperacion(cfg, sesion, registro.revision);
    return chinaPersonal(cfg, sesion, espacio, modulo);
  }
  if (comando.accion === "ejercicio" && comando.envio !== COMPRA_CHINA) throw new Error("Ejercicio de práctica desconocido.");
  const documento = comando.accion === "ejercicio" ? {...estadoChina,ejercicio:aplicarEjercicioChina(registro.documento.ejercicio!,comando.operacion)} : aplicarChina(estadoChina, comando);
  if (documento.destino) validarManifiestosDestino(documento.destino, viajesDeOrigen(documento));
  const guardado = await rpc(cfg, "china", { p_sesion: huella(sesion), p_revision: revision, p_documento: documento });
  if (!guardado) throw new Error("La práctica cambió. Recarga antes de continuar.");
  return respuesta(guardado as Registro);
}

export async function reiniciarDesdeOperacion(cfg: DestinoPractica, sesion: string, revision: number) {
  const previo = await rpc(cfg, "facturacion", { p_sesion: huella(sesion) }) as { revision: number; documento: FacturacionPractica } | null;
  const documento = aplicarFactura(previo?.documento ?? semillaFacturacion(), { accion: "reiniciar", codigo: "espacio" });
  const guardado = await rpc(cfg, "reiniciar", { p_sesion: huella(sesion), p_revision: revision, p_fin_revision: previo?.revision ?? -1, p_documento: documento });
  if (!guardado) throw new Error("La práctica cambió. Recarga antes de continuar.");
}

export async function leerCajasChina(cfg: DestinoPractica, sesion: string, espacio: string, consolidado: ConsolidadoEjercicio, etapa: EtapaLecturaChina) {
  const acceso=await consultarPractica(cfg,sesion,espacio);
  const permiso=acceso?.permisos.find(p=>p.id===etapa);
  if (!permiso) throw new Error("No tienes permiso para consultar esta etapa.");
  const registro=await rpc(cfg,"china",{p_sesion:huella(sesion)}) as {revision:number;documento:ChinaPractica|null;generacion:number};
  return {revision:registro.revision,generacion:registro.generacion,etapa,consolidado,cajas:proyectarCajasChina(registro.documento?.ejercicio ?? semillaEjercicioChina(),consolidado,etapa),incidenciaDestino:permiso.incidenciaDestino === true,edicion:permiso.edicion};
}

function viajesDeOrigen(documento: ChinaPractica) {
  return CONSOLIDADOS_CHINA.map(consolidado=>({consolidado,cajas:proyectarCajasChina(documento.ejercicio ?? semillaEjercicioChina(),consolidado,"shipments").map(c=>c.codigo)}));
}
export async function destinoPersonal(cfg: DestinoPractica, sesion: string, espacio: string, consolidado: ConsolidadoEjercicio,
  etapa: EtapaLecturaChina, revision?: number, comando?: ComandoDestino, intento=0):Promise<VistaDestinoPersonal> {
  // El contrato común revalida identidad/capacidad y devuelve solo la vista permitida.
  const vista=await leerCajasChina(cfg,sesion,espacio,consolidado,etapa);
  type Registro={revision:number;generacion:number;documento:ChinaPractica|null};
  const registro=await rpc(cfg,"china",{p_sesion:huella(sesion)}) as Registro;
  if (registro.revision !== vista.revision || registro.generacion !== vista.generacion) throw new Error("La práctica cambió. Recarga antes de continuar.");
  const actual=registro.documento?.destino ?? semillaDestino(registro.generacion);
  const presentar=(estado:typeof actual,version=registro.revision):VistaDestinoPersonal=>({...vista,revision:version,
    viaje:vistaViajeDestino(estado,consolidado,etapa,vista.incidenciaDestino)});
  if (!comando) return presentar(actual);
  if (comando.consolidado !== consolidado) throw new Error("La solicitud corresponde a otro consolidado.");
  const permisos={embarcar:etapa === "shipments" && vista.edicion,registrarLlegada:etapa === "ve" && vista.edicion,
    recibirCajas:etapa === "ve" && vista.edicion,gestionarIncidencia:vista.edicion && vista.incidenciaDestino};
  const nuevo=aplicarDestino(actual,comando,{generacion:registro.generacion,viajes:viajesDeOrigen(registro.documento ?? semillaChina(registro.generacion)),permisos,fecha:new Date().toISOString()});
  if (nuevo === actual) return presentar(actual);
  if (registro.revision !== revision || !registro.documento) throw new Error("La práctica cambió. Recarga antes de continuar.");
  const documento={...registro.documento,destino:nuevo};
  const guardado=await rpc(cfg,"china",{p_sesion:huella(sesion),p_revision:revision,p_documento:documento}) as Registro|null;
  if (!guardado) {
    if (intento === 0) return destinoPersonal(cfg,sesion,espacio,consolidado,etapa,revision,comando,1);
    throw new Error("La práctica cambió. Recarga antes de continuar.");
  }
  return presentar(nuevo,guardado.revision);
}
