/**
 * Bug rrweb capture · grabación continua de últimos 15s para el Bug Reporter
 * (SDD-0036 Fase 4.5).
 *
 * Singleton client-side que arranca rrweb.record() y mantiene un buffer
 * rolling de eventos. Al submit del bug, se serializa + gzipea + sube a
 * bucket `bug-replays`. La URL signed se guarda en
 * bug_tech_data.session_replay_url.
 *
 * Diseño:
 *   - Buffer rolling 15s: cada vez que entra un evento, descarta los
 *     que están más allá de la ventana
 *   - Sin sampling agresivo · rrweb default ya inteligente (DOM mutations
 *     observa cambios, no estados)
 *   - SSR-safe: getSnapshot devuelve [] si window no existe
 *   - Privacy: rrweb capture bloquea inputs por default vía mask-text
 *     pero por seguridad agregamos blockClass/maskAllInputs explícitos
 *
 * Checkout periódico (checkoutEveryNms) cada 10s: fuerza un snapshot completo
 * dentro de la ventana rolling de 15s. Sin esto, el snapshot inicial se
 * desaloja tras 15s y el player no puede reconstruir la pantalla — clave para
 * mostrar el FRAME FINAL congelado como "la foto del momento" (SDD-0036).
 *
 * Privacy notes:
 *   - maskAllInputs: ON → todos los <input> se reemplazan por asteriscos
 *   - maskTextSelector: aplicado a clases marcadas con `data-bug-mask`
 *   - blockSelector: aplicado a `[data-bug-block]` (ej: secciones con PII)
 */

// rrweb event con timestamp · usamos un tipo local mínimo para no acoplar
// el código a los tipos internos de rrweb (que varían entre majors).
interface RrwebEvent {
  type: number;
  data: unknown;
  timestamp: number;
}

const WINDOW_MS = 15_000; // 15 segundos de buffer rolling
const MAX_EVENTS = 300; // Cap absoluto · evita memory leak en sesiones largas

class BugRrwebCapture {
  private buffer: RrwebEvent[] = [];
  private stopFn: (() => void) | null = null;
  private installed = false;

  async install(): Promise<void> {
    if (this.installed || typeof window === "undefined") return;

    try {
      // Import dinámico: rrweb pesa ~50KB · solo se carga client-side
      const { record } = await import("rrweb");

      const stop = record({
        emit: (event) => this.pushEvent(event as unknown as RrwebEvent),
        // Snapshot completo cada 10s → garantiza uno dentro de la ventana de
        // 15s para poder renderizar el frame final (SDD-0036).
        checkoutEveryNms: 10_000,
        // Privacy hardening
        maskAllInputs: true,
        maskTextSelector: "[data-bug-mask]",
        blockSelector: "[data-bug-block]",
        // Performance: no graba estilos inline que ya están en CSS
        inlineStylesheet: false,
        // Sampling razonable
        sampling: {
          mousemove: 50, // throttle a 1 cada 50ms
          scroll: 150,
          input: "last", // solo el último valor (no por cada keystroke)
        },
      });

      this.stopFn = stop ?? null;
      this.installed = true;
    } catch (err) {
      console.error("[bug-rrweb] failed to install:", err);
    }
  }

  uninstall(): void {
    if (this.stopFn) {
      try {
        this.stopFn();
      } catch {
        // ignore
      }
      this.stopFn = null;
    }
    this.installed = false;
    this.buffer = [];
  }

  private pushEvent(event: RrwebEvent): void {
    this.buffer.push(event);

    // Window rolling: descartar eventos > 15s viejos
    const cutoff = Date.now() - WINDOW_MS;
    while (this.buffer.length > 0 && this.buffer[0].timestamp < cutoff) {
      this.buffer.shift();
    }

    // Cap absoluto · si pasaron muchos eventos en <15s
    if (this.buffer.length > MAX_EVENTS) {
      this.buffer.splice(0, this.buffer.length - MAX_EVENTS);
    }
  }

  /**
   * Snapshot del buffer actual. Lo llamamos al submit del bug.
   * Devuelve array nuevo (no comparte ref con el interno).
   */
  getEvents(): RrwebEvent[] {
    return this.buffer.slice();
  }

  /**
   * Serializa el buffer a Blob comprimido (gzip via CompressionStream).
   * Fallback a JSON plain si CompressionStream no disponible (older browsers).
   *
   * @returns { blob, contentType, extension } o null si buffer vacío
   */
  async serializeToBlob(): Promise<{
    blob: Blob;
    contentType: string;
    extension: string;
  } | null> {
    if (this.buffer.length === 0) return null;
    const json = JSON.stringify(this.buffer);

    // gzip si está disponible
    if (typeof CompressionStream !== "undefined") {
      try {
        const stream = new Blob([json], { type: "application/json" })
          .stream()
          .pipeThrough(new CompressionStream("gzip"));
        const blob = await new Response(stream).blob();
        return {
          blob,
          contentType: "application/gzip",
          extension: "json.gz",
        };
      } catch {
        // fallback
      }
    }

    return {
      blob: new Blob([json], { type: "application/json" }),
      contentType: "application/json",
      extension: "json",
    };
  }

  /**
   * Limpia el buffer · usar en tests o post-submit si querés reset.
   */
  reset(): void {
    this.buffer = [];
  }

  _stats() {
    return {
      installed: this.installed,
      eventCount: this.buffer.length,
      oldestTimestamp: this.buffer[0]?.timestamp ?? null,
      newestTimestamp: this.buffer[this.buffer.length - 1]?.timestamp ?? null,
    };
  }
}

// ─────────────────────────────────────────────────────────────
// Singleton
// ─────────────────────────────────────────────────────────────

let instance: BugRrwebCapture | null = null;

export function getBugRrwebCapture(): BugRrwebCapture {
  if (typeof window === "undefined") return new BugRrwebCapture();
  if (!instance) instance = new BugRrwebCapture();
  return instance;
}
