/**
 * Tracking en vivo — vista operativa por contenedor (SDD-0013, SDD-0659).
 *
 * Primero salen los contenedores; los clientes se abren con un clic dentro del
 * suyo. A la izquierda, los contenedores del filtro elegido (en mar, en origen,
 * en destino). A la derecha, el tracking del contenedor: mapa centrado en el
 * Pacífico, indicadores, hitos y «Quién viene adentro».
 *
 * Los envíos activos que todavía no tienen contenedor no desaparecen: quedan en
 * el filtro «Sin contenedor», con la lista y el detalle por envío de siempre.
 *
 * Todo el estado vive en la URL (ver `_components/tracking-href.ts`). `?id=`
 * sigue funcionando: abre el contenedor de ese envío, o el envío suelto.
 *
 * Detalle de edición sigue siendo `/tracking/[id]`. Crear sigue siendo
 * `/tracking/nuevo`.
 */

import Link from "next/link";
import { requireModuleView } from "@/lib/studio/rbac-guard";
import { createClient } from "@/lib/db/server";
import {
  getShipmentById,
  getShipmentEvents,
  listActiveShipments,
} from "@/lib/studio/shipment-queries";
import {
  STATUS_LABELS,
  type Shipment,
  type ShipmentService,
  type ShipmentStatus,
} from "@/lib/studio/shipment-types";
import {
  ActiveShipmentList,
  type ActiveShipmentRow,
} from "./_components/ActiveShipmentList";
import { TrackingMap } from "./_components/TrackingMap";
import { TrackingTimeline } from "./_components/TrackingTimeline";
import { TrackingDetailActions } from "./_components/TrackingDetailActions";
import { TrackingEmptyOps } from "./_components/TrackingEmptyOps";
import { ContenedorList, FiltrosDeTracking } from "./_components/ContenedorList";
import { ContenedorPanel } from "./_components/ContenedorPanel";
import {
  BuscadorTracking,
  type ResultadosDeTracking,
} from "./_components/BuscadorTracking";
import { ubicarEnMapa, type MarcadorDelMapa } from "./_components/MapaPacifico";
import { hrefDeTracking } from "./_components/tracking-href";
import { contarAdjuntosDeEmbarques } from "@/lib/studio/documents/adjuntos-queries";
import { conteosPorId } from "@/lib/studio/documents/adjuntos";
import {
  readCanSeeClientNames,
  segunVisibilidad,
} from "@/lib/studio/privacidad-cn";
import { containerStatusLabel } from "@/lib/studio/naviera/types";
import {
  agruparResultados,
  armarContenedor,
  contarPorFiltro,
  esFiltroTracking,
  fechasPorEstado,
  filtroPorDefecto,
  hitosDelContenedor,
  idDeUrl,
  normalizarBusqueda,
  nombreDelContenedor,
  ordenarContenedores,
  type ContenedorVista,
  type EnvioDelItem,
  type FiltroTracking,
} from "@/lib/studio/tracking-contenedores";
import {
  TOPE_DE_BUSQUEDA,
  buscarEnTracking,
  leerContenedoresDeTracking,
  leerEnviosPorIds,
  leerItinerarios,
  leerRastreos,
} from "@/lib/studio/tracking-contenedores-queries";

export const metadata = { title: "Tracking en vivo" };

type ActiveRow = {
  id: string;
  code: string;
  client_name: string | null;
  client_markbox: string | null;
  origin: string | null;
  destination: string | null;
  shipment_service: ShipmentService;
  status: ShipmentStatus;
  created_at: string;
  arrived_destination_at: string | null;
};

const texto = (v: string | string[] | undefined): string | null =>
  typeof v === "string" && v.length > 0 ? v : null;

/** Etiqueta corta para el punto del mapa: el número final de la referencia. */
function etiquetaCorta(c: ContenedorVista): string {
  const m = /(\d+)\s*$/.exec(c.ref ?? "");
  if (m) return String(Number(m[1]));
  return c.nombre.slice(0, 8);
}

