"use client";

/**
 * Buscar y fusionar (SDD-0712): encuentra a cualquier cliente de la base y deja
 * unir dos fichas aunque el detector no las haya emparejado.
 *
 * Se elige cuál se queda y cuál se anula tocando «Se queda» o «Se anula» en el
 * resultado; el panel de vista previa (a la derecha) permite invertirlo con ⇄.
 */

import { useEffect, useState } from "react";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import type { MergeSearchHit } from "@/lib/studio/client-merge-manual";
import { searchClientsForMergeAction } from "../merge-actions";
import type { ParFusion } from "./FusionPanel";

type Ficha = ParFusion["survivor"];

function aFicha(h: MergeSearchHit): Ficha {
  return { id: h.id, markbox: h.markbox, name: h.name };
}

export function BuscarYFusionar({ onElegir }: { onElegir: (par: ParFusion) => void }) {
  const [q, setQ] = useState("");
  // La respuesta guarda el término que contestó: `buscando` y los resultados se
  // derivan de ahí, sin tocar estado de forma síncrona dentro del efecto.
  const [respuesta, setRespuesta] = useState<{ q: string; hits: MergeSearchHit[]; error?: string }>({
    q: "",
    hits: [],
  });
  const [seQueda, setSeQueda] = useState<Ficha | null>(null);
  const [seAnula, setSeAnula] = useState<Ficha | null>(null);

  const termino = q.trim();
  const busca = termino.length >= 2;
  const buscando = busca && respuesta.q !== termino;
  const hits = busca && respuesta.q === termino ? respuesta.hits : [];
  const error = busca && respuesta.q === termino ? respuesta.error : undefined;

  // Búsqueda mientras escribe, con espera corta; una respuesta vieja no pisa la nueva.
  useEffect(() => {
    if (!busca) return;
    let vigente = true;
    const espera = setTimeout(() => {
      searchClientsForMergeAction(termino).then((r) => {
        if (vigente) setRespuesta({ q: termino, hits: r.hits, error: r.error });
      });
    }, 300);
    return () => {
      vigente = false;
      clearTimeout(espera);
    };
  }, [busca, termino]);

  function elegir(h: MergeSearchHit, lado: "queda" | "anula") {
    const f = aFicha(h);
    if (lado === "queda") {
      setSeQueda(f);
      if (seAnula?.id === f.id) setSeAnula(null);
    } else {
      setSeAnula(f);
      if (seQueda?.id === f.id) setSeQueda(null);
    }
  }

  const listo = seQueda && seAnula;

  return (
    <div style={{ display: "grid", gap: "var(--s-4)" }}>
      <div>
        <label htmlFor="fusion-buscar" className="studio-label" style={{ display: "block", marginBottom: 6 }}>
          Buscar cliente
        </label>
        <input
          id="fusion-buscar"
          type="search"
          className="studio-input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Shipping Mark, nombre, teléfono o correo"
          autoComplete="off"
          style={{ width: "100%" }}
        />
        <p style={{ font: "400 12px/1.4 var(--f-sans)", color: "var(--ink-soft)", margin: "6px 0 0" }}>
          Busca en todos los clientes, sin importar acentos ni mayúsculas, y también por códigos anteriores.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10, alignItems: "stretch" }}>
        <Casilla rotulo="Se queda" ficha={seQueda} onQuitar={() => setSeQueda(null)} />
        <Casilla rotulo="Se anula" ficha={seAnula} onQuitar={() => setSeAnula(null)} />
        <button
          type="button"
          className="studio-btn studio-btn-primary"
          disabled={!listo}
          onClick={() => listo && onElegir({ survivor: seQueda, merged: seAnula })}
          style={{ alignSelf: "center" }}
        >
          Ver vista previa
        </button>
      </div>

      {error && (
        <p role="alert" style={{ font: "400 13px/1.4 var(--f-sans)", color: "var(--ink)", margin: 0 }}>
          {error}
        </p>
      )}

      {busca && !buscando && !error && hits.length === 0 ? (
        <EmptyState title="Sin coincidencias" description="Prueba con otra parte del nombre, el teléfono o el Shipping Mark." />
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }} aria-busy={buscando}>
          {hits.map((h) => (
            <li
              key={h.id}
              style={{
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: "var(--s-3)",
                background: "var(--bg-surface)",
                display: "grid",
                gridTemplateColumns: "minmax(0,1fr) auto",
                gap: 12,
                alignItems: "center",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                  <span style={{ font: "700 14px/1.3 var(--f-mono)", color: "var(--ink)" }}>{h.markbox}</span>
                  <span style={{ font: "500 14px/1.3 var(--f-sans)", color: "var(--ink)" }}>{h.name}</span>
                </div>
                <div style={{ font: "400 12px/1.5 var(--f-sans)", color: "var(--ink-soft)" }}>
                  {[h.rif, h.email, h.phone].filter(Boolean).join(" · ") || "Sin datos de contacto"}
                  {h.matchedBy.length > 0 ? ` — coincide por ${h.matchedBy.join(", ")}` : ""}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="studio-btn studio-btn-ghost studio-btn-sm"
                  aria-pressed={seQueda?.id === h.id}
                  onClick={() => elegir(h, "queda")}
                >
                  Se queda
                </button>
                <button
                  type="button"
                  className="studio-btn studio-btn-ghost studio-btn-sm"
                  aria-pressed={seAnula?.id === h.id}
                  onClick={() => elegir(h, "anula")}
                >
                  Se anula
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Casilla({
  rotulo,
  ficha,
  onQuitar,
}: {
  rotulo: string;
  ficha: Ficha | null;
  onQuitar: () => void;
}) {
  return (
    <div
      style={{
        border: `1px ${ficha ? "solid" : "dashed"} var(--border-strong)`,
        borderRadius: 10,
        padding: "var(--s-3)",
        minHeight: 72,
      }}
    >
      <span
        style={{
          font: "700 10px/1.2 var(--f-sans)",
          letterSpacing: ".08em",
          textTransform: "uppercase",
          color: "var(--ink-soft)",
        }}
      >
        {rotulo}
      </span>
      {ficha ? (
        <>
          <div style={{ font: "700 15px/1.3 var(--f-mono)", color: "var(--ink)", margin: "4px 0" }}>{ficha.markbox}</div>
          <div style={{ font: "400 13px/1.4 var(--f-sans)", color: "var(--ink)" }}>{ficha.name}</div>
          <button type="button" className="studio-btn studio-btn-ghost studio-btn-xs" onClick={onQuitar}>
            Quitar
          </button>
        </>
      ) : (
        <div style={{ font: "400 13px/1.4 var(--f-sans)", color: "var(--ink-soft)", marginTop: 6 }}>
          Elige una ficha de la lista.
        </div>
      )}
    </div>
  );
}
