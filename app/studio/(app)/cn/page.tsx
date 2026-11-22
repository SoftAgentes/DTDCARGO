/**
 * /studio/cn — Almacén CN (SDD-0016).
 *
 * Server component. Fetchea recepciones + warehouses + clients + KPIs en
 * paralelo y delega la UI interactiva al AlmacenCnClient.
 *
 * Reemplaza el placeholder previo del módulo.
 *
 * SDD-0682: dos vistas en la misma pantalla. «En almacén» (por defecto) solo
 * muestra lo que sigue en la bodega; lo consolidado ya salió y se ve en «En
 * camino» (`?vista=camino`), con los contenedores, el contador de días a la ETA y
 * el porcentaje del viaje.
 */

import { createClient } from "@/lib/db/server";
import { getStudioAccess, requireModuleView } from "@/lib/studio/rbac-guard";
import { canSpecial } from "@/lib/studio/rbac";
import { leerInfoRecepciones } from "@/lib/studio/borrado/servidor";
import { listClients } from "@/lib/studio/client-queries";
import {
  computeWarehouseKpis,
  leerSalidasDeAlmacen,
  listReceipts,
  listWarehouses,
  parseReceiptFiltersFromSearchParams,
} from "@/lib/studio/warehouse-cn-queries";
import { listCities } from "@/lib/studio/dispatch-routes-queries";
import { canSeeClientNames as reglaNombresDeClientes } from "@/lib/studio/privacidad-cn";
import { activeAlertShipmentIds } from "@/lib/studio/expense-alerts-queries";
import { listLiveRatesForReceipts } from "@/lib/studio/rate-snapshots/queries";
import { resolveLocale } from "@/lib/i18n/resolve-server";
import { vistaDeUrl } from "@/lib/studio/almacen-cn-vistas";
import { leerContenedoresEnCamino } from "@/lib/studio/almacen-cn-contenedores-queries";
import type { ContenedorEnCamino } from "@/lib/studio/almacen-cn-contenedores";
import {
  AlmacenCnClient,
  type EliminacionRecepciones,
  type TarifasCn,
} from "./_components/AlmacenCnClient";
import { CaminoCn } from "./_components/CaminoCn";
import { EncabezadoCn } from "./_components/EncabezadoCn";
import { VistasAlmacen } from "./_components/VistasAlmacen";
import { WarehouseKpis } from "./_components/WarehouseKpis";

export const metadata = { title: "Almacén CN" };

export default async function CnPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireModuleView("cn");

  const rawParams = await searchParams;
  const filters = parseReceiptFiltersFromSearchParams(rawParams);

  const supabase = await createClient();

  // Resolver user + locale + región/rol ANTES de las queries: necesitamos la
  // región para redactar nombres de cliente server-side a users region=cn
  // (SDD-0039 B.9). El override URL `?lang=` se aplica en cliente.
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
          .select("region, role")
          .eq("user_id", userId)
          .maybeSingle<{ region: string | null; role: string | null }>()
      : Promise.resolve({ data: null }),
  ]);
  const { locale } = await resolveLocale({
    userProfileLocale: prof?.locale ?? null,
    userTenantRegion: ut?.region ?? null,
  });
  // Privacidad: el equipo CN (no-admin) NO ve el nombre real del importador VE,
  // solo el MARKBOX. Admin (cualquier región) y users VE sí. La regla vive en
  // lib/studio/privacidad-cn.ts (SDD-0531): Tracking y Naviera leen la misma.
  const canSeeClientNames = reglaNombresDeClientes(ut);

  // SDD-0682: «En camino» no lee la tabla de «En almacén»: lee los contenedores
  // que ya zarparon y, de cada uno, sus recepciones consolidadas (con MARKBOX).
  // Si la lectura falla, la vista lo dice.
  const vista = vistaDeUrl(rawParams.vista);
  if (vista === "camino") {
    let contenedores: ContenedorEnCamino[] | null;
    try {
      contenedores = await leerContenedoresEnCamino(supabase, new Date());
    } catch {
      contenedores = null;
    }
    return (
      <div style={{ maxWidth: 1480 }}>
        <EncabezadoCn locale={locale} conAcciones={false} />
        <VistasAlmacen locale={locale} vista={vista} params={rawParams} />
        <CaminoCn locale={locale} contenedores={contenedores} />
      </div>
    );
  }

  // SDD-0522: eliminar recepciones es de admin. A quien puede se le lee qué
  // bloquea cada una, con la misma regla que aplica el borrado.
  const { role } = await getStudioAccess(supabase);
  const puedeEliminar = canSpecial(role, "delete_warehouse_receipts");

  // SDD-0682: qué recepciones consolidadas ya salieron de la bodega (su contenedor
  // zarpó o llegó). Se lee una vez: lo usan la tabla y el aviso.
  const salidas =
    filters.status === "en_almacen" ? await leerSalidasDeAlmacen(supabase, filters) : undefined;
  const consolidadas = salidas ? salidas.enCamino : null;

  const [receipts, warehouses, clients, kpis, cities, alertShipmentSet] =
    await Promise.all([
      listReceipts(supabase, filters, { redactClientNames: !canSeeClientNames, salidas }),
      listWarehouses(supabase),
      listClients(supabase),
      computeWarehouseKpis(supabase),
      // Catálogo per-tenant para el picker de destino al consolidar.
      // Si vacío, el component fallback a input text libre.
      listCities(supabase, { activeOnly: true }),
      // Shipments con alerta de gastos activa → chip "Pendiente gastos" en la row.
      activeAlertShipmentIds(supabase),
    ]);

  // SDD-0571: la tarifa congelada de cada recepción. Sin la 0496, «No disponible».
  const vivas = await listLiveRatesForReceipts(
    supabase,
    receipts.map((r) => r.id),
  );
  const tarifas: TarifasCn = vivas.disponible
    ? { disponible: true, porRecepcion: vivas.porRecepcion }
    : { disponible: false, porRecepcion: {} };
  const puedeCongelarTarifas =
    role === "admin" || role === "operations" || role === "warehouse" || role === "accounting";

  let eliminacion: EliminacionRecepciones | undefined;
  if (puedeEliminar) {
    const info = await leerInfoRecepciones(
      supabase,
      receipts.map((r) => r.id),
    );
    eliminacion = info === null ? { estado: "no_disponible" } : { estado: "lista", info };
  }

  return (
    <div style={{ maxWidth: 1480 }}>
      <EncabezadoCn locale={locale} />
      <VistasAlmacen locale={locale} vista={vista} params={rawParams} />

      {/* KPIs */}
      <WarehouseKpis kpis={kpis} locale={locale} />

      {/* Toolbar + tabla + drawer */}
      <AlmacenCnClient
        receipts={receipts}
        warehouses={warehouses}
        clients={clients}
        cities={cities}
        filters={filters}
        alertShipmentIds={Array.from(alertShipmentSet)}
        canSeeClientNames={canSeeClientNames}
        eliminacion={eliminacion}
        tarifas={tarifas}
        puedeCongelarTarifas={puedeCongelarTarifas}
        consolidadasOcultas={consolidadas}
      />
    </div>
  );
}
