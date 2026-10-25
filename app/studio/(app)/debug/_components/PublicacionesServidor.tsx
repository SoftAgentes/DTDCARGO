/**
 * Card «Publicaciones del servidor» de la pestaña Estado (SDD-0547).
 *
 * Reemplaza a «Deploys recientes», que leía la API de Vercel. Muestra lo que el
 * vigilante del servidor de verdad hizo (SDD-0541): qué commit corre, si está al
 * día, retenido o congelado, y sus últimas publicaciones, retenciones y vueltas
 * atrás. La fuente es el archivo que valida `lib/studio/publicaciones-types.ts`;
 * acá solo se pinta lo ya validado.
 *
 * Server component sin estado. Sin datos o con error, muestra «Sin datos» y el
 * motivo, y el resto de la pestaña sigue igual.
 */

import type { EnvName } from "@/lib/studio/env-status";
import {
  etiquetaOrigen,
  etiquetaResultado,
  etiquetaVigilante,
  shaCorto,
  textoMotivo,
  textoSinDatos,
  tiempoRelativo,
  tonoResultado,
  tonoVigilante,
  urlCommit,
  vigilanteSinVueltas,
  type EstadoPublicaciones,
  type EventoPublicacion,
  type LecturaPublicaciones,
} from "@/lib/studio/publicaciones-types";
import { Badge } from "../../../_components/ui/Badge";

const TEXTO_SUAVE = {
  color: "var(--ink-soft)",
  fontSize: 13,
  lineHeight: 1.55,
  margin: 0,
} as const;

const MONO = { fontFamily: "var(--f-mono)" } as const;

export function PublicacionesServidor({
  lectura,
  env,
  shaInstancia,
}: {
  lectura: LecturaPublicaciones;
  env: EnvName;
  /** Commit con el que se construyó esta instancia (NEXT_PUBLIC_BUILD_SHA). */
  shaInstancia: string | null;
}) {
  if (!lectura.ok) {
    return (
      <div role="status" style={{ display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
        <div>
          <Badge tone="neutral" size="md">
            Sin datos
          </Badge>
        </div>
        <p style={TEXTO_SUAVE}>{textoSinDatos(lectura.motivo)}</p>
        <p style={{ ...TEXTO_SUAVE, fontSize: 12 }}>
          {env === "local"
            ? "En local es lo normal: este estado lo escribe el vigilante de publicación del servidor."
            : "Lo escribe el vigilante de publicación del servidor (publicar-web.sh) en cada vuelta, una por minuto. Si sigue así, avísale al Director."}
        </p>
      </div>
    );
  }

  const { estado } = lectura;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-4)" }}>
      <Resumen estado={estado} ahora={lectura.leidoEn} shaInstancia={shaInstancia} />
      <Historial estado={estado} ahora={lectura.leidoEn} />
    </div>
  );
}

function Resumen({
  estado,
  ahora,
  shaInstancia,
}: {
  estado: EstadoPublicaciones;
  ahora: number;
  shaInstancia: string | null;
}) {
  const { vigilante, congelado, corre, publicable, anterior } = estado;
  const sinVueltas = vigilanteSinVueltas(estado.actualizado, ahora);
  const instanciaDistinta =
    shaInstancia !== null && corre !== null && shaInstancia !== corre;

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <Fila k="Vigilante">
        {vigilante ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-1)" }}>
            <div>
              <Badge
                tone={tonoVigilante(vigilante.estado, congelado?.automatico === true)}
                size="md"
              >
                {etiquetaVigilante(vigilante.estado)}
              </Badge>
            </div>
            {vigilante.estado === "congelado" && (
              <p style={TEXTO_SUAVE}>
                {congelado?.automatico
                  ? "Se congeló solo porque falló una vuelta atrás. Hay que revisar la web en el servidor."
                  : "Congelado a mano: no publica nada hasta que lo descongelen."}
                {congelado?.desde != null && ` Desde ${tiempoRelativo(congelado.desde, ahora)}.`}
              </p>
            )}
            {vigilante.motivo && (
              <Motivo motivo={vigilante.motivo} faltan={vigilante.faltan} />
            )}
          </div>
        ) : (
          <span style={TEXTO_SUAVE}>Sin datos</span>
        )}
      </Fila>

      <Fila k="Última vuelta">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-1)" }}>
          <Hora ms={estado.actualizado} ahora={ahora} />
          {sinVueltas && (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-1)" }}>
              <div>
                <Badge tone="warning" size="md">
                  Sin vueltas recientes
                </Badge>
              </div>
              <p style={TEXTO_SUAVE}>
                El vigilante corre cada minuto y este estado no cambia desde{" "}
                {tiempoRelativo(estado.actualizado, ahora)}. Puede estar detenido: lo
                de abajo puede estar viejo.
              </p>
            </div>
          )}
        </div>
      </Fila>

      <Fila k="Corre en el servidor">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-1)" }}>
          <Commit sha={corre} />
          {instanciaDistinta && (
            <p style={TEXTO_SUAVE}>
              Esta instancia se construyó con{" "}
              <code style={MONO}>{shaCorto(shaInstancia)}</code>: no coincide con lo que
              registra el servidor.
            </p>
          )}
        </div>
      </Fila>

      <Fila k="Publicable en GitHub">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-1)" }}>
          <Commit sha={publicable} />
          {publicable !== null && corre !== null && publicable !== corre && (
            <p style={TEXTO_SUAVE}>Todavía no corre en el servidor.</p>
          )}
        </div>
      </Fila>

      <Fila k="Vuelta atrás a">
        <Commit sha={anterior} />
      </Fila>
    </div>
  );
}

