/**
 * StepIndicator · breadcrumb 0 → 1 → 2 → 3 (Plan v4 — 4 steps).
 *
 * Step 0 = Tipo editorial (Informativo/Curiosidad/Polémica/Especial).
 * Steps 1-3 = Titular → Estructura → Artículo (igual que antes).
 *
 * Pasos completados / activo: bg-status-success texto white.
 * Pendiente: bg-grey-100 texto grey-500.
 */

"use client";

import React from "react";
import { Icon } from "@/app/studio/_components/icons";

type Step = 0 | 1 | 2 | 3;

const LABELS: Record<Step, string> = {
  0: "Tipo",
  1: "Titular",
  2: "Estructura",
  3: "Artículo",
};

interface Props {
  current: Step;
}

export function StepIndicator({ current }: Props) {
  const steps: Step[] = [0, 1, 2, 3];
  return (
    <div className="flex items-center gap-2 flex-wrap" aria-label="Progreso">
      {steps.map((step, i) => {
        const isDone = step < current;
        const isActive = step === current;
        const active = isDone || isActive;
        return (
          <React.Fragment key={step}>
            <div
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-colors ${
                active
                  ? "text-white"
                  : "bg-grey-100 text-grey-500 border border-grey-200"
              }`}
              style={
                active
                  ? { backgroundColor: "var(--color-status-success)" }
                  : undefined
              }
              aria-current={isActive ? "step" : undefined}
            >
              <span
                className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-bold ${
                  active ? "bg-white/20" : "bg-white"
                }`}
              >
                {isDone ? Icon.check(12) : step + 1}
              </span>
              <span>{LABELS[step]}</span>
            </div>
            {i < steps.length - 1 && (
              <span className="text-grey-300 inline-flex">{Icon.chevR(14)}</span>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
