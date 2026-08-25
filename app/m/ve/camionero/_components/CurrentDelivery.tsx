"use client";

/**
 * CurrentDelivery — card del paquete activo (Sprint 3 v3 · plan v3).
 *
 * Render del 1er paquete `pendiente` de la OD con:
 *  - Foto fachada del cliente (flow híbrido 3-caminos)
 *    · Si existe `client_facade_photo_url` → render imagen (signed URL).
 *    · Si NO existe → CTA "Tomar foto fachada" que abre cámara + upload.
 *  - Dirección estructurada · `client_address` + `client_address_reference`.
 *  - Botones Llamar (tel:) + WhatsApp (wa.me/).
 *  - Acciones partial-delivery: Entregado / Rechazado / Retornado.
 *
 * No-emojis · tokens var(--*) · prefers-reduced-motion en uploads.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import {
  tierLabel,
  tierBadgeTone,
  type ClientTier,
} from "@/lib/studio/client-types";
import type { DispatchOrderRow } from "@/lib/studio/dispatch-types";
import {
  partialDeliveryAction,
  uploadFacadePhotoAction,
  type PartialDeliveryStatus,
} from "../actions";

interface Props {
  pkg: DispatchOrderRow["packages"][number];
  odId: string;
  /** Signed URL (10min) generado server-side · o null si no hay foto. */
  facadeSignedUrl: string | null;
  /** Posición 1-N del paquete dentro de la OD. */
  position: number;
  total: number;
  /** Si true, render compacto sin acciones partial-delivery (paquete completado). */
  readOnly?: boolean;
  /** Callback opcional cuando un partial-delivery termina · padre refresca. */
  onRefresh?: () => void;
}

