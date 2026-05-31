/**
 * Bug Tech Capture · auto-captura técnica para el Bug Reporter
 * (SDD-0036 Fase 4 · CRITICAL SECURITY).
 *
 * Singleton client-side que mantiene buffers rolling de:
 *   - Console errors (últimos 3)
 *   - Network requests (últimos 5)
 *
 * Listeners instalados al `install()`:
 *   - window.addEventListener("error", …)            → console_logs
 *   - window.addEventListener("unhandledrejection", …) → console_logs
 *   - monkey-patch window.fetch                       → network_requests
 *   - monkey-patch XMLHttpRequest.prototype.open/send → network_requests
 *
 * Todo lo que entra al buffer pasa por `bug-sanitizer.ts` PRIMERO
 * (defense in depth). El sanitizer redacta tokens, JWTs, Bearer,
 * Stripe/AWS/GitHub keys, y query params sensibles.
 *
 * Patrón singleton: una sola instancia global accesible vía
 * `getBugTechCapture()`. Provider la monta una vez en
 * `app/studio/(app)/layout.tsx`.
 *
 * `getSnapshot()` retorna copia inmutable del estado actual + environment
 * (browser, OS, viewport, locale, tz). Llamar al submit del BugReportModal.
 *
 * NO incluye rrweb session replay (Fase 4.5 follow-up). Con solo console +
 * network ya cubrimos ~80% del valor diagnóstico de la mayoría de bugs.
 *
 * D3 cumplida: capture es invisible al user. No hay UI, no hay opt-in.
 */

import {
  redactConsoleEntry,
  redactNetworkEntry,
  redactTokensInText,
  redactUrl,
} from "./bug-sanitizer";
import type {
  BugConsoleLogEntry,
  BugEnvironment,
  BugNetworkRequestEntry,
} from "./bug-types";

const MAX_CONSOLE_LOGS = 3;
const MAX_NETWORK_REQUESTS = 5;

// Network requests con duración mayor a esto se loguean igual pero con flag
const SLOW_REQUEST_MS = 3000;

class BugTechCapture {
  private consoleBuffer: BugConsoleLogEntry[] = [];
  private networkBuffer: BugNetworkRequestEntry[] = [];

  private installed = false;
  private originalFetch: typeof globalThis.fetch | null = null;
  private originalXhrOpen: typeof XMLHttpRequest.prototype.open | null = null;
  private originalXhrSend: typeof XMLHttpRequest.prototype.send | null = null;
  private errorListener: ((e: ErrorEvent) => void) | null = null;
  private rejectionListener: ((e: PromiseRejectionEvent) => void) | null = null;

