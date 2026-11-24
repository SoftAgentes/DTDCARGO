import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { readJsonBody } from "@/lib/http/read-json-body";
import { getStudioAccess } from "@/lib/studio/rbac-guard";
import { configuracionPractica } from "@/lib/studio/practica/config";
import { COOKIE_PRACTICA, esToken, esUuid } from "@/lib/studio/practica/contrato";
import { referenciaPrivada, abrirReferencia, permisosVigentes } from "@/lib/studio/practica/identidad";
import { canalValido, emitirEnDestino, reservar, canjear, consultarPractica, cerrar, espacioDeSesion } from "@/lib/studio/practica/servidor";

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
  const datos = await readJsonBody<Record<string, unknown>>(req, 2048);
  if (!datos.ok) return json(null, datos.status);
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
    if (operacion !== "estado") return json(null, 404);
    if (!esToken(sesion) || !esUuid(esperado)) return json(null, 401);
    const vista = await consultarPractica(cfg, sesion, esperado);
    return vista ? json(vista) : json(null, 403);
  } catch {
    // Respuesta neutra: un fallo de red o configuración no abre otra copia.
    return json(null, 503);
  }
}
