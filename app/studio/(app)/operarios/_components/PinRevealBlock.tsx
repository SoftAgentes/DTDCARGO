"use client";

/**
 * PinRevealBlock — el PIN en grande con «Copiar PIN» y la app por la que entra
 * el operario (SDD-0513, SDD-0515).
 *
 * Lo comparten el cajón de restablecer, el de alta y el diálogo «Ver PIN». El
 * PIN vive sólo en las props de este bloque: cuando el padre lo desmonta (al
 * cerrar), desaparece. No se copia a localStorage, sessionStorage, la URL ni la
 * consola; «Copiar PIN» lo pone en el portapapeles del sistema sólo cuando el
 * admin lo pide.
 *
 * Debajo va «Entra por https://dtdcargo.com/m/<región>/login», copiable: el PIN
 * de un operario de China sólo sirve en /m/cn/login y el de Venezuela sólo en
 * /m/ve/login. El enlace no lleva el PIN.
 */

import { useState } from "react";
import { Icon } from "@/app/studio/_components/icons";
import { operarioLoginUrl, type OperarioRegion } from "@/lib/studio/operario-pin";

type CopyState = "idle" | "copied" | "failed";

function useCopy(value: string) {
  const [state, setState] = useState<CopyState>("idle");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
    } catch {
      setState("failed");
    }
  };
  return [state, copy] as const;
}

const statusStyle = {
  font: "500 12px/1.4 var(--f-sans)",
  color: "var(--ink-soft)",
  minHeight: "1.4em",
} as const;

export function PinRevealBlock({ pin, region }: { pin: string; region: OperarioRegion }) {
  const [copyPin, handleCopyPin] = useCopy(pin);
  const loginUrl = operarioLoginUrl(region);
  const [copyUrl, handleCopyUrl] = useCopy(loginUrl);

  return (
    <>
      <p
        style={{
          margin: 0,
          padding: "20px 32px",
          background: "var(--bg-elevated)",
          border: "2px dashed var(--wine)",
          borderRadius: "var(--r-md)",
          font: "900 38px/1 var(--f-mono)",
          color: "var(--wine-text)",
          letterSpacing: "0.16em",
        }}
      >
        {pin}
      </p>

      <button
        type="button"
        className="studio-btn studio-btn-ghost studio-btn-sm"
        onClick={handleCopyPin}
      >
        {copyPin === "copied" ? Icon.check(14) : Icon.copy(14)}
        {copyPin === "copied" ? "Copiado" : "Copiar PIN"}
      </button>
      <span role="status" aria-live="polite" style={statusStyle}>
        {copyPin === "copied"
          ? "PIN copiado."
          : copyPin === "failed"
            ? "No se pudo copiar. Anótalo a mano."
            : ""}
      </span>

      <div
        style={{
          alignSelf: "stretch",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "var(--s-2)",
          padding: "var(--s-3) var(--s-4)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-md)",
          background: "var(--bg-surface)",
        }}
      >
        <p
          style={{
            margin: 0,
            font: "500 13px/1.45 var(--f-sans)",
            color: "var(--ink)",
            textAlign: "center",
            overflowWrap: "anywhere",
          }}
        >
          Entra por{" "}
          <span style={{ font: "700 12.5px/1.45 var(--f-mono)", color: "var(--ink)" }}>{loginUrl}</span>
        </p>
        <button
          type="button"
          className="studio-btn studio-btn-ghost studio-btn-sm"
          onClick={handleCopyUrl}
        >
          {copyUrl === "copied" ? Icon.check(14) : Icon.copy(14)}
          {copyUrl === "copied" ? "Copiado" : "Copiar enlace"}
        </button>
        <span role="status" aria-live="polite" style={statusStyle}>
          {copyUrl === "copied"
            ? "Enlace copiado."
            : copyUrl === "failed"
              ? "No se pudo copiar. Anótalo a mano."
              : ""}
        </span>
      </div>
    </>
  );
}
