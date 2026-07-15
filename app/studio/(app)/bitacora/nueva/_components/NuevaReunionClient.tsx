"use client";

/**
 * NuevaReunionClient · ingesta de conversación (SDD-0146 · Fase 2 + Fase 3).
 *
 * Dos momentos: INGESTA (elegir tipo, vincular cliente si aplica, aportar la
 * conversación por TEXTO o por AUDIO, "Analizar con IA") → REVISIÓN
 * (`<ActaReview>` editable antes de confirmar). La extracción corre en la server
 * action `analyzeActaAction` (Anthropic o mock).
 *
 * Fase 3 — audio: segmented "Pegar transcripción" / "Grabar o subir audio". La
 * grabadora (MediaRecorder, cascada de mimeType para iOS, cap 10 min) o un archivo
 * suben directo browser→Storage (bucket `bitacora`) y luego `POST /transcribe`
 * devuelve el texto, que cae en el textarea (append). El `audio_path` viaja al
 * borrador cuando se analiza. Si la transcripción no está configurada, se avisa y
 * el flujo de pegar texto sigue vivo.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/app/studio/_components/icons";
import { ClientCombobox } from "@/app/studio/_components/ui/ClientCombobox";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { createClient as createBrowserSupabase } from "@/lib/db/client";
import type { AssignableProfile } from "@/lib/studio/bitacora/bitacora-queries";
import type { ResolvedActa } from "@/lib/studio/bitacora/match";
import {
  TRANSCRIPT_MIN_CHARS,
  type MeetingTipo,
} from "@/lib/studio/bitacora/bitacora-types";
import {
  AUDIO_MAX_BYTES,
  AUDIO_MAX_SECONDS,
  BITACORA_BUCKET,
  audioContentTypeForExt,
  audioExtFromFile,
  audioExtFromMime,
  buildMeetingAudioPath,
  type AudioExt,
} from "@/lib/studio/bitacora/storage";
import { analyzeActaAction } from "../../actions";
import { ActaReview } from "./ActaReview";

interface Props {
  profiles: AssignableProfile[];
  myUserId: string | null;
  /** Tenant del caller (resuelto server-side) para armar el path del audio. */
  tenantId: string | null;
  /** ¿El usuario puede correr la Escucha Activa? (capability admin, SDD-0150). */
  canEscucha: boolean;
}

type IngestaMode = "text" | "audio";

