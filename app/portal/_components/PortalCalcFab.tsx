"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalcIcon, CloseIcon, CheckIcon, DocIcon, ArrowIcon } from "@/components/Icon";

/**
 * Calculadora flotante del portal (Norte · `PortalCalcFab` de
 * docs/design/studio/_norte/portal/app.jsx). FAB siempre visible que abre una
 * ventanita SIN sacar al cliente del portal — dos modos:
 *   · "Rápida": calculadora aritmética (saca cuentas al toque, copia el total).
 *   · "CBM": acceso directo a la Calculadora CBM completa (/calculadora), el
 *     estimado real por volumen. No se embebe porque /calculadora es una página
 *     pública completa (con su propio header/footer) — un iframe chico se vería
 *     roto; el CTA la abre en su lugar.
 *
 * Se puede abrir desde afuera despachando el evento `portal:open-calc` (lo usa
 * el botón "Calculadora CBM" del dashboard) — abre directo en la pestaña CBM.
 */
type Tab = "rapida" | "cbm";

export function PortalCalcFab() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("rapida");

  // Apertura externa (botón "Calculadora CBM" del home) → abre en CBM.
  useEffect(() => {
    function onOpenCalc() {
      setTab("cbm");
      setOpen(true);
    }
    window.addEventListener("portal:open-calc", onOpenCalc);
    return () => window.removeEventListener("portal:open-calc", onOpenCalc);
  }, []);

  // Escape cierra el panel (esperado en algo con role="dialog").
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-label="Calculadora"
          className="fixed z-[251] right-4 bottom-[84px] w-[min(360px,calc(100vw-24px))] card-shadow bg-white border border-grey-200 rounded-[16px] overflow-hidden flex flex-col"
        >
          {/* Barra navy */}
          <div
            className="flex items-center justify-between gap-2.5 px-4 py-3"
            style={{ background: "var(--color-ink)" }}
          >
            <div className="flex items-center gap-2" style={{ color: "var(--color-paper)" }}>
              <CalcIcon size={15} />
              <span
                className="text-[13px] font-bold"
                style={{ fontFamily: "var(--font-archivo-black)" }}
              >
                Calculadora
              </span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar calculadora"
              className="grid place-items-center h-9 w-9 rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-paper)]"
              style={{ color: "var(--color-paper)" }}
            >
              <CloseIcon size={16} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 px-2.5 py-2 bg-paper border-b border-grey-200">
            {(
              [
                ["rapida", "Rápida"],
                ["cbm", "CBM"],
              ] as [Tab, string][]
            ).map(([v, label]) => {
              const on = tab === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setTab(v)}
                  className={`text-[11.5px] font-bold rounded-full px-3 py-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                    on ? "" : "text-grey-700 hover:text-ink"
                  }`}
                  style={
                    on
                      ? { background: "var(--color-wine)", color: "var(--color-on-accent)" }
                      : undefined
                  }
                >
                  {label}
                </button>
              );
            })}
          </div>

          {tab === "rapida" ? <QuickCalc /> : <CbmPanel />}
        </div>
      )}

      {/* FAB */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Abrir calculadora"
        aria-expanded={open}
        className="fixed z-[252] right-4 bottom-4 inline-flex items-center gap-2 px-4 py-3 rounded-full text-[13px] font-bold card-shadow transition-transform motion-safe:hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        style={{
          background: open ? "var(--color-wine-deep, var(--color-wine))" : "var(--color-wine)",
          color: "var(--color-on-accent)",
          border: "2px solid var(--color-paper)",
        }}
      >
        <CalcIcon size={16} /> Calculadora
      </button>
    </>
  );
}

