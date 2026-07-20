/**
 * Seed script para data sintetica del Studio.
 *
 * SDD-0005: 10 envios cubriendo los 4 servicios comerciales y estados variados.
 *
 * Confidencialidad: cero nombres reales. Usa "Empresa Demo", "Carga Ejemplo", etc.
 *
 * Como correr:
 *   - Via MCP (lo que ya hicimos): aplicar el SQL directo via Supabase MCP
 *   - Via Supabase CLI: supabase db reset && supabase seed
 *   - Localmente: pnpm tsx supabase/seed.ts (requiere SUPABASE_SERVICE_ROLE_KEY en .env.local)
 *
 * Idempotente: usa ON CONFLICT (tenant_id, code) DO NOTHING — re-correrlo es safe.
 */

import { createClient } from "@supabase/supabase-js";
import { seedDefaultRulesForTenant } from "../lib/studio/notifications/client-notification-rules-queries";

type SeedShipment = {
  code: string;
  client_name: string;
  client_markbox: string;
  origin: string;
  destination: string;
  shipment_service:
    | "consolidado_lcl"
    | "puerta_a_puerta_DDP"
    | "fcl_directo"
    | "transporte_terrestre";
  status:
    | "draft"
    | "in_warehouse"
    | "consolidating"
    | "shipped"
    | "in_transit"
    | "in_customs"
    | "arrived_destination"
    | "delayed_warehouse"
    | "out_for_delivery"
    | "last_mile"
    | "delivered"
    | "exception"
    | "cancelled";
  weight_kg: number;
  volume_m3: number;
  vehicle_category?: string | null;
  vehicle_model?: string | null;
  notes?: string | null;
};

const SHIPMENTS: SeedShipment[] = [
  { code: "DTDU-0001", client_name: "Empresa Demo S.A.",  client_markbox: "DTD-1001", origin: "Yiwu",     destination: "Puerto Cabello", shipment_service: "consolidado_lcl",        status: "in_transit",         weight_kg:   850.50, volume_m3:  3.250, notes: "Tránsito normal, ETA 15 días" },
  { code: "DTDU-0002", client_name: "Carga Ejemplo C.A.", client_markbox: "DTD-1002", origin: "Guangzhou",destination: "La Guaira",      shipment_service: "consolidado_lcl",        status: "in_customs",        weight_kg:  1240.00, volume_m3:  4.800, notes: "En revisión aduanal CIQ" },
  { code: "DTDU-0003", client_name: "Tenant Prueba SRL",  client_markbox: "DTD-1003", origin: "Yiwu",     destination: "Puerto Cabello", shipment_service: "consolidado_lcl",        status: "arrived_destination",weight_kg:   620.00, volume_m3:  2.100, notes: "Esperando retiro del cliente" },
  { code: "DTDU-0004", client_name: "Demo Pyme C.A.",     client_markbox: "DTD-1004", origin: "Shenzhen", destination: "Valencia",       shipment_service: "puerta_a_puerta_DDP",  status: "delivered",         weight_kg:  1800.00, volume_m3:  5.500, notes: "POD firmado" },
  { code: "DTDU-0005", client_name: "Demo Pyme C.A.",     client_markbox: "DTD-1004", origin: "Yiwu",     destination: "Caracas",        shipment_service: "puerta_a_puerta_DDP",  status: "in_transit",         weight_kg:   950.00, volume_m3:  3.700, notes: "Anticipo recibido" },
  { code: "DTDU-0006", client_name: "Tenant Industrial",  client_markbox: "DTD-1005", origin: "Ningbo",   destination: "Puerto Cabello", shipment_service: "fcl_directo",          status: "in_transit",         weight_kg: 18500.00, volume_m3: 67.000, vehicle_category: "contenedor_maritimo", vehicle_model: "40HC Reefer", notes: "Container completo FCL 40 pies" },
  { code: "DTDU-0007", client_name: "Tenant Industrial",  client_markbox: "DTD-1005", origin: "Shanghai", destination: "La Guaira",      shipment_service: "fcl_directo",          status: "exception",         weight_kg: 16200.00, volume_m3: 60.000, vehicle_category: "contenedor_maritimo", vehicle_model: "40HC",        notes: "Retención aduanal, en seguimiento" },
  { code: "DTDU-0008", client_name: "Demo Local Pyme",    client_markbox: "DTD-1006", origin: "Valencia", destination: "Maracaibo",      shipment_service: "transporte_terrestre", status: "out_for_delivery",   weight_kg:  3200.00, volume_m3:  8.000, vehicle_category: "gandola",            vehicle_model: "Gandola 40 ton", notes: "Salida programada hoy" },
  { code: "DTDU-0009", client_name: "Carga Ejemplo C.A.", client_markbox: "DTD-1002", origin: "Yiwu",     destination: "Puerto Cabello", shipment_service: "consolidado_lcl",        status: "delayed_warehouse", weight_kg:   480.00, volume_m3:  1.800, notes: "22 días sin retiro, bodegaje activo" },
  { code: "DTDU-0010", client_name: "Demo Pyme C.A.",     client_markbox: "DTD-1004", origin: "Guangzhou",destination: "Valencia",       shipment_service: "puerta_a_puerta_DDP",  status: "delivered",         weight_kg:  1100.00, volume_m3:  4.200, notes: "Cliente recurrente, entrega OK" },
];

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local",
    );
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", "dtd")
    .maybeSingle();

  if (tenantError || !tenant) {
    throw new Error("Tenant 'dtd' no existe. Aplica migración 0001 primero.");
  }

  // SDD-0156 · Slice C: todo tenant (incluido uno recién bootstrapeado) arranca
  // con las reglas default de avisos al cliente = comportamiento de HOY. La migr
  // 0247 sembró sólo los tenants existentes al aplicarse; esto cubre los nuevos.
  // Idempotente (no pisa reglas existentes).
  const seededRules = await seedDefaultRulesForTenant(supabase, tenant.id);
  if (seededRules > 0) {
    console.log(`✓ ${seededRules} reglas default de avisos al cliente sembradas`);
  }

  const rows = SHIPMENTS.map((s) => ({
    tenant_id: tenant.id,
    code: s.code,
    client_name: s.client_name,
    client_markbox: s.client_markbox,
    origin: s.origin,
    destination: s.destination,
    shipment_service: s.shipment_service,
    status: s.status,
    weight_kg: s.weight_kg,
    volume_m3: s.volume_m3,
    vehicle_category: s.vehicle_category ?? null,
    vehicle_model: s.vehicle_model ?? null,
    notes: s.notes ?? null,
  }));

  const { data, error } = await supabase
    .from("shipments")
    .upsert(rows, { onConflict: "tenant_id,code", ignoreDuplicates: true })
    .select("code, status, shipment_service");

  if (error) throw error;

  console.log(`✅ Seed completado: ${data?.length ?? 0} envíos insertados.`);
  if (data) {
    for (const row of data) {
      console.log(`  - ${row.code} · ${row.shipment_service} · ${row.status}`);
    }
  }
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
