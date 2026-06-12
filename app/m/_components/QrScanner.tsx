"use client";

/**
 * QrScanner · scanner de códigos QR mobile (Sprint E · plan v3).
 *
 * Approach V1: native `BarcodeDetector` API (sin dependencias externas).
 *  - Soportado en Chrome Android (target principal del bodeguero VE).
 *  - Fallback iOS Safari (que no soporta BarcodeDetector aún):
 *    detección runtime + render del input manual sin la CTA cámara.
 *
 * Cuando `html5-qrcode` se sume como dependencia en una iteración futura,
 * este componente se reemplaza por un dynamic(import) ahí adentro · el
 * caller no cambia.
 *
 * Convención `onDetected`:
 *  - Recibe el `text` decodificado (string)
 *  - El padre decide si auto-cierra el scanner, hace un beep, anima, etc.
 *  - Cooldown 1.5s entre detecciones del mismo código (evita scan-burst
 *    cuando el QR queda apuntando a la cámara).
 *
 * Accesibilidad:
 *  - `prefers-reduced-motion` desactiva la animation del frame guide.
 *  - Manual entry input siempre disponible (focus auto al abrir).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/app/studio/_components/icons";

interface Props {
  onDetected: (code: string, source: "camera" | "manual") => void;
  /** Opcional · si retorna `false`, el scanner queda activo (no auto-close). */
  onClose?: () => void;
  /** Hint visible al usuario sobre qué tipo de código esperamos. */
  placeholder?: string;
  /** Label del input manual. Default: "Ingresar código manualmente". */
  manualLabel?: string;
  /** Mensaje opcional bajo el header (ej "Faltan 12 cajas"). */
  hint?: string;
}

type ScannerMode = "checking" | "camera" | "no_camera" | "denied";

