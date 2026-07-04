"use client";

/**
 * NuevaReunionClient · ingesta de conversación (SDD-0146 · Fase 2).
 *
 * Dos momentos: INGESTA (elegir tipo, vincular cliente si aplica, pegar
 * transcripción, "Analizar con IA") → REVISIÓN (`<ActaReview>` editable antes de
 * confirmar). La extracción corre en la server action `analyzeActaAction`
 * (Anthropic o mock); acá sólo mostramos el estado de carga y hacemos el swap
 * de vista. Audio/grabadora = Fase 3.
 */

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/app/studio/_components/icons";
import { ClientCombobox } from "@/app/studio/_components/ui/ClientCombobox";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import type { AssignableProfile } from "@/lib/studio/bitacora/bitacora-queries";
import type { ResolvedActa } from "@/lib/studio/bitacora/match";
import {
  TRANSCRIPT_MIN_CHARS,
  type MeetingTipo,
} from "@/lib/studio/bitacora/bitacora-types";
import { analyzeActaAction } from "../../actions";
import { ActaReview } from "./ActaReview";

interface Props {
  profiles: AssignableProfile[];
  myUserId: string | null;
}

export function NuevaReunionClient({ profiles, myUserId }: Props) {
  const toast = useToast();

  const [tipo, setTipo] = useState<MeetingTipo>("interna");
  const [transcript, setTranscript] = useState("");
  const [clienteText, setClienteText] = useState("");
  const [clientId, setClientId] = useState<string | null>(null);

  const [analyzing, setAnalyzing] = useState(false);
  const [review, setReview] = useState<
    { meetingId: string; resolved: ResolvedActa; clienteNombre: string | null } | null
  >(null);

  const transcriptOk = transcript.trim().length >= TRANSCRIPT_MIN_CHARS;
  const clienteOk =
    tipo === "interna" || clientId !== null || clienteText.trim() !== "";
  const canAnalyze = transcriptOk && clienteOk && !analyzing;

  const clienteNombre = clientId
    ? clienteText.trim() || null
    : clienteText.trim() || null;

  async function onAnalyze() {
    if (!canAnalyze) return;
    setAnalyzing(true);
    try {
      const res = await analyzeActaAction({
        tipo,
        transcript,
        client_id: clientId,
        contacto_libre: clientId ? null : clienteText.trim() || null,
      });
      if (res.ok && res.meetingId && res.resolved) {
        setReview({
          meetingId: res.meetingId,
          resolved: res.resolved,
          clienteNombre: tipo === "cliente" ? clienteNombre : null,
        });
      } else if (res.fieldErrors) {
        const first = Object.values(res.fieldErrors)[0];
        toast.error(first ?? "Revisa los datos.");
      } else {
        toast.error(res.error ?? "No se pudo analizar la conversación.");
      }
    } finally {
      setAnalyzing(false);
    }
  }

  // ── Revisión ──
  if (review) {
    return (
      <ActaReview
        meetingId={review.meetingId}
        resolved={review.resolved}
        profiles={profiles}
        tipo={tipo}
        clienteNombre={review.clienteNombre}
        myUserId={myUserId}
        onBack={() => setReview(null)}
      />
    );
  }

  // ── Ingesta ──
  return (
    <div style={{ maxWidth: 780 }}>
      <Link
        href="/studio/bitacora"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          font: "600 12px/1 var(--f-sans)",
          color: "var(--ink-soft)",
          textDecoration: "none",
          marginBottom: 14,
        }}
      >
        {Icon.arrowL(14)} Volver al tablero
      </Link>

      <div style={{ marginBottom: 20 }}>
        <div className="studio-eyebrow" style={{ color: "var(--wine)" }}>
          Operación · Equipo
        </div>
        <h1
          className="studio-display"
          style={{ fontSize: 26, margin: "4px 0 0", color: "var(--ink)" }}
        >
          Nueva conversación
        </h1>
        <p
          style={{
            font: "500 12.5px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: "6px 0 0",
          }}
        >
          Pega la transcripción de una reunión o de una llamada con un cliente.
          La IA propone el acta y las tareas; tú revisas y confirmas.
        </p>
      </div>

      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          padding: "20px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        {/* Tipo */}
        <div>
          <div className="studio-label" style={{ marginBottom: 8 }}>
            Tipo de conversación
          </div>
          <div
            role="tablist"
            aria-label="Tipo de conversación"
            style={{
              display: "inline-flex",
              gap: 4,
              padding: 4,
              background: "var(--bg-elevated)",
              borderRadius: "var(--r-md)",
            }}
          >
            {(
              [
                ["interna", "Reunión interna"],
                ["cliente", "Conversación con cliente"],
              ] as [MeetingTipo, string][]
            ).map(([v, label]) => {
              const active = tipo === v;
              return (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTipo(v)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "var(--r-sm)",
                    background: active ? "var(--bg-surface)" : "transparent",
                    color: active ? "var(--ink)" : "var(--ink-soft)",
                    border: 0,
                    font: `${active ? "700" : "500"} 12.5px/1 var(--f-sans)`,
                    boxShadow: active ? "var(--shadow-xs)" : "none",
                    cursor: "pointer",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Cliente (solo variante cliente) */}
        {tipo === "cliente" && (
          <div>
            <label
              className="studio-label"
              htmlFor="nr-cliente"
              style={{ marginBottom: 6, display: "block" }}
            >
              Cliente
            </label>
            <ClientCombobox
              id="nr-cliente"
              value={clienteText}
              onManualChange={(t) => {
                setClienteText(t);
                setClientId(null);
              }}
              onSelect={(hit) => {
                setClienteText(hit.name);
                setClientId(hit.id);
              }}
              ariaLabel="Buscar cliente"
              placeholder="Cédula, nombre o Shipping Mark…"
            />
            <p
              style={{
                font: "500 10.5px/1.4 var(--f-sans)",
                color: "var(--ink-mute)",
                margin: "5px 0 0",
              }}
            >
              {clientId
                ? "Cliente vinculado del sistema."
                : "Sin coincidencia exacta: se guarda el nombre y puedes vincular el cliente en el detalle."}
            </p>
          </div>
        )}

        {/* Transcripción */}
        <div>
          <label
            className="studio-label"
            htmlFor="nr-transcript"
            style={{ marginBottom: 6, display: "block" }}
          >
            Pegar transcripción
          </label>
          <textarea
            id="nr-transcript"
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={12}
            placeholder="Pega acá lo que se habló en la reunión o la llamada…"
            className="studio-input"
            style={{ width: "100%", resize: "vertical", lineHeight: 1.5 }}
          />
          <p
            style={{
              font: "500 10.5px/1.4 var(--f-sans)",
              color: transcriptOk ? "var(--ink-mute)" : "var(--ink-soft)",
              margin: "5px 0 0",
            }}
          >
            {transcript.trim().length < TRANSCRIPT_MIN_CHARS
              ? `Mínimo ${TRANSCRIPT_MIN_CHARS} caracteres para analizar (${transcript.trim().length}).`
              : `${transcript.trim().length} caracteres · listo para analizar.`}
          </p>
        </div>

        {/* Acción */}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            className="studio-btn studio-btn-primary"
            onClick={onAnalyze}
            disabled={!canAnalyze}
            aria-busy={analyzing}
          >
            {analyzing ? (
              <>
                <span className="studio-spin" aria-hidden style={{ width: 14, height: 14 }} />
                Analizando con IA…
              </>
            ) : (
              <>
                {Icon.spark(14)} Analizar con IA
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
