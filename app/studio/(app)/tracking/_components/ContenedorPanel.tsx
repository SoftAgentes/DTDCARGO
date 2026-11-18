/**
 * ContenedorPanel — tracking del contenedor elegido (SDD-0659).
 *
 * De arriba abajo: quién es, aviso si hay alertas, mapa, indicadores, hitos y
 * «Quién viene adentro» (cerrado hasta que se pide).
 *
 * La posición se rotula siempre con su fuente: una estimación nunca se muestra
 * como dato real. No hay velocidad: no existe ese dato.
 */

import Link from "next/link";
import { Aviso } from "@/app/studio/_components/ui/Aviso";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { AdjuntosConteo } from "@/app/studio/_components/documents/AdjuntosConteo";
import {
  desgloseEmbarque,
  type ConteoEmbarque,
  type ConteosPorId,
} from "@/lib/studio/documents/adjuntos";
import { etiquetaDelCliente } from "@/lib/studio/privacidad-cn";
import { STATUS_LABELS } from "@/lib/studio/shipment-types";
import type {
  ContenedorVista,
  HitoContenedor,
} from "@/lib/studio/tracking-contenedores";
import { StatusBadge } from "./StatusBadge";
import { MapaPacifico, type MarcadorDelMapa } from "./MapaPacifico";
import { fechaCorta, metrosCubicos, textoDeDias } from "./tracking-href";

type Props = {
  contenedor: ContenedorVista;
  hitos: HitoContenedor[];
  marcadores: MarcadorDelMapa[];
  /** Conteo de adjuntos por envío; null si no se pudo contar. */
  adjuntos: ConteosPorId<ConteoEmbarque> | null;
  nombresOcultos: boolean;
  /** Envío a resaltar en la lista de clientes (llega del buscador). */
  resaltado: string | null;
};

function notaDePosicion(c: ContenedorVista): string {
  if (c.grupo === "origen") return "En origen: todavía no zarpa.";
  if (c.grupo !== "mar") return "En destino: ya arribó.";
  if (c.posicion.fuente === "naviera") {
    return `Posición reportada por el rastreo de la naviera el ${fechaCorta(c.posicion.fecha)}.`;
  }
  if (c.posicion.fuente === "itinerario") {
    return "Posición estimada con las fechas del itinerario. No es la ubicación real del buque.";
  }
  return "Posición estimada: zarpó y no hay fechas de itinerario. No es la ubicación real del buque.";
}

function Indicadores({ c, hitos }: { c: ContenedorVista; hitos: HitoContenedor[] }) {
  const idx = hitos.findIndex((h) => h.state === "active");
  const proximo = idx >= 0 ? hitos[idx + 1] : undefined;
  const enViaje = c.grupo === "mar" || c.grupo === "origen";
  const celdas: { l: string; v: string; s: string; acento?: boolean; mono?: boolean }[] = [
    { l: "Progreso", v: `${c.progreso}%`, s: c.estadoLabel, acento: true },
    {
      l: enViaje ? "Días restantes" : "Estado",
      v: enViaje ? textoDeDias(c.diasRestantes) : STATUS_LABELS[c.statusEnvio],
      s: enViaje ? "hasta el puerto de llegada" : "ya arribó",
    },
    {
      l: `ETA ${c.pod ?? "destino"}`,
      v: c.eta ? fechaCorta(c.eta) : "Sin fecha",
      s:
        c.etaFuente === "naviera"
          ? "según la naviera"
          : c.etaFuente === "itinerario"
            ? "según el itinerario"
            : "falta el itinerario",
      mono: true,
    },
    {
      l: "Próximo hito",
      v: proximo ? proximo.label : "—",
      s: proximo?.fecha ? `${fechaCorta(proximo.fecha)} (plan)` : "",
    },
    {
      l: "Carga",
      v: metrosCubicos(c.usedCbm),
      s:
        c.capCbm !== null
          ? `de ${metrosCubicos(c.capCbm)} útiles · ${c.clientes} clientes`
          : `${c.clientes} clientes`,
    },
  ];
  return (
    <dl className="studio-tracking-ops-kpis">
      {celdas.map((k) => (
        <div key={k.l}>
          <dt className="studio-eyebrow">{k.l}</dt>
          <dd
            className={k.mono ? undefined : "studio-display"}
            data-acento={k.acento ? "true" : "false"}
            data-mono={k.mono ? "true" : "false"}
          >
            {k.v}
          </dd>
          <dd className="studio-tracking-ops-kpi-sub">{k.s}</dd>
        </div>
      ))}
    </dl>
  );
}

function Hitos({ hitos }: { hitos: HitoContenedor[] }) {
  return (
    <ol className="studio-tracking-ops-hitos" aria-label="Hitos del contenedor">
      {hitos.map((h) => (
        <li key={h.status} data-estado={h.state} aria-current={h.state === "active" ? "step" : undefined}>
          <span className="studio-tracking-ops-hito-punto" aria-hidden />
          <b>{h.label}</b>
          <span className="studio-tracking-ops-hito-fecha">
            {h.fecha
              ? `${fechaCorta(h.fecha)}${h.planificada ? " (plan)" : ""}`
              : h.state === "active"
                ? "en curso"
                : h.state === "done"
                  ? "hecho"
                  : ""}
          </span>
        </li>
      ))}
    </ol>
  );
}

