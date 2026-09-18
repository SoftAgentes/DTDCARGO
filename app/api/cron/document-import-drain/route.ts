import { timingSafeEqual } from "node:crypto";
import { NextResponse,type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { cleanupImports,processImportJob } from "@/lib/studio/document-import/jobs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=180;
export async function GET(req:NextRequest) {
  const expected=process.env.CRON_SECRET?`Bearer ${process.env.CRON_SECRET}`:"";
  const supplied=req.headers.get("authorization")??"";
  if(!expected||Buffer.byteLength(supplied)!==Buffer.byteLength(expected)||!timingSafeEqual(Buffer.from(supplied),Buffer.from(expected)))return NextResponse.json({error:"Forbidden"},{status:403});
  if(process.env.DOCUMENT_IMPORT_ENABLED!=="true")return NextResponse.json({enabled:false});
  const db=createAdminClient();
  const cleanup=await cleanupImports(db);
  const result=await processImportJob(db);
  return NextResponse.json({cleanup,...result},{headers:{"Cache-Control":"no-store"}});
}
