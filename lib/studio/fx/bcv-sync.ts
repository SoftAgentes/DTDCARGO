import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { fechaCaracas, isCalendarDate, validInstant } from "@/lib/shared/fechas-caracas";
import { cancelBcvBody, fetchBcvObservation, readBcvBody } from "./bcv-source";
import { BCV_MAX_TENANTS, BCV_RUN_TIMEOUT_MS, BCV_URL, BcvError, decimalRateKey,
  emptyBcvCounts, sameDecimalRate, type BcvCounts, type BcvObservation, type BcvReason, type BcvSummary } from "./bcv-types";

type Client = SupabaseClient;
type Reply = { data: unknown; error: { code?: string } | null; count: number | null; status: number };
type Row = Readonly<{ id: string; tenant_id: string; currency: "VES"; source: "bcv";
  valid_on: string; rate: string; set_at: string; set_by: null }>;
const COLUMNS = "id,tenant_id,currency,source,valid_on,rate::text,set_at,set_by";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_DB_CODE = /^(?:[0-9A-Z]{5}|PGRST[0-9]{3})$/;
const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);

export function parseBcvTenantScope(raw: string | undefined): readonly string[] {
  const ids = raw?.split(",").map(id => id.trim().toLowerCase());
  if (!ids?.length || ids.length > BCV_MAX_TENANTS || ids.some(id => !UUID.test(id))
    || new Set(ids).size !== ids.length) throw new BcvError("INVALID_SCOPE");
  return Object.freeze(ids);
}

export function parseBcvDryRun(params: URLSearchParams): boolean {
  if ([...params.keys()].some(key => key !== "dryRun")) throw new BcvError("INVALID_QUERY");
  const modes = params.getAll("dryRun");
  if (!modes.length) return false;
  if (modes.length !== 1 || modes[0] !== "1") throw new BcvError("INVALID_QUERY");
  return true;
}

/** Gramática íntegra antes de parseInt del SDK; conserva el total paginado. */
function validExactReadRange(value: string | null): boolean {
  const match = value && /^(?:\*|([0-9]{1,16})-([0-9]{1,16}))\/([0-9]{1,16})$/.exec(value);
  if (!match) return false;
  const total = BigInt(match[3]);
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) return false;
  if (match[1] === undefined) return true;
  const start = BigInt(match[1]), end = BigInt(match[2]);
  return start <= end && end < total;
}

/** Conserva el HTTP original antes de los workarounds404 del SDK2.106.1. */
export function bcvDatabaseFetch(request: typeof globalThis.fetch, deadline: AbortSignal): typeof globalThis.fetch {
  return async (input, init) => {
    const signal = AbortSignal.any([deadline, ...(init?.signal ? [init.signal] : [])]);
    const response = await request(input, { ...init, cache: "no-store", signal });
    if (response.status >= 400) {
      let code: string | undefined;
      try {
        const raw = await readBcvBody(response, signal, 65_536);
        const parsed: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw));
        if (isObject(parsed) && typeof parsed.code === "string" && SAFE_DB_CODE.test(parsed.code)) code = parsed.code;
      } catch {
        if (signal.aborted) throw new BcvError("DEADLINE");
      }
      // [] o body vacío jamás llegan al branch que SDK convierte a200/204.
      return new Response(JSON.stringify({ message: "BCV_DATABASE_HTTP_ERROR", ...(code ? { code } : {}) }),
        { status: response.status, headers: { "content-type": "application/json" } });
    }
    if (!response.ok) {
      await cancelBcvBody(response.body, signal);
      throw new BcvError("SNAPSHOT_UNAVAILABLE");
    }
    if (response.status === 204 || response.status === 205) {
      await cancelBcvBody(response.body, signal);
      return new Response(null, { status: response.status, headers: response.headers });
    }
    const method = init?.method ?? (input instanceof Request ? input.method : "GET");
    const url = new URL(input instanceof Request ? input.url : input);
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    const exactTableRead = method === "GET" && /\/rest\/v1\/(?:tenants|fx_rates)$/.test(url.pathname)
      && headers.get("prefer")?.split(",").some(value => value.trim().toLowerCase() === "count=exact");
    if (exactTableRead && !validExactReadRange(response.headers.get("content-range"))) {
      await cancelBcvBody(response.body, signal);
      throw new BcvError("SNAPSHOT_UNAVAILABLE");
    }
    // También se termina/acota el body2xx dentro de la señal compartida.
    const bytes = await readBcvBody(response, signal);
    return new Response(bytes.buffer as ArrayBuffer, { status: response.status, headers: response.headers });
  };
}

