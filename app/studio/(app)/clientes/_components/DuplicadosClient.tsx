"use client";

/**
 * Revisión y fusión de fichas duplicadas (SDD-0244).
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
import { useState, useTransition } from "react";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { ConfirmDialog } from "@/app/studio/_components/ui/ConfirmDialog";
import {
  candidateConfidence,
  candidateReasons,
  type DuplicateCandidate,
} from "@/lib/studio/client-merge-queries";
import { mergeClientsAction, type MergeResult } from "../merge-actions";

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
  const [pending, startTransition] = useTransition();
  const [confirmar, setConfirmar] = useState<DuplicateCandidate | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [resultados, setResultados] = useState<Record<string, MergeResult>>({});

  function fusionar(c: DuplicateCandidate) {
    setError(undefined);
    startTransition(async () => {
      // Superviviente = la ficha VIEJA: carga el historial y es el código que el
      // cliente ya le pasó a su proveedor.
      const res = await mergeClientsAction(c.legacyId, c.newId);
      if (res.error) {
        setError(res.error);
        return;
      }
      setResultados((r) => ({ ...r, [c.newId]: res }));
      setConfirmar(null);
    });
  }

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 24 }}>
        <span className="studio-eyebrow">Comercial</span>
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

      {candidates.length === 0 ? (
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
                  <span style={{ font: "400 12px/1.4 var(--f-sans)", color: "var(--ink-mute)" }}>
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
                  <span aria-hidden style={{ color: "var(--ink-mute)", fontSize: 18 }}>
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
                      disabled={pending}
                      onClick={() => setConfirmar(c)}
                    >
                      Fusionar
                    </button>
                    <Link
                      href={`/studio/clientes/${c.legacyMarkbox ?? ""}`}
                      className="studio-btn studio-btn-ghost"
                    >
                      Ver ficha que se queda
                    </Link>
                    <Link
                      href={`/studio/clientes/${c.newMarkbox ?? ""}`}
                      className="studio-btn studio-btn-ghost"
                    >
                      Ver ficha que se anula
                    </Link>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmar}
        title="Fusionar estas dos fichas"
        message={
          confirmar
            ? `El cliente se queda con ${confirmar.legacyMarkbox} y ${confirmar.newMarkbox} queda anulado. ` +
              `El acceso, las direcciones y el historial pasan a la ficha que se queda, y los datos que le falten se completan con los del registro. ` +
              (candidateConfidence(confirmar) === "debil"
                ? "⚠️ Este par coincide SÓLO por el nombre. Abre las dos fichas y comprueba que sean la misma persona antes de seguir: fusionar a dos personas distintas es peor que dejar el duplicado."
                : "Esto no se deshace solo.")
            : ""
        }
        confirmLabel="Sí, fusionar"
        danger
        pending={pending}
        // Los pares que sólo coinciden por nombre piden confirmación sostenida:
        // son los que pueden estar uniendo a dos personas distintas.
        holdToConfirm={!!confirmar && candidateConfidence(confirmar) === "debil"}
        holdLabel="Mantén presionado para fusionar"
        error={error}
        onCancel={() => {
          setConfirmar(null);
          setError(undefined);
        }}
        onConfirm={() => confirmar && fusionar(confirmar)}
      />
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
          color: "var(--ink-mute)",
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
