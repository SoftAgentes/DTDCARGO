"use client";

/**
 * PodModal — captura del Proof of Delivery (SDD-0030 + Sprint 3.5).
 *
 * Bottom sheet con:
 *  - File input (foto cámara · capture="environment") · comprimida client-side
 *  - Canvas firma touch + mouse
 *  - Inputs: receptor, cédula, notas
 *  - Submit: comprime foto + canvas→PNG → FormData → podAction → advance
 *
 * Sprint 3.5 offline-resilient: si el upload falla por RED (no por
 * validación), el POD se guarda en localStorage y se reintenta solo cuando
 * vuelve la señal (PodRetryRunner). El camionero nunca pierde la entrega.
 *
 * Distinción clave: podAction que THROWEA = problema de red → encolar.
 * podAction que devuelve { error } = validación server → mostrar error.
 */

import { useEffect, useRef, useState } from "react";
import { advanceOdAction, podAction } from "../actions";
import { useGpsLiveState } from "./GpsBlock";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { compressImage } from "@/app/m/_lib/image-compress";
import {
  blobToDataUrl,
  enqueuePod,
  makeLocalId,
} from "@/app/m/_lib/pod-queue";
import type { DispatchOrderRow } from "@/lib/studio/dispatch-types";

type SubmitPhase = "idle" | "submitting" | "done" | "queued";