export function NuevaReunionClient({
  profiles,
  myUserId,
  tenantId,
  canEscucha,
}: Props) {
  const toast = useToast();

  const [tipo, setTipo] = useState<MeetingTipo>("interna");
  const [mode, setMode] = useState<IngestaMode>("text");
  const [transcript, setTranscript] = useState("");
  const [clienteText, setClienteText] = useState("");
  const [clientId, setClientId] = useState<string | null>(null);
  const [audioPath, setAudioPath] = useState<string | null>(null);

  // meetingId client-generated al montar (ANTES de subir audio): es la carpeta del
  // path del bucket. El borrador (bitacora_meetings) se crea al analizar/confirmar.
  const [meetingId, setMeetingId] = useState<string | null>(null);
  useEffect(() => {
    // Id client-only al montar: en SSR quedaría null y crypto.randomUUID() en el
    // render inicial rompería la hidratación. El efecto corre solo en el cliente.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMeetingId((cur) => cur ?? crypto.randomUUID());
  }, []);

  const [analyzing, setAnalyzing] = useState(false);
  const [review, setReview] = useState<
    { meetingId: string; resolved: ResolvedActa; clienteNombre: string | null } | null
  >(null);

  const transcriptOk = transcript.trim().length >= TRANSCRIPT_MIN_CHARS;
  const clienteOk =
    tipo === "interna" || clientId !== null || clienteText.trim() !== "";
  const canAnalyze = transcriptOk && clienteOk && !analyzing;

  const clienteNombre = clienteText.trim() || null;

  function handleTranscribed(text: string, path: string) {
    setTranscript((prev) => (prev.trim() ? `${prev.trim()}\n\n${text}` : text));
    setAudioPath(path);
    setMode("text");
  }

  async function onAnalyze() {
    if (!canAnalyze) return;
    setAnalyzing(true);
    try {
      const res = await analyzeActaAction({
        tipo,
        transcript,
        client_id: clientId,
        contacto_libre: clientId ? null : clienteText.trim() || null,
        audio_path: audioPath,
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
        canEscucha={canEscucha}
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

      <div style={{ marginBottom: "var(--s-5)" }}>
        <div className="studio-eyebrow" style={{ color: "var(--wine-text)" }}>
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
          Graba una reunión, sube un audio o pega la transcripción. La IA propone
          el acta y las tareas; tú revisas y confirmas.
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
          <div className="studio-label" style={{ marginBottom: "var(--s-2)" }}>
            Tipo de conversación
          </div>
          <div
            role="tablist"
            aria-label="Tipo de conversación"
            style={{
              display: "inline-flex",
              gap: "var(--s-1)",
              padding: "var(--s-1)",
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
                    padding: "var(--s-2) var(--s-4)",
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
                color: "var(--ink-soft)",
                margin: "5px 0 0",
              }}
            >
              {clientId
                ? "Cliente vinculado del sistema."
                : "Sin coincidencia exacta: se guarda el nombre y puedes vincular el cliente en el detalle."}
            </p>
          </div>
        )}

        {/* Segmented: cómo aportar la conversación */}
        <div>
          <div className="studio-label" style={{ marginBottom: "var(--s-2)" }}>
            Conversación
          </div>
          <div
            role="tablist"
            aria-label="Cómo aportar la conversación"
            style={{
              display: "inline-flex",
              gap: "var(--s-1)",
              padding: "var(--s-1)",
              background: "var(--bg-elevated)",
              borderRadius: "var(--r-md)",
            }}
          >
            {(
              [
                ["text", "Pegar transcripción"],
                ["audio", "Grabar o subir audio"],
              ] as [IngestaMode, string][]
            ).map(([v, label]) => {
              const active = mode === v;
              return (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setMode(v)}
                  style={{
                    padding: "var(--s-2) var(--s-4)",
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

        {mode === "audio" ? (
          <AudioCapture
            tenantId={tenantId}
            meetingId={meetingId}
            onTranscribed={handleTranscribed}
          />
        ) : (
          <div>
            <label
              className="studio-label"
              htmlFor="nr-transcript"
              style={{ marginBottom: 6, display: "block" }}
            >
              Transcripción
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
        )}

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

// ─── Grabadora + subida de audio (Fase 3) ────────────────────

function fmtElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Cascada de mimeType: opus/webm (Chrome/Android) → mp4 (iOS Safari) → default. */
function pickAudioMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  for (const c of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(c)) return c;
    } catch {
      /* algunos browsers lanzan si el tipo es raro */
    }
  }
  return undefined;
}

interface AudioCaptureProps {
  tenantId: string | null;
  meetingId: string | null;
  onTranscribed: (text: string, audioPath: string) => void;
}

function AudioCapture({ tenantId, meetingId, onTranscribed }: AudioCaptureProps) {
  const toast = useToast();

  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioExt, setAudioExt] = useState<AudioExt | null>(null);
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [transcriptionOff, setTranscriptionOff] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }
  function clearTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  // Limpieza dura al desmontar (solo refs → sin deps): corta el mic, el timer y
  // el MediaRecorder. El object URL se revoca en su propio efecto (por audioUrl).
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      const r = recorderRef.current;
      if (r && r.state !== "inactive") {
        try {
          r.stop();
        } catch {
          /* ya detenido */
        }
      }
    };
  }, []);

  // Revoca el object URL anterior cuando cambia (o al desmontar) — sin fugas.
  useEffect(() => {
    if (!audioUrl) return;
    return () => URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

  function setCaptured(blob: Blob, ext: AudioExt) {
    // El efecto de audioUrl revoca el anterior; acá solo publicamos el nuevo.
    setAudioBlob(blob);
    setAudioExt(ext);
    setAudioUrl(URL.createObjectURL(blob));
    setUploadedPath(null); // audio nuevo → hay que subir de nuevo
    setAudioError(null);
  }

  function discard() {
    setAudioBlob(null);
    setAudioExt(null);
    setAudioUrl(null); // el efecto revoca el URL anterior
    setUploadedPath(null);
    setAudioError(null);
  }

  async function startRecording() {
    setAudioError(null);
    if (
      typeof MediaRecorder === "undefined" ||
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setAudioError(
        "Tu navegador no permite grabar. Sube un archivo o pega el texto.",
      );
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setAudioError(
        "No se pudo acceder al micrófono. Revisa los permisos o sube un archivo.",
      );
      return;
    }
    streamRef.current = stream;

    const mimeType = pickAudioMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
    } catch {
      stopStream();
      setAudioError("No se pudo iniciar la grabación. Sube un archivo o pega el texto.");
      return;
    }

    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      clearTimer();
      stopStream();
      // Extensión del mimeType REAL (iOS = mp4, NUNCA hardcodear webm).
      const realType = recorder.mimeType || mimeType || "audio/webm";
      const blob = new Blob(chunksRef.current, { type: realType });
      const ext = audioExtFromMime(realType) ?? "webm";
      if (blob.size > AUDIO_MAX_BYTES) {
        setAudioError("La grabación supera 50 MB. Graba algo más corto o pega el texto.");
        return;
      }
      setCaptured(blob, ext);
    };

    try {
      recorder.start();
    } catch {
      stopStream();
      setAudioError("No se pudo iniciar la grabación. Sube un archivo o pega el texto.");
      return;
    }
    recorderRef.current = recorder;
    setRecording(true);
    elapsedRef.current = 0;
    setElapsed(0);
    timerRef.current = setInterval(() => {
      elapsedRef.current += 1;
      setElapsed(elapsedRef.current);
      if (elapsedRef.current >= AUDIO_MAX_SECONDS) stopRecording(); // auto-stop 10 min
    }, 1000);
  }

  function stopRecording() {
    clearTimer();
    const r = recorderRef.current;
    if (r && r.state !== "inactive") {
      try {
        r.stop();
      } catch {
        /* ya detenido */
      }
    }
    setRecording(false);
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = ""; // permite re-elegir el mismo archivo
    if (!f) return;
    const ext = audioExtFromFile(f);
    if (!ext) {
      setAudioError(
        "Formato no soportado. Sube un archivo .webm, .mp4 o .m4a, o pega el texto.",
      );
      return;
    }
    if (f.size > AUDIO_MAX_BYTES) {
      setAudioError("El archivo supera 50 MB. Sube uno más corto o pega el texto.");
      return;
    }
    setCaptured(f, ext);
  }

  async function uploadAudio(blob: Blob, ext: AudioExt): Promise<string | null> {
    if (!tenantId || !meetingId) {
      setAudioError("No se pudo preparar la subida. Pega el texto por ahora.");
      return null;
    }
    if (blob.size > AUDIO_MAX_BYTES) {
      setAudioError("El audio supera 50 MB. Sube uno más corto o pega el texto.");
      return null;
    }
    const path = buildMeetingAudioPath({
      tenantId,
      meetingId,
      uuid: crypto.randomUUID(),
      ext,
    });
    const supabase = createBrowserSupabase();
    const { error } = await supabase.storage
      .from(BITACORA_BUCKET)
      .upload(path, blob, {
        contentType: audioContentTypeForExt(ext),
        upsert: false,
      });
    if (error) {
      setAudioError(`No se pudo subir el audio: ${error.message}`);
      return null;
    }
    return path;
  }

  async function transcribeOnly(path: string) {
    setTranscribing(true);
    setAudioError(null);
    try {
      const res = await fetch("/api/studio/bitacora/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
      if (res.status === 503) {
        setTranscriptionOff(true);
        return;
      }
      let json: { transcript?: string; error?: string } = {};
      try {
        json = await res.json();
      } catch {
        /* sin cuerpo */
      }
      if (!res.ok) {
        setAudioError(json.error ?? "No se pudo transcribir. Reintenta.");
        return;
      }
      const text = typeof json.transcript === "string" ? json.transcript.trim() : "";
      if (!text) {
        setAudioError("La transcripción llegó vacía. Reintenta o pega el texto.");
        return;
      }
      toast.success("Transcripción lista · revísala y analiza");
      onTranscribed(text, path);
    } catch {
      setAudioError("No se pudo conectar con la transcripción. Reintenta.");
    } finally {
      setTranscribing(false);
    }
  }

  async function startTranscription() {
    if (!audioBlob || !audioExt) return;
    // Sube (si aún no) → transcribe. El path queda guardado para reintentar sin
    // re-grabar/re-subir tras un fallo de CF.
    let path = uploadedPath;
    if (!path) {
      setUploading(true);
      path = await uploadAudio(audioBlob, audioExt);
      setUploading(false);
      if (!path) return;
      setUploadedPath(path);
    }
    await transcribeOnly(path);
  }

  const busy = uploading || transcribing;

  // Transcripción apagada: aviso claro, el flujo de pegar texto sigue vivo.
  if (transcriptionOff) {
    return (
      <div
        role="note"
        style={{
          font: "600 12px/1.5 var(--f-sans)",
          color: "var(--warning)",
          background: "var(--warning-bg)",
          border: "1px solid var(--warning)",
          borderRadius: "var(--r-md)",
          padding: "12px 14px",
        }}
      >
        La transcripción de audio no está activada todavía — pega el texto por
        ahora (pestaña «Pegar transcripción»).
      </div>
    );
  }

  return (
    <div
      style={{
        border: "1px dashed var(--border-strong)",
        borderRadius: "var(--r-md)",
        padding: "16px 16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <p
        style={{
          font: "500 11.5px/1.5 var(--f-sans)",
          color: "var(--ink-soft)",
          margin: 0,
        }}
      >
        Para reuniones presenciales — pon el teléfono en la mesa o activa el
        altavoz. Las llamadas de WhatsApp no se pueden grabar desde el navegador
        (el sistema le da el micrófono a la llamada): para esas, sube el archivo o
        pega el texto.
      </p>

      {/* Grabadora */}
      {!audioBlob && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-3)" }}>
          {recording ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--s-3)",
                flexWrap: "wrap",
              }}
            >
              <span
                aria-hidden
                className="bitacora-rec-dot"
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  background: "var(--danger)",
                  flexShrink: 0,
                }}
              />
              <span
                aria-live="polite"
                style={{
                  font: "700 15px/1 var(--f-mono)",
                  color: "var(--ink)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {fmtElapsed(elapsed)}
              </span>
              <span
                style={{
                  font: "500 11px/1.3 var(--f-sans)",
                  color: "var(--ink-soft)",
                }}
              >
                Máximo {fmtElapsed(AUDIO_MAX_SECONDS)}
              </span>
              <button
                type="button"
                className="studio-btn studio-btn-secondary studio-btn-sm"
                onClick={stopRecording}
                style={{ marginLeft: "auto" }}
              >
                Detener
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="studio-btn studio-btn-secondary"
              onClick={startRecording}
              disabled={busy}
              style={{ alignSelf: "flex-start" }}
            >
              {Icon.mic(15)} Grabar reunión
            </button>
          )}

          {/* Subir archivo */}
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "var(--s-2)",
              font: "600 12px/1 var(--f-sans)",
              color: "var(--ink-soft)",
              cursor: busy ? "default" : "pointer",
              alignSelf: "flex-start",
            }}
          >
            {Icon.upload(14)} o sube un archivo de audio
            <input
              type="file"
              accept="audio/*"
              onChange={onPickFile}
              disabled={busy}
              style={{ display: "none" }}
            />
          </label>
        </div>
      )}

      {/* Preview + transcribir */}
      {audioBlob && audioUrl && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-3)" }}>
          <audio controls src={audioUrl} style={{ width: "100%" }} />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              className="studio-btn studio-btn-primary"
              onClick={startTranscription}
              disabled={busy}
              aria-busy={busy}
            >
              {busy ? (
                <>
                  <span
                    className="studio-spin"
                    aria-hidden
                    style={{ width: 14, height: 14 }}
                  />
                  {uploading ? "Subiendo…" : "Transcribiendo…"}
                </>
              ) : uploadedPath ? (
                <>{Icon.spark(14)} Reintentar transcripción</>
              ) : (
                <>{Icon.spark(14)} Transcribir</>
              )}
            </button>
            <button
              type="button"
              className="studio-btn studio-btn-ghost"
              onClick={discard}
              disabled={busy}
            >
              Descartar
            </button>
          </div>
        </div>
      )}

      {audioError && (
        <p
          role="alert"
          style={{
            font: "600 11.5px/1.4 var(--f-sans)",
            color: "var(--danger)",
            margin: 0,
          }}
        >
          {audioError}
        </p>
      )}
    </div>
  );
}
