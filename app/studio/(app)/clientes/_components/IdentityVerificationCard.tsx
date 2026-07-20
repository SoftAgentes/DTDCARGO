"use client";

/**
 * IdentityVerificationCard — verificación de identidad del cliente (SDD-0046 · Slice B2).
 *
 * Herramienta interna/CRM: cotea el documento (cédula/RIF) ↔ nombre contra el
 * registro oficial (CNE para persona / SENIAT para empresa). Resultado ADVISORY:
 * el badge NUNCA bloquea ni auto-rechaza al cliente (§5.2). Siempre se muestra el
 * nombre que devolvió el registro (`docRegistryName`) al lado del nombre cargado
 * para que el asesor lo cotee a ojo, sobre todo en "no corresponde".
 *
 * 3 capas:
 *   1. Auto por tipo · "Verificar con CNE" (persona) / "Verificar con SENIAT"
 *      (empresa, hoy cae a "no disponible" hasta Slice C) → verifyIdentityAction.
 *   2. Piso manual (siempre visible) · deep-link a la consulta oficial + marcar
 *      "corresponde / no corresponde" → markIdentityAction.
 *   3. Foto de la cédula/RIF (signed URL) para el cotejo visual.
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
  type ClientDocKind,
  type DocVerifyStatus,
  type DocVerifySource,
} from "@/lib/studio/client-types";
import { parseCedula } from "@/lib/studio/identity/document";
import { verifyIdentityAction, markIdentityAction } from "../actions";

/**
 * Consulta oficial del CNE (datos electorales por nacionalidad + cédula). Es el
 * piso manual para personas: el asesor abre, ve el nombre del padrón, y marca.
 */
const CNE_CONSULTA_URL = "http://www.cne.gob.ve/web/registro_electoral/ce.php";
/** Consulta oficial de RIF del SENIAT (BuscaRif). Piso manual para empresas. */
const SENIAT_BUSCARIF_URL =
  "http://contribuyente.seniat.gob.ve/BuscaRif/BuscaRif.jsp";

/** URL de la consulta oficial según el tipo, con prefill de cédula si aplica. */
function officialConsultUrl(
  docKind: ClientDocKind | null,
  rif: string | null,
): string {
  if (docKind === "empresa") return SENIAT_BUSCARIF_URL;
  const cedula = parseCedula(rif);
  if (cedula) {
    const qs = new URLSearchParams({
      nacionalidad: cedula.nationality,
      cedula: cedula.number,
    });
    return `${CNE_CONSULTA_URL}?${qs.toString()}`;
  }
  return CNE_CONSULTA_URL;
}

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
  docKind,
  rif,
  docVerifyStatus,
  docVerifySource,
  docRegistryName,
  docVerifiedAt,
  photoUrl,
  autoEnabled,
}: {
  clientId: string;
  markbox: string;
  name: string;
  docKind: ClientDocKind | null;
  rif: string | null;
  docVerifyStatus: DocVerifyStatus | null;
  docVerifySource: DocVerifySource | null;
  docRegistryName: string | null;
  docVerifiedAt: string | null;
  /** Signed URL (60s) de la foto de cédula/RIF, o null si no hay. */
  photoUrl: string | null;
  /**
   * ¿Hay un provider auto wired para este tipo de documento? (SDD-0046 V1
   * manual-only). Si `false`, ocultamos el botón "Verificar con CNE/SENIAT" —
   * siempre fallaría — y dejamos prominente el piso manual.
   */
  autoEnabled: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [expanded, setExpanded] = useState(false);

  const badge = docVerifyBadge(docVerifyStatus);
  const isEmpresa = docKind === "empresa";
  const autoLabel = isEmpresa ? "Verificar con SENIAT" : "Verificar con CNE";
  const consultUrl = officialConsultUrl(docKind, rif);
  const consultLabel = isEmpresa
    ? "Abrir consulta de RIF (SENIAT)"
    : "Abrir consulta de cédula (CNE)";
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
        Cotejo interno del documento contra el registro oficial. Es informativo —
        no afecta el acceso del cliente.
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

      {/* Cotejo de nombres · nombre cargado vs nombre del registro */}
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
            label="Nombre en el registro"
            value={docRegistryName!}
            highlight={docVerifyStatus === "mismatch"}
          />
        ) : (
          <NameRow label="Nombre en el registro" value={null} />
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

      {/* Auto por tipo — solo si hay provider wired (V1 manual-only, §9). Si no,
          una línea sobria que reenvía al piso manual, sin botón que siempre falla. */}
      {autoEnabled ? (
        <div style={{ display: "flex", marginBottom: 16 }}>
          <ActionButton
            variant="dark"
            size="sm"
            idleLabel={autoLabel}
            loadingLabel="Verificando…"
            successLabel="Verificación lista"
            idleIcon={Icon.shield(14)}
            successIcon={Icon.check(14)}
            onAction={async () => {
              const r = await verifyIdentityAction(clientId, markbox);
              if (r.error) return { error: r.error };
              if (r.result?.status === "unavailable") {
                toast.warning(
                  isEmpresa
                    ? "SENIAT no disponible — usa la consulta manual."
                    : "El registro no respondió — usa la consulta manual.",
                );
              } else if (r.result?.status === "mismatch") {
                toast.warning(
                  `El nombre no coincide con el registro · ${markbox}`,
                );
              } else if (r.result?.status === "ok") {
                toast.success(`Identidad verificada · ${markbox}`);
              }
              return;
            }}
            onSuccess={() => router.refresh()}
            onError={(m) => toast.error(m)}
          />
        </div>
      ) : (
        <p
          style={{
            font: "500 12.5px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: "0 0 16px",
          }}
        >
          Verificación automática no disponible — usa la consulta oficial abajo.
        </p>
      )}

      {/* Piso manual (siempre visible) */}
      <div
        style={{
          paddingTop: 16,
          borderTop: "1px solid var(--border)",
        }}
      >
        <div className="studio-eyebrow" style={{ marginBottom: 8 }}>
          Consulta manual
        </div>
        <p
          style={{
            font: "500 12.5px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: "0 0 12px",
          }}
        >
          Abre el registro oficial, compara el nombre con la foto, y marca el
          resultado a ojo.
        </p>

        <a
          href={consultUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="studio-btn studio-btn-ghost studio-btn-sm"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 12,
            textDecoration: "none",
          }}
        >
          {Icon.external(12)}
          {consultLabel}
        </a>

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