export function PodModal({
  od,
  onClose,
}: {
  od: DispatchOrderRow;
  onClose: () => void;
}) {
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [hasSignature, setHasSignature] = useState(false);
  const [receivedBy, setReceivedBy] = useState("");
  const [receivedDoc, setReceivedDoc] = useState("");
  const [notes, setNotes] = useState("");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const toast = useToast();

  // Estado manual del submit (reemplaza useActionState · necesitamos
  // distinguir throw de red vs { error } de validación · Sprint 3.5).
  const [phase, setPhase] = useState<SubmitPhase>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [warningMsg, setWarningMsg] = useState<string | null>(null);

  // Sprint 3 · snapshot GPS al momento del submit (si está on)
  const gps = useGpsLiveState();

  // Setup canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#0F1E3D";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  // Cerrar después de done/queued
  useEffect(() => {
    if (phase === "done" || phase === "queued") {
      const t = setTimeout(onClose, phase === "queued" ? 1600 : 800);
      return () => clearTimeout(t);
    }
  }, [phase, onClose]);

  // Canvas drawing
  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;
    if ("touches" in e) {
      clientX = e.touches[0]?.clientX ?? 0;
      clientY = e.touches[0]?.clientY ?? 0;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    if ("preventDefault" in e) e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    drawingRef.current = true;
  };

  const moveDraw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawingRef.current) return;
    if ("preventDefault" in e) e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const endDraw = () => {
    drawingRef.current = false;
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  // Photo input
  const onPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPhotoFile(f);
    setPhotoPreview(URL.createObjectURL(f));
  };

  // Helper: GPS status string actual (para payload + cola)
  const gpsStatus: "on" | "off" | "denied" | "unavailable" =
    gps.status === "on" && gps.lat != null && gps.lng != null
      ? "on"
      : gps.status === "off"
        ? "off"
        : gps.status === "denied"
          ? "denied"
          : "unavailable";

  // Canvas → PNG blob (promesa)
  const signatureBlob = (): Promise<Blob | null> =>
    new Promise((resolve) => {
      const canvas = canvasRef.current;
      if (!canvas) return resolve(null);
      canvas.toBlob(resolve, "image/png");
    });

  // Submit · Sprint 3.5 offline-resilient
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!photoFile || !hasSignature || !receivedBy.trim()) return;
    if (phase === "submitting") return;

    setPhase("submitting");
    setErrorMsg(null);
    setWarningMsg(null);

    try {
      const sigBlob = await signatureBlob();
      if (!sigBlob) {
        setErrorMsg("No se pudo capturar la firma · reintentá.");
        setPhase("idle");
        return;
      }

      // Comprimir foto antes de subir (8MB → ~300KB) · clave para red VE
      const compressedPhoto = await compressImage(photoFile);
      const signatureFile = new File([sigBlob], "signature.png", {
        type: "image/png",
      });

      const fd = new FormData();
      fd.set("od_id", od.id);
      fd.set("photo", compressedPhoto);
      fd.set("signature", signatureFile);
      fd.set("received_by", receivedBy.trim());
      if (receivedDoc.trim()) fd.set("received_doc", receivedDoc.trim());
      if (notes.trim()) fd.set("notes", notes.trim());
      fd.set("pod_gps_status", gpsStatus);
      if (gpsStatus === "on") {
        fd.set("pod_lat", String(gps.lat));
        fd.set("pod_lng", String(gps.lng));
        if (gps.accuracy_m != null) fd.set("pod_accuracy_m", String(gps.accuracy_m));
      }

      // Intento de upload. THROW = red caída → encolar. { error } = validación.
      let podResult: { ok?: boolean; error?: string } | undefined;
      try {
        podResult = await podAction({}, fd);
      } catch (networkErr) {
        // Red caída · encolar el POD para reintento offline
        console.warn("[PodModal] upload falló (red), encolando:", networkErr);
        await queuePodForRetry(compressedPhoto, sigBlob);
        toast.info("Sin señal · el POD se subirá cuando vuelva la red", {
          durationMs: 4000,
        });
        setPhase("queued");
        return;
      }

      if (podResult?.error) {
        // Validación server · NO encolar (reintentar daría el mismo error)
        setErrorMsg(podResult.error);
        setPhase("idle");
        return;
      }

      // POD subió OK → chain advance a entregada
      try {
        const fdAdvance = new FormData();
        fdAdvance.set("od_id", od.id);
        fdAdvance.set("status", "entregada");
        fdAdvance.set("progress", "100");
        const advResult = await advanceOdAction({}, fdAdvance);
        if (advResult?.error) {
          // POD subió pero advance falló (validación) · no re-encolar el POD
          setWarningMsg(
            `POD subido, pero no se pudo marcar entregada: ${advResult.error}`,
          );
          setPhase("idle");
          return;
        }
      } catch {
        // advance falló por red · el POD YA subió, no se pierde nada.
        // El admin/bodeguero puede marcar entregada, o el camionero reintenta.
        setWarningMsg(
          "POD subido ✓ pero no se confirmó 'entregada' por falta de señal. Reintentá en un momento.",
        );
        setPhase("idle");
        return;
      }

      setPhase("done");
    } catch (err) {
      console.error("[PodModal] submit error:", err);
      setErrorMsg("Error inesperado · reintentá.");
      setPhase("idle");
    }
  };

  // Guarda el POD en localStorage para reintento (Sprint 3.5)
  async function queuePodForRetry(photo: File, sigBlob: Blob): Promise<void> {
    const [photoDataUrl, signatureDataUrl] = await Promise.all([
      blobToDataUrl(photo),
      blobToDataUrl(sigBlob),
    ]);
    enqueuePod({
      localId: makeLocalId(od.id),
      odId: od.id,
      photoDataUrl,
      signatureDataUrl,
      receivedBy: receivedBy.trim(),
      receivedDoc: receivedDoc.trim() || null,
      notes: notes.trim() || null,
      podLat: gpsStatus === "on" ? gps.lat : null,
      podLng: gpsStatus === "on" ? gps.lng : null,
      podAccuracyM: gpsStatus === "on" ? gps.accuracy_m : null,
      podGpsStatus: gpsStatus,
      queuedAt: Date.now(),
    });
  }

  const submitting = phase === "submitting";
  const canSubmit =
    !!photoFile && hasSignature && receivedBy.trim().length >= 3 && !submitting;
  const isDone = phase === "done";
  const isQueued = phase === "queued";
  const canCloseByBackdrop = !submitting;

  return (
    <div
      onClick={canCloseByBackdrop ? onClose : undefined}
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--scrim)",
        zIndex: 100,
        display: "flex",
        alignItems: "flex-end",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 480,
          margin: "0 auto",
          background: "var(--bg-surface)",
          borderRadius: "var(--r-lg) var(--r-lg) 0 0",
          padding: "20px 18px calc(env(safe-area-inset-bottom) + 18px)",
          maxHeight: "95dvh",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            width: 40,
            height: 4,
            background: "var(--border-strong)",
            borderRadius: 999,
            margin: "0 auto 14px",
          }}
        />

        {isDone ? (
          <SuccessState />
        ) : isQueued ? (
          <QueuedState />
        ) : (
          <>
            <div
              style={{
                font: "800 16px/1.2 var(--f-display)",
                color: "var(--ink)",
                marginBottom: 4,
              }}
            >
              Confirmar entrega
            </div>
            <div
              style={{
                font: "500 12.5px/1.4 var(--f-sans)",
                color: "var(--ink-soft)",
                marginBottom: 10,
              }}
            >
              <code style={{ color: "var(--wine)" }}>{od.order_code}</code> · {od.route?.name ?? "Sin ruta"}
            </div>

            {/* GPS status badge · Sprint 3 */}
            <div
              role="status"
              aria-live="polite"
              style={{
                padding: "6px 10px",
                marginBottom: 14,
                borderRadius: "var(--r-sm)",
                background:
                  gps.status === "on"
                    ? "var(--success-bg)"
                    : "var(--warning-bg)",
                color:
                  gps.status === "on"
                    ? "var(--success)"
                    : "var(--warning)",
                font: "600 11.5px/1.3 var(--f-sans)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  display: "inline-block",
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "currentColor",
                }}
              />
              {gps.status === "on"
                ? "POD se guardará con ubicación GPS"
                : gps.status === "off"
                  ? "GPS apagado · POD sin ubicación"
                  : gps.status === "denied"
                    ? "Permiso GPS denegado · POD sin ubicación"
                    : gps.status === "no_position"
                      ? "Buscando GPS… podés esperar o continuar sin ubicación"
                      : "GPS no disponible · POD sin ubicación"}
            </div>

            <form
              onSubmit={handleSubmit}
              style={{ display: "flex", flexDirection: "column", gap: 14 }}
            >
              {/* Foto */}
              <div>
                <label className="studio-label">Foto del cargamento</label>
                {photoPreview ? (
                  <div style={{ marginTop: 6, position: "relative" }}>
                    <img
                      src={photoPreview}
                      alt="Foto del cargamento"
                      style={{
                        width: "100%",
                        aspectRatio: "4/3",
                        objectFit: "cover",
                        borderRadius: "var(--r-md)",
                        border: "1px solid var(--border)",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setPhotoFile(null);
                        setPhotoPreview(null);
                      }}
                      className="studio-btn studio-btn-ghost studio-btn-xs"
                      style={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        background: "var(--bg-surface)",
                      }}
                    >
                      Cambiar
                    </button>
                  </div>
                ) : (
                  <label
                    style={{
                      marginTop: 6,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      width: "100%",
                      aspectRatio: "4/3",
                      background: "var(--bg-elevated)",
                      border: "2px dashed var(--border-strong)",
                      borderRadius: "var(--r-md)",
                      cursor: "pointer",
                      font: "700 13px/1.2 var(--f-sans)",
                      color: "var(--ink-soft)",
                    }}
                  >
                    Tomar foto
                    <span style={{ font: "500 11px/1.3 var(--f-sans)", color: "var(--ink-mute)" }}>
                      Tocá para usar la cámara
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={onPhotoChange}
                      style={{ display: "none" }}
                    />
                  </label>
                )}
              </div>

              {/* Firma canvas */}
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 6,
                  }}
                >
                  <label className="studio-label" style={{ margin: 0 }}>
                    Firma del receptor
                  </label>
                  {hasSignature && (
                    <button
                      type="button"
                      onClick={clearSignature}
                      className="studio-btn studio-btn-ghost studio-btn-xs"
                    >
                      Borrar
                    </button>
                  )}
                </div>
                <div
                  style={{
                    position: "relative",
                    background: "#FFFFFF",
                    border: "2px dashed var(--border-strong)",
                    borderRadius: "var(--r-md)",
                    overflow: "hidden",
                  }}
                >
                  <canvas
                    ref={canvasRef}
                    width={600}
                    height={280}
                    onMouseDown={startDraw}
                    onMouseMove={moveDraw}
                    onMouseUp={endDraw}
                    onMouseLeave={endDraw}
                    onTouchStart={startDraw}
                    onTouchMove={moveDraw}
                    onTouchEnd={endDraw}
                    style={{
                      width: "100%",
                      height: "auto",
                      display: "block",
                      touchAction: "none",
                      cursor: "crosshair",
                    }}
                  />
                  {!hasSignature && (
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        pointerEvents: "none",
                        font: "500 13px/1 var(--f-sans)",
                        color: "var(--ink-mute)",
                      }}
                    >
                      Firmá acá
                    </div>
                  )}
                </div>
              </div>

              {/* Receptor */}
              <div>
                <label className="studio-label" htmlFor="received-by">
                  Nombre de quien recibe
                </label>
                <input
                  id="received-by"
                  type="text"
                  className="studio-input"
                  value={receivedBy}
                  onChange={(e) => setReceivedBy(e.target.value)}
                  placeholder="Ej: Carlos Méndez"
                  required
                  minLength={3}
                  style={{ marginTop: 6 }}
                />
              </div>

              <div>
                <label className="studio-label" htmlFor="received-doc">
                  Cédula (opcional)
                </label>
                <input
                  id="received-doc"
                  type="text"
                  className="studio-input studio-input-mono"
                  value={receivedDoc}
                  onChange={(e) => setReceivedDoc(e.target.value)}
                  placeholder="V-12.345.678"
                  style={{ marginTop: 6 }}
                />
              </div>

              <div>
                <label className="studio-label" htmlFor="pod-notes">
                  Observaciones (opcional)
                </label>
                <textarea
                  id="pod-notes"
                  className="studio-input"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Carga entregada en buenas condiciones"
                  style={{ marginTop: 6, resize: "vertical" }}
                />
              </div>

              {/* Errors */}
              {errorMsg && (
                <div
                  style={{
                    padding: 10,
                    background: "var(--danger-bg)",
                    color: "var(--danger)",
                    borderRadius: "var(--r-sm)",
                    font: "600 12.5px/1.4 var(--f-sans)",
                  }}
                >
                  {errorMsg}
                </div>
              )}
              {warningMsg && (
                <div
                  style={{
                    padding: 10,
                    background: "var(--warning-bg)",
                    color: "var(--warning)",
                    borderRadius: "var(--r-sm)",
                    font: "600 12.5px/1.4 var(--f-sans)",
                  }}
                >
                  {warningMsg}
                </div>
              )}

              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  className="studio-btn studio-btn-ghost"
                  onClick={onClose}
                  disabled={submitting}
                  style={{ flex: 1 }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="studio-btn studio-btn-primary"
                  disabled={!canSubmit}
                  style={{ flex: 2 }}
                >
                  {submitting ? "Subiendo POD…" : "Confirmar entrega"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function SuccessState() {
  return (
    <div
      style={{
        padding: "24px 12px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          margin: "0 auto 14px",
          borderRadius: "50%",
          background: "var(--success-bg)",
          color: "var(--success)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          font: "900 32px/1 var(--f-display)",
        }}
      >
        ✓
      </div>
      <div style={{ font: "900 20px/1.2 var(--f-display)", color: "var(--ink)" }}>
        Entrega confirmada
      </div>
      <p
        style={{
          font: "500 13px/1.5 var(--f-sans)",
          color: "var(--ink-soft)",
          marginTop: 8,
          maxWidth: "32ch",
          marginInline: "auto",
        }}
      >
        El POD se subió al ERP. La OD quedó como entregada.
      </p>
    </div>
  );
}

/** Sprint 3.5 · POD guardado offline, se reintentará al volver la señal. */
function QueuedState() {
  return (
    <div style={{ padding: "24px 12px", textAlign: "center" }}>
      <div
        style={{
          width: 64,
          height: 64,
          margin: "0 auto 14px",
          borderRadius: "50%",
          background: "var(--warning-bg)",
          color: "var(--warning)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Cloud-clock icon · guardado, pendiente de subir */}
        <svg viewBox="0 0 24 24" width={30} height={30} fill="none">
          <path
            d="M7 18a4 4 0 010-8 5 5 0 019.6-1.5A3.5 3.5 0 0117 18"
            stroke="currentColor"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M12 13v2.5l1.5 1"
            stroke="currentColor"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div style={{ font: "900 18px/1.2 var(--f-display)", color: "var(--ink)" }}>
        Guardado sin señal
      </div>
      <p
        style={{
          font: "500 13px/1.5 var(--f-sans)",
          color: "var(--ink-soft)",
          marginTop: 8,
          maxWidth: "34ch",
          marginInline: "auto",
        }}
      >
        El POD quedó guardado en el teléfono. Se sube solo cuando vuelva la
        señal — no hace falta que repitas nada.
      </p>
    </div>
  );
}
