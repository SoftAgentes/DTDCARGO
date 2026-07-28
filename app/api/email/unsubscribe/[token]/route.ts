import type { NextRequest } from "next/server";
import {
  handleUnsubscribeGet,
  handleUnsubscribePost,
} from "@/lib/studio/mail/unsubscribe-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ token: string }>;
};

/** Baja visible: el token opaco viaja en la ruta para sobrevivir a Outlook. */
export async function GET(req: NextRequest, context: RouteContext) {
  const { token } = await context.params;
  return handleUnsubscribeGet(req, token, "path");
}

/** RFC 8058 · baja nativa de un clic sobre la misma URL robusta. */
export async function POST(req: NextRequest, context: RouteContext) {
  const { token } = await context.params;
  return handleUnsubscribePost(req, token, "path");
}
