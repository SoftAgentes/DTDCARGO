/**
 * /studio/cn — Almacén CN (SDD-0016).
 *
 * Server component. Fetchea recepciones + warehouses + clients + KPIs en
 * paralelo y delega la UI interactiva al AlmacenCnClient.
 *
 * Reemplaza el placeholder previo del módulo.
 */

import { createClient } from "@/lib/db/server";
import { listClients } from "@/lib/studio/client-queries";
import {
  computeWarehouseKpis,
  listReceipts,
  listWarehouses,
  parseReceiptFiltersFromSearchParams,
} from "@/lib/studio/warehouse-cn-queries";
import { listCities } from "@/lib/studio/dispatch-routes-queries";
import { resolveLocale } from "@/lib/i18n/resolve-server";
import { t } from "@/lib/i18n";
import { AlmacenCnClient } from "./_components/AlmacenCnClient";
import { HeaderActions } from "./_components/HeaderActions";
import { WarehouseKpis } from "./_components/WarehouseKpis";

export const metadata = { title: "Almacén CN" };

export default async function CnPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const rawParams = await searchParams;
  const filters = parseReceiptFiltersFromSearchParams(rawParams);

  const supabase = await createClient();
  const [receipts, warehouses, clients, kpis, cities] = await Promise.all([
    listReceipts(supabase, filters),
    listWarehouses(supabase),
    listClients(supabase),
    computeWarehouseKpis(supabase),
    // Catálogo per-tenant para el picker de destino al consolidar.
    // Si vacío, el component fallback a input text libre.
    listCities(supabase, { activeOnly: true }),
  ]);

  // Resolver locale para textos server-side (header eyebrow/título/desc + KPIs).
  // Server actions usan el query; el override URL `?lang=` se aplica en cliente.
  const userId = (await supabase.auth.getUser()).data.user?.id;
  const [{ data: prof }, { data: ut }] = await Promise.all([
    userId
      ? supabase
          .from("user_profiles")
          .select("locale")
          .eq("user_id", userId)
          .maybeSingle<{ locale: string | null }>()
      : Promise.resolve({ data: null }),
    userId
      ? supabase
          .from("user_tenants")
          .select("region")
          .eq("user_id", userId)
          .maybeSingle<{ region: string | null }>()
      : Promise.resolve({ data: null }),
  ]);
  const { locale } = await resolveLocale({
    userProfileLocale: prof?.locale ?? null,
    userTenantRegion: ut?.region ?? null,
  });

  // Header: título queda compuesto "<prefijo> · 中国" — el sufijo 中国 va
  // siempre en CN como guiño visual (cuando el locale es zh-CN ya se dobla,
  // pero el design canónico lo mantiene como signature).
  const titlePrefix = t(locale, "warehouse_cn.page.title_prefix");
  const description = t(locale, "warehouse_cn.page.description_template", {
    hubs: t(locale, "warehouse_cn.page.hubs_label"),
  });

  return (
    <div style={{ maxWidth: 1480 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 24,
          marginBottom: 24,
          flexWrap: "wrap",
        }}
      >
        <div>
          <span className="studio-eyebrow">
            {t(locale, "warehouse_cn.page.eyebrow")}
          </span>
          <h1
            className="studio-display"
            style={{
              fontSize: 30,
              margin: "8px 0 8px",
              color: "var(--ink)",
            }}
          >
            {titlePrefix} ·{" "}
            <span
              style={{
                fontFamily: '"Noto Sans SC", var(--f-sans)',
                color: "var(--wine)",
              }}
            >
              中国
            </span>
          </h1>
          <p
            style={{
              font: "400 13px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: 0,
              maxWidth: "70ch",
            }}
          >
            {description}
          </p>
        </div>
        <HeaderActions />
      </div>

      {/* KPIs */}
      <WarehouseKpis kpis={kpis} locale={locale} />

      {/* Toolbar + tabla + drawer */}
      <AlmacenCnClient
        receipts={receipts}
        warehouses={warehouses}
        clients={clients}
        cities={cities}
        filters={filters}
      />
    </div>
  );
}
