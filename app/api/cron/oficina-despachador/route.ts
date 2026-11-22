/**
 * /api/cron/oficina-despachador — el despachador mínimo del cable (SDD-0626 §3.4 y §3.5, Paso 3a).
 *
 * El cron del servidor lo llama cada minuto. Cada llamada abre una TANDA de ~50 s con ticks cada 10 s (una
 * corrida en curso la alarga hasta su tope de 200 s; todo cabe en los 290 s del cron). La base da el turno: si ya hay una tanda, esta responde
 * `ocupado` y sale. Si el proceso se cae, el turno vence y la tanda siguiente retoma desde el último tick.
 *
 * El agente REDACTA: el resultado queda como borrador en `office_borradores` y la tarea en «aprobación».
 * NADA SE ENVÍA a Chatwoot desde aquí (D1; el envío es del Paso 3b, tras la aprobación de Sam).
 *
 * Nace APAGADO: con `OFICINA_DESPACHADOR_ACTIVO` vacío o falso no crea el cliente de la base ni llama a nadie.
 * Encendido sin `OFICINA_VACIADO_ACTIVO` (la purga de borradores a 90 días, D3) responde `sin_vaciado` y tampoco.
 * Sin la 0548 responde 200 `sin_migracion` y lo anota una vez en el log. Respuesta: solo conteos y estados.
 *
 * Auth: CRON_SECRET en `Authorization: Bearer <secret>`, solo por cabecera. Solo en el servidor
 * (infra/dtd-cargo/cron/crontab, no en vercel.json).
 */
import { NextResponse, type NextRequest } from "next/server";

import { createAdminClient } from "@/lib/db/admin";
import { matchesBearerSecret } from "@/lib/http/secret-compare";
import { avisarPendientesADiscord } from "@/lib/studio/oficina/aviso-pendientes";
import { leerConversacion } from "@/lib/studio/oficina/chatwoot-lectura";
import { correrTanda } from "@/lib/studio/oficina/despachador";
import { crearAlmacenDespachador } from "@/lib/studio/oficina/despachador-almacen";
import { configDespachador } from "@/lib/studio/oficina/despachador-config";
import { borrarSesion, leerModeloDeSesion, llamarAgente } from "@/lib/studio/oficina/runtime-cliente";

export const dynamic = "force-dynamic";
export const maxDuration = 290;

const DURACION_TANDA_MS = 50_000;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !matchesBearerSecret(req.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: secret ? "Forbidden" : "CRON_SECRET no configurado" }, { status: 403 });
  }
  const config = configDespachador();
  // Apagado: ni siquiera se crea el cliente de la base.
  if (!config.activo) return NextResponse.json({ ok: true, estado: "apagado" });
  // D3: sin la purga diaria de borradores (OFICINA_VACIADO_ACTIVO) no se redacta nada.
  if (!config.vaciadoActivo) return NextResponse.json({ ok: true, estado: "sin_vaciado" });
  if (!config.runtime || !config.chatwoot) return NextResponse.json({ ok: true, estado: "sin_config" });
  const runtime = config.runtime;
  const chatwoot = config.chatwoot;
  try {
    const admin = createAdminClient();
    const r = await correrTanda(
      {
        config,
        almacen: crearAlmacenDespachador(admin),
        // Paso 3b (D4): «hay N pendientes» a Discord, sin el texto.
        avisar: (pendientes) => avisarPendientesADiscord(admin, pendientes),
        leer: (conversacionId, signal) => leerConversacion({ ...chatwoot, conversacionId, signal }),
        llamar: (o) => llamarAgente({ ...o, url: runtime.url, token: runtime.token }),
        borrarSesion: (sesionId) => borrarSesion({ url: runtime.url, token: runtime.token, sesionId }),
        // SDD-0702 · modelo real: Hermes v0.23.1 solo lo dice en la sesión; se lee antes del borrado.
        modeloDeSesion: (sesionId) => leerModeloDeSesion({ url: runtime.url, token: runtime.token, sesionId }),
      },
      { duracionMs: DURACION_TANDA_MS },
    );
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error(`[oficina-despachador] la tanda no corrió (${e instanceof Error ? e.name : "error"})`);
    return NextResponse.json({ ok: false, error: "despachador" }, { status: 500 });
  }
}