export function CurrentDelivery({
  pkg,
  odId,
  facadeSignedUrl,
  position,
  total,
  readOnly,
  onRefresh,
}: Props) {
  const toast = useToast();
  const [facadeUrl, setFacadeUrl] = useState<string | null>(facadeSignedUrl);
  const [uploadingFacade, setUploadingFacade] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [refusalReason, setRefusalReason] = useState("");
  const [showRefusalInput, setShowRefusalInput] = useState<
    null | "rechazado" | "retornado"
  >(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Si cambia el signed URL desde el padre (después de refresh post-upload),
  // sincronizamos el preview local. setState en effect es intencional: el
  // local state habilita preview optimista pre-refresh.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFacadeUrl(facadeSignedUrl);
  }, [facadeSignedUrl]);

  const tier: ClientTier | null = pkg.client_tier ?? null;
  const phone = pkg.client_phone ?? null;
  const phoneClean = phone ? phone.replace(/[^\d+]/g, "") : null;

  // Sprint 3.6 · navegación. Preferimos coords (precisión GPS); si no hay,
  // usamos la dirección de texto. Google Maps universal URL abre la app
  // nativa (o el chooser con Waze) en Android · cero token/dependencia.
  const navUrl = buildNavUrl(
    pkg.client_lat ?? null,
    pkg.client_lng ?? null,
    pkg.client_address ?? null,
    pkg.city,
  );

  const onFacadeFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (!f || !pkg.markbox) return;
      setUploadingFacade(true);
      try {
        const fd = new FormData();
        fd.append("markbox", pkg.markbox);
        fd.append("photo", f);
        const result = await uploadFacadePhotoAction(fd);
        if (result.error) {
          toast.error(result.error);
          return;
        }
        // Optimistic: setear preview local · próximo refresh trae signed URL real
        setFacadeUrl(URL.createObjectURL(f));
        toast.success("Foto de fachada guardada");
        onRefresh?.();
      } finally {
        setUploadingFacade(false);
        if (fileRef.current) fileRef.current.value = "";
      }
    },
    [pkg.markbox, toast, onRefresh],
  );

  async function handlePartialDelivery(status: PartialDeliveryStatus) {
    setActionError(null);
    if (status !== "entregado" && !refusalReason.trim()) {
      setActionError("El motivo es obligatorio para rechazo/retorno.");
      return;
    }
    const result = await partialDeliveryAction({
      od_id: odId,
      package_id: pkg.package_id,
      status,
      reason: status === "entregado" ? null : refusalReason.trim(),
    });
    if (result.error) {
      setActionError(result.error);
      toast.error(result.error);
      return;
    }
    toast.success(
      status === "entregado"
        ? `${pkg.client_name} entregado`
        : status === "rechazado"
          ? `${pkg.client_name} rechazado`
          : `${pkg.client_name} retornado`,
    );
    setShowRefusalInput(null);
    setRefusalReason("");
    onRefresh?.();
  }

  return (
    <article
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        overflow: "hidden",
      }}
    >
      {/* Header bar (parada 1/N + status) */}
      <header
        style={{
          padding: "10px 12px",
          background: readOnly ? "var(--success-bg)" : "var(--wine-tint)",
          color: readOnly ? "var(--success)" : "var(--wine)",
          font: "800 11px/1 var(--f-mono)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>
          Parada {position}/{total}
        </span>
        {pkg.delivery_status && pkg.delivery_status !== "pendiente" && (
          <Badge
            tone={
              pkg.delivery_status === "entregado"
                ? "success"
                : pkg.delivery_status === "rechazado"
                  ? "danger"
                  : "warning"
            }
            size="sm"
          >
            {pkg.delivery_status}
          </Badge>
        )}
      </header>

      {/* Foto fachada · si existe, render; si no, CTA tomar foto */}
      {facadeUrl ? (
        <div
          style={{
            width: "100%",
            aspectRatio: "16/9",
            background: "var(--bg-elevated)",
            overflow: "hidden",
            position: "relative",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={facadeUrl}
            alt={`Fachada · ${pkg.client_name}`}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
          {!readOnly && (
            <label
              style={{
                position: "absolute",
                bottom: 8,
                right: 8,
                padding: "6px 10px",
                background: "var(--bg-surface)",
                border: "1px solid var(--border-strong)",
                borderRadius: "var(--r-pill)",
                font: "600 11px/1 var(--f-sans)",
                color: "var(--ink-soft)",
                cursor: "pointer",
              }}
            >
              {uploadingFacade ? "Subiendo…" : "Cambiar foto"}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={onFacadeFileChange}
                disabled={uploadingFacade}
                style={{ display: "none" }}
              />
            </label>
          )}
        </div>
      ) : (
        !readOnly && (
          <label
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: 20,
              gap: 8,
              background: "var(--bg-elevated)",
              borderBottom: "1px solid var(--border)",
              cursor: "pointer",
              font: "700 13px/1.2 var(--f-sans)",
              color: "var(--ink-soft)",
            }}
          >
            <svg viewBox="0 0 24 24" width={28} height={28} fill="none">
              <path
                d="M3 7h4l2-3h6l2 3h4v13H3V7z"
                stroke="currentColor"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle
                cx={12}
                cy={13}
                r={4}
                stroke="currentColor"
                strokeWidth={1.6}
              />
            </svg>
            <span>{uploadingFacade ? "Subiendo foto…" : "Tomar foto de fachada"}</span>
            <span
              style={{
                font: "500 11px/1.3 var(--f-sans)",
                color: "var(--ink-soft)",
              }}
            >
              Una sola vez · el próximo viaje ya está
            </span>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={onFacadeFileChange}
              disabled={uploadingFacade}
              style={{ display: "none" }}
            />
          </label>
        )
      )}

      {/* Identidad + tier badge */}
      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <code
            style={{
              font: "700 11px/1 var(--f-mono)",
              color: "var(--wine-text)",
            }}
          >
            {pkg.markbox}
          </code>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: 4,
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                font: "900 16px/1.2 var(--f-display)",
                color: "var(--ink)",
                letterSpacing: "-0.01em",
              }}
            >
              {pkg.client_name}
            </div>
            {tier && (
              <Badge tone={tierBadgeTone(tier)} size="sm">
                {tierLabel(tier)}
              </Badge>
            )}
          </div>
          <div
            style={{
              font: "500 12px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
              marginTop: 4,
            }}
          >
            {pkg.city}
          </div>
        </div>

        {/* Dirección estructurada */}
        {(pkg.client_address || pkg.client_address_reference) && (
          <div
            style={{
              padding: 10,
              background: "var(--bg-elevated)",
              borderRadius: "var(--r-sm)",
            }}
          >
            {pkg.client_address && (
              <div
                style={{
                  font: "600 12.5px/1.4 var(--f-sans)",
                  color: "var(--ink)",
                }}
              >
                {pkg.client_address}
              </div>
            )}
            {pkg.client_address_reference && (
              <div
                style={{
                  font: "500 11.5px/1.4 var(--f-sans)",
                  color: "var(--ink-soft)",
                  marginTop: 4,
                }}
              >
                Referencia: {pkg.client_address_reference}
              </div>
            )}
          </div>
        )}

        {/* Cajas */}
        <div
          style={{
            display: "flex",
            gap: 14,
            font: "700 12px/1 var(--f-mono)",
            color: "var(--ink-soft)",
          }}
        >
          <span>{pkg.boxes_shipped} cj</span>
          <span>{pkg.weight_kg.toFixed(0)} kg</span>
          {pkg.cbm > 0 && <span>{pkg.cbm.toFixed(1)} cbm</span>}
        </div>

        {/* Description */}
        {pkg.description && (
          <div
            style={{
              font: "500 11.5px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
              paddingTop: 6,
              borderTop: "1px dashed var(--border)",
            }}
          >
            {pkg.description}
          </div>
        )}

        {/* Navegar · Sprint 3.6 (botón primario · es lo que el camionero
            más necesita al llegar a la zona) */}
        {navUrl && (
          <a
            href={navUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="studio-btn studio-btn-primary studio-btn-sm"
            style={{ textDecoration: "none", justifyContent: "center" }}
            aria-label={`Navegar a ${pkg.client_name}`}
          >
            {/* Pin / navigation icon */}
            <svg viewBox="0 0 24 24" width={15} height={15} fill="none">
              <path
                d="M3 11l19-9-9 19-2-8-8-2z"
                stroke="currentColor"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span style={{ marginLeft: 6 }}>
              Navegar{pkg.client_lat == null ? " (por dirección)" : ""}
            </span>
          </a>
        )}

        {/* Tel + WhatsApp */}
        {phoneClean && (
          <div style={{ display: "flex", gap: 8 }}>
            <a
              href={`tel:${phoneClean}`}
              className="studio-btn studio-btn-ghost studio-btn-sm"
              style={{ flex: 1, textDecoration: "none" }}
              aria-label={`Llamar a ${pkg.client_name}`}
            >
              <svg viewBox="0 0 24 24" width={14} height={14} fill="none">
                <path
                  d="M22 16.92v3a2 2 0 01-2.18 2 19.86 19.86 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.86 19.86 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13 1.05.37 2.07.72 3.06a2 2 0 01-.45 2.11L8.09 10.91a16 16 0 006 6l2.02-2.29a2 2 0 012.11-.45c.99.35 2.01.59 3.06.72A2 2 0 0122 16.92z"
                  stroke="currentColor"
                  strokeWidth={1.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span style={{ marginLeft: 6 }}>Llamar</span>
            </a>
            <a
              href={`https://wa.me/${phoneClean.replace(/^\+/, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="studio-btn studio-btn-ghost studio-btn-sm"
              style={{ flex: 1, textDecoration: "none" }}
              aria-label={`WhatsApp a ${pkg.client_name}`}
            >
              WhatsApp
            </a>
          </div>
        )}

        {/* Partial delivery actions */}
        {!readOnly &&
          (pkg.delivery_status === "pendiente" || !pkg.delivery_status) && (
            <div
              style={{
                marginTop: 6,
                borderTop: "1px solid var(--border)",
                paddingTop: 12,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div
                className="studio-eyebrow"
                style={{ color: "var(--ink-soft)" }}
              >
                Resultado de la visita
              </div>

              {showRefusalInput && (
                <textarea
                  value={refusalReason}
                  onChange={(e) => setRefusalReason(e.target.value)}
                  placeholder={
                    showRefusalInput === "rechazado"
                      ? "Ej: cliente no estaba · pidió reprogramar"
                      : "Ej: dirección errónea · vuelve a bodega"
                  }
                  rows={2}
                  className="studio-input"
                  style={{ width: "100%", resize: "vertical" }}
                />
              )}

              {actionError && (
                <div
                  role="alert"
                  style={{
                    padding: 8,
                    background: "var(--danger-bg)",
                    color: "var(--danger)",
                    borderRadius: "var(--r-sm)",
                    font: "600 11.5px/1.3 var(--f-sans)",
                  }}
                >
                  {actionError}
                </div>
              )}

              <div style={{ display: "flex", gap: 6 }}>
                {showRefusalInput ? (
                  <>
                    <button
                      type="button"
                      className="studio-btn studio-btn-ghost studio-btn-sm"
                      onClick={() => {
                        setShowRefusalInput(null);
                        setRefusalReason("");
                        setActionError(null);
                      }}
                      style={{ flex: 1 }}
                    >
                      Cancelar
                    </button>
                    <ActionButton
                      variant={showRefusalInput === "rechazado" ? "danger" : "warning"}
                      size="sm"
                      idleLabel={
                        showRefusalInput === "rechazado"
                          ? "Confirmar rechazo"
                          : "Confirmar retorno"
                      }
                      loadingLabel="Guardando…"
                      successLabel="Guardado"
                      disabled={!refusalReason.trim()}
                      onAction={async () => {
                        await handlePartialDelivery(showRefusalInput);
                        return undefined;
                      }}
                    />
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="studio-btn studio-btn-ghost studio-btn-sm"
                      onClick={() => {
                        setShowRefusalInput("retornado");
                        setActionError(null);
                      }}
                      style={{ flex: 1 }}
                    >
                      Retornar
                    </button>
                    <button
                      type="button"
                      className="studio-btn studio-btn-ghost studio-btn-sm"
                      onClick={() => {
                        setShowRefusalInput("rechazado");
                        setActionError(null);
                      }}
                      style={{ flex: 1, color: "var(--danger)" }}
                    >
                      Rechazar
                    </button>
                    <ActionButton
                      variant="primary"
                      size="sm"
                      idleLabel="Entregado"
                      loadingLabel="Guardando…"
                      successLabel="Entregado"
                      onAction={async () => {
                        await handlePartialDelivery("entregado");
                        return undefined;
                      }}
                    />
                  </>
                )}
              </div>
            </div>
          )}
      </div>
    </article>
  );
}

/**
 * Construye la URL de navegación. Prioridad:
 *  1. coords GPS (precisión exacta) → destination=lat,lng
 *  2. dirección de texto + ciudad → destination=URLencoded
 *  3. null si no hay nada que navegar
 *
 * Google Maps universal URL (`/maps/dir/?api=1`) abre la app nativa de
 * Maps en móvil, o el chooser (Waze/Maps) si el SO lo permite. Cero token.
 */
function buildNavUrl(
  lat: number | null,
  lng: number | null,
  address: string | null,
  city: string,
): string | null {
  const base = "https://www.google.com/maps/dir/?api=1&destination=";
  if (lat != null && lng != null) {
    return `${base}${lat},${lng}`;
  }
  const text = [address?.trim(), city?.trim()].filter(Boolean).join(", ");
  if (text) {
    return `${base}${encodeURIComponent(text)}`;
  }
  return null;
}
