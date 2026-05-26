/**
 * /studio/admin/rutas — CRUD rutas + catálogo de ciudades del tenant (SDD-0029).
 *
 * Tabs:
 *   - Rutas (CRUD dispatch_routes)
 *   - Ciudades (CRUD dispatch_city_catalog · seed desde ve_locality_catalog)
 */

import { createClient } from "@/lib/db/server";
import {
  countCities,
  listCities,
  listRoutes,
  listVeLocalityCatalog,
} from "@/lib/studio/dispatch-routes-queries";
import { RoutesClient } from "./_components/RoutesClient";

export const metadata = { title: "Rutas y ciudades · DTD Studio" };

export default async function AdminRoutesPage() {
  const supabase = await createClient();
  const [routes, cities, citiesCount, veCatalog] = await Promise.all([
    listRoutes(supabase, { activeOnly: false }),
    listCities(supabase, { activeOnly: false }),
    countCities(supabase),
    listVeLocalityCatalog(supabase),
  ]);

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
          <span className="studio-eyebrow">Administración · Despacho</span>
          <h1
            className="studio-display"
            style={{ fontSize: 30, margin: "8px 0 8px", color: "var(--ink)" }}
          >
            Rutas y ciudades
          </h1>
          <p
            style={{
              font: "400 13px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: 0,
              maxWidth: "76ch",
            }}
          >
            Configurá las rutas operativas y el catálogo de ciudades destino.
            Las rutas se usan al armar Órdenes de Despacho. Las ciudades alimentan
            los formularios de cliente y de carga.
          </p>
        </div>
      </div>

      <RoutesClient
        routes={routes}
        cities={cities}
        citiesCount={citiesCount}
        veCatalog={veCatalog}
      />
    </div>
  );
}
