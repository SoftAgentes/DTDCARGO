"use client";

import { useEffect, useRef, useState } from "react";
import { CalcIcon, CloseIcon, CheckIcon, DocIcon } from "@/components/Icon";

/**
 * Calculadora flotante del portal (Norte · `PortalCalcFab` de
 * docs/design/studio/_norte/portal/app.jsx). FAB redondo, icon-only y
 * **arrastrable** que abre una ventana SIN sacar al cliente del portal. Dos modos:
 *   · "CBM": la Calculadora CBM completa embebida (iframe a `/calculadora/embed`,
 *     misma tarifa que la página pública, sin su chrome). Redimensionable para
 *     verla cómoda.
 *   · "Rápida": calculadora aritmética (saca cuentas al toque, copia el total).
 *
 * Interacción (port del prototipo Norte 2026-07-04):
 *   · FAB arrastrable; al soltar se **ancla al lado más cercano** (izq/der).
 *   · La ventana abre del **mismo lado** que el FAB.
 *   · Ventana arrastrable por la barra + **redimensionable por las 2 esquinas
 *     inferiores** (derecha crece a la derecha, izquierda con borde derecho fijo).
 *   · Barra de título en navy estable (tokens `--hero-*`) — `--color-ink` NO
 *     sirve: en oscuro vira a crema y el texto blanco queda invisible.
 *
 * Se puede abrir desde afuera con el evento `portal:open-calc` → abre en CBM.
 */
type Tab = "cbm" | "rapida";
type Pos = { x: number; y: number };

const W = () => (typeof window !== "undefined" ? window.innerWidth : 1200);
const H = () => (typeof window !== "undefined" ? window.innerHeight : 800);
const clampN = (min: number, max: number, v: number) =>
  Math.max(min, Math.min(max, v));

