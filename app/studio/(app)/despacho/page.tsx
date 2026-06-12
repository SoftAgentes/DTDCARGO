/**
 * /studio/despacho — Vista 1 Admin del módulo Despacho (SDD-0029).
 *
 * Cola priorizada con scoring + KPIs + panel ODs activas + drawer crear OD.
 * Filtros via ?hub=&status=&pay= en URL.
 */

import { createClient } from "@/lib/db/server";
import {
  computeDispatchKpis,
  listActiveDispatchOrders,
  listEligiblePackages,
} from "@/lib/studio/dispatch-queries";
import { getDispatchRules } from "@/lib/studio/dispatch-rules-queries";
import { listRoutes } from "@/lib/studio/dispatch-routes-queries";
import { listAvailableDrivers, listAvailableTrucks } from "@/lib/studio/tms-queries";
import { rankPackagesByScore } from "@/lib/studio/dispatch-scoring";
import { parseDispatchFilters } from "@/lib/studio/dispatch-types";
import { DispatchClient } from "./_components/DispatchClient";

export const metadata = { title: "Despacho · DTD Studio" };

type SearchParams = { [key: string]: string | string[] | undefined };

export default async function DispatchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const filters = parseDispatchFilters(params);

  const supabase = await createClient();

  // Resolver tenant del user logueado · necesario para Realtime filter
  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  const tenantId = link?.tenant_id ?? null;

  const [eligibleRaw, activeOds, rules, kpis, routes, availableTrucks, availableDrivers] =
    await Promise.all([
      listEligiblePackages(supabase, { city: filters.city }),
      listActiveDispatchOrders(supabase),
      getDispatchRules(supabase),
      computeDispatchKpis(supabase),
      listRoutes(supabase, { activeOnly: true }),
      listAvailableTrucks(supabase),
      listAvailableDrivers(supabase),
    ]);

  // Aplica rules (payment_policy + scoring) en server, ordena la cola
  const queue = rankPackagesByScore(eligibleRaw, rules);

  return (
    <div style={{ maxWidth: 1480 }}>
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
          <span className="studio-eyebrow">Operación · Despacho</span>
          <h1
            className="studio-display"
            style={{ fontSize: 30, margin: "8px 0 8px", color: "var(--ink)" }}
          >
            Cola de despacho
          </h1>
          <p
            style={{
              font: "400 13px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: 0,
              maxWidth: "76ch",
            }}
          >
            Paquetes listos para entrega ordenados por el motor de scoring. Arma
            órdenes de despacho asignando ruta, camión y chofer. La cola se ordena
            según las{" "}
            <a
              href="/studio/despacho/reglas"
              style={{ color: "var(--wine)", textDecoration: "underline" }}
            >
              reglas
            </a>{" "}
            que tengas configuradas.
          </p>
        </div>
      </div>

      <DispatchClient
        queue={queue}
        activeOds={activeOds}
        rules={rules}
        kpis={kpis}
        routes={routes}
        availableTrucks={availableTrucks}
        availableDrivers={availableDrivers}
        filters={filters}
        tenantId={tenantId}
      />
    </div>
  );
}