/** Calculadora aritmética · teclado + copia. Evaluador propio (sin eval). */
function QuickCalc() {
  const [expr, setExpr] = useState("");
  const [copied, setCopied] = useState(false);

  const res = safeEval(expr);
  const press = (k: string) => {
    if (k === "C") return setExpr("");
    if (k === "⌫") return setExpr((e) => e.slice(0, -1));
    if (k === "=") {
      const r = safeEval(expr);
      if (r !== "") setExpr(r);
      return;
    }
    setExpr((e) => e + k);
  };
  const copy = async () => {
    const v = res || expr;
    if (!v) return;
    try {
      await navigator.clipboard?.writeText(v);
    } catch {
      /* clipboard no disponible — sin ruido */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const keys = ["7", "8", "9", "÷", "4", "5", "6", "×", "1", "2", "3", "-", "0", ".", "%", "+"];

  return (
    <div className="p-3.5">
      <input
        value={expr}
        onChange={(e) => setExpr(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            press("=");
          }
        }}
        inputMode="decimal"
        placeholder="0"
        aria-label="Operación"
        className="w-full text-right rounded-[10px] border border-grey-200 bg-paper px-3.5 py-3 text-[22px] font-bold text-ink outline-none focus:border-ink"
        style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
      />
      <div
        className="text-right text-[13px] text-grey-500 min-h-[16px] mx-0.5 my-1.5 mb-3"
        style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
      >
        {res && res !== expr ? `= ${res}` : ""}
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {keys.map((k) => {
          const op = /[÷×\-+]/.test(k);
          return (
            <button
              key={k}
              type="button"
              onClick={() => press(k)}
              className={`py-3 rounded-[10px] border border-grey-200 text-[16px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                op ? "text-wine" : "text-ink bg-white hover:bg-grey-100"
              }`}
              style={{
                fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
                background: op ? "color-mix(in srgb, var(--color-wine) 14%, transparent)" : undefined,
              }}
            >
              {k}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-1.5 mt-1.5">
        <button
          type="button"
          onClick={() => press("C")}
          className="py-2.5 rounded-[10px] border border-grey-200 bg-white text-[13px] font-bold text-wine hover:bg-grey-100 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          C
        </button>
        <button
          type="button"
          onClick={() => press("⌫")}
          className="py-2.5 rounded-[10px] border border-grey-200 bg-white text-[15px] font-bold text-ink hover:bg-grey-100 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
          aria-label="Borrar"
        >
          ⌫
        </button>
        <button
          type="button"
          onClick={() => press("=")}
          className="py-2.5 rounded-[10px] text-[16px] font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          style={{
            background: "var(--color-wine)",
            color: "var(--color-on-accent)",
            fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
          }}
        >
          =
        </button>
      </div>

      <button
        type="button"
        onClick={copy}
        className="w-full mt-2 py-2.5 rounded-[10px] border border-grey-200 bg-white text-[12px] font-bold text-wine hover:bg-grey-100 inline-flex items-center justify-center gap-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        {copied ? <CheckIcon size={13} /> : <DocIcon size={13} />}
        {copied ? "Copiado" : "Copiar resultado"}
      </button>
    </div>
  );
}

/** Pestaña CBM · deriva a la Calculadora CBM completa (estimado por volumen). */
function CbmPanel() {
  return (
    <div className="p-4">
      <div className="text-[11px] font-bold tracking-[0.12em] uppercase text-wine">
        Estimado por volumen
      </div>
      <p className="mt-2 text-[13px] text-grey-700 leading-[1.55]">
        La Calculadora CBM saca el costo estimado de tu envío puerta a puerta según
        el volumen, el peso y tu destino. Genera un estimado que tu asesor puede
        pasar a cotización.
      </p>
      <Link
        href="/calculadora"
        className="btn btn-primary mt-4 inline-flex w-full justify-center items-center gap-2"
      >
        Abrir Calculadora CBM <ArrowIcon size={15} />
      </Link>
    </div>
  );
}

/**
 * Evaluador aritmético seguro (shunting-yard) — sin `eval`/`Function`. Soporta
 * `+ - × ÷ %`, decimales y paréntesis. Devuelve "" si la expresión es inválida
 * o incompleta (no lanza).
 */
function safeEval(input: string): string {
  const s = input.replace(/×/g, "*").replace(/÷/g, "/").trim();
  if (!s || !/^[-+*/%.()\d\s]*$/.test(s)) return "";
  try {
    const tokens = s.match(/(\d+\.?\d*|\.\d+|[-+*/%()])/g);
    if (!tokens) return "";
    const prec: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2, "%": 2 };
    const out: string[] = [];
    const ops: string[] = [];
    let prev: string | null = null;
    for (const t of tokens) {
      if (/^[\d.]/.test(t)) {
        out.push(t);
        prev = t;
      } else if (t === "(") {
        ops.push(t);
        prev = t;
      } else if (t === ")") {
        while (ops.length && ops[ops.length - 1] !== "(") out.push(ops.pop() as string);
        if (!ops.length) return "";
        ops.pop();
        prev = t;
      } else {
        // Operador. Unario "-"/"+" al inicio o tras otro operador/paréntesis.
        const unary = prev === null || prev === "(" || prev in prec;
        if (unary && (t === "-" || t === "+")) {
          out.push("0");
        }
        while (
          ops.length &&
          ops[ops.length - 1] !== "(" &&
          prec[ops[ops.length - 1]] >= prec[t]
        ) {
          out.push(ops.pop() as string);
        }
        ops.push(t);
        prev = t;
      }
    }
    while (ops.length) {
      const op = ops.pop() as string;
      if (op === "(") return "";
      out.push(op);
    }

    const st: number[] = [];
    for (const t of out) {
      if (/^[\d.]/.test(t)) {
        st.push(parseFloat(t));
      } else {
        const b = st.pop();
        const a = st.pop();
        if (a === undefined || b === undefined) return "";
        if (t === "+") st.push(a + b);
        else if (t === "-") st.push(a - b);
        else if (t === "*") st.push(a * b);
        else if (t === "/") st.push(a / b);
        else if (t === "%") st.push(a % b);
      }
    }
    if (st.length !== 1) return "";
    const v = st[0];
    if (!Number.isFinite(v)) return "";
    return String(Math.round(v * 1e8) / 1e8);
  } catch {
    return "";
  }
}