export function PortalCalcFab() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("cbm");
  const [theme, setTheme] = useState<"dark" | "light">("light");
  const [fpos, setFpos] = useState<Pos | null>(null); // posición del FAB
  const [ppos, setPpos] = useState<Pos | null>(null); // posición de la ventana
  const [size, setSize] = useState({ w: 372, h: 520 });
  const draggedRef = useRef(false);

  // Apertura externa (evento del portal) → abre en CBM.
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

  // Tema del iframe = tema del portal (shell #portal-shell). Vive el observer
  // para re-tematizar en vivo si el cliente togglea mientras la ventana está abierta.
  useEffect(() => {
    const shell = document.getElementById("portal-shell");
    const read = () =>
      setTheme(shell?.dataset.portalTheme === "dark" ? "dark" : "light");
    read();
    if (!shell) return;
    const obs = new MutationObserver(read);
    obs.observe(shell, {
      attributes: true,
      attributeFilter: ["data-portal-theme"],
    });
    return () => obs.disconnect();
  }, []);

  // Lado del FAB → la ventana abre del mismo lado.
  const fabOnLeft = fpos ? fpos.x + 60 < W() / 2 : false;
  const px = ppos ? ppos.x : fabOnLeft ? 24 : W() - size.w - 24;
  const py = ppos ? ppos.y : H() - size.h - 92;
  const fabStyle: React.CSSProperties = fpos
    ? { left: fpos.x, top: fpos.y }
    : { right: 24, bottom: 24 };

  // ── Drag del FAB (ancla al lado más cercano al soltar) ──
  const startFabDrag = (e: React.PointerEvent) => {
    draggedRef.current = false;
    const sx = e.clientX,
      sy = e.clientY;
    const ox = fpos ? fpos.x : W() - 76,
      oy = fpos ? fpos.y : H() - 76;
    const move = (ev: PointerEvent) => {
      if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) > 4)
        draggedRef.current = true;
      setFpos({
        x: clampN(8, W() - 60, ox + (ev.clientX - sx)),
        y: clampN(8, H() - 56, oy + (ev.clientY - sy)),
      });
    };
    const up = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      // Ancla al borde más cercano; resetea la ventana para que re-derive del lado.
      setFpos((p) =>
        p ? { x: p.x + 28 < W() / 2 ? 24 : W() - 80, y: p.y } : p,
      );
      setPpos(null);
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
  };

  // ── Drag de la ventana (por la barra de título) ──
  const startPanelDrag = (e: React.PointerEvent) => {
    e.preventDefault();
    const sx = e.clientX,
      sy = e.clientY;
    const ox = ppos ? ppos.x : px,
      oy = ppos ? ppos.y : py;
    const move = (ev: PointerEvent) =>
      setPpos({
        x: clampN(8, W() - size.w, ox + (ev.clientX - sx)),
        y: clampN(8, H() - 80, oy + (ev.clientY - sy)),
      });
    const up = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
  };

  // ── Resize derecha (crece a la derecha, borde izquierdo fijo) ──
  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const sx = e.clientX,
      sy = e.clientY,
      ow = size.w,
      oh = size.h;
    if (!ppos) setPpos({ x: px, y: py });
    const move = (ev: PointerEvent) =>
      setSize({
        w: clampN(300, W() - 24, ow + (ev.clientX - sx)),
        h: clampN(320, H() - 120, oh + (ev.clientY - sy)),
      });
    const up = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
  };

  // ── Resize izquierda (crece a la izquierda, borde DERECHO fijo) ──
  const startResizeLeft = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const sx = e.clientX,
      sy = e.clientY,
      ow = size.w,
      oh = size.h;
    const rightEdge = px + size.w;
    const startY = py;
    if (!ppos) setPpos({ x: px, y: py });
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - sx;
      const newW = clampN(300, rightEdge - 8, ow - dx);
      setSize({ w: newW, h: clampN(320, H() - 120, oh + (ev.clientY - sy)) });
      setPpos({ x: rightEdge - newW, y: startY });
    };
    const up = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
  };

  const resizeGradient = (deg: number) =>
    `linear-gradient(${deg}deg, transparent 45%, var(--color-wine) 45%, var(--color-wine) 60%, transparent 60%, transparent 72%, var(--color-wine) 72%, var(--color-wine) 86%, transparent 86%)`;

  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-label="Calculadora"
          // Glass (BD-031): panel flotante = vidrio esmerilado. Superficie elevada
          // sobre el portal → aplica la excepción Glass. Siempre con
          // -webkit-backdrop-filter de respaldo; --glass-bg es translúcido y sirve
          // de fallback si el navegador no soporta blur. La barra de título sigue
          // navy sólida (abajo) para que el texto blanco cumpla AA.
          className="fixed z-[251] rounded-[16px] overflow-hidden flex flex-col"
          style={{
            left: px,
            top: py,
            width: size.w,
            height: size.h,
            maxWidth: "calc(100vw - 16px)",
            maxHeight: "calc(100vh - 24px)",
            background: "var(--glass-bg)",
            border: "1px solid var(--glass-border)",
            color: "var(--glass-ink)",
            backdropFilter: "var(--glass-blur)",
            WebkitBackdropFilter: "var(--glass-blur)",
            boxShadow: "var(--glass-hi), var(--glass-shadow)",
          }}
        >
          {/* Barra navy arrastrable — navy en AMBOS temas (tokens --hero-*, con
              fallback para cuentas no-demo que son siempre claras). */}
          <div
            onPointerDown={startPanelDrag}
            className="flex items-center justify-between gap-2.5 px-4 py-3 cursor-move select-none"
            style={{
              background: "var(--hero-from, var(--color-ink))",
              color: "var(--hero-ink, var(--color-paper))",
              touchAction: "none",
            }}
          >
            <div className="flex items-center gap-2">
              <CalcIcon size={15} />
              <span
                className="text-[13px] font-bold"
                style={{ fontFamily: "var(--font-archivo-black)" }}
              >
                Calculadora
              </span>
              <span
                className="text-[9px] font-bold tracking-[0.08em] opacity-60"
                style={{
                  fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
                }}
              >
                · arrastra
              </span>
            </div>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setOpen(false)}
              aria-label="Cerrar calculadora"
              className="grid place-items-center h-9 w-9 rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--hero-ink,var(--color-paper))]"
              style={{ color: "var(--hero-ink, var(--color-paper))" }}
            >
              <CloseIcon size={16} />
            </button>
          </div>

          {/* Tabs — tira de vidrio translúcida (BD-031), no paper opaco */}
          <div
            className="flex items-center gap-1 px-2.5 py-2"
            style={{
              background: "var(--glass-key)",
              borderBottom: "1px solid var(--glass-border)",
            }}
          >
            {(
              [
                ["cbm", "CBM"],
                ["rapida", "Rápida"],
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

          {/* Contenido */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {tab === "cbm" ? (
              // TODO Fase 7: el FAB del portal ahora muestra el cotizador FCL; el
              // CBM/LCL se retiró — revisar con el founder qué calc va en el portal.
              <iframe
                title="Calculadora FCL"
                src={`/fcl/embed?theme=${theme}`}
                className="w-full h-full block"
                style={{ border: 0, background: "var(--color-white)" }}
              />
            ) : (
              <div className="h-full overflow-y-auto">
                <QuickCalc />
              </div>
            )}
          </div>

          {/* Handles de resize (esquinas inferiores) */}
          <div
            onPointerDown={startResize}
            title="Arrastra para ampliar"
            className="absolute right-0.5 bottom-0.5"
            style={{
              width: 18,
              height: 18,
              cursor: "nwse-resize",
              touchAction: "none",
              background: resizeGradient(135),
            }}
          />
          <div
            onPointerDown={startResizeLeft}
            title="Arrastra para ampliar"
            className="absolute left-0.5 bottom-0.5"
            style={{
              width: 18,
              height: 18,
              cursor: "nesw-resize",
              touchAction: "none",
              background: resizeGradient(225),
            }}
          />
        </div>
      )}

      {/* FAB redondo, icon-only, arrastrable */}
      <button
        type="button"
        onPointerDown={startFabDrag}
        onClick={() => {
          if (!draggedRef.current) setOpen((o) => !o);
        }}
        aria-label="Abrir calculadora"
        aria-expanded={open}
        className="fixed z-[252] grid place-items-center card-shadow transition-transform motion-safe:hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        style={{
          width: 52,
          height: 52,
          borderRadius: "50%",
          background: open
            ? "var(--color-wine)"
            : "color-mix(in srgb, var(--color-wine) 78%, transparent)",
          color: "var(--color-on-accent)",
          border: "2px solid var(--color-white)",
          cursor: "grab",
          touchAction: "none",
          ...fabStyle,
        }}
      >
        <CalcIcon size={20} />
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
