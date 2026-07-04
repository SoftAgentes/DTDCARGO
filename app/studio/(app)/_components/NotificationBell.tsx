"use client";

/**
 * NotificationBell · campanita in-app del Studio (SDD-0036 Fase 5).
 *
 * Lee el outbox `bug_notifications` del user (RLS lo scopea a auth.uid()),
 * muestra un badge de no-leídos y un dropdown con las últimas notifs. La
 * data inicial la trae el layout (server); `useRealtimeTable` la mantiene
 * viva vía Supabase Realtime (la tabla está en la publicación).
 *
 * Marcar leído: al abrir el dropdown se marca todo lo no-leído
 * (`markBugNotificationsReadAction`). Optimista via `locallyRead` para que
 * el badge baje al instante; el UPDATE de realtime reconcilia `read_at`.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "../../_components/icons";
import { useRealtimeTable } from "@/lib/studio/hooks/use-realtime-table";
import { useT, useLocale } from "@/lib/i18n";
import { markBugNotificationsReadAction } from "../bugs/actions";
import { createClient } from "@/lib/db/client";
import type { BugNotification } from "@/lib/studio/bug-types";

interface NotificationBellProps {
  userId: string;
  initial: BugNotification[];
}

function payloadStr(
  payload: Record<string, unknown>,
  key: string,
): string | null {
  const v = payload?.[key];
  return typeof v === "string" && v.length > 0 ? v : null;
}

/**
 * Beep sutil de notificación (WebAudio, ~0.2s, volumen bajo). Sin asset:
 * un oscilador seno con envolvente rápida. Best-effort: si el navegador
 * bloquea el AudioContext (sin gesture del usuario aún) o no lo soporta,
 * queda en silencio sin romper nada.
 */
function playNotifSound(): void {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.05, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.2);
    osc.onended = () => void ctx.close();
  } catch {
    // WebAudio no disponible / bloqueado → silencio.
  }
}