export function QrScanner({
  onDetected,
  onClose,
  placeholder = "DTDU-2026-0042",
  manualLabel = "Ingresar código manualmente",
  hint,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastCodeRef = useRef<{ code: string; at: number } | null>(null);

  const [mode, setMode] = useState<ScannerMode>("checking");
  const [manual, setManual] = useState("");
  const [scanFeedback, setScanFeedback] = useState<string | null>(null);

  const isBarcodeDetectorAvailable =
    typeof window !== "undefined" && "BarcodeDetector" in window;

  // Stop the camera + cleanup raf
  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  // Start camera + barcode detection loop
  const startCamera = useCallback(async () => {
    if (!isBarcodeDetectorAvailable) {
      setMode("no_camera");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setMode("camera");

      // Loop de detección
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Detector: any = (window as any).BarcodeDetector;
      const detector = new Detector({
        formats: ["qr_code", "code_128", "code_39", "ean_13"],
      });

      const tick = async () => {
        if (!videoRef.current || !streamRef.current) return;
        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes && barcodes.length > 0) {
            const text = String(barcodes[0].rawValue ?? "").trim();
            if (text) {
              const last = lastCodeRef.current;
              const now = Date.now();
              if (!last || last.code !== text || now - last.at > 1500) {
                lastCodeRef.current = { code: text, at: now };
                setScanFeedback(text);
                onDetected(text, "camera");
              }
            }
          }
        } catch (err) {
          // Silent · el next frame retry
          console.debug("[QrScanner] detect error", err);
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      console.error("[QrScanner] camera error:", err);
      setMode("denied");
    }
  }, [isBarcodeDetectorAvailable, onDetected]);

  // Side-effect: arrancar al mount, parar al unmount.
  // setState dentro de startCamera es intencional · necesitamos transicionar
  // entre checking/camera/no_camera/denied basado en el resultado async de
  // getUserMedia. La alternativa (mover el state machine a un store externo
  // con useSyncExternalStore) sería sobreingeniería para un mount-once.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void startCamera();
    return stopCamera;
  }, [startCamera, stopCamera]);

  // Limpiar feedback flash después de 1.2s
  useEffect(() => {
    if (!scanFeedback) return;
    const t = setTimeout(() => setScanFeedback(null), 1200);
    return () => clearTimeout(t);
  }, [scanFeedback]);

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = manual.trim();
    if (!code) return;
    onDetected(code, "manual");
    setManual("");
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {/* Hint */}
      {hint && (
        <div
          style={{
            font: "600 12px/1.3 var(--f-sans)",
            color: "var(--ink-soft)",
          }}
        >
          {hint}
        </div>
      )}

      {/* Camera viewport */}
      {mode === "camera" && (
        <div
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "1",
            borderRadius: "var(--r-md)",
            overflow: "hidden",
            background: "var(--bg-elevated)",
          }}
        >
          <video
            ref={videoRef}
            playsInline
            muted
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
          {/* Frame guide */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: "12%",
              border: "2px solid var(--wine-soft)",
              borderRadius: "var(--r-md)",
              pointerEvents: "none",
              boxShadow: "0 0 0 9999px rgba(15,30,61,0.45)",
            }}
          />
          {/* Pulse scan line (respeta prefers-reduced-motion) */}
          <div
            aria-hidden="true"
            className="qr-scan-line"
            style={{
              position: "absolute",
              left: "12%",
              right: "12%",
              top: "50%",
              height: 2,
              background: "var(--wine-soft)",
              pointerEvents: "none",
              opacity: 0.65,
            }}
          />
          <style>{`
            @media (prefers-reduced-motion: no-preference) {
              @keyframes qr-scan {
                0%, 100% { transform: translateY(-30%); }
                50% { transform: translateY(30%); }
              }
              .qr-scan-line { animation: qr-scan 2.2s ease-in-out infinite; }
            }
          `}</style>
          {/* Feedback (último code detectado) */}
          {scanFeedback && (
            <div
              role="status"
              style={{
                position: "absolute",
                top: 12,
                left: 12,
                right: 12,
                padding: "8px 12px",
                background: "var(--success-bg)",
                border: "1px solid var(--success)",
                borderRadius: "var(--r-sm)",
                color: "var(--ink)",
                font: "700 12.5px/1.2 var(--f-mono)",
                textAlign: "center",
              }}
            >
              ✓ {scanFeedback}
            </div>
          )}
        </div>
      )}

      {/* Camera not available · fallback */}
      {(mode === "no_camera" || mode === "denied") && (
        <div
          role="status"
          style={{
            padding: 14,
            background: "var(--warning-bg)",
            border: "1px solid var(--warning)",
            borderRadius: "var(--r-sm)",
            color: "var(--ink)",
            font: "600 12.5px/1.4 var(--f-sans)",
          }}
        >
          {mode === "denied"
            ? "Permiso de cámara denegado · usa el ingreso manual abajo."
            : "Cámara no disponible · usa el ingreso manual abajo."}
        </div>
      )}

      {mode === "checking" && (
        <div
          style={{
            padding: 14,
            color: "var(--ink-soft)",
            font: "500 12.5px/1.4 var(--f-sans)",
            textAlign: "center",
          }}
        >
          Activando cámara…
        </div>
      )}

      {/* Manual entry siempre visible */}
      <form
        onSubmit={handleManualSubmit}
        style={{ display: "flex", gap: 8 }}
      >
        <input
          type="text"
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder={placeholder}
          aria-label={manualLabel}
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          className="studio-input studio-input-mono"
          style={{ flex: 1, fontSize: 14, textTransform: "uppercase" }}
        />
        <button
          type="submit"
          className="studio-btn studio-btn-primary"
          disabled={manual.trim().length < 4}
          style={{ flexShrink: 0 }}
        >
          {Icon.check(14)}
          <span style={{ marginLeft: 6 }}>Confirmar</span>
        </button>
      </form>

      {/* Close (si el padre quiere ofrecerlo) */}
      {onClose && (
        <button
          type="button"
          onClick={() => {
            stopCamera();
            onClose();
          }}
          className="studio-btn studio-btn-ghost"
          style={{ marginTop: 4 }}
        >
          Cerrar scanner
        </button>
      )}
    </div>
  );
}
