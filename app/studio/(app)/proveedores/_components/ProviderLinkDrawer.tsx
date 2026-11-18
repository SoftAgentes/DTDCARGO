"use client";

/**
 * ProviderLinkDrawer — el equipo gestiona el link público del proveedor
 * (/p/{token}) de UNA compra desde el Studio (SDD-0096 · PORT-4): copiar,
 * compartir por WhatsApp y ACTIVAR/DESACTIVAR (revocar) el enlace.
 *
 * El toggle va por `setPrealertaShareActiveAction` (RPC hardened). El estado
 * activo/desactivado necesita la migr 0225 aplicada; sin ella, el toggle devuelve
 * un error legible y el link se muestra como activo (defensivo).
 */

import { useActionState, useState, useSyncExternalStore } from "react";
import { DrawerShell } from "@/app/studio/_components/ui/drawer/DrawerShell";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { Aviso } from "@/app/studio/_components/ui/Aviso";
import { Icon } from "@/app/studio/_components/icons";
import {
  setPrealertaShareActiveAction,
  type ShareLinkState,
} from "../actions";

const label: React.CSSProperties = {
  font: "700 10px/1 var(--f-sans)",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--ink-soft)",
  marginBottom: 6,
  display: "block",
};

export function ProviderLinkDrawer({
  prealertaId,
  code,
  shareToken,
  clientMarkbox,
  supplierName,
  initialActive,
  onClose,
}: {
  prealertaId: string;
  code: string;
  shareToken: string | null;
  clientMarkbox: string;
  supplierName: string | null;
  initialActive: boolean;
  onClose: () => void;
}) {
  const origin = useSyncExternalStore(
    () => () => undefined,
    () => window.location.origin,
    () => "",
  );
  const [copied, setCopied] = useState(false);
  const [active, setActive] = useState(initialActive);
  const [state, formAction, pending] = useActionState<ShareLinkState, FormData>(
    setPrealertaShareActiveAction,
    {},
  );

  const [handledState, setHandledState] = useState(state);
  if (handledState !== state) {
    setHandledState(state);
    if (state.ok && typeof state.active === "boolean") setActive(state.active);
  }

  const url = origin && shareToken ? `${origin}/p/${shareToken}` : "";
  const waText = `我的货物标签和收货地址 / Etiquetas y dirección de mi pedido: ${url}`;
  const waLink = `https://wa.me/?text=${encodeURIComponent(waText)}`;

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard no disponible — el link está visible para copiar a mano */
    }
  }

  return (
    <DrawerShell
      title="Link del proveedor"
      subtitle={`Compra ${code} · cliente ${clientMarkbox}`}
      onClose={onClose}
      pending={pending}
      width={520}
    >
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 22px" }}>
        {supplierName && (
          <div style={{ marginBottom: 18 }}>
            <span style={label}>Proveedor</span>
            <div style={{ font: "600 13px/1.3 var(--f-sans)", color: "var(--ink)" }}>
              {supplierName}
            </div>
          </div>
        )}

        {/* Estado del link */}
        <div style={{ marginBottom: 18 }}>
          <span style={label}>Estado</span>
          {active ? (
            <Badge tone="success" size="md">
              Activo
            </Badge>
          ) : (
            <Badge tone="danger" size="md">
              Desactivado
            </Badge>
          )}
          <p
            style={{
              font: "500 11.5px/1.5 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: "8px 0 0",
            }}
          >
            {active
              ? "El proveedor puede abrir el enlace y enviar su packing list."
              : "El enlace está revocado: el proveedor ve una página no encontrada."}
          </p>
        </div>

        {/* URL + copiar/WhatsApp (solo si está activo y hay token) */}
        {shareToken ? (
          <div style={{ marginBottom: 20 }}>
            <span style={label}>Enlace</span>
            <div
              style={{
                font: "500 11.5px/1.5 var(--f-mono)",
                color: active ? "var(--ink)" : "var(--ink-soft)",
                background: "var(--bg-elevated)",
                borderRadius: "var(--r-sm)",
                padding: "9px 11px",
                wordBreak: "break-all",
                textDecoration: active ? "none" : "line-through",
              }}
            >
              {url || `…/p/${shareToken}`}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => void copy()}
                disabled={!url || !active}
                className="studio-btn studio-btn-ghost"
              >
                {copied ? "¡Copiado!" : "Copiar link"}
              </button>
              <a
                href={url && active ? waLink : undefined}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={!url || !active}
                className="studio-btn studio-btn-ghost"
                style={
                  url && active
                    ? { display: "inline-flex", alignItems: "center", gap: 6 }
                    : {
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        opacity: 0.5,
                        pointerEvents: "none",
                      }
                }
              >
                {Icon.external(13)} Enviar por WhatsApp
              </a>
            </div>
          </div>
        ) : (
          <p
            style={{
              font: "500 12px/1.5 var(--f-sans)",
              color: "var(--ink-soft)",
              marginBottom: 20,
            }}
          >
            Esta compra no tiene enlace de proveedor generado.
          </p>
        )}

        {/* Toggle activar/desactivar */}
        {shareToken && (
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 18 }}>
            <form action={formAction}>
              <input type="hidden" name="prealerta_id" value={prealertaId} />
              <input type="hidden" name="active" value={active ? "false" : "true"} />
              <button
                type="submit"
                disabled={pending}
                className={`studio-btn ${
                  active ? "studio-btn-ghost" : "studio-btn-primary"
                }`}
                style={
                  active
                    ? { color: "var(--danger)", borderColor: "var(--danger)" }
                    : undefined
                }
              >
                {pending
                  ? "Guardando…"
                  : active
                    ? "Desactivar link"
                    : "Reactivar link"}
              </button>
              <p
                style={{
                  font: "500 11px/1.5 var(--f-sans)",
                  color: "var(--ink-soft)",
                  margin: "8px 0 0",
                }}
              >
                {active
                  ? "Desactívalo si el link se filtró o el proveedor ya no debe usarlo. Puedes reactivarlo cuando quieras."
                  : "Reactívalo para que el proveedor vuelva a poder usar el mismo enlace."}
              </p>
              {state.error && (
                <div style={{ marginTop: 12 }}>
                  <Aviso tono="error" compacto>
                    {state.error}
                  </Aviso>
                </div>
              )}
            </form>
          </div>
        )}
      </div>
    </DrawerShell>
  );
}