/** Fábrica propia: no modifica createAdminClient ni la política global de fetch. */
export function createBcvServiceClient(options: { signal: AbortSignal; url?: string; serviceKey?: string; fetch?: typeof globalThis.fetch }): Client {
  const url = options.url ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = options.serviceKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new BcvError("CLIENT_UNAVAILABLE");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: bcvDatabaseFetch(options.fetch ?? globalThis.fetch, options.signal) },
  });
}

function exactArray(reply: Reply): unknown[] {
  if (reply.error || reply.status !== 200 || !Array.isArray(reply.data)
    || !Number.isInteger(reply.count) || reply.count !== reply.data.length) throw new BcvError("SNAPSHOT_UNAVAILABLE");
  return reply.data;
}

function rows(reply: Reply, ids: readonly string[], day: string): Row[] {
  const values = exactArray(reply);
  const seenIds = new Set<string>();
  const seenTenants = new Set<string>();
  return values.map(value => {
    if (!isObject(value) || Object.keys(value).length !== 8 || typeof value.id !== "string" || !UUID.test(value.id)
      || typeof value.tenant_id !== "string" || !ids.includes(value.tenant_id)
      || value.currency !== "VES" || value.source !== "bcv" || value.valid_on !== day || value.set_by !== null
      || typeof value.rate !== "string" || decimalRateKey(value.rate) === null || typeof value.set_at !== "string"
      || seenIds.has(value.id) || seenTenants.has(value.tenant_id)) throw new BcvError("SNAPSHOT_UNAVAILABLE");
    try { validInstant(value.set_at); } catch { throw new BcvError("SNAPSHOT_UNAVAILABLE"); }
    seenIds.add(value.id); seenTenants.add(value.tenant_id);
    return value as Row;
  });
}

async function capability(client: Client, signal: AbortSignal): Promise<void> {
  const reply = await client.rpc("bcv_rates_write_capability", {}, { get: true }).retry(false).abortSignal(signal);
  const data: unknown = reply.data;
  if (reply.error || reply.status !== 200 || !isObject(data) || Object.keys(data).length !== 2
    || data.version !== 1 || data.ready !== true) throw new BcvError("SQL_CONTRACT_UNAVAILABLE");
}

async function snapshot(client: Client, ids: readonly string[], day: string, signal: AbortSignal): Promise<Row[]> {
  const reply = await client.from("fx_rates").select(COLUMNS, { count: "exact" }).in("tenant_id", [...ids])
    .eq("currency", "VES").eq("source", "bcv").eq("valid_on", day).retry(false).abortSignal(signal);
  return rows(reply, ids, day);
}

function sameRow(left: Row, right: Row): boolean {
  return left.id === right.id && left.tenant_id === right.tenant_id && left.currency === right.currency
    && left.source === right.source && left.valid_on === right.valid_on && left.rate === right.rate
    && left.set_at === right.set_at && left.set_by === right.set_by;
}

/** Compara instantes sin truncar los microsegundos recibidos por HTTP. */
function instantKey(value: string): bigint {
  const milliseconds = validInstant(value).getTime();
  const fraction = /\.(\d{1,9})/.exec(value)?.[1] ?? "";
  return BigInt(milliseconds) * 1_000_000n + BigInt(fraction.slice(3).padEnd(6, "0"));
}

function note(observation: BcvObservation): string {
  if (!/^[0-9a-f]{64}$/.test(observation.sha256)) throw new BcvError("SOURCE_INVALID");
  validInstant(observation.retrievedAt);
  const value = `${BCV_URL} retrievedAt=${observation.retrievedAt} sha256=${observation.sha256} valid_on=${observation.quote.validOn}`;
  if (value.length > 500) throw new BcvError("SOURCE_INVALID");
  return value;
}

