/**
 * /m/cn — Home del operario CN (SDD-0027).
 *
 * Server component:
 *  1. Valida sesión via getCurrentOperario (cookie + DB)
 *  2. Si no hay sesión → redirect a /m/cn/login
 *  3. Query del warehouse + KPIs del día del operario + lista
 *     últimas recepciones del hub
 *  4. Renderiza OperarioHomeClient con props reales
 */

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/db/admin";
import { getCurrentOperario } from "@/lib/auth/operario-session";
import { getOperarioLang } from "@/lib/lang-server";
import {
  OperarioHomeClient,
  type RecentReceipt,
} from "./_components/OperarioHomeClient";

export const metadata = { title: "Mi día" };

// Forzar render dinámico para que las queries se ejecuten en cada request
// (la cookie + KPIs del día varían). Si no, Next podría cachear.
export const dynamic = "force-dynamic";

const RECENT_LIMIT = 5;
const SEARCH_LIMIT = 25;

export default async function OperarioHomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const operario = await getCurrentOperario();
  if (!operario) redirect("/m/cn/login");

  // Sprint 1.5 · búsqueda paginada · ?q= filtra por código/markbox/cliente
  const { q: rawQ } = await searchParams;
  const searchQuery = (rawQ ?? "").trim();
  const searchMode = searchQuery.length >= 2;

  const initialLang = await getOperarioLang();
  const admin = createAdminClient();

  // Warehouse data (code + nombre CN para el header)
  const { data: wh } = await admin
    .from("warehouses_cn")
    .select("code, warehouse_name, hub_name_cn")
    .eq("id", operario.warehouse_id)
    .maybeSingle<{ code: string; warehouse_name: string | null; hub_name_cn: string }>();

  // Today range (server timezone — Supabase es UTC por default).
  // received_at es DATE así que comparar con current_date es exacto.
  const todayIso = new Date().toISOString().slice(0, 10);

  // ── KPIs del día del operario ─────────────────────────────────
  // Las 3 cards son del DÍA del operario (no del mes completo).
  // "Recepciones" y "CBM" son las que él registró hoy.
  // "Pendientes" es del warehouse entero (no solo del operario) —
  // es lo que el hub debe consolidar.

  const [todayList, pendingWh] = await Promise.all([
    admin
      .from("warehouse_receipts_cn")
      .select("boxes, total_cbm")
      .eq("tenant_id", operario.tenant_id)
      .eq("created_by_operario_id", operario.operario_id)
      .eq("received_at", todayIso)
      .is("deleted_at", null),
    admin
      .from("warehouse_receipts_cn")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", operario.tenant_id)
      .eq("warehouse_id", operario.warehouse_id)
      .eq("status", "pendiente_consolidacion")
      .is("deleted_at", null),
  ]);

  const todayRows = (todayList.data ?? []) as Array<{
    boxes: number | null;
    total_cbm: string | number | null;
  }>;

  const todayCount = todayRows.length;
  const todayBoxes = todayRows.reduce((s, r) => s + (r.boxes ?? 0), 0);
  const todayCbm = Math.round(
    todayRows.reduce((s, r) => s + (r.total_cbm ? Number(r.total_cbm) : 0), 0) * 10,
  ) / 10;
  const pendingCount = pendingWh.count ?? 0;

  // ── Últimas recepciones del hub (no solo del operario actual) ─────
  // Lo que el operario ve cuando entra al almacén: qué llegó recién al
  // hub, sin importar quién lo registró.

  let recentQuery = admin
    .from("warehouse_receipts_cn")
    .select(
      "id, receipt_code, client_markbox, client_name, supplier_name, boxes, total_cbm, status, created_at, created_by_operario_id",
    )
    .eq("tenant_id", operario.tenant_id)
    .eq("warehouse_id", operario.warehouse_id)
    .is("deleted_at", null);

  if (searchMode) {
    // Escape de comodines PostgREST (% y _) + comas que romperían el .or()
    const safe = searchQuery.replace(/[%_,()]/g, " ").trim();
    recentQuery = recentQuery.or(
      [
        `receipt_code.ilike.%${safe}%`,
        `client_markbox.ilike.%${safe}%`,
        `client_name.ilike.%${safe}%`,
        `supplier_name.ilike.%${safe}%`,
      ].join(","),
    );
  }

  const { data: recentData } = await recentQuery
    .order("created_at", { ascending: false })
    .limit(searchMode ? SEARCH_LIMIT : RECENT_LIMIT);

  const recents: RecentReceipt[] = (recentData ?? []).map((r) => {
    const row = r as {
      id: string;
      receipt_code: string;
      client_markbox: string | null;
      client_name: string | null;
      supplier_name: string | null;
      boxes: number | null;
      total_cbm: string | number | null;
      status: string;
      created_at: string;
      created_by_operario_id: string | null;
    };
    return {
      id: row.id,
      code: row.receipt_code,
      client: row.client_name ?? row.client_markbox ?? "—",
      clientMarkbox: row.client_markbox,
      supplier: row.supplier_name,
      boxes: row.boxes ?? 0,
      cbm: row.total_cbm ? Number(row.total_cbm) : 0,
      createdAt: row.created_at,
      status: row.status,
      mine: row.created_by_operario_id === operario.operario_id,
    };
  });

  // ── Fecha + hora actual para el greeting ──────────────────────
  const now = new Date();
  const monthsEs = [
    "ene",
    "feb",
    "mar",
    "abr",
    "may",
    "jun",
    "jul",
    "ago",
    "sep",
    "oct",
    "nov",
    "dic",
  ];
  const greetingDate = `${now.getDate()} ${monthsEs[now.getMonth()]} ${now.getFullYear()} · ${String(
    now.getHours(),
  ).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  // ── Initials + first name desde display_name ──────────────────
  const nameParts = operario.display_name.split(/\s+/);
  const initials =
    nameParts
      .map((p) => p[0]?.toUpperCase() ?? "")
      .slice(0, 2)
      .join("") || "??";
  const firstName = nameParts[0] ?? operario.display_name;

  return (
    <OperarioHomeClient
      initialLang={initialLang}
      operario={{
        displayName: operario.display_name,
        displayNameCn: operario.display_name_cn,
        initials,
        firstName,
        firstNameCn: operario.display_name_cn ?? firstName,
        warehouseCode: wh?.code ?? "—",
        warehouseNameCn: wh?.warehouse_name ?? wh?.hub_name_cn ?? "—",
      }}
      today={{
        date: greetingDate,
        receipts: todayCount,
        boxes: todayBoxes,
        cbm: todayCbm,
        pending: pendingCount,
      }}
      recents={recents}
      searchMode={searchMode}
      searchQuery={searchQuery}
    />
  );
}
