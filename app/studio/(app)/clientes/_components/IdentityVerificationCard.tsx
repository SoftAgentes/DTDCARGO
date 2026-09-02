"use client";

/**
 * IdentityVerificationCard — cotejo manual de identidad (SDD-0331).
 *
 * Herramienta interna/CRM: el asesor coteja el nombre cargado contra la foto
 * privada del documento y registra un resultado advisory. No envía cédulas,
 * RIF ni nombres a registros o proveedores externos.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { Icon } from "@/app/studio/_components/icons";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import {
  docVerifyBadge,
  docVerifySourceLabel,
  type DocVerifyStatus,
  type DocVerifySource,
} from "@/lib/studio/client-types";
import { markIdentityAction } from "../actions";

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-VE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export function IdentityVerificationCard({
  clientId,
  markbox,
  name,
  docVerifyStatus,
  docVerifySource,
  docRegistryName,
  docVerifiedAt,
  photoUrl,
}: {
  clientId: string;
  markbox: string;
  name: string;
  docVerifyStatus: DocVerifyStatus | null;
  docVerifySource: DocVerifySource | null;
  docRegistryName: string | null;
  docVerifiedAt: string | null;
  /** Signed URL (60s) de la foto de cédula/RIF, o null si no hay. */
  photoUrl: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [expanded, setExpanded] = useState(false);

  const badge = docVerifyBadge(docVerifyStatus);
  const showRegistry = docRegistryName && docRegistryName.trim().length > 0;

  return (
    <section
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        padding: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
          marginBottom: 6,
        }}
      >
        <span className="studio-eyebrow">Verificación de identidad</span>
        <Badge tone={badge.tone} size="md">
          {badge.label}
        </Badge>
      </div>

      <p
        style={{
          font: "500 12px/1.5 var(--f-sans)",
          color: "var(--ink-soft)",
          margin: "0 0 14px",
        }}
      >
        Cotejo visual interno contra la foto privada del documento. Es
        informativo — no afecta el acceso del cliente.
      </p>

      {/* Foto del documento (cotejo visual) */}
      <div style={{ marginBottom: 14 }}>
        <div className="studio-eyebrow" style={{ marginBottom: 8 }}>
          Documento
        </div>
        {photoUrl ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            title={expanded ? "Achicar documento" : "Ampliar documento"}
            aria-label={expanded ? "Achicar documento" : "Ampliar documento"}
            className="studio-doc-thumb"
            style={{
              position: "relative",
              display: "block",
              width: expanded ? "100%" : 160,
              aspectRatio: "16/10",
              padding: 0,
              border: "1px solid var(--border)",
              borderRadius: "var(--r-md)",
              overflow: "hidden",
              background: "var(--bg-elevated)",
              cursor: "pointer",
              transition: "width 0.16s ease, box-shadow 0.16s ease",
            }}
          >
            {/* Signed URL de bucket privado → <img> (no <Image>: el path /sign/
                no entra en remotePatterns /object/public/**). Patrón del Studio.
                Compacto: cover (recuadro lleno). Ampliado: contain para no
                recortar documentos verticales (RIF A4) en el cotejo. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoUrl}
              alt={`Documento de identidad · ${name}`}
              style={{
                width: "100%",
                height: "100%",
                objectFit: expanded ? "contain" : "cover",
                display: "block",
              }}
            />
            {/* Affordance persistente: comunica que el thumbnail se amplía. */}
            <span
              style={{
                position: "absolute",
                right: 6,
                bottom: 6,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "3px 6px",
                borderRadius: "var(--r-sm)",
                background: "var(--bg-sidebar)",
                color: "var(--ink-side)",
                font: "600 10px/1 var(--f-sans)",
                letterSpacing: "0.04em",
                pointerEvents: "none",
              }}
            >
              {Icon.search(11)}
              {expanded ? "Achicar" : "Ampliar"}
            </span>
          </button>
        ) : (
          <p
            style={{
              font: "500 12.5px/1.5 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: 0,
              padding: "14px 16px",
              border: "1px dashed var(--border)",
              borderRadius: "var(--r-md)",
              background: "var(--bg-elevated)",
            }}
          >
            Sin foto de documento cargada.
          </p>
        )}
      </div>

      {/* Cotejo de nombres · conserva resultados históricos sin nuevas consultas. */}
      <div className="studio-eyebrow" style={{ marginBottom: 8 }}>
        Cotejo de nombres
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          marginBottom: 14,
        }}
      >
        <NameRow label="Nombre cargado" value={name} />
        {showRegistry ? (
          <NameRow
            label="Nombre registrado previamente"
            value={docRegistryName!}
            highlight={docVerifyStatus === "mismatch"}
          />
        ) : (
          <NameRow label="Nombre registrado previamente" value={null} />
        )}
      </div>

      {docVerifiedAt && (
        <p
          style={{
            font: "500 11.5px/1.4 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: "0 0 14px",
          }}
        >
          Verificado por {docVerifySourceLabel(docVerifySource)} ·{" "}
          {fmtDateTime(docVerifiedAt)}
        </p>
      )}

      {/* Revisión manual (único camino operativo). */}
      <div
        style={{
          paddingTop: 16,
          borderTop: "1px solid var(--border)",
        }}
      >
        <div className="studio-eyebrow" style={{ marginBottom: 8 }}>
          Revisión manual
        </div>
        <p
          style={{
            font: "500 12.5px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: "0 0 12px",
          }}
        >
          Compara el nombre cargado con la foto del documento y marca el
          resultado. No se envía información a servicios externos.
        </p>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <ActionButton
            variant="dark"
            size="sm"
            idleLabel="Corresponde"
            loadingLabel="Marcando…"
            successLabel="Marcado"
            idleIcon={Icon.check(14)}
            successIcon={Icon.check(14)}
            onAction={async () => {
              const r = await markIdentityAction(clientId, markbox, "ok");
              if (r.error) return { error: r.error };
              toast.success(`Identidad marcada como corresponde · ${markbox}`);
              return;
            }}
            onSuccess={() => router.refresh()}
            onError={(m) => toast.error(m)}
          />
          {/* "No corresponde" empujado a la derecha y separado del positivo
              (Regla 8: negativo no pegado al positivo). Estado advisory
              reversible → warning, no danger. El badge de mismatch sí es rojo. */}
          <span style={{ marginLeft: "auto" }}>
            <ActionButton
              variant="warning"
              size="sm"
              idleLabel="No corresponde"
              loadingLabel="Marcando…"
              successLabel="Marcado"
              onAction={async () => {
                const r = await markIdentityAction(clientId, markbox, "mismatch");
                if (r.error) return { error: r.error };
                toast.warning(`Identidad marcada como no corresponde · ${markbox}`);
                return;
              }}
              onSuccess={() => router.refresh()}
              onError={(m) => toast.error(m)}
            />
          </span>
        </div>
      </div>
    </section>
  );
}

function NameRow({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string | null;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "140px 1fr",
        gap: 10,
        alignItems: "baseline",
      }}
    >
      <span
        style={{
          font: "600 10.5px/1.3 var(--f-sans)",
          color: "var(--ink-soft)",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <span
        style={{
          font: highlight
            ? "700 13px/1.4 var(--f-sans)"
            : "500 13px/1.4 var(--f-sans)",
          color: value
            ? highlight
              ? "var(--danger)"
              : "var(--ink)"
            : "var(--ink-mute)",
          wordBreak: "break-word",
        }}
      >
        {value ?? "—"}
      </span>
    </div>
  );
}
