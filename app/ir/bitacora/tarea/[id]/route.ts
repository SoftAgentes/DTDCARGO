/**
 * /ir/bitacora/tarea/[id] — deep-link NEUTRO a una tarea de Bitácora (SDD-0146).
 *
 * El payload de push y la campanita SIEMPRE apuntan acá; esta ruta fina redirige
 * por user-agent: móvil → la vista táctil de la PWA staff; escritorio → el tablero
 * del Studio (que abre el drawer de la tarea via ?task=). Sin estado, sin DB, sin
 * auth (el destino ya exige sesión). NO importa @/lib/studio (frontera intacta).
 */

import type { NextRequest } from "next/server";
import { localRedirect } from "@/lib/http/local-redirect";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MOBILE_RE = /Mobi|Android|iPhone|iPad|iPod|Windows Phone/i;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ua = req.headers.get("user-agent") ?? "";
  const isMobile = MOBILE_RE.test(ua);

  // id forjado / no-uuid → mandamos al listado (sin abrir un drawer inválido).
  const dest = !UUID_RE.test(id)
    ? isMobile
      ? "/m/erp/bitacora"
      : "/studio/bitacora"
    : isMobile
      ? `/m/erp/bitacora/tarea/${id}`
      : `/studio/bitacora?task=${id}`;

  return localRedirect(dest);
}
