import { CONSOLIDADOS_CHINA, type ConsolidadoEjercicio } from "@/lib/studio/practica/ejercicio-china";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { readJsonBody } from "@/lib/http/read-json-body";
import { getStudioAccess } from "@/lib/studio/rbac-guard";
import { configuracionPractica } from "@/lib/studio/practica/config";
import { COOKIE_PRACTICA, esToken, esUuid } from "@/lib/studio/practica/contrato";
import { referenciaPrivada, abrirReferencia, permisosVigentes } from "@/lib/studio/practica/identidad";
import { canalValido, emitirEnDestino, reservar, canjear, consultarPractica, cerrar, espacioDeSesion } from "@/lib/studio/practica/servidor";
import { facturacionPersonal } from "@/lib/studio/practica/servidor";
import type { ComandoFactura } from "@/lib/studio/practica/facturacion";
import { chinaPersonal, destinoPersonal } from "@/lib/studio/practica/servidor";
import type { CasoDestino, ComandoDestino } from "@/lib/studio/practica/destino";
import type { ComandoChina } from "@/lib/studio/practica/china";
import { leerCuerpoFinanciero, MAX_CUERPO_ACCESO } from "@/lib/studio/practica/cuerpo";

export const runtime = "nodejs";
const opcionesCookie = { httpOnly: true, secure: true, sameSite: "strict", path: "/" } as const;
function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
}