export default async function TrackingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireModuleView("tracking");

  const sp = await searchParams;
  // Los ids de la URL se validan: un valor que no es UUID se ignora en vez de
  // llegar a la base, donde haría fallar la consulta entera.
  const idPedido = idDeUrl(sp.id);
  const contenedorPedido = idDeUrl(sp.c);
  const resaltadoPedido = idDeUrl(sp.e);
  const qCrudo = texto(sp.q) ?? "";
  const q = normalizarBusqueda(qCrudo);

  const supabase = await createClient();
  // SDD-0531 · PIPL: al equipo de China (región cn, no admin) el nombre del
  // cliente no le llega. Se oculta acá, en el servidor, antes de que nada se
  // serialice hacia el navegador: envíos, clientes del contenedor y búsqueda.
  const puedeVerNombres = await readCanSeeClientNames(supabase);
  const active = segunVisibilidad(
    (await listActiveShipments(supabase)) as ActiveRow[],
    puedeVerNombres,
  );

  const ahora = new Date();
  const leido = await leerContenedoresDeTracking(
    supabase,
    active.map((s) => s.id),
    contenedorPedido,
    ahora,
  );
  const items = segunVisibilidad(leido.items, puedeVerNombres);

  const [itinerarios, rastreos] = await Promise.all([
    leerItinerarios(
      supabase,
      leido.contenedores.map((c) => c.sailing_id),
    ),
    leerRastreos(supabase),
  ]);

  // Estado de cada envío enlazado: los activos ya están; el resto se lee.
  const envios = new Map<string, EnvioDelItem>(
    active.map((s) => [
      s.id,
      { id: s.id, code: s.code, status: s.status, destination: s.destination },
    ]),
  );
  const otros = await leerEnviosPorIds(
    supabase,
    items.map((i) => i.shipment_id).filter((id) => id !== null && !envios.has(id)),
  );
  for (const [id, e] of otros) envios.set(id, e);

  const itemsPorContenedor = new Map<string, typeof items>();
  for (const it of items) {
    const lista = itemsPorContenedor.get(it.consolidation_id) ?? [];
    lista.push(it);
    itemsPorContenedor.set(it.consolidation_id, lista);
  }

  const vistas = leido.contenedores
    .map((c) =>
      armarContenedor(
        c,
        itemsPorContenedor.get(c.id) ?? [],
        envios,
        c.sailing_id ? (itinerarios.get(c.sailing_id) ?? null) : null,
        rastreos.get(c.id) ?? null,
        ahora,
      ),
    )
    .filter((v): v is ContenedorVista => v !== null);

  const contenedorDelEnvio = new Map<string, string>();
  for (const v of vistas) {
    for (const it of v.items) {
      if (it.shipmentId) contenedorDelEnvio.set(it.shipmentId, v.id);
    }
  }
  const sinContenedor = active.filter((s) => !contenedorDelEnvio.has(s.id));
  const vivas = vistas.filter((v) => v.grupo !== "entregado");
  const conteos = contarPorFiltro(vivas, sinContenedor.length);

  // ── Búsqueda ──────────────────────────────────────────────────
  let resultados: ResultadosDeTracking | null = null;
  if (q) {
    const hallazgo = await buscarEnTracking(supabase, q, puedeVerNombres);
    const hallados = segunVisibilidad(hallazgo.items, puedeVerNombres);
    const enviosHallados = await leerEnviosPorIds(
      supabase,
      hallados.map((i) => i.shipment_id),
    );
    const contenedorPorId = new Map(hallazgo.contenedores.map((c) => [c.id, c]));
    const aguja = q.toLowerCase();
    resultados = {
      q,
      clientes: agruparResultados(
        hallados.map((i) => {
          const c = contenedorPorId.get(i.consolidation_id)!;
          const envio = i.shipment_id ? enviosHallados.get(i.shipment_id) : undefined;
          return {
            itemId: i.id,
            client_markbox: i.client_markbox,
            client_name: i.client_name,
            contenedorId: c.id,
            contenedorNombre: nombreDelContenedor(c),
            estadoLabel: envio ? STATUS_LABELS[envio.status] : containerStatusLabel(c.status),
            shipmentId: i.shipment_id,
            pieces: i.pieces,
            cbm: i.cbm,
          };
        }),
      ),
      // Solo los contenedores que coinciden por referencia, número o BL; los
      // que llegaron por un cliente ya salen bajo ese cliente.
      contenedores: hallazgo.contenedores
        .filter((c) => hallazgo.directos.has(c.id))
        .map((c) => ({
          id: c.id,
          nombre: nombreDelContenedor(c),
          estadoLabel: containerStatusLabel(c.status),
          containerNo: c.container_no,
          bl: hallazgo.directos.get(c.id)?.bl ?? null,
        })),
      sueltos: sinContenedor
        .filter((s) =>
          [s.code, s.client_markbox, puedeVerNombres ? s.client_name : null].some((v) =>
            v?.toLowerCase().includes(aguja),
          ),
        )
        .map((s) => ({
          id: s.id,
          code: s.code,
          client_markbox: s.client_markbox,
          client_name: s.client_name,
        })),
      truncado: hallazgo.items.length >= TOPE_DE_BUSQUEDA,
    };
  }

  const buscador = (
    <BuscadorTracking q={qCrudo} nombresOcultos={!puedeVerNombres} resultados={resultados} />
  );

  if (active.length === 0 && vistas.length === 0) {
    return (
      <div style={{ maxWidth: 1200 }}>
        <TrackingHeader envios={0} contenedores={0} />
        {buscador}
        <TrackingEmptyOps />
      </div>
    );
  }

  // ── Qué se abre ───────────────────────────────────────────────
  // 1. `?id=` de un envío con contenedor → ese contenedor, con el envío resaltado.
  // 2. `?c=` → ese contenedor (también uno ya entregado, que llega del buscador).
  // 3. `?id=` de un envío sin contenedor → filtro «Sin contenedor».
  // 4. Nada → el primero del filtro; sin filtro, el primer filtro con algo.
  const contenedorPorEnvio = idPedido ? (contenedorDelEnvio.get(idPedido) ?? null) : null;
  let elegido =
    vistas.find((v) => v.id === (contenedorPorEnvio ?? contenedorPedido)) ?? null;
  const resaltado = contenedorPorEnvio ? idPedido : resaltadoPedido;
  const envioSuelto = idPedido !== null && contenedorPorEnvio === null;

  const filtro: FiltroTracking = esFiltroTracking(sp.g)
    ? sp.g
    : elegido
      ? elegido.grupo === "entregado"
        ? "destino"
        : elegido.grupo
      : envioSuelto
        ? "sin"
        : filtroPorDefecto(conteos);

  const delFiltro =
    filtro === "sin" ? [] : ordenarContenedores(vivas.filter((v) => v.grupo === filtro));
  if (!elegido && filtro !== "sin") elegido = delFiltro[0] ?? null;

  const cabecera = <TrackingHeader envios={active.length} contenedores={vivas.length} />;
  const filtros = <FiltrosDeTracking filtro={filtro} conteos={conteos} />;

  // ── Filtro «Sin contenedor»: lista y detalle por envío ─────────
  if (filtro === "sin") {
    let selected: Shipment | null = null;
    if (idPedido) selected = await getShipmentById(supabase, idPedido);
    if (!selected && sinContenedor[0]) {
      selected = await getShipmentById(supabase, sinContenedor[0].id);
    }
    selected = segunVisibilidad(selected, puedeVerNombres);

    // SDD-0507: cuántos adjuntos tiene cada envío, con el cliente de sesión.
    // `null` si no se pudo contar: la barra lateral lo dice.
    const adjuntos = conteosPorId(
      await contarAdjuntosDeEmbarques(
        supabase,
        sinContenedor.map((s) => s.id),
      ),
    );
    const filas: ActiveShipmentRow[] = sinContenedor.map((s) => ({
      id: s.id,
      code: s.code,
      client_name: s.client_name,
      client_markbox: s.client_markbox,
      origin: s.origin,
      destination: s.destination,
      shipment_service: s.shipment_service,
      status: s.status,
      created_at: s.created_at,
      arrived_destination_at: s.arrived_destination_at,
    }));

    return (
      <div style={{ maxWidth: 1200 }}>
        {cabecera}
        {buscador}
        <div className="studio-tracking-ops-grid">
          <div className="studio-tracking-ops-col">
            {filtros}
            <ActiveShipmentList
              shipments={filas}
              selectedId={selected?.id ?? null}
              adjuntos={adjuntos}
              nombresOcultos={!puedeVerNombres}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {selected ? (
              <>
                <TrackingDetailActions shipment={selected} />
                <TrackingMap shipment={selected} />
                <TrackingTimeline shipment={selected} />
              </>
            ) : (
              <p className="studio-tracking-ops-vacio">
                Todos los envíos activos ya tienen contenedor.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Contenedor elegido ────────────────────────────────────────
  let panel = (
    <p className="studio-tracking-ops-vacio">
      No hay contenedores {filtro === "mar" ? "en mar" : filtro === "origen" ? "en origen" : "en destino"}{" "}
      en este momento.
    </p>
  );
  if (elegido) {
    const representante = elegido.items.find((i) => i.shipmentId)?.shipmentId ?? null;
    const [eventos, conteoAdjuntos] = await Promise.all([
      representante ? getShipmentEvents(supabase, representante) : Promise.resolve([]),
      contarAdjuntosDeEmbarques(
        supabase,
        elegido.items.map((i) => i.shipmentId).filter((id): id is string => id !== null),
      ),
    ]);
    const hitos = hitosDelContenedor(
      elegido,
      fechasPorEstado(eventos as { status: ShipmentStatus; occurred_at: string }[]),
    );

    const enMapa = vivas.some((v) => v.id === elegido!.id) ? vivas : [...vivas, elegido];
    const marcadores: MarcadorDelMapa[] = enMapa.map((v) => ({
      id: v.id,
      etiqueta: etiquetaCorta(v),
      titulo: `Contenedor ${v.nombre}: ${v.estadoLabel}`,
      ...ubicarEnMapa(v.grupo, v.posicion),
      activo: v.id === elegido!.id,
      alerta: v.alertas > 0,
      href: hrefDeTracking({ g: v.grupo === "entregado" ? "destino" : v.grupo, c: v.id }),
    }));

    panel = (
      <ContenedorPanel
        contenedor={elegido}
        hitos={hitos}
        marcadores={marcadores}
        adjuntos={conteosPorId(conteoAdjuntos)}
        nombresOcultos={!puedeVerNombres}
        resaltado={resaltado}
      />
    );
  }

  return (
    <div style={{ maxWidth: 1200 }}>
      {cabecera}
      {buscador}
      <div className="studio-tracking-ops-grid">
        <div className="studio-tracking-ops-col">
          {filtros}
          <ContenedorList
            contenedores={delFiltro}
            seleccionado={elegido?.id ?? null}
            filtro={filtro}
            vacio="Ningún contenedor en este grupo."
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>{panel}</div>
      </div>
    </div>
  );
}

function TrackingHeader({
  envios,
  contenedores,
}: {
  envios: number;
  contenedores: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
        marginBottom: 16,
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <div>
        <span className="studio-eyebrow">Operación · en vivo</span>
        <h1
          className="studio-display"
          style={{
            fontSize: 30,
            margin: "var(--s-2) 0 var(--s-3)",
            color: "var(--ink)",
          }}
        >
          Tracking en vivo.
        </h1>
        <p
          style={{
            font: "400 13px/1.4 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
            maxWidth: "60ch",
          }}
        >
          Por contenedor. La posición es la del rastreo de la naviera cuando existe; si
          no, es estimada y así se indica · {contenedores}{" "}
          {contenedores === 1 ? "contenedor" : "contenedores"} · {envios}{" "}
          {envios === 1 ? "envío activo" : "envíos activos"}.
        </p>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {/* SDD-0289 · el CSV trae TODOS los embarques (paginado), no sólo los
            activos que muestra esta pantalla. */}
        <a
          href="/api/studio/operativo/export?tipo=embarques"
          className="studio-btn studio-btn-ghost"
          title="Descarga todos los embarques en CSV"
        >
          Exportar
        </a>
        <Link
          href="/studio/tracking/nuevo"
          className="studio-btn studio-btn-primary"
        >
          + Envío
        </Link>
      </div>
    </div>
  );
}
