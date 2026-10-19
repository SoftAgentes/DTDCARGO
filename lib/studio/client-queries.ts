/**
 * Helpers de query reutilizables para el módulo Clientes (SDD-0010).
 *
 * RLS filtra por tenant_id automáticamente.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPaged } from "@/lib/db/paginate";
import type { Client, ClientTier } from "./client-types";
// SDD-0265: los topes viven en `client-types` porque el componente client los
// necesita para el "Ver más" y NO puede importar este archivo (cruce
// server→client; el gate tiene un paso que lo vigila).
import { CLIENTS_MAX, CLIENTS_PAGE } from "./client-types";
import {
  coerceClientOutstandingRows,
  esSinPermiso,
  resumirCuentaCliente,
  SaldoClienteError,
  type ClientOutstandingRow,
  type EstadoCuentaCliente,
} from "./client-account";
import { INACTIVE_STATUSES } from "./shipment-queries";

export type ClientFilters = {
  tier?: ClientTier | "all";
  q?: string;
  /** SDD-0046: solo clientes self-registrados aún sin verificar la identidad. */
  pendingReview?: boolean;
  /**
   * SDD-0265: cuántas filas traer. Sube de a `CLIENTS_PAGE` con "Ver más".
   * Se normaliza en `parseClientFiltersFromSearchParams` — nunca confíes en el
   * valor crudo de la URL.
   */
  limite?: number;
};

/** Lo que devuelve el listado: la página pedida más cuántos hay en total. */
export type ClientsPage = {
  clients: Client[];
  /** Total que matchea los filtros, contado en servidor (no `clients.length`). */
  total: number;
  /** Cuántas filas se pidieron — el tope efectivo de esta carga. */
  limite: number;
  /** `true` si el techo de PostgREST impide seguir mostrando más. */
  topeAlcanzado: boolean;
};

const CLIENT_COLUMNS =
  "id, tenant_id, markbox, name, email, phone, address, rif, contact_name, tier, notes, lat, lng, registration_channel, doc_kind, doc_verify_status, doc_verify_source, doc_registry_name, doc_verified_at, cedula_photo_path, advisor_id, aliado_id, person_id, created_at, updated_at, deleted_at";

/**
 * Arma la query del listado con sus filtros. Una sola definición para las dos
 * variantes; `conTotal` sólo agrega el `count`, que es lo único que las separa.
 *
 * El `count` NO va siempre: lo paga la query, y los otros cinco consumidores de
 * `listClients` (buscador global, combobox de cédula, Bitácora, CN, ERP móvil)
 * no necesitan el total y no tienen por qué costearlo.
 */
/**
 * Lee una tabla completa del portal, paginando.
 *
 * Estas lecturas alimentan PORCENTAJES de adopción (cuántos clientes tienen
 * acceso, cuántos entraron alguna vez). Truncar no muestra menos clientes:
 * cambia el porcentaje. Y un porcentaje mal no se ve mal — se ve como un dato.
 *
 * Hoy la cartera son ~449 clientes, muy por debajo del tope, así que esto no
 * corrige un número equivocado: evita que se vuelva equivocado en silencio el
 * día que la cartera pase de mil.
 */
async function todasLasFilas<T>(
  que: string,
  page: (from: number, to: number) => PromiseLike<{
    data: unknown;
    error: { message: string } | null;
  }>,
): Promise<T[]> {
  const { rows, complete } = await fetchAllPaged<T>(page);
  if (!complete) {
    throw new Error(
      que + ": la lectura supera el tope; el dato quedaría incompleto.",
    );
  }
  return rows;
}

function construirQuery(
  supabase: SupabaseClient,
  filters: ClientFilters,
  limite: number,
  conTotal: boolean,
) {
  const base = supabase.from("clients");
  // SDD-0509: la RLS NO oculta a los eliminados — "clients by tenant" (0456)
  // solo compara tenant, igual que la policy FOR ALL que dejó la 0230. Este
  // filtro es lo único que los saca del listado, del total y de los buscadores.
  let query = (
    conTotal
      ? base.select(CLIENT_COLUMNS, { count: "exact" })
      : base.select(CLIENT_COLUMNS)
  )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limite);

  if (filters.tier && filters.tier !== "all") {
    query = query.eq("tier", filters.tier);
  }

  // SDD-0046: "pendientes de revisar" = self-registrados sin verificación aún.
  if (filters.pendingReview) {
    query = query.eq("registration_channel", "portal").is("doc_verify_status", null);
  }

  if (filters.q && filters.q.trim()) {
    const term = filters.q.trim().replace(/[,()]/g, " ").replace(/\s+/g, " ").trim();
    // SDD-0106: cédula primero, Shipping Mark después. Para un match exacto
    // tolerante a formato usá getClientByCedula(); esta búsqueda libre es ilike.
    query = query.or(
      [
        `rif.ilike.%${term}%`,
        `name.ilike.%${term}%`,
        `markbox.ilike.%${term}%`,
        `email.ilike.%${term}%`,
        `phone.ilike.%${term}%`,
      ].join(","),
    );
  }

  return query;
}

