/**
 * SDD-0608 · «URL de interacciones» de la aplicación de Discord del Studio.
 *
 * Discord manda acá cada uso del comando `/cliente` (y un PING al guardar la
 * URL). Esta ruta:
 *
 *   1. Verifica la firma Ed25519 sobre el cuerpo crudo con la llave pública de
 *      la aplicación (`DISCORD_CONSULTA_PUBLIC_KEY`). Firma mala → 401. Sin la
 *      variable → 503: no pasa nadie.
 *   2. Contesta el PING.
 *   3. Acepta sólo `/cliente`, sólo desde el servidor de DTD Cargo.
 *   4. Delega en `resolverConsultaCliente` el enlace, el permiso, el registro,
 *      el límite y la búsqueda.
 *
 * Toda respuesta de comando es efímera (sólo la ve quien preguntó) y sin
 * menciones. La aplicación de Discord es PROPIA del Studio, separada de ALFRED
 * (el bot de la oficina): su llave no sirve para nada más (SDD-0608, D1).
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import {
  INTERACCION_COMANDO,
  INTERACCION_PING,
  RESPUESTA_PONG,
  leerComandoCliente,
  type InteraccionDiscord,
} from "@/lib/studio/discord/consulta/comando";
import { resolverConsultaCliente } from "@/lib/studio/discord/consulta/consulta";
import { verificarFirmaDiscord } from "@/lib/studio/discord/consulta/firma";
import { MENSAJES, respuestaEfimera } from "@/lib/studio/discord/consulta/respuesta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Una interacción de comando pesa ~2 KB; esto deja margen y corta abusos. */
const CUERPO_MAXIMO = 32 * 1024;

export async function POST(req: Request) {
  const clavePublica = process.env.DISCORD_CONSULTA_PUBLIC_KEY;
  if (!clavePublica) {
    return NextResponse.json({ error: "no configurado" }, { status: 503 });
  }

  const cuerpo = new Uint8Array(await req.arrayBuffer());
  if (cuerpo.byteLength > CUERPO_MAXIMO) {
    return NextResponse.json({ error: "demasiado grande" }, { status: 413 });
  }

  const firmaValida = verificarFirmaDiscord({
    clavePublicaHex: clavePublica,
    firmaHex: req.headers.get("x-signature-ed25519"),
    timestamp: req.headers.get("x-signature-timestamp"),
    cuerpo,
  });
  if (!firmaValida) {
    return NextResponse.json({ error: "firma inválida" }, { status: 401 });
  }

  let interaccion: InteraccionDiscord;
  try {
    interaccion = JSON.parse(new TextDecoder().decode(cuerpo)) as InteraccionDiscord;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (interaccion.type === INTERACCION_PING) {
    return NextResponse.json({ type: RESPUESTA_PONG });
  }
  if (interaccion.type !== INTERACCION_COMANDO) {
    return NextResponse.json({ error: "tipo no soportado" }, { status: 400 });
  }

  const lectura = leerComandoCliente(interaccion);
  if (!lectura.ok) {
    return NextResponse.json(respuestaEfimera(MENSAJES[lectura.motivo]));
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(respuestaEfimera(MENSAJES.no_disponible));
  }

  try {
    const { respuesta } = await resolverConsultaCliente(
      {
        admin,
        tenantDiscord: process.env.DISCORD_TENANT_ID,
        baseUrl: process.env.NEXT_PUBLIC_SITE_URL || "https://dtdcargo.com",
      },
      { discordUserId: lectura.discordUserId, termino: lectura.termino },
    );
    return NextResponse.json(respuesta);
  } catch {
    // Sin el texto del error: puede traer nombres de tablas o columnas.
    console.error("[discord/interacciones] la consulta falló");
    return NextResponse.json(respuestaEfimera(MENSAJES.no_disponible));
  }
}
