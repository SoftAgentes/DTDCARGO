"use client";

/**
 * LangToggle — pill switcher 3 estados (Original / 中文 / Español).
 *
 * Persiste el estado en URL `?lang=<original|cn|es>`. Default = original.
 * Cambia via router.replace para no romper otros params.
 */

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import {
  LANG_OPTIONS,
  parseLangFromParam,
  type LangDisplay,
} from "@/lib/studio/warehouse-cn-types";

export function LangToggle() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const current: LangDisplay = parseLangFromParam(params.get("lang"));

  const setLang = (value: LangDisplay) => {
    const next = new URLSearchParams(params.toString());
    if (value === "original") {
      next.delete("lang");
    } else {
      next.set("lang", value);
    }
    const qs = next.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  };

  return (
    <div
      role="group"
      aria-label="Idioma de display"
      style={{
        display: "inline-flex",
        padding: 3,
        background: "var(--bg-elevated)",
        borderRadius: "var(--r-md)",
        alignItems: "center",
        gap: 4,
        border: "1px solid var(--border)",
      }}
    >
      {LANG_OPTIONS.map((opt) => {
        const active = current === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => setLang(opt.value)}
            aria-pressed={active}
            title={`Mostrar en ${opt.label}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 11px",
              borderRadius: "var(--r-sm)",
              background: active ? "var(--bg-surface)" : "transparent",
              color: active ? "var(--ink)" : "var(--ink-soft)",
              font: `${active ? "700" : "500"} 12px/1 ${opt.value === "cn" ? '"Noto Sans SC", var(--f-sans)' : "var(--f-sans)"}`,
              boxShadow: active ? "var(--shadow-xs)" : "none",
              border: 0,
              cursor: "pointer",
              transition:
                "background var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease)",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                font: "700 9px/1 var(--f-mono)",
                color: active ? "var(--wine)" : "var(--ink-mute)",
                letterSpacing: "0.06em",
                minWidth: 16,
                textAlign: "center",
              }}
            >
              {opt.short}
            </span>
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