/**
 * Lista de clientes con filtros opcionales. RLS filtra por tenant.
 * Hasta `CLIENTS_PAGE` ordenados por created_at DESC.
 *
 * Firma intacta a propósito: la usan el buscador global, el combobox de cédula,
 * Bitácora, CN y el ERP móvil. Para el LISTADO del módulo, que necesita saber
 * cuántos hay en total, usá `listClientsPage`.
 */
export async function listClients(
  supabase: SupabaseClient,
  filters: ClientFilters = {},
): Promise<Client[]> {
  const limite = Math.min(filters.limite ?? CLIENTS_PAGE, CLIENTS_MAX);
  const { data, error } = await construirQuery(supabase, filters, limite, false);
  if (error) throw error;
  return (data as Client[] | null) ?? [];
}

/**
 * Igual que `listClients`, pero además devuelve **cuántos hay en total**.
 *
 * SDD-0265 — existe porque el listado mentía por omisión. Medido el 2026-08-14:
 * con 451 filas en `clients`, la pantalla mostraba 200 y no decía nada, así que
 * 251 (el 56%) eran inalcanzables al navegar. Y como el orden es descendente,
 * los que desaparecían eran los MÁS VIEJOS — los de más recorrido.
 *
 * El `count: "exact"` cuenta contra los MISMOS filtros, así que el número que ve
 * el usuario es el de su búsqueda, no el del catálogo entero.
 */
export async function listClientsPage(
  supabase: SupabaseClient,
  filters: ClientFilters = {},
): Promise<ClientsPage> {
  const limite = Math.min(filters.limite ?? CLIENTS_PAGE, CLIENTS_MAX);
  const { data, error, count } = await construirQuery(supabase, filters, limite, true);
  if (error) throw error;

  const clients = (data as Client[] | null) ?? [];
  // Si PostgREST no devuelve `count`, NO inventamos un total: usamos lo que
  // trajimos, que es lo único que sabemos de verdad.
  const total = count ?? clients.length;

  return {
    clients,
    total,
    limite,
    topeAlcanzado: limite >= CLIENTS_MAX && total > CLIENTS_MAX,
  };
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
 * Lista los shipments vivos asociados a un MARKBOX. Lookup textual (sin FK).
 * Ordenados por created_at DESC. Hasta 200.
 *
 * Devuelve subset de campos suficientes para la tabla del histórico.
 * SDD-0509: un envío eliminado no entra al historial; la RLS no lo oculta.
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
    .is("deleted_at", null)
    .eq("client_markbox", markbox)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw error;
  return data ?? [];
}

/**
 * Estado del acceso al Portal del Cliente (SDD-0042) de un cliente.
 * `email` e `invitedAt` sólo son null en un vínculo revocado cuyo plazo de 30
 * días venció: la retención de SDD-0477 los borra y la fila sigue `revoked`.
 */
