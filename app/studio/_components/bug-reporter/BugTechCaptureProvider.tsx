"use client";

/**
 * BugTechCaptureProvider · monta los singletons de auto-captura técnica
 * para el Bug Reporter (SDD-0036 Fase 4 + 4.5).
 *
 * Component sin UI · dispara install() en mount y uninstall() en unmount.
 * Se monta una sola vez en el layout del Studio.
 *
 * El replay permanece apagado por defecto. Solo se instala con el flag público
 * explícito después de aprobar aviso y retención.
 *
 * Capture cubre:
 *   - 3 últimos errores de consola (sync + promise rejection)
 *   - 5 últimos network requests (fetch + XMLHttpRequest)
 *   - rrweb session replay (últimos 15s) · Fase 4.5
 *
 * Datos sanitizados con bug-sanitizer.ts antes de entrar al buffer
 * (defense in depth contra leaks de tokens/passwords).
 *
 * rrweb capture respeta las clases rr-mask y rr-block para contenido
 * sensible (los inputs se enmascaran siempre vía maskAllInputs).
 */

import { useEffect } from "react";
import { getBugTechCapture } from "@/lib/studio/bug-tech-capture";
import {
  bugReplayEnabled,
  getBugRrwebCapture,
} from "@/lib/studio/bug-rrweb-capture";

export function BugTechCaptureProvider() {
  useEffect(() => {
    const capture = getBugTechCapture();
    capture.install();

    const rrwebCapture = getBugRrwebCapture();
    if (bugReplayEnabled()) {
      rrwebCapture.install().catch((err) => {
        console.error("[BugTechCaptureProvider] rrweb install failed:", err);
      });
    }

    return () => {
      capture.uninstall();
      rrwebCapture.uninstall();
    };
  }, []);

  return null;
}