function Clientes({
  c,
  adjuntos,
  nombresOcultos,
  resaltado,
}: Pick<Props, "adjuntos" | "nombresOcultos" | "resaltado"> & { c: ContenedorVista }) {
  return (
    <details className="studio-tracking-ops-quien" open={resaltado !== null}>
      <summary>
        <span>
          <b>Quién viene adentro</b>
          <span className="studio-tracking-ops-quien-sub">
            {c.clientes === 1 ? "1 cliente" : `${c.clientes} clientes`} ·{" "}
            {c.items.length === 1 ? "1 carga" : `${c.items.length} cargas`} ·{" "}
            {metrosCubicos(c.usedCbm)}
          </span>
        </span>
        <span className="studio-btn studio-btn-ghost studio-btn-sm" aria-hidden>
          Ver clientes
        </span>
      </summary>
      {c.items.length === 0 ? (
        <p className="studio-tracking-ops-nota">Este contenedor todavía no tiene carga asignada.</p>
      ) : (
        <div className="studio-tracking-ops-tabla">
          <table>
            <thead>
              <tr>
                <th scope="col">Shipping Mark</th>
                <th scope="col">Cliente</th>
                <th scope="col" data-num="true">Bultos</th>
                <th scope="col" data-num="true">m³</th>
                <th scope="col">Entrega en</th>
                <th scope="col">Estado</th>
                <th scope="col">Adjuntos</th>
                <th scope="col">
                  <span className="studio-sr-only">Abrir</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {c.items.map((it) => {
                const conteo = it.shipmentId && adjuntos ? adjuntos[it.shipmentId] : undefined;
                const n = conteo ?? { internos: 0, portal: 0, total: 0 };
                return (
                  <tr
                    key={it.itemId}
                    data-row-id={it.shipmentCode ?? it.itemId}
                    data-resaltado={
                      resaltado !== null && it.shipmentId === resaltado ? "true" : "false"
                    }
                  >
                    <td>
                      <code>{it.client_markbox ?? "—"}</code>
                    </td>
                    <td>{etiquetaDelCliente(it, nombresOcultos)}</td>
                    <td data-num="true">{it.pieces}</td>
                    <td data-num="true">{metrosCubicos(it.cbm).replace(" m³", "")}</td>
                    <td>{it.destination ?? "—"}</td>
                    <td>{it.status ? <StatusBadge status={it.status} /> : "—"}</td>
                    <td>
                      {it.shipmentId && adjuntos !== null ? (
                        <AdjuntosConteo
                          total={n.total}
                          desglose={desgloseEmbarque(n)}
                          variante="tarjeta"
                        />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      {it.shipmentId ? (
                        <Link
                          href={`/studio/tracking/${it.shipmentId}`}
                          className="studio-btn studio-btn-ghost studio-btn-sm"
                          aria-label={`Abrir embarque ${it.shipmentCode ?? it.client_markbox ?? ""}`.trim()}
                        >
                          Abrir
                        </Link>
                      ) : (
                        <span className="studio-tracking-ops-kpi-sub">Sin envío enlazado</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </details>
  );
}

export function ContenedorPanel({
  contenedor: c,
  hitos,
  marcadores,
  adjuntos,
  nombresOcultos,
  resaltado,
}: Props) {
  const detalle = [c.containerNo, c.containerType, c.vessel].filter(Boolean).join(" · ");
  return (
    <section className="studio-tracking-ops-panel" aria-label={`Contenedor ${c.nombre}`}>
      <header className="studio-tracking-ops-panel-head">
        <div>
          <span className="studio-eyebrow studio-tracking-ops-eyebrow">Posición actual</span>
          <h2 className="studio-display">
            <code>{c.nombre}</code>
          </h2>
          <p>{detalle || "Sin número de contenedor ni buque asignado."}</p>
        </div>
        <Badge tone={c.alertas > 0 ? "warning" : "info"} size="md">
          {c.estadoLabel}
        </Badge>
      </header>

      {c.alertas > 0 && (
        <div className="studio-tracking-ops-aviso">
          <Aviso tono="atencion" compacto>
            {c.alertas === 1
              ? "1 envío de este contenedor tiene una alerta o está en bodegaje."
              : `${c.alertas} envíos de este contenedor tienen una alerta o están en bodegaje.`}{" "}
            Ábrelos desde «Quién viene adentro».
          </Aviso>
        </div>
      )}

      <MapaPacifico
        marcadores={marcadores}
        descripcion={`Mapa del Pacífico con la ruta de China a Venezuela. ${notaDePosicion(c)}`}
      />
      <p className="studio-tracking-ops-nota" data-borde="true">
        {notaDePosicion(c)}
      </p>

      <Indicadores c={c} hitos={hitos} />
      <Hitos hitos={hitos} />
      <Clientes c={c} adjuntos={adjuntos} nombresOcultos={nombresOcultos} resaltado={resaltado} />
    </section>
  );
}
