"use client";

/**
 * «Todos los adjuntos» de la ficha del cliente (SDD-0507).
 *
 * Junta, de sólo lectura, lo que hoy se ve por separado: los documentos de la
 * ficha (panel «Documentos · hub») y los de cada embarque vivo del cliente
 * (internos del hub y los que el cliente ve en su portal). Subir, versionar y
 * eliminar siguen en esos paneles: aquí no se duplican.
 *
 * Los datos los lee la página con `listarAdjuntosDelCliente` (la misma
 * definición que el conteo del listado). `null` = no se pudieron leer.
 * «Ver» firma al tocar con `firmarAdjuntoAction` (60 s, cliente de sesión).
 */

import Link from "next/link";
import { useState, useTransition } from "react";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { Aviso } from "@/app/studio/_components/ui/Aviso";
import { VersionChip } from "@/app/studio/_components/documents/DocsPanel";
import { firmarAdjuntoAction } from "../adjuntos-actions";
import {
  EXT_META,
  extFromMime,
  folderLabel,
  formatDocSize,
} from "@/lib/studio/documents/types";
import { shipmentDocTypeLabel, type ShipmentDocType } from "@/lib/studio/shipment-document-types";
import type { Adjunto, AdjuntosDelCliente, GrupoAdjuntos } from "@/lib/studio/documents/adjuntos";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-VE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

/** Extensión del glifo: por content_type y, si no, por la ruta (igual que DocsPanel). */
function extDe(a: Adjunto): { tone: Parameters<typeof Badge>[0]["tone"]; label: string } {
  let ext = a.contentType ? extFromMime(a.contentType) : "bin";
  if (ext === "bin") {
    const m = /\.([a-z0-9]+)$/i.exec(a.storagePath);
    ext = m ? m[1].toLowerCase() : "bin";
  }
  return EXT_META[ext] ?? { tone: "neutral", label: ext.toUpperCase() };
}

/** «Tipo · carpeta · tamaño · fecha», sin huecos. */
function metaDe(a: Adjunto): string {
  const tipo =
    a.visibilidad === "portal"
      ? shipmentDocTypeLabel((a.tipo ?? "otro") as ShipmentDocType)
      : a.tipo;
  const carpeta = a.carpeta ? folderLabel(a.carpeta) : null;
  return [tipo, carpeta && carpeta !== "—" ? carpeta : null, formatDocSize(a.sizeBytes), formatDate(a.createdAt)]
    .filter(Boolean)
    .join(" · ");
}

export function TodosLosAdjuntos({ datos }: { datos: AdjuntosDelCliente | null }) {
  return (
    <section
      id="adjuntos"
      aria-labelledby="adjuntos-titulo"
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        padding: 20,
        scrollMarginTop: 24,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
        {/* h2: los grupos son h3 y la ficha no debe saltar de h1 a h3. */}
        <h2 className="studio-eyebrow" id="adjuntos-titulo" style={{ margin: 0 }}>
          Todos los adjuntos
        </h2>
        {datos !== null && datos.total > 0 && (
          <span style={{ font: "700 11px/1 var(--f-mono)", color: "var(--ink-soft)" }}>
            {datos.total}
          </span>
        )}
      </div>
      <p
        style={{
          font: "500 11.5px/1.5 var(--f-sans)",
          color: "var(--ink-soft)",
          margin: "0 0 14px",
        }}
      >
        Los documentos de esta ficha y los de sus embarques, en un solo lugar.
        Para subir o eliminar, usa el panel de la ficha o el del embarque.
      </p>

      {datos === null ? (
        <Aviso tono="error">
          No se pudieron cargar los adjuntos. Recarga la página; si sigue igual,
          avísale a soporte.
        </Aviso>
      ) : datos.total === 0 ? (
        <div
          style={{
            border: "1px dashed var(--border-strong)",
            borderRadius: "var(--r-md)",
            padding: 18,
            font: "500 12.5px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
          }}
        >
          Este cliente todavía no tiene adjuntos, ni en su ficha ni en sus embarques.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-4)" }}>
          {datos.grupos.map((g) => (
            <Grupo key={g.origen === "cliente" ? "cliente" : g.embarque.id} grupo={g} />
          ))}
        </div>
      )}
    </section>
  );
}

function Grupo({ grupo }: { grupo: GrupoAdjuntos }) {
  const titulo = grupo.origen === "cliente" ? "En la ficha del cliente" : null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <h3
        style={{
          margin: 0,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "baseline",
          gap: 8,
          font: "700 12.5px/1.3 var(--f-sans)",
          color: "var(--ink)",
        }}
      >
        {titulo ?? (
          grupo.origen === "embarque" && (
            <>
              <Link
                href={`/studio/tracking/${grupo.embarque.id}`}
                style={{ color: "var(--wine-text)", textDecoration: "none" }}
              >
                Embarque{" "}
                <span style={{ font: "700 12px/1 var(--f-mono)" }}>{grupo.embarque.code}</span>
              </Link>
              {(grupo.embarque.origin || grupo.embarque.destination) && (
                <span style={{ font: "500 12px/1.3 var(--f-sans)", color: "var(--ink-soft)" }}>
                  {grupo.embarque.origin ?? "?"} → {grupo.embarque.destination ?? "?"}
                </span>
              )}
            </>
          )
        )}
        <span style={{ font: "700 11px/1 var(--f-mono)", color: "var(--ink-soft)" }}>
          {grupo.adjuntos.length}
        </span>
      </h3>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        {grupo.adjuntos.map((a) => (
          <Fila key={`${a.bucket}:${a.id}`} adjunto={a} />
        ))}
      </ul>
    </div>
  );
}

function Fila({ adjunto: a }: { adjunto: Adjunto }) {
  const [abriendo, startAbrir] = useTransition();
  const [fallo, setFallo] = useState(false);
  const ext = extDe(a);
  const meta = metaDe(a);

  function ver() {
    setFallo(false);
    startAbrir(async () => {
      const url = await firmarAdjuntoAction(a.bucket, a.storagePath);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
      else setFallo(true);
    });
  }

  return (
    <li
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "10px 12px",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <Badge tone={ext.tone} size="sm">
          {ext.label}
        </Badge>
        <div style={{ flex: "1 1 200px", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
            <span
              style={{
                font: "600 13px/1.3 var(--f-sans)",
                color: "var(--ink)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {a.nombre}
            </span>
            {a.version !== null && <VersionChip n={a.version} />}
          </div>
          {meta && (
            <div style={{ font: "500 11px/1.3 var(--f-sans)", color: "var(--ink-soft)" }}>
              {meta}
            </div>
          )}
        </div>
        {a.visibilidad === "portal" ? (
          <span title="El cliente lo ve en su portal">
            <Badge tone="info" size="sm">
              Portal
            </Badge>
          </span>
        ) : (
          <span title="Sólo lo ve el equipo">
            <Badge tone="neutral" size="sm">
              Interno
            </Badge>
          </span>
        )}
        <button
          type="button"
          className="studio-btn studio-btn-ghost studio-btn-xs"
          onClick={ver}
          disabled={abriendo}
          aria-label={`Ver ${a.nombre}`}
          style={{ flexShrink: 0 }}
        >
          {abriendo ? "Abriendo…" : "Ver"}
        </button>
      </div>
      {fallo && (
        <Aviso tono="error" compacto>
          No se pudo abrir el archivo. Intenta de nuevo o ábrelo desde su panel.
        </Aviso>
      )}
    </li>
  );
}
