"use client";

/**
 * BugTechCaptureProvider · monta los singletons de auto-captura técnica
 * para el Bug Reporter (SDD-0036 Fase 4 + 4.5).
 *
 * Component sin UI · dispara install() en mount y uninstall() en unmount.
 * Se monta una sola vez en el layout del Studio.
 *
 * D3: el reporter NO sabe que se está capturando. No hay UI, no hay
 * banner, no hay toggle.
 *
 * Capture cubre:
 *   - 3 últimos errores de consola (sync + promise rejection)
 *   - 5 últimos network requests (fetch + XMLHttpRequest)
 *   - rrweb session replay (últimos 30s) · Fase 4.5
 *
 * Datos sanitizados con bug-sanitizer.ts antes de entrar al buffer
 * (defense in depth contra leaks de tokens/passwords).
 *
 * rrweb capture respeta atributos data-bug-mask y data-bug-block para
 * ocultar inputs sensibles (passwords masked by default via maskAllInputs).
 */

import { useEffect } from "react";
import { getBugTechCapture } from "@/lib/studio/bug-tech-capture";
import { getBugRrwebCapture } from "@/lib/studio/bug-rrweb-capture";

export function BugTechCaptureProvider() {
  useEffect(() => {
    const capture = getBugTechCapture();
    capture.install();

    // rrweb arranca async (import dinámico para no bloquear hydration)
    const rrwebCapture = getBugRrwebCapture();
    rrwebCapture.install().catch((err) => {
      console.error("[BugTechCaptureProvider] rrweb install failed:", err);
    });

    return () => {
      capture.uninstall();
      rrwebCapture.uninstall();
    };
  }, []);

  return null;
}
