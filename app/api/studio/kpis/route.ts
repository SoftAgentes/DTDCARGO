/**
 * Route handler de KPIs del dashboard.
 *
 * GET /api/studio/kpis — devuelve conteos agregados para las 4 cards del dashboard:
 *   en_transito: envios viajando (shipped + in_transit + last_mile + out_for_delivery)
 *   en_aduana: in_customs
 *   entregados: delivered
 *   con_alerta: exception + delayed_warehouse
 *
 * Auth: requiere sesion. RLS filtra por tenant.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/db/server";
import type { ShipmentStatus } from "@/lib/studio/shipment-types";

export type DashboardKPIs = {
  en_transito: number;
  en_aduana: number;
  entregados: number;
  con_alerta: number;
  total: number;
};

const IN_TRANSIT_STATES: ShipmentStatus[] = [
  "shipped",
  "in_transit",
  "last_mile",
  "out_for_delivery",
];

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shipments")
    .select("status");

  if (error) {
    return NextResponse.json(
      { error: "No pudimos leer KPIs.", detail: error.message },
      { status: 500 },
    );
  }

  const counts: DashboardKPIs = {
    en_transito: 0,
    en_aduana: 0,
    entregados: 0,
    con_alerta: 0,
    total: 0,
  };

  for (const row of data ?? []) {
    counts.total++;
    const status = row.status as ShipmentStatus;
    if (IN_TRANSIT_STATES.includes(status)) counts.en_transito++;
    else if (status === "in_customs") counts.en_aduana++;
    else if (status === "delivered") counts.entregados++;
    else if (status === "exception" || status === "delayed_warehouse") counts.con_alerta++;
  }

  return NextResponse.json({ kpis: counts });
}
