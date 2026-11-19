/**
 * BuscadorTracking — busca un cliente y dice en qué contenedor viene (SDD-0659).
 *
 * Es un formulario GET: la búsqueda vive en `?q=` y la resuelve el servidor, así
 * que al navegador solo llegan los resultados, no el listado de clientes.
 *
 * Con los nombres ocultos (equipo de China, SDD-0531) se busca por Shipping Mark
 * o contenedor; la consulta por nombre ni siquiera se hace.
 */

import Link from "next/link";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { etiquetaDelCliente } from "@/lib/studio/privacidad-cn";
import {
  LARGO_MINIMO_DE_BUSQUEDA,
  type ResultadoDeBusqueda,
} from "@/lib/studio/tracking-contenedores";
import { hrefDeTracking, metrosCubicos } from "./tracking-href";

export type ContenedorEncontrado = {
  id: string;
  nombre: string;
  estadoLabel: string;
  containerNo: string | null;
  /** BL de la reserva, cuando el contenedor se encontró por su BL. */
  bl: string | null;
};

export type EnvioSueltoEncontrado = {
  id: string;
  code: string;
  client_markbox: string | null;
  client_name: string | null;
};

export type ResultadosDeTracking = {
  q: string;
  clientes: ResultadoDeBusqueda[];
  contenedores: ContenedorEncontrado[];
  sueltos: EnvioSueltoEncontrado[];
  /** true si alguna consulta llegó a su tope: puede haber más. */
  truncado: boolean;
};

export function BuscadorTracking({
  q,
  nombresOcultos,
  resultados,
}: {
  /** Lo que el usuario escribió, tal cual (aunque sea muy corto para buscar). */
  q: string;
  nombresOcultos: boolean;
  resultados: ResultadosDeTracking | null;
}) {
  const placeholder = nombresOcultos
    ? "Buscar Shipping Mark, contenedor o BL…"
    : "Buscar cliente, Shipping Mark, contenedor o BL…";
  const muyCorto = q.trim().length > 0 && resultados === null;

  return (
    <div className="studio-tracking-ops-buscador">
      <form action="/studio/tracking" method="get" role="search">
        <label htmlFor="tracking-q" className="studio-sr-only">
          {placeholder.replace("…", "")}
        </label>
        <input
          id="tracking-q"
          name="q"
          type="search"
          className="studio-input"
          defaultValue={q}
          placeholder={placeholder}
          autoComplete="off"
          maxLength={80}
        />
        <button type="submit" className="studio-btn studio-btn-dark studio-btn-sm">
          Buscar
        </button>
        {q && (
          <Link href="/studio/tracking" className="studio-btn studio-btn-ghost studio-btn-sm">
            Limpiar
          </Link>
        )}
      </form>

      {muyCorto && (
        <p className="studio-tracking-ops-nota" role="status">
          Escribe al menos {LARGO_MINIMO_DE_BUSQUEDA} caracteres para buscar.
        </p>
      )}

      {resultados && <Resultados r={resultados} nombresOcultos={nombresOcultos} />}
    </div>
  );
}

function Resultados({
  r,
  nombresOcultos,
}: {
  r: ResultadosDeTracking;
  nombresOcultos: boolean;
}) {
  const total = r.clientes.length + r.contenedores.length + r.sueltos.length;
  if (total === 0) {
    return (
      <p className="studio-tracking-ops-nota" role="status">
        Nada coincide con «{r.q}». Prueba con{" "}
        {nombresOcultos ? "un Shipping Mark" : "un nombre, un Shipping Mark"} o un número de
        contenedor.
      </p>
    );
  }
  return (
    <section className="studio-tracking-ops-resultados" aria-label={`Resultados de «${r.q}»`}>
      {r.contenedores.length > 0 && (
        <div>
          <h3 className="studio-eyebrow">Contenedores</h3>
          <ul>
            {r.contenedores.map((c) => (
              <li key={c.id}>
                <Link href={hrefDeTracking({ c: c.id })}>
                  <code>{c.nombre}</code>
                  <span>
                    {c.bl ? `BL ${c.bl}` : (c.containerNo ?? "Sin número de contenedor")}
                  </span>
                  <Badge tone="info" size="xs">
                    {c.estadoLabel}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {r.clientes.map((g) => (
        <div key={g.clave}>
          <h3>
            {etiquetaDelCliente(g, nombresOcultos)}
            {!nombresOcultos && g.client_markbox && <code>{g.client_markbox}</code>}
          </h3>
          <ul>
            {g.cargas.map((x) => (
              <li key={x.itemId}>
                <Link href={hrefDeTracking({ c: x.contenedorId, e: x.shipmentId })}>
                  <code>{x.contenedorNombre}</code>
                  <span>
                    {x.pieces} bultos · {metrosCubicos(x.cbm)}
                  </span>
                  <Badge tone="info" size="xs">
                    {x.estadoLabel}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {r.sueltos.length > 0 && (
        <div>
          <h3 className="studio-eyebrow">Envíos sin contenedor</h3>
          <ul>
            {r.sueltos.map((s) => (
              <li key={s.id}>
                <Link href={hrefDeTracking({ g: "sin", id: s.id })}>
                  <code>{s.code}</code>
                  <span>{etiquetaDelCliente(s, nombresOcultos)}</span>
                  <Badge tone="neutral" size="xs">
                    Sin contenedor
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {r.truncado && (
        <p className="studio-tracking-ops-nota">
          Hay más resultados de los que caben aquí. Escribe algo más preciso.
        </p>
      )}
    </section>
  );
}
