/**
 * ContenedorList — columna izquierda del Tracking (SDD-0659).
 *
 * Lista contenedores, no clientes: con tres contenedores en mar salen tres
 * tarjetas. Los filtros y las tarjetas son enlaces; el estado vive en la URL.
 */

import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/app/studio/_components/ui/Badge";
import {
  FILTROS_TRACKING,
  FILTRO_LABEL,
  type ContenedorVista,
  type ConteosDeFiltro,
  type FiltroTracking,
} from "@/lib/studio/tracking-contenedores";
import { fechaCorta, hrefDeTracking, metrosCubicos } from "./tracking-href";

export function FiltrosDeTracking({
  filtro,
  conteos,
}: {
  filtro: FiltroTracking;
  conteos: ConteosDeFiltro;
}) {
  return (
    <nav aria-label="Filtrar por ubicación" className="studio-tracking-ops-filtros">
      {FILTROS_TRACKING.map((f) => (
        <Link
          key={f}
          href={hrefDeTracking({ g: f })}
          className="studio-chip"
          data-activo={f === filtro ? "true" : "false"}
          aria-current={f === filtro ? "true" : undefined}
          scroll={false}
        >
          {FILTRO_LABEL[f]}
          <span className="studio-chip-n">{conteos[f]}</span>
        </Link>
      ))}
    </nav>
  );
}

function TarjetaDeContenedor({
  c,
  activo,
  filtro,
}: {
  c: ContenedorVista;
  activo: boolean;
  filtro: FiltroTracking;
}) {
  return (
    <Link
      href={hrefDeTracking({ g: filtro, c: c.id })}
      className="studio-shipment-card studio-tracking-ops-card"
      data-active={activo ? "true" : "false"}
      aria-current={activo ? "true" : undefined}
      aria-label={`Abrir contenedor ${c.nombre}`}
      scroll={false}
    >
      <span className="studio-tracking-ops-card-top">
        <code className="studio-tracking-ops-card-name">{c.nombre}</code>
        <Badge tone={c.alertas > 0 ? "warning" : "info"} size="sm">
          {c.estadoLabel}
        </Badge>
      </span>
      <span className="studio-tracking-ops-card-meta">
        {c.clientes === 1 ? "1 cliente" : `${c.clientes} clientes`} ·{" "}
        {metrosCubicos(c.usedCbm)}
      </span>
      <span className="studio-tracking-ops-bar" aria-hidden>
        <span style={{ width: `${c.progreso}%` }} data-alerta={c.alertas > 0 ? "true" : "false"} />
      </span>
      <span className="studio-tracking-ops-card-foot">
        <span>{c.progreso}%</span>
        <span>
          {c.grupo === "mar" || c.grupo === "origen" ? "ETA " : ""}
          <b>{c.eta ? fechaCorta(c.eta) : "sin fecha"}</b>
        </span>
      </span>
    </Link>
  );
}

export function ContenedorList({
  contenedores,
  seleccionado,
  filtro,
  vacio,
}: {
  contenedores: ContenedorVista[];
  seleccionado: string | null;
  filtro: FiltroTracking;
  vacio: ReactNode;
}) {
  if (contenedores.length === 0) {
    return <div className="studio-tracking-ops-vacio">{vacio}</div>;
  }
  return (
    <ul className="studio-tracking-ops-lista">
      {contenedores.map((c) => (
        <li key={c.id}>
          <TarjetaDeContenedor c={c} activo={c.id === seleccionado} filtro={filtro} />
        </li>
      ))}
    </ul>
  );
}