function Historial({ estado, ahora }: { estado: EstadoPublicaciones; ahora: number }) {
  return (
    <div>
      <h3
        style={{
          fontSize: 12,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--ink-soft)",
          margin: "0 0 var(--s-2) 0",
        }}
      >
        Últimas publicaciones
      </h3>
      {estado.historial.length === 0 ? (
        <p style={TEXTO_SUAVE}>Sin publicaciones registradas todavía.</p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {estado.historial.map((e, i) => (
            <EventoFila
              key={`${i}-${e.hora}-${e.sha}-${e.resultado}`}
              evento={e}
              ahora={ahora}
              corre={estado.corre}
            />
          ))}
        </ul>
      )}
      {estado.descartados > 0 && (
        <p style={{ ...TEXTO_SUAVE, fontSize: 12, marginTop: "var(--s-2)" }}>
          {estado.descartados === 1
            ? "1 entrada del historial no tenía el formato esperado y no se muestra."
            : `${estado.descartados} entradas del historial no tenían el formato esperado y no se muestran.`}
        </p>
      )}
    </div>
  );
}

function EventoFila({
  evento: e,
  ahora,
  corre,
}: {
  evento: EventoPublicacion;
  ahora: number;
  corre: string | null;
}) {
  const esLaQueCorre = e.resultado === "publicada" && e.sha === corre;
  return (
    <li
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(140px, auto) 1fr auto auto",
        alignItems: "start",
        gap: "var(--s-4)",
        padding: "var(--s-3) 0",
        borderTop: "1px solid var(--border)",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-1)" }}>
        <div>
          <Badge tone={tonoResultado(e.resultado)} size="md">
            {etiquetaResultado(e.resultado)}
          </Badge>
        </div>
        <span style={{ fontSize: 11.5, color: "var(--ink-soft)" }}>
          {etiquetaOrigen(e.origen)}
        </span>
      </div>

      <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: "var(--s-1)" }}>
        <div>
          <code
            style={{
              ...MONO,
              fontSize: 12,
              fontWeight: 600,
              padding: "1px 5px",
              borderRadius: "var(--r-xs)",
              background: esLaQueCorre ? "var(--success-bg)" : "var(--bg-elevated)",
              color: "var(--ink)",
            }}
            title={esLaQueCorre ? "Es la que corre ahora en el servidor" : undefined}
          >
            {shaCorto(e.sha)}
          </code>
          {esLaQueCorre && (
            <span style={{ fontSize: 11.5, color: "var(--ink-soft)", marginLeft: "var(--s-2)" }}>
              corre ahora
            </span>
          )}
        </div>
        {e.motivo && <Motivo motivo={e.motivo} faltan={e.faltan} />}
      </div>

      <div style={{ fontSize: 11.5, color: "var(--ink-soft)", whiteSpace: "nowrap" }}>
        <Hora ms={e.hora} ahora={ahora} />
      </div>

      <a
        href={urlCommit(e.sha)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Ver commit ${shaCorto(e.sha)} en GitHub (abre otra pestaña)`}
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "var(--info)",
          textDecoration: "underline",
          textUnderlineOffset: 2,
          whiteSpace: "nowrap",
        }}
      >
        Ver commit <span aria-hidden>↗</span>
      </a>
    </li>
  );
}

function Motivo({
  motivo,
  faltan,
}: {
  motivo: NonNullable<EventoPublicacion["motivo"]>;
  faltan: string[];
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-1)" }}>
      <p style={TEXTO_SUAVE}>{textoMotivo(motivo)}</p>
      {faltan.length > 0 && (
        <p style={{ ...TEXTO_SUAVE, fontSize: 12 }}>
          Faltan:{" "}
          {faltan.map((n, i) => (
            <span key={n}>
              {i > 0 && ", "}
              <code style={MONO}>{n}</code>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

function Commit({ sha }: { sha: string | null }) {
  if (sha === null) return <span style={TEXTO_SUAVE}>Sin datos</span>;
  return (
    <span style={{ display: "inline-flex", gap: "var(--s-2)", alignItems: "baseline", flexWrap: "wrap" }}>
      <code style={{ ...MONO, fontSize: 13, color: "var(--ink)" }} title={sha}>
        {shaCorto(sha)}
      </code>
      <a
        href={urlCommit(sha)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Ver commit ${shaCorto(sha)} en GitHub (abre otra pestaña)`}
        style={{ fontSize: 12, color: "var(--info)", textDecoration: "underline", textUnderlineOffset: 2 }}
      >
        Ver commit <span aria-hidden>↗</span>
      </a>
    </span>
  );
}

function Hora({ ms, ahora }: { ms: number; ahora: number }) {
  const iso = new Date(ms).toISOString();
  return (
    <time dateTime={iso} title={`${iso.replace("T", " ").slice(0, 16)} UTC`} style={{ fontSize: 13, color: "var(--ink)" }}>
      {tiempoRelativo(ms, ahora)}
    </time>
  );
}

function Fila({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "160px 1fr",
        gap: "var(--s-4)",
        padding: "var(--s-2) 0",
        borderTop: "1px solid var(--border)",
      }}
    >
      <div style={{ color: "var(--ink-soft)", fontSize: 13 }}>{k}</div>
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  );
}