  /**
   * Monta listeners. Idempotente · llamar más de una vez es safe.
   */
  install(): void {
    if (this.installed || typeof window === "undefined") return;
    this.installed = true;

    // Listener: errores no capturados (sync)
    this.errorListener = (e: ErrorEvent) => {
      this.pushConsole({
        level: "error",
        message: redactTokensInText(String(e.message ?? "Error sin mensaje")),
        stack: e.error?.stack ? redactStackInternal(e.error.stack) : undefined,
        ts: new Date().toISOString(),
      });
    };
    window.addEventListener("error", this.errorListener);

    // Listener: promise rejections sin catch
    this.rejectionListener = (e: PromiseRejectionEvent) => {
      const reason = e.reason;
      const message =
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : safeStringify(reason);
      this.pushConsole({
        level: "error",
        message: `Promise rejection: ${redactTokensInText(message)}`,
        stack:
          reason instanceof Error && reason.stack
            ? redactStackInternal(reason.stack)
            : undefined,
        ts: new Date().toISOString(),
      });
    };
    window.addEventListener("unhandledrejection", this.rejectionListener);

    // Monkey-patch fetch
    this.originalFetch = globalThis.fetch.bind(globalThis);
    const capturedFetch = this.originalFetch;
    globalThis.fetch = async (input, init) => {
      const start = performance.now();
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      const method = (init?.method ?? "GET").toUpperCase();

      try {
        const res = await capturedFetch(input, init);
        this.pushNetwork({
          url,
          method,
          status: res.status,
          ms: Math.round(performance.now() - start),
          ts: new Date().toISOString(),
        });
        return res;
      } catch (err) {
        this.pushNetwork({
          url,
          method,
          status: 0, // failed (network error, CORS, abort)
          ms: Math.round(performance.now() - start),
          ts: new Date().toISOString(),
        });
        throw err;
      }
    };

    // Monkey-patch XMLHttpRequest
    this.originalXhrOpen = XMLHttpRequest.prototype.open;
    this.originalXhrSend = XMLHttpRequest.prototype.send;
    // Capturamos métodos como locales (en vez de aliasar `this`) porque dentro
    // de los overrides de XHR `this` es la instancia XMLHttpRequest, no el manager.
    const originalXhrOpen = this.originalXhrOpen;
    const originalXhrSend = this.originalXhrSend;
    const pushNetwork = this.pushNetwork.bind(this);
    XMLHttpRequest.prototype.open = function (
      this: XMLHttpRequest & { __bugCapture?: { url: string; method: string; start: number } },
      method: string,
      url: string | URL,
      ...rest: unknown[]
    ) {
      this.__bugCapture = {
        url: typeof url === "string" ? url : url.toString(),
        method: method.toUpperCase(),
        start: performance.now(),
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (originalXhrOpen as any).call(this, method, url, ...rest);
    };

    XMLHttpRequest.prototype.send = function (
      this: XMLHttpRequest & { __bugCapture?: { url: string; method: string; start: number } },
      body?: Document | XMLHttpRequestBodyInit | null,
    ) {
      const meta = this.__bugCapture;
      if (meta) {
        const onDone = () => {
          pushNetwork({
            url: meta.url,
            method: meta.method,
            status: this.status,
            ms: Math.round(performance.now() - meta.start),
            ts: new Date().toISOString(),
          });
          this.removeEventListener("loadend", onDone);
        };
        this.addEventListener("loadend", onDone);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (originalXhrSend as any).call(this, body);
    };
  }

  /**
   * Restaura el estado original. Llamar en unmount del provider.
   */
  uninstall(): void {
    if (!this.installed || typeof window === "undefined") return;
    this.installed = false;

    if (this.errorListener) window.removeEventListener("error", this.errorListener);
    if (this.rejectionListener)
      window.removeEventListener("unhandledrejection", this.rejectionListener);

    if (this.originalFetch) globalThis.fetch = this.originalFetch;
    if (this.originalXhrOpen) XMLHttpRequest.prototype.open = this.originalXhrOpen;
    if (this.originalXhrSend) XMLHttpRequest.prototype.send = this.originalXhrSend;

    this.errorListener = null;
    this.rejectionListener = null;
    this.originalFetch = null;
    this.originalXhrOpen = null;
    this.originalXhrSend = null;
  }

  /**
   * Inserta un entry al buffer de consola con rolling FIFO (max 3).
   * Sanitiza antes de guardar (defense in depth, aunque ya viene
   * sanitizado por los listeners).
   */
  private pushConsole(entry: BugConsoleLogEntry): void {
    const sanitized = redactConsoleEntry(entry);
    this.consoleBuffer.push(sanitized);
    if (this.consoleBuffer.length > MAX_CONSOLE_LOGS) {
      this.consoleBuffer.shift();
    }
  }

  /**
   * Inserta un entry al buffer de network con rolling FIFO (max 5).
   * Sanitiza URL antes de guardar.
   */
  private pushNetwork(entry: BugNetworkRequestEntry): void {
    const sanitized = redactNetworkEntry(entry);
    this.networkBuffer.push(sanitized);
    if (this.networkBuffer.length > MAX_NETWORK_REQUESTS) {
      this.networkBuffer.shift();
    }
  }

  /**
   * Captura manual desde código (útil para errores controlados que el
   * try/catch normalmente come). Sanitiza antes de pushear.
   */
  captureError(message: string, stack?: string): void {
    this.pushConsole({
      level: "error",
      message: redactTokensInText(message),
      stack: stack ? redactStackInternal(stack) : undefined,
      ts: new Date().toISOString(),
    });
  }

  /**
   * Snapshot inmutable del estado actual. Llamar al submit del modal.
   * Re-sanitiza al copiar (triple defense in depth).
   */
  getSnapshot(): {
    console_logs: BugConsoleLogEntry[];
    network_requests: BugNetworkRequestEntry[];
    environment: BugEnvironment;
  } {
    const console_logs = this.consoleBuffer.map((e) => redactConsoleEntry(e));
    const network_requests = this.networkBuffer.map((e) => redactNetworkEntry(e));
    const environment = buildEnvironmentSnapshot();
    return { console_logs, network_requests, environment };
  }

  /**
   * Limpia los buffers (test / reset). NO uninstala listeners.
   */
  reset(): void {
    this.consoleBuffer = [];
    this.networkBuffer = [];
  }

  /**
   * Para tests: estado interno.
   */
  _stats() {
    return {
      installed: this.installed,
      consoleCount: this.consoleBuffer.length,
      networkCount: this.networkBuffer.length,
    };
  }
}

// ─────────────────────────────────────────────────────────────
// Singleton + helpers
// ─────────────────────────────────────────────────────────────

let instance: BugTechCapture | null = null;

/**
 * Devuelve (o crea) la instancia singleton. Safe en SSR (devuelve un
 * objeto noop si window no existe).
 */
export function getBugTechCapture(): BugTechCapture {
  if (typeof window === "undefined") {
    // SSR-safe: devolvemos un stub que no instala nada
    return new BugTechCapture();
  }
  if (!instance) {
    instance = new BugTechCapture();
  }
  return instance;
}

/**
 * Construye snapshot del environment del browser. Sin información
 * personalmente identificable (no nombre, no email, no IP).
 */
export function buildEnvironmentSnapshot(): BugEnvironment {
  if (typeof window === "undefined") return {};
  const ua = navigator.userAgent;
  const browser = parseBrowserFromUA(ua);
  return {
    browser: browser.name,
    browser_version: browser.version,
    os: parseOSFromUA(ua),
    viewport: { w: window.innerWidth, h: window.innerHeight },
    locale: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

// ─────────────────────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────────────────────

function redactStackInternal(stack: string): string {
  // Reusa redactStack del sanitizer pero garantiza string (no undefined)
  // para tipos del callsite. Import directo evita ciclo.
  let out = redactTokensInText(stack);
  out = out.replace(/https?:\/\/[^\s'"<>)]+/g, (m) => redactUrl(m));
  return out;
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function parseBrowserFromUA(ua: string): { name: string; version: string } {
  // Heurística simple · suficiente para debug, no es analytics
  const matches: Array<[string, RegExp]> = [
    ["Edge", /Edg\/([\d.]+)/],
    ["Chrome", /Chrome\/([\d.]+)/],
    ["Firefox", /Firefox\/([\d.]+)/],
    ["Safari", /Version\/([\d.]+).*Safari/],
  ];
  for (const [name, re] of matches) {
    const m = ua.match(re);
    if (m) return { name, version: m[1] };
  }
  return { name: "Unknown", version: "" };
}

function parseOSFromUA(ua: string): string {
  if (/Windows NT 10/.test(ua)) return "Windows 10/11";
  if (/Windows/.test(ua)) return "Windows";
  if (/Mac OS X/.test(ua)) return "macOS";
  if (/Android/.test(ua)) return "Android";
  if (/iPhone|iPad/.test(ua)) return "iOS";
  if (/Linux/.test(ua)) return "Linux";
  return "Unknown";
}
