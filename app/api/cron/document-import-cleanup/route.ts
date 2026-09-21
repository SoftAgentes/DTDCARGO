import { NextResponse,type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { matchesBearerSecret } from "@/lib/http/secret-compare";
import { cleanupImports } from "@/lib/studio/document-import/jobs";
/**
 * SDD-0473 · Retención de la importación documental, aparte del drenaje.
 *
 * El drenaje (`document-import-drain`, cada minuto) sólo existe con la bandera
 * encendida y es inerte apagada: corta antes de abrir la base. Este cron es el
 * borrado de lo vencido (24 h), y NO lee la bandera: apagar la lectura no puede
 * apagar la promesa de borrado. Encender y después apagar dejaba sin borrar lo
 * subido en las últimas 24 h, y el Preview —que escribe en la base de producción
 * y no corre crons— deja residuo aunque producción nunca se encienda.
 *
 * Corre cada hora (`vercel.json`): para un vencimiento de 24 h alcanza, y apagado
 * son 24 conexiones al día en vez de 1.440. Encendido, el drenaje ya limpia en
 * cada tick; esta pasada extra es idempotente.
 */
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
export async function GET(req:NextRequest) {
  if(!matchesBearerSecret(req.headers.get("authorization"),process.env.CRON_SECRET))return NextResponse.json({error:"Forbidden"},{status:403});
  const cleanup=await cleanupImports(createAdminClient());
  return NextResponse.json({cleanup},{headers:{"Cache-Control":"no-store"}});
}