/** No hay transacción entre tenants ni retry de mutación. Cada builder se evalúa una vez. */
export async function syncBcvRates(options: Readonly<{
  enabled: boolean; dryRun: boolean; scope: string | undefined; signal?: AbortSignal;
  now?: () => Date; monotonicNow?: () => number;
  createClient?: (signal: AbortSignal) => Client;
  obtain?: typeof fetchBcvObservation;
}>): Promise<BcvSummary> {
  const mode = Object.freeze({ enabled: options.enabled, dryRun: options.dryRun });
  const clock = options.now ?? (() => new Date());
  const monotonic = options.monotonicNow ?? (() => performance.now());
  const startedAt = clock().toISOString();
  const today = fechaCaracas(startedAt);
  let counts = emptyBcvCounts();
  let observation: BcvObservation | undefined;
  const result = (status: BcvSummary["status"], reason: BcvReason): BcvSummary => ({ status, reason,
    dryRun: mode.dryRun, today, startedAt, counts: { ...counts }, ...(observation ? { observation: {
      validOn: observation.quote.validOn, rate: observation.quote.rate,
      retrievedAt: observation.retrievedAt, sha256: observation.sha256 } } : {}) });
  if (!mode.enabled && !mode.dryRun) return result("DISABLED", "DISABLED");
  let ids: readonly string[];
  try { ids = parseBcvTenantScope(options.scope); } catch { return result("REJECTED", "INVALID_SCOPE"); }
  counts = emptyBcvCounts(ids.length);
  const controller = new AbortController();
  const signal = AbortSignal.any([controller.signal, ...(options.signal ? [options.signal] : [])]);
  const stopAt = monotonic() + BCV_RUN_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), BCV_RUN_TIMEOUT_MS);
  const check = () => {
    if (signal.aborted || monotonic() >= stopAt) { controller.abort(); throw new BcvError("DEADLINE"); }
    if (fechaCaracas(clock()) !== today) throw new BcvError("DAY_CHANGED");
  };
  const finishTenant = (key: Exclude<keyof BcvCounts, "scope" | "notAttempted" | "deferred">) => {
    counts[key]++; counts.notAttempted--;
  };
  let client: Client;
  try {
    check();
    client = options.createClient ? options.createClient(signal) : createBcvServiceClient({ signal });
    const tenantReply = await client.from("tenants").select("id", { count: "exact" })
      .in("id", [...ids]).retry(false).abortSignal(signal);
    let tenants: unknown[];
    try { tenants = exactArray(tenantReply); } catch { throw new BcvError("SCOPE_UNAVAILABLE"); }
    if (tenants.length !== ids.length || tenants.some(t => !isObject(t) || Object.keys(t).length !== 1
      || typeof t.id !== "string" || !ids.includes(t.id))
      || new Set(tenants.map(t => (t as { id: string }).id)).size !== ids.length) throw new BcvError("SCOPE_UNAVAILABLE");
    const initial = await snapshot(client, ids, today, signal);
    await capability(client, signal);
    check();
    observation = await (options.obtain ?? fetchBcvObservation)({ signal, now: clock });
    const quote = observation.quote;
    if (quote.currency !== "VES" || quote.source !== "bcv" || quote.unit !== "VES/USD"
      || decimalRateKey(quote.rate) === null || !isCalendarDate(quote.validOn)) throw new BcvError("SOURCE_INVALID");
    const provenance = note(observation);
    check();
    if (quote.validOn !== today) {
      counts.deferred = counts.notAttempted;
      return result("WAITING", quote.validOn > today ? "WAITING_FOR_VALUE_DATE" : "NO_TODAY_QUOTE_IN_RESPONSE");
    }
    if (mode.dryRun) return result("CANDIDATE", "CANDIDATE_VALIDATED");

    for (const tenant of ids) {
      check();
      const observed = initial.find(row => row.tenant_id === tenant);
      if (observed && sameDecimalRate(observed.rate, quote.rate)) {
        const current = (await snapshot(client, [tenant], today, signal))[0];
        check();
        if (current && sameRow(current, observed)) finishTenant("unchanged");
        else if (current && sameDecimalRate(current.rate, quote.rate)) finishTenant("reconciled");
        else finishTenant("conflicts");
        continue;
      }
      await capability(client, signal);
      check();
      // Guard independiente del modo/ruta; nunca convertir un ensayo en writer.
      if (!(mode.enabled && !mode.dryRun)) throw new BcvError("WRITE_FAILED");
      const newSetAt = clock().toISOString();
      if (observed && instantKey(newSetAt) === instantKey(observed.set_at)) {
        // No fabricar un token nuevo con el mismo instante ni inventar una hora futura.
        finishTenant("conflicts");
        continue;
      }
      let reply: Reply;
      try {
        if (!observed) {
          reply = await client.from("fx_rates").insert({ tenant_id: tenant, currency: "VES", source: "bcv",
            valid_on: today, rate: quote.rate, set_by: null, set_at: newSetAt, note: provenance }, { count: "exact" })
            .select(COLUMNS).retry(false).abortSignal(signal);
        } else {
          reply = await client.from("fx_rates").update({ rate: quote.rate, note: provenance, set_by: null, set_at: newSetAt }, { count: "exact" })
            .eq("id", observed.id).eq("tenant_id", tenant).eq("currency", "VES").eq("source", "bcv")
            .eq("valid_on", today).eq("rate", observed.rate).eq("set_at", observed.set_at)
            .select(COLUMNS).retry(false).abortSignal(signal);
        }
      } catch {
        // La llamada pudo enviarse. No se deduce rollback por throw/aborto.
        reply = { data: null, error: null, count: null, status: 0 };
      }
      let returned: Row[] | undefined;
      try {
        // PostgREST INSERT devuelve201; PATCH200. Ambos necesitan representación íntegra/count.
        returned = rows({ ...reply, status: reply.status === 201 ? 200 : reply.status }, [tenant], today);
      } catch { /* Respuesta no confirmatoria: solo lectura de reconciliación. */ }
      const saved = returned?.[0];
      if (returned?.length === 1 && saved && sameDecimalRate(saved.rate, quote.rate)
        && (!observed || saved.id === observed.id) && instantKey(saved.set_at) === instantKey(newSetAt)) {
        finishTenant(observed ? "corrected" : "inserted");
        continue;
      }
      const unique = reply.error?.code === "23505";
      const zeroCas = !!observed && returned?.length === 0;
      try {
        check();
        const current = (await snapshot(client, [tenant], today, signal))[0];
        if (current && sameDecimalRate(current.rate, quote.rate)) { finishTenant("reconciled"); continue; }
        if (unique || zeroCas) { finishTenant("conflicts"); continue; }
      } catch { /* Sin certeza dentro del presupuesto; ninguna segunda escritura. */ }
      // Un error SQLSTATE validado permite clasificar rechazo; el HTTP solo no.
      if (reply.status >= 400 && reply.status < 500 && reply.error?.code
        && /^(?:22|23|42)[0-9A-Z]{3}$/.test(reply.error.code) && !unique) {
        finishTenant("failed");
        continue;
      }
      if (unique || zeroCas) { finishTenant("conflicts"); continue; }
      finishTenant("unknown"); counts.deferred = counts.notAttempted;
      return result("PARTIAL", "WRITE_UNKNOWN");
    }
    if (counts.unknown || counts.failed || counts.conflicts) return result("PARTIAL",
      counts.unknown ? "WRITE_UNKNOWN" : counts.failed ? "WRITE_FAILED" : "WRITE_CONFLICT");
    return result("COMPLETED", "COMPLETED");
  } catch (error) {
    counts.deferred = counts.notAttempted;
    const reason = signal.aborted ? "DEADLINE" : error instanceof BcvError ? error.reason : "CLIENT_UNAVAILABLE";
    const completed = counts.scope - counts.notAttempted;
    return result(completed ? "PARTIAL" : "REJECTED", reason);
  } finally { clearTimeout(timer); }
}