export type ClientPortalAccess = {
  status: "invited" | "active" | "revoked";
  email: string | null;
  invitedAt: string | null;
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
    email: (data.email as string | null) ?? null,
    invitedAt: (data.invited_at as string | null) ?? null,
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
    const [clients, linked, prealertasRows] = await Promise.all([
      todasLasFilas<{ id: string; markbox: string; email: string | null }>(
        "Clientes",
        (d, h) =>
          supabase
            .from("clients")
            .select("id, markbox, email")
            .is("deleted_at", null)
            .order("id", { ascending: true })
            .range(d, h),
      ),
      todasLasFilas<{ client_id: string; last_login_at: string | null; status: string; bound_at: string | null }>(
        "Accesos al portal",
        (d, h) =>
          supabase
            .from("client_users")
            .select("client_id, last_login_at, status, bound_at")
            .order("client_id", { ascending: true })
            .range(d, h),
      ),
      todasLasFilas<Record<string, unknown>>("Prealertas", (d, h) =>
        supabase
          .from("prealertas")
          .select("id, client_markbox")
          .is("deleted_at", null)
          .order("id", { ascending: true })
          .range(d, h),
      ),
    ]);
    const prealertasRes = { data: prealertasRows, error: null };
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
  const [clientsRows, linkedRows] = await Promise.all([
    todasLasFilas<Record<string, unknown>>("Clientes", (d, h) =>
      supabase
        .from("clients")
        .select("id, markbox, name, email, phone")
        .is("deleted_at", null)
        .order("id", { ascending: true })
        .range(d, h),
    ),
    todasLasFilas<Record<string, unknown>>("Accesos al portal", (d, h) =>
      supabase
        .from("client_users")
        .select("client_id")
        .order("client_id", { ascending: true })
        .range(d, h),
    ),
  ]);
  const clientsRes = { data: clientsRows, error: null };
  const linkedRes = { data: linkedRows, error: null };

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
  // Paginado. El `.catch` del primero conserva el fallback defensivo: si la
  // migracion de contadores aun no esta, el select ancho falla y se reintenta
  // con el basico.
  const [linkedRes, clientsRows] = await Promise.all([
    todasLasFilas<Record<string, unknown>>("Invitados al portal", (d, h) =>
      supabase
        .from("client_users")
        .select(
          "client_id, email, invited_at, email_invite_count, whatsapp_invite_count, last_email_invite_at, last_whatsapp_invite_at, last_email_invite_by, last_whatsapp_invite_by",
        )
        .eq("status", "invited")
        .order("client_id", { ascending: true })
        .range(d, h),
    )
      .then((rows) => ({ data: rows, error: null as { message: string } | null }))
      .catch((e: Error) => ({ data: null, error: { message: e.message } })),
    todasLasFilas<Record<string, unknown>>("Clientes", (d, h) =>
      supabase
        .from("clients")
        .select("id, markbox, name, phone")
        .is("deleted_at", null)
        .order("id", { ascending: true })
        .range(d, h),
    ),
  ]);
  const clientsRes = { data: clientsRows, error: null };
  let linkedData: Record<string, unknown>[] | null =
    linkedRes.data as Record<string, unknown>[] | null;
  if (linkedRes.error) {
    linkedData = await todasLasFilas<Record<string, unknown>>(
      "Invitados al portal",
      (d, h) =>
        supabase
          .from("client_users")
          .select("client_id, email, invited_at")
          .eq("status", "invited")
          .order("client_id", { ascending: true })
          .range(d, h),
    );
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
  const [clientsRows, linkedRows] = await Promise.all([
    todasLasFilas<Record<string, unknown>>("Clientes", (d, h) =>
      supabase
        .from("clients")
        .select("id, markbox, name, email, phone")
        .is("deleted_at", null)
        .order("id", { ascending: true })
        .range(d, h),
    ),
    todasLasFilas<Record<string, unknown>>("Accesos al portal", (d, h) =>
      supabase
        .from("client_users")
        .select("client_id")
        .order("client_id", { ascending: true })
        .range(d, h),
    ),
  ]);
  const clientsRes = { data: clientsRows, error: null };
  const linkedRes = { data: linkedRows, error: null };

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

  // SDD-0265: el `limite` viene de la URL, así que se normaliza acá y no se
  // confía en el crudo. Basura, negativos o un número gigante caen al bloque
  // por defecto o al techo; nunca pasan tal cual a la query.
  const limiteRaw = Number.parseInt(single("limite") ?? "", 10);
  const limite = Number.isFinite(limiteRaw)
    ? Math.min(Math.max(limiteRaw, CLIENTS_PAGE), CLIENTS_MAX)
    : CLIENTS_PAGE;

  return {
    tier,
    q: single("q") || undefined,
    pendingReview: single("pending") === "1",
    limite,
  };
}

// ── SDD-0558 · El saldo del cliente ─────────────────────────────────────────

/** Ids por llamada: 200 clientes × 4 monedas = 800 filas, bajo el tope de 1000. */
const SALDO_LOTE = 200;

/**
 * El saldo por cliente y moneda de `client_outstanding` (migración 0492), la
 * ÚNICA definición del saldo por cliente. En lotes de 200 ids. Lanza
 * `SaldoClienteError` con el código del error (42501 si el rol no ve el saldo)
 * o si una fila no valida: quien llama decide cómo degradar, nunca con un 0.
 */
export async function listClientOutstanding(
  supabase: SupabaseClient,
  clientIds: readonly string[],
): Promise<ClientOutstandingRow[]> {
  const ids = [...new Set(clientIds.filter((id) => typeof id === "string" && id !== ""))];
  const filas: ClientOutstandingRow[] = [];
  for (let i = 0; i < ids.length; i += SALDO_LOTE) {
    const lote = ids.slice(i, i + SALDO_LOTE);
    const { data, error } = await supabase.rpc("client_outstanding", { p_client_ids: lote });
    if (error) {
      throw new SaldoClienteError(`saldo: ${error.message}`, error.code ?? null);
    }
    filas.push(...coerceClientOutstandingRows(data));
  }
  return filas;
}

/**
 * Embarques en curso (sin entregar, cancelar ni en borrador) de un conjunto de
 * códigos, vivos. Misma lista de «fuera de curso» que el tracking operativo
 * (`INACTIVE_STATUSES`). Cuenta en la base, sin traer filas.
 */
export async function countShipmentsInProgress(
  supabase: SupabaseClient,
  markboxes: readonly string[],
): Promise<number> {
  const codigos = [...new Set(markboxes.map((m) => m.trim()).filter(Boolean))];
  if (codigos.length === 0) return 0;
  const { count, error } = await supabase
    .from("shipments")
    .select("id", { count: "exact", head: true })
    .in("client_markbox", codigos)
    .is("deleted_at", null)
    .not("status", "in", `(${INACTIVE_STATUSES.join(",")})`);
  if (error) throw error;
  return count ?? 0;
}

/** Referencia corta para cruzar el mensaje de la ficha con el log (ERR-01). */
function referenciaDeSoporte(): string {
  return globalThis.crypto.randomUUID().slice(0, 8);
}

/**
 * La cuenta del cliente para la cabecera de la ficha. NUNCA lanza:
 *  - sin permiso para el saldo (`puedeVerSaldo` false, o un 42501 de la base),
 *    no pide la función y devuelve `sin-permiso`: la cabecera no pinta dinero;
 *  - si el cálculo falla, `error` con una referencia que queda en el log;
 *  - si el conteo de embarques falla, el saldo sale igual y el conteo en null.
 * `codigosConocidos` (vigente + historial) sirve para contar embarques cuando
 * no hay saldo que traiga el conjunto completo de códigos.
 */
export async function getClientAccountState(
  supabase: SupabaseClient,
  client: { id: string; markbox: string },
  opciones: { puedeVerSaldo: boolean; codigosConocidos: readonly string[] },
): Promise<EstadoCuentaCliente> {
  const conocidos = [...new Set([client.markbox, ...opciones.codigosConocidos])];
  const contar = async (codigos: readonly string[]): Promise<number | null> => {
    try {
      return await countShipmentsInProgress(supabase, codigos);
    } catch (e) {
      console.error("[saldo-cliente] embarques en curso:", e instanceof Error ? e.message : e);
      return null;
    }
  };

  if (!opciones.puedeVerSaldo) {
    return { tipo: "sin-permiso", markboxes: conocidos, embarquesEnCurso: await contar(conocidos) };
  }

  try {
    const filas = await listClientOutstanding(supabase, [client.id]);
    const cuenta = resumirCuentaCliente(filas, client.id);
    if (!cuenta) throw new SaldoClienteError("saldo: la ficha no devolvió fila");
    return {
      tipo: "ok",
      cuenta: { ...cuenta, embarquesEnCurso: await contar(cuenta.markboxes) },
    };
  } catch (e) {
    if (esSinPermiso(e)) {
      return { tipo: "sin-permiso", markboxes: conocidos, embarquesEnCurso: await contar(conocidos) };
    }
    const referencia = referenciaDeSoporte();
    console.error(`[saldo-cliente] ref=${referencia}`, e instanceof Error ? e.message : e);
    return {
      tipo: "error",
      referencia,
      markboxes: conocidos,
      embarquesEnCurso: await contar(conocidos),
    };
  }
}
