"use client";

/**
 * Revisión y fusión de fichas duplicadas (SDD-0246).
 *
 * Regla de la pantalla: el sistema PROPONE, el humano CONFIRMA. Nunca fusiona
 * sola. De los tres duplicados reales que había en producción, uno coincidía
 * ÚNICAMENTE por nombre — y el nombre era "Jose Mendez". Automatizar eso fusiona
 * a dos personas distintas, que es peor que el duplicado.
 *
 * Por eso cada par muestra POR QUÉ se propuso y con cuánta confianza, y los
 * débiles piden confirmación sostenida.
 */

import Link from "next/link";
import { useState } from "react";
import { Aviso } from "@/app/studio/_components/ui/Aviso";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import {
  candidateConfidence,
  candidateReasons,
  type DuplicateCandidate,
} from "@/lib/studio/client-merge-queries";
import type { MergeResult } from "../merge-actions";
import { FusionPanel, type ParFusion } from "./FusionPanel";
import { BuscarYFusionar } from "./BuscarYFusionar";

const CONF_TONE = {
  alta: "success",
  media: "warning",
  debil: "danger",
} as const;

const CONF_LABEL = {
  alta: "Coincidencia fuerte",
  media: "Revisar",
  debil: "Sólo por nombre",
} as const;

export function DuplicadosClient({ candidates }: { candidates: DuplicateCandidate[] }) {
  const [pestana, setPestana] = useState<"detectados" | "buscar">("detectados");
  const [par, setPar] = useState<ParFusion | null>(null);
  const [resultados, setResultados] = useState<Record<string, MergeResult>>({});
  const [ultima, setUltima] = useState<MergeResult | null>(null);

  // Superviviente propuesto = la ficha VIEJA: carga el historial y es el código
  // que el cliente ya le pasó a su proveedor. El panel permite invertirlo (⇄).
  function abrirPar(c: DuplicateCandidate) {
    setPar({
      survivor: { id: c.legacyId, markbox: c.legacyMarkbox ?? "", name: c.legacyName },
      merged: { id: c.newId, markbox: c.newMarkbox ?? "", name: c.newName },
    });
  }

  function alFusionar(res: MergeResult, p: ParFusion) {
    setResultados((r) => ({ ...r, [p.merged.id]: res, [p.survivor.id]: res }));
    setUltima(res);
    setPar(null);
  }

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 24 }}>
        {/* SDD-0266 · esta pantalla NO está en el nav lateral: se llega sólo
            desde el menú de la cabecera de Clientes, así que sin este enlace
            queda sin salida dentro de la página. Y la migaja dice "Clientes"
            —no "Comercial"— porque nombra de dónde vienes, que es lo que hace
            navegable un sub-nivel. */}
        <Link
          href="/studio/clientes"
          className="studio-link-quiet"
          style={{
            font: "600 12px/1 var(--f-sans)",
            color: "var(--ink-soft)",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 10,
          }}
        >
          ← Clientes
        </Link>
        <span className="studio-eyebrow" style={{ display: "block" }}>
          Clientes
        </span>
        <h1
          className="studio-display"
          style={{ fontSize: 30, margin: "var(--s-2) 0 var(--s-2)", color: "var(--ink)" }}
        >
          Posibles duplicados.
        </h1>
        <p
          style={{
            font: "400 13px/1.4 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
            maxWidth: "70ch",
          }}
        >
          Clientes que ya existían y se registraron otra vez por la web, así que
          tienen dos Shipping Mark. Al fusionar, <strong>sobrevive el código
          viejo</strong> —es el que el cliente ya usa y el que su proveedor tiene
          rotulado— y el nuevo queda anulado, pero sigue resolviendo para que
          ninguna caja llegue huérfana.
        </p>
      </div>

      {ultima?.ok && (
        <div style={{ marginBottom: 16 }}>
          <Aviso tono="exito" titulo="Fusionado">
            El cliente usa {ultima.survivorMarkbox}; {ultima.retiredMarkbox} quedó anulado y sigue resolviendo.
            {ultima.access ? ` Acceso: ${ultima.access}.` : ""}
            {ultima.needsReview && ultima.needsReview.changeRequestsLeftBehind > 0
              ? " Quedó una solicitud de cambio sin mover: revísala."
              : ""}
          </Aviso>
        </div>
      )}

      <div role="tablist" aria-label="Duplicados" className="studio-tabs" style={{ marginBottom: 16 }}>
        <button
          type="button"
          role="tab"
          aria-selected={pestana === "detectados"}
          data-activa={pestana === "detectados" ? "true" : undefined}
          className="studio-tab"
          onClick={() => setPestana("detectados")}
        >
          Detectados ({candidates.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={pestana === "buscar"}
          data-activa={pestana === "buscar" ? "true" : undefined}
          className="studio-tab"
          onClick={() => setPestana("buscar")}
        >
          Buscar y fusionar
        </button>
      </div>

      {pestana === "buscar" ? (
        <BuscarYFusionar onElegir={setPar} />
      ) : candidates.length === 0 ? (
        <EmptyState
          title="Sin duplicados detectados"
          description="Ningún cliente del registro público coincide con una ficha vieja por documento, correo, teléfono ni nombre."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-3)" }}>
          {candidates.map((c) => {
            const conf = candidateConfidence(c);
            const hecho = resultados[c.newId];
            return (
              <article
                key={`${c.legacyId}-${c.newId}`}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: "var(--s-4)",
                  background: "var(--bg-surface)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                    marginBottom: "var(--s-3)",
                  }}
                >
                  <Badge tone={CONF_TONE[conf]}>{CONF_LABEL[conf]}</Badge>
                  <span style={{ font: "400 12px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
                    Coincide por {candidateReasons(c).join(", ")}
                  </span>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto 1fr",
                    gap: "var(--s-3)",
                    alignItems: "center",
                  }}
                >
                  <FichaCard
                    rotulo="Se queda"
                    markbox={c.legacyMarkbox}
                    name={c.legacyName}
                    destacado
                  />
                  <span aria-hidden style={{ color: "var(--ink-soft)", fontSize: 18 }}>
                    ←
                  </span>
                  <FichaCard
                    rotulo="Se anula"
                    markbox={c.newMarkbox}
                    name={c.newName}
                    destacado={false}
                  />
                </div>

                {hecho ? (
                  <p
                    style={{
                      marginTop: "var(--s-3)",
                      font: "400 13px/1.5 var(--f-sans)",
                      color: "var(--ink-soft)",
                    }}
                  >
                    ✓ Fusionado. El cliente usa <strong>{hecho.survivorMarkbox}</strong>;{" "}
                    {hecho.retiredMarkbox} quedó anulado.
                    {hecho.filled && hecho.filled.length > 0
                      ? ` Se completó su ${hecho.filled.join(", ")}.`
                      : ""}
                    {hecho.access ? ` Acceso: ${hecho.access}.` : ""}
                    {hecho.needsReview && hecho.needsReview.changeRequestsLeftBehind > 0
                      ? " Quedó una solicitud de cambio sin mover — revísala."
                      : ""}
                  </p>
                ) : (
                  <div style={{ marginTop: "var(--s-3)", display: "flex", gap: 12 }}>
                    <button
                      type="button"
                      className="studio-btn studio-btn-primary"
                      onClick={() => abrirPar(c)}
                    >
                      Ver fichas y fusionar
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {par && (
        <FusionPanel
          key={`${par.survivor.id}:${par.merged.id}`}
          par={par}
          onClose={() => setPar(null)}
          onInvertir={() => setPar({ survivor: par.merged, merged: par.survivor })}
          onFusionado={alFusionar}
        />
      )}
    </div>
  );
}

function FichaCard({
  rotulo,
  markbox,
  name,
  destacado,
}: {
  rotulo: string;
  markbox: string | null;
  name: string;
  destacado: boolean;
}) {
  return (
    <div
      style={{
        border: `1px solid ${destacado ? "var(--border-strong)" : "var(--border)"}`,
        borderRadius: 10,
        padding: "var(--s-3)",
        background: destacado ? "var(--bg-elevated)" : "transparent",
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
      <div
        style={{
          font: "700 15px/1.3 var(--f-mono)",
          color: "var(--ink)",
          margin: "var(--s-1) 0",
          textDecoration: destacado ? "none" : "line-through",
        }}
      >
        {markbox ?? "sin código"}
      </div>
      <div style={{ font: "400 13px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>{name}</div>
    </div>
  );
}