/** Tiempo relativo compacto según locale (es-VE / zh-CN) vía Intl. */
function relativeTime(iso: string, locale: string): string {
  const diffSec = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (abs < 60) return rtf.format(diffSec, "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  return rtf.format(Math.round(diffSec / 86400), "day");
}

export function NotificationBell({ userId, initial }: NotificationBellProps) {
  const t = useT();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [locallyRead, setLocallyRead] = useState<Set<string>>(new Set());
  // Sonido: conservador (default OFF) — solo suena si el user tiene fila de
  // prefs con sound_enabled=true. Sin fila = sin beep (no sorprende a todos).
  const [soundEnabled, setSoundEnabled] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const { data } = useRealtimeTable<BugNotification>({
    table: "bug_notifications",
    filter: `user_id=eq.${userId}`,
    initial,
  });

  // Newest first (defensivo, independiente del orden que devuelva el hook).
  const items = useMemo(
    () =>
      [...data].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    [data],
  );

  const unreadCount = useMemo(
    () => items.filter((n) => !n.read_at && !locallyRead.has(n.id)).length,
    [items, locallyRead],
  );

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Cargar el pref de sonido (conservador: sin fila → off).
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
          .from("user_notification_prefs")
          .select("sound_enabled")
          .eq("user_id", user.id)
          .maybeSingle<{ sound_enabled: boolean }>();
        if (active && data?.sound_enabled === true) setSoundEnabled(true);
      } catch {
        // best-effort: sin sonido si falla la lectura.
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Beep al LLEGAR una notif nueva por realtime — NO en el snapshot inicial
  // ni al marcar leído. Detecta ids nuevos no-leídos contra lo ya conocido.
  const knownIds = useRef<Set<string>>(new Set());
  const soundArmed = useRef(false);
  useEffect(() => {
    const ids = new Set(items.map((n) => n.id));
    if (!soundArmed.current) {
      knownIds.current = ids;
      soundArmed.current = true;
      return;
    }
    const hasNewUnread = items.some(
      (n) => !knownIds.current.has(n.id) && !n.read_at,
    );
    knownIds.current = ids;
    if (hasNewUnread && soundEnabled) playNotifSound();
  }, [items, soundEnabled]);

  const markAllRead = () => {
    const unreadIds = items
      .filter((n) => !n.read_at && !locallyRead.has(n.id))
      .map((n) => n.id);
    if (unreadIds.length === 0) return;
    setLocallyRead((prev) => {
      const next = new Set(prev);
      unreadIds.forEach((id) => next.add(id));
      return next;
    });
    // Best-effort: el UPDATE de realtime reconcilia read_at en `data`.
    void markBugNotificationsReadAction(unreadIds);
  };

  const markOneRead = (id: string) => {
    if (locallyRead.has(id)) return;
    setLocallyRead((prev) => new Set(prev).add(id));
    void markBugNotificationsReadAction([id]);
  };

  // NO marcamos al abrir a propósito: así el resaltado de no-leídas es visible
  // mientras el panel está abierto y el botón "marcar todas" queda alcanzable.
  // Se marca por-ítem al hacer click, o todas con el botón.
  const handleToggle = () => setOpen((v) => !v);

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        onClick={handleToggle}
        title={t("chrome.topbar.notifications")}
        aria-label={
          unreadCount > 0
            ? `${t("chrome.topbar.notifications")} · ${t(
                "chrome.notifications.unread_aria",
                { count: unreadCount },
              )}`
            : t("chrome.topbar.notifications")
        }
        aria-expanded={open}
        style={{
          position: "relative",
          width: 36,
          height: 36,
          borderRadius: "var(--r-md)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--ink-soft)",
          background: open ? "var(--bg-elevated)" : "transparent",
          cursor: "pointer",
          transition: "background var(--dur-fast) var(--ease)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--bg-elevated)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = open
            ? "var(--bg-elevated)"
            : "transparent";
        }}
      >
        {Icon.bell(16)}
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              top: 4,
              right: 3,
              minWidth: 16,
              height: 16,
              padding: "0 4px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 8,
              background: "var(--danger)",
              color: "var(--ink-inv)",
              font: "800 9px/1 var(--f-mono)",
              boxShadow: "0 0 0 2px var(--bg-surface)",
              pointerEvents: "none",
            }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: 340,
            maxHeight: 440,
            display: "flex",
            flexDirection: "column",
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
            boxShadow: "var(--shadow-lg)",
            zIndex: 70,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 14px",
              borderBottom: "1px solid var(--border)",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                font: "800 13px/1 var(--f-display)",
                color: "var(--ink)",
              }}
            >
              {t("chrome.notifications.title")}
            </span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                style={{
                  font: "600 11px/1 var(--f-sans)",
                  color: "var(--ink-soft)",
                  background: "transparent",
                  cursor: "pointer",
                  padding: "3px 6px",
                  borderRadius: "var(--r-sm)",
                }}
              >
                {t("chrome.notifications.mark_all_read")}
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <div
              style={{
                padding: "28px 16px",
                textAlign: "center",
                font: "500 12.5px/1.4 var(--f-sans)",
                color: "var(--ink-soft)",
              }}
            >
              {t("chrome.notifications.empty")}
            </div>
          ) : (
            <div style={{ overflowY: "auto" }}>
              {items.map((n) => {
                const label =
                  payloadStr(n.payload, "label") ?? n.type;
                const folio = payloadStr(n.payload, "folio");
                const excerpt = payloadStr(n.payload, "excerpt");
                const url = payloadStr(n.payload, "url") ?? "/studio/bugs";
                const unread = !n.read_at && !locallyRead.has(n.id);
                return (
                  <Link
                    key={n.id}
                    href={url}
                    onClick={() => {
                      markOneRead(n.id);
                      setOpen(false);
                    }}
                    style={{
                      display: "block",
                      padding: "10px 14px",
                      borderBottom: "1px solid var(--border)",
                      background: unread ? "var(--bg-elevated)" : "transparent",
                      textDecoration: "none",
                      transition: "background var(--dur-fast) var(--ease)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "var(--bg-elevated)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = unread
                        ? "var(--bg-elevated)"
                        : "transparent";
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "baseline",
                        gap: 6,
                      }}
                    >
                      {unread && (
                        <span
                          aria-hidden="true"
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: "var(--danger)",
                            flexShrink: 0,
                            transform: "translateY(-1px)",
                          }}
                        />
                      )}
                      <span
                        style={{
                          flex: 1,
                          font: `${unread ? 700 : 500} 12.5px/1.35 var(--f-sans)`,
                          color: "var(--ink)",
                        }}
                      >
                        {label}
                      </span>
                    </div>
                    {excerpt && (
                      <div
                        style={{
                          marginTop: 2,
                          font: "500 11.5px/1.4 var(--f-sans)",
                          color: "var(--ink-soft)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {excerpt}
                      </div>
                    )}
                    <div
                      style={{
                        marginTop: 3,
                        display: "flex",
                        gap: 8,
                        font: "600 10.5px/1 var(--f-mono)",
                        color: "var(--ink-mute)",
                      }}
                    >
                      {folio && <span>{folio}</span>}
                      <span>{relativeTime(n.created_at, locale)}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
