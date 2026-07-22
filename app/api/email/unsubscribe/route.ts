import type { NextRequest } from "next/server";
import {
  handleUnsubscribeGet,
  handleUnsubscribePost,
} from "@/lib/studio/mail/unsubscribe-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Compatibilidad temporal para correos antiguos con `?token=`. */
export function GET(req: NextRequest) {
  return handleUnsubscribeGet(
    req,
    req.nextUrl.searchParams.get("token"),
    "query",
  );
}

/** RFC 8058 para enlaces antiguos con token en query. */
export function POST(req: NextRequest) {
  return handleUnsubscribePost(
    req,
    req.nextUrl.searchParams.get("token"),
    "query",
  );
}
