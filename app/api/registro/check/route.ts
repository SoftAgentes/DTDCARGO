import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { resolveRequestIp } from "@/lib/http/request-ip";
import { apiError } from "@/lib/http/api-error";
import { readJsonBody } from "@/lib/http/read-json-body";
import { normalizeDocument, type ClientKind } from "@/lib/portal/register-types";

export const runtime = "nodejs";

/**
 * Chequeo en vivo "¿este documento ya tiene una cuenta?" del registro (/registro).
 *
 * Por qué un API route y no un server action: la frontera ESLint prohíbe que el
 * sitio público (app/registro vive afuera de studio pero el form es público)
 * importe lib/db / lib/studio / @supabase. `app/api/**` está FUERA de esa frontera
 * → el form solo hace `fetch` (un fetch no es import). Mismo patrón que
 * `app/api/contact`.
 *
 * PRIVACIDAD (regla central): responde SOLO `{ exists: boolean }`. NUNCA el
 * markbox, el nombre, el email ni ningún dato del titular. El front, si `exists`,
 * ofrece "recupera tu acceso" (enlace al login) SIN revelar a quién pertenece la
 * cuenta. Así el aviso en vivo no se vuelve un oráculo de datos personales: a lo
 * sumo confirma, para un documento bien formado, si existe una cuenta — el MISMO
 * bit que el alta ya devuelve al intentar registrar un duplicado.
 *
 * Anti-enumeración: throttle por IP reutilizando `portal_registro_throttle` con
 * namespace propio "docheck:" (no se mezcla con el bucket del alta ni el de
 * contacto). Acota cuántos documentos puede barrer un script por IP/hora. Como el
 * dato es semi-público (cédula/RIF venezolano) y de bajo valor, el límite + el
 * "solo booleano" son defensa suficiente; el dedup REAL del alta es el control.
 */

const RL_TABLE = "portal_registro_throttle";
const RL_IP_PREFIX = "docheck:";
// 20 checks por IP por ventana. Un visitante legítimo chequea 1-2 documentos; 20
// deja margen a tipeos/correcciones pero corta la enumeración masiva por IP.
const RL_LIMIT = 20;
const RL_WINDOW_MINUTES = 60;

type CheckBody = { kind?: string; document?: string };

export async function POST(req: NextRequest) {
  const parsed = await readJsonBody<CheckBody>(req);
  if (!parsed.ok) {
    return apiError(
      parsed.status === 413 ? "Solicitud demasiado grande." : "Solicitud inválida.",
      parsed.status === 413 ? "body too large" : "json parse",
      parsed.status,
      "registro-check",
    );
  }
  const body = parsed.body;

  const kind: ClientKind = body.kind === "empresa" ? "empresa" : "persona";
  const raw = String(body.document ?? "").trim();
  const document = raw ? normalizeDocument(kind, raw) : null;
  // Documento aún no válido → no es un error: simplemente "no existe" (nada que
  // chequear todavía). El front solo llama cuando el documento normaliza, pero lo
  // defendemos igual server-side (no confiar en el cliente).
  if (!document) return NextResponse.json({ exists: false });

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    // Backend no disponible → NO bloqueamos el registro: respondemos "no existe"
    // (fail-open). El dedup real del alta sigue protegiendo en el submit.
    return NextResponse.json({ exists: false });
  }

  // Throttle por IP (anti-enumeración). Fail-open ante un error de lectura.
  const ip = RL_IP_PREFIX + resolveRequestIp(req.headers);
  const windowStart = new Date(
    Date.now() - RL_WINDOW_MINUTES * 60 * 1000,
  ).toISOString();
  const { count, error: rlErr } = await admin
    .from(RL_TABLE)
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .gte("created_at", windowStart);
  if (!rlErr && (count ?? 0) >= RL_LIMIT) {
    // Llegó al límite → respondemos neutro (exists:false) y 429. No revelamos a
    // quién pertenece nada ni dejamos seguir barriendo; el alta real igual valida.
    return NextResponse.json({ exists: false }, { status: 429 });
  }
  // Registrar el intento (best-effort: si falla el insert, el chequeo sigue).
  await admin.from(RL_TABLE).insert({ ip });

  // Tenant operativo de DTD (uno solo hoy; mismo patrón que registro/contacto).
  const { data: tenantRow } = await admin
    .from("tenants")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (!tenantRow?.id) return NextResponse.json({ exists: false });

  // Dedup por documento — MISMA query que la server action del alta (rif ilike,
  // sin deleted). Seleccionamos solo "id": no necesitamos (ni devolvemos) PII.
  const { data: dup } = await admin
    .from("clients")
    .select("id")
    .eq("tenant_id", tenantRow.id)
    .is("deleted_at", null)
    .ilike("rif", document.toLowerCase())
    .limit(1)
    .maybeSingle<{ id: string }>();

  return NextResponse.json({ exists: !!dup });
}
