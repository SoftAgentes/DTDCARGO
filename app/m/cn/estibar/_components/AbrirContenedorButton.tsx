"use client";

/**
 * AbrirContenedorButton — el operario CN pide abrir un contenedor (SDD-0157).
 *
 * Toca "Abrir contenedor" → elige el tipo (20' GP / 40' GP / 40' HC) → se crea
 * una solicitud (status 'solicitada') que la oficina autoriza desde el Studio.
 * Piel oscura (bg-sidebar) igual que el resto de /m/cn/estibar. Solo tokens.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CONTAINER_TYPE_OPTIONS } from "@/lib/studio/naviera/types";
import { requestConsolidationAction } from "../actions";

type Phase = "idle" | "choosing" | "sent";

export function AbrirContenedorButton({
  variant = "block",
}: {
  /** "block" = ancho completo (empty state) · "inline" = compacto (arriba de la lista). */
  variant?: "block" | "inline";
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function choose(type: string) {
    setError(null);
    startTransition(async () => {
      const res = await requestConsolidationAction(type);
      if (res.error) {
        setError(res.error);
        return;
      }
      setPhase("sent");
      router.refresh();
    });
  }

  if (phase === "sent") {
    return (
      <div
        style={{
          padding: "14px 16px",
          borderRadius: "var(--r-md)",
          background: "var(--surface-inv)",
          border: "1px solid var(--border-inv)",
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <span
          style={{
            font: "800 13px/1.3 var(--f-sans)",
            color: "var(--ink-side-strong)",
          }}
        >
          Solicitud enviada
        </span>
        <span style={{ font: "500 12px/1.4 var(--f-sans)", color: "var(--ink-side-soft)" }}>
          Esperando autorización de la oficina. Cuando la aprueben, el contenedor
          aparece acá para estibar.
        </span>
        <button
          type="button"
          onClick={() => {
            setPhase("idle");
            setError(null);
          }}
          style={{
            marginTop: 8,
            alignSelf: "flex-start",
            background: "transparent",
            border: "none",
            padding: 0,
            font: "700 12px/1 var(--f-sans)",
            color: "var(--ink-side)",
            cursor: "pointer",
            textDecoration: "underline",
          }}
        >
          Pedir otro
        </button>
      </div>
    );
  }

  if (phase === "choosing") {
    return (
      <div
        style={{
          padding: "14px 16px",
          borderRadius: "var(--r-md)",
          background: "var(--surface-inv)",
          border: "1px solid var(--border-inv)",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <span
          style={{
            font: "700 11px/1.3 var(--f-sans)",
            color: "var(--ink-side-soft)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          ¿Qué contenedor abres?
        </span>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {CONTAINER_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={pending}
              onClick={() => choose(opt.value)}
              style={{
                minHeight: 52,
                padding: "12px 16px",
                borderRadius: "var(--r-md)",
                background: "var(--bg-sidebar)",
                border: "1px solid var(--border-inv)",
                color: "var(--ink-side-strong)",
                font: "700 15px/1 var(--f-sans)",
                textAlign: "left",
                cursor: pending ? "wait" : "pointer",
                opacity: pending ? 0.6 : 1,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {error && (
          <span style={{ font: "600 12px/1.4 var(--f-sans)", color: "var(--danger)" }}>
            {error}
          </span>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setPhase("idle");
            setError(null);
          }}
          style={{
            alignSelf: "flex-start",
            background: "transparent",
            border: "none",
            padding: 0,
            font: "600 12px/1 var(--f-sans)",
            color: "var(--ink-side-soft)",
            cursor: "pointer",
          }}
        >
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPhase("choosing")}
      style={{
        width: variant === "block" ? "100%" : "auto",
        minHeight: variant === "block" ? 56 : 44,
        padding: variant === "block" ? "14px 18px" : "10px 16px",
        borderRadius: "var(--r-md)",
        background: "var(--surface-inv)",
        border: "1px solid var(--border-inv)",
        color: "var(--ink-side-strong)",
        font: "800 14px/1 var(--f-sans)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
      }}
    >
      + Abrir contenedor
    </button>
  );
}
