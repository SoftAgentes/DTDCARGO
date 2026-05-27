"use client";

/**
 * BugReplayPlayer · reproduce el rrweb replay del bug en el drawer admin.
 *
 * Flujo:
 *   1. Botón "Reproducir replay" (load on demand · evita cargar rrweb-player
 *      bundle 200KB+ en cada drawer open).
 *   2. Fetch /api/studio/bugs/[id]/replay → signed URL (TTL 10 min).
 *   3. Download blob → si gzipped, descomprime via DecompressionStream.
 *   4. Parse JSON events → mount rrweb-player en un div ref.
 *
 * Player imperativo de rrweb (Svelte component compilado). Lo importamos
 * dinámicamente y montamos con `new rrwebPlayer({ target, props })`.
 *
 * Privacy: el replay ya viene sanitizado del client (maskAllInputs ON +
 * data-bug-mask + data-bug-block respetados).
 */

import { useEffect, useRef, useState } from "react";

interface Props {
  bugId: string;
}

interface ReplayInstance {
  $destroy?: () => void;
}

// Tipo mínimo del constructor de rrweb-player · evita depender de tipos
// internos que cambian entre versiones.
type RrwebPlayerCtor = new (opts: {
  target: HTMLElement;
  props: {
    events: unknown[];
    width?: number;
    height?: number;
    autoPlay?: boolean;
    showController?: boolean;
  };
}) => ReplayInstance;

export function BugReplayPlayer({ bugId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<ReplayInstance | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cleanup al unmount
  useEffect(() => {
    return () => {
      const p = playerRef.current;
      if (p && typeof p.$destroy === "function") {
        try {
          p.$destroy();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const load = async () => {
    if (loading || loaded) return;
    setLoading(true);
    setError(null);

    try {
      // 1. Signed URL
      const sigRes = await fetch(`/api/studio/bugs/${bugId}/replay`);
      const sig: {
        signed_url?: string;
        error?: string;
        is_gzipped?: boolean;
      } = await sigRes.json();
      if (!sigRes.ok || !sig.signed_url) {
        throw new Error(sig.error || `HTTP ${sigRes.status}`);
      }

      // 2. Download + decompress
      const blobRes = await fetch(sig.signed_url);
      if (!blobRes.ok) {
        throw new Error(`Download HTTP ${blobRes.status}`);
      }
      let text: string;
      if (sig.is_gzipped && typeof DecompressionStream !== "undefined") {
        const stream = blobRes.body?.pipeThrough(
          new DecompressionStream("gzip"),
        );
        if (!stream) throw new Error("No se pudo descomprimir el replay.");
        text = await new Response(stream).text();
      } else {
        text = await blobRes.text();
      }

      // 3. Parse events
      const events = JSON.parse(text) as unknown[];
      if (!Array.isArray(events) || events.length === 0) {
        throw new Error("Replay vacío.");
      }

      // 4. Mount rrweb-player (Svelte compilado, mount imperativo).
      // El package no expone tipos completos · castamos al ctor mínimo
      // que necesitamos.
      const rrwebPlayerModule = (await import("rrweb-player")) as {
        default: RrwebPlayerCtor;
      };
      await import("rrweb-player/dist/style.css");
      const RrwebPlayer = rrwebPlayerModule.default;

      if (!containerRef.current) {
        throw new Error("Container ref no disponible.");
      }

      // Clear container por si re-mount
      containerRef.current.innerHTML = "";

      playerRef.current = new RrwebPlayer({
        target: containerRef.current,
        props: {
          events,
          width: 720,
          height: 400,
          autoPlay: false,
          showController: true,
        },
      });

      setLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {!loaded && (
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="studio-btn studio-btn-ghost studio-btn-sm"
          style={{ alignSelf: "flex-start" }}
        >
          {loading ? "Cargando replay…" : "Reproducir replay (30s)"}
        </button>
      )}
      {error && (
        <p
          style={{
            color: "var(--danger)",
            fontSize: 12,
            fontFamily: "var(--font-mono, monospace)",
            margin: 0,
          }}
        >
          {error}
        </p>
      )}
      <div
        ref={containerRef}
        style={{
          minHeight: loaded ? 400 : 0,
          background: loaded ? "var(--bg-elevated)" : "transparent",
          borderRadius: 6,
          overflow: "hidden",
        }}
      />
    </div>
  );
}
