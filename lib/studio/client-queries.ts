/**
 * Helpers de query reutilizables para el módulo Clientes (SDD-0010).
 *
 * RLS filtra por tenant_id automáticamente.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Client, ClientTier } from "./client-types";

export type ClientFilters = {
  tier?: ClientTier | "all";
  q?: string;
  /** SDD-0046: solo clientes self-registrados aún sin verificar la identidad. */
  pendingReview?: boolean;
};

const CLIENT_COLUMNS =
  "id, tenant_id, markbox, name, email, phone, address, rif, contact_name, tier, notes, lat, lng, registration_channel, doc_kind, doc_verify_status, doc_verify_source, doc_registry_name, doc_verified_at, cedula_photo_path, advisor_id, person_id, created_at, updated_at, deleted_at";

/**
 * Lista de clientes con filtros opcionales. RLS filtra por tenant.
 * Hasta 200 ordenados por created_at DESC.
 */
export async function listClients(
  supabase: SupabaseClient,
  filters: ClientFilters = {},
): Promise<Client[]> {
  let query = supabase
    .from("clients")
    .select(CLIENT_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(200);

  if (filters.tier && filters.tier !== "all") {
    query = query.eq("tier", filters.tier);
  }

  // SDD-0046: "pendientes de revisar" = self-registrados sin verificación aún.
  if (filters.pendingReview) {
    query = query.eq("registration_channel", "portal").is("doc_verify_status", null);
  }

  if (filters.q && filters.q.trim()) {
    const q = filters.q.trim().replace(/[,()]/g, " ").replace(/\s+/g, " ").trim();
    // SDD-0106: cédula primero, Shipping Mark después. Para un match exacto
    // tolerante a formato usá getClientByCedula(); esta búsqueda libre es ilike.
    query = query.or(
      [
        `rif.ilike.%${q}%`,
        `name.ilike.%${q}%`,
        `markbox.ilike.%${q}%`,
        `email.ilike.%${q}%`,
        `phone.ilike.%${q}%`,
      ].join(","),
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as Client[] | null) ?? [];
}

/** Cliente individual por markbox. RLS valida ownership. */
export async function getClientByMarkbox(
  supabase: SupabaseClient,
  markbox: string,
): Promise<Client | null> {
  const { data, error } = await supabase
    .from("clients")
    .select(CLIENT_COLUMNS)
    .eq("markbox", markbox)
    .maybeSingle();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return (data as Client | null) ?? null;
}

/**
 * Cliente del tenant por **cédula/RIF**, normalizada igual que el índice único
 * (SDD-0106 · "ubicar por cédula primero, Shipping Mark después"). Tolera
 * variantes de formato (`V-12.345.678` ≡ `v12345678`). `null` si no existe.
 * Vía RPC `find_client_by_cedula` (SECURITY INVOKER → RLS por tenant).
 */
export async function getClientByCedula(
  supabase: SupabaseClient,
  doc: string,
): Promise<Client | null> {
  const trimmed = doc.trim();
  if (!trimmed) return null;
  const { data, error } = await supabase
    .rpc("find_client_by_cedula", { p_doc: trimmed })
    .maybeSingle();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return (data as Client | null) ?? null;
}

/**
 * Lista los shipments asociados a un MARKBOX. Lookup textual (sin FK).
 * Ordenados por created_at DESC. Hasta 200.
 *
 * Devuelve subset de campos suficientes para la tabla del histórico.
 */
export async function listShipmentsByMarkbox(
  supabase: SupabaseClient,
  markbox: string,
) {
  const { data, error } = await supabase
    .from("shipments")
    .select(
      "id, code, origin, destination, shipment_service, status, created_at",
    )
    .eq("client_markbox", markbox)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw error;
  return data ?? [];
}

/** Estado del acceso al Portal del Cliente (SDD-0042) de un cliente. */
export type ClientPortalAccess = {
  status: "invited" | "active" | "revoked";
  email: string;
  invitedAt: string;
  boundAt: string | null;
  lastLoginAt: string | null;
};

/**
 * Acceso al portal de un cliente (tabla client_users). null = nunca invitado.
 * RLS "client_users self or tenant read" deja al admin del tenant ver la row.
 */
export async function getClientPortalAccess(
  supabase: SupabaseClient,
  clientId: string,
): Promise<ClientPortalAccess | null> {
  const { data, error } = await supabase
    .from("client_users")
    .select("status, email, invited_at, bound_at, last_login_at")
    .eq("client_id", clientId)
    .maybeSingle();

  if (error || !data) return null;
  return {
    status: data.status as ClientPortalAccess["status"],
    email: data.email as string,
    invitedAt: data.invited_at as string,
    boundAt: (data.bound_at as string | null) ?? null,
    lastLoginAt: (data.last_login_at as string | null) ?? null,
  };
}

/** Embudo de adopción del portal (para el tablero del backfill). */
export type PortalAdoptionStats = {
  /** clientes totales (vivos) del tenant. */
  totalClients: number;
  /** con acceso al portal (client_users). */
  withAccess: number;
  /** que entraron alguna vez (vincularon el magic-link: status active / bound / last_login). */
  loggedIn: number;
  /** que anunciaron al menos una compra (prealerta). */
  announced: number;
  /** candidatos invitables ya (sin acceso + email válido). */
  candidatesWithEmail: number;
  /** sin acceso y SIN email válido → el equipo debe capturar contacto. */
  withoutEmail: number;
};

/**
 * Embudo de adopción del portal (adopción · 2026-07-11). Todo por RLS del tenant
 * (clients + client_users + prealertas), sin admin sobre auth.users. "Entraron" =
 * vinculó el magic-link alguna vez (status active / bound_at / last_login_at) — NO
 * solo last_login_at, que el RPC escribe únicamente al clickear el enlace y deja NULL
 * a quien vinculó bajo el RPC viejo o sigue con sesión activa. Defensivo: ceros si falla.
 */
export async function getPortalAdoptionStats(
  supabase: SupabaseClient,
): Promise<PortalAdoptionStats> {
  const empty: PortalAdoptionStats = {
    totalClients: 0,
    withAccess: 0,
    loggedIn: 0,
    announced: 0,
    candidatesWithEmail: 0,
    withoutEmail: 0,
  };
  try {
    const [clientsRes, linkedRes, prealertasRes] = await Promise.all([
      supabase
        .from("clients")
        .select("id, markbox, email")
        .is("deleted_at", null)
        .limit(5000),
      supabase
        .from("client_users")
        .select("client_id, last_login_at, status, bound_at")
        .limit(5000),
      supabase
        .from("prealertas")
        .select("client_markbox")
        .is("deleted_at", null)
        .limit(5000),
    ]);
    if (clientsRes.error) throw clientsRes.error;
    if (linkedRes.error) throw linkedRes.error;

    const clients = (clientsRes.data as { id: string; markbox: string; email: string | null }[] | null) ?? [];
    const linked = (linkedRes.data as { client_id: string; last_login_at: string | null; status: string; bound_at: string | null }[] | null) ?? [];
    const prealertas = (prealertasRes.data as { client_markbox: string | null }[] | null) ?? [];

    const accessIds = new Set(linked.map((r) => String(r.client_id)));
    const announcedMarks = new Set(
      prealertas.map((p) => String(p.client_markbox ?? "")).filter(Boolean),
    );

    let candidatesWithEmail = 0;
    let withoutEmail = 0;
    for (const c of clients) {
      if (accessIds.has(String(c.id))) continue;
      const ok =
        typeof c.email === "string" &&
        PORTAL_INVITE_EMAIL_RE.test(c.email.trim());
      if (ok) candidatesWithEmail++;
      else withoutEmail++;
    }

    return {
      totalClients: clients.length,
      withAccess: accessIds.size,
      loggedIn: linked.filter(
        (r) => r.last_login_at != null || r.bound_at != null || r.status === "active",
      ).length,
      announced: clients.filter((c) => announcedMarks.has(String(c.markbox)))
        .length,
      candidatesWithEmail,
      withoutEmail,
    };
  } catch {
    return empty;
  }
}

/** Candidato al backfill de invitaciones al portal (adopción). */
export type PortalInviteCandidate = {
  id: string;
  markbox: string;
  name: string;
  email: string;
  /** teléfono (si lo tiene) — habilita invitar por WhatsApp además del correo. */
  phone: string;
  /** heurística: parece cliente demo/prueba → NO auto-seleccionar en el masivo. */
  isLikelyDemo: boolean;
};

const PORTAL_INVITE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEMO_NAME_RE = /\b(demo|prueba|test|ejemplo|dummy|qa|sandbox)\b/i;
const DEMO_EMAIL_RE = /(\+|demo|test|example|dummy|noreply|no-reply)/i;

/** Heurística advisory: ¿parece cliente de prueba? (nombre o correo). */
function looksLikeDemo(name: string, email: string): boolean {
  return DEMO_NAME_RE.test(name) || DEMO_EMAIL_RE.test(email);
}

/**
 * Clientes SIN acceso al portal (nunca invitados) que TIENEN email válido —
 * candidatos al backfill (adopción del portal · 2026-07-11). RLS filtra por
 * tenant en ambas tablas; el diff (clients con email − los que ya tienen
 * client_users) se hace en memoria. Ordenado por nombre. Los sin email / con
 * email inválido quedan fuera (no se les puede mandar el magic-link).
 */
export async function listPortalInviteCandidates(
  supabase: SupabaseClient,
): Promise<PortalInviteCandidate[]> {
  const [clientsRes, linkedRes] = await Promise.all([
    supabase
      .from("clients")
      .select("id, markbox, name, email, phone")
      .is("deleted_at", null)
      .limit(5000),
    supabase.from("client_users").select("client_id").limit(5000),
  ]);
  if (clientsRes.error) throw clientsRes.error;
  if (linkedRes.error) throw linkedRes.error;

  const hasAccess = new Set(
    ((linkedRes.data as { client_id: string }[] | null) ?? []).map((r) =>
      String(r.client_id),
    ),
  );

  return ((clientsRes.data as Record<string, unknown>[] | null) ?? [])
    .filter((c) => !hasAccess.has(String(c.id)))
    .filter(
      (c) =>
        typeof c.email === "string" &&
        PORTAL_INVITE_EMAIL_RE.test((c.email as string).trim()),
    )
    .map((c) => {
      const name = String(c.name ?? "");
      const email = String(c.email).trim();
      return {
        id: String(c.id),
        markbox: String(c.markbox ?? ""),
        name,
        email,
        phone: typeof c.phone === "string" ? c.phone.trim() : "",
        isLikelyDemo: looksLikeDemo(name, email),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

/** Invitado al portal que NUNCA abrió su enlace — candidato al reenvío (seguimiento de fríos). */
export type PortalColdInvitee = {
  id: string;
  markbox: string;
  name: string;
  email: string;
  /** teléfono (habilita reenviar por WhatsApp). */
  phone: string;
  /** fecha de la invitación (client_users.invited_at). */
  invitedAt: string;
  /** días desde la invitación (para "invitado hace X días, nunca abrió"). */
  daysCold: number;
  /** veces invitado por correo (anti-spam). */
  emailInvites: number;
  /** veces invitado por WhatsApp (anti-spam). */
  whatsappInvites: number;
  /** última invitación por correo (ISO) o null. */
  lastEmailInviteAt: string | null;
  /** última invitación por WhatsApp (ISO) o null. */
  lastWhatsappInviteAt: string | null;
  /** asesor del último correo (nombre) o null (automático / sin dato). */
  lastEmailInviteBy: string | null;
  /** asesor de la última invitación WhatsApp (nombre) o null. */
  lastWhatsappInviteBy: string | null;
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Invitados al portal que NUNCA abrieron su enlace (seguimiento de fríos · adopción
 * 2026-07-11): `status = 'invited'` — se les mandó la invitación pero nunca la
 * vincularon (nunca clickearon el magic-link). El tool les reenvía un enlace fresco.
 *
 * ⚠️ Ojo con la señal: `last_login_at` **no** sirve para "no usa el portal" — el RPC
 * `portal_bind_session` solo lo escribe al clickear el magic-link, no en cada visita,
 * así que un cliente que vinculó y sigue con sesión activa puede tener `last_login_at`
 * NULL sin estar inactivo. Por eso el frío honesto es "nunca vinculó" (`invited`), que
 * jamás manda correo a un usuario que ya entró. Es exactamente el set de no-respondedores
 * que crecerá al invitar en masa.
 *
 * RLS filtra por tenant; el join a `clients` (nombre/markbox) descarta borrados. Sin
 * correo válido → fuera (no hay a dónde reenviar). Orden: invitación más vieja primero.
 */
export async function listPortalColdInvitees(
  supabase: SupabaseClient,
): Promise<PortalColdInvitee[]> {
  // Defensivo: si la migración 0226 (contadores) aún no está en prod, el select con
  // las columnas nuevas falla → caemos a la versión sin contadores (badges en 0). Así
  // el deploy no depende del timing de la migración; los contadores se encienden solos
  // cuando se aplique.
  const [linkedRes, clientsRes] = await Promise.all([
    supabase
      .from("client_users")
      .select(
        "client_id, email, invited_at, email_invite_count, whatsapp_invite_count, last_email_invite_at, last_whatsapp_invite_at, last_email_invite_by, last_whatsapp_invite_by",
      )
      .eq("status", "invited")
      .limit(5000),
    supabase
      .from("clients")
      .select("id, markbox, name, phone")
      .is("deleted_at", null)
      .limit(5000),
  ]);
  let linkedData: Record<string, unknown>[] | null =
    linkedRes.data as Record<string, unknown>[] | null;
  if (linkedRes.error) {
    const basic = await supabase
      .from("client_users")
      .select("client_id, email, invited_at")
      .eq("status", "invited")
      .limit(5000);
    if (basic.error) throw basic.error; // error real (no la columna faltante)
    linkedData = basic.data as Record<string, unknown>[] | null;
  }
  if (clientsRes.error) throw clientsRes.error;

  const clientById = new Map(
    ((clientsRes.data as { id: string; markbox: string; name: string; phone: string | null }[] | null) ?? []).map(
      (c) => [String(c.id), c],
    ),
  );
  const now = Date.now();

  // Nombres de los asesores que invitaron (auditoría · migr 0227). Best-effort: si las
  // columnas *_by no están o el perfil no se lee, queda null (RLS deja al admin activo
  // leer user_profiles del staff). Sin migración → inviterIds vacío → sin nombres.
  const inviterIds = [
    ...new Set(
      (linkedData ?? [])
        .flatMap((r) => [r.last_email_invite_by, r.last_whatsapp_invite_by])
        .filter((v): v is string => typeof v === "string" && v.length > 0),
    ),
  ];
  const inviterName = new Map<string, string>();
  if (inviterIds.length > 0) {
    const { data: profs } = await supabase
      .from("user_profiles")
      .select("user_id, first_name, last_name")
      .in("user_id", inviterIds);
    for (const p of (profs ?? []) as {
      user_id: string;
      first_name: string | null;
      last_name: string | null;
    }[]) {
      const nm = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
      if (nm) inviterName.set(String(p.user_id), nm);
    }
  }

  return (linkedData ?? [])
    .map((r) => {
      const client = clientById.get(String(r.client_id));
      if (!client) return null; // cliente borrado → fuera
      const email = String(r.email ?? "").trim();
      if (!email || !PORTAL_INVITE_EMAIL_RE.test(email)) return null; // sin correo válido → no se puede reenviar
      const invitedAt = String(r.invited_at ?? "");
      const invitedMs = invitedAt ? new Date(invitedAt).getTime() : now;
      const daysCold = Number.isFinite(invitedMs)
        ? Math.max(0, Math.floor((now - invitedMs) / MS_PER_DAY))
        : 0;
      return {
        id: String(r.client_id),
        markbox: String(client.markbox ?? ""),
        name: String(client.name ?? ""),
        phone: typeof client.phone === "string" ? client.phone.trim() : "",
        email,
        invitedAt,
        daysCold,
        emailInvites: Number(r.email_invite_count ?? 0),
        whatsappInvites: Number(r.whatsapp_invite_count ?? 0),
        lastEmailInviteAt: (r.last_email_invite_at as string | null) ?? null,
        lastWhatsappInviteAt: (r.last_whatsapp_invite_at as string | null) ?? null,
        lastEmailInviteBy: inviterName.get(String(r.last_email_invite_by ?? "")) ?? null,
        lastWhatsappInviteBy:
          inviterName.get(String(r.last_whatsapp_invite_by ?? "")) ?? null,
      } satisfies PortalColdInvitee;
    })
    .filter((x): x is PortalColdInvitee => x != null)
    .sort((a, b) => b.daysCold - a.daysCold);
}

/** Cliente sin acceso al portal y SIN correo válido — el equipo debe capturarle contacto. */
export type PortalContactlessClient = {
  id: string;
  markbox: string;
  name: string;
  /** correo actual (vacío o inválido — por eso no es invitable). */
  email: string;
  /** teléfono actual (puede servir para WhatsApp; NO habilita el magic-link). */
  phone: string;
};

/**
 * Clientes sin acceso al portal que NO tienen correo válido (adopción · captura de
 * contacto). Son la contraparte de `listPortalInviteCandidates`: mismo universo (sin
 * `client_users`) pero les falta el correo con el que se manda el magic-link. El
 * equipo les carga correo/teléfono acá y saltan a "Sin invitar". RLS por tenant;
 * descarta borrados. Orden: por nombre.
 */
export async function listPortalContactlessClients(
  supabase: SupabaseClient,
): Promise<PortalContactlessClient[]> {
  const [clientsRes, linkedRes] = await Promise.all([
    supabase
      .from("clients")
      .select("id, markbox, name, email, phone")
      .is("deleted_at", null)
      .limit(5000),
    supabase.from("client_users").select("client_id").limit(5000),
  ]);
  if (clientsRes.error) throw clientsRes.error;
  if (linkedRes.error) throw linkedRes.error;

  const hasAccess = new Set(
    ((linkedRes.data as { client_id: string }[] | null) ?? []).map((r) =>
      String(r.client_id),
    ),
  );

  return ((clientsRes.data as Record<string, unknown>[] | null) ?? [])
    .filter((c) => !hasAccess.has(String(c.id)))
    .filter((c) => {
      const email = typeof c.email === "string" ? c.email.trim() : "";
      return !email || !PORTAL_INVITE_EMAIL_RE.test(email);
    })
    .map((c) => ({
      id: String(c.id),
      markbox: String(c.markbox ?? ""),
      name: String(c.name ?? ""),
      email: typeof c.email === "string" ? c.email.trim() : "",
      phone: typeof c.phone === "string" ? c.phone.trim() : "",
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

/**
 * Aprobación de portal del cliente (SDD-0042 Fase 5 · gate de activación).
 * `clients.portal_approved_at` — null = pendiente de revisión. El cliente igual
 * destraba el dashboard con su primera carga; esto sólo refleja la aprobación
 * manual del asesor. RLS filtra por tenant.
 */
export async function getClientPortalApprovedAt(
  supabase: SupabaseClient,
  clientId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("clients")
    .select("portal_approved_at")
    .eq("id", clientId)
    .maybeSingle();

  if (error || !data) return null;
  return (data.portal_approved_at as string | null) ?? null;
}

/**
 * Parsea filtros desde searchParams del URL (?tier=&q=).
 */
export function parseClientFiltersFromSearchParams(
  raw: Record<string, string | string[] | undefined>,
): ClientFilters {
  const single = (k: string): string | undefined => {
    const v = raw[k];
    if (Array.isArray(v)) return v[0];
    return v;
  };

  const tierRaw = single("tier");
  const tier: ClientFilters["tier"] =
    tierRaw === "regular" || tierRaw === "vip" || tierRaw === "premium"
      ? tierRaw
      : "all";

  return {
    tier,
    q: single("q") || undefined,
    pendingReview: single("pending") === "1",
  };
}