export async function POST(req: NextRequest, context: { params: Promise<{ operacion: string }> }) {
  const cfg = configuracionPractica();
  if (!cfg) return json(null, 404);
  const { operacion } = await context.params;
  const local = cfg.modo === "origen" ? cfg.real : cfg.prueba;
  if (req.headers.get("host") !== new URL(local).host) return json(null, 403);
  const pares = operacion === "reservar" || operacion === "permisos";
  if (pares ? !canalValido(req.headers.get("authorization"), cfg.canal) : req.headers.get("origin") !== local) return json(null, 403);
  if (req.headers.get("content-type")?.split(";")[0] !== "application/json") return json(null, 415);
  const financiera = cfg.modo === "destino" && operacion === "facturacion";
  const datos = financiera
    ? await leerCuerpoFinanciero(req)
    : await readJsonBody<Record<string, unknown>>(req, MAX_CUERPO_ACCESO);
  if (!datos.ok) return json(financiera && datos.status === 413
    ? { error: "El contenido supera 24 KiB. Acorta los conceptos o el motivo y vuelve a guardar; tus cambios siguen en el editor." }
    : null, datos.status);
  if (!datos.body || typeof datos.body !== "object" || Array.isArray(datos.body)) return json(null, 400);
  try {
    if (cfg.modo === "origen") {
      if (operacion === "emitir") {
        const acceso = await getStudioAccess(await createClient());
        if (!acceso.role || !acceso.tenantId || !acceso.userId) return json(null, 403);
        const identidad = referenciaPrivada({ usuario: acceso.userId, tenant: acceso.tenantId }, cfg.llave);
        return json({ pase: await emitirEnDestino(cfg, identidad) });
      }
      if (operacion === "permisos") {
        const sujeto = abrirReferencia(datos.body.referencia, cfg.llave);
        if (!sujeto) return json({ permisos: null });
        return json({ permisos: await permisosVigentes(createAdminClient(), sujeto) });
      }
      return json(null, 404);
    }
    if (operacion === "reservar") {
      const { propietario, referencia } = datos.body;
      if (!esToken(propietario) || typeof referencia !== "string" || !/^[A-Za-z0-9_-]{64,512}$/.test(referencia)) return json(null, 400);
      return json({ pase: await reservar(cfg, propietario, referencia) });
    }
    if (operacion === "canjear") {
      if (!esToken(datos.body.pase)) return json(null, 400);
      const sesion = await canjear(cfg, datos.body.pase);
      if (!sesion) return json(null, 403);
      const vista = await consultarPractica(cfg, sesion);
      if (!vista) { await cerrar(cfg, sesion); return json(null, 403); }
      const salida = json(vista);
      salida.cookies.set(COOKIE_PRACTICA, sesion, { ...opcionesCookie, maxAge: 4 * 60 * 60 });
      return salida;
    }
    const sesion = req.cookies.get(COOKIE_PRACTICA)?.value;
    const esperado = datos.body.espacio;
    if (operacion === "salir") {
      if (!esToken(sesion) || !esUuid(esperado)) return json({ ok: true });
      const actual = await espacioDeSesion(cfg, sesion);
      // Otra cuenta pudo entrar en una segunda pestaña del mismo navegador.
      if (actual && actual.espacio !== esperado) return json({ ok: true });
      await cerrar(cfg, sesion);
      const salida = json({ ok: true });
      salida.cookies.set(COOKIE_PRACTICA, "", { ...opcionesCookie, maxAge: 0 });
      return salida;
    }
    if (operacion === "china") {
      if (!esToken(sesion) || !esUuid(esperado)) return json(null, 401);
      const { comando, revision, modulo, consulta, etapa, consolidado, destino, caso } = datos.body;
      if(caso !== undefined && (caso !== "china" && caso !== "preparado" || etapa === undefined)) return json(null,400);
      if (consulta !== undefined && (typeof consulta !== "string" || consulta.length > 512 || comando !== undefined)) return json(null,400);
      if (etapa !== undefined && ((etapa !== "shipments" && etapa !== "ve") || !CONSOLIDADOS_CHINA.includes(consolidado as ConsolidadoEjercicio) || comando !== undefined || consulta !== undefined)) return json(null,400);
      if (etapa === undefined && modulo !== "cn" && modulo !== "naviera" && modulo !== "shipments" && modulo !== "ve") return json(null, 400);
      if (destino !== undefined && (!etapa || !destino || typeof destino !== "object" || Array.isArray(destino) || !Number.isSafeInteger(revision))) return json(null,400);
      if (comando !== undefined && (!comando || typeof comando !== "object" || !Number.isSafeInteger(revision))) return json(null, 400);
      try {
        if (etapa === "shipments" || etapa === "ve") return json(await destinoPersonal(cfg,sesion,esperado,consolidado as ConsolidadoEjercicio,etapa,revision as number|undefined,destino as ComandoDestino|undefined,caso as CasoDestino|undefined));
        return json(await chinaPersonal(cfg, sesion, esperado, modulo as "cn" | "naviera" | "shipments" | "ve", revision as number | undefined, comando as ComandoChina | undefined, consulta as string | undefined));
      } catch (error) {
        const texto = error instanceof Error ? error.message : "";
        const conocido = /^(No tienes|La práctica cambió|Carga inexistente|Recibe|Operación|Revisa|La etiqueta|Código|En este|Elige|La caja|Esta recepción|La operación|La referencia|La tarea|Ejercicio|El viaje|La solicitud|Viaje|Las cajas|Una caja|La observación|Escribe|Registra|No hay)/.test(texto);
        return json({ error: conocido ? texto : "Servicio de práctica indisponible." }, conocido ? (texto.startsWith("No tienes") ? 403 : 409) : 503);
      }
    }
    if (operacion === "facturacion") {
      if (!esToken(sesion) || !esUuid(esperado)) return json(null, 401);
      const { comando, revision } = datos.body;
      if (comando !== undefined && (!comando || typeof comando !== "object" || !Number.isSafeInteger(revision))) return json(null, 400);
      try {
        return json(await facturacionPersonal(cfg, sesion, esperado, revision as number | undefined, comando as ComandoFactura | undefined));
      } catch (error) {
        const texto = error instanceof Error ? error.message : "Operación indisponible";
        const conocido = /^(No tienes|La práctica cambió|Solo se|Revisa conceptos|Documento inexistente|Para anular|Escribe un motivo|El pago ya|Operación desconocida)/.test(texto);
        return json({ error: conocido ? texto : "Servicio de práctica indisponible." }, conocido ? (texto.startsWith("No tienes") ? 403 : 409) : 503);
      }
    }
    if (operacion !== "estado") return json(null, 404);
    if (!esToken(sesion) || !esUuid(esperado)) return json(null, 401);
    const vista = await consultarPractica(cfg, sesion, esperado);
    return vista ? json(vista) : json(null, 403);
  } catch {
    // Respuesta neutra: un fallo de red o configuración no abre otra copia.
    return json(null, 503);
  }
}
