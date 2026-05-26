"use client";

/**
 * BugTechCaptureProvider · monta el singleton de auto-captura técnica
 * para el Bug Reporter (SDD-0036 Fase 4).
 *
 * Component sin UI · solo dispara install() en mount y uninstall() en
 * unmount. Se monta una sola vez en el layout del Studio, al lado del
 * BugFABButton.
 *
 * D3: el reporter NO sabe que se está capturando. No hay UI, no hay
 * banner, no hay toggle.
 *
 * Capture cubre:
 *   - 3 últimos errores de consola (sync + promise rejection)
 *   - 5 últimos network requests (fetch + XMLHttpRequest)
 *
 * Datos sanitizados con bug-sanitizer.ts antes de entrar al buffer
 * (defense in depth contra leaks de tokens/passwords).
 *
 * NO incluye rrweb session replay (Fase 4.5 follow-up).
 */

import { useEffect } from "react";
import { getBugTechCapture } from "@/lib/studio/bug-tech-capture";

export function BugTechCaptureProvider() {
  useEffect(() => {
    const capture = getBugTechCapture();
    capture.install();
    return () => {
      capture.uninstall();
    };
  }, []);

  return null;
}
